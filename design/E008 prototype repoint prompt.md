# Adjustment Prompt — Re-point E008 Prototype to Standard Service (C_SALESORDERMANAGE)

Read `E008_AGENT_ONBOARDING.md` and `E008_UI5_V4_PLAYBOOK.md` first. The base prototype (FCL master-detail, FilterBar, panel stack) exists and works against `ZUI_VACCINEREQUEST_O4`. **Interim decision by the backend team:** the prototype must now run against the SAP standard OData V4 service behind Manage Sales Orders (service definition `C_SALESORDERMANAGE_SD`; entity sets per its `$metadata`, e.g. `SalesOrderManage`, `SalesOrderItemManage`), extended by them with custom fields. This is expected to be **temporary** — the custom service returns later. Your job: re-point with minimal blast radius and maximum swap-back readiness.

## Governing rule: isolate, don't smear
All knowledge of the standard service is confined to exactly two places:
1. **`model/ServiceSchema.js`** — a single module exporting: service URL, entity set names, navigation property names, key-predicate builders, and property-name constants (header + item + partner) used by all controllers for `bindElement` paths, filters, sorters, and formatters.
2. **The section fragments** in `sections/` — XML property bindings may use real property names, because fragments are the declared swap surface.
Controllers, Component.js, Master/Detail views, formatter logic: **zero literal entity or property names** — schema constants only. Definition of done includes: `grep -rn "SalesOrderManage\|SoldToParty\|OverallSD" webapp/ --include=*.js` returns hits ONLY in `ServiceSchema.js`; fragment XML is the only other location.
Do NOT build a dual-profile/mode switch. One active schema. Park the old custom-service schema values in a clearly marked comment block inside `ServiceSchema.js` for the swap-back.

## Step 0 — metadata discovery (mandatory, before editing anything)
Fetch the service `$metadata` from the dev system and record in a `NOTES.md` section of your summary: exact service root URL, entity set names, key structures, the navigation property from header to items, partner entity/nav if exposed, which custom `ZZ1_*` fields (in-app extensibility naming) are already present, and the label/value-help annotations available. **Never guess names** — everything comes from `$metadata`. If the backend team's custom fields are not yet visible, proceed without them and list them as pending.

## Critical semantic changes to handle

### 1. Draft-enabled service (the big one)
`C_SalesOrderManage` is draft-enabled; this changes read semantics even for a display-only app:
- **List binding:** always filter `IsActiveEntity eq true` (add as a fixed filter combined with user filters) — otherwise draft twins appear as duplicate rows.
- **Keys:** entity keys include `IsActiveEntity`. All `bindElement` paths and the deep-link route must build the predicate via the schema module's key builder: `.../SalesOrderManage(SalesOrder='0000012345',IsActiveEntity=true)`. Update the route pattern/parsing accordingly.
- Ignore `DraftAdministrativeData` entirely; do not render draft indicators. (Our target design is draft-free; none of this leaks into UI concepts — it stays inside ServiceSchema and the two touchpoints above.)

### 2. Scope filter
The standard service returns ALL sales orders the user is authorized for. Add a fixed filter on `SalesOrderType` restricted to the E008-relevant order types — define the type list as a constant in `ServiceSchema.js` (values from the backend team; placeholder `['ZVR1']`-style with a TODO if unconfirmed). Combine: fixed filters (active + type) AND user filters.

### 3. Field remapping (master + Details panel + header)
Map via schema constants; typical correspondences (confirm each against `$metadata`):
- Vaccine Request ID → `SalesOrder`; Provider ID → `SoldToParty` (name via partner association if exposed, else display ID only and log it)
- Status → standard status field(s) (e.g., overall process status). Our 1A–1G user-status dropdown values DO NOT apply here: replace the Status filter's item list with the standard status codes discovered in metadata, and the formatter's semantic-state mapping accordingly. Keep the 1A–1G mapping parked in the formatter behind a schema flag for swap-back.
- Created On/By, Net Value/currency, Org Data fields → standard equivalents.
- Backend team's `ZZ1_*` custom fields: render the ones present in the Details panel under a "Custom Fields" group; tolerate absence gracefully (no binding errors when a field is missing — check metadata at startup or bind only discovered fields via the schema list).

### 4. Filters that lose backing
- **NDC filter:** header list can't filter by item material on this service without item-level query support — disable the NDC FilterGroupItem (visible, disabled, tooltip i18n: "Available with the E008 service"). Do not fake it client-side by post-filtering.
- **Grantee/Jurisdiction filter:** map to `SalesOffice` if exposed; else disable with the same tooltip. Note: DCL row-level scoping does NOT exist on this service — the app shows whatever SD auth allows; add one line to NOTES flagging this for the validation sessions (test users will see non-vaccine data if type filter is misconfigured).

### 5. Detail panel stack
- **Details:** remap per §3.
- **Items:** bind via the discovered header→item navigation; columns remap (Material, item text, requested qty + unit, item category, net amount). FundType/OrderIntention columns: render only if the corresponding `ZZ1_*` item fields exist; otherwise omit columns (not empty columns).
- **Inventory on Hand:** placeholder panel — i18n text "Pending E008 service — no IoH entity in the standard service." This is load-bearing honesty for validation sessions; do not mock rows.
- **Shipping:** remap to available shipping/partner fields; omit what's absent.
- **Shipping Transactions / Transaction History:** placeholders (unchanged behavior).
- **Org Data:** sales org/distribution channel/division/office from header.
- SectionFactory, anchor strip, lazy instantiation, expand behavior: **unchanged** — if this task forces you to touch SectionFactory logic (not just fragment bindings), stop and flag it; that indicates smearing.

## Unchanged requirements (re-verify, don't rebuild)
Display-only; no Smart* controls; no V2 idioms; no mode detection; console clean against the dev service; deep link cold-start works (now with IsActiveEntity predicate); keyboard-only pass; i18n for every new/changed string incl. the disabled-filter tooltips; growing list past 50 rows; lazy-load proof via network tab (items request fires only on Items panel expand — note: with `autoExpandSelect`, verify the header bind doesn't eagerly expand items).

## Deliverables in your summary
1. What changed, per file (expect: ServiceSchema.js new, route pattern, Master/Detail controllers via constants, fragments' bindings, formatter status map).
2. NOTES: metadata findings, `ZZ1_*` fields found, unresolved TODOs (order type list, partner nav availability).
3. **Swap-back readiness statement:** list every file that must change to return to `ZUI_VACCINEREQUEST_O4`, and confirm the grep isolation check passes. Target answer: ServiceSchema.js + fragments + the two draft touchpoints, nothing else.
