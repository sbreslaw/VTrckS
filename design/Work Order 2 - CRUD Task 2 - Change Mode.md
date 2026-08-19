# Copilot Work Order — CRUD Task 2: Change Mode (Per-Section Edit via Draft Protocol)

**Prepared in advance — first prompt cut from `PROMPT_TEMPLATE.md`. Not to be run until CRUD Task 1 (Create) is merged and verified.** Collaborative-agent density: files and contracts pre-decided; implement, don't re-decide.

## 1. AUTHORITY
Read first: `AGENT_ONBOARDING.md`, `UI5_AGENT_PLAYBOOK.md`, `NOTES.md`, `PAYLOAD_CONTRACT.md`, this file. Authoritative on conflicts: this work order, then the onboarding guardrails. Scope guard: Detail view + a new edit service module only — **no changes to Master, Create flow, SectionFactory's factory mechanics, or ServiceSchema's read mappings.** This task implements field *edits*; Cancel/Copy/Return/Replacement/Un-cancel are commands and belong to later tasks (decision rule on record: commands = actions, edits = CRUD).

**Ledger note for the module header:** this task is the real test of gate item #1 — the draft protocol lands in the client here, unavoidably.

## 2. STEP-0 RECONCILE (extra weight — this prompt was written ahead of time)
- [ ] Create flow merged: `CreateRequestService.js`, `Enums.js`, dialog present; note any API drift.
- [ ] `$metadata` inventory (record exact qualified names in NOTES): the standard draft actions on the order entity — Edit, Activate, Discard, Prepare if present; `DraftAdministrativeData` navigation; which header properties are **updatable** (check `Core.Immutable`/update restrictions): expect Priority, Order Reason, ExIS ID (PurchaseOrderByCustomer) writable; Category per its landed mapping; **Description (ZZ_/KTEXT): expect NOT writable** — ZZ view-extension elements carry no write mapping in SAP's behavior. Verify, don't assume, then apply the degradation below.
- [ ] `sectionFlags` model + per-section Edit buttons exist (Phase-2 stubs, disabled).
- [ ] Message-to-panel auto-expand machinery works (Phase-2 deliverable) — the activation error path depends on it.
- [ ] ZZ read fields live (Description/Contact/ER columns bound) or still em-dash — affects which Details fields render at all.
- [ ] Backend dependency check: has an UpdateDescription/OrderUpdate micro-action shipped? (Companion ask below.) If yes, record its name; if no, Description stays read-only in edit mode.

## 3. THE WORK

### Edit model (settled — implement exactly)
- **One section in edit at a time.** Pressing Edit on section A disables Edit on all others until Save/Cancel. This matches the requirement ("each section edited separately") and honestly reflects the backend truth: there is **one order-wide draft**, not per-section drafts — serializing sections prevents the lie of independent section saves.
- **Flow per edit session:** Edit press → invoke the standard **Edit action** on the order context (creates the edit draft; on failure — e.g., foreign draft exists — surface the message incl. locked-by user from DraftAdministrativeData, stay in display) → rebind the detail context to the **draft instance** (key `IsActiveEntity=false`) → unlock that section's fields per the updatable-map → user edits (PATCH via context `setProperty`, update group `vrEdit`, submit on Save) → **Save** = `submitBatch` + **Activate action** → rebind to active instance, refresh master row, toast → **Cancel** = **Discard action** → rebind to active, no residue.
- **Failure semantics:** activation errors render via the message model, panel-anchored with auto-expand + field valueStates; the draft survives for correction (user retries Save or Cancels → Discard). App/browser death mid-edit leaves an SAP-managed draft; on next Edit press the Edit action's foreign/own-draft response governs — **resume own draft silently** (rebind to it) — document the observed behavior in NOTES; no custom orphan cleanup is built (SAP owns draft lifecycle on their BO — note this as an accepted bridge cost in the gate paragraph).
- **Concurrency:** 412/etag on the Edit action or Activate → existing reload-dialog pattern.

