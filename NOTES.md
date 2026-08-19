# NOTES

## E008 Prototype Repoint (temporary C_SALESORDERMANAGE) - 2026-07-28

### Metadata Discovery (Step 0)

- Metadata source used: `design/so.xml` (local service metadata snapshot).

### Confirmed service facts from so.xml

- Service root URL: `/sap/opu/odata4/sap/c_salesordermanage_sd/srvd/sap/c_salesordermanage/0001/`
- Header entity set: `SalesOrderManage` (EntityType `SalesOrderManageType`)
- Item entity set: `SalesOrderItem` (EntityType `SalesOrderItemType`)
- Header key: `SalesOrder` only (no `IsActiveEntity` key in metadata)
- Header -> item navigation: `_Item`
- Header -> partner navigation: `_Partner` (to `HeaderPartner`)
- Header -> ship-to navigation: `_ShipToParty` (to `HeaderShipToParty`)
- Header -> contact navigation: `_SoldToPartyContactInfo` (to `StandardPartnerContactInfo`)
- Status value list set: `OverallSDProcessStatus` with text `OverallSDProcessStatus_Text`

### Provisional schema values (all TODO-VERIFY)

- Remaining TODO: E008 order-type allow-list currently keeps placeholder `ZVR1` until backend confirms full set.

### Draft and scope behavior implemented

- Fixed list filter for order type allow-list: `SalesOrderType in [ZVR1]` (placeholder)
- `IsActiveEntity` fixed filter was removed because the key/property is not present in `so.xml` metadata.

### Custom fields

- `ZZ1_*` fields found on item entity:
  - `ZZ1_SKIPADDANC_SDI`
  - `ZZ1_OptOutAncillary_SDI`
  - `ZZ1_SKIPANC`
- No `ZZ1_*` fields found on `SalesOrderManageType` header entity in this metadata file.

### Validation-session warning

- The standard service will show all authorized SD orders unless the order-type filter is correctly configured.
- DCL jurisdiction scoping from the custom E008 service is not present in this temporary service shape.

## Frontend Runtime / Deploy Findings - 2026-07-28

### Verified local runtime facts

- Dev host in use: `https://sapapp2dh1.cdc.gov:44300` with client `100`.
- The host serves UI5 core from `/sap/public/bc/ui5_ui5/resources/sap-ui-core.js`.
- The host does **not** expose `sap/ushell/bootstrap/sandbox.js` at the public UI5 resource/test-resource paths that were probed.
- Working local sandbox pattern for `frontend/cockpit`:
  - proxy `/sap` to the host
  - proxy `/resources` to `https://sapapp2dh1.cdc.gov:44300/sap/public/bc/ui5_ui5`
  - serve `/test-resources` locally from UI5 tooling
- `webapp/localService/metadata.xml` was created from `design/so.xml` because the generated local profile expected a metadata file that was missing.

### Deployment findings

- `ui5-deploy.yaml` was generated with:
  - app name `ZCDC_VTRCKS`
  - package `ZCM`
  - target host `https://sapapp2dh1.cdc.gov:44300`
  - client `100`
- `fiori deploy --testMode true` builds successfully and reaches the ABAP authentication prompt.
- On this workstation/landscape, `fiori deploy` does not consume the developer's SNC session; it prompts for HTTP credentials.
- If the developer has SNC-only access and no ABAP password, deployment must be done through an SNC-enabled SAP-side tool/session instead of the Node CLI.
- `ui5-deploy.yaml` still contains `transport: REPLACE_WITH_TRANSPORT`; do not treat it as production-ready until a real transport path is decided.

## Guardrail Doc Gap + Service Activation Finding - 2026-07-29

### Guardrail doc gap (documentation only, not a real conflict)

- `AGENT_ONBOARDING.md` §3 guardrail #6 bans referencing `C_SalesOrderManage*` in any layer, with no exception noted.
- `design/E008 prototype repoint prompt.md` is the actual instruction that authorized this bridge, and explicitly names the V4 service definition `C_SALESORDERMANAGE_SD` (not the classic V2 `C_SALESORDERMANAGE_SRV`) as an **interim decision by the backend team**, expected to be temporary until `ZUI_VACCINEREQUEST_O4` is available.
- So this is a sanctioned exception, not a rogue deviation — but `AGENT_ONBOARDING.md` guardrail #6 was never updated to reference the repoint prompt/exception, so any agent reading only the onboarding doc will (as I initially did) incorrectly flag it as a violation. TODO: add a one-line pointer in guardrail #6 to `design/E008 prototype repoint prompt.md` so this stops getting re-flagged.

### RESOLVED: root cause was a swapped URL segment, not a backend activation issue

