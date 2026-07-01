const crypto = require("crypto");

function originAllowed(origin, allowedOrigins) {
  if (!origin) return true;
  if (allowedOrigins.includes("*")) return true;
  if (origin.startsWith("chrome-extension://") && allowedOrigins.includes("chrome-extension://*")) return true;
  return allowedOrigins.includes(origin);
}

function corsHeaders(req, config) {
  const origin = req.headers.origin || "";
  const allowOrigin = originAllowed(origin, config.allowedOrigins) ? (origin || config.allowedOrigins[0] || "null") : "null";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-revenueflow-token",
    "access-control-max-age": "600",
    "vary": "origin"
  };
}

function tokenFromRequest(req) {
  const auth = String(req.headers.authorization || "");
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, "").trim();
  return String(req.headers["x-revenueflow-token"] || "").trim();
}

function tenantFromRequest(req) {
  const token = tokenFromRequest(req);
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
}

function requireApiToken(req, config) {
  if (!config.apiToken) {
    return {
      ok: false,
      status: 500,
      code: "API_TOKEN_MISSING",
      error: "Cloud Sync API token is not configured."
    };
  }
  const supplied = tokenFromRequest(req);
  if (supplied && supplied === config.apiToken) return { ok: true };
  return {
    ok: false,
    status: 401,
    code: "UNAUTHORIZED",
    error: "Missing or invalid RevenueFlow API token."
  };
}

function publicConfig(config) {
  return {
    env: config.env,
    host: config.host,
    port: config.port,
    authConfigured: Boolean(config.apiToken),
    allowedOrigins: config.allowedOrigins,
    paypal: {
      env: config.paypal.env,
      configured: Boolean(config.paypal.clientId && config.paypal.clientSecret),
      lookbackDays: config.paypal.lookbackDays
    }
  };
}

module.exports = { corsHeaders, requireApiToken, tenantFromRequest, publicConfig };
