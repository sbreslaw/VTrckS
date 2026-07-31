# E008 UI5 Playbook — OData V4 on S/4HANA 2025 (on-prem)

**Purpose:** Frontend patterns for AI agents on E008. Replaces the legacy UI5 playbook for this project.
**Stack:** SAPUI5 delivered with S/4HANA 2025 (served by the system/FLP — verify exact version with `sap.ui.version` on the dev system; do not pin from memory), theme **Horizon** (`sap_horizon`), **OData V4 model**, freestyle cockpit + FE V4 List Report.
**Last Updated:** 2026-07-31 — living doc.

> ⚠️ Legacy patterns that do NOT apply here: `/Date(timestamp)/` parsing, `oModel.read()/create()/getProperty()` V2 calls, JSON/OData dual-mode detection, Vercel-hosted UI5 libraries, `sap_bluecrystal`, compatVersion 1.71. If you catch yourself writing any of these, you're following the wrong playbook.

---

## 1. Bootstrap & Local Dev

UI5 comes **from the system**, never a CDN:
```html
<script id="sap-ui-bootstrap"
    src="/sap/public/bc/ui5_ui5/resources/sap-ui-core.js"
    data-sap-ui-theme="sap_horizon"
    data-sap-ui-async="true"
    data-sap-ui-compatVersion="edge"
    data-sap-ui-resourceroots='{"cdc.vaccreq": "./"}'>
</script>
```
Local development uses **ui5-tooling with a proxy** to the dev system so the app at `localhost` talks to the real service (`ui5.yaml` → `fiori-tools-proxy` / backend middleware pointing at the dev host, SSO/basic auth per landscape). There is no mock server target in `package.json`. Week-1-only stub rule: see Onboarding §3.2.

### 1.1 Verified 2026-07-28 local setup

- Current dev host: `https://sapapp2dh1.cdc.gov:44300` (`sap-client=100`).
- For `frontend/cockpit`, `/resources` should be proxied from `https://sapapp2dh1.cdc.gov:44300/sap/public/bc/ui5_ui5`.
- Do **not** proxy `/test-resources` from that host for sandbox runs on this landscape. `sap/ushell/bootstrap/sandbox.js` is not available there and local sandbox boot fails with `sap is not defined` follow-on errors.
- For `start-local`, let UI5 tooling serve `/test-resources` locally while proxying `/resources` and `/sap` only.
- Internal TLS trust is incomplete on this workstation; local-only configs may need `ignoreCertErrors: true` to talk to the dev host.
- The current local metadata snapshot is `frontend/cockpit/webapp/localService/metadata.xml`, sourced from `design/so.xml`.

### 1.2 Deployment on this landscape

- `fiori deploy` can generate `ui5-deploy.yaml`, but on this workstation it falls back to HTTP username/password auth.
- If the developer only has SNC logon and no ABAP password, do **not** assume CLI deploy is viable.
- Preferred path for this repo on the current landscape: build locally, then deploy the UI5 archive from an SNC-enabled SAP tool/session on the ABAP side, then maintain FLP content on-system.
- Keep repo secrets out of `.env`; interactive CLI prompts are acceptable for password-based systems, but they do not solve SNC-only landscapes.

## 2. Manifest & Model (V4)

```json
"sap.app": { "dataSources": { "mainService": {
  "uri": "/sap/opu/odata4/sap/zui_vaccinerequest_o4/srvd/sap/zui_vaccinerequest/0001/",
  "type": "OData", "settings": { "odataVersion": "4.0" } } } },
"sap.ui5": { "models": { "": {
  "dataSource": "mainService",
  "settings": { "operationMode": "Server", "autoExpandSelect": true, "groupId": "$auto" } } } }
```
- One default model, created by manifest. Do not also create it in Component.js.
- `autoExpandSelect: true` — bindings request only bound properties; add fields to views/`$select`, not by widening CDS.
- Updates batch under `$auto`; explicit `submitBatch` only for deliberate group control (e.g., the Save button uses an update group).

## 3. Core V4 Patterns