- Symptom: `sap.ui.model.odata.v4.ODataListBinding` errors: `Service group 'C_SALESORDERMANAGE_SD' not published`, underlying `Could not load metadata: 404 Not Found`, when running the deployed FLP tile.
- The V4 OData URL pattern on this system is `/sap/opu/odata4/sap/{service-group/binding name}/srvd/sap/{service-definition name}/{version}/`.
- The manifest/ServiceSchema had the two segments **swapped**: `.../c_salesordermanage_sd/srvd/sap/c_salesordermanage/0001/` (service group = `_sd`, service definition = no suffix).
- User confirmed via direct backend test that the actually-published path is `.../c_salesordermanage_srv/srvd/sap/c_salesordermanage_sd/0001/` — service group (binding) name is `c_salesordermanage_srv`, service definition name is `c_salesordermanage_sd`.
- Fixed in 4 places: `webapp/manifest.json` (`dataSources.mainService.uri`), `webapp/model/ServiceSchema.js` (`serviceRoot`), `ui5-local.yaml` (`urlBasePath`), `ui5-mock.yaml` (`urlPath`). `dist/**` copies are stale build output and will be regenerated on next `npm run build`; not hand-edited.
- Lesson for future agents: when a V4 service reports "service group 'X' not published", double-check which URL segment `X` is being read from — it may be a segment-order/name mismatch in the manifest rather than an actual backend activation problem.

## Prototype Stabilization Pass (live-backend bug fixes) - 2026-07-29

Found and fixed while running the cockpit against the real dev-system service, one console error at a time:

