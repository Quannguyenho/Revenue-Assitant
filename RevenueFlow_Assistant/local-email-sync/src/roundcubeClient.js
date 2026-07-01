function splitSetCookie(header) {
  if (!header) return [];
  return String(header).split(/,(?=\s*[^;,=\s]+=)/g).map((item) => item.trim()).filter(Boolean);
}

function cookiePair(setCookie) {
  return String(setCookie || "").split(";")[0];
}

function cookieName(pair) {
  return String(pair || "").split("=")[0];
}

function htmlEntity(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(text || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    const lower = entity.toLowerCase();
    if (lower[0] === "#") {
      const value = lower[1] === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : _;
    }
    return Object.prototype.hasOwnProperty.call(named, lower) ? named[lower] : _;
  });
}

function decodeQuotedPrintable(text) {
  return String(text || "")
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeMimeWords(text) {
  return String(text || "").replace(/=\?([^?]+)\?([bq])\?([^?]+)\?=/gi, (_, charset, encoding, value) => {
    try {
      if (/^b$/i.test(encoding)) return Buffer.from(value, "base64").toString(/utf-?8/i.test(charset) ? "utf8" : "latin1");
      const qp = value.replace(/_/g, " ");
      return Buffer.from(decodeQuotedPrintable(qp), "binary").toString(/utf-?8/i.test(charset) ? "utf8" : "latin1");
    } catch (_) {
      return value;
    }
  });
}

function stripHtml(html) {
  return htmlEntity(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function header(raw, name) {
  const match = String(raw || "").match(new RegExp(`^${name}:\\s*([^\\n]+(?:\\n[\\t ][^\\n]+)*)`, "im"));
  return match ? decodeMimeWords(match[1].replace(/\n[\t ]+/g, " ").trim()) : "";
}

function normalizeEmailSource(raw) {
  const text = String(raw || "").replace(/\r/g, "\n");
  const subject = header(text, "Subject");
  const from = header(text, "From") || header(text, "Return-Path");
  const date = header(text, "Date");
  let body = text.split(/\n\n/).slice(1).join("\n\n") || text;
  if (/content-transfer-encoding:\s*quoted-printable/i.test(text)) body = decodeQuotedPrintable(body);
  if (/content-transfer-encoding:\s*base64/i.test(text) && !/[<>]\w+/.test(body.slice(0, 500))) {
    const compact = body.replace(/[^A-Za-z0-9+/=]/g, "");
    if (compact.length > 80) {
      try { body = Buffer.from(compact, "base64").toString("utf8"); } catch (_) {}
    }
  }
  const readableBody = /<html|<body|<table|<div|<span/i.test(body) ? stripHtml(body) : htmlEntity(body);
  return [
    subject ? `Subject: ${subject}` : "",
    from ? `From: ${from}` : "",
    date ? `Date: ${date}` : "",
    "",
    readableBody
  ].filter((line, index) => index === 3 || line).join("\n");
}

class RoundcubeSession {
  constructor(baseUrl) {
    this.baseUrl = new URL(baseUrl || "https://cmsmart.net/webmail/");
    this.cookies = new Map();
  }

  updateCookies(response) {
    const values = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : splitSetCookie(response.headers.get("set-cookie"));
    for (const value of values) {
      const pair = cookiePair(value);
      const name = cookieName(pair);
      if (name) this.cookies.set(name, pair);
    }
  }

  cookieHeader() {
    return Array.from(this.cookies.values()).join("; ");
  }

  async request(path, options = {}) {
    let url = path instanceof URL ? path : new URL(path, this.baseUrl);
    let method = options.method || "GET";
    let body = options.body;
    for (let redirects = 0; redirects < 5; redirects += 1) {
      const headers = { ...(options.headers || {}) };
      const cookie = this.cookieHeader();
      if (cookie) headers.cookie = cookie;
      const response = await fetch(url, { ...options, method, body, headers, redirect: "manual" });
      this.updateCookies(response);
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        url = new URL(response.headers.get("location"), url);
        if (response.status === 301 || response.status === 302 || response.status === 303) {
          method = "GET";
          body = undefined;
          delete headers["content-type"];
        }
        continue;
      }
      return response;
    }
    throw new Error("Roundcube redirected too many times.");
  }
}

function formBody(values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return body;
}

function parseRequestToken(html) {
  return String(html || "").match(/"request_token":"([^"]+)"/)?.[1]
    || String(html || "").match(/name="_token"\s+value="([^"]+)"/)?.[1]
    || "";
}

function parseLoginToken(html) {
  return String(html || "").match(/name="_token"\s+value="([^"]+)"/)?.[1] || "";
}

