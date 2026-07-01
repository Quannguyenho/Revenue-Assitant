# RevenueFlow Cloud Sync Architecture

## Product Goal

Customers should not need to create PayPal Developer apps, copy secrets, run local services, or debug mail-host ports.

Target customer flow:

```text
RevenueFlow Extension
-> Connect payment source
-> RevenueFlow Cloud Sync
-> Review payment records
-> Save verified rows to Google Sheets
```

## Source Strategy

Priority order:

1. PayPal Partner/OAuth for global customer PayPal accounts.
2. Gmail API OAuth for Gmail / Google Workspace invoice emails.
3. Microsoft Graph OAuth for Outlook / Microsoft 365.
4. ImapFlow for custom IMAP mail hosts with admin setup.
5. PayPal CSV import as universal fallback.

## Current Cloud Sync Surface

```text
GET  /health                  public, no customer data
GET  /v1/config               auth
GET  /v1/sources              auth
GET  /v1/records              auth
GET  /v1/paypal/diagnostics   auth
POST /v1/paypal/sync          auth
POST /v1/csv/import           auth
```

The first scaffold uses a per-tenant API token. The tenant id is derived server-side from the token hash. The browser cannot choose `tenantId`.

## Extension Contract

Future extension config should contain:

```json
{
  "sourceMode": "cloud",
  "cloudSyncUrl": "https://sync.revenueflow.app",
  "cloudConnected": true
}
```

The extension should call:

```text
GET  /v1/sources
POST /v1/paypal/sync
GET  /v1/records
POST /v1/csv/import
```

The normalized response shape intentionally matches Local Sync:

```json
{
  "ok": true,
  "records": [],
  "summary": {
    "matchedCount": 0,
    "needReviewCount": 0
  }
}
```

## Production Requirements

Before public beta:

- Replace static API token with real user auth/session or OAuth/OIDC.
- Store tenants, connections, jobs, and records in a database.
- Store secrets in a secret manager or encrypted vault.
- Add job-based sync: `POST /v1/sync-jobs`, `GET /v1/sync-jobs/:id`.
- Add tenant-level rate limits and audit logs.
- Add PayPal Partner onboarding if RevenueFlow reads PayPal data for third-party merchants.
- Add offboarding/revoke flow for every provider connection.
- Add data retention policy and delete/export controls.

## PayPal Partner Note

PayPal Transaction Search is suitable for the account whose credentials are used. For third-party customer accounts, PayPal documentation states that Transaction Search on behalf of third parties requires the PayPal partner network.

That means `Connect PayPal` for global users is a product/compliance path, not just a code path:

- PayPal partner approval.
- Live partner credentials.
- Production return URL.
- Allowed products/scopes.
- Merchant id mapping to RevenueFlow tenant.
- Revoke/offboarding flow.
