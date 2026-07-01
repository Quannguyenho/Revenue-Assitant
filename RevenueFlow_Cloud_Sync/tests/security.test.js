const test = require("node:test");
const assert = require("node:assert/strict");
const { corsHeaders, requireApiToken, tenantFromRequest, publicConfig } = require("../src/security");

function req(headers = {}) {
  return { headers };
}

test("requires a valid API token", () => {
  const config = { apiToken: "secret" };
  assert.equal(requireApiToken(req(), config).ok, false);
  assert.equal(requireApiToken(req({ authorization: "Bearer wrong" }), config).status, 401);
  assert.equal(requireApiToken(req({ authorization: "Bearer secret" }), config).ok, true);
});

test("derives tenant from token instead of client tenant id", () => {
  const first = tenantFromRequest(req({ authorization: "Bearer tenant-a", "x-tenant-id": "victim" }));
  const second = tenantFromRequest(req({ authorization: "Bearer tenant-b", "x-tenant-id": "victim" }));
  assert.notEqual(first, second);
  assert.match(first, /^[a-f0-9]{16}$/);
});

test("uses explicit CORS allowlist", () => {
  const config = { allowedOrigins: ["chrome-extension://abc"] };
  assert.equal(corsHeaders(req({ origin: "chrome-extension://abc" }), config)["access-control-allow-origin"], "chrome-extension://abc");
  assert.equal(corsHeaders(req({ origin: "https://evil.example" }), config)["access-control-allow-origin"], "null");
});

test("public config does not expose PayPal secret", () => {
  const config = {
    env: "development",
    host: "127.0.0.1",
    port: 8790,
    apiToken: "secret",
    allowedOrigins: ["chrome-extension://abc"],
    paypal: {
      env: "live",
      clientId: "client-id",
      clientSecret: "super-secret",
      lookbackDays: 7
    }
  };
  const output = publicConfig(config);
  assert.equal(output.paypal.configured, true);
  assert.equal(JSON.stringify(output).includes("super-secret"), false);
  assert.equal(JSON.stringify(output).includes("client-id"), false);
});
