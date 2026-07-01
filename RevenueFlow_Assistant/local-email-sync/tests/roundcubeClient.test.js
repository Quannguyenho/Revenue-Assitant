const test = require("node:test");
const assert = require("node:assert/strict");
const { parseMessageRows, normalizeEmailSource } = require("../src/roundcubeClient");

test("parses Roundcube message rows from ajax exec script", () => {
  const rows = parseMessageRows('this.add_message_row(24964,{"subject":"You received a payment","fromto":"<span title=\\"service@intl.paypal.com\\">PayPal</span>","date":"Today","size":"37 KB"},{"seen":1,"ctype":"text/html","mbox":"INBOX"},false);');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].uid, "24964");
  assert.equal(rows[0].columns.subject, "You received a payment");
  assert.equal(rows[0].flags.mbox, "INBOX");
});

test("normalizes quoted printable html email source", () => {
  const normalized = normalizeEmailSource(`Subject: You received a payment
From: service@intl.paypal.com
Content-Transfer-Encoding: quoted-printable
Content-Type: text/html

<html><body>Amount received<br>$29.00 USD<br>Customer email<br>buyer=40example.com<br>Transaction ID<br>TXN-1001</body></html>`);
  assert.match(normalized, /Subject: You received a payment/);
  assert.match(normalized, /buyer@example\.com/);
  assert.match(normalized, /\$29\.00 USD/);
});
