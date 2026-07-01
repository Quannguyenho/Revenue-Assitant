(function initRevenueFlowRules(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RevenueFlowRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRevenueFlowRules() {
  "use strict";

  const TYPE_META = {
    successful_payment: ["Paid", "positive", true],
    recurring_payment_success: ["Paid", "positive", true],
    invoice_paid: ["Paid", "positive", true],
    payment_failed: ["Failed", "none", false],
    recurring_payment_failed: ["Failed", "none", false],
    payment_pending: ["Pending", "none", false],
    refund: ["Refund", "negative", true],
    dispute: ["Dispute", "risk_negative", false],
    chargeback: ["Chargeback", "risk_negative", false],
    subscription_created: ["Info", "none", false],
    subscription_cancelled: ["Info", "none", false],
    subscription_updated: ["Info", "none", false],
    trial_started: ["Info", "none", false],
    trial_ending: ["Info", "none", false],
    payout: ["Info", "none", false],
    fee: ["Info", "none", false],
    account_notice: ["Info", "none", false],
    unknown: ["Info", "none", false]
  };

  const TYPE_RULES = [
    ["recurring_payment_failed", ["couldn't process your recurring payment", "could not process your recurring payment", "recurring payment failed", "retry again", "will try again"]],
    ["payment_failed", ["invoice payment failed", "payment failed", "charge failed", "payment was unsuccessful", "payment declined"]],
    ["chargeback", ["chargeback"]],
    ["dispute", ["dispute created", "case opened", "dispute"]],
    ["refund", ["refund sent", "you sent a refund", "refund created", "payment refunded", "refunded"]],
    ["subscription_cancelled", ["billing agreement cancelled", "billing agreement canceled", "subscription cancelled", "subscription canceled", "profile cancelled", "profile canceled"]],
    ["trial_ending", ["trial ending", "trial ends"]],
    ["trial_started", ["trial started"]],
    ["subscription_created", ["subscription created", "billing agreement created"]],
    ["subscription_updated", ["subscription updated", "subscription changed"]],
    ["payment_pending", ["payment pending", "payment is pending"]],
    ["payout", ["payout paid", "payout"]],
    ["fee", ["processing fee", "service fee"]],
    ["recurring_payment_success", ["subscription payment received", "recurring payment received", "subscription payment succeeded", "recurring payment succeeded", "subscription details", "amount paid each time", "maximum amount you can bill", "next payment due", "profile status"]],
    ["invoice_paid", ["invoice paid", "paid your invoice"]],
    ["successful_payment", ["you received a payment", "payment received", "you received money", "payment succeeded", "charge succeeded", "successful payment"]]
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function baseRule(id, name, domains, keywords) {
    return {
      id,
      name,
      enabled: true,
      senderDomains: domains,
      searchKeywords: keywords,
      ignoreKeywords: [],
      emailTypeRules: [],
      extractionRules: {},
      defaultSheetBehavior: "revenue_only"
    };
  }

  function getDefaultGatewayRules() {
    return clone([
      baseRule("paypal", "PayPal", ["paypal.com", "intl.paypal.com"], ["payment received", "you received a payment", "subscription payment", "subscription details", "amount paid each time", "profile id", "next payment due", "payment failed", "refund", "dispute", "chargeback", "payout"]),
      baseRule("stripe", "Stripe", ["stripe.com"], ["payment succeeded", "invoice paid", "payment failed", "refund", "dispute", "subscription", "trial ending", "payout paid"]),
      baseRule("woocommerce", "WooCommerce", ["woocommerce.com"], ["new order", "order paid", "payment complete", "order refunded"]),
      baseRule("2checkout", "2Checkout / Verifone", ["2checkout.com", "verifone.com"], ["payment received", "order payment", "refund", "subscription"]),
      baseRule("paddle", "Paddle", ["paddle.com"], ["payment received", "subscription payment", "refund", "payment failed"]),
      baseRule("payoneer", "Payoneer", ["payoneer.com"], ["payment received", "payment pending", "payment failed"]),
      baseRule("wise", "Wise", ["wise.com", "transferwise.com"], ["you received", "transfer complete", "transfer pending", "transfer failed"]),
      baseRule("bank_transfer", "Bank Transfer", [], ["bank transfer received", "credit notification", "incoming transfer"]),
      { ...baseRule("custom", "Custom", [], []), enabled: false }
    ]);
  }

  function cleanList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
    return String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  }

  function normalizeRule(rule, index) {
    const id = String(rule && (rule.id || rule.name) || `custom_${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
    return {
      id: id || `custom_${index + 1}`,
      name: String(rule && (rule.name || rule.displayName) || id || "Custom").trim(),
      enabled: rule && rule.enabled !== false,
      senderDomains: cleanList(rule && (rule.senderDomains || rule.domains)),
      searchKeywords: cleanList(rule && (rule.searchKeywords || rule.keywords)),
      ignoreKeywords: cleanList(rule && rule.ignoreKeywords),
      emailTypeRules: Array.isArray(rule && rule.emailTypeRules) ? rule.emailTypeRules.map((item) => ({
        emailType: TYPE_META[item.emailType] ? item.emailType : "unknown",
        keywords: cleanList(item.keywords),
        shouldWriteToRevenueSheet: typeof item.shouldWriteToRevenueSheet === "boolean" ? item.shouldWriteToRevenueSheet : undefined,
        revenueImpact: item.revenueImpact || undefined
      })) : [],
      extractionRules: rule && typeof rule.extractionRules === "object" && rule.extractionRules ? { ...rule.extractionRules } : {},
      defaultSheetBehavior: String(rule && rule.defaultSheetBehavior || "revenue_only")
    };
  }

  function parseGatewayRules(input, fallback) {
    try {
      const parsed = typeof input === "string" ? JSON.parse(input) : input;
      if (!Array.isArray(parsed)) throw new Error("Gateway rules must be a JSON array.");
      return { rules: parsed.map(normalizeRule), warnings: [] };
    } catch (error) {
      return { rules: clone(fallback || getDefaultGatewayRules()), warnings: [error.message || String(error)] };
    }
  }

  function safeRegex(pattern, flags = "i") {
    if (!pattern) return null;
    try {
      return new RegExp(pattern, flags);
    } catch (error) {
      return { error: error.message || String(error), pattern };
    }
  }

  function regexValue(text, pattern) {
    const regex = safeRegex(pattern, "im");
    if (!regex || regex.error) return { value: "", warning: regex && regex.error ? `Invalid regex ${pattern}: ${regex.error}` : "" };
    const match = String(text || "").match(regex);
    return { value: match && match[1] ? String(match[1]).trim() : "", warning: "" };
  }

  function firstMatch(text, patterns) {
    for (const pattern of patterns) {
      const regex = pattern instanceof RegExp ? pattern : safeRegex(pattern, "im");
      if (!regex || regex.error) continue;
      const match = String(text || "").match(regex);
      if (match && match[1]) return String(match[1]).trim();
    }
    return "";
  }

  function detectGateway(input, rules) {
    const text = `${input && input.from || ""}\n${input && input.subject || ""}\n${input && input.text || ""}`.toLowerCase();
    let keywordFallback = null;
    for (const rule of (rules || getDefaultGatewayRules()).filter((item) => item.enabled !== false)) {
      const domainMatch = rule.senderDomains.some((domain) => text.includes(domain));
      const keywordMatch = rule.searchKeywords.some((keyword) => text.includes(keyword));
      if (domainMatch) return rule;
      if (!keywordFallback && keywordMatch) keywordFallback = rule;
    }
    return keywordFallback;
  }

  function detectEmailType(input, gateway) {
    const haystack = `${input && input.subject || ""}\n${input && input.text || ""}`.toLowerCase();
    if (gateway) {
      for (const rule of gateway.emailTypeRules || []) {
        if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.emailType;
      }
    }
    for (const [type, keywords] of TYPE_RULES) {
      if (keywords.some((keyword) => haystack.includes(keyword))) return type;
    }
    return gateway && gateway.ignoreKeywords.some((keyword) => haystack.includes(keyword)) ? "account_notice" : "unknown";
  }

  function parseDate(value) {
    const text = String(value || "");
    const direct = text.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
    if (direct) return `${String(direct[1]).padStart(2, "0")}/${String(direct[2]).padStart(2, "0")}/${direct[3]}`;
    const named = text.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/i);
    if (!named) return "";
    const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
    return `${String(named[2]).padStart(2, "0")}/${months[named[1].slice(0, 3).toLowerCase()] || "01"}/${named[3]}`;
  }

  function extractFieldsByRule(input, gateway) {
    const text = String(input && input.text || "").replace(/\r/g, "\n");
    const custom = gateway && gateway.extractionRules || {};
    const warnings = [];
    function customOr(key, patterns) {
      if (custom[key]) {
        const result = regexValue(text, custom[key]);
        if (result.warning) warnings.push(result.warning);
        if (result.value) return result.value;
      }
      return firstMatch(text, patterns);
    }
    const amount = customOr("amount", [
      /(?:amount received|amount paid|payment amount|total|amount)\s*[:\n]?\s*[$€£]?\s*([0-9][0-9,.]*)\s*(?:USD|EUR|GBP)?/i,
      /(?:sent you|received)\s*[$€£]\s*([0-9][0-9,.]*)/i
    ]).replace(/,/g, "");
    const currency = customOr("currency", [/\b(USD|EUR|GBP|AUD|CAD|VND)\b/i]) || "USD";
    return {
      customerName: customOr("customerName", [/Customer name\s*[:\n]?\s*([^\n]+)/i, /You received (?:a payment|money) from\s+([^\n]+?)(?:\s+for|\s+of|$)/i, /Payment from\s+([^\n]+)/i]),
      customerEmail: customOr("customerEmail", [/(?:Customer|Buyer|Payer|Receipt) email\s*[:\n]?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i]),
      orderNo: customOr("orderNo", [/(?:Order|Invoice|Receipt) (?:number|ID)?\s*:?\s*([A-Z0-9_-]+)/i, /For\s+Order number\s*:?\s*([A-Z0-9_-]+)/i]),
      transactionId: customOr("transactionId", [/Transaction ID\s*:?\s*([A-Z0-9_-]+)/i, /\b((?:pi|ch|py|in|cs)_[A-Z0-9_]+)\b/i]),
      profileId: customOr("profileId", [/(?:Profile ID|Recurring Payment ID|Billing Agreement ID)\s*:?\s*([A-Z0-9_-]+)/i]),
      subscriptionId: customOr("subscriptionId", [/(?:Subscription ID|Plan ID)\s*:?\s*([A-Z0-9_-]+)/i]),
      date: parseDate(customOr("date", [/(?:Date|Sent)\s*:?\s*([^\n]+)/i]) || input.date || text),
      nextPaymentDate: parseDate(customOr("nextPaymentDate", [/(?:Next payment due|Next payment date|Will retry on|Date due)\s*:?\s*([^\n]+)/i, /Next payment\s*:?\s*([^\n]+)/i])),
      amount,
      currency,
      product: customOr("product", [/(?:^|\n)\s*For\s*[:\n]?\s*(?!Order number\b)([^\n]+)/im, /(?:Item|Product|Description|Service)\s*:?\s*([^\n]+)/i]),
      warnings
    };
  }

  function normalizePaymentRecord(record) {
    const emailType = TYPE_META[record.emailType] ? record.emailType : "unknown";
    const meta = TYPE_META[emailType];
    const customTypeRule = record.gateway && (record.gateway.emailTypeRules || []).find((item) => item.emailType === emailType);
    let amount = String(record.amount || "").replace(/,/g, "");
    if (emailType === "refund" && Number(amount) > 0) amount = String(-Math.abs(Number(amount)));
    const shouldWrite = typeof customTypeRule?.shouldWriteToRevenueSheet === "boolean" ? customTypeRule.shouldWriteToRevenueSheet : meta[2];
    return {
      provider: record.provider || "Unknown",
      emailType,
      status: meta[0],
      revenueImpact: customTypeRule && customTypeRule.revenueImpact || meta[1],
      shouldWriteToRevenueSheet: Boolean(shouldWrite),
      customerName: record.customerName || "",
      customerEmail: record.customerEmail || "",
      orderNo: record.orderNo || "",
      transactionId: record.transactionId || "",
      profileId: record.profileId || "",
      subscriptionId: record.subscriptionId || "",
      amount,
      usd: record.currency === "USD" || !record.currency ? amount : "",
      currency: record.currency || "USD",
      product: record.product || "",
      date: record.date || "",
      nextPaymentDate: record.nextPaymentDate || "",
      rawSubject: record.rawSubject || "",
      sourceMessageId: record.sourceMessageId || "",
      confidence: record.confidence || {},
      parseWarnings: record.parseWarnings || []
    };
  }

  function isRevenueWritable(record, options) {
    const automatic = Boolean(options && options.automatic);
    const allowedType = record && ["successful_payment", "recurring_payment_success", "invoice_paid", "refund"].includes(record.emailType);
    if (automatic && !allowedType) return false;
    if (!record || record.shouldWriteToRevenueSheet !== true) return false;
    if (!record.amount && !record.usd) return false;
    if (!record.customerEmail && !record.customerName) return false;
    return record.status === "Paid" || record.status === "Refund" || (!automatic && record.manualRevenueOverride === true);
  }

  function parsePaymentEmail(text, metadata, rules) {
    const input = { text: String(text || ""), subject: metadata && metadata.subject || "", from: metadata && metadata.from || "", date: metadata && metadata.date || "" };
    const gateway = detectGateway(input, rules || getDefaultGatewayRules());
    const emailType = detectEmailType(input, gateway);
    const extracted = extractFieldsByRule(input, gateway);
    const record = normalizePaymentRecord({
      ...extracted,
      gateway,
      provider: gateway ? gateway.name : "Unknown",
      emailType,
      rawSubject: input.subject,
      sourceMessageId: metadata && (metadata.sourceMessageId || metadata.messageId) || "",
      parseWarnings: extracted.warnings,
      confidence: {
        gateway: { ok: Boolean(gateway), source: gateway ? "gateway rule" : "" },
        emailType: { ok: emailType !== "unknown", source: emailType !== "unknown" ? "email type rule" : "" },
        amount: { ok: Boolean(extracted.amount), source: extracted.amount ? "amount rule" : "" }
      }
    });
    record.writableReason = record.shouldWriteToRevenueSheet
      ? "Successful revenue event. Review the fields before saving."
      : `${record.status} / ${record.emailType} is not revenue by default.`;
    return record;
  }

  function saveGatewayRules(storage, rules) {
    return new Promise((resolve) => storage.set({ gatewayRules: rules }, resolve));
  }

  function testCustomRule(rule, content) {
    const normalized = normalizeRule(rule, 0);
    return parsePaymentEmail(content, { subject: content.split(/\r?\n/)[0] || "" }, [normalized]);
  }

  return {
    TYPE_META,
    getDefaultGatewayRules,
    parseGatewayRules,
    saveGatewayRules,
    detectGateway,
    detectEmailType,
    extractFieldsByRule,
    parsePaymentEmail,
    isRevenueWritable,
    normalizePaymentRecord,
    testCustomRule,
    safeRegex
  };
});
