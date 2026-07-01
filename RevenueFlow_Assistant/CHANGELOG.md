
## v6.7.0 - Roundcube Webmail Fallback

- Updated the package version to `6.7.0`.
- Added Local Sync `roundcube` source mode so internal users can read a Roundcube mailbox when IMAP is blocked but webmail works.
- Added Roundcube setup fields for webmail URL, mailbox user, mailbox folder, and password in the local setup page.
- Added Roundcube diagnostics and tests for message-list parsing and email-source normalization.
- Added Cloud Sync-to-Local Sync fallback in the extension when `http://127.0.0.1:8790` is not reachable.
- Kept webmail passwords out of Chrome extension storage and packaged output.

## v6.6.0 - Internal Cloud Sync Bridge

- Updated the package version to `6.6.0`.
- Added internal Cloud Sync mode so the extension can call `RevenueFlow_Cloud_Sync` at `http://127.0.0.1:8790`.
- Added Cloud Sync source checks, PayPal sync, and latest-record reads through the protected `/v1` API.
- Added localhost `8790` host permission for internal beta testing.
- Migrated existing local configs to Cloud Sync mode so the user is not blocked by the current mail-host IMAP timeout.
- Kept PayPal/API secrets out of the extension; the current `test-token` path is for internal local beta only and must be replaced before public release.

## v6.5.0 - Local Sync Setup + CSV Fallback

- Updated the package version to `6.5.0`.
- Added `http://127.0.0.1:8787/setup` so internal users can configure PayPal API or mail-host IMAP from a browser form instead of editing `.env` manually.
- Added safe Local Sync config endpoints that return only public configuration flags and never return passwords or PayPal secrets.
- Added `/sources`, `/source-mode`, and `/paypal/*` Local Sync endpoints for clearer source orchestration.
- Added PayPal CSV import fallback for cases where PayPal API is not configured yet and mail host IMAP is blocked.
- Added side-panel actions to open Local Sync Setup directly from RevenueFlow.
- Reworded local connection errors to guide users toward setup, PayPal API, CSV fallback, or future IP whitelisting.

## v6.4.1 - Local IMAP Connection Hardening

- Updated the package version to `6.4.1`.
- Fixed Local Email Sync so IMAP socket failures do not stop the local service.
- Stopped raw IMAP `LOGIN` commands from appearing in customer-facing errors, so mailbox passwords are not exposed.
- Added clearer local IMAP error codes for blocked server connection, missing config, and rejected login.
- Verified that the current remaining failure is a network/server block to `mail.cmsmart.net:993`, not a Chrome extension parsing issue.

## v6.4.3 - PayPal API Fallback Source

- Updated the package version to `6.4.3`.
- Added an internal PayPal API source mode to `local-email-sync` for cases where the mail host is blocked.
- Added PayPal transaction normalization so PayPal API records can enter the existing RevenueFlow review queue.
- Added `.env` settings for `SOURCE_MODE=paypal`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, and `PAYPAL_LOOKBACK_DAYS`.
- Kept PayPal API secrets in the local service only; the Chrome extension does not store PayPal credentials.

## v6.4.2 - Internal Mail Host Diagnostics

- Updated the package version to `6.4.2`.
- Added a Local Email Sync diagnostics endpoint at `http://127.0.0.1:8787/diagnostics`.
- Diagnostics now checks IMAP config presence, mail host connection, IMAP login, and mailbox readability without returning payment records.
- Changed local build wording from Gmail connection to internal mail host checks where the extension uses the local IMAP connector.
- Kept the internal local IMAP workflow for team use.

## v6.4.0 - Local Business IMAP Sync

- Updated the package version to `6.4.0`.
- Added `local-email-sync`, a local Node.js IMAP service for internal business use with domain mailboxes such as `srv.cmsmart.net`.
- Added local endpoints for `GET /health`, `POST /sync`, and `GET /latest` at `http://127.0.0.1:8787`.
- Updated the extension to use Local Email Sync by default for payment scans while keeping Gmail/Sheets OAuth support.
- Added localhost host permission for the local connector.
- Kept mailbox credentials outside Chrome extension storage. Passwords stay only in local `local-email-sync/.env`.

## v6.3.0 - Click-to-Edit Sheet Columns