### 3.1 Contexts, not payloads
```javascript
// list binding + create (returns a context immediately; server round-trip async)
var oList = this.getView().byId("itemsTable").getBinding("items");
var oCtx  = oList.create({ Product: "", Quantity: null });
// read a property
oCtx.requestProperty("FundType").then(...);
// object page binding
this.getView().bindElement({ path: "/VaccineRequest(VaccineRequestID='0000012345')" });
```
Never build URLs by string concat; never bypass the model with fetch/AJAX.

### 3.2 Bound actions (cancel, resubmit, …)
```javascript
var oAction = this.getModel().bindContext(
    "com.sap.gateway.srvd.zui_vaccinerequest.v0001.cancelOrder(...)", oCtx);
oAction.setParameter("RejectionReason", sReason);
oAction.invoke().then(function () { /* refresh via side effects */ });
```
Action names come from `$metadata` — copy them, don't guess the namespace. Factory actions (copyOrder) return the new entity's context in the action result; navigate with it.

### 3.3 Side effects
Field interdependencies (Provider→address/contact, Quantity→FundType) are **annotated server-side**; the V4 model executes them. Manual `requestSideEffects` on a context is the exception (after custom flows), not the routine.

### 3.4 Field control → UI
Enablement/mandatory/hidden arrive as field-control metadata from the RAP feature handler. Bind with the standard mechanisms (`Core.FieldControl` annotation paths / FE building blocks where used). **Never** mirror status logic in a controller — Onboarding guardrail 5.

### 3.5 ETag / 412 handling (no draft!)
Every update/action carries If-Match automatically. Handle failure centrally:
```javascript
// in a message/technical error handler
if (oError.status === 412) { MessageBox.warning(oBundle.getText("orderChangedReload"),
  { actions: [MessageBox.Action.OK], onClose: () => oCtx.refresh() }); }
```
Plus a client-side unsaved-changes guard on navigation (`hasPendingChanges()` on the model/binding → confirm dialog).

### 3.6 Messages
Use `sap/ui/core/Messaging` + `MessagePopover`; backend messages arrive with element targets — the SectionFactory maps a target path to its panel and auto-expands it before setting focus (Onboarding testing checklist item).

### 3.7 Dates & types
V4 uses ISO Edm.Date/DateTimeOffset with UI5 type system (`sap.ui.model.odata.type.*` bound automatically). Delete any `/Date(...)/` regex on sight.

## 4. E008-Specific UI Patterns

### 4.1 FCL shell
`sap.f.FlexibleColumnLayout` + `FlexibleColumnLayoutSemanticHelper`; routes: list (begin) → cockpit (mid) → drill-in (end). The cockpit is never squeezed: use layouts that keep the mid column ≥ 60% when editing (`TwoColumnsMidExpanded`), full-screen action available.

### 4.2 Panel stack + SectionFactory
Detail screen = vertical `sap.m.Panel`(expandable) stack, one per functional area, order/visibility from the **section list the service exposes** (resolver output) — the factory reads it, instantiates section fragments lazily on first expand, wires each to the common section contract (init-with-context, contribute-validation, receive-messages). Sticky anchor strip above the stack; expand/collapse state persisted per user+order type (personalization service). Section-level actions live on the panel `headerToolbar`.

### 4.3 sap.ushell guard (kept from legacy — still right)
```javascript
var oUser;
try { var c = sap.ui.require("sap/ushell/Container");
      oUser = c && c.getUser && c.getUser(); } catch (e) { /* standalone */ }
if (!oUser) { oUser = { getId: () => "LOCAL_USER", getFullName: () => "Local User" }; }
```
Standalone runs (ui5-tooling serve) have no FLP; production runs inside FLP. Guard every ushell access. Note: user identity is display-only in the client — authorization is entirely server-side (DCL + instance auth).

### 4.4 System availability (kept, V4-flavored)
Keep the named `AppData` JSON model initialized with defaults (`SystemAvailable: true`) so the shell renders before first data; flip it from the model's `dataReceived`/error events, not from a custom ping.

