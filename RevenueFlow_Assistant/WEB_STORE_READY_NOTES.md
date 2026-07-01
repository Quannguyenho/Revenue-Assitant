# RevenueFlow Assistant v3.6.0 - Web Store Ready Notes

This package has been reduced for Chrome Web Store submission:

- Manifest V3 only.
- No remote executable code.
- No `eval` or dynamic code generation.
- Gmail uses the official Gmail API with `gmail.readonly`.
- Google Sheets uses the official Sheets API.
- Removed unused `activeTab`, `scripting`, `mail.google.com`, and third-party exchange-rate host permissions.
- Gmail passwords are never requested or stored.
- Parsed records and settings remain local in the Chrome profile unless the user writes approved rows to Google Sheets.

Important: because `gmail.readonly` is a restricted Google OAuth scope, public distribution still requires Google OAuth verification and Chrome Web Store review. Approval cannot be guaranteed by code changes alone.
