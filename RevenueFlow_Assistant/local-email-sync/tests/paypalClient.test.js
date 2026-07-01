const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeTransaction } = require("../src/paypalClient");

test("normalizes PayPal transaction search detail", () => {
  const record = normalizeTransaction({
    transaction_info: {
      transaction_id: "03A84379GE3808324",
      transaction_status: "S",
      transaction_subject: "Subscription payment",
      transaction_initiation_date: "2026-07-01T01:02:03Z",
      transaction_amount: { currency_code: "USD", value: "29.00" },
      fee_amount: { currency_code: "USD", value: "-1.20" },
      invoice_id: "INV-1001"
    },
    payer_info: {
      email_address: "buyer@example.com",
      payer_name: { given_name: "Sample", surname: "Buyer" }
    },
    cart_info: {
      item_details: [{ item_name: "Monthly service" }]
    }
  });
  assert.equal(record.provider, "PayPal");
  assert.equal(record.transactionId, "03A84379GE3808324");
  assert.equal(record.customerName, "Sample Buyer");
  assert.equal(record.customerEmail, "buyer@example.com");
  assert.equal(record.usd, "29.00");
  assert.equal(record.orderNo, "INV-1001");
  assert.equal(record.product, "Monthly service");
  assert.equal(record.shouldWriteToRevenueSheet, true);
});
