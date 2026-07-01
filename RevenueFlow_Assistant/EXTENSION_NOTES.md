# RevenueFlow Assistant - Development Notes

This file keeps useful product and implementation decisions in one place so future updates do not lose context.

## Product Direction

- Target user: non-technical business owner or accountant.
- Main promise: scan authorized Gmail payment emails, let the user review records, then save approved revenue rows to Google Sheets.
- Keep the extension global: no hard-coded Netbase-only mailbox, Sheet layout, or MISA-only workflow.
- Default flow should be short: connect Gmail, scan payments, review one record, save to Sheet.
- Advanced setup should stay behind Settings or collapsed sections.

## Security And Privacy

- Never ask for or store Gmail passwords.
- For internal domain mailbox sync, use the local `local-email-sync` service. Keep IMAP credentials in `local-email-sync/.env`, not in Chrome extension storage.
- Gmail access must use Google OAuth and `gmail.readonly`.
- Sheet writing must use Google OAuth and `spreadsheets`.
- The extension should only write after user review unless the user explicitly enables automation.
- Do not mark a record as saved unless the Google Sheets write is verified.
- Do not issue, sign, send, or submit invoices automatically.

## Google Sheet Rules

- Customers should be able to use an auto-created default Sheet or paste their own Sheet link.
- If a Sheet is blocked, show a customer-friendly fix: connect the Google account that owns the Sheet or share the Sheet with the connected account as Editor.
- Keep the Sheet row format stable unless a version note explains the change.
- v5.9 adds a compact Sheet column mapping layer. Defaults must preserve the existing B-K write layout; custom mappings should only change where values land, not request new permissions.
- Always show a human-readable preview before saving so users can verify which value goes into which Sheet column.
- v6.3 lets users click the column badge in the preview to change the target Sheet column directly. Keep this shortcut visible because it removes a trip into Settings.
- v6.0 adds a verified save receipt. Only show it after `verifySheetWrite` succeeds, because customers must never see "saved" for an unverified write.
- Bulk save must skip duplicates, records needing review, non-revenue records, and records already verified as saved.

## Payment Parsing Direction

- Internal business mode can scan domain mailbox via `http://127.0.0.1:8787` using `local-email-sync`.
- Local IMAP sync must use read-only behavior: `EXAMINE` mailbox and `BODY.PEEK[]`; do not delete, move, or mark messages read.
- Default providers: PayPal, Stripe, Paddle, WooCommerce, Shopify, bank transfer, and generic payment emails.
- Let users add custom providers without editing code.
- Product/service should prefer explicit email text such as `For`, `Item`, `Product`, or `Description`; fallback to amount-based rules.
- Product aliases should run before amount fallback so users can map noisy email product text to their own accounting-friendly names.
- New installs should not ship with customer-visible product samples. Product rules and aliases start blank; users can add their own or apply a generic preset.
- Manual edits in the review form must always take priority over product aliases.
- Missing order/reference should not block users forever. It should require review, but users can still approve and save if the email genuinely has no reference.

## Accounting / Invoice Direction

- MISA should be treated as one accounting export preset, not the whole product.
- Global architecture should support generic invoice/accounting apps through CSV export and custom template mapping.
- Accounting connectors should start as safe destinations: app/import link, CSV/template export, and notes. Do not store accounting passwords or API secrets in extension storage.
- RevenueFlow should prepare draft/import data only. It must not issue invoices automatically.
- Future Cmsmart or management-app integrations should be treated as verification connectors that enrich customer/order data, not as required dependencies for the Gmail-to-Sheet flow.
- Future useful features: template import from a sample invoice/CSV, field mapping assistant, and per-app presets.

## Release Process

- Canonical edit folder is always `D:\Q project\RevenueFlow_Assistant_v2_3_0_Best_UX`.
- Edit the canonical folder in place. Do not create a new extension folder for each version.
- Use version numbers and the in-app version badge to distinguish updates.
- Update `manifest.json` version and `defaultConfig.configVersion` together.
- Update `CHANGELOG.md`.
- Run syntax checks for `popup.js` and `paymentRules.js`.
- Run payment rule tests.
- Package from `D:\Q project\RevenueFlow_Assistant_v2_3_0_Best_UX`.
- For normal customer/test updates, overwrite `D:\Q project\RevenueFlow_Assistant_Latest.zip`.
- Create versioned ZIP archives only when explicitly requested.
- Do not rename the local testing folder again unless OAuth is also updated. Chrome can derive a different unpacked Extension ID from a different local path, which breaks Google OAuth for local testing.
- Keep `D:\Q project\RevenueFlow_Assistant_Latest.zip` pointing to the latest production ZIP.

