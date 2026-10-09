# Gallery audit fixes

Goal: Resolve the five findings in audit/gallery-audit-2026-10-05.md in the existing local gallery.

Architecture: Keep the public fitment snapshot compatible with version 1 and add only allowlisted, visible master records. Resolve current CMS cases against those records at read time so existing publications receive updated conditions. Use explicit vehicle aliases, and separate literal submitted model codes from free-form vehicle information without filling missing values from the master.

Constraints: Preserve case IDs, photos, edited reviews, first publication history, and the 64/2,959/2,009 counts. Keep raw CSV, mail, evidence, and backups in ignored directories. Local 4180 only; no shared state changes or deployment. Reuse the current worktree with existing approved changes.

- [x] Fitment: add regression tests for visible master rows, new codes absent from the old catalog, cross-brand Ref/Sandii, vehicle aliases, and wrong/hidden codes. Add the safe master index/resolver and rebuild the CSV snapshot. Validate the public build allowlist.
- [x] Vehicle/model information: combine Kangoo aliases in catalog, facets, and old search URLs. Extract only explicitly posted model tokens supported by the matched master, preserving other vehicle information separately. Never invent an actual model, year, grade, or body variant.
- [x] Link/color: preserve API compatibility for link status/reason and test URL-empty publication fallback. Add gray to the audited Kachina case in both current local representations and the monthly intake ledger.
- [x] Verification: regression suite/check/build, all 64 fitment and metadata results, unchanged photos/reviews/NEW/history, and SP/PC real browser interaction. Record results and keep the preview running.

Ruling: The fitment rows show the official applicable vehicle name, because general gallery names such as Hiace or MINI can cover more than one body type. These are product compatibility conditions, not a claim about the posted vehicle's unstated specification.

Result: 62 tests, syntax check and Worker build passed. All 2,959 details, unchanged photo/review/URL/first-publication metadata, all 256 new photo hashes and all 64 new fitment results verified. SP390/PC1440 real browser checks passed. Open-ended year labels were clarified during browser verification. Local only; persistent PID40252 remains running.
