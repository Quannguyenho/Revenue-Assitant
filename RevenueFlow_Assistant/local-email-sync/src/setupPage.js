function setupPage() {
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RevenueFlow Local Sync Setup</title>
  <style>
    :root{color-scheme:light dark;font-family:Inter,Segoe UI,Arial,sans-serif;background:#f5f7fb;color:#111827}
    body{margin:0;padding:24px}
    main{max-width:920px;margin:0 auto}
    header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}
    h1{font-size:24px;margin:0 0 6px}
    p{color:#4b5563;margin:0 0 12px}
    .badge{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:6px 10px;font-weight:700;font-size:12px}
    .panel{background:#fff;border:1px solid #dbe4f0;border-radius:8px;padding:18px;margin-bottom:14px;box-shadow:0 10px 24px rgba(15,23,42,.06)}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#374151}
    input,select,textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:10px;background:#fff;color:#111827;font:inherit}
    textarea{min-height:70px;resize:vertical}
    .full{grid-column:1/-1}
    .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
    button{border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;background:#e0f2fe;color:#0f172a;font-weight:800;cursor:pointer}
    button.primary{background:#111827;color:#fff;border-color:#111827}
    button:disabled{opacity:.55;cursor:wait}
    .status{white-space:pre-wrap;border-radius:8px;padding:12px;background:#f8fafc;border:1px solid #dbe4f0;color:#334155;margin-top:12px}
    .status.ok{border-color:#86efac;background:#f0fdf4;color:#166534}
    .status.warn{border-color:#fecaca;background:#fef2f2;color:#991b1b}
    .hint{font-size:12px;color:#64748b}
    @media (max-width:720px){body{padding:12px}.grid{grid-template-columns:1fr}header{display:block}.badge{display:inline-block;margin-top:8px}}
    @media (prefers-color-scheme:dark){:root{background:#0f172a;color:#e5e7eb}.panel,input,select,textarea{background:#111827;color:#e5e7eb;border-color:#334155}p,.hint,label{color:#cbd5e1}.status{background:#111827;color:#e5e7eb;border-color:#334155}.badge{background:#172554;color:#bfdbfe;border-color:#1d4ed8}}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>RevenueFlow Local Sync Setup</h1>
        <p>Thiết lập nguồn payment cho máy local/team. Password và API secret chỉ lưu trong service local, không lưu trong Chrome extension.</p>
      </div>
      <span id="modeBadge" class="badge">Đang tải</span>
    </header>

    <section class="panel">
      <div class="grid">
        <label>Nguồn dữ liệu
          <select id="sourceMode">
            <option value="roundcube">Roundcube Webmail</option>
            <option value="paypal">PayPal API</option>
            <option value="imap">Mail host / IMAP</option>
          </select>
        </label>
        <label>Số ngày PayPal cần quét
          <input id="paypalLookbackDays" type="number" min="1" max="31">
        </label>
      </div>
    </section>

    <section class="panel">
      <h2>PayPal API</h2>
      <p class="hint">Dùng khi cần lấy transaction trực tiếp từ PayPal, không phụ thuộc email forward hay mail host.</p>
      <div class="grid">
        <label>Environment
          <select id="paypalEnv">
            <option value="live">Live</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </label>
        <label>Client ID
          <input id="paypalClientId" autocomplete="off">
        </label>
        <label class="full">Client Secret
          <input id="paypalClientSecret" type="password" autocomplete="new-password" placeholder="Để trống nếu muốn giữ secret đã lưu">
        </label>
      </div>
    </section>

    <section class="panel">
      <h2>Roundcube Webmail</h2>
      <p class="hint">Dung khi webmail mo duoc nhung IMAP bi firewall chan. Service local dang nhap webmail, doc source email PayPal, roi dua payment vao RevenueFlow.</p>
      <div class="grid">
        <label class="full">Webmail URL
          <input id="roundcubeUrl" placeholder="https://example.com/webmail/">
        </label>
        <label>Mailbox user
          <input id="roundcubeUser" autocomplete="off" placeholder="invoicing@example.com">
        </label>
        <label>Mailbox folder
          <input id="roundcubeMailbox" placeholder="INBOX">
        </label>
        <label class="full">Webmail password
          <input id="roundcubePassword" type="password" autocomplete="new-password" placeholder="De trong neu muon giu password da luu">
        </label>
      </div>
    </section>

    <section class="panel">
      <h2>Mail host / IMAP</h2>
      <p class="hint">Dùng cho mailbox nội bộ hoặc mail host riêng. Nếu port IMAP bị firewall chặn, hãy dùng PayPal API hoặc whitelist IP cloud sau này.</p>
      <div class="grid">
        <label>IMAP host
          <input id="imapHost" placeholder="mail.example.com">
        </label>
        <label>IMAP port
          <input id="imapPort" type="number" min="1" max="65535">
        </label>
        <label>Mailbox user
          <input id="imapUser" autocomplete="off" placeholder="invoicing@example.com">
        </label>
        <label>Mailbox folder
          <input id="imapMailbox" placeholder="INBOX">
        </label>
        <label>Security
          <select id="imapSecure">
            <option value="true">SSL/TLS</option>
            <option value="false">Plain/STARTTLS off</option>
          </select>
        </label>
        <label>Password / App password
          <input id="imapPassword" type="password" autocomplete="new-password" placeholder="Để trống nếu muốn giữ password đã lưu">
        </label>
      </div>
    </section>

    <section class="panel">
      <h2>Nâng cao</h2>
      <div class="grid">
        <label>Max messages
          <input id="maxMessages" type="number" min="0" max="5000">
          <span class="hint">Nhap 0 de quet toan bo mailbox.</span>
        </label>
        <label class="full">Payment keywords
          <textarea id="paymentKeywords"></textarea>
        </label>
        <label class="full">Ignore keywords
          <textarea id="ignoreKeywords"></textarea>
        </label>
      </div>
      <div class="actions">
        <button id="save" class="primary" type="button">Lưu cấu hình</button>
        <button id="test" type="button">Test connection</button>
        <button id="sync" type="button">Quét ngay</button>
        <button id="health" type="button">Health</button>
      </div>
      <div id="status" class="status">Sẵn sàng.</div>
    </section>

    <section class="panel">
      <h2>PayPal CSV fallback</h2>
      <p class="hint">Nếu PayPal API hoặc mail host chưa kết nối được, export transaction CSV từ PayPal rồi import tại đây. RevenueFlow sẽ đưa payment vào danh sách review qua endpoint /latest.</p>
      <input id="csvFile" type="file" accept=".csv,text/csv">
      <div class="actions">
        <button id="importCsv" type="button">Import PayPal CSV</button>
      </div>
    </section>
  </main>
  <script>
    const $ = (id) => document.getElementById(id);
    const statusBox = $("status");
    function setStatus(text, ok) {
      statusBox.textContent = text;
      statusBox.className = "status " + (ok === true ? "ok" : ok === false ? "warn" : "");
    }
    async function api(path, options) {
      const response = await fetch(path, options);
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { ok: false, error: text }; }
      if (!response.ok || data.ok === false) throw new Error(data.error || response.statusText);
      return data;
    }
    function collect() {
      return {
        sourceMode: $("sourceMode").value,
        maxMessages: $("maxMessages").value,
        paymentKeywords: $("paymentKeywords").value,
        ignoreKeywords: $("ignoreKeywords").value,
        imap: {
          host: $("imapHost").value,
          port: $("imapPort").value,
          secure: $("imapSecure").value === "true",
          user: $("imapUser").value,
          password: $("imapPassword").value,
          mailbox: $("imapMailbox").value
        },
        paypal: {
          env: $("paypalEnv").value,
          clientId: $("paypalClientId").value,
          clientSecret: $("paypalClientSecret").value,
          lookbackDays: $("paypalLookbackDays").value
        },
        roundcube: {
          url: $("roundcubeUrl").value,
          user: $("roundcubeUser").value,
          password: $("roundcubePassword").value,
          mailbox: $("roundcubeMailbox").value
        }
      };
    }
    function modeLabel(value) {
      if (value === "paypal") return "PayPal API";
      if (value === "roundcube") return "Roundcube Webmail";
      return "Mail host / IMAP";
    }
    function fill(config) {
      $("sourceMode").value = config.sourceMode || "paypal";
      $("modeBadge").textContent = modeLabel($("sourceMode").value);
      $("maxMessages").value = config.maxMessages ?? 0;
      $("paymentKeywords").value = config.paymentKeywords || "";
      $("ignoreKeywords").value = config.ignoreKeywords || "";
      $("imapHost").value = config.imap?.host || "";
      $("imapPort").value = config.imap?.port || 993;
      $("imapSecure").value = String(config.imap?.secure !== false);
      $("imapUser").value = config.imap?.user || "";
      $("imapMailbox").value = config.imap?.mailbox || "INBOX";
      $("paypalEnv").value = config.paypal?.env || "live";
      $("paypalClientId").value = config.paypal?.clientId || "";
      $("paypalLookbackDays").value = config.paypal?.lookbackDays || 7;
      $("roundcubeUrl").value = config.roundcube?.url || "https://cmsmart.net/webmail/";
      $("roundcubeUser").value = config.roundcube?.user || "";
      $("roundcubeMailbox").value = config.roundcube?.mailbox || "INBOX";
      $("roundcubePassword").placeholder = config.roundcube?.passwordConfigured ? "Da luu password. De trong de giu nguyen." : "Chua co password";
      $("imapPassword").placeholder = config.imap?.passwordConfigured ? "Đã lưu password. Để trống để giữ nguyên." : "Chưa có password";
      $("paypalClientSecret").placeholder = config.paypal?.clientSecretConfigured ? "Đã lưu secret. Để trống để giữ nguyên." : "Chưa có secret";
    }
    async function load() {
      const data = await api("/config");
      fill(data.config);
      setStatus("Đã tải cấu hình local.", true);
    }
    $("sourceMode").addEventListener("change", () => {
      $("modeBadge").textContent = modeLabel($("sourceMode").value);
    });
    $("save").addEventListener("click", async () => {
      setStatus("Đang lưu cấu hình...");
      const data = await api("/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(collect())
      });
      fill(data.config);
      $("imapPassword").value = "";
      $("paypalClientSecret").value = "";
      $("roundcubePassword").value = "";
      setStatus("Đã lưu. Có thể bấm Test connection hoặc Quét ngay.", true);
    });
    $("test").addEventListener("click", async () => {
      setStatus("Đang test connection...");
      const data = await api("/diagnostics");
      setStatus(JSON.stringify(data, null, 2), data.diagnostics?.ok === true || data.roundcube?.ok === true || data.paypal?.configured === true);
    });
    $("sync").addEventListener("click", async () => {
      setStatus("Đang quét nguồn payment...");
      const data = await api("/sync", { method: "POST" });
      setStatus(JSON.stringify(data.summary || data, null, 2), true);
    });
    $("health").addEventListener("click", async () => {
      const data = await api("/health");
      setStatus(JSON.stringify(data, null, 2), true);
    });
    $("importCsv").addEventListener("click", async () => {
      const file = $("csvFile").files && $("csvFile").files[0];
      if (!file) {
        setStatus("Chọn file PayPal CSV trước.", false);
        return;
      }
      setStatus("Đang import PayPal CSV...");
      const csvText = await file.text();
      const data = await api("/import-csv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csvText })
      });
      setStatus("Đã import CSV. Payment matched: " + (data.summary?.matchedCount || 0) + "\\n" + JSON.stringify(data.summary || data, null, 2), true);
    });
    load().catch((error) => setStatus(error.message || String(error), false));
  </script>
</body>
</html>`;
}

module.exports = { setupPage };