- **Whole-entity `path: "."` binding anti-pattern (400 Bad Request on `SalesOrderManage('...')/.`)**: with `autoExpandSelect: true`, OData V4 needs concrete property paths to compute `$select`; binding a control to `"."` isn't resolvable and the model issued a literal (invalid) request for path `.`. Fixed in `Master.controller.js` (`_bindMasterItems`, table cell bindings) and `Detail.controller.js` (new `_bindDetailHeader()` method, called after `bindElement` in `_onObjectMatched`) — both now bind explicit `ServiceSchema.*` property paths/`parts` instead of the whole row/entity. `Detail.view.xml` controls lost their inline bindings in favor of stable IDs bound programmatically (keeps the "no literal entity/property names in views" isolation rule from the repoint prompt). `formatter.js`'s `master*`/`detail*` functions were changed to accept plain values instead of a row object; the now-dead `getValue(oRow, sProperty)` helper was removed. `sections/*.fragment.xml` were checked and do **not** have this anti-pattern.
- **`sap.ui.comp.filterbar.FilterBar` unknown setting `showAdaptFiltersButton`**: that property belongs to the newer, different `sap.ui.mdc.FilterBar` control, not this one. Verified against the live SAPUI5 1.136.0 API metadata; correct property on this control is `showFilterConfiguration` (boolean, default `true`, controls visibility of the Filters/Adapt button). Fixed in `Master.view.xml`.
- **Master page overlay/busy indicator never clearing**: `App.controller.js` set the root `App` control's `busy` flag to `true` at init (`App.view.xml` binds `busy="{appView>/busy}"`), but the code that was supposed to clear it (`fnSetAppNotBusy`, wired to `metadataLoaded()`/`attachMetadataFailed`) was commented out — leftover from a copy-pasted template. Those two APIs are also V2-only and don't exist on the V4 `ODataModel` in use here, so simply uncommenting would have thrown. Fixed by wiring `fnSetAppNotBusy` to `getModel().getMetaModel().requestObject("/")`, the correct V4 equivalent, resolved/rejected either way so the overlay always clears.
- **"General" block (and, less visibly, the rest of the Details section form) rendered twice**: race condition in `sections/SectionFactory.js#ensurePanelContent` — the `_mLoaded[sId]` flag was only set *inside* the `Fragment.load().then()` callback, so a second call for the same panel arriving before that promise resolved (the auto-expanded "details" panel gets `ensurePanelContent` called once from `onAfterRendering → ensurePanels()` and again from `_onObjectMatched → rebind()`, which can race on first navigation) would kick off a second concurrent `Fragment.load` and append the fragment's content twice. Fixed by setting `_mLoaded[sId] = true` synchronously before calling `Fragment.load`, not after.
- Lesson for future agents: this codebase (App.controller.js in particular) has some sections copy-pasted from an older, unrelated template (`sap.ushell`/personalization/import-sheet code paths that don't apply to this app) with commented-out logic that looks intentional but references APIs that don't exist on the models actually in use here (V2 model APIs on a V4 model). Don't trust commented-out code as a spec — verify against the actual API before re-enabling it.

## Phase 1 (Initial Prototyping) — COMPLETE - 2026-07-31

Phase 1 scope was a working, live-backend-connected read-only prototype of the cockpit shell: FCL master/detail routing, filterable master list, detail header + expandable panel sections, all wired to the temporary standard `C_SALESORDERMANAGE_SRV`/`C_SALESORDERMANAGE_SD` V4 service via `ServiceSchema.js`. That is now done and stable against the real dev-system service (`https://sapapp2dh1.cdc.gov:44300`, client 100) — see the stabilization pass above for the bugs found and fixed along the way.

**Next up — Phase 2: Search and Content section UI adjustments.** Customer requirements for the Master-view Search (filter bar) and the Detail-view Content (panel sections) need the UI reshaped to match; this has not been scoped in code yet. Before starting, re-read the customer requirement doc(s) once shared and confirm which `ServiceSchema` fields/entity sets are already available vs. need a backend ask, per Onboarding §5 ("if the service lacks something, file a backend request — don't work around it client-side").

## Phase 2 (Design Compliance Build) — COMPLETE - 2026-08-01

Implemented the full Phase 2 prompt: Master list 8-column rework, Master filter bar rework (visible-in-bar vs dialog-only groups, hit-count slider, Clear, custom lightweight variant management, custom lightweight table personalization), Detail title actions, per-section dynamic Edit button, Details panel regrouped into 4 form groups, Items panel 15-column rework + Export/Personalize, 6 new Detail sections (Price/Totals, Billing, Payment Method, Scheduled Actions, Status, Dates) plus Shipping/OrgData field additions.

### Metadata verification pass — corrections found and fixed

While cross-checking every literal property/navigation name touched in this phase against `design/so.xml` (per Onboarding "never invent SAP artifact names"), found and fixed three pre-existing `ServiceSchema.js` constants that did not actually match the header entity (`SalesOrderManageType`, defined at `so.xml` line 364):

- **`headerProperties.shipToParty: "Partner"` — WRONG.** There is no direct `Partner` property on `SalesOrderManageType`. `Partner` only exists on `HeaderShipToPartyType`, reached via the `_ShipToParty` navigation. Fixed: removed the direct-property constant, added `shipToPartyProperties: { id: "Partner", fullName: "FullName" }`, and `Master.controller.js`'s ship-to-party OR-filter now filters only via `_ShipToParty/Partner` and `_ShipToParty/FullName` (nav-qualified paths).
- **`headerProperties.priority: "DeliveryPriority"` / `navigation.headerToDeliveryPriority: "_DeliveryPriority"` — WRONG.** `DeliveryPriority` (and the `_DeliveryPriority` navigation to `DeliveryPriorityType`) exists only on `SalesOrderItemType` (item level), not on the header entity at all. Priority as a **header/master-list** field is BLOCKED-BY-SERVICE. Fixed: removed the header-level constants, disabled the `filterPriority` ComboBox in the Master filter bar (same treatment as NDC/Employee Responsible/Rejection Reason), removed it from `onSearch`'s filter-push logic and from the variant-capture control list, and changed the Details "Priority" field to an em-dash placeholder. Kept `entitySets.deliveryPriority` / `valueHelpProperties.deliveryPriorityCode|Text` defined (harmless, valid VH entity) for potential future item-level use.
- **`headerProperties.taxAmount: "TotalTaxAmount"` / `headerProperties.grossAmount: "TotalGrossAmount"` — WRONG, fabricated.** `SalesOrderManageType` only has `TotalNetAmount` at header level; there is no header-level Tax or Gross amount field anywhere in `so.xml` (a plain `TaxAmount` exists only on `SalesOrderItemType`). Fixed: nulled both constants, changed the Details "Value" group's Tax/Gross rows to em-dash placeholders (Net Value stays real, bound to `TotalNetAmount`).

Also confirmed while there: `OverallSDProcessStatus_Text` and item `DeliveryStatus` are **not** flat properties either — both are only reachable via their respective code-to-text navigation (`_OverallSDProcessStatus/OverallSDProcessStatus_Text`, `_DeliveryStatus/DeliveryStatus_Text`) per the `SAP__common.Text` annotations in `so.xml`. The Details header Status field was switched to use the existing `formatter.detailStatusText` code→text mapping (consistent with the rest of the codebase); the Items table's Delivery Status column and the Export mapping were switched to bind the real `_DeliveryStatus/DeliveryStatus_Text` nav path instead of the raw one-letter code.

Also confirmed the header entity **does** have a real, single-value `PaymentMethod` property (+ `_PaymentMethodVH` nav to `PaymentMethodType`, giving `PaymentMethodName`/`PaymentMethodDescription`) — this is an SD payment-method *code* (e.g. check/transfer/cash), not a stored card/payment-instrument record. Added `headerProperties.paymentMethod` / `navigation.headerToPaymentMethod` / `paymentMethodProperties.text` and surfaced the real code above the (still BLOCKED-BY-SERVICE, no-card-entity) Payment Method table in `PaymentMethod.fragment.xml`.

All other literal properties/navigations introduced in this phase (Billing, OrgData, Shipping fields; Items table's 15 columns; Master's 8 columns and dialog-only filters) were individually confirmed present on `SalesOrderManageType` / `SalesOrderItemType` / their respective VH entity types by direct inspection of `so.xml` — see `PHASE2_AUDIT.md` for the full per-requirement list.

See `PHASE2_AUDIT.md` for the DONE/BLOCKED-BY-SERVICE status of every Phase 2 requirement, and `OPEN_QUESTIONS.md` for open items requiring backend/customer input.

## Master list: grid table migration + toolbar actions — 2026-08-18

Replaced `sap.m.Table` with `sap.ui.table.Table` on the Master view (grid table
for column drag-reorder/resize) and added a header toolbar (Create/Refresh/
Personalize) in the table's `extension` aggregation. Full DONE/deviation list
in `PHASE2_AUDIT.md` Section I. Findings worth keeping for future agents:

- **Task prompt assumed two things that don't hold for this codebase** — caught
  by reading the actual files before touching them (Onboarding rule 1):
  1. It asked to keep fixed filters `IsActiveEntity eq true` + order type `ZKB`
     on the rows binding. This app has **no draft** (`SalesOrderManageType` has
     no `IsActiveEntity` key — guardrail #3 bans draft anyway) and no `ZKB`
     order type (the allow-list is `ZVR1`, and a force-applied order-type
     filter was deliberately removed back on 2026-08-03 as a bug fix — see the
     Phase 2 entry above). Did not add either filter; kept the rows binding's
     filter behavior identical to the old items binding.
  2. It asked to re-register the table with "the existing `sap.m.p13n.Engine`
     setup" / a "SelectionController metadata helper." **Neither exists in this
     codebase.** Master's (and Items') personalization has always been a
     hand-rolled dialog + `VariantStore.js` (see the Phase 2 entry above,
     Section A/F) — a deliberate simplification because there's no live FLP
     flex-persistence backend to target yet. Rewired *that* mechanism to the
     grid table instead of introducing `p13n.Engine` net-new (would be a large,
     out-of-scope architecture change for a "two changes to Master only" task):
     the persisted layout (`VariantStore` key `masterTableLayout`) now also
     carries per-column `widths` and the interactive `rowCount`, and
     `columnMove`/`columnResize` (debounced) plus the row-count-drag path
     (`rowsUpdated`) write into it alongside the existing dialog-driven
     order/visibility — same storage path, so everything survives reload.
  - Lesson: when a task prompt describes framework pieces (event names,
    control APIs, service filters) that don't turn up anywhere in a grep of the
    actual codebase, verify against the real files and flag the mismatch
    (`PHASE2_AUDIT.md`/here) rather than inventing the described piece from
    scratch — matches Onboarding guardrail #7 ("never invent SAP artifact
    names, config keys, or API signatures").
- `manifest.json`'s `sap.ui5.dependencies.libs` was missing `sap.ui.table`
  entirely — only `ui5-local.yaml`'s framework library list (used for the
  local mock-server dev profile) had it. Added it to the manifest; that's the
  list that actually drives runtime library loading for the deployed/FLP app.
