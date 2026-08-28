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


## Section K — CRUD Task 1: Create New Provider Order (2026-08-19)

Implemented per `design/NEwVaccReq.md` ("CRUD Task 1 Prompt v2"). Full
Step-0/build detail is in `NOTES.md` ("CRUD Task 1" entry) — summarized here
for audit-trail purposes.

- **Create button — DONE, replaces the Section I placeholder.**
  `onCreateRequest` (previously the `masterCreateToast` `MessageToast`
  placeholder, `// TODO(CRUD)`) now lazy-instantiates and opens
  `CreateRequestDialog` (`webapp/controller/CreateRequestDialog.js` +
  `webapp/view/fragments/CreateRequestDialog.fragment.xml`), a standalone
  handler object owned by `Master.controller.js` (not a second
  `Controller.extend`). Success callback (`_onCreateRequestSuccess`) shows a
  toast, refreshes `requestsTable`'s `rows` binding, and reuses the existing
  `_navigateToOrder` helper — **no `IsActiveEntity` key is used**, deliberately
  deviating from the spec's literal wording since this service has no such key
  (logged as a conflict in `NOTES.md`/`OPEN_QUESTIONS.md`, per the work order's
  own "log the conflict" rule rather than inventing a nonexistent key).
- **`ServiceSchema` isolation maintained**: new `orderCreateAction`,
  `createPayloadFields`, `createPayloadUom` constants added so
  `CreateRequestService.js`/`CreateRequestDialog.js` never hardcode literal
  payload field names or the action name (Section H's isolation pattern
  extended to this task).
- **`ServiceSchema.fixedOrderTypes` correction — DONE.** `["ZVR1"]` →
  `["ZKB"]`, resolving `OPEN_QUESTIONS.md` item 9 (confirmed via
  `design/E008_Service_Extension_Design.md`).
- **DEVIATION / TEMPORARY — mock create.** No custom `OrderCreate` action
  exists in the currently bound `$metadata` (confirmed by grep of both
  `localService/metadata.xml` and `design/so.xml`). Per the work order's own
  explicit allowance, `CreateRequestService.js` has a `USE_MOCK = true` flag
  that resolves a fake `salesDocument` instead of invoking a real action. The
  real-invocation code path is present but inactive, with `TODO-VERIFY` on
  both the action's exact name and its parameter shape (structured params vs.
  a single JSON string) — **this means the DoD's "live verification against
  dev" and "forced-failure path against the real action" cannot be completed
  in this pass.** Must be revisited once the backend ships the action.
- **DEVIATION — Provider field is a plain `Input`, not a full F4 value
  help**, even though `SoldToParty` does have a real
  `SAP__common.ValueListReferences` annotation in `design/so.xml`. Judged
  disproportionate scope versus the existing `filterProvider` precedent
  elsewhere in the app; documented as a deliberate simplification (see
  `PAYLOAD_CONTRACT.md` dependency list), not an oversight.
- **Contact/NDC fields**: no `ZI_VR_CONTACTVH`/`ZI_VR_NDCVH` entities exist
  anywhere in the metadata. Contact is a disabled `Input` +
  `availableWithE008Service` tooltip (reusing the existing pending-backend
  pattern); NDC is a plain **enabled** `Input` with the same tooltip — per the
  spec's explicit distinction between the two fields.
