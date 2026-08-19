# Phase 2 Audit — Design Compliance Build

Status snapshot for the Phase 2 prompt ("Design Compliance Build") applied to the
E008 cockpit prototype at `frontend/cockpit` (temporary `C_SALESORDERMANAGE_SRV`/
`C_SALESORDERMANAGE_SD` V4 service). Legend: **DONE**, **DONE (simplified)** =
implemented with a deliberate custom simplification instead of the originally
suggested SAPUI5 framework feature, **BLOCKED-BY-SERVICE** = the backing field/
entity does not exist in `design/so.xml`, so the UI element is present but
disabled/em-dash/empty-state.

## P1 fixes

- Draft-key (`IsActiveEntity`) check — **DONE**. Confirmed absent from
  `SalesOrderManageType`'s `<Key>` block; no draft-related code added.
- `Detail.controller.js` dead code (`onMvp2Action`) — **DONE**, removed.

## Section A — Master list (8 columns)

- Provider Order ID (formerly "Vaccine Request ID" — app renamed 2026-08-07),
  Description, Provider, Status, Contact, Created At,
  Employee Responsible, Created By — **DONE**. Description is em-dash
  (**BLOCKED-BY-SERVICE**: no free-text header description field). Contact and
  Employee Responsible are both **fully em-dash (RUNTIME-BLOCKED-BY-SERVICE)**:
  the `_SoldToPartyContactInfo` navigation (both fields route through it) is
  backed by a custom RAP query provider (`CL_SD_S4H_STD_PARTNER_CONTACT=CM002`)
  that throws an ABAP `ASSERTION_FAILED` dump whenever it's `$expand`-ed across
  the master list's multiple header rows, regardless of which fields are
  `$select`-ed — confirmed via ST22 short dump 2026-08-03 (see NOTES.md). This
  broke the entire Master list's initial load. Do not rebind either column
  without re-verifying against the live backend first.
- Column order/visibility is driver by `_getColumnDefs()` + a VariantStore-backed
  layout (`masterTableLayout` key) — **DONE (simplified)**: full reorder+visibility
  custom dialog instead of `sap.m.p13n.Engine`/`sap.ui.comp.p13n`, because there is
  no live FLP/`sap.ui.fl` backend to persist against in this prototype.

## Section B — Master filter bar

- 6 visible-in-bar groups (Provider Pin, Request ID, ExIS ID, Provider, Employee
  Responsible, NDC) + 10 dialog-only groups (Created On range, Contact, Ship-To
  Party, Created By, Order Type, Status, Jurisdiction, Priority, Delivery Block
  Reason, Rejection Reason) + hit-count Slider (10–100 step 10, default 50) —
  **DONE**, all fields wired via `sap.ui.comp.filterbar.FilterBar`.
  - Provider Pin, Employee Responsible, NDC Code, Rejection Reason, Contact
    filters — **BLOCKED-BY-SERVICE**: disabled controls with tooltip. NDC/
    Rejection Reason have no header-level field (item-only); Provider Pin has
    no header-level field either. Employee Responsible and Contact are
    **RUNTIME-BLOCKED-BY-SERVICE**: both route through `_SoldToPartyContactInfo`,
    which crashes the backend with `ASSERTION_FAILED` when filtered/expanded on
    the master list (see Section A note and NOTES.md).
  - **Priority filter — BLOCKED-BY-SERVICE** (found during this pass): `DeliveryPriority`
    exists only on `SalesOrderItemType`, not on the header entity at all — disabled
    with tooltip, same treatment as the other blocked filters. See NOTES.md
    "Phase 2 (Design Compliance Build)" entry for the correction history.
  - Jurisdiction filter conditionally disabled via `ServiceSchema.showJurisdictionFilter`
    (repoints to Sales Office as a stand-in — this temporary service has no DCL
    jurisdiction scoping, see original repoint prompt).
- Clear button — **DONE** (`onFilterBarClear`, resets all controls + slider to 50).
- Variant management (Select / Save As / Manage) — **DONE (simplified)**: custom
  `Select` + two `Dialog`s backed by `VariantStore.js` (browser `localStorage`),
  instead of `sap.m.VariantManagement`/`sap.ui.fl`, for the same no-live-FLP-backend
  reason as table personalization above.

## Section C — Detail title actions

- Save / Cancel / New / Copy / Create Return / Create Replacement — **DONE**, all
  present, disabled, with tooltip (`editAvailableLaterPhase`/`actionLaterTooltip`) —
  not BLOCKED-BY-SERVICE, just out of scope for this phase (no write operations yet).
