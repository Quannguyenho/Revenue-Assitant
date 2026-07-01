const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePayPalCsv, safeCell } = require("../src/csvImport");

test("sanitizes spreadsheet formula-looking cells", () => {
  assert.equal(safeCell("=IMPORTXML('https://example.com')"), "'=IMPORTXML('https://example.com')");
  assert.equal(safeCell("+SUM(1,2)"), "'+SUM(1,2)");
  assert.equal(safeCell("normal"), "normal");
});

test("imports PayPal CSV rows into normalized cloud records", () => {
  const records = parsePayPalCsv(`Date,Name,Type,Status,Currency,Gross,Fee,Net,From Email Address,Transaction ID,Item Title,Invoice Number
"07/01/2026","Sample Buyer","Payment Received","Completed","USD","29.00","-1.20","27.80","buyer@example.com","TXN-1001","Monthly service","INV-1001"`);
  assert.equal(records.length, 1);
  assert.equal(records[0].source, "paypal-csv-cloud");
  assert.equal(records[0].transactionId, "TXN-1001");
  assert.equal(records[0].customerEmail, "buyer@example.com");
  assert.equal(records[0].usd, "29.00");
  assert.equal(records[0].orderNo, "INV-1001");
  assert.equal(records[0].shouldWriteToRevenueSheet, true);
});
