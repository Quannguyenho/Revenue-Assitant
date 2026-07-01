function normalize(text) {
  return String(text || "").replace(/\r/g, "\n").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
}

function find(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return "";
}

function header(raw, name) {
  const match = String(raw || "").match(new RegExp(`^${name}:\\s*([^\\n]+(?:\\n[\\t ][^\\n]+)*)`, "im"));
  return match ? match[1].replace(/\n[\t ]+/g, " ").trim() : "";
}

function firstCustomerEmail(text) {
  const explicit = find(text, [/Customer email\s*[:\n]?\s*([^\s<>"']+@[^\s<>"']+)/i]);
  if (explicit) return explicit;
  const matches = String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return matches.find((email) => !/@(?:intl\.)?paypal\.com$/i.test(email) && !/^service@/i.test(email)) || "";
}

function cleanProduct(value) {
  const product = String(value || "").trim().replace(/^["'<\s]+|[>"'\s]+$/g, "");
  if (!product) return "";
  if (/@(?:intl\.)?paypal\.com/i.test(product) || /^service@/i.test(product)) return "";
  if (/^(from|to|reply-to|return-path)\b/i.test(product)) return "";
  return product;
}

function dateVN(text) {
  const direct = String(text || "").match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (direct) return `${String(direct[1]).padStart(2, "0")}/${String(direct[2]).padStart(2, "0")}/${direct[3]}`;
  const m = String(text || "").match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/i);
  if (!m) return new Date().toLocaleDateString("vi-VN");
  const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  return `${String(m[2]).padStart(2, "0")}/${months[m[1].slice(0, 3).toLowerCase()] || "01"}/${m[3]}`;
}

function paymentType(text) {
  if (/refund|refunded/i.test(text)) return "Refund";
  if (/dispute|chargeback/i.test(text)) return "Dispute";
  if (/couldn'?t process|could not process|payment failed|payment declined|was unsuccessful|were suspended|automatic payments? from .+ suspended/i.test(text)) return "Payment failed";
  if (/subscription|recurring|profile id|billing agreement|amount paid each time/i.test(text)) return "Recurring / subscription";
  if (/invoice paid|paid your invoice/i.test(text)) return "Invoice paid";
  return "Payment received";
}

function provider(text, from) {
  if (/stripe/i.test(`${from}\n${text}`)) return "Stripe";
  if (/paypal/i.test(`${from}\n${text}`)) return "PayPal";
  return "Payment";
}

function isReceivedPayment(text, type) {
  if (!["Payment received", "Recurring / subscription", "Invoice paid"].includes(type)) return false;
  if (/receipt for your payment to|you sent a payment|you paid|payment to\s+[A-Z0-9]/i.test(text)) return false;
  if (/couldn'?t process|could not process|payment failed|payment declined|was unsuccessful|were suspended|automatic payments? from .+ suspended/i.test(text)) return false;
  return /you received a payment|amount received|payment received|paid your invoice|invoice paid|subscription payment received|recurring payment received|transaction id/i.test(text);
}

function parsePaymentEmail(raw) {
  const text = normalize(raw);
  const from = header(raw, "From");
  const subject = header(raw, "Subject");
  const amount = find(text, [
    /Amount received\s*\n?\s*\$?([0-9,]+(?:\.\d{2})?)\s*USD/i,
    /Amount paid each time\s*\n?\s*\$?([0-9,]+(?:\.\d{2})?)\s*USD/i,
    /(?:Total|Amount|Paid)\s*[:\n]\s*\$?([0-9,]+(?:\.\d{2})?)\s*USD/i,
    /\$([0-9,]+(?:\.\d{2})?)\s*USD/i
  ]).replace(/,/g, "");
  const product = cleanProduct(find(text, [
    /(?:^|\n)\s*For\s*[:\n]?\s*(?!Order number\b)([^\n]+)/im,
    /(?:Item|Product|Description|Service)\s*[:\n]?\s*([^\n]+)/i
  ]));
  const transactionId = find(text, [
    /Transaction ID\s*[:\n]?\s*([A-Z0-9-]+)/i,
    /Payment ID\s*[:\n]?\s*([A-Z0-9-]+)/i
  ]);
  const profileId = find(text, [/Profile ID\s*[:\n]?\s*([A-Z0-9-]+)/i]);
  const orderNo = find(text, [
    /Order number\s*[:\n]?\s*([A-Z0-9-]+)/i,
    /Order ID\s*[:\n]?\s*([A-Z0-9-]+)/i
  ]);
  const customerEmail = firstCustomerEmail(text);
  const customerName = find(text, [/Customer name\s*[:\n]?\s*([^\n]+)/i, /payment from\s+(.+?)\s+for\s+/i]);
  const type = paymentType(text);
  const isReceived = isReceivedPayment(text, type);
  const status = isReceived ? "Paid" : /refund/i.test(type) ? "Refund" : /failed/i.test(type) ? "Failed" : /dispute/i.test(type) ? "Dispute" : "Info";
  const payProvider = provider(text, from);
  const reviewReasons = [];
  if (!customerName) reviewReasons.push("Customer missing");
  if (!amount) reviewReasons.push("USD amount missing");
  if (!product) reviewReasons.push("Product missing");
  if (!orderNo && !profileId && !transactionId) reviewReasons.push("Reference missing");
  return {
    source: "localImap",
    provider: payProvider,
    emailType: type,
    type,
    status,
    revenueImpact: isReceived ? "positive" : "none",
    shouldWriteToRevenueSheet: isReceived,
    date: dateVN(text),
    customerName,
    customerEmail,
    orderNo,
    amountUsd: amount,
    usd: amount,
    transactionId,
    profileId,
    product,
    currency: "USD",
    rawSubject: subject,
    rawFrom: from,
    rawText: text,
    needReview: reviewReasons.length > 0,
    reviewReasons
  };
}

module.exports = { parsePaymentEmail };