- Preview Output / Refresh — **DONE**, enabled and functional (`onPreviewOutput`
  shows a placeholder dialog since there's no real output-preview endpoint wired
  yet; `onRefresh` re-reads the bound entity).

## Section D — Per-section dynamic Edit button

- **DONE**. `SectionFactory.js` renders a per-section Edit button bound to the
  `sectionFlags` model, visible/enabled only when `SectionConfig.js` marks that
  section `editable: true` (currently: Billing, Payment Method).

## Section E — Details fragment (4 form groups)

- **General Data, Dates, Value, Notes** groups — **DONE**.
  - Provider ID/Name, Order Type, Contact, Other Reason, Status, ExIS ID,
    Created At, Net Value, Employee Responsible — real data. Unlike the Master
    list (Section A), `_SoldToPartyContactInfo`-backed fields (Contact,
    Employee Responsible) are **not** blocked on the Detail page — confirmed
    live 2026-08-06 that the single-entity read doesn't hit the backend's
    `ASSERTION_FAILED` crash (that crash is specific to list-context `$expand`).
  - Status now displays `UserStatusDerived` (E008-specific derived status) via
    an `sap.m.GenericTag`, not `OverallSDProcessStatus` — switched 2026-08-06/07
    to match the Master list's Status column (see NOTES.md).
  - Description, Category — **BLOCKED-BY-SERVICE** (em-dash; no matching header field).
  - Priority — **BLOCKED-BY-SERVICE** (em-dash; item-level only field, see Section B).
  - Tax, Gross (Value group) — **BLOCKED-BY-SERVICE** (em-dash; only `TotalNetAmount`
    exists at header level — `TaxAmount`/no-gross-field exist only per item).
  - Notes — **BLOCKED-BY-SERVICE**: no notes/comments entity found; shown as a
    read-only placeholder text.
  - Pre-existing "Custom Fields" group left unchanged.

## Section F — Items fragment (15 columns) + Export/Personalize

- Row Action (menu, all items disabled), Opt-Out Ancillary, Item #, ExIS ID,
  Brand, NDC Code, NDC Description, Qty, UoM, Order Intention, Fund Type,
  PO Reference, Delivery Status, Net Value, Rejection Reason — **DONE**.
  - Brand, Order Intention, Fund Type — **BLOCKED-BY-SERVICE** (em-dash; no
    matching item-level field found).
  - PO Reference — **BLOCKED-BY-SERVICE** (em-dash; only `PurchaseOrderByCustomer`
    exists, already used for ExIS ID — no distinct second PO-reference field).
  - Delivery Status shown via `_DeliveryStatus/DeliveryStatus_Text` (corrected
    from the raw one-letter code during this pass, per its `SAP__common.Text`
    annotation in `so.xml`).
- Export to Excel — **DONE**, `sap.ui.export.Spreadsheet` (`onItemsExport`),
  respects current column visibility; `sap.ui.export` added to
  `manifest.json`'s `sap.ui5.dependencies.libs`.
- Personalize (visibility only) — **DONE (simplified)**: custom show/hide-only
  dialog (fixed column order) backed by `VariantStore.saveVariant("itemsColumns", ...)`,
  instead of `sap.m.p13n.Engine`, same no-live-FLP-backend reason as Master.

## Section G — New sections + Shipping/OrgData additions

- **Shipping.fragment.xml**: added Delivery Block Status — **DONE**, real field
  (`OverallDeliveryBlockStatus`).
- **OrgData.fragment.xml**: added Sales Group (real, `SalesGroup`) — **DONE**;
  Service Org Unit, Service Organization — **BLOCKED-BY-SERVICE** (em-dash; no
  matching fields found — this service has no CRM/Service-org concept at all).
- **PriceTotals.fragment.xml** (new) — **BLOCKED-BY-SERVICE**: no distinct
  pricing-breakdown/condition-summary entity beyond header Net/Tax/Gross
  (themselves partially blocked, see Section E); shown as a `MessageStrip` TBD
  placeholder.
- **Billing.fragment.xml** (new) — **DONE**: Payer, Bill-To Party (via
  `_SoldToPartyContactInfo`), Payment Terms (`CustomerPaymentTerms`), Billing
  Status (`OverallOrdReltdBillgStatus`), Billing Block Status
  (`OverallBillingBlockStatus`) — all confirmed real header fields.
