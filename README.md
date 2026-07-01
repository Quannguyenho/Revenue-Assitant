# RevenueFlow Assistant

Global Chrome extension build for scanning authorized Gmail payment emails, reviewing revenue records, and saving approved rows to Google Sheets.

## Folder

- `RevenueFlow_Assistant` - Manifest V3 Chrome extension source.

## Current Build

- Version: `6.9.0`
- Supported source: Gmail API via Google OAuth
- Supported output: Google Sheets via Google OAuth

## Safety

Do not commit `.env`, logs, output/data folders, packaged ZIP files, customer credentials, raw mailbox data, or local-only connector services.

Netbase-specific accounting defaults belong in the separate local-only folder, not in this global repository.
