# RevenueFlow Assistant v3.1.0 UX + Sheet Fix

## What changed
- Simplified the extension layout into a clearer 3-step workflow.
- Reduced dashboard clutter and moved technical controls into advanced/collapsed sections.
- Added stronger shadows and clearer card separation for payment list, review form, and Google Sheet save area.
- Renamed the main save action to “Lưu vào Google Sheet / Save to Google Sheet”.
- Improved Google Sheet write targeting: the typed Sheet tab name is now respected before falling back to URL gid or the first tab.
- After a verified write, the visible start cell moves to the next row and the exact saved tab/range is shown.

## Why the old build could say success but you did not see the row
If the Google Sheet URL did not include a gid, the previous logic could write to the first tab even when the user typed another tab name. The new build prioritizes the typed tab name and shows the exact saved location.