- Updated the package version to `6.3.0`.
- Made the Sheet preview column badges clickable, so users can change where each value writes without opening Settings.
- Added customer-friendly column prompts and instant preview refresh after changing a column.
- Tightened the Sheet preview UI so the save area is shorter and easier to scan.

## v6.2.0 - Global Defaults + Accounting Connectors

- Updated the package version to `6.2.0`.
- Removed customer-visible business-specific default product rules and product rename aliases. New installs start with blank product/rule fields and neutral placeholders.
- Added upgrade cleanup so legacy sample products do not reappear after reload.
- Replaced hard-coded sample placeholders with global “type here / fill here” style placeholders.
- Added a compact accounting destination setup for CSV/manual import, MISA, QuickBooks, Xero, and other accounting apps.
- Added safe accounting connector fields for app/import link and notes. RevenueFlow opens the app link and prepares import data, but does not store accounting app passwords or issue invoices automatically.

## v6.1.0 - Product Alias Rules

- Added automatic product/service renaming rules so users can map email text such as `Printcart subscription price $29 per month` to a clean accounting name such as `Phí định kỳ / Recurring fees`.
- Added a compact Product Alias manager inside Product Rules with keyword matching, delete controls, and a recurring-fee preset.
- Product aliases are applied before amount-based fallback rules, while manual product edits still take priority.
- Renamed the accounting/MISA section to make clear it prepares CSV/import data and does not issue real invoices inside accounting apps.
- Kept permissions unchanged.
- Updated the package version to `6.1.0`.

## v6.0.0 - Verified Sheet Save Receipt

- Added a compact save receipt after a successful Google Sheets write.
- The receipt shows the verified Sheet range and verification time, so users can trust that data was actually written.
- Added an `Open saved row` action that opens the Google Sheet link already focused on the written range.
- The receipt only appears after a verified write, not after generic Sheet checks.
- Kept permissions unchanged.
- Updated the package version to `6.0.0`.

## v5.9.0 - Sheet Mapping Preview

- Added compact Google Sheet column mapping with standard and Vietnam accounting presets.
- Added a customer-friendly Sheet preview showing which column each payment value will be written to.
- Added pre-save warnings for missing fields, possible duplicates, missing Sheet link, invalid start cell, and unsafe column mapping.
- Kept the default Sheet behavior unchanged for existing users.
- Kept permissions unchanged.
- Updated the package version to `5.9.0`.

## v5.8.0 - Optional Extra Details Sheet Column

- Added a compact control inside `More details` / `Thông tin thêm` so users can choose whether extra details are written to Google Sheet.
- Added a small Sheet column input for extra details. Default is `L`, which preserves the previous append-at-the-end behavior.
- Extra details are written into the same row as the selected payment. If the target cell already has text, RevenueFlow appends the details instead of overwriting it.
- Kept permissions unchanged.
- Updated the package version to `5.8.0`.

## v5.7.0 - Vietnamese UI Polish

- Localized common auto-detected PayPal detail labels in Vietnamese mode, including outstanding balance, amount paid each time, maximum billable amount, next payment due, trial amount, start date, and end date.
- Replaced mixed English words in Vietnamese bulk actions and queue guidance such as `Copy ready`, `ready`, `review`, and `payment`.
- Localized automatic review reasons in Vietnamese mode, such as missing customer, missing reference, missing amount, and product not detected.
- Kept English labels unchanged when the extension language is set to EN.
- Kept permissions unchanged.
- Updated the package version to `5.7.0`.

## v5.6.0 - Next Step Guidance

- Added a clear next-step hint to the Payment Inbox queue summary so customers know whether to save ready payments, review uncertain records, check duplicates, or scan again.
- Kept the OAuth-safe local testing folder as `RevenueFlow_Assistant_v2_3_0_Best_UX`; release ZIPs use clear version names instead.
- Kept permissions unchanged.
- Updated the package version to `5.6.0`.

## v5.5.0 - Clear Queue Summary

- Added a compact queue summary so users can immediately see Ready, Review, Duplicate, and Saved counts after scanning.
- Bulk save now reports how many payments were saved and how many were skipped because they need review, are duplicates, or were already saved.
- Removed sticky table headers from the payment inbox to prevent status labels from being covered while scrolling.
- Added `EXTENSION_NOTES.md` to preserve useful product, security, Sheet, parsing, accounting, and release decisions for future development.
- Kept permissions unchanged.
- Updated the package version to `5.5.0`.

