# RevenueFlow Assistant v3.5.0 - Reliability + Settings Simplification

- Fixed Google Sheet write direction: when `Up` is selected, the next start cell moves upward after a verified write instead of always moving downward.
- Invoice number and invoice date now stay blank by default. If the user enters them, the values are written into the Sheet row.
- Moved VAT and payment provider fee into an Advanced Accounting section because they only affect optional accounting columns, not the basic Sheet row.
- Added product-rule undo support for accidental add/delete actions.
- Removed the duplicate Connect Google button in Settings.
- Kept product/rule customization global and user-friendly without exposing JSON or regex to normal users.
