# RevenueFlow Assistant - Global Development Notes

This file records product and implementation decisions for the global Chrome extension build.

## Build Identity

- Global source folder: `D:\Q project\RevenueFlow_Assistant_v2_3_0_Best_UX`
- Global package: `D:\Q project\RevenueFlow_Assistant_Latest.zip`
- Current global release: `v6.9.0`
- Netbase accounting-specific work belongs only in `D:\Q project\RevenueFlow_Assistant_Netbase_Local`.

## Product Direction

- Target user: non-technical business owner or accountant.
- Main promise: scan authorized Gmail payment emails, let the user review records, then save approved revenue rows to Google Sheets.
- Keep the extension global: no hard-coded customer mailbox, private Sheet layout, internal product names, or company-only workflow.
- Default flow should be short: connect Gmail, scan payments, review one record, save to Sheet.
- Advanced setup should stay behind Settings or collapsed sections.

## Security And Privacy

- Never ask for or store Gmail passwords.
- Gmail access must use Google OAuth and `gmail.readonly`.
- Sheet writing must use Google OAuth and `spreadsheets`.
- The global extension must not ship with local connector services, localhost host permissions, API secrets, raw mailbox output, or customer payment data.
- The extension should only write after user review unless the user explicitly enables automation.
- Do not mark a record as saved unless the Google Sheets write is verified.
- Do not issue, sign, send, or submit invoices automatically.

## Google Sheet Rules

- Customers should be able to use an auto-created default Sheet or paste their own Sheet link.
- New global installs default to Sheet `Payments`, start cell `A2`, and columns `A:J`.
- If a Sheet is blocked, show a customer-friendly fix: connect the Google account that owns the Sheet or share the Sheet with the connected account as Editor.
- Keep the Sheet row format stable unless a version note explains the change.
- Always show a human-readable preview before saving so users can verify which value goes into which Sheet column.
- Bulk save must skip duplicates, records needing review, non-revenue records, and records already verified as saved.

## Payment Parsing Direction

- Supported global source: Gmail API through user OAuth.
- Default providers: PayPal, Stripe, Paddle, WooCommerce, Shopify, bank transfer, and generic payment emails.
- Let users add custom providers without editing code.
- Product/service should prefer explicit email text such as `For`, `Item`, `Product`, or `Description`; fallback to amount-based rules.
- Product aliases should run before amount fallback so users can map noisy email product text to their own accounting-friendly names.
- New installs should not ship with customer-visible product samples.
- Manual edits in the review form must always take priority over product aliases.
- Missing order/reference should require review, but users can still approve and save if the email genuinely has no reference.

## Accounting / Invoice Direction

- MISA should be treated as one accounting export preset, not the whole product.
- Global architecture should support generic invoice/accounting apps through CSV export and custom template mapping.
- Accounting connectors should start as safe destinations: app/import link, CSV/template export, and notes.
- Do not store accounting passwords or API secrets in extension storage.
- RevenueFlow should prepare draft/import data only. It must not issue invoices automatically.
- Future management-app integrations should be treated as verification connectors that enrich customer/order data, not as required dependencies for the Gmail-to-Sheet flow.

## Local Variant Boundary

- Netbase-specific defaults, private accounting Sheet layouts, internal mailbox sync, customer credentials, raw payment output, and team-only workflow notes belong only in `RevenueFlow_Assistant_Netbase_Local`.
- Do not copy Netbase Local defaults into this global folder.
- Do not package local service folders, output/data folders, logs, `.env`, nested ZIPs, `node_modules`, or tests into `RevenueFlow_Assistant_Latest.zip`.

## Release Process

- Edit the canonical global folder in place.
- Update `manifest.json` version and `defaultConfig.configVersion` together.
- Update `CHANGELOG.md` and this file when behavior changes.
- Run:
  - `node --check popup.js`
  - `node --check paymentRules.js`
  - `node --test tests/paymentRules.test.js`
- Package from `D:\Q project\RevenueFlow_Assistant_v2_3_0_Best_UX`.
- For normal customer/test updates, overwrite `D:\Q project\RevenueFlow_Assistant_Latest.zip`.
- Create versioned ZIP archives only when explicitly requested.

## Current Release Note

### v6.9.0

- Global build has been cleaned back to Gmail OAuth + Google Sheets only.
- Local connector permissions and defaults were removed from the global manifest/config.
- New installs use neutral Sheet defaults: `Payments`, `A2`, and standard `A:J` columns.
- Customer-facing text now guides users to connect Gmail instead of internal connector setup.
- Netbase Local remains a separate local-only variant and must not be mixed into this build.