## v5.4.0 - Bulk Ready Payments

- Added a compact bulk action bar in Payment Inbox for payments that are ready and not yet saved.
- Added `Copy ready` to copy only safe ready rows while excluding review, duplicate, non-revenue, and already-saved records.
- Added `Save ready to Sheet` to write all ready payments in one verified Sheet operation.
- After bulk save, each payment is marked as saved and history is updated using the same verification path as single-row save.
- Kept duplicate/review records out of bulk processing for safety.
- Kept permissions unchanged.
- Updated the package version to `5.4.0`.

## v5.3.0 - Guided Setup And Recovery

- Added a compact guided setup card that always shows the next best action: connect Gmail, prepare Google Sheet, scan the first payment, or continue processing.
- Reused existing safe actions for setup recovery, so users get one clear button instead of guessing which technical control to use.
- Made the guide visible in compact customer UI without expanding the old technical setup area.
- Improved setup state refresh after Gmail, Sheet, or payment list changes.
- Kept permissions unchanged.
- Updated the package version to `5.3.0`.

## v5.2.0 - Learn Customer Invoice Templates

- Added `Custom template` export mode so users can paste a header row or text from their own invoice/import sample.
- RevenueFlow now detects common English and Vietnamese invoice labels such as buyer, customer email, tax code, address, product/service, unit, quantity, unit price, total, VAT, currency, payment reference, and order reference.
- Custom template exports keep the user-facing column names and map payment data into recognized columns; unknown columns are left blank instead of blocking the workflow.
- Added compact save/clear controls for the custom export template inside the existing invoice/accounting handoff box.
- Designed this as a safe customer-facing layer before any direct MISA/app automation.
- Kept permissions unchanged.
- Updated the package version to `5.2.0`.

## v5.1.0 - Customer-Friendly Import Guide

- Added `Copy field guide` so users can understand what each invoice/accounting CSV column means before importing into any accounting app.
- Added `Export sample` to generate a safe demo CSV row for testing imports without using real customer data.
- Marked payments as accounting-exported after CSV export and updated the draft status so users can see that the accounting file was already prepared.
- Tightened the accounting action buttons into a compact two-column layout for the side panel.
- Kept permissions unchanged.
- Updated the package version to `5.1.0`.

## v5.0.0 - Generic Invoice Export Layer

- Changed the accounting handoff from MISA-first to a broader `Invoice / accounting apps` workflow for global users.
- Added `Standard invoice` as the default export template with common fields used by many accounting apps: invoice date, invoice number, customer, email, item, quantity, unit price, currency, tax, total, provider, payment reference, order reference, status, and notes.
- Kept `MISA basic` as an optional preset for Vietnam-style accounting workflows without locking customers to one internal Sheet layout.
- Renamed the main export action to `Export invoice CSV` so non-technical users understand the purpose immediately.
- Added a short safety note explaining that RevenueFlow prepares draft/import data only and never issues invoices automatically.
- Kept permissions unchanged for Chrome Web Store safety.
- Updated the package version to `5.0.0`.

## v4.9.0 - Safe Invoice Draft + MISA Export

- Added a compact invoice draft simulator inside the save workflow so users can review accounting data before using MISA or another accounting app.
- Added `MISA basic` export format matching common revenue/invoice columns: date, customer, order reference, product/service, USD, note, VND, exchange rate, invoice number, and invoice date.
- Added a universal accounting export format for future integrations such as Fast, KiotViet, QuickBooks-like tools, and custom accounting apps.
- Added buttons to copy the invoice draft, copy the accounting row, export MISA CSV, or export a generic accounting CSV.
- Kept permissions unchanged; this release creates safe drafts/import files and does not automate real invoice issuance.
- Updated the package version to `4.9.0`.

## v4.8.0 - Accounting App Handoff

- Fixed Payment Inbox table header/status overlap by removing sticky table headers in the compact scroll area.
- Added a compact `MISA / accounting apps` handoff panel beside the save workflow.
- Added `Copy accounting row` for quick paste into MISA, Excel, Fast, KiotViet, or similar accounting tools.
- Added `Export accounting CSV` for batch import workflows.
- Kept permissions unchanged; this release prepares accounting data without accessing MISA domains or automating third-party apps yet.
- Updated the package version to `4.8.0`.

## v4.7.0 - More Details Fields

