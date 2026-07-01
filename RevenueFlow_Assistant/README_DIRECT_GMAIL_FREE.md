# RevenueFlow Assistant v2.8.0

## Problem

Small businesses often process payment emails manually, copy customer and transaction details by hand, and maintain revenue records across disconnected tools. This is slow and creates duplicate entries and data errors.

## Solution

RevenueFlow Assistant is a Chrome extension that scans authorized Gmail payment emails, extracts PayPal, Stripe, and configurable provider data, lets the user review each record, and writes validated rows to Google Sheets.

## My Role

I designed the workflow, used AI to support implementation, tested the main user journeys, fixed OAuth and Google Sheets integration issues, improved the UI/UX, and wrote the product documentation.

## Impact

The extension reduces manual data-entry time, lowers avoidable errors, highlights duplicate transactions, and gives small teams a clearer monthly revenue view.

## One Release File

Customer releases are always delivered as `RevenueFlow_Assistant_Latest.zip`. Future updates overwrite that package. Check the version badge in the extension header and `CHANGELOG.md` to see what changed.

## Google Sheet Access

RevenueFlow uses the same connected Google account for Gmail and Google Sheets. Paste the full Sheet URL, enter the exact tab name, and share the Sheet with the Gmail address shown in Settings using **Editor** permission.

The extension supports any Gmail or Google Workspace account. Chrome Identity connects the Google account of the current Chrome profile. To use another account, switch Chrome profiles, open RevenueFlow there, and connect Gmail. The optional mailbox restriction in Settings may be left blank for global use.

## Payment Rules

- Payment source: `Provider|sender domains|keywords`
- Product by amount: `USD amount=product name`

PayPal and Stripe defaults are included. Add another provider as a new line without changing the code.

This build does not use cloud hosting, localhost, local Email Bridge, command windows, `.env`, or IMAP passwords.

## How It Works

```text
User opens the extension
Clicks Start payment workflow
Grants Google/Gmail permission
Extension scans Gmail with Gmail API
Payment Inbox shows configured payment emails, including PayPal and Stripe
User reviews a payment
User writes the row to Google Sheet
```

## Customer Workflow

1. Load the extension in Chrome.
2. Click `Bat dau xu ly payment`.
3. Grant Google permission when Chrome asks.
4. Review Payment Inbox.
5. Click a payment row.
6. Click `Ghi vao Sheet`.

## Required Google Permissions

- Google Sheets write access for writing rows.
- Gmail readonly access for scanning PayPal payment emails.

The extension does not store Gmail passwords and does not require customers to open each email manually.

## Limits

- Works only with Gmail / Google Workspace mailboxes.
- Sync happens while Chrome/extension is running.
- Public distribution may require Google OAuth app verification because Gmail readonly is a restricted scope.

## Load Unpacked

Open `chrome://extensions`, enable Developer Mode, choose Load unpacked, and select:

```text
D:\Q project\RevenueFlow_Assistant_v2_3_0_Best_UX
```

If Google reports that it cannot identify the extension, follow `GOOGLE_OAUTH_SETUP.md`. Reloading alone cannot repair an OAuth client that belongs to another Extension ID.


## v2.2.0 UI Redesign

This package keeps the same extension logic but redesigns the side panel for easier use:

1. Start at the top quick-start dashboard.
2. Click the blue scan button to get new Gmail payments.
3. Select a payment in the inbox table.
4. Review the fields.
5. Save or copy the Google Sheet row.

The UI now uses stronger shadows, card grouping, and step labels so users understand the workflow without reading technical settings.

## v2.3.1 OAuth diagnostics

- Shows the running version in the header.
- Detects an invalid OAuth client and displays the exact Extension ID.
- Adds a one-click copy button for the Extension ID.
- Replaces the misleading reload-only message with the real one-time release setup requirement.
