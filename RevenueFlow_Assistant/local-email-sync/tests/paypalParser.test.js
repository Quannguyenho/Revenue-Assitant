const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePaymentEmail } = require("../src/paypalParser");

test("parses PayPal subscription payment", () => {
  const record = parsePaymentEmail(`Subject: You received a payment
From: service@paypal.com

You received a payment from Lawrence Barrit for Order number: fc27798340
Customer name
Lawrence Barrit
Customer email
labarrit@gmail.com
Profile ID
I-CB80G6U8H8T
Amount received
$299.00 USD
For
Order number: fc27798340`);
  assert.equal(record.provider, "PayPal");
  assert.equal(record.amountUsd, "299.00");
  assert.equal(record.customerEmail, "labarrit@gmail.com");
  assert.equal(record.orderNo, "fc27798340");
});
