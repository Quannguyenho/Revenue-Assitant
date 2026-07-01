# RevenueFlow Cloud Sync

Backend service for RevenueFlow payment-source sync.

This folder is separate from the Chrome extension. The extension should call Cloud Sync over HTTPS instead of asking customers to manage PayPal app secrets, IMAP passwords, or local `.env` files.

## Current Scope

Implemented for the first cloud foundation:

- Public `GET /health`.
- Token-protected Cloud Sync API under `/v1`.
- Server-side PayPal Transaction Search sync for internal/company use.
- PayPal CSV import fallback.
- Tenant isolation derived from the API token, not a client-supplied tenant id.
- CORS allowlist from `ALLOWED_ORIGINS`.
- Local file store for development only.

This is a scaffold, not a production SaaS backend yet.

Future adapters:

- PayPal Partner/OAuth onboarding.
- Gmail OAuth.
- Microsoft Graph / Outlook.
- ImapFlow for custom mail hosts.

## Run Locally

```powershell
cd "D:\Q project\RevenueFlow_Cloud_Sync"
copy .env.example .env
node src\server.js
```

Open:

```text
http://127.0.0.1:8790/health
```

Protected requests require:

```text
Authorization: Bearer <API_TOKEN>
```

## Endpoints

Public:

- `GET /health`

Protected:

- `GET /v1/config`
- `GET /v1/sources`
- `GET /v1/records`
- `GET /v1/paypal/diagnostics`
- `POST /v1/paypal/sync`
- `POST /v1/csv/import`

## Security Rules

- Do not put PayPal Client Secret in the Chrome extension.
- Do not return secrets from config endpoints.
- Do not trust `tenantId` from the browser.
- Do not use `Access-Control-Allow-Origin: *` for production.
- Do not log raw payment payloads or access tokens.
- Use the local file store only for development. Production needs a real database and secret manager.

## Production Blockers

Do not deploy this as a public multi-customer service until these are implemented:

- Replace static API token with real RevenueFlow user auth/session.
- Use database-backed tenant isolation and cross-tenant tests.
- Store secrets in a managed secret vault.
- Add job queue for long syncs instead of blocking popup requests.
- Add audit logs without raw customer payloads.
- Add provider revoke/offboarding.
- Complete PayPal Partner onboarding before offering customer `Connect PayPal`.

## PayPal Reality Check

Server-side `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` work for the account/app that owns those credentials.

For global customers clicking `Connect PayPal`, RevenueFlow needs PayPal Partner/multiparty onboarding. PayPal's Transaction Search API documentation notes that using Transaction Search on behalf of third parties requires being part of the PayPal partner network.

Until partner approval is ready, supported paths are:

- Internal/company PayPal API credentials on Cloud Sync.
- PayPal CSV import.
- Gmail/Outlook OAuth or inbound email adapter later.
