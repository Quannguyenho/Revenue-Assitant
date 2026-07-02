# Chrome Web Store Permissions Justification

## `identity`

Required to obtain user-authorized Google OAuth tokens through Chrome Identity for Gmail and Google Sheets APIs. RevenueFlow does not store OAuth access tokens.

## `storage`

Required to store user settings, the connected Gmail address, and up to 50 recent parsed payment-history records in the user's local Chrome profile.

## `sidePanel`

Required because RevenueFlow's review workflow runs in Chrome's side panel while the user works with Gmail and Google Sheets.

## `clipboardWrite`

Required only when the user chooses Copy or Copy all to place prepared Sheet rows on the clipboard.

## Host permissions

- `https://gmail.googleapis.com/*`: read-only Gmail mailbox scanning through the Gmail API.
- `https://sheets.googleapis.com/*`: official Google Sheets API endpoint for creating the user's RevenueFlow spreadsheet, testing placement, and writing reviewed rows.
- `https://open.er-api.com/*`: read-only public exchange-rate endpoint used to refresh USD/VND while the side panel is open. RevenueFlow sends no Gmail, Sheet, customer, or payment data to this endpoint.

## OAuth scopes

- `gmail.readonly`: locate and read payment-related messages. RevenueFlow cannot change mailbox contents.
- `spreadsheets`: inspect the configured Sheet layout and write reviewed payment rows. The Google Sheets API does not provide a narrower write scope for this workflow.
