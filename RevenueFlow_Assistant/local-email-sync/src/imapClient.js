const tls = require("tls");
const net = require("net");

function quote(value) {
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function stripLiteralMarkers(text) {
  return String(text || "").replace(/\)\r?\n[A-Z]\d+ OK[\s\S]*$/i, "").replace(/^\* \d+ FETCH[^\r\n]*\r?\n?/i, "");
}

function safeCommandLabel(command) {
  const value = String(command || "");
  if (/^LOGIN\b/i.test(value)) return 'LOGIN "<mailbox>" "<hidden>"';
  return value;
}

class ImapClient {
  constructor(options) {
    this.options = options;
    this.socket = null;
    this.buffer = "";
    this.tag = 0;
  }

  connect() {
    const { host, port, secure } = this.options;
    const timeoutMs = Number(this.options.connectTimeoutMs || 15000);
    this.socket = secure
      ? tls.connect({ host, port, servername: host, rejectUnauthorized: false })
      : net.connect({ host, port });
    this.socket.setEncoding("utf8");
    this.socket.on("error", () => {
      // Errors are surfaced through the active connect/command promise. Keep
      // this listener so late socket errors do not terminate the local service.
    });
    this.socket.on("data", (chunk) => {
      this.buffer += chunk;
    });
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.socket) this.socket.destroy();
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error("IMAP connection timeout.")), timeoutMs);
      this.socket.once("error", fail);
      const check = () => {
        if (settled) return;
        if (/^\* OK/im.test(this.buffer)) {
          settled = true;
          clearTimeout(timer);
          resolve();
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }

  command(command) {
    const tag = `A${++this.tag}`;
    const timeoutMs = Number(this.options.commandTimeoutMs || 30000);
    this.buffer = "";
    this.socket.write(`${tag} ${command}\r\n`);
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error(`IMAP command timeout: ${safeCommandLabel(command)}`)), timeoutMs);
      this.socket.once("error", fail);
      const check = () => {
        if (settled) return;
        const ok = new RegExp(`^${tag} OK`, "im");
        const no = new RegExp(`^${tag} (NO|BAD)\\b(.*)$`, "im");
        const bad = this.buffer.match(no);
        if (bad) {
          fail(new Error(`IMAP command failed: ${safeCommandLabel(command)}. ${bad[2] || ""}`.trim()));
          return;
        }
        if (ok.test(this.buffer)) {
          settled = true;
          clearTimeout(timer);
          resolve(this.buffer);
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }

  async login() {
    await this.command(`LOGIN ${quote(this.options.user)} ${quote(this.options.password)}`);
  }

  async examine(mailbox) {
    await this.command(`EXAMINE ${quote(mailbox || "INBOX")}`);
  }

  async searchAll() {
    const response = await this.command("UID SEARCH ALL");
    const match = response.match(/\* SEARCH\s+([0-9\s]+)/i);
    return match ? match[1].trim().split(/\s+/).filter(Boolean) : [];
  }

  async fetchBody(uid) {
    const response = await this.command(`UID FETCH ${uid} (BODY.PEEK[] INTERNALDATE)`);
    return stripLiteralMarkers(response);
  }

  async logout() {
    try {
      if (this.socket) await this.command("LOGOUT");
    } catch (_) {
      // Best effort.
    } finally {
      if (this.socket) this.socket.destroy();
    }
  }
}

async function fetchRecentEmails(config) {
  const client = new ImapClient({
    ...config.imap,
    connectTimeoutMs: 6000,
    commandTimeoutMs: 8000
  });
  if (!config.imap.user || !config.imap.password) {
    throw new Error("IMAP mailbox user or password is missing. Open Local Sync Setup and save the mail host details.");
  }
  await client.connect();
  try {
    await client.login();
    await client.examine(config.imap.mailbox);
    const uids = await client.searchAll();
    const limit = Number(config.maxMessages || 0);
    const recent = (limit > 0 ? uids.slice(-limit) : uids).reverse();
    const messages = [];
    for (const uid of recent) {
      const body = await client.fetchBody(uid);
      messages.push({ uid, body });
    }
    return messages;
  } finally {
    if (client.socket) client.socket.destroy();
  }
}

async function diagnoseImap(config) {
  const result = {
    host: config.imap.host,
    port: config.imap.port,
    secure: Boolean(config.imap.secure),
    mailbox: config.imap.mailbox || "INBOX",
    mailboxConfigured: Boolean(config.imap.user && config.imap.password),
    checks: []
  };
  const mark = (name, ok, detail = "") => {
    result.checks.push({ name, ok: Boolean(ok), detail });
  };
  if (!config.imap.user || !config.imap.password) {
    mark("config", false, "IMAP mailbox user or password is missing. Open Local Sync Setup and save the mail host details.");
    result.ok = false;
    return result;
  }
  mark("config", true, "IMAP credentials are present.");
  const client = new ImapClient(config.imap);
  try {
    await client.connect();
    mark("connect", true, `Connected to ${config.imap.host}:${config.imap.port}.`);
    await client.login();
    mark("login", true, "IMAP login accepted.");
    await client.examine(config.imap.mailbox);
    mark("mailbox", true, `Mailbox ${config.imap.mailbox || "INBOX"} is readable.`);
    result.ok = true;
    return result;
  } catch (error) {
    const message = error && error.message ? error.message : String(error || "Unknown IMAP error.");
    if (!result.checks.some((check) => check.name === "connect")) mark("connect", false, message);
    else if (!result.checks.some((check) => check.name === "login")) mark("login", false, message);
    else mark("mailbox", false, message);
    result.ok = false;
    return result;
  } finally {
    await client.logout();
  }
}

module.exports = { fetchRecentEmails, diagnoseImap };
