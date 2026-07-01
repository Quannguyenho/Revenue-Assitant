# RevenueFlow Assistant Codex Rules

This folder is the canonical RevenueFlow Assistant extension project. Edit it in place.

- Do not create a new extension folder for each update.
- Do not rename this folder unless OAuth/local extension ID impact is handled.
- Bump `manifest.json` `version` and `popup.js` `defaultConfig.configVersion` for every update.
- Keep `CHANGELOG.md` and `EXTENSION_NOTES.md` current.
- Normal packaging should overwrite `D:\Q project\RevenueFlow_Assistant_Latest.zip`; create versioned ZIPs only when explicitly requested.
- Keep the extension global and customer-facing: no hard-coded internal mailbox, private company product names, or one-company Sheet layout.
- Do not store passwords or API secrets. Use Google OAuth for Gmail/Sheets.
- Do not show “saved” unless Google Sheets write verification succeeds.
- Run `node --check popup.js`, `node --check paymentRules.js`, and `node --test tests/paymentRules.test.js` before packaging.

Use these local skills when relevant: `chrome-extension-architect`, `extension-testing-debugging`, `extension-security-review`, `extension-publishing`, and `content-script-automation`.
