const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeTenantId(tenantId) {
  const value = String(tenantId || "default").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return value || "default";
}

function tenantFile(config, tenantId, name) {
  const tenant = safeTenantId(tenantId);
  const dir = path.join(config.dataDir, tenant);
  ensureDir(dir);
  return path.join(dir, name);
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function readLatest(config, tenantId) {
  return readJson(tenantFile(config, tenantId, "latest-records.json"), {
    ok: true,
    records: [],
    summary: {},
    tenantId: safeTenantId(tenantId)
  });
}

function writeLatest(config, tenantId, payload) {
  const next = {
    ...payload,
    tenantId: safeTenantId(tenantId),
    generatedAt: new Date().toISOString()
  };
  writeJson(tenantFile(config, tenantId, "latest-records.json"), next);
  return next;
}

function readMeta(config, tenantId) {
  return readJson(tenantFile(config, tenantId, "meta.json"), {
    imports: {},
    syncJobs: {}
  });
}

function writeMeta(config, tenantId, meta) {
  writeJson(tenantFile(config, tenantId, "meta.json"), meta);
  return meta;
}

module.exports = { safeTenantId, readLatest, writeLatest, readMeta, writeMeta };
