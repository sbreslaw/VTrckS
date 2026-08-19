# Copilot Work Order — CRUD Task 2 v2: Change Mode (Per-Section Edit, PATCH + ETag) — supersedes v1

**v2 rationale:** `R_SalesOrderTP` BDEF verified in ADT — *unmanaged, NO DRAFT, late numbering, lock master, etag master LastChangeTime*. v1's draft choreography (Edit/Activate/Discard, DraftAdministrativeData, IsActiveEntity keys) is void. Edit = plain PATCH against the active entity; concurrency = ETag/412. Prepared ahead of time — run only after CRUD Task 1 (Create) is merged.

## 1. AUTHORITY
Read: `AGENT_ONBOARDING.md`, `UI5_AGENT_PLAYBOOK.md`, `NOTES.md`, `PAYLOAD_CONTRACT.md`, this file. Conflicts: this work order wins; log in NOTES. Scope guard: Detail view + one new edit service module. No changes to Master, Create flow, SectionFactory mechanics, ServiceSchema read mappings. Edits only — Cancel/Copy/Return/Replacement/Un-cancel are commands (actions), later tasks.

## 2. STEP-0 RECONCILE
- [ ] Create flow merged; note API drift.
- [ ] `$metadata` inventory (record in NOTES): **updatable header properties** (check update restrictions/Immutable): expect Priority, Order Reason, ExIS ID writable; Category per its landed mapping; **ZZ_Description expected NOT updatable** (view-extension element — verify; if a backend UpdateDescription micro-action shipped, record its name, else Description stays read-only in edit mode). Item updatability: Quantity; item create-by-association availability on the active entity.
- [ ] Confirm NO draft markers in metadata (IsActiveEntity/DraftAdministrativeData/Edit-Activate-Discard) — expected absent per the BDEF finding; if any appear, STOP and escalate (would contradict the verified header).
- [ ] `sectionFlags` model + Edit button stubs present; message-to-panel auto-expand works.
- [ ] Value-help entities live or pending (affects which edit controls get VHs vs. plain inputs).

## 3. THE WORK

### Edit model (settled)
- **One section in edit at a time** — serialized, per the customer requirement ("each section edited separately") and honest save semantics; NOT a draft artifact, keep it.
- **Flow:** Edit press → snapshot current values (for Cancel) → unlock that section’s fields (two-way binding on the existing order context, update group `vrEdit`, deferred) → **Save** = `submitBatch("vrEdit")` → success: toast, section back to display, master row refreshes → **Cancel** = `oModel.resetChanges("vrEdit")` + section back to display. No server round trip on entering edit; no artifacts to clean up on abandon — a closed browser mid-edit loses only unsent local changes.
- **Concurrency:** every PATCH carries If-Match automatically; **412** on submit → existing reload dialog (refresh context, section back to display, user re-edits). There is no pre-edit lock or locked-by warning to build — `lock master` guards backend modify processing only; document this expectation in NOTES so nobody “fixes” it later.
- **Failure semantics:** backend errors on submit render panel-anchored with auto-expand + field valueStates; the edit session stays open for correction (changes remain pending in the group) — user fixes and re-saves, or Cancels (resetChanges).

### Files to CREATE
**`webapp/service/EditRequestService.js`** — thin by design (the v1 draft machinery is gone; keep the module anyway for symmetry, testability, and the update-group discipline): `beginEdit(oContext, sSectionId)` (snapshot + flag bookkeeping) · `save(oContext)` → Promise (submitBatch + message extraction + 412 detection) · `cancel(oContext)` (resetChanges + flags). Header comment: cites the BDEF verification (unmanaged/no-draft) and the NOTES correction entry; notes gate item #1 was deleted on this evidence.

### Files to MODIFY
- **`SectionFactory.js` + `Detail.controller.js`:** Edit live for **Details and Items** only; others disabled (tooltip: later phase). `sectionFlags.editEnabled = !anotherSectionEditing && statusAllows()` (permissive stub, `// TODO: resolver feed`). Save/Cancel in the editing section’s headerToolbar.
- **`Details.fragment.xml`:** editable controls for the Step-0-verified updatable set (Priority/Order Reason via VH entities if live, else Enums; Category per mapping; ExIS ID Input). Description read-only + tooltip unless the update micro-action exists (then wire as an additional save step, one function). Contact/ER read-only (partner-change ruling pending — OPEN_QUESTIONS).
- **`Items.fragment.xml`:** edit session unlocks **Quantity** on rows; **Add Item** creates via the items list binding in group `vrEdit` (NDC VH/input, Quantity, Intention with NDC-default logic per TS-B2.2). **No row delete** — item removal = cancellation command, out of scope; disabled affordance + tooltip.
- **`ServiceSchema.js`:** `updatableHeaderProperties` map from Step-0. **No draftActions block — if one exists from earlier prep, delete it.**
- `i18n`, `PHASE2_AUDIT.md`, `NOTES.md`, `OPEN_QUESTIONS.md` per §5.

### Backend companion asks (non-blocking)
1. UpdateDescription/OrderUpdate micro-action (KTEXT write path) — reusing OrderCreate’s core per the callable-core decision.
2. Ruling: which of Priority/Reason/Category are standard-updatable vs. need the action (Step-0 verifies technically; functional ruling on *allowed* changes post-creation belongs to the matrix/E006 conversation — record both).
3. Partner-change (Contact/ER) writability ruling.

## 4. DEFINITION OF DONE
- Live on dev: edit each writable Details field → Save → persists (list + SE16 spot check); Items quantity edit + add item → Save → both persist; Cancel mid-edit → zero changes persist, bindings clean (`hasPendingChanges("vrEdit")` false).
- 412 path proven: modify the order via VA02 in a second session mid-edit → Save → reload dialog → re-edit succeeds.
- Error path proven: force a backend rejection → panel-anchored message with auto-expand → correct → Save succeeds.
- Serialization proven: section B’s Edit disabled while A edits; re-enables after Save/Cancel.
- **Grep checks:** zero draft vocabulary anywhere (IsActiveEntity, DraftAdministrativeData, draftActivate/Edit/Discard) outside NOTES’ historical correction entry; update-group handling only in EditRequestService + fragments’ bindings. i18n complete; console clean; keyboard pass incl. Save/Cancel reachability.

## 5. EVIDENCE OBLIGATIONS
- NOTES: Step-0 updatable map + micro-action status; observed 412 behavior and lock-master expectation note; **replacement for the old gate paragraph** — one short entry: edit implemented as plain PATCH/ETag, LoC of EditRequestService, judgment line on client complexity (expected: trivial). This entry closes the book on deleted gate item #1 with implementation evidence.
- OPEN_QUESTIONS: partner-change ruling; post-creation change-allowance matrix (functional).
- PHASE2_AUDIT: task entry + deferred list (partner edits, other sections, row delete → cancel command).