- **PaymentMethod.fragment.xml** (new) — **DONE (partial)**: the header's
  single-value `PaymentMethod` code (+ `_PaymentMethodVH` text) IS real and shown
  as a form field (added during this pass, previously missed). The
  card/payment-instrument table (card #, holder, limit, authorization) below it
  is **BLOCKED-BY-SERVICE**: no such entity exists in this service at all — shown
  as a designed empty state. Deliberately **no CVV column** anywhere (PCI-DSS —
  CVV must never be stored/displayed even if such an entity existed later; see
  OPEN_QUESTIONS.md).
- **ScheduledActions.fragment.xml** (new) — **BLOCKED-BY-SERVICE**: no scheduled
  actions/workflow entity found; designed empty-state table.
- **Status.fragment.xml** (new) — **BLOCKED-BY-SERVICE**: no status-history/audit
  trail entity found (only the current-value status fields already on the
  header); designed empty-state table.
- **Dates.fragment.xml** (new) — **BLOCKED-BY-SERVICE**: no additional
  date-tracking entity beyond `CreationDate` (already in Details/General); shown
  as a `MessageStrip` TBD placeholder.

## Section H — Documentation & isolation

- `NOTES.md` — **DONE**, dated Phase 2 entry added documenting the metadata
  corrections found during this pass (ship-to-party, priority, tax/gross amount,
  status/delivery-status text paths, payment method).
- `PHASE2_AUDIT.md` — **DONE**, this file.
- `OPEN_QUESTIONS.md` — **DONE**, see companion file.
- Grep isolation DoD (`grep -rn "SalesOrderManage|SoldToParty|OverallSD" webapp/ --include=*.js`
  restricted to only hit `ServiceSchema.js`) — **DONE, PASSING**. Two comment-only
  hits in `formatter.js` were reworded to remove literal SAP artifact names during
  this pass so the check is now clean.

## Section I — Master list: grid table migration + toolbar actions (2026-08-18)

- **`sap.m.Table` → `sap.ui.table.Table`** — **DONE**. `requestsTable` is now a
  grid table wrapped in `<VBox fitContainer="true" renderType="Bare">` as the
  `DynamicPage` content; `selectionMode="Single"`/`selectionBehavior="RowOnly"`;
  `visibleRowCountMode="Interactive"` (initial `visibleRowCount="12"`, persisted
  on change); `enableColumnReordering="true"`; every column `resizable`/
  `autoResizable` with an explicit initial width. `sap.ui.table` added to
  `manifest.json`'s `sap.ui5.dependencies.libs` (it was only present in
  `ui5-local.yaml`'s framework library list for the mock-server profile, not in
  the manifest that actually drives runtime library loading).
- **8 columns carried over as-is** (Provider Order, Description, Provider,
  Status, Contact, Created At, Employee Responsible, Created By) — the task
  prompt's "same nine columns" does not match this app's actual Section A
  column set (8, see above); no ninth column exists to add. Cell templates
  (`Text`/`ObjectIdentifier`) moved unchanged into each `sap.ui.table.Column`'s
  `template` aggregation; `demandPopin`/`minScreenWidth` dropped (no popin
  concept on this control) — confirmed no column relied on popin/multi-line
  content.
- **Fixed pair**: Provider Order (`requestId`) + Description (`description`) —
  the first two columns in this app's column set — are `fixedColumnCount="2"`,
  forced first in `_getOrderedDefs`, excluded entirely from the personalize
  dialog (non-hideable/non-movable), and guarded in `onColumnMove` (drag into/
  out of the fixed zone is `preventDefault()`-ed).
