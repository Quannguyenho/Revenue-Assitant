const test = require("node:test");
const assert = require("node:assert/strict");
const rulesApi = require("../paymentRules.js");

const rules = rulesApi.getDefaultGatewayRules();

function parse(subject, body, from) {
  return rulesApi.parsePaymentEmail(body, { subject, from: from || "service@paypal.com", sourceMessageId: "msg-1" }, rules);
}

test("PayPal successful payment is writable revenue", () => {
  const result = parse("You received a payment", "Customer name: Ada Lovelace\nCustomer email: ada@example.com\nAmount received: $149.00 USD\nTransaction ID: TX123");
  assert.equal(result.emailType, "successful_payment");
  assert.equal(result.status, "Paid");
  assert.equal(result.shouldWriteToRevenueSheet, true);
});

test("PayPal recurring payment success is writable", () => {
  const result = parse("Recurring payment received", "Payer email: buyer@example.com\nAmount received: $29.00 USD\nProfile ID: I-ABC123");
  assert.equal(result.emailType, "recurring_payment_success");
  assert.equal(result.shouldWriteToRevenueSheet, true);
});

test("PayPal subscription details detect product and next payment", () => {
  const body = [
    "You received a payment",
    "Customer name: Lawrence Barrit",
    "Customer email: labarrit@gmail.com",
    "Profile ID: I-CB8QJ6U8H8T",
    "Subscription details",
    "Amount received",
    "$299.00 USD",
    "For Order number: fc27798340",
    "Amount paid each time",
    "$348.00 USD",
    "Maximum amount you can bill",
    "$348.00 USD",
    "Next payment due",
    "Jun 05, 2027"
  ].join("\n");
  const result = parse("You received a payment", body);
  assert.equal(result.emailType, "recurring_payment_success");
  assert.equal(result.orderNo, "fc27798340");
  assert.equal(result.nextPaymentDate, "05/06/2027");
  assert.equal(result.shouldWriteToRevenueSheet, true);
});

test("PayPal subscription for-line can become product", () => {
  const result = parse("You received a payment", "Subscription details\nAmount received\n$29.00 USD\nFor Printcart subscription price $29 per month\nNext payment due\nJul 07, 2026");
  assert.equal(result.emailType, "recurring_payment_success");
  assert.equal(result.product, "Printcart subscription price $29 per month");
  assert.equal(result.nextPaymentDate, "07/07/2026");
});

test("PayPal recurring payment failure is never automatic revenue", () => {
  const result = parse("We couldn't process your recurring payment", "Payer email: buyer@example.com\nAmount: $29.00 USD\nProfile ID: I-ABC123\nWe will try again next week");
  assert.equal(result.emailType, "recurring_payment_failed");
  assert.equal(result.status, "Failed");
  assert.equal(result.revenueImpact, "none");
  assert.equal(result.shouldWriteToRevenueSheet, false);
  assert.equal(rulesApi.isRevenueWritable(result, { automatic: true }), false);
});

test("PayPal refund is negative writable revenue", () => {
  const result = parse("Refund sent", "Customer email: buyer@example.com\nAmount: $20.00 USD\nYou sent a refund");
  assert.equal(result.emailType, "refund");
  assert.equal(result.amount, "-20");
  assert.equal(result.shouldWriteToRevenueSheet, true);
});

test("Stripe payment succeeded is writable", () => {
  const result = parse("Payment succeeded", "Customer email: buyer@example.com\nAmount paid: $49.00 USD\nPayment Intent: pi_123", "notifications@stripe.com");
  assert.equal(result.provider, "Stripe");
  assert.equal(result.emailType, "successful_payment");
  assert.equal(result.shouldWriteToRevenueSheet, true);
});

test("Stripe invoice payment failed is not revenue", () => {
  const result = parse("Invoice payment failed", "Customer email: buyer@example.com\nAmount: $49.00 USD", "notifications@stripe.com");
  assert.equal(result.emailType, "payment_failed");
  assert.equal(result.shouldWriteToRevenueSheet, false);
});

test("Stripe refund is negative", () => {
  const result = parse("Refund created", "Receipt email: buyer@example.com\nAmount: $10.00 USD", "notifications@stripe.com");
  assert.equal(result.emailType, "refund");
  assert.equal(result.amount, "-10");
});

test("Unknown email remains visible but is not revenue", () => {
  const result = rulesApi.parsePaymentEmail("General account update", { subject: "Account notice", from: "hello@example.com" }, rules);
  assert.equal(result.emailType, "unknown");
  assert.equal(result.shouldWriteToRevenueSheet, false);
});
