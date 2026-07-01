const http = require("http");
const { config, publicConfig, saveLocalSetup } = require("./config");
const { fetchRecentEmails, diagnoseImap } = require("./imapClient");
const { fetchPayPalTransactions, diagnosePayPal } = require("./paypalClient");
const { fetchRoundcubeEmails, diagnoseRoundcube } = require("./roundcubeClient");
const { parsePaymentEmail } = require("./paypalParser");
const { parsePayPalCsv } = require("./csvImport");
const { readJson, writeJson } = require("./processedStore");
const { setupPage } = require("./setupPage");

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(body);
}

function sendHtml(res, status, body) {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "access-control-allow-origin": "*"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
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

function keywordMatch(text) {
  const value = String(text || "").toLowerCase();
  if (config.ignoreKeywords.some((keyword) => value.includes(keyword.toLowerCase()))) return false;
  return config.paymentKeywords.some((keyword) => value.includes(keyword.toLowerCase()));
}

function annotateDuplicates(records) {
  const seen = new Set();
  return records.map((record) => {
    const key = [record.transactionId, record.orderNo, record.profileId, record.amountUsd, record.customerEmail].filter(Boolean).join("|").toLowerCase();
    const isDuplicate = key && seen.has(key);
    if (key) seen.add(key);
    return { ...record, isDuplicate };
  });
}

function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    })
  ]);
}

function safeError(error) {
  const raw = String(error && error.message ? error.message : error || "");
  const message = raw.replace(/LOGIN\s+"[^"]*"\s+"[^"]*"/i, 'LOGIN "<mailbox>" "<hidden>"');
  if (/AUTHENTICATIONFAILED|authentication failed|LOGIN\b/i.test(message)) {
    return {
      errorCode: "IMAP_AUTH_FAILED",
      error: "IMAP authentication failed. Open Local Sync Setup, check the mailbox user and password, then save and try again."
    };
  }
  if (/timeout|EACCES|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network|certificate/i.test(message)) {
    return {
      errorCode: "IMAP_CONNECTION_FAILED",
      error: "IMAP server could not be reached. Check IMAP_HOST, IMAP_PORT, firewall, and internet connection."
    };
  }
  if (/IMAP_USER|IMAP_PASSWORD/i.test(message)) {
    return {
      errorCode: "IMAP_CONFIG_MISSING",
      error: "IMAP mailbox user or password is missing. Open Local Sync Setup and save the mail host details."
    };
  }
  if (/PAYPAL_CLIENT_ID|PAYPAL_CLIENT_SECRET/i.test(message)) {
    return {
      errorCode: "PAYPAL_CONFIG_MISSING",
      error: "PayPal API credentials are missing. Open Local Sync Setup and save the PayPal Client ID and Secret."
    };
  }
  if (/Roundcube|webmail/i.test(message)) {
    return {
      errorCode: "ROUNDCUBE_WEBMAIL_FAILED",
      error: message.replace(/password[^.]+/ig, "password hidden")
    };
  }
  return { errorCode: "LOCAL_EMAIL_SYNC_ERROR", error: message || "Local Email Sync failed." };
}

async function syncMailbox() {
  if (String(config.sourceMode || "").toLowerCase() === "paypal") {
    return syncPayPal();
  }
  const mode = String(config.sourceMode || "").toLowerCase();
  const emails = mode === "roundcube" ? await fetchRoundcubeEmails(config) : await fetchRecentEmails(config);
  const matched = [];
  for (const email of emails) {
    if (!keywordMatch(email.body)) continue;
    const parsed = parsePaymentEmail(email.body);
    matched.push({
      ...parsed,
      source: mode === "roundcube" ? "roundcubeWebmail" : parsed.source,
      id: `${mode === "roundcube" ? "roundcube" : "imap"}-${email.uid}`,
      sourceMessageId: String(email.uid),
      receivedAt: new Date().toISOString()
    });
  }
  const records = annotateDuplicates(matched);
  const needReview = records.filter((record) => record.needReview).length;
  const duplicates = records.filter((record) => record.isDuplicate);
  const payload = {
    ok: true,
    service: "RevenueFlow Local Email Sync",
    version: "1.2.0",
    mode: mode === "roundcube" ? "roundcube-webmail" : "local-imap",
    mailbox: mode === "roundcube" ? config.roundcube.user : config.imap.user,
    scanned: emails.length,
    matched: records.length,
    records,
    duplicates,
    needReview,
    lastSyncAt: new Date().toISOString(),
    summary: {
      scannedCount: emails.length,
      matchedCount: records.length,
      parsedCount: records.length,
      writableCount: records.length - needReview,
      skippedDuplicates: duplicates.length,
      needReviewCount: needReview
    }
  };
  writeJson(config.outputFile, payload);
  return payload;
}

