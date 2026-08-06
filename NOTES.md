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

## Live-backend regression: `_SoldToPartyContactInfo` crashes on master list — 2026-08-03

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