- **TODO-VERIFY at runtime** (per Onboarding guardrail #7): the real
  `OrderCreate` action name/parameter shape/response shape (see
  `PAYLOAD_CONTRACT.md`); the Priority/Order Reason/Category/Intention enum
  codes in `webapp/model/Enums.js` (all flagged inline as pending config
  confirmation).


## Section L — CRUD Task 2 v2: Change Mode (per-section edit, PATCH + ETag) (2026-08-19)

Implemented per `design/Work Order 2 - CRUD Task 2 - Change Mode.md` (v2).
Full Step-0/design detail is in `NOTES.md` ("CRUD Task 2 v2" entry) —
summarized here for audit-trail purposes. Scope guard honored: only the
Detail view + one new edit service module touched; Master, Create flow,
`SectionFactory` panel mechanics, and `ServiceSchema` read mappings are
otherwise unchanged.

- **Edit model — DONE, no draft protocol anywhere.** Gate item #1 closed:
  the bound `C_SALESORDERMANAGE_SD` service is confirmed unmanaged/no-draft
  with `SAP__core.OptimisticConcurrency` on `LastChangeDateTime` (re-confirms
  `PHASE2_AUDIT.md`'s own P1 finding plus the ETag claim). One section in edit
  at a time (Details, Items only — `SectionConfig.js` `editLive`), serialized
  via `sectionFlags` (`editEnabled` disabled on all other `editLive` sections
  while one is open). Edit → snapshot (`EditRequestService.beginEdit`,
  bookkeeping only, no request) → two-way bindings on the existing header
  context with `$$updateGroupId: 'vrEdit'` (deferred, `manifest.json`
  `groupProperties.vrEdit.submit: "API"`) → Save = `submitBatch("vrEdit")` →
  toast + section back to display; Cancel = `resetChanges("vrEdit")` +
  section back to display. No explicit "master row refresh" call was added —
  V4's single shared entity cache means the Master table's bound row already
  reflects the PATCH once it lands (documented assumption, not
  independently re-verified against a live backend this pass).
- **`EditRequestService.js` (new)** — thin wrapper: `beginEdit`/`save`/
  `cancel`. No draft context, no `IsActiveEntity`, no Edit/Activate/Discard
  actions anywhere (grep clean).
- **Details section — DONE**: Order Reason (`SDDocumentReason`, real field
  with a genuine fixed VH) wired as a `ComboBox`; ExIS ID
  (`PurchaseOrderByCustomer`, real field) wired as an `Input`. Both two-way
  bound with `$$updateGroupId: 'vrEdit'`, shown only while
  `sectionFlags>/details/editing` is true (existing `Text` display stays for
  the non-editing state).
- **Items section — DONE**: table's `_Item` binding gets
  `$$updateGroupId: 'vrEdit'`; Quantity (`RequestedQuantity`, real field)
  wired as an `Input` alongside the existing `ObjectNumber` display; Add Item
  button (`onItemsAddRow`, `oBinding.create(...)`) creates a transient row
  with NDC (`Product`) + Quantity only (unit fixed via the existing
  `ServiceSchema.createPayloadUom`, same precedent as CRUD Task 1); NDC input
  shown only for that transient/not-yet-numbered row (`!${SalesOrderItem}`),
  existing (numbered) rows' NDC stays read-only (late numbering).
- **Priority — NOT wired, deviates from the work order's expectation.**
  Re-confirmed (again) there is no header-level Priority field at all on this
  service (item-level `DeliveryPriority` only) — nothing to make editable
  without inventing a field. Stays the existing em-dash placeholder.
- **Category — NOT wired, deliberate deviation.** `headerProperties.category`
  is a `SalesOrderType` display alias, not a real distinct field; wiring it as
  editable would silently PATCH `SalesOrderType` under a misleading label.
  Stays the existing em-dash placeholder.
- **Description — confirmed still not writable**, as expected; added an
  explanatory tooltip (`editDescriptionUnavailable`) rather than leaving it
  silently non-interactive.
- **Item "Intention" — NOT wired, deviates from the work order.** No backing
  field exists anywhere in the bound `$metadata` (same BLOCKED-BY-SERVICE
  status as Fund Type/PO Reference/Brand, pre-dating this task). Add Item
  therefore cannot set it; `TS_B2-2_NDCVH.docx`'s NDC-default logic was not
  implemented as a result (binary `.docx`, not parsed this pass, and moot
  regardless since the target field doesn't exist).
- **412 (ETag conflict) handling — DONE, built fresh.** No pre-existing
  reload-dialog code was found anywhere (`UI5_AGENT_PLAYBOOK.md` §3.5 was a
  documented pattern, not shipped code) — built
  `Detail.controller.js#_showConflictDialog` (`MessageBox.warning` +
  `oContext.refresh()` on close) following that pattern.
  `EditRequestService._isConflictError`/`_hasConflictMessage`'s exact
  `Message#getTechnicalDetails()` shape is `TODO-VERIFY` — not yet exercised
  against a real 412 response.
- **"Message-to-panel auto-expand" — did not actually exist before this
  task**, despite being referenced as if it were a shipped Phase 2
  deliverable in `UI5_AGENT_PLAYBOOK.md`/this work order (repo-wide grep
  found nothing). Built the minimal `SectionFactory.prototype.expandSection(sSectionId)`
  this task needs (expand + ensure content loaded); a general
  message-target-path → section resolver for arbitrary collapsed panels was
  judged out of scope for a 2-section task and is **not** built — flagged for
  whoever adds the next `editLive` section.
- **TODO-VERIFY at runtime** (per Onboarding guardrail #7): the entire edit
  flow (ComboBox VH binding, `$$updateGroupId` deferred-batch behavior,
  `submitBatch`/`resetChanges`/`hasPendingChanges` semantics, and the 412
  detection path above) has **not** been exercised against a live backend in
  this pass — this is a code-only implementation; live verification per the
  work order's Definition of Done is still outstanding.

### Deferred / explicitly out of scope for this task

- Edit for Inventory/Shipping/Billing/Payment Method sections (marked
  `editable: true` in `SectionConfig.js` but **not** `editLive`) — remain the
  Section C "later phase" placeholder (`sectionEdit` button, disabled,
  `editAvailableLaterPhase` tooltip). Not touched by this task.
- Row delete / "cancel a specific new row" command for the Items table — the
  row-action menu's Delete entry stays disabled (`enabled="false"`, unchanged
  from Section F); a newly-added transient row can currently only be
  abandoned via the section-level Cancel (`resetChanges("vrEdit")`), which
  reverts *all* pending changes in the section, not just that one row. No
  per-row discard was built.
- Partner (Contact/Employee Responsible) edit — ruling still pending, see
  `OPEN_QUESTIONS.md` item 12.2.
- Category/Priority functional ruling — see `OPEN_QUESTIONS.md` items 12.3/12.4.


## Section M — CRUD Task 2 follow-up: Shipping, Org Data, Billing wired editable (2026-08-21)

Extended Change Mode to three more sections at the user's request, reusing
the Section L mechanics unchanged (`editLive` flag, generic Edit/Save/Cancel
wiring, `vrEdit` deferred group inherited from the header context — no new
service module, no `SectionFactory`/`EditRequestService` changes needed).

- **Shipping — DONE.** `ShippingCondition` (real fixed-values VH, no
  Immutable/Computed annotation) wired as a `ComboBox`. Delivery
  Status/Delivery Block Status re-confirmed `Core.Computed` (server-derived) —
  correctly stay read-only, untouched.
- **Org Data — DONE, partial (reverted after live testing).** `SalesOffice`/
  `SalesGroup` wired (both real, no Immutable/Computed); section flipped from
  `editable: false` to `editable: true, editLive: true` in `SectionConfig.js`.
  `SalesOrganization`/`DistributionChannel`/`OrganizationDivision` were briefly
  wired editable per explicit user request, then **reverted to read-only the
  same day**: live testing failed with `"Read-only fields must not be
  changed"` for all three, confirming the flagged risk — their
  `Common.FieldControl` dynamically resolves read-only for an existing sales
  order even without a static Immutable/Computed annotation. See
  `OPEN_QUESTIONS.md` item 13 (resolved) and `NOTES.md`. Service Org
  Unit/Service Organization remain the pre-existing
  BLOCKED-BY-SERVICE placeholders (no matching field exists at all).
- **Billing — DONE (partial), one field is a hard technical block, not a
  judgment call.** `CustomerPaymentTerms` (real, `Common.FieldControl`, no
  Computed) wired as a `ComboBox`. Billing Status/Billing Block Status
  re-confirmed `Core.Computed` — stay read-only, no circumstance under which
  they could be made writable. **Payer/Bill-To Party
  (`_SoldToPartyContactInfo`) were evaluated for the "all fields editable"
  request and confirmed NOT wirable**: the `StandardPartnerContactInfo`
  EntitySet is explicitly annotated `SAP__capabilities.UpdateRestrictions.Updatable = false`
  in `$metadata` (a read-only convenience projection). The real write path is
  a separate `_Partner` collection (`HeaderPartnerType`) plus a bound
  `CreatePartner` action, which nothing in the app currently reads/writes —
  scoped as a distinct follow-up task, not attempted here. See
  `OPEN_QUESTIONS.md` item 14.
- **Full-context-reload list extended** — `Detail.controller.js#_aSectionsNeedingFullReload`
  now includes `"shipping"`, `"orgData"`, `"billing"` alongside `"details"`,
  since all three sections' newly-editable fields are code/text nav pairs
  subject to the same `requestSideEffects` "Key predicate ... changed" error
  found and fixed for Order Reason (see `NOTES.md`).
- **Display text upgrade (minor, bundled with the above):** Shipping's
  Shipping Condition and Billing's Payment Terms display `Text` switched from
  the raw code to the expanded VH text (`_ShippingCondition/ShippingCondition_Text`,
  `_CustomerPaymentTerms/CustomerPaymentTerms_Text`), matching the Order
  Reason display convention, since both fields now have a real VH with a
  proper description.
- **TODO-VERIFY at runtime**: same caveat as Section L — this pass is
  code-only; the new ComboBoxes' VH bindings and the full-reload-on-save path
  for these three sections have not been exercised against a live backend.


## Section N — CRUD Task 1 v3: In-Place Create (2026-08-22)

Supersedes Section K entirely, per `design/prompts/CRUD Task 1 Prompt v3.md`
and `design/Architecture change.md`. Full design rationale is in `NOTES.md`
("CRUD Task 1 v3" entry); this is the audit-trail summary.

- **Create dialog removed — DONE.** `controller/CreateRequestDialog.js`,
  `view/fragments/CreateRequestDialog.fragment.xml`, `service/CreateRequestService.js`
  deleted. `Master.controller.js#onCreateRequest` now navigates to a new
  `"create"` route (same view/controller/target as `"detail"`,
  `manifest.json`).
- **Standard CRUD spine — DONE.** New `service/CreateOrderService.js`: a
  transient list-binding context in a new deferred update group `vrCreate`
  (`manifest.json` groupProperties + `ServiceSchema.createUpdateGroup`), one
  `submitBatch("vrCreate")` on Save. No custom action, no payload contract —
  `ServiceSchema`'s old `orderCreateAction`/`createPayloadFields` constants
  (Section K) removed as dead code.
- **All relevant sections simultaneously editable — DONE.** `sectionFlags`
  gained a `/createMode` boolean; the four existing `editLive` sections
  (Details/Items/Shipping/Org Data) get their `/{id}/editing` flag forced
  `true` for createMode's duration — their existing Change-Mode Input/
  ComboBox toggles (Section L/M) show with zero fragment changes.
  `SectionFactory.js` suppresses per-section Edit/Save/Cancel while createMode
  is on; a new global Save/Cancel pair lives on the DynamicPage title
  (`Detail.view.xml`, visible only in createMode).
- **Section visibility — DONE.** `SectionConfig.js` gained a `createVisible`
  flag; sections without it are hidden entirely in createMode
  (`SectionFactory.js` panel `visible` binding + matching anchor-strip
  `Link` visibility). Two new sections added — `partiesInvolved`,
  `attachments` — both always-read-only placeholders (no per-partner write
  entity / no attachment entity exists in this service at all).
- **Items table update-group rebind — DONE, the main technical solve.**
  `Items.fragment.xml`'s static `$$updateGroupId: 'vrEdit'` binding parameter
  removed (a nested list binding's group can't be an XML expression that
  switches between the change-mode group and the create-mode group).
  `Detail.controller.js#_rebindItemsGroup` rebinds it programmatically (reusing
  the XML-declared template via `getBindingInfo("items")`) the first time the
  Items panel's content loads, via a new `SectionFactory.js` content-loaded
  callback hook fired regardless of user-expand vs. forced createMode-expand.
- **Org Data createMode fields — DONE.** New ComboBoxes for
  `SalesOrganization`/`DistributionChannel`/`OrganizationDivision`, visible
  only when `/createMode` is true (independent of `/orgData/editing` — these
  three are creatable-only, per Section M's finding that the backend rejects
  PATCH on them for an existing order). Entity sets + `_Text` property names
  confirmed in `design/so.xml`.
- **Provider (`SoldToParty`) — DONE.** New required `Input` in
  `Details.fragment.xml`, visible only in createMode (no VH — same
  disproportionate-scope judgment as Section K).
- **IoH — PARTIAL, stubbed by design (user-approved "build spine now, stub
  the rest").** `Inventory.fragment.xml` gained a local-only editable table
  (`ioh` JSONModel) in createMode; `CreateOrderService.js#submitIoH` is a
  stub (`ServiceSchema.iohCreateAction` is `null`) that skips the call and
  returns `{skipped:true}` — rows are not persisted. See
  `OPEN_QUESTIONS.md` item 15.
- **Enrichment action (Description/Status/Category/Contact) — PARTIAL,
  stubbed by design, same approval.** `CreateOrderService.js#enrich` is a
  stub (`ServiceSchema.enrichmentAction` is `null`); the affected fields stay
  read-only in createMode too (`createEnrichmentUnavailable` tooltip). See
  `OPEN_QUESTIONS.md` item 15.
- **Partial-failure semantics — DONE.** Step ① (`submitBatch`) failing keeps
  the user in createMode with messages
  (`Detail.controller.js#onCreateSavePress`). Step ②/③ failing (only
  reachable once the stubs above are replaced with real calls) exits into the
  normal saved-order view with a message — no compensating deletes.
- **Master list refresh — DONE.** `EventBus` channel `"app"`/`"orderCreated"`
  (deliberately distinct from the `"vrCreate"` update-group literal, kept
  confined to `CreateOrderService.js`/`ServiceSchema.js`/`manifest.json` per
  grep isolation) — `Master.controller.js` subscribes and refreshes
  `requestsTable`'s `rows` binding.
- **`Enums.js` — left in place, now mostly dead code.** `PRIORITY`/
  `ORDER_REASON`/`CATEGORY`/`INTENTION` arrays are unused (Order Reason
  already uses a real VH; the other three remain hard BLOCKED-BY-SERVICE
  regardless of createMode) — not deleted, harmless, only `MIN_ITEMS` is
  still referenced (`CreateOrderService.js#hasMinItems`).
- **TODO-VERIFY at runtime**: this pass is code-only (no dev-system access in
  this environment) — the transient-context deep-create batch, the Items
  table group-rebind, and the Org Data createMode ComboBoxes have not been
  exercised against a live backend.


## Custom simplifications summary (vs. originally suggested SAPUI5 features)

| Area | Suggested | Implemented instead | Why |
|---|---|---|---|
| Master/Items column personalization | `sap.m.p13n.Engine` / `sap.ui.comp` p13n | `sap.m.p13n.Popup` + `SelectionPanel`/`SortPanel`/`GroupPanel` (Section J), state persisted via `VariantStore` | Real, non-deprecated p13n UI without needing `sap.ui.fl`-backed `Engine` registration, which this prototype has no backend for |
| Master filter variants | `sap.m.VariantManagement` | Custom `Select` + Save/Manage Dialogs + `VariantStore` | Same — `sap.ui.fl` needs a real ABAP FLP/CTS backend |

All of the above are marked with `TODO-VERIFY`/simplification comments in code
and should be revisited once `ZUI_VACCINEREQUEST_O4` (the target permanent
service) and its FLP integration are available — see OPEN_QUESTIONS.md
"swap-back readiness".
