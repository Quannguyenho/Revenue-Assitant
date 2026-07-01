const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const DEFAULT_PAYMENT_KEYWORDS = "payment received,you received a payment,amount received,invoice paid,paid your invoice,subscription payment received,recurring payment received";
const DEFAULT_IGNORE_KEYWORDS = "security alert,login code,password reset,verification code,automatic payments from,suspended,couldn't process,could not process,receipt for your payment,you sent a payment";

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

function bool(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function csv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function oneOf(value, allowed, fallback) {
  const normalized = String(value || "").toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function maxMessages(value, fallback = 0) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw || raw === "all" || raw === "0") return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(5000, parsed));
}

function buildConfig() {
  const fileEnv = parseEnvFile(envPath);
  const env = { ...fileEnv, ...process.env };
  return {
    rootDir,
    sourceMode: oneOf(env.SOURCE_MODE, ["imap", "paypal", "roundcube"], "imap"),
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 8787),
    imap: {
      host: env.IMAP_HOST || "srv.cmsmart.net",
      port: Number(env.IMAP_PORT || 993),
      secure: bool(env.IMAP_SECURE, true),
      user: env.IMAP_USER || "",
      password: env.IMAP_PASSWORD || "",
      mailbox: env.IMAP_MAILBOX || "INBOX"
    },
    maxMessages: maxMessages(env.MAX_MESSAGES, 0),
    paymentKeywords: csv(env.PAYMENT_KEYWORDS || DEFAULT_PAYMENT_KEYWORDS),
    ignoreKeywords: csv(env.IGNORE_KEYWORDS || DEFAULT_IGNORE_KEYWORDS),
    paypal: {
      env: oneOf(env.PAYPAL_ENV, ["live", "sandbox"], "live"),
      clientId: env.PAYPAL_CLIENT_ID || "",
      clientSecret: env.PAYPAL_CLIENT_SECRET || "",
      lookbackDays: Math.max(1, Math.min(31, Number(env.PAYPAL_LOOKBACK_DAYS || 7)))
    },
    roundcube: {
      url: env.ROUNDCUBE_URL || "https://cmsmart.net/webmail/",
      user: env.ROUNDCUBE_USER || env.IMAP_USER || "",
      password: env.ROUNDCUBE_PASSWORD || "",
      mailbox: env.ROUNDCUBE_MAILBOX || env.IMAP_MAILBOX || "INBOX"
    },
    outputFile: path.resolve(rootDir, env.OUTPUT_FILE || "output/latest-records.json")
  };
}

const config = buildConfig();

function reloadConfig() {
  const next = buildConfig();
  Object.keys(config).forEach((key) => delete config[key]);
  Object.assign(config, next);
  return config;
}

function publicConfig(current = config) {
  return {
    sourceMode: current.sourceMode,
    host: current.host,
    port: current.port,
    maxMessages: current.maxMessages,
    imap: {
      host: current.imap.host,
      port: current.imap.port,
      secure: Boolean(current.imap.secure),
      user: current.imap.user,
      mailbox: current.imap.mailbox,
      passwordConfigured: Boolean(current.imap.password)
    },
    paypal: {
      env: current.paypal.env,
      clientId: current.paypal.clientId,
      clientSecretConfigured: Boolean(current.paypal.clientSecret),
      lookbackDays: current.paypal.lookbackDays
    },
    roundcube: {
      url: current.roundcube.url,
      user: current.roundcube.user,
      mailbox: current.roundcube.mailbox,
      passwordConfigured: Boolean(current.roundcube.password)
    },
    paymentKeywords: current.paymentKeywords.join(", "),
    ignoreKeywords: current.ignoreKeywords.join(", ")
  };
}

