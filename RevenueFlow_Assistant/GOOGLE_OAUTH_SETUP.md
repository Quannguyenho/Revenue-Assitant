# RevenueFlow Assistant - Google OAuth setup

This is a one-time release setup for the extension owner. Customers must never enter a Gmail password into the extension.

## Why Google says it cannot identify the extension

Chrome gives every extension an Extension ID. A Google OAuth client of type **Chrome Extension** is valid for one specific Extension ID. If the source is loaded from a different unpacked folder, Chrome may assign a different ID and the old OAuth client stops matching.

## Fix the current development build

1. Open `chrome://extensions`.
2. Find **RevenueFlow Assistant v2.3.1** and copy its ID.
3. Open Google Cloud Console for the project that owns the RevenueFlow OAuth client.
4. Enable **Gmail API** and **Google Sheets API**.
5. Open **Google Auth Platform > Clients**.
6. Create an OAuth client with application type **Chrome Extension**.
7. Paste the exact Extension ID from step 2.
8. Copy the new OAuth client ID into `manifest.json` at `oauth2.client_id`.
9. Reload the extension on `chrome://extensions`.
10. Click **Connect Google** and approve Gmail read-only plus Google Sheets access.

If the OAuth consent screen is still in Testing, add the Gmail account under **Test users**.

## Global customer release

Do not distribute this product by asking every customer to load a random unpacked folder. Publish one build through Chrome Web Store, create the Google OAuth client for that permanent Web Store Extension ID, and complete Google's OAuth verification for the Gmail read-only scope. Customers then install the same signed extension ID and only need to sign in and approve access once.

## Security

- The extension requests Gmail read-only access.
- It does not ask for or store Gmail passwords.
- It does not delete, move, send, or mark emails as read.

