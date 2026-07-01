const crypto = require("crypto");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const input = String(text || "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  row.push(value);
  rows.push(row);
  return rows.filter((entry) => entry.some((cell) => String(cell || "").trim()));
}

function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function rowObject(headers, row) {
  const output = {};
  headers.forEach((header, index) => {
    output[header] = String(row[index] || "").trim();
  });
  return output;
}

function first(row, names) {
  for (const name of names) {
    if (row[name]) return row[name];
  }
  return "";
}

function amountValue(raw) {
  return String(raw || "").replace(/[$,]/g, "").trim();
}

function safeCell(value) {
  const text = String(value || "").trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function normalizePayPalCsvRow(row, index) {
  const gross = amountValue(first(row, ["gross", "amount", "transaction_amount", "net"]));
  const transactionId = safeCell(first(row, ["transaction_id", "transaction_id_1", "payment_id"]));
  const invoice = safeCell(first(row, ["invoice_number", "invoice_id", "custom_number", "custom"]));
  const item = safeCell(first(row, ["item_title", "item_name", "item_id", "subject"]));
  const statusText = safeCell(first(row, ["status", "transaction_status"]));
  const typeText = safeCell(first(row, ["type", "transaction_type"]));
  const numericAmount = Number(gross || 0);
  const isRefund = numericAmount < 0 || /refund|reversal/i.test(`${typeText} ${statusText}`);
  const isPaid = /complete|completed|success|paid|succeeded/i.test(statusText) || Boolean(gross);
  const currency = safeCell(first(row, ["currency", "currency_code"]) || "USD");
  const date = safeCell(first(row, ["date", "transaction_initiation_date", "time"]));
  const payerEmail = safeCell(first(row, ["from_email_address", "payer_email", "customer_email", "email"]));
  const payerName = safeCell(first(row, ["name", "payer_name", "customer_name"]));
  return {
    provider: "PayPal",
    source: "paypal-csv-cloud",
    sourceMessageId: transactionId || `paypal-csv-${index + 1}`,
    transactionId,
    orderNo: invoice || transactionId,
    date,
    customerName: payerName,
    customerEmail: payerEmail,
    amountUsd: gross,
    usd: /usd/i.test(currency) ? gross : "",
    currency,
    product: item || typeText || "PayPal transaction",
    emailType: isRefund ? "refund" : (isPaid ? "successful_payment" : "unknown"),
    type: isRefund ? "refund" : (isPaid ? "successful_payment" : "unknown"),
    status: isRefund ? "Refund" : (isPaid ? "Paid" : (statusText || "Info")),
    revenueImpact: isRefund ? "negative" : (isPaid ? "positive" : "none"),
    shouldWriteToRevenueSheet: Boolean(isPaid || isRefund),
    note: "PayPal CSV import",
    customFields: [
      { name: "PayPal type", value: typeText },
      { name: "PayPal status", value: statusText },
      { name: "PayPal fee", value: amountValue(first(row, ["fee"])) },
      { name: "PayPal net", value: amountValue(first(row, ["net"])) }
    ].filter((field) => field.value),
    needReview: !gross || !payerEmail || !(invoice || transactionId)
  };
}

function parsePayPalCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1)
    .map((row, index) => normalizePayPalCsvRow(rowObject(headers, row), index))
    .filter((record) => record.transactionId || record.amountUsd || record.customerEmail);
}

function csvImportHash(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex");
}

module.exports = { parseCsv, parsePayPalCsv, safeCell, csvImportHash };