async function syncPayPal() {
  const data = await fetchPayPalTransactions(config);
  const records = annotateDuplicates(data.records);
  const needReview = records.filter((record) => record.needReview).length;
  const duplicates = records.filter((record) => record.isDuplicate);
  const payload = {
    ok: true,
    service: "RevenueFlow Local Email Sync",
    version: "1.2.0",
    mode: "paypal-api",
    scanned: records.length,
    matched: records.length,
    records,
    duplicates,
    needReview,
    lastSyncAt: new Date().toISOString(),
    sourceWindow: {
      startDate: data.startDate,
      endDate: data.endDate
    },
    summary: {
      scannedCount: records.length,
      matchedCount: records.length,
      parsedCount: records.length,
      writableCount: records.length - needReview,
      skippedDuplicates: duplicates.length,
      needReviewCount: needReview
    }
  };
  writeJson(config.outputFile, payload);
  return payload;
}

function importCsvRecords(csvText) {
  const records = annotateDuplicates(parsePayPalCsv(csvText));
  const needReview = records.filter((record) => record.needReview).length;
  const duplicates = records.filter((record) => record.isDuplicate);
  const payload = {
    ok: true,
    service: "RevenueFlow Local Email Sync",
    version: "1.2.0",
    mode: "paypal-csv",
    scanned: records.length,
    matched: records.length,
    records,
    duplicates,
    needReview,
    lastSyncAt: new Date().toISOString(),
    summary: {
      scannedCount: records.length,
      matchedCount: records.length,
      parsedCount: records.length,
      writableCount: records.length - needReview,
      skippedDuplicates: duplicates.length,
      needReviewCount: needReview
    }
  };
  writeJson(config.outputFile, payload);
  return payload;
}

