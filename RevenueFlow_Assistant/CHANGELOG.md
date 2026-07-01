# RevenueFlow Assistant Changelog

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