- The prompt says "same nine columns" for Section A; this app's Master list
  has always had **8** columns (see Phase 2 entry above and `PHASE2_AUDIT.md`
  Section A) — carried over all 8 as-is, no ninth column exists to add.
- `sap.ui.table.Table` API surface (`RowActionItem` press parameter,
  `columnMove`/`columnResize` event parameters) is new to this codebase and
  was not independently verified against a live UI5 API reference in this
  pass — flagged `TODO-VERIFY` at each usage per guardrail #7; re-check before
  sign-off.

### Runtime correction: `$top` is not a valid V4 list-binding parameter (2026-08-18)

Live testing threw `Uncaught (in promise) Error: System query option $top is
not supported` (`ODataModel-dbg.js` `buildQueryOptions`) as soon as the Master
route bound the grid table. Root cause: the task prompt's instruction to keep
"Max Hits semantics: slider still caps via `$top`" doesn't hold for
`sap.ui.model.odata.v4.ODataListBinding` — **`$top`/`$skip` cannot be set as
client bind parameters at all** (neither in the initial `bindRows(...)`
`parameters` map nor via `oBinding.changeParameters(...)`); V4 paging for
`sap.ui.table.Table`'s virtual scrolling is fully automatic and owns those two
query options itself. This is a hard model restriction, not a config mistake.

Fix applied: removed `$top` from both `_bindMasterRows`'s initial `bindRows`
parameters and `onSearch`'s `changeParameters` call (both `Master.controller.js`).
`$count: true` stays (that one **is** allowed and is what drives the result
count display). The Max Hits slider UI, its variant capture, and
`this._iMaxHits` bookkeeping are all still in place, but **the value is
currently advisory only — it no longer enforces a hard fetch cap**, since
there is no verified, safe V4-idiomatic way to do so from the client for this
service without risking un-tested `$apply=top(N)` transformation-string
behavior against a live SD-based V4 service (would need to be confirmed
against a real `$apply` capability check before use — not attempted here).
Flag for follow-up: decide whether Max Hits should (a) stay advisory, (b) be
enforced via a verified `$apply` top-transformation once confirmed against the
live service, or (c) be dropped/re-labeled now that grid-table virtual
scrolling makes a "growing threshold"-style batch-size control moot (the old
`sap.m.Table` behavior wasn't a true hard cap either — `growingThreshold` was
just the per-page batch size, see the removed `setGrowingThreshold` call).