function sourceStatus() {
  return {
    active: config.sourceMode,
    imap: {
      configured: Boolean(config.imap.user && config.imap.password),
      host: config.imap.host,
      port: config.imap.port,
      secure: Boolean(config.imap.secure),
      mailbox: config.imap.mailbox || "INBOX"
    },
    paypal: {
      configured: Boolean(config.paypal.clientId && config.paypal.clientSecret),
      env: config.paypal.env,
      lookbackDays: config.paypal.lookbackDays
    },
    roundcube: {
      configured: Boolean(config.roundcube.user && config.roundcube.password),
      url: config.roundcube.url,
      mailbox: config.roundcube.mailbox || "INBOX"
    },
    csv: {
      available: true,
      endpoint: "/import-csv"
    }
  };
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  try {
    if (req.url === "/") {
      return sendJson(res, 200, {
        ok: true,
        service: "RevenueFlow Local Email Sync",
        endpoints: ["/setup", "/config", "/sources", "/source-mode", "/health", "/diagnostics", "/sync", "/import-csv", "/latest", "/paypal/health", "/paypal/sync", "/paypal/latest", "/paypal/import-csv"]
      });
    }
    if (req.url === "/setup") return sendHtml(res, 200, setupPage());
    if (req.url === "/config" && req.method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        service: "RevenueFlow Local Email Sync",
        version: "1.2.0",
        config: publicConfig()
      });
    }
    if (req.url === "/config" && req.method === "POST") {
      const input = await readJsonBody(req);
      const nextConfig = saveLocalSetup(input);
      return sendJson(res, 200, {
        ok: true,
        service: "RevenueFlow Local Email Sync",
        version: "1.2.0",
        config: publicConfig(nextConfig)
      });
    }
    if (req.url === "/sources") {
      return sendJson(res, 200, {
        ok: true,
        service: "RevenueFlow Local Email Sync",
        version: "1.2.0",
        sources: sourceStatus()
      });
    }
    if (req.url === "/source-mode" && req.method === "POST") {
      const input = await readJsonBody(req);
      const nextConfig = saveLocalSetup({ sourceMode: input.sourceMode });
      return sendJson(res, 200, {
        ok: true,
        service: "RevenueFlow Local Email Sync",
        version: "1.2.0",
        sources: sourceStatus(),
        config: publicConfig(nextConfig)
      });
    }
    if (req.url === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "RevenueFlow Local Email Sync",
        version: "1.2.0",
        mode: config.sourceMode === "paypal" ? "paypal-api" : config.sourceMode === "roundcube" ? "roundcube-webmail" : "local-imap",
        sourceMode: config.sourceMode,
        mailboxConfigured: Boolean(config.imap.user && config.imap.password),
        mailbox: config.imap.user || "",
        paypalConfigured: Boolean(config.paypal.clientId && config.paypal.clientSecret),
        roundcubeConfigured: Boolean(config.roundcube.user && config.roundcube.password),
        roundcubeMailbox: config.roundcube.user || ""
      });
    }
    if (req.url === "/paypal/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "RevenueFlow Local Email Sync",
        version: "1.2.0",
        mode: "paypal-api",
        paypalConfigured: Boolean(config.paypal.clientId && config.paypal.clientSecret),
        paypalEnv: config.paypal.env,
        lookbackDays: config.paypal.lookbackDays
      });
    }
    if (req.url === "/diagnostics") {
      if (String(config.sourceMode || "").toLowerCase() === "paypal") {
        const paypal = await withTimeout(diagnosePayPal(config), 12000, {
          ok: false,
          env: config.paypal.env,
          configured: Boolean(config.paypal.clientId && config.paypal.clientSecret),
          checks: [{
            name: "timeout",
            ok: false,
            detail: "PayPal diagnostics timed out. Check internet access and PayPal credentials."
          }]
        });
        return sendJson(res, 200, {
          ok: true,
          service: "RevenueFlow Local Email Sync",
          version: "1.2.0",
          mode: "paypal-api",
          paypal
        });
      }
      if (String(config.sourceMode || "").toLowerCase() === "roundcube") {
        const roundcube = await withTimeout(diagnoseRoundcube(config), 15000, {
          ok: false,
          url: config.roundcube.url,
          mailbox: config.roundcube.mailbox || "INBOX",
          mailboxConfigured: Boolean(config.roundcube.user && config.roundcube.password),
          checks: [{
            name: "timeout",
            ok: false,
            detail: "Roundcube diagnostics timed out. Check webmail URL, mailbox user, password, or network access."
          }]
        });
        return sendJson(res, 200, {
          ok: true,
          service: "RevenueFlow Local Email Sync",
          version: "1.2.0",
          mode: "roundcube-webmail",
          roundcube
        });
      }
      const diagnostics = await withTimeout(diagnoseImap(config), 12000, {
        ok: false,
        host: config.imap.host,
        port: config.imap.port,
        secure: Boolean(config.imap.secure),
        mailbox: config.imap.mailbox || "INBOX",
        mailboxConfigured: Boolean(config.imap.user && config.imap.password),
        checks: [{
          name: "timeout",
          ok: false,
          detail: "Diagnostics timed out while checking the IMAP host. Check IMAP_HOST, IMAP_PORT, IMAP_SECURE, firewall, or mail server IMAP access."
        }]
      });
      return sendJson(res, 200, {
        ok: true,
        service: "RevenueFlow Local Email Sync",
        version: "1.2.0",
        mode: "local-imap",
        diagnostics
      });
    }
    if (req.url === "/sync" && req.method === "POST") return sendJson(res, 200, await syncMailbox());
    if (req.url === "/paypal/sync" && req.method === "POST") return sendJson(res, 200, await syncPayPal());
    if (req.url === "/import-csv" && req.method === "POST") {
      const input = await readJsonBody(req);
      return sendJson(res, 200, importCsvRecords(input.csvText || ""));
    }
    if (req.url === "/paypal/import-csv" && req.method === "POST") {
      const input = await readJsonBody(req);
      return sendJson(res, 200, importCsvRecords(input.csvText || ""));
    }
    if (req.url === "/latest") return sendJson(res, 200, readJson(config.outputFile, { ok: true, records: [], summary: {} }));
    if (req.url === "/paypal/latest") return sendJson(res, 200, readJson(config.outputFile, { ok: true, records: [], summary: {} }));
    return sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    return sendJson(res, 500, { ok: false, ...safeError(error) });
  }
}

if (process.argv.includes("--sync-once")) {
  syncMailbox().then((data) => {
    console.log(JSON.stringify(data, null, 2));
  }).catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
} else {
  http.createServer(handle).listen(config.port, config.host, () => {
    console.log(`RevenueFlow Local Email Sync running at http://${config.host}:${config.port}`);
  });
}

module.exports = { syncMailbox };
