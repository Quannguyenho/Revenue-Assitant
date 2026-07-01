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

test("does not use PayPal sender address as customer or product", () => {
  const record = parsePaymentEmail(`Subject: Payment notice
From: service@intl.paypal.com

For
service@intl.paypal.com
Amount received
$39.99 USD`);
  assert.equal(record.customerEmail, "");
  assert.equal(record.product, "");
  assert.equal(record.needReview, true);
});

test("marks failed and outgoing PayPal notices as non-revenue", () => {
  const failed = parsePaymentEmail(`Subject: We couldn't process your recurring payment
From: service@intl.paypal.com

We couldn't process your recurring payment.
Amount paid each time
$29.00 USD`);
  assert.equal(failed.status, "Failed");
  assert.equal(failed.shouldWriteToRevenueSheet, false);

  const outgoing = parsePaymentEmail(`Subject: Receipt for Your Payment to CONTABO GmbH
From: service@intl.paypal.com

Receipt for your payment to CONTABO GmbH
$9.99 USD`);
  assert.equal(outgoing.shouldWriteToRevenueSheet, false);
});