Running the Phase 2 build against the real dev-system service surfaced a backend crash on the very first Master list load:

- Symptom: `POST .../c_salesordermanage_srv/srvd/sap/c_salesordermanage_sd/0001/$batch` → `500 Internal Server Error`, ABAP dump `ASSERTION_FAILED`. The master list never populated and the Search ("Go") button appeared to do nothing (because the underlying list binding never successfully resolved).
- Original hypothesis (disproven): suspected the newly-added `ResponsibleEmployee` field in `$expand=_SoldToPartyContactInfo($select=FullName,ResponsibleEmployee,SalesDocument)`. Removed it and redeployed — **same crash still occurred** with a fresh batch payload confirming `ResponsibleEmployee` was fully gone from the wire (`$select=FullName,SalesDocument` only). This proved the field itself was not the cause.
- **Root cause (confirmed via ST22 short dump, 2026-08-03 13:10)**: the crash originates in a **custom backend RAP query provider**, `CL_SD_S4H_STD_PARTNER_CONTACT=CM002` (the class behind `StandardPartnerContactInfoType`/the `_SoldToPartyContactInfo` navigation), method `IF_RAP_QUERY_PROVIDER~SELECT`:
  ```abap
  try.
      data(lt_filter) = io_request->get_filter( )->get_as_ranges( ).
    catch cx_rap_query_filter_no_range.
      assert 1 = 0.        " <-- unconditional crash instead of graceful handling
  endtry.
  ```
  The call stack (`CL_SADL_GW_EXPAND_LEVEL=>READ_DATA` / `_PROCESS_EXPAND` under `READ_ENTITY_LIST`) shows this happens specifically when `_SoldToPartyContactInfo` is `$expand`-ed while reading the **master LIST** (multiple `SalesOrderManage` header rows on one page). Whatever filter shape the RAP framework passes down for a multi-row expand can't be converted to simple ranges by `get_as_ranges()`, and the custom class's own error handling just asserts/crashes instead of falling back — **this is independent of which fields are `$select`-ed**, which is exactly why removing `ResponsibleEmployee` alone didn't help: the still-present `FullName` (used for the Master "Contact" column) was equally implicated.
- Fixed: removed `_SoldToPartyContactInfo` `$expand`/`$filter` entirely from the **Master list** context:
  - `Master.controller.js`'s "Contact" column no longer binds through `_SoldToPartyContactInfo/FullName` — shows em-dash (`formatter.masterContact()` with no value).
  - `Master.controller.js`'s "Contact" filter box (`filterContact`) is now disabled (same treatment as NDC/Provider Pin/Rejection Reason/Priority/Employee Responsible) and removed from variant capture, since filtering by this nav would hit the same crash.
  - "Employee Responsible" master column / Details field remain em-dash from the earlier (disproven-as-root-cause, but still valid) defensive fix.
- **Verified live (2026-08-06)**: the Detail page's single-entity read (`Details.fragment.xml`'s Contact/`FullName`, `FormattedPostalAddressDesc`, and `ResponsibleEmployee`) confirmed working with no crash. The ST22 call stack showed the crash is specific to the **list-context** expand (`READ_ENTITY_LIST`); the single-entity `bindElement` read (`READ_ENTITY`, one sales order) is a different code path and does **not** hit `cx_rap_query_filter_no_range`/`ASSERTION_FAILED`. `ResponsibleEmployee` is therefore bound directly on the Detail page (no em-dash needed there); the em-dash workaround remains required only for the Master **list** (Contact and Employee Responsible columns) and the Contact filter, where the crash is real.
- Lesson: **presence in `$metadata` does not guarantee a field/navigation is safe to request, and a custom-class-backed entity (RAP unmanaged query provider) can behave very differently for list-context `$expand` vs single-entity reads.** Always get the ST22 short dump's "Error analysis" / "Information on where terminated" / "Source Code Extract" sections when diagnosing a live `ASSERTION_FAILED` — it gives the exact class/method/line immediately instead of guessing field-by-field from `$select` clauses.
- **This is a backend defect, not a metadata-design issue** — see `OPEN_QUESTIONS.md` for the item to report to the backend/ABAP team (`CL_SD_S4H_STD_PARTNER_CONTACT=CM002`, unconditional `assert 1 = 0` on `cx_rap_query_filter_no_range`).

## Live-backend regression: `detailStatusText` "this.statusText is not a function" — 2026-08-03