- Added a compact `More details` area in Payment Review with a `+` button for adding custom key/value fields.
- Auto-detects common PayPal subscription details such as `Outstanding balance`, `Amount paid each time`, `Maximum amount you can bill`, `Next payment due`, trial amount, start date, and end date.
- Adds custom details to the Sheet row as an extra note column so customer-specific email data is not lost.
- Kept product/service `+` focused on adding product items only.
- Updated the package version to `4.7.0`.

## v4.6.0 - Product From Email + Quick Custom Product

- Changed the `+` action to mean “add product/service item”, not “review OK”.
- Added a quick editable product/service field beside the product dropdown so users can fix or create a product without opening Settings.
- Auto-adds detected `For ...` product/service text from payment emails into the product dropdown and selects it.
- Stopped filtering real customer products that contain words such as Printcart, WooCommerce, W2P, or subscription.
- Kept the `...` menu for clearing the current form or removing a payment.
- Updated the package version to `4.6.0`.

## v4.5.0 - Flexible Payment Review

- Made review less rigid for real customer emails: missing order/recurring references no longer block copy or manual Sheet save.
- Added a small `+` action in Payment Review so users can mark a payment as reviewed and continue when the email is incomplete but acceptable.
- Added a compact `...` review menu for clearing the current form or removing the current payment from the list.
- Improved product/service detection so PayPal `For ...` lines are used before amount-based guessing.
- Preserved visible warning colors: review-needed stays amber, reviewed/accepted records show green.
- Updated the package version to `4.5.0`.

## v4.4.0 - Compact Sheet Customization

- Moved Google Sheet customization into a compact box beside the Save to Sheet flow.
- Added quick access to Sheet link, tab name, start cell, write direction, invoice number, and invoice date without opening Settings.
- Kept advanced Sheet behavior in Settings: mailbox restriction, auto-write, and extended accounting columns.
- Cleaned up Settings spacing with stronger section separation so payment/provider/product areas are easier to scan.
- Updated the package version to `4.4.0`.

## v4.3.0 - Subscription Detection + Clear Rule Mode

- Improved PayPal subscription parsing for emails with `Subscription details`, `Amount paid each time`, `Maximum amount you can bill`, `Next payment due`, and `For ...` product lines.
- Added a customer-friendly rule mode in Settings: built-in RevenueFlow rules by default, or custom rules for advanced users.
- Kept scan behavior simple: new users get PayPal/Stripe/common payment detection without configuring provider rules first.
- Reworked the Google Sheet destination card so it shows a meaningful connected/auto-create state instead of a vague `Ready` label.
- Updated the package version to `4.3.0`.

## v4.2.0 - Simplified Customer UI

- Shortened the main side-panel experience to three visible areas: Scan, Detected Payments, and Review/Save.
- Hid secondary setup, dashboard, technical status, Sheet health, payment detail, and manual copy tools from the default view.
- Simplified the primary button labels and customer-facing headings in Vietnamese and English.
- Reduced card padding, table height, form fields, and visual weight so users do not need to scroll as much.
- Kept Settings, CSV export, payment rules, Sheet tools, and advanced diagnostics available behind existing controls.
- Kept permissions unchanged for Chrome Web Store safety.

## v4.1.0 - Guided Customer Workflow

- Added quick setup actions for Gmail, Sheet creation, scanning, and demo data.
- Added Payment Detail Card with source, subject, transaction ID, and review reasons.
- Added Sheet Health Card showing current Sheet, next write cell, account, and fix actions.
- Added recommended payment-source presets for common global providers.
- Improved duplicate detection with transaction/profile/order plus same customer/email, amount, and date signals.
- Added settings backup and import for moving RevenueFlow to another Chrome profile or computer.
- Kept permissions unchanged: Gmail readonly, Google Sheets, storage, side panel, identity, and clipboard write.

## v4.0.0 - Customer Setup + Verified Sheet UX

- Added a customer-facing setup checklist for Gmail, Google Sheet, and payment scan readiness.
- Added quick-fix actions for Gmail and Sheet errors so users can recover without reading technical logs.
- Added a one-click RevenueFlow Sheet creator with default column headers.
- Added a compact payment review summary card with Ready, Review, Duplicate, and Saved states.
- Improved Sheet save behavior so records are marked as saved only after Google Sheets write verification.
- Updated the packaged extension version to `4.0.0`.

