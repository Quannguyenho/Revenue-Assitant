const { publicConfig, requireApiToken, tenantFromRequest } = require("./security");
const { diagnosePayPal, fetchPayPalTransactions } = require("./paypalClient");
const { parsePayPalCsv, csvImportHash } = require("./csvImport");
const { payloadFromRecords } = require("./records");
const { readLatest, writeLatest, readMeta, writeMeta } = require("./store");

const SERVICE = "RevenueFlow Cloud Sync";
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const rateMemory = new Map();

function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  res.end(body);
}

function readBody(req, maxBytes = MAX_JSON_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const body = await readBody(req);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function methodPath(req) {
  const url = new URL(req.url, "http://127.0.0.1");
  return { method: req.method || "GET", path: url.pathname };
}

function rateLimit(tenantId, action, limit, windowMs) {
  const key = `${tenantId}:${action}`;
  const now = Date.now();
  const bucket = rateMemory.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateMemory.set(key, bucket);
  return bucket.count <= limit;
}

function sources(config) {
  return {
    paypalApi: {
      available: Boolean(config.paypal.clientId && config.paypal.clientSecret),
      mode: "server-credentials",
      env: config.paypal.env,
      lookbackDays: config.paypal.lookbackDays
    },
    paypalCsv: {
      available: true,
      endpoint: "/v1/csv/import"
    },
    future: ["paypal-partner-oauth", "gmail-oauth", "outlook-graph", "imapflow"]
  };
}

function authContext(req, config) {
  const auth = requireApiToken(req, config);
  if (!auth.ok) return { auth };
  return { auth, tenantId: tenantFromRequest(req) };
}

async function handleAuthed(req, res, config, path, method, headers) {
  const { auth, tenantId } = authContext(req, config);
  if (!auth.ok) return sendJson(res, auth.status, { ok: false, errorCode: auth.code, error: auth.error }, headers);

  if (path === "/v1/config" && method === "GET") {
    return sendJson(res, 200, { ok: true, service: SERVICE, tenantId, config: publicConfig(config) }, headers);
  }
  if (path === "/v1/sources" && method === "GET") {
    return sendJson(res, 200, { ok: true, service: SERVICE, tenantId, sources: sources(config) }, headers);
  }
  if (path === "/v1/records" && method === "GET") {
    return sendJson(res, 200, readLatest(config, tenantId), headers);
  }
  if (path === "/v1/paypal/diagnostics" && method === "GET") {
    if (!rateLimit(tenantId, "paypal-diagnostics", 20, 60 * 1000)) {
      return sendJson(res, 429, { ok: false, errorCode: "RATE_LIMITED", error: "Too many diagnostics requests." }, headers);
    }
    return sendJson(res, 200, { ok: true, service: SERVICE, tenantId, paypal: await diagnosePayPal(config) }, headers);
  }
  if (path === "/v1/paypal/sync" && method === "POST") {
    if (!rateLimit(tenantId, "paypal-sync", 6, 60 * 1000)) {
      return sendJson(res, 429, { ok: false, errorCode: "RATE_LIMITED", error: "Too many PayPal sync requests." }, headers);
    }
    const data = await fetchPayPalTransactions(config);
    const payload = payloadFromRecords({
      service: SERVICE,
      mode: "paypal-api-cloud",
      records: data.records,
      sourceWindow: { startDate: data.startDate, endDate: data.endDate }
    });
    return sendJson(res, 200, writeLatest(config, tenantId, payload), headers);
  }
  if (path === "/v1/csv/import" && method === "POST") {
    if (!rateLimit(tenantId, "csv-import", 12, 60 * 1000)) {
      return sendJson(res, 429, { ok: false, errorCode: "RATE_LIMITED", error: "Too many CSV imports." }, headers);
    }
    const input = await readJsonBody(req);
    const csvText = String(input.csvText || "");
    const importHash = csvImportHash(csvText);
    const meta = readMeta(config, tenantId);
    if (meta.imports[importHash]) {
      return sendJson(res, 200, {
        ...readLatest(config, tenantId),
        ok: true,
        duplicateImport: true,
        importHash
      }, headers);
    }
    const payload = payloadFromRecords({
      service: SERVICE,
      mode: "paypal-csv-cloud",
      records: parsePayPalCsv(csvText),
      importHash
    });
    meta.imports[importHash] = { importedAt: new Date().toISOString(), count: payload.records.length };
    writeMeta(config, tenantId, meta);
    return sendJson(res, 200, writeLatest(config, tenantId, payload), headers);
  }

  return sendJson(res, 404, { ok: false, error: "Not found" }, headers);
}

async function route(req, res, config, cors) {
  const { method, path } = methodPath(req);
  const headers = cors(req);
  if (method === "OPTIONS") return sendJson(res, 200, { ok: true }, headers);
  try {
    if (path === "/" && method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        service: SERVICE,
        version: "0.1.0",
        endpoints: ["/health", "/v1/config", "/v1/sources", "/v1/records", "/v1/paypal/diagnostics", "/v1/paypal/sync", "/v1/csv/import"]
      }, headers);
    }
    if (path === "/health" && method === "GET") {
      return sendJson(res, 200, { ok: true, service: SERVICE, version: "0.1.0" }, headers);
    }
    return await handleAuthed(req, res, config, path, method, headers);
  } catch (error) {
    const raw = error && error.message ? error.message : String(error || "Cloud Sync error.");
    const message = raw.replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic <hidden>").replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer <hidden>");
    return sendJson(res, 500, { ok: false, errorCode: "CLOUD_SYNC_ERROR", error: message }, headers);
  }
}

module.exports = { route, readJsonBody, rateLimit };