function parseMessageRows(exec) {
  const rows = [];
  const lines = String(exec || "").split(/\n/);
  for (const line of lines) {
    const match = line.match(/this\.add_message_row\((\d+),(\{.*\}),(\{.*\}),(?:true|false)\);?$/);
    if (!match) continue;
    try {
      rows.push({
        uid: match[1],
        columns: JSON.parse(match[2]),
        flags: JSON.parse(match[3])
      });
    } catch (_) {}
  }
  return rows;
}

function textFromHtmlFragment(fragment) {
  return stripHtml(fragment);
}

async function loginRoundcube(config) {
  const session = new RoundcubeSession(config.roundcube.url);
  const loginResponse = await session.request("./");
  const loginHtml = await loginResponse.text();
  const token = parseLoginToken(loginHtml);
  if (!token) throw new Error("Roundcube login page did not return a login token.");
  const response = await session.request("./?_task=login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody({
      _token: token,
      _task: "login",
      _action: "login",
      _timezone: "Asia/Bangkok",
      _url: "",
      _user: config.roundcube.user,
      _pass: config.roundcube.password
    })
  });
  const html = await response.text();
  const requestToken = parseRequestToken(html);
  if (!requestToken || !/"task":"mail"|_task=mail|messagelist/.test(html)) {
    throw new Error("Roundcube login failed. Check webmail user and password.");
  }
  return { session, requestToken };
}

async function listRoundcubeMessages(config, session, requestToken) {
  const rows = [];
  let page = 1;
  let pageCount = 1;
  const max = config.maxMessages || 80;
  while (rows.length < max && page <= pageCount) {
    const url = new URL("./", session.baseUrl);
    url.searchParams.set("_task", "mail");
    url.searchParams.set("_action", "list");
    url.searchParams.set("_mbox", config.roundcube.mailbox || "INBOX");
    url.searchParams.set("_page", String(page));
    url.searchParams.set("_remote", "1");
    url.searchParams.set("_unlock", `loading${Date.now()}`);
    url.searchParams.set("_token", requestToken);
    const response = await session.request(url, { headers: { "X-Roundcube-Request": requestToken } });
    const data = await response.json();
    pageCount = Number(data.env?.pagecount || pageCount || 1);
    rows.push(...parseMessageRows(data.exec));
    page += 1;
  }
  return rows.slice(0, max);
}

async function fetchRoundcubeSource(config, session, uid) {
  const url = new URL("./", session.baseUrl);
  url.searchParams.set("_task", "mail");
  url.searchParams.set("_action", "viewsource");
  url.searchParams.set("_uid", String(uid));
  url.searchParams.set("_mbox", config.roundcube.mailbox || "INBOX");
  const response = await session.request(url);
  if (!response.ok) throw new Error(`Roundcube source request failed for message ${uid}.`);
  return response.text();
}

async function fetchRoundcubeEmails(config) {
  if (!config.roundcube.user || !config.roundcube.password) {
    throw new Error("Roundcube webmail user or password is missing. Open Local Sync Setup and save the webmail details.");
  }
  const { session, requestToken } = await loginRoundcube(config);
  const rows = await listRoundcubeMessages(config, session, requestToken);
  const emails = [];
  for (const row of rows) {
    const raw = await fetchRoundcubeSource(config, session, row.uid);
    emails.push({
      uid: row.uid,
      subject: htmlEntity(row.columns?.subject || ""),
      from: textFromHtmlFragment(row.columns?.fromto || ""),
      date: row.columns?.date || "",
      body: normalizeEmailSource(raw)
    });
  }
  return emails;
}

async function diagnoseRoundcube(config) {
  const result = {
    ok: false,
    url: config.roundcube.url,
    mailbox: config.roundcube.mailbox || "INBOX",
    mailboxConfigured: Boolean(config.roundcube.user && config.roundcube.password),
    checks: []
  };
  const mark = (name, ok, detail) => result.checks.push({ name, ok, detail });
  if (!config.roundcube.user || !config.roundcube.password) {
    mark("config", false, "Roundcube webmail user or password is missing.");
    return result;
  }
  mark("config", true, "Roundcube credentials are present.");
  try {
    const { session, requestToken } = await loginRoundcube(config);
    mark("login", true, "Roundcube login accepted.");
    const rows = await listRoundcubeMessages(config, session, requestToken);
    mark("mailbox", rows.length >= 0, `Mailbox ${config.roundcube.mailbox || "INBOX"} returned ${rows.length} message rows.`);
    result.ok = true;
  } catch (error) {
    mark("roundcube", false, error.message || String(error));
  }
  return result;
}

module.exports = {
  fetchRoundcubeEmails,
  diagnoseRoundcube,
  normalizeEmailSource,
  parseMessageRows
};
