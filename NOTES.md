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