## v3.7.0 - Full Customer UX Pass

- Added Smart Inbox status chips with counts: All, Ready, Review, Duplicate, and Saved.
- Made Payment Inbox easier to scan with clear state labels and stronger status colors.
- Added customer-facing Basic/Advanced grouping in Settings with Vietnamese and English labels.
- Kept technical filters available while making Smart Inbox the primary customer control.
- Improved compact side-panel table behavior and reduced overflow risk.
- Preserved the published Gmail/Google Sheets permissions and OAuth setup.

## v3.6.3 - Settings UX cleanup

- Restored compact header icons for About, Settings, and Theme while keeping VI/EN as text.
- Reduced customer-facing confusion in Settings by making custom payment-source setup an advanced collapsed section.
- Replaced technical email event values in the custom-source dropdown with friendly labels.
- Improved product-rule spacing so amount, product name, add, and undo controls no longer feel stuck together.
- Added layout guards to prevent horizontal overflow in the side panel.
- Kept Gmail, Google Sheets, OAuth, and payment parsing permissions unchanged.

## v3.6.2 - Full VI/EN language cleanup

- Bumped the extension version to `3.6.2`.
- Localized the remaining hard-coded popup labels so Vietnamese mode stays Vietnamese and English mode stays English.
- Localized Payment Inbox filters, Sheet status filters, review labels, Sheet save helper text, product placeholder text, and revenue-impact options.
- Localized dynamic statuses such as saved-to-Sheet, not-revenue, unknown, manual, and Gmail scan no-match messages.
- Replaced fragile symbol-only header controls with readable localized text.
- Kept Gmail and Google Sheets permissions unchanged for Chrome Web Store safety.

## v3.6.0 - Chrome Web Store readiness cleanup

- Removed unused `activeTab`, `scripting`, `mail.google.com`, and Vietcombank host permissions from the public package.
- Kept Gmail scanning through the official Gmail API using `gmail.readonly`.
- Kept Google Sheets operations through the official Sheets API.
- Disabled third-party exchange-rate scraping; users enter the accounting rate manually.
- Removed unused Apps Script/test files from the Web Store submission package.

# v3.5.0 - Reliability + Settings Simplification

- Fixed Google Sheet write direction so Up/Down updates the next start cell correctly.
- Kept Invoice No. and Invoice Date blank by default; entered values are written to the Sheet row.
- Moved VAT and payment provider fee into Advanced Accounting because they only affect optional accounting columns.
- Added Undo for product-rule add/delete actions.
- Removed duplicate Google connect control and simplified customer-facing settings.

## v3.4.2 - OAuth client update

- Updated the Chrome Extension OAuth client ID to `952210731591-48s06f9vogefl79ojppclet1pvm7ldca.apps.googleusercontent.com`.
- Kept v3.4.1 Smart Guidance and Global Custom Products UI unchanged.


## v3.3.3 - OAuth client update

- Updated Google OAuth Chrome Extension client ID to `952210731591-5odehq88n0kn3i79rcu8cs0694tvncno.apps.googleusercontent.com`.
- Kept customer-safe settings UI unchanged.

## v3.3.2 - Customer-safe Settings

- Hides JSON, regex, and legacy rule code from normal users.
- Keeps simple provider cards and product-by-amount rules visible.
- Preserves hidden DOM IDs so existing rule logic continues working.

# v3.3.1 - Settings compact fix

- Fixed the Settings panel not scrolling.
- Reduced visible Settings length and collapsed Rules by default.
- Hid setup cards/helper text to make Settings shorter for end users.

# 3.3.0 - Settings UX redesign

- Rebuilt the Settings panel into a simpler setup hub.
- Moved Google Sheet and payment-rule setup to the top because they are the most important customer actions.
- Redesigned payment provider rules into easy enable/disable cards.
- Kept product-by-amount rules visible and moved JSON/regex tools into advanced sections.
- Added clearer helper text for automation, invoice, appearance, history, and custom provider rules.


## v2.12.1 - Gmail OAuth compatibility fix

- Restores the proven manifest-scope token request for Gmail connections.
- Keeps Google Sheets permission isolated to Sheet operations.
- Preserves the original Chrome OAuth diagnostic when an unknown connection error occurs.
- Avoids the repeated generic "Gmail could not be connected" loop on Chrome profiles that reject subset-scope token requests.

