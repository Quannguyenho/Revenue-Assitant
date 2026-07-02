# RevenueFlow Assistant Changelog

## v6.18.0 - Update Saved Sheet Row

- Updated the package version to `6.18.0`.
- Added a secondary `Update row` / `Ghi lại` action next to the main Sheet save button.
- `Update row` rewrites the existing verified Sheet row after the user edits a saved payment.
- `Save to Sheet` still writes the next new row according to the selected Sheet direction.
- Bulk-saved payments now keep per-payment row ranges so later single-record updates target the right row.

## v6.17.0 - Rate In Payment Review

- Updated the package version to `6.17.0`.
- Moved the live USD/VND exchange-rate strip into the main `Review payment` section.
- Kept the one-click live rate refresh next to the fields users review before saving.
- Kept the global build focused on Gmail OAuth, varied payment email parsing, and Google Sheets review/write flow.

## v6.16.0 - Persistent One-Time Guidance

- Updated the package version to `6.16.0`.
- Made the final ready guidance card dismiss permanently after the user clicks `Got it` / `Đã hiểu`.
- Persisted `Don't show again` choices immediately for product-rule and Sheet setup tips.
- Kept required setup guidance visible when Gmail or Google Sheet is genuinely missing.

## v6.15.0 - Adaptive Details Inside Review Grid

- Updated the package version to `6.15.0`.
- Removed the separate `Email details` panel from the normal review flow.
- Rendered detected email details as adaptive field cards directly inside the main `Review payment` grid.
- Kept per-field `Write` / `Skip` controls on each adaptive detail card.
- Preserved the same Sheet detail-column behavior while making the review form shorter and more global.

## v6.14.0 - Inline Review Field Write Toggles

- Updated the package version to `6.14.0`.
- Added `Write` / `Skip` controls directly inside the main `Review payment` field cards.
- Customers can now keep a detected value visible for review while preventing that field from being written to Google Sheets.
- Sheet row generation now respects the inline write state for customer, email, reference, USD/VND, and product fields.
- Kept the global Gmail OAuth + Google Sheets workflow unchanged.

## v6.13.0 - Compact Detail Write Controls

- Updated the package version to `6.13.0`.
- Moved email detail write controls into compact review cards inside the `Review payment` section.
- Removed the bulky all-or-nothing detail checkbox row from the visible review flow.
- Kept per-detail `Write` / `Skip` controls, with only selected details written to the Sheet detail column.
- Added a bounded detail list height so extra extracted email details do not make the side panel overly long.

## v6.12.0 - Adaptive Email Details Review

- Updated the package version to `6.12.0`.
- Kept the global source focused on Gmail OAuth and Google Sheets; no mail-host/local connector permissions were added.
- Renamed review wording to global terms such as `Order / Reference` and `Email details`.
- Expanded automatic detail extraction for varied payment emails, including receipt, invoice, payment method, plan, item, tax, discount, fee, net amount, and shipping labels.
- Changed extra details from one all-or-nothing Sheet checkbox to per-detail `Write` / `Skip` controls.
- Sheet rows now include only the email details the user explicitly marks for writing.

## v6.11.0 - Visible Auto Rate Guard

- Updated the package version to `6.11.0`.
- Added a compact live USD/VND rate strip on the main screen so users can see the active rate without opening Settings.
- Auto-refresh now runs before scanning/importing payments and before creating or saving Sheet rows.
- Added refresh de-duplication so overlapping rate requests wait for one shared result instead of racing.
- Saved rate metadata so reloads can show whether the current rate is live or saved/manual.
- Kept the manual refresh button as an optional recovery/control action, not a required workflow step.

## v6.10.0 - Live Exchange Rate Refresh

- Updated the package version to `6.10.0`.
- Added live USD/VND exchange-rate refresh for the global build using a public no-key rate endpoint.
- Added automatic refresh while the side panel is open.
- Changed the rate button to refresh the current rate immediately on demand.
- Kept manual-rate fallback when the network or rate endpoint is unavailable.
- Added the narrow `https://open.er-api.com/*` host permission for exchange-rate reads only.

## v6.9.0 - Global Gmail Build Cleanup

- Updated the package version to `6.9.0`.
- Restored the global build to the supported Gmail OAuth and Google Sheets workflow.
- Removed localhost host permissions from `manifest.json`.
- Reset new-install defaults to neutral Sheet settings: `Payments`, start cell `A2`, and standard `A:J` columns.
- Cleared local connector URLs, tokens, and source-mode defaults from extension config.
- Reworded the side panel so customer-facing setup points to Gmail OAuth instead of internal connectors.
- Removed internal connector documentation from the global package notes.

## v6.3.0 - Click-to-Edit Sheet Columns

- Made the Sheet preview column badges clickable, so users can change where each value writes without opening Settings.
- Added customer-friendly column prompts and instant preview refresh after changing a column.
- Tightened the Sheet preview UI so the save area is shorter and easier to scan.

## v6.2.0 - Global Defaults + Accounting Connectors

- Removed customer-visible business-specific default product rules and product rename aliases.
- New installs start with blank product/rule fields and neutral placeholders.
- Added compact accounting destination setup for CSV/manual import, MISA, QuickBooks, Xero, and other accounting apps.
- Added safe accounting connector fields for app/import link and notes.
- RevenueFlow opens the app link and prepares import data, but does not store accounting app passwords or issue invoices automatically.

## v6.1.0 - Product Alias Rules

- Added automatic product/service renaming rules so users can map payment email text to accounting-friendly product names.
- Added a compact Product Alias manager inside Product Rules with keyword matching, delete controls, and a recurring-fee preset.
- Product aliases are applied before amount-based fallback rules, while manual product edits still take priority.

## v6.0.0 - Verified Sheet Save Receipt

- Added a compact save receipt after a successful Google Sheets write.
- The receipt shows the verified Sheet range and verification time.
- Added an `Open saved row` action that opens the Google Sheet link focused on the written range.
- The receipt only appears after a verified write.

## v5.9.0 - Sheet Mapping Preview

- Added compact Google Sheet column mapping with standard and Vietnam accounting presets.
- Added a customer-friendly Sheet preview showing which column each payment value will be written to.
- Added pre-save warnings for missing fields, possible duplicates, missing Sheet link, invalid start cell, and unsafe column mapping.

## v5.8.0 - Optional Extra Details Sheet Column

- Added a compact control so users can choose whether extra details are written to Google Sheet.
- Extra details are written into the same row as the selected payment.

## v5.7.0 - Vietnamese UI Polish

- Localized common auto-detected PayPal detail labels in Vietnamese mode.
- Localized automatic review reasons such as missing customer, missing reference, missing amount, and product not detected.

## v5.6.0 - Next Step Guidance

- Added clear next-step hints to the Payment Inbox queue summary.
- Kept permissions unchanged.

## v5.5.0 - Clear Queue Summary

- Added a compact queue summary for Ready, Review, Duplicate, and Saved counts after scanning.
- Bulk save reports how many payments were saved and how many were skipped.

## v5.4.0 - Bulk Ready Payments

- Added bulk actions for ready payments.
- Kept duplicate/review records out of bulk processing for safety.

## v5.3.0 - Guided Setup And Recovery

- Added guided setup cards and quick-fix actions for Gmail and Google Sheets.