## Current Release Note

### v6.7.0

- Added a Local Sync Roundcube Webmail fallback for cases where the mailbox opens in the browser but IMAP ports are blocked.
- Local Sync can now run with `SOURCE_MODE=roundcube`, `ROUNDCUBE_URL`, `ROUNDCUBE_USER`, `ROUNDCUBE_PASSWORD`, and `ROUNDCUBE_MAILBOX`.
- The Roundcube adapter logs in locally, reads message source through Roundcube, parses PayPal emails, and returns the same payment record payload as IMAP/PayPal API.
- Extension Cloud Sync mode now falls back to Local Sync/Webmail automatically when the local Cloud Sync server is not reachable.
- Webmail passwords remain in the local service process/config only; they are not stored in Chrome extension storage or packaged output.

### v6.6.0

- Added internal Cloud Sync mode for the side panel, pointing to `http://127.0.0.1:8790` by default for local beta testing.
- Added Cloud Sync request handling for source checks, PayPal sync, and latest records through `/v1/sources`, `/v1/paypal/sync`, and `/v1/records`.
- Added localhost `8790` host permission for the internal Cloud Sync beta.
- Existing installs are migrated from local IMAP mode to Cloud Sync mode so the user is no longer blocked by the mail host IMAP timeout.
- This is an internal beta bridge only. The test token must be replaced by real RevenueFlow auth before public/global release.

### v6.5.0

- Added a local setup page at `http://127.0.0.1:8787/setup` so internal users can configure PayPal API or mail-host IMAP without editing `.env` by hand.
- Added `GET /config` and `POST /config` to Local Email Sync. Public config responses do not include passwords or API secrets.
- Added source/status aliases including `/sources`, `/source-mode`, and `/paypal/*` endpoints so future UI can target PayPal without depending on manual source-mode edits.
- Added a PayPal CSV fallback import through Local Sync for cases where both live API/IMAP paths are blocked or not ready.
- Added extension buttons to open Local Sync Setup directly from the side panel.
- Updated local-mode error copy to point users to setup and provider fallback paths instead of technical `.env` edits.

### v6.4.3

- Added a PayPal API fallback source in `local-email-sync` for internal use when IMAP/mail host access is blocked.
- Set `SOURCE_MODE=paypal` plus PayPal REST app credentials in `.env` to pull PayPal transaction data directly.
- PayPal secrets must stay local in `.env`; never put them in Chrome extension storage or packaged output.
- IMAP remains available as a mail-host source, but PayPal API is the recommended fallback for transaction/payment data.

### v6.4.2

- Internal local build keeps `local-email-sync` as the primary mail source for team mail host/invoicing mailboxes.
- Added `/diagnostics` to Local Email Sync so support can distinguish config, connection, login, and mailbox readability issues.
- Local-mode UI describes the source as the internal mail host rather than Gmail OAuth.
- Do not read or package `local-email-sync/.env`; it remains local credential storage only.

### v6.4.1

- Local Email Sync now masks IMAP login commands in errors and keeps the server alive when the IMAP socket fails.
- If `/sync` returns `IMAP_CONNECTION_FAILED`, the extension code is reaching the local service correctly, but the machine cannot reach the configured IMAP host/port.
- For the current cmsmart domain test, DNS points `cmsmart.net` MX to `mail.cmsmart.net` at `109.199.120.179`; all tested mail ports timed out or returned `EACCES` from this machine, so the mail server/firewall/admin must allow IMAP access before scanning can work.

### v6.2.0

- Customer-visible defaults are global: no internal product names, mailbox, or company-only Sheet assumptions.
- Product rules and product aliases start blank. The recurring-fee preset is generic and user-controlled.
- Accounting destinations now include CSV/manual import, MISA, QuickBooks, Xero, and generic apps as safe export targets.