### 4.5 List Report
FE V4 app: filter operators, variants, export come from annotations — resist writing code there; extensions only via the FE V4 extension points if genuinely needed, and log why.

## 5. Troubleshooting (V4/E008)

| Symptom | Likely cause | Fix |
|---|---|---|
| Empty list, no error | **DCL jurisdiction filter** — test user has no Sales Office auth | Check PFCG values, not the query |
| Property missing at runtime | `autoExpandSelect` — field not bound anywhere | Bind it or add to `$select`; don't disable autoExpandSelect |
| Action 404 | Guessed namespace in `bindContext` | Copy the exact name from `$metadata` |
| 412 on save | Stale ETag (someone saved first) | Central 412 handler → refresh dialog (3.5) |
| Changes not sent | Pending in an update group | Check `groupId`; `submitBatch` for deliberate groups |
| Table in hidden container empty | Binding suspended while invisible | Bind/resume after visibility flips (legacy lesson, still true) |
| CORS/auth weirdness locally | Proxy misconfig | Fix `ui5.yaml` proxy; never route via external hosts |
| Blank screen | AppData defaults missing / visibility expression | Initialize defaults first (4.4) |
| `sap-ui-core.js` 400/404 locally | Incorrect `/resources` proxy mapping to SAP host | Proxy `/resources` from `/sap/public/bc/ui5_ui5`; verify on the active localhost port |
| `sandbox.js` 404 locally | `/test-resources` incorrectly proxied to SAP host | Serve `/test-resources` locally for sandbox runs |
| `sap is not defined` from `locate-reuse-libs.js` | UI5 bootstrap or sandbox bootstrap failed earlier | Fix `sap-ui-core.js` / `sandbox.js` first; the JS error is secondary |
| `400 Bad Request` on `EntitySet('key')/.` | A control is bound to `path: "."` (whole entity/row) instead of a concrete property | Bind explicit `ServiceSchema.*` property paths/`parts`; formatters take plain values, not a row object |
| `encountered unknown setting 'X' for class sap.ui.comp.filterbar.FilterBar` | Property copied from the different `sap.ui.mdc.FilterBar` control | Check the actual `sap.ui.comp.filterbar.FilterBar` API (e.g. `showFilterConfiguration`, not `showAdaptFiltersButton`) before using a property name |
| App-level busy overlay never clears | Code that flips `appView>/busy` back to `false` is missing/commented out, or calls V2-only APIs (`metadataLoaded()`, `attachMetadataFailed`) that don't exist on the V4 model | Clear busy via `getModel().getMetaModel().requestObject("/")`.then/.catch on the V4 model |
| Same fragment/section content rendered twice | Race in a lazy-load guard: the "loaded" flag is only set inside the async `.then()`, so two near-simultaneous calls (e.g. `onAfterRendering` and a route-matched `rebind()`) both start a load | Set the "loaded"/"loading" flag synchronously *before* the async call, not after it resolves |

## 6. Agent Workflow

1. Read Onboarding + this playbook + the view/controller you're touching + relevant spec section.
2. Confirm which phase (MVP-1/MVP-2/v1.1) the task belongs to; don't build ahead of phase without approval.
3. Implement smallest change; run against dev service; console clean; checklist from Onboarding §6.
4. Update affected docs. State what changed, why, and anything needing on-system action.

## 7. Phase 2 Focus (starting 2026-07-31)

Phase 1 (read-only prototype: FCL shell, master/detail routing, filterable list, panel sections, all live against the temporary standard V4 service) is complete and stable — see `NOTES.md` for the stabilization bug list. Phase 2 reshapes the UI to match customer requirements for two areas:

- **Search** — the Master-view filter bar (`sap.ui.comp.filterbar.FilterBar` in `Master.view.xml` / `Master.controller.js`).
- **Content** — the Detail-view panel sections (`sections/*.fragment.xml` + `SectionFactory.js`).

Before changing either: confirm which fields/entity sets the customer requirement needs are already exposed by the current service via `ServiceSchema.js`; if something is missing, file a backend request rather than working around it client-side (Onboarding §5).