function envValue(value) {
  const text = String(value ?? "");
  if (!text || /[\s#"'=]/.test(text)) return JSON.stringify(text);
  return text;
}

function writeEnvFile(values) {
  const orderedKeys = [
    "SOURCE_MODE",
    "HOST",
    "PORT",
    "IMAP_HOST",
    "IMAP_PORT",
    "IMAP_SECURE",
    "IMAP_USER",
    "IMAP_PASSWORD",
    "IMAP_MAILBOX",
    "MAX_MESSAGES",
    "PAYMENT_KEYWORDS",
    "IGNORE_KEYWORDS",
    "PAYPAL_ENV",
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_LOOKBACK_DAYS",
    "ROUNDCUBE_URL",
    "ROUNDCUBE_USER",
    "ROUNDCUBE_PASSWORD",
    "ROUNDCUBE_MAILBOX",
    "OUTPUT_FILE"
  ];
  const keys = [...orderedKeys, ...Object.keys(values).filter((key) => !orderedKeys.includes(key)).sort()];
  const body = keys
    .filter((key) => values[key] !== undefined)
    .map((key) => `${key}=${envValue(values[key])}`)
    .join("\n");
  fs.writeFileSync(envPath, `${body}\n`, { encoding: "utf8", mode: 0o600 });
}

function saveLocalSetup(input = {}) {
  const existing = parseEnvFile(envPath);
  const next = { ...existing };
  const sourceMode = oneOf(input.sourceMode || next.SOURCE_MODE, ["imap", "paypal", "roundcube"], "imap");
  next.SOURCE_MODE = sourceMode;
  next.HOST = input.host || next.HOST || "127.0.0.1";
  next.PORT = String(Math.max(1, Math.min(65535, Number(input.port || next.PORT || 8787))));
  next.MAX_MESSAGES = String(maxMessages(input.maxMessages ?? next.MAX_MESSAGES, 0));
  next.PAYMENT_KEYWORDS = String(input.paymentKeywords || next.PAYMENT_KEYWORDS || DEFAULT_PAYMENT_KEYWORDS);
  next.IGNORE_KEYWORDS = String(input.ignoreKeywords || next.IGNORE_KEYWORDS || DEFAULT_IGNORE_KEYWORDS);

  if (input.imap) {
    next.IMAP_HOST = String(input.imap.host || next.IMAP_HOST || "srv.cmsmart.net").trim();
    next.IMAP_PORT = String(Math.max(1, Math.min(65535, Number(input.imap.port || next.IMAP_PORT || 993))));
    next.IMAP_SECURE = bool(input.imap.secure, bool(next.IMAP_SECURE, true)) ? "true" : "false";
    next.IMAP_USER = String(input.imap.user || next.IMAP_USER || "").trim();
    if (String(input.imap.password || "").trim()) next.IMAP_PASSWORD = String(input.imap.password).trim();
    next.IMAP_MAILBOX = String(input.imap.mailbox || next.IMAP_MAILBOX || "INBOX").trim();
  }

  if (input.paypal) {
    next.PAYPAL_ENV = oneOf(input.paypal.env || next.PAYPAL_ENV, ["live", "sandbox"], "live");
    next.PAYPAL_CLIENT_ID = String(input.paypal.clientId || next.PAYPAL_CLIENT_ID || "").trim();
    if (String(input.paypal.clientSecret || "").trim()) next.PAYPAL_CLIENT_SECRET = String(input.paypal.clientSecret).trim();
    next.PAYPAL_LOOKBACK_DAYS = String(Math.max(1, Math.min(31, Number(input.paypal.lookbackDays || next.PAYPAL_LOOKBACK_DAYS || 7))));
  }

  if (input.roundcube) {
    next.ROUNDCUBE_URL = String(input.roundcube.url || next.ROUNDCUBE_URL || "https://cmsmart.net/webmail/").trim();
    next.ROUNDCUBE_USER = String(input.roundcube.user || next.ROUNDCUBE_USER || next.IMAP_USER || "").trim();
    if (String(input.roundcube.password || "").trim()) next.ROUNDCUBE_PASSWORD = String(input.roundcube.password).trim();
    next.ROUNDCUBE_MAILBOX = String(input.roundcube.mailbox || next.ROUNDCUBE_MAILBOX || next.IMAP_MAILBOX || "INBOX").trim();
  }

  writeEnvFile(next);
  return reloadConfig();
}

module.exports = { config, publicConfig, reloadConfig, saveLocalSetup };
