const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

function list(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function oneOf(value, allowed, fallback) {
  const normalized = String(value || "").toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function boundedNumber(value, fallback, min, max) {
  const next = Number(value || fallback);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, next));
}

function defaultToken() {
  if (process.env.NODE_ENV === "production") return "";
  return crypto.createHash("sha256").update(`${rootDir}:dev-token`).digest("hex").slice(0, 48);
}

function loadConfig() {
  const fileEnv = parseEnvFile(path.join(rootDir, ".env"));
  const env = { ...fileEnv, ...process.env };
  return {
    rootDir,
    env: env.NODE_ENV || "development",
    host: env.HOST || "127.0.0.1",
    port: boundedNumber(env.PORT, 8790, 1, 65535),
    apiToken: env.API_TOKEN || defaultToken(),
    allowedOrigins: list(env.ALLOWED_ORIGINS || "http://127.0.0.1:8790,chrome-extension://*"),
    dataDir: path.resolve(rootDir, env.DATA_DIR || "data"),
    paypal: {
      env: oneOf(env.PAYPAL_ENV, ["live", "sandbox"], "live"),
      clientId: env.PAYPAL_CLIENT_ID || "",
      clientSecret: env.PAYPAL_CLIENT_SECRET || "",
      lookbackDays: boundedNumber(env.PAYPAL_LOOKBACK_DAYS, 7, 1, 31)
    }
  };
}

const config = loadConfig();

module.exports = { config, loadConfig };
