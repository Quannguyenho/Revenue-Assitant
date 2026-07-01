# RevenueFlow Assistant Release Checklist

## Code complete

- [x] Manifest V3 service worker.
- [x] Explicit extension-page Content Security Policy.
- [x] No remote executable code, `eval`, or external script imports.
- [x] Gmail uses `gmail.readonly`.
- [x] Unused Apps Script host permissions removed.
- [x] In-product privacy disclosure added before Gmail connection.
- [x] Privacy policy, data disclosure, and permission justifications prepared.

## Required before public submission

- [ ] Register and verify the Netbase JSC developer identity in Chrome Web Store.
- [ ] Publish `privacy-policy.html` at a stable HTTPS URL under a verified Netbase domain.
- [ ] Add that public URL to Chrome Web Store Privacy practices and Google OAuth consent configuration.
- [ ] Configure the OAuth consent screen with Netbase JSC name, logo, homepage, privacy policy, and support email.
- [ ] Verify the authorized domain in Google Search Console / Google Cloud.
- [ ] Enable Gmail API and Google Sheets API in Google Cloud.
- [ ] Upload a draft package to obtain the final Chrome Web Store item ID.
- [ ] Create or update the OAuth client of type Chrome Extension using that exact final extension ID.
- [ ] Replace the manifest OAuth client ID if the production client differs, then build the final ZIP again.
- [ ] Submit OAuth brand and restricted-scope verification for `gmail.readonly`.
- [ ] Explain that Gmail data is processed locally and is not transmitted to a Netbase server. If a server is added later, reassess Google's security-assessment requirement before release.
- [ ] Record and upload the real product demo showing Gmail connection, scan, review, Sheet write, and Sheet result.
- [ ] Capture current screenshots at Chrome Web Store dimensions without customer data.
- [ ] Complete Privacy practices answers using `PRIVACY_DISCLOSURE.md`.
- [ ] Complete permissions explanations using `PERMISSIONS_JUSTIFICATION.md`.
- [ ] Test install, update, browser restart, OAuth denial, token expiry, duplicate protection, and account revocation.

## Submission rule

Do not describe the release as Google-approved until both Chrome Web Store review and Google OAuth verification are complete.
