# RevenueFlow Assistant - Global Development Notes

This file records product and implementation decisions for the global Chrome extension build.

## Build Identity

- Global source folder: `D:\Q project\RevenueFlow_Assistant_v2_3_0_Best_UX`
- Global package: `D:\Q project\RevenueFlow_Assistant_Latest.zip`
- Current global release: `v3.3.0`
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
- Live exchange-rate refresh may call `https://open.er-api.com/v6/latest/USD`; no Gmail, Sheet, customer, or payment data is sent to that endpoint.

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

### v3.3.0

- Public publish version set to `3.3.0`.
- Settings now has its own close button, closes on outside click, and also closes with Escape.
- English mode now normalizes legacy Vietnamese adaptive detail labels and recurring-fee product wording in the review form.
- No new permissions were added; the global build remains Gmail OAuth + Google Sheets + exchange-rate only.

### v6.18.0

- The Sheet save area now has two distinct actions: `Save to Sheet` writes a new row, while `Update row` rewrites the already saved row for the selected payment.
- Existing verified Sheet row ranges are retained per payment, including payments saved through bulk save.
- This lets users correct reviewed payment details and update the same Sheet row without creating duplicates.

### v6.17.0

- The live USD/VND exchange rate now appears inside the main payment review section.
- Users can reload the active rate with one click while checking the record they are about to save.
- Payment parsing direction remains global: Gmail OAuth source, provider-specific extraction where possible, adaptive review fields for missing or unusual payment email layouts.

### v6.16.0

- Final ready guidance now stays dismissed after the user clicks `Got it` / `Đã hiểu`.
- Product-rule and Sheet setup `Don't show again` choices are saved immediately.
- Required setup cards still appear when Gmail or Sheet setup is incomplete.

### v6.15.0

- Detected email details now appear as adaptive fields inside the main payment review grid.
- The separate `Email details` panel has been removed from the visible workflow.
- Users can mark each adaptive detail field `Write` or `Skip` without leaving the review form.

### v6.14.0

- Main review fields now have inline `Write` / `Skip` controls inside the `Review payment` cards.
- Users can review a detected field without writing that field to Google Sheets.
- Sheet preview and Sheet write respect the inline field write state.

### v6.13.0

- Email detail write/skip controls now live inside compact cards in the payment review section.
- The previous bulky detail checkbox row is hidden from the normal workflow.
- Long extracted detail lists are bounded so the side panel stays easier to scan.

### v6.12.0

- Global review form now uses neutral `Order / Reference` and `Email details` wording.
- Gmail-scanned payment emails can surface more provider-specific details for review without forcing them into the main Sheet columns.
- Each email detail has its own `Write` / `Skip` control; only selected details are appended to the configured details column.
- The public build remains Gmail OAuth + Google Sheets only and does not add mail-host/local connector permissions.

### v6.11.0

- The main screen now shows the active USD/VND rate and whether it is live or saved/manual.
- RevenueFlow auto-refreshes the rate before payment scan/import and before building or saving Sheet rows.
- The refresh button remains available for immediate reload, but users should not need it in the normal workflow.
- Overlapping rate refreshes now share one request to avoid stale responses overwriting newer values.

### v6.10.0

- Global build now auto-refreshes USD/VND while the side panel is open.
- Users can click `Cập nhật tỷ giá` / `Refresh rate` to reload the current exchange rate immediately.
- If the rate endpoint or network is unavailable, RevenueFlow keeps the current manual rate and shows fallback status.
- Added a narrow host permission for `https://open.er-api.com/*` for exchange-rate reads only.

### v6.9.0

- Global build has been cleaned back to Gmail OAuth + Google Sheets only.
- Local connector permissions and defaults were removed from the global manifest/config.
- New installs use neutral Sheet defaults: `Payments`, `A2`, and standard `A:J` columns.
- Customer-facing text now guides users to connect Gmail instead of internal connector setup.
- Netbase Local remains a separate local-only variant and must not be mixed into this build.