## v2.12.0 - Permanent Google authorization fix

- Requests Gmail and Google Sheets OAuth scopes separately and verifies granular consent.
- Stops retrying or deleting a valid token when only a specific Sheet is inaccessible.
- Distinguishes disabled API, missing OAuth scope, quota, and file-access errors.
- Shows the one-time Google Cloud API activation link only to the administrator when required.
- Keeps automatic Sheet creation limited to genuine file-access failures.

## v2.11.2 - Sheet write and link placement fix

- Fixes the final write request using an outdated spreadsheet ID variable.
- Moves the active Google Sheet link beside the Save/Open actions.
- Keeps the automatically created Sheet URL visible and editable without opening technical settings.

## v2.11.1 - Google Sheets API endpoint fix

- Uses the official `sheets.googleapis.com` endpoint for every Sheets operation.
- Removes the trailing slash that caused create-spreadsheet requests to return HTML.
- Stops technical response objects from appearing in Chrome's extension error list.
- Converts unexpected API responses into a safe, user-readable reconnect message.

## v2.11.0 - Zero-setup Google Sheet

- Automatically creates a private RevenueFlow spreadsheet in the connected Google account on the first save.
- Automatically creates a missing worksheet tab.
- Replaces an inaccessible Sheet configuration with a new Sheet owned by the connected user.
- Removes the need for customers to create or share a Sheet manually.

## v2.10.0 - Chrome Web Store compliance preparation

- Added a complete privacy policy and an in-product privacy disclosure before Gmail authorization.
- Added an explicit Manifest V3 content security policy and minimum Chrome version.
- Removed unused Apps Script host permissions.
- Added Chrome Web Store listing copy, permissions justifications, data disclosures, and a release checklist.
- Documented OAuth verification and public privacy-policy requirements for the production release.

## v2.9.0 - About and privacy center

- Added an About button (`!`) to the extension header.
- Added a dedicated About & Privacy page owned by Netbase JSC.
- Documented Gmail, Google Sheets, local storage, and password-handling behavior.
- Added a real-product demo recording guide.

## v2.2.0 - User-friendly UI redesign

- Added a clear quick-start dashboard at the top of the side panel.
- Reworded main actions so non-technical users know where to start.
- Added stronger card, field, table, and button shadows for clearer visual grouping.
- Improved section hierarchy: scan payments, select payment, review details, save to Sheet.
- Kept all existing extension IDs and logic unchanged.

# RevenueFlow Assistant Changelog

## v2.4.0 - Dedicated Gmail account connection

- Added a separate Connect Gmail action.
- Displays the exact Gmail mailbox currently being scanned.
- Confirms the Gmail profile again before every mailbox scan.
- Stores only the connected Gmail address for display; no Gmail password is stored.

## v2.3.4 - Google Sheet action fixes

- Shows Sheet write/open feedback directly below the action buttons.
- Opens and focuses Sheet settings automatically when the Sheet URL or tab name is missing.
- Handles Chrome tab-opening errors and provides a browser fallback.
- Saves Sheet settings before opening the configured spreadsheet.
- Closes the settings panel after saving so the Sheet buttons are immediately available.

## v2.3.3 - Forwarded PayPal email discovery

- Expanded Gmail scanning from 90 to 365 days.
- Added a second Gmail search for forwarded payment subjects and common PayPal payment phrases.
- Deduplicates messages found by multiple Gmail searches.
- Shows how many candidate emails were checked when no payment matches.

## v2.3.2 - Google OAuth client update

- Replaced the previous Google OAuth client ID with the client created for this RevenueFlow Assistant build.
- Kept Gmail read-only and Google Sheets scopes unchanged.

## v2.3.1 - Google OAuth diagnostics

- Kept the v2.3 Best UX interface and Direct Gmail workflow.
- Added the running version to the header.
- Added an OAuth setup card with the exact Extension ID and a copy action.
- Replaced the generic Google recognition error with an actionable release configuration message.
- Added a one-time Google OAuth setup guide for development and Chrome Web Store release.

## v2.1.0 - Direct Gmail Free

- Free-mode build.
- Removed cloud dependency from the customer workflow.
- Removed local Email Bridge dependency from the customer workflow.
- Added Gmail API readonly scanning.
- `Start payment workflow` scans Gmail directly and fills Payment Inbox.
- Google Sheet writing is kept.
- Package name: `RevenueFlow_Assistant_v2_1_0_direct_gmail_free.zip`