- Symptom: opening the Detail page threw `this.statusText is not a function` from `formatter.detailStatusText`, bound in `Details.fragment.xml` via the bare XML string `'.formatter.detailStatusText'`.
- Root cause: `detailStatusText`/`masterStatusText`/`statusText`/`statusState` all internally called `this.statusText(...)`/`this.statusState(...)`. That only works when the formatter function is explicitly `.bind(formatter)`-ed (done for `Master.controller.js`'s JS-side binding), not when referenced as a bare string in XML (`Details.fragment.xml`), where `this` isn't guaranteed to be the formatter module.
- Fixed: extracted the status-code lookup into private module-level functions (`fnStatusText`/`fnStatusState`, not object methods, no `this` dependency) in `formatter.js`; all four public formatter functions now call these directly. Confirmed no other `this.xxx(...)` internal calls remain in `formatter.js`.
- Lesson: in `formatter.js`, never call another formatter method via `this.otherFn(...)` — some callers (bare XML string formatter refs) don't bind `this`. Extract shared logic to a private top-level function instead.

## Master search regression: hidden `SalesOrderType = ZVR1` restriction excluded real orders — 2026-08-03

- Symptom: a known, valid order (e.g. 500000043) appears on the Master list's unfiltered initial load, but searching for it by Vaccine Request ID (or any other filter) returns zero results.
- Root cause: `onSearch` unconditionally AND-ed a hidden `_getFixedFilters()` restriction (`SalesOrderType eq 'ZVR1'`) onto every search — confirmed via the live request `$filter=(SalesOrderType eq 'ZVR1') and contains(SalesOrder,'500000043')`. `ZVR1` was an unconfirmed `TODO-VERIFY` placeholder (`ServiceSchema.fixedOrderTypes`) that was never actually checked against real order data, and evidently doesn't match this order's real type. Because the initial unfiltered `_bindMasterItems()` load never applied this restriction (only `onSearch` did), the order was visible until the user tried to search for it — an inconsistency that had been noted internally as low-priority but turned out to be the actual bug.
- Fixed: removed the automatic `SalesOrderType = ZVR1` restriction from `onSearch` entirely (removed the now-dead `_getFixedFilters()` method and its call site) — search behavior now matches the unfiltered initial load (no hidden type restriction). The optional "Order Type" filter dropdown (`filterSalesOrderType`) is unchanged and still only offers `ZVR1` as a manual, opt-in choice (`ServiceSchema.fixedOrderTypes` allow-list) — this may need to be revisited/expanded once real order types for this workflow are confirmed with the backend team.
- Lesson: a restriction applied inconsistently (only on searched loads, not the initial load) is a red flag worth investigating immediately, not deferring as "lower priority."

## UX change: Master list no longer auto-populates on initial load — 2026-08-04

- Requirement: the hit list should stay empty until the user presses "Go" — previously `_bindMasterItems()` bound the table with no filter at all on `onInit`, so it always showed every order (e.g. 60 results) before any search.
- Change: `onInit` now seeds `this._aCurrentFilters` with a guaranteed-empty filter (`SalesOrder eq ''` — safe since `SalesOrder` is a non-nullable key field, never blank) before calling `_bindMasterItems()`, which now passes `filters: this._aCurrentFilters` into `bindItems()`. `onSearch` overwrites `this._aCurrentFilters` with the real filters (or an empty array if no criteria entered, which then shows everything — same as the old initial-load behavior, just now requiring an explicit Go) and always sets `/masterHasSearch` to `true` (previously only true when at least one filter was set).
- Added `noDataText` on `requestsTable` bound to `{i18n>masterNoDataBeforeSearch}` ("Enter search criteria and choose Go to see results"), shown only while `view>/masterHasSearch` is `false`, so the empty initial state doesn't look broken/blank.
- Table personalization/column-layout changes (`_applyColumnDialog` → `_bindMasterItems()`) reuse `this._aCurrentFilters`, so re-rendering columns doesn't reset back to the unfiltered/empty state.

## Verified live: single-entity Detail reads through `_SoldToPartyContactInfo` are safe — 2026-08-06

- Confirmed live that `Details.fragment.xml`'s Contact (`FullName`), Ship-To address (`FormattedPostalAddressDesc`), and Employee Responsible (`ResponsibleEmployee`) fields all bind and render correctly on the Detail page with no crash. This confirms the `ASSERTION_FAILED` regression documented above is specific to the **list-context** `$expand` of `_SoldToPartyContactInfo` (Master list); the **single-entity** `bindElement` read (Detail page, `READ_ENTITY`) is a different backend code path and is not affected.
- `ResponsibleEmployee` is therefore bound directly on the Detail page. The em-dash workaround remains required only for the Master list's Contact/Employee Responsible columns and the Contact filter, where the crash is real.

## Rebranding: app renamed from "Vaccine Request" to "Provider Order" — 2026-08-07

- All user-facing "Vaccine Request(s)" labels renamed to "Provider Order(s)": app title (`appTitle`), Master list title (`masterTitle`), Vaccine Request ID filter/column (`filterRequestId`, `colRequestId`), Detail page title/prefix (`detailTitle`, `detailTitlePrefix`), and the FLP sandbox tile title/description in `flpSandbox.html`/`flpSandboxMockServer.html`.
- `manifest.json`'s `sap.app/title` already referenced the `{{appTitle}}` i18n key, so no code change was needed there.
- The technical namespace/app ID (`cdc.vaccreq`) was intentionally left unchanged — this is a code-level identifier, not a display label, and renaming it would be a much larger, riskier refactor (component ID, manifest, module paths, variant persistence keys) out of scope for a display-text rename.

## Status field switched to `UserStatusDerived` (E008-specific derived status) — 2026-08-06/07

- Both the Master list Status column and the Detail page status control were switched from `OverallSDProcessStatus` (generic SD document status, `status`/`statusSource: "standard"`) to `UserStatusDerived` (`headerProperties.userStatus`, `statusSource: "e008"`), which carries the E008-specific workflow status.
- `UserStatusDerived`'s raw value is a combined `"<code> <description>"` string (e.g. `"1A In Process"`), not a bare code. `formatter.js` was updated accordingly:
  - `fnStatusText` (e008 branch) now strips the leading code word (`removeFirstWord`) and displays the remainder as-is, rather than looking up a hardcoded text map.
  - `fnStatusCode` extracts just the leading code word (`sCode.split(' ')[0]`) for status-state (color) lookup via `mStatusStateE008`.
  - `mStatusTextE008`/`mStatusStateE008` were updated to the confirmed E008 code set (`0A`, `1A`-`1G`, `2A`-`2C`) with corrected descriptions/severities (`mStatusTextE008` is now effectively a fallback/reference map since the display text comes directly from the backend string).
- Detail page: `Details.fragment.xml`'s status field and `Detail.controller.js`'s `_bindDetailHeader()` both now bind `UserStatusDerived` (previously `OverallSDProcessStatus`), and the status control changed from `sap.m.ObjectStatus` to `sap.m.GenericTag` (property `status`, type `sap.ui.core.ValueState` — matches the values `fnStatusState` returns: `None`/`Information`/`Success`/`Warning`/`Error`). The controller's binding was updated from `.bindProperty("state", ...)` to `.bindProperty("status", ...)` to match `GenericTag`'s actual property name.
- Fixed a typo while reviewing: `mStatusStateE008` had a stray `"0A:"` key (trailing colon) instead of `"0A"` — corrected; behavior was unaffected since the lookup miss fell back to the same `"None"` value either way.

## UX addition: Detail page full-screen toggle — 2026-08-06/07

- Added a full-screen toggle button pair (`enterFullScreen`/`exitFullScreen`, mutually exclusive via `visible` bindings on `appView>/actionButtonsInfo/midColumn/fullScreen`) to `Detail.view.xml`'s `f:DynamicPageTitle/f:navigationActions`, wired to a new `toggleFullScreen` handler in `Detail.controller.js` that flips the `appView` model's `midColumn.fullScreen` flag and swaps `/layout` between `TwoColumnsMidExpanded` and the previously-stored layout.
- `App.controller.js`'s default `appView` model now starts with `actionButtonsInfo.midColumn.fullScreen: true` (was `false`), and `manifest.json`'s `detail` route layout changed from `TwoColumnsMidExpanded` to `MidColumnFullScreen` to match — the Detail page now opens full-screen by default, with the option to return to the split two-column layout.

## Master list Contact column masks contact info — 2026-08-07

- `formatter.masterContact()` now unconditionally returns the literal string `*****` instead of the contact's full name or an em-dash (the previous `orDash(sFullName)` call is commented out, and the Master list doesn't pass it any value regardless). Confirmed intentional (PII masking) — the Master list Contact column intentionally does not display real contact names, independent of whether `_SoldToPartyContactInfo` is available. **Open question**: the current implementation is a hardcoded literal, not a real masking transform — revisit if partial-reveal or per-record masking is ever needed.