- **Navigation**: added `rowActionTemplate` (`RowActionItem type="Navigation"`,
  `rowActionCount="1"`) → `onRowActionPress` resolves the row's binding context
  and navigates; row *selection* is independent (no press handler on the row
  itself). Old `onRowPress` (relied on `ColumnListItem type="Navigation"`,
  which doesn't exist on grid tables) removed.
- **Controller rebind**: `getBinding("items")` → `getBinding("rows")`
  throughout; `_bindMasterItems` → `_bindMasterRows` (now builds
  `sap.ui.table.Column`s directly with `template`, no `ColumnListItem` row
  template). **Max Hits / `$top` — CORRECTED 2026-08-18**: the prompt's
  "slider still caps via `$top`" doesn't work — `sap.ui.model.odata.v4.
  ODataListBinding` rejects `$top`/`$skip` as client bind parameters outright
  (`System query option $top is not supported`, confirmed live). Removed
  `$top` from both the initial `bindRows` parameters and `onSearch`'s
  `changeParameters` call; the slider/variant capture stay in place but are
  now advisory only (no hard fetch cap) until a verified V4-safe mechanism is
  chosen — see `NOTES.md`. Count display: no
  `updateFinished` on this control — added `$count: true` to the `rows` binding
  parameters (this one *is* allowed) and read `oBinding.getCount()` from the
  new `rowsUpdated` handler.
  `growing`/`growingThreshold` removed entirely (grid table + V4 virtual
  scrolling replaces it).
- **DEVIATION FROM PROMPT — fixed filters**: the prompt asked to keep "the
  existing fixed filters (`IsActiveEntity eq true`, order type `ZKB`)" applied
  to the rows binding. Neither exists in this app: `SalesOrderManageType` has
  **no `IsActiveEntity` key** (confirmed no-draft app, guardrail #3), and the
  order-type allow-list is `ZVR1`, not `ZKB` — moreover a force-applied
  order-type filter on every search was deliberately **removed** on 2026-08-03
  as a bug fix (see `NOTES.md` "Phase 2" entry) because it silently excluded
  real orders. Did not add either filter; the rows binding keeps exactly the
  same filter behavior as the old items binding (the initial no-results guard
  + whatever `onSearch` builds).
- **DEVIATION FROM PROMPT — personalization engine**: the prompt asked to
  "re-register the table with the existing `sap.m.p13n.Engine` setup"
  (`SelectionController` metadata helper, etc.). This codebase has **no
  `sap.m.p13n.Engine`/`sap.ui.comp.p13n` usage anywhere** — Master's column
  personalization has always been the hand-rolled dialog + `VariantStore.js`
  documented in Section A above (a deliberate simplification, since there's no
  live FLP flex-persistence backend to target). Introducing `p13n.Engine` now
  would be a net-new architecture piece well beyond this task's stated
  "two changes to the Master view only" scope. Instead, rewired the *existing*
  dialog/`VariantStore` mechanism to the grid table: visibility →
  `column.setVisible`-equivalent (rebuild via `_bindMasterRows`), order →
  column re-insertion, and extended the persisted layout shape with `widths`
  (per-column) and `rowCount`. Two-way sync: `columnMove`/`columnResize`
  handlers (debounced) and the interactive row-count `rowsUpdated` handler all
  write into the same `VariantStore` `masterTableLayout` key used by the
  dialog, so drag-reorder, drag-resize, row-count changes, and dialog-driven
  hide/show all persist through the same storage path and survive reload.
- **Toolbar actions**: added to the grid table's `extension` aggregation —
  `OverflowToolbar`: Title (name + count) · Spacer · Create · Refresh ·
  Personalize (relocated here from the FilterBar's `variantToolbar`, where it
  previously lived). Create (`sap-icon://create`) shows a `MessageToast`
  placeholder (`masterCreateToast`) with a `// TODO(CRUD)` marker, per the
  established placeholder pattern (Section C). Refresh (`sap-icon://refresh`)
  calls `oBinding.refresh()` (not a rebind) — filters/sort/`$top` stay intact;
  the table's `setBusy`/dataRequested/dataReceived pair (wired once in
  `_bindMasterRows`) gives the brief busy state for both Refresh and
  search/filter round trips.
