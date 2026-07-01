# RevenueFlow Local Email Sync

Local payment connector for internal business use. It can read a domain mailbox directly or pull PayPal transactions through PayPal's API, then sends parsed records to the RevenueFlow Assistant Chrome extension.

## What It Does

- Connects to an IMAP mailbox such as `srv.cmsmart.net`.
- Can use a Roundcube webmail URL when the webmail page opens but IMAP ports are blocked.
- Reads payment-related emails with read-only IMAP commands.
- Extracts payment records.
- Serves records locally at `http://127.0.0.1:8787`.
- Can fetch PayPal transaction data directly through PayPal's API when `SOURCE_MODE=paypal`.
- Provides a setup page so internal users do not need to edit `.env` by hand.

## Safety

- Does not delete emails.
- Does not move emails.
- Does not mark emails read by default.
- Does not store passwords in the Chrome extension.
- The mailbox password stays in local `.env` on this computer.

## Setup

1. Double-click:
   `START_RevenueFlow_Local_Email_Sync.cmd`
2. Open:
   `http://127.0.0.1:8787/setup`
3. Choose:
   - `Roundcube Webmail` when webmail opens in the browser but IMAP is blocked,
   - `PayPal API` for direct PayPal transaction sync, or
   - `Mail host / IMAP` for a domain mailbox.
4. Click `Save`, then `Test connection`.
5. Open:
   `http://127.0.0.1:8787/health`

If health returns `ok: true`, open RevenueFlow Assistant and click scan.

If health is available but scanning still fails, open:
`http://127.0.0.1:8787/diagnostics`

Diagnostics checks configuration, TCP/TLS connection, IMAP login, and mailbox readability without returning payment records. It uses short timeouts so mail host/firewall problems return quickly.

## PayPal API fallback

Use this when the mail host is blocked but the PayPal account is available. The setup page writes these values to the local service config:

```text
SOURCE_MODE=paypal
PAYPAL_ENV=live
PAYPAL_CLIENT_ID=your-paypal-rest-app-client-id
PAYPAL_CLIENT_SECRET=your-paypal-rest-app-secret
PAYPAL_LOOKBACK_DAYS=7
```

Then click scan in RevenueFlow.

The service calls PayPal Transaction Search and returns the same local record format as the IMAP connector.

## Roundcube Webmail fallback

Use this when the mailbox is readable in Roundcube, but IMAP ports such as `993` are blocked by the mail host or firewall.

```text
SOURCE_MODE=roundcube
ROUNDCUBE_URL=https://cmsmart.net/webmail/
ROUNDCUBE_USER=your-mailbox@example.com
ROUNDCUBE_PASSWORD=your-webmail-password
ROUNDCUBE_MAILBOX=INBOX
```

The service logs in to Roundcube locally, reads message source through Roundcube, parses PayPal payment emails, and returns the same `/latest` record format as IMAP. It does not store the webmail password in the Chrome extension.

## PayPal CSV fallback

Use this when both live connection paths are blocked or not configured yet.

1. Export transaction CSV from PayPal.
2. Open `http://127.0.0.1:8787/setup`.
3. Use `PayPal CSV fallback` and import the CSV file.
4. In RevenueFlow Assistant, click `Use latest payment` or `View payments`.

Imported CSV records are written to the same local `/latest` payload used by the extension review flow.

## Endpoints

- `GET /health`
- `GET /setup`
- `GET /config`
- `POST /config`
- `GET /sources`
- `POST /source-mode`
- `GET /diagnostics`
- `POST /sync`
- `POST /import-csv`
- `GET /latest`
- `GET /paypal/health`
- `POST /paypal/sync`
- `GET /paypal/latest`
- `POST /paypal/import-csv`