### Files to CREATE
**`webapp/service/EditRequestService.js`** — ALL draft mechanics quarantined here (grep DoD below). Public API mirrors the create module's style: `startEdit(oContext)` → Promise(draft context) · `save(oDraftContext)` → Promise(active context) · `cancel(oDraftContext)` → Promise · `isDraftForeign(oError|oAdminData)` helper. Action names via ServiceSchema constants filled from Step-0 (`// TODO-VERIFY` until recorded). Header comment: gate item #1 implementation; future note — when create converts to draft-free CRUD on the custom service, this module is deleted wholesale, which is the point of the quarantine.

### Files to MODIFY
- **`sections/SectionFactory.js` + `Detail.controller.js`:** Edit buttons go live for the **in-scope sections only — Details and Items**; all other sections' Edit stays disabled (tooltip: later phase). `sectionFlags` computed client-side for now: `editEnabled = !anotherSectionEditing && orderStatusAllowsEdit()` — status rule stubbed permissive with `// TODO: resolver feed`; Save/Cancel buttons appear in the editing section's headerToolbar during its session.
- **`sections/Details.fragment.xml`:** editable controls (Input/Select bound two-way to the draft context) for the Step-0-verified updatable set — expected: Priority (Enums), Order Reason (Enums), Category (per mapping), ExIS ID. **Description: read-only + tooltip "editing available with backend update action"** unless Step-0 found the micro-action (then wire it as a follow-up save step, one function). Contact/Employee Responsible: read-only this task (partner-change writability unverified — deferred, listed below).
- **`sections/Items.fragment.xml`:** edit session unlocks **Quantity** (Input, >0) on existing rows and enables **Add Item** (row: NDC input/VH, Quantity, Intention select — created via the draft context's item navigation binding). **No row delete this task** — item removal is the cancellation command (ABGRU semantics), out of scope; hide/disable any delete affordance with tooltip.
- **`ServiceSchema.js`:** `draftActions` block (edit/activate/discard qualified names), `updatableHeaderProperties` map from Step-0.
- **`i18n`**, **`PHASE2_AUDIT.md`**, **`NOTES.md`**, **`OPEN_QUESTIONS.md`** per §5.

### Backend companion asks (list in audit; none block the build)
1. UpdateDescription/OrderUpdate micro-action (KTEXT write path for change mode) — same callable-core discipline as OrderCreate.
2. Confirmation which of Category/Priority/Reason landed as standard-writable vs. needs the action.
3. Partner-change (Contact/ER) writability ruling — informs the deferred scope.

## 4. DEFINITION OF DONE
- Live on dev: edit Details (each writable field) → Save → values persist on the active order and in the master list; edit Items quantity + add an item → Save → order reflects both; Cancel mid-edit → zero changes persist, no draft remains bound in the UI.
- Error path proven: force an activation failure → message anchored to the right panel/field with auto-expand → correct → Save succeeds.
- Foreign-draft path: second user/session editing → Edit press surfaces locked-by message, display mode preserved.
- Serialization proven: while section A edits, section B's Edit is disabled; after Save/Cancel it re-enables.
- **Grep checks:** draft artifacts (`IsActiveEntity=false` handling, draft action names, DraftAdministrativeData) appear ONLY in `EditRequestService.js` + ServiceSchema constants; no draft concept leaks into fragments/controllers beyond calling the service API. i18n complete; console clean; keyboard pass incl. edit-mode controls and Save/Cancel reachability.

## 5. EVIDENCE OBLIGATIONS
- NOTES: Step-0 inventory (action names, updatable map, Description writability verdict); observed own-draft-resume and mid-edit-crash behavior; **the gate-item-#1 paragraph** — neutral, concrete: LoC of EditRequestService, edge cases hit (foreign drafts, activation message shapes, rebind quirks), and a one-line judgment on the client-side draft cost now that it's real. This paragraph is primary evidence for the MVP-2 architecture gate — write it as if both camps will read it, because they will.
- OPEN_QUESTIONS: partner-change ruling; Description action status; any updatable-map surprises.
- PHASE2_AUDIT: task entry + deferred list (partner edits, other sections' edit, row delete→cancel command).