- **TODO-VERIFY at runtime** (new framework surface for this app, flagged per
  Onboarding guardrail #7 — never invent API signatures): `RowActionItem`
  "press" event parameter name (`row`), and `columnMove`/`columnResize` event
  parameter names (`column`/`newPos`/`width`) and `columnMove`'s
  cancelability via `preventDefault()`. All are standard, documented
  `sap.ui.table.Table` API surface as far as could be confirmed without a live
  UI5 API reference lookup in this pass — verify against the actual UI5
  1.136.0 API docs/runtime before sign-off.


## Section J — Master table personalization rework, Link navigation, column variants (2026-08-19)

Follow-up 5-item task list. Item 5 ("limit master table to 100 records —
hard") was **explicitly deferred by the user** — not implemented; still open.

- **Standard p13n dialog (sort + group enabled) — DONE, superseding the
  Section I note below about `sap.m.p13n.Engine`.** Verified live via the
  official UI5 1.151 API reference that `sap.m.p13n.Popup` +
  `sap.m.p13n.SelectionPanel`/`SortPanel`/`GroupPanel` are the current,
  non-deprecated, standalone p13n UI controls (available since 1.96/1.97) that
  do **not** require the `sap.m.p13n.Engine`/`*Controller` registration
  machinery (that stack is for `sap.ui.fl`-backed, multi-control state
  persistence — not applicable, no live FLP flex backend here). Replaced the
  hand-rolled `sap.m.Dialog`/`List`/`CheckBox` column dialog with this control
  family; state still persists through the existing `VariantStore`
  `masterTableLayout` layout object (`onMasterTablePersonalize`,
  `_createP13nPopup`, `_setP13nPopupData`, `_applyP13nPopup` in
  `Master.controller.js`).
  - The user separately referenced a `sap.m.P13nDialog`/`P13nColumnsPanel`
    example from the unrelated `lp2preq` project as "the standard" — verified
    via grep that this pattern is dead/commented-out code in that project's
    `BaseController.js`, and that project is a different, older, OData V2 app.
    Not used as a basis.
  - **Confirmed hard restriction** (`sap.ui.table.Table` API docs, 1.151):
    `enableGrouping`/`groupBy` group-header-row visualization is documented
    client-model-only ("Grouping does not work with OData models"). Real
    OData V4 group-header rendering needs `sap.ui.table.TreeTable` +
    `ODataListBinding#setAggregation` (data aggregation/`groupLevels`) — a
    different control, out of scope. "Group by" is implemented as a primary
    sort key instead (rows cluster together, no visual divider row) — a
    documented limitation, not a shortcut.
  - `TODO-VERIFY`: exact `setP13nData`/`getP13nData` item property names
    (`key`/`label`/`visible`/`position`/`sorted`/`descending`/`grouped`) —
    not published in the fetched API reference (only that the methods exist).
    Implemented per the standard mdc p13n item shape; verify live.
- **Column-layout variant management — DONE.** New Select + Save As/Manage UI
  (grid table toolbar) backed by a new `VariantStore` key
  `masterColumnVariants`, mirroring the existing FilterBar search-variant
  pattern (Section A/B). Distinct from the single active-layout entry under
  `masterTableLayout`.
- **Provider Order column navigation via `sap.m.Link` — DONE, superseding the
  Section I `RowActionItem` navigation.** Removed `rowActionCount`/
  `rowActionTemplate`/`RowActionItem`/`onRowActionPress` entirely (resolves
  the Section I `TODO-VERIFY` on `RowActionItem`'s press parameter, since the
  mechanism no longer exists). The `requestId` column's cell template is now
  a `Link` whose `press` handler reuses the existing `_navigateToOrder()`
  helper.
- **Description column initial width — DONE.** Changed from `12rem` to
  `40rem` in `_getColumnDefs()`. Previously-persisted user layouts with the
  old width are left untouched (expected personalization precedence).
- **Master record hard cap (100) — NOT DONE, deferred by user request.**
  Research (official `sap.ui.model.odata.v4.ODataListBinding` API docs)
  reconfirmed the `$top`/`$skip` restriction from the Section I correction
  above, and found no other documented, safe, client-side mechanism to cap
  total fetched/scrollable rows for a plain (non-aggregated) V4 list binding.
  Candidate approaches considered but not implemented: `oBinding.suspend()`
  once 100 contexts are loaded (real fetch stop, but scrollbar may show extra
  blank space since `getLength()` isn't clamped), or an unverified
  `$apply=top(100)` transformation string (risk of a repeat of the `$top`
  crash). Revisit with the user before implementing.


## Custom simplifications summary (vs. originally suggested SAPUI5 features)

| Area | Suggested | Implemented instead | Why |
|---|---|---|---|
| Master/Items column personalization | `sap.m.p13n.Engine` / `sap.ui.comp` p13n | `sap.m.p13n.Popup` + `SelectionPanel`/`SortPanel`/`GroupPanel` (Section J), state persisted via `VariantStore` | Real, non-deprecated p13n UI without needing `sap.ui.fl`-backed `Engine` registration, which this prototype has no backend for |
| Master filter variants | `sap.m.VariantManagement` | Custom `Select` + Save/Manage Dialogs + `VariantStore` | Same — `sap.ui.fl` needs a real ABAP FLP/CTS backend |

All of the above are marked with `TODO-VERIFY`/simplification comments in code
and should be revisited once `ZUI_VACCINEREQUEST_O4` (the target permanent
service) and its FLP integration are available — see OPEN_QUESTIONS.md
"swap-back readiness".
