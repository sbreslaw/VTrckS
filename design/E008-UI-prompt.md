# Build Prompt — E008 Vaccine Request UI Prototype (FCL Master-Detail)

Read `E008_AGENT_ONBOARDING.md` and `E008_UI5_V4_PLAYBOOK.md` first; both bind this task. You are building the **Phase 0 / MVP-1 prototype**: a two-column FlexibleColumnLayout master-detail SAPUI5 freestyle app over the **real read-only OData V4 service** `ZUI_VACCINEREQUEST_O4`. This prototype graduates into the production display shell — build it clean, not throwaway.

## Scope guard
- **Display-only.** No create/edit/save, no actions that mutate, no client-side business rules. Buttons for future actions may render disabled with tooltip "MVP-2".
- Two FCL columns only (begin = master, mid = detail). No end column yet.
- If the dev service is not reachable at start, use a single hardcoded JSON stub behind the model interface for ≤1 week per Onboarding guardrail 2 — one code path, no mode detection, and structure the stub exactly like the V4 entity shapes (VaccineRequest → _Item → _IoH nesting, real property names from `$metadata`).

## App skeleton
```
frontend/cockpit/webapp/
├── Component.js            # manifest-created V4 default model (playbook §2); FCL semantic helper
├── manifest.json           # dataSource ZUI_VACCINEREQUEST_O4, routes/targets below
├── view/App.view.xml       # sap.f.FlexibleColumnLayout
├── view/Master.view.xml    # DynamicPage + FilterBar + sap.m.Table
├── view/Detail.view.xml    # DynamicPage + anchor strip + panel stack
├── sections/               # one XML fragment per panel section + SectionFactory.js
├── controller/…            # App, Master, Detail
├── model/formatter.js      # status text/state, quantities, ISO dates via UI5 types
└── i18n/…                  # every visible string
```
Routing: `master` (OneColumn) and `detail/{vaccineRequestId}` (TwoColumnsMidExpanded) via `FlexibleColumnLayoutSemanticHelper`; selecting a master row navigates; browser back returns to one column. Deep link to `detail/{id}` must work cold.

## Master page (begin column)
`sap.f.DynamicPage`:
- **Title/Header:** "Vaccine Requests" + result count; header snaps on scroll.
- **FilterBar:** `sap.ui.comp.filterbar.FilterBar` (the generic control — NOT SmartFilterBar; Smart* controls are V2-only and banned on this stack). Declare `FilterGroupItem`s for: Vaccine Request ID (Input), Provider ID (Input), Provider Name (Input), Status (MultiComboBox from a hardcoded 1A–1G list for now, keys per status dictionary), Created On (DateRangeSelection), NDC (Input), Created By (Input), Grantee/Jurisdiction (Input). Wire `search` → build an array of `sap.ui.model.Filter` (contains for texts, EQ for keys, BT for dates) → `oTable.getBinding("items").filter(...)`. Enable `showAdaptFiltersButton` so validation sessions can play with filter visibility; variant management slot may render but persistence is out of scope.
- **Table:** `sap.m.Table` (growing, `growingThreshold=50`, sticky headers) bound to `/VaccineRequest`. Columns: Request ID, Provider (ID + name), Status (ObjectStatus with semantic state from formatter), Created On, Created By, Net Value. Sort by Created On desc as default (`$orderby` via sorter). `autoExpandSelect` is on — bind what you show, nothing more.
- Empty-state text distinguishing "no matches" from initial state. Remember playbook troubleshooting: an empty list for an Awardee test user is likely DCL, not a bug.

## Detail page (mid column)
`sap.f.DynamicPage`:
- **Title:** Request ID + Provider name; **header content:** Status (ObjectStatus), Created On/By, Net Value, and a full-screen/exit-full-screen + close button set per FCL semantic helper.
- **Anchor strip:** a sticky `sap.m.IconTabHeader` in the page header area is NOT the pattern — use a slim `HBox` of link/buttons ("Details · Items · Inventory on Hand · Shipping · Shipping Transactions · Transaction History · Org Data") that scroll to the corresponding panel (`scrollToElement`). Keep it visually quiet.
- **Content — panel stack via `sections/SectionFactory.js`:** stacked `sap.m.Panel`s, `expandable=true`, in this order, with ONLY the first expanded initially:
  1. **Details** (`expanded=true`): 3-column responsive form grid (General | Partners & Contact | Values) per spec §6.1 — bind header fields, partner display from `_Partner`.
  2. **Items**: full-width `sap.m.Table` over `_Item` (NDC, description, brand, qty, UoM, fund type, intention, item status, net value).
  3. **Inventory on Hand**: table over `_IoH` (NDC, lot, qty on hand, expiration) — read-only rendering of the block.
  4. **Shipping**: form (ship-to, shipping condition, delivery status).
  5. **Shipping Transactions**, 6. **Transaction History**: simple tables over `_History`-style associations if exposed; else render the panel with an "available in MVP-2" placeholder — do not fake data.
  7. **Org Data**: sales org/office/group form.
  The factory instantiates each section fragment lazily on first expand, takes the panel list from a hardcoded array **shaped like the resolver output** (`[{id, titleKey, fragment, expanded}]`) so the v1.1 config swap is a data-source change. Each panel gets a `headerToolbar` with its title (and disabled future action slots where the spec defines them, e.g., Edit List on IoH).
- Panel expand/collapse must be keyboard-operable and announced (standard Panel behavior — don't wrap it in custom clickables that break it). Persisting collapse state is out of scope for the prototype; leave a TODO seam.

## Definition of done
- Runs via ui5-tooling proxy against the dev service with zero console errors; deep link works; back navigation restores one-column layout.
- Filter each declared field and combinations; growing list works past 50 rows.
- First panel open, rest collapsed; anchor links scroll correctly; lazy instantiation verified (network tab: `_IoH` not requested until its panel first expands).
- Keyboard-only pass: filter, select row, navigate, expand/collapse every panel.
- All strings in i18n; formatter unit-tested for status states and date rendering; no Smart* controls, no V2 idioms, no mode detection anywhere (grep-verifiable).
- Update `E008_AGENT_ONBOARDING.md` workspace tree if you deviate from the skeleton, and log any `$metadata` names you had to look up in a short NOTES section of your summary.
