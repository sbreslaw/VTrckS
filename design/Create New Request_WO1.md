# Copilot Work Order — Implement "Create New Request" (CRUD Task 1)

**Spec:** `design/E008_CRUD1_Create_Prompt.md` (v2 — OrderCreate action architecture) is the authoritative specification; this work order operationalizes it file-by-file. Also read `AGENT_ONBOARDING.md`, `UI5_AGENT_PLAYBOOK.md`, `NOTES.md` before starting. On any conflict: the v2 spec wins; log the conflict in NOTES.

## Step 0 — Reconcile current state (do this before any edit; record deltas in NOTES)
Verify each assumption; where false, adapt and note:
- [ ] Master list is `sap.ui.table.Table` (rows binding) inside the VBox wrapper; toolbar has **Create** (placeholder toast, `// TODO(CRUD)` marker) and **Refresh** buttons.
- [ ] `model/ServiceSchema.js` exists with the isolation pattern; `fixedOrderTypes` contains `ZKB` (if still `ZVR1`, fix it now — known lesson).
- [ ] `model/Enums.js` does NOT yet exist (this task creates it). If it exists, extend, don't duplicate.
- [ ] No `PAYLOAD_CONTRACT.md` at repo root yet.
- [ ] Check `$metadata` of the dev service for: the OrderCreate action (name/params — see §2), a SoldToParty/provider value-help entity, `ZZ_*` value-help entities (`ZZ_ContactVH`-like, NDC VH) — record what exists; pending ones get the disabled+tooltip pattern.

## Files to CREATE

### 1. `webapp/model/Enums.js`
AMD module exporting key/text arrays (texts via i18n keys, not literals):
`PRIORITY` [NORMAL, HIGH] · `ORDER_REASON` [NATURAL_DISASTER, OUTBREAK_RESPONSE, OTHER] · `CATEGORY` [INTERNET_SALES, PROVIDER_EMAILED, PROVIDER_FAXED, PROVIDER_TELEPHONED, VACMAN] · `INTENTION` [ADULT, PED_AND_ADULT (default), PEDIATRIC] · `MIN_ITEMS = 1`.
Every list carries `// TODO: replace with backend value help; keys pending config confirmation`.

### 2. `webapp/service/CreateRequestService.js`
One AMD module, no UI references. Public API:
- `buildPayload(oDialogData)` → `{provider, description, contactId?, priority?, orderReason?, category?, exisId?, items:[{ndc, quantity, uom:"EA", intention}]}` — omit empty optionals; single mapper function so a contract change is one edit.
- `create(oModel, oPayload)` → Promise resolving `{salesDocument, messages}` / rejecting `{messages}`.
  - Discover the action from `$metadata` (constant for the qualified name in ServiceSchema with `// TODO-VERIFY`); support both parameter shapes per spec: structured parameter (set fields individually) vs. single string parameter (`JSON.stringify(oPayload)`). Detect by parameter type at runtime or via a ServiceSchema flag set after step-0 inspection. Invoke via `oModel.bindContext("/<ActionName>(...)")` + `setParameter` + `invoke()`; extract result key + messages from the returned context / message model.
- Header comment: create bypasses the client draft protocol via the server-side action (ledger note — gate item #1 now applies to edit flows only).

### 3. `webapp/view/fragments/CreateRequestDialog.fragment.xml` + `webapp/controller/CreateRequestDialog.js`
Dialog per spec §Dialog content, bound to a local JSON model (`createModel`), controller as a standalone handler object owned by Master:
- General Data form: Provider (required; value help if VH entity found in step 0, else Input + pending tooltip; on valid selection fetch + show read-only Provider Address via the partner/VH association — display only), Description (required Input), Contact (optional; `ZZ` contact VH if present — filtered by selected provider, cleared on provider change — else disabled+tooltip), Priority/Order Reason/Category (`Select`s over Enums, optional, with an empty "—" item), ExIS ID (optional Input).
- Items table (`sap.m.Table`, local model rows): NDC (VH if present else Input), Quantity (Input type Number, required per row, >0), UOM read-only text "EA", Intention Select (default PED_AND_ADULT); Add Row / row delete; Create disabled or validation-blocked until `MIN_ITEMS` valid rows.
- Validation before invoke: Provider, Description, item count, per-row quantity → valueStates + `MessageStrip`.
- Busy state during create; action messages rendered in the dialog (map `target`→field valueState where provided); Cancel/Escape = close, no side effects.

### 4. `PAYLOAD_CONTRACT.md` (repo root)
The request/response shape from §2, status line **UNCONFIRMED — pending backend sign-off** (flip to CONFIRMED with date when backend answers). Note description→VBAK-KTEXT mapping is backend-side.

## Files to MODIFY
- `Master.controller.js`: replace the Create placeholder handler — lazy-load fragment + controller once, open; on service success: close, i18n toast with Request ID, `getBinding("rows").refresh()`, navigate to detail route (key incl. `IsActiveEntity=true`).
- `ServiceSchema.js`: add `orderCreateAction` constant (TODO-VERIFY name) + `writableHeaderProperties` block (payload field names) — keep the isolation grep clean (entity/action names only here).
- `i18n/i18n.properties`: all new labels, tooltips, messages, enum texts.
- `PHASE2_AUDIT.md` / `NOTES.md`: step-0 deltas; action shape found; status read-back assertion after first successful create (expect 1A from ZKB status profile — report as config gap if absent, never set client-side); backend dependency list (action contract, ContactVH, NDC VH, enum keys); the gate-evidence paragraph per spec.

## Order of work
Step 0 → Enums → ServiceSchema additions → CreateRequestService (with a temporary mock resolve for offline dev, removed before DoD) → fragment + dialog controller → Master wiring → i18n → live verification → contract file → docs.

## Definition of done (from the v2 spec — all apply)
Happy path live against dev (dialog → real ZKB order → toast → detail opens); forced-failure path shows in-dialog messages then succeeds after correction; ≥1-item rule enforced; UOM="EA" sent; Intention default correct; no draft artifacts introduced anywhere (grep); contract file committed; audits updated; i18n complete; console clean; keyboard-complete dialog incl. items table.