## v2.0.0 - Global Cloud UI

- Removed localhost permission.
- Removed local Email Bridge from the customer package.
- Prepared extension UI for RevenueFlow Cloud API.
- Package name: `RevenueFlow_Assistant_v2_0_0_global.zip`

## v1.9.0 - Customer UI Prototype

- Added Payment Inbox.
- Added customer-facing payment workflow.
- Kept local Email Sync Service as prototype/fallback.
- Package name: `RevenueFlow_Assistant_v1_9_0_customer.zip`

## Version Rule

- Patch: bug fix only, for example `2.1.1`.
- Minor: new workflow or UI capability, for example `2.2.0`.
- Major: architecture/product direction change, for example `3.0.0`.

The canonical customer package is always `RevenueFlow_Assistant_Latest.zip`. The installed version remains visible in the manifest and extension header.
# 2.5.0

- Fixed Google Sheet access feedback: the extension now shows the exact connected Gmail account that needs access to the Sheet.
- Added configurable payment-source rules in Settings.
- Added PayPal, Stripe, and generic payment-email detection.
- Kept product-by-amount rules separate from email-source rules.
- Corrected mixed Vietnamese/English labels.
- Reworked light and dark modes to use neutral white and black surfaces.
- New releases are packaged into one canonical `RevenueFlow_Assistant_Latest.zip` file.
# 2.6.0

- Shows how many related emails were scanned and how many payments matched.
- Adds a persistent `Saved to Sheet` state after Google confirms a successful write.
- Matches saved payments by transaction, profile, order, or email/amount/date fallback.
- Adds a target Gmail mailbox setting, defaulting to `admin@netbasejsc.com`, and blocks accidental scans from another account.
- Clarifies that scanning uses Gmail API for the connected mailbox, not the email open in a browser tab.
# 2.7.0

- Removed the hard-coded `admin@netbasejsc.com` mailbox restriction.
- Gmail connection now accepts any Google account globally.
- Added an optional mailbox restriction field for teams that want account protection.
- Added a clear `Change Gmail account` action after connection.
- Added the new RevenueFlow logo and Chrome icon set (16, 32, 48, and 128 px).
# 2.7.1

- Fixed the misleading Gmail account switch action.
- Explains that Chrome Identity uses the Google account of the current Chrome profile.
- Adds a real disconnect action and clear Chrome-profile switching guidance.
# 2.8.0

- Added a monthly revenue dashboard and six-month revenue chart.
- Added a prominent CSV export action for all unique payment records.
- Added PayPal/Stripe/provider filtering in Payment Inbox.
- Added duplicate transaction detection, warning state, and explicit review confirmation.
- Added a clear review-before-save readiness panel.
- Replaced technical OAuth errors with user-facing causes and next steps.
- Expanded README with Problem, Solution, My Role, and Impact sections.
# 3.0.0 - 2026-06-21

- Verifies every Google Sheets write by reading the exact updated range before showing success.
- Opens the precise Sheet tab and range that was confirmed.
- Adds normalized payment event classification for PayPal, Stripe, WooCommerce, 2Checkout/Verifone, Paddle, Payoneer, Wise, bank transfer, and custom gateways.
- Keeps failed, pending, dispute, subscription, payout, and informational emails visible without treating them as revenue.
- Blocks automatic Sheet writes unless the record is a valid Paid or Refund event with required customer and amount fields.
- Adds provider, event type, status, revenue impact, write decision, inbox filters, gateway toggles, JSON import/export, custom regex rules, and rule testing.
- Migrates existing source rules and fixes Gmail OAuth requests so Gmail scanning asks for Gmail scope instead of Sheets scope.
- Adds eight parser regression tests, including failed PayPal recurring payments.
# 3.0.1 - 2026-06-22

- Binds Sheet writes to the exact tab selected by the `gid` in the Google Sheet link.
- Stops silently creating or switching to another spreadsheet when the selected Sheet is inaccessible.
- Shows the verified tab and exact range after each successful write.
- Simplifies the save panel to one primary save action, one open action, and collapsed copy/link tools.
- Restores distinct colors for Paid, Failed, Refund, Dispute, Pending, Info, and verified Sheet states.
- Keeps legacy unverified history from appearing as successfully written.
