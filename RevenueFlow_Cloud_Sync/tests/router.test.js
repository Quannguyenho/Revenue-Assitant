const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { route } = require("../src/router");

function mockReq({ method = "GET", url = "/", headers = {}, body = "" } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers;
  process.nextTick(() => {
    if (body) req.emit("data", Buffer.from(body));
    req.emit("end");
  });
  return req;
}

function mockRes() {
  const res = new EventEmitter();
  res.statusCode = 0;
  res.headers = {};
  res.body = "";
  res.writeHead = (status, headers) => {
    res.statusCode = status;
    res.headers = headers;
  };
  res.end = (body) => {
    res.body = body || "";
    res.emit("finish");
  };
  return res;
}

async function call(config, options) {
  const req = mockReq(options);
  const res = mockRes();
  const done = new Promise((resolve) => res.on("finish", () => resolve(res)));
  await route(req, res, config, () => ({}));
  return done;
}

function testConfig() {
  return {
    env: "test",
    host: "127.0.0.1",
    port: 8790,
    apiToken: "secret",
    allowedOrigins: ["chrome-extension://abc"],
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "revenueflow-cloud-sync-")),
    paypal: { env: "live", clientId: "", clientSecret: "", lookbackDays: 7 }
  };
}

test("keeps health public but protects records", async () => {
  const config = testConfig();
  const health = await call(config, { url: "/health" });
  assert.equal(health.statusCode, 200);
  const records = await call(config, { url: "/v1/records" });
  assert.equal(records.statusCode, 401);
});

test("imports CSV once per tenant and marks duplicate import", async () => {
  const config = testConfig();
  const csvText = `Date,Name,Type,Status,Currency,Gross,From Email Address,Transaction ID,Item Title,Invoice Number
07/01/2026,Sample Buyer,Payment Received,Completed,USD,29.00,buyer@example.com,TXN-1001,Monthly service,INV-1001`;
  const headers = { authorization: "Bearer secret", "content-type": "application/json" };
  const first = await call(config, {
    method: "POST",
    url: "/v1/csv/import",
    headers,
    body: JSON.stringify({ csvText })
  });
  assert.equal(first.statusCode, 200);
  const firstData = JSON.parse(first.body);
  assert.equal(firstData.summary.matchedCount, 1);

  const second = await call(config, {
    method: "POST",
    url: "/v1/csv/import",
    headers,
    body: JSON.stringify({ csvText })
  });
  assert.equal(second.statusCode, 200);
  const secondData = JSON.parse(second.body);
  assert.equal(secondData.duplicateImport, true);
});
