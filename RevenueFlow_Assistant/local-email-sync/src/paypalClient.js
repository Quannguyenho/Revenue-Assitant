function paypalBaseUrl(env) {
  return String(env || "live").toLowerCase() === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

function requirePayPalConfig(config) {
  if (!config.paypal.clientId || !config.paypal.clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing. Open Local Sync Setup and save PayPal API credentials.");
  }
}

async function paypalAccessToken(config) {
  requirePayPalConfig(config);
  const credentials = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString("base64");
  const response = await fetch(`${paypalBaseUrl(config.paypal.env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `PayPal token request failed with HTTP ${response.status}.`);
  }
  return data.access_token;
}

async function diagnosePayPal(config) {
  const result = {
    env: config.paypal.env,
    configured: Boolean(config.paypal.clientId && config.paypal.clientSecret),
    checks: []
  };
  const mark = (name, ok, detail = "") => {
    result.checks.push({ name, ok: Boolean(ok), detail });
  };
  if (!result.configured) {
    mark("config", false, "PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing.");
    result.ok = false;
    return result;
  }
  mark("config", true, "PayPal credentials are present.");
  try {
    await paypalAccessToken(config);
    mark("auth", true, "PayPal token request accepted.");
    result.ok = true;
    return result;
  } catch (error) {
    mark("auth", false, error && error.message ? error.message : String(error || "PayPal authentication failed."));
    result.ok = false;
    return result;
  }
}

function isoWindow(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    endDate: end.toISOString().replace(/\.\d{3}Z$/, "Z")
  };
}

function payerName(payer = {}) {
  const name = payer.payer_name || {};
  return name.alternate_full_name || [name.given_name, name.surname].filter(Boolean).join(" ").trim();
}

function firstItemName(cart = {}) {
  const items = Array.isArray(cart.item_details) ? cart.item_details : [];
  const item = items.find((entry) => entry && (entry.item_name || entry.item_description));
  return item ? (item.item_name || item.item_description || "") : "";
}

function normalizeTransaction(detail) {
  const info = detail.transaction_info || {};
  const payer = detail.payer_info || {};
  const cart = detail.cart_info || {};
  const amount = info.transaction_amount || {};
  const rawValue = Number(amount.value || 0);
  const isRefund = rawValue < 0 || info.transaction_status === "V";
  const isSuccess = info.transaction_status === "S" && rawValue !== 0;
  const product = firstItemName(cart) || info.transaction_subject || "";
  const reference = info.invoice_id || info.custom_field || info.transaction_id || "";
  return {
    provider: "PayPal",
    source: "paypal-api",
    sourceMessageId: info.transaction_id || "",
    transactionId: info.transaction_id || "",
    orderNo: reference,
    date: (info.transaction_initiation_date || info.transaction_updated_date || "").slice(0, 10),
    customerName: payerName(payer),
    customerEmail: payer.email_address || "",
    amountUsd: amount.value || "",
    usd: amount.currency_code === "USD" ? (amount.value || "") : "",
    currency: amount.currency_code || "",
    product,
    emailType: isRefund ? "refund" : (isSuccess ? "successful_payment" : "unknown"),
    type: isRefund ? "refund" : (isSuccess ? "successful_payment" : "unknown"),
    status: isRefund ? "Refund" : (isSuccess ? "Paid" : (info.transaction_status || "Info")),
    revenueImpact: isRefund ? "negative" : (isSuccess ? "positive" : "none"),
    shouldWriteToRevenueSheet: Boolean(isSuccess || isRefund),
    note: info.transaction_subject || "PayPal API",
    customFields: [
      { name: "PayPal event code", value: info.transaction_event_code || "" },
      { name: "PayPal status", value: info.transaction_status || "" },
      { name: "PayPal fee", value: info.fee_amount ? `${info.fee_amount.value || ""} ${info.fee_amount.currency_code || ""}`.trim() : "" }
    ].filter((field) => field.value),
    needReview: !reference || !amount.value || !product
  };
}

async function fetchPayPalTransactions(config) {
  const token = await paypalAccessToken(config);
  const { startDate, endDate } = isoWindow(config.paypal.lookbackDays);
  const records = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      fields: "all",
      page_size: "100",
      page: String(page)
    });
    const response = await fetch(`${paypalBaseUrl(config.paypal.env)}/v1/reporting/transactions?${params}`, {
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error_description || data.name || `PayPal transactions request failed with HTTP ${response.status}.`);
    }
    const details = Array.isArray(data.transaction_details) ? data.transaction_details : [];
    records.push(...details.map(normalizeTransaction));
    totalPages = Number(data.total_pages || 1);
    page += 1;
  } while (page <= totalPages && page <= 10);
  return { records, startDate, endDate };
}

module.exports = { fetchPayPalTransactions, normalizeTransaction, diagnosePayPal };