## Master table personalization rework + Link navigation + column-variant management — 2026-08-19

Follow-up task list (5 items) applied to `Master.view.xml`/`Master.controller.js`/`i18n.properties`, building on the grid-table migration above. Item 5 (hard 100-record cap) was **explicitly deferred by the user** — not implemented in this pass; the `$top`/`$skip`/`$apply` research from the earlier `$top` crash fix still applies and remains the starting point when this is picked up (no fully-safe client-side mechanism was found — see the `$top` correction entry above).

- **Item 1 — standard p13n personalization dialog (sort + group enabled)**: replaced the hand-rolled `sap.m.Dialog`/`sap.m.List`/`CheckBox`/move-up-down-button column dialog (`onMasterTablePersonalize`/`_createColumnDialog`/`_onMoveColumn`/`_applyColumnDialog`) with `sap.m.p13n.Popup` + `sap.m.p13n.SelectionPanel`/`SortPanel`/`GroupPanel` (verified live via the official UI5 1.151 API reference — available since 1.96/1.97, not deprecated). Deliberately **not** `sap.m.p13n.Engine` + `SelectionController`/`SortController`/`GroupController`: those are abstract base classes meant to be subclassed per control type for `sap.ui.fl`-backed, cross-control persistence — overkill and unverified for this app, which has no live FLP flex backend and already has its own `VariantStore` persistence. Also deliberately **not** the deprecated `sap.m.P13nDialog`/`P13nColumnsPanel` pattern shown by the user via the unrelated `lp2preq` project reference — confirmed via grep that every usage of that pattern in `lp2preq` is dead/commented-out code in `BaseController.js`, and that project is a completely different, older, OData V2 app (`lmco.ces.preq`) — not a live example to replicate.
  - State is layered onto the existing `_getColumnLayout()`/`_saveColumnLayout()` object (VariantStore key `masterTableLayout`) with two new optional fields: `layout.sort` (`{key, descending}`) and `layout.group` (`{key}`).
  - **Confirmed hard restriction (via `sap.ui.table.Table` API docs, 1.151)**: the table's native `enableGrouping`/`groupBy` group-header-row visualization is client-model-only — "Grouping does not work with OData models." True OData V4 group-header rendering would need `sap.ui.table.TreeTable` + `ODataListBinding#setAggregation` (data aggregation/`groupLevels`), a materially different control — out of scope here. "Group by" is therefore implemented as a **primary sort key** (`_buildSorters`): rows sharing the grouped value become contiguous, but there is **no visual group-header divider row**. This is a documented technical limitation, not a shortcut/guess.
  - Only columns with a real, single bindable server property (`sortPath` on the column def) are offered in the Sort/Group panels — `description`, `contact`, and `employeeResponsible` are excluded (formatter-composed/placeholder values, no clean single path to sort/group by).
  - `TODO-VERIFY`: the exact item property names expected by `SelectionPanel`/`SortPanel`/`GroupPanel#setP13nData`/`getP13nData` (`key`/`label`/`visible`/`position`/`sorted`/`descending`/`grouped`) were not published in the fetched API reference (only that the methods exist, not their parameter shape) — implemented per the standard mdc p13n item shape used across SAP samples; verify against the running app and adjust field names if the panels don't render/apply state as expected.

### Manual tweaks to `Master.view.xml` after the above (2026-08-19)

Applied directly by the user, not via an agent edit:

- `t:Table`: `visibleRowCountMode` `Interactive` → `Fixed`, `visibleRowCount` `12` → `10`, added `alternateRowColors="true"`, added `enableGrouping="true"`. Wrapping `VBox` `height` `100%` → `80%`.
- Effect on existing controller logic: with `visibleRowCountMode="Fixed"` there is no drag handle, so `onRowsUpdated`/`_persistVisibleRowCount` (which persists a user-dragged row count into the `masterTableLayout` variant) is now effectively dead code — harmless, just unreachable until/unless the mode is switched back to `Interactive`. `_bindMasterRows`'s `oTable.setVisibleRowCount(oLayout.rowCount || 12)` still runs and still works in `Fixed` mode (it's a one-time programmatic set, not tied to the interactive handle).
- `enableGrouping="true"` is a no-op as currently wired: `sap.ui.table.Table`'s native grouping needs both `enableGrouping` **and** a `groupBy` column/binding parameter, and this app never calls `setGroupBy()`/passes a `groupBy` parameter (item 1's "group" personalization is implemented as a sort-key, per the confirmed `enableGrouping` + OData-models restriction documented above) — so this flag currently has no visible effect and doesn't reintroduce the documented OData-incompatibility risk. Flagged for the user in case the intent was to test native grouping directly.
- **Item 2 — column-layout variant management**: added a second Select + Save As/Manage UI (toolbar of the grid table, next to the "Columns" button) mirroring the existing FilterBar search-variant pattern, backed by a new `VariantStore` key `masterColumnVariants` (distinct from the single active-layout entry under `masterTableLayout`). New controller methods: `_refreshColumnVariantsModel`, `onColumnVariantSelect`, `onColumnVariantSaveAs`, `onColumnVariantManage`.
- **Item 3 — Provider Order column navigation via Link**: removed `rowActionCount`/`<t:rowActionTemplate>`/`RowActionItem`/`onRowActionPress` entirely. The `requestId` column's cell template is now a `sap.m.Link` (imported `sap/m/Link`) whose `press` handler resolves the row's binding context and calls the existing `_navigateToOrder()` helper (reused, not duplicated).
- **Item 4 — Description column width**: `_getColumnDefs()`'s `description` entry changed from `"12rem"` to `"40rem"` initial width. Any already-persisted `VariantStore` layout with the old `12rem` width is left untouched (expected personalization behavior — user-saved widths win over the new default).
- i18n: added `p13nDialogTitle`, `p13nSelectionPanelTitle`, `p13nSortPanelTitle`, `p13nGroupPanelTitle`, `columnVariantLabel`, `columnVariantSaveDialogTitle`, `columnVariantManageDialogTitle`; removed `columnDialogTitle`/`moveUp`/`moveDown` (only used by the removed hand-rolled dialog).

