# CRUD Task 1 — v5 Amendment: Sticky-Session Reality (supersedes v4 + Fix-Sequencing order where they conflict)

**Verified facts (agent metadata find + live confirmation):** `C_SALESORDERMANAGE_SRV` is a sticky-session service (`SAP__session.StickySessionSupported`). Action quartet present: `CreateWithSalesOrderType` (opens create session; returns buffered order, `SalesOrder=""`), `PrepareForEdit`, `SaveChanges` (commits + late-numbers), `DiscardChanges`. Nothing persists before `SaveChanges`.

## Voided assumptions (Claude correction #4 — ledger)
- No skeleton order exists pre-commit → orphan/aged-skeleton question VOID; abandonment = session timeout, zero residue.
- Cancel ≠ DELETE; failure/cancel after the create action = **DiscardChanges**.
- Request ID displays only after SaveChanges (late numbering at commit).
- Provider-first bootstrap mandate DROPPED — the scratch-context + replay architecture (current code) is accepted as the design. All-fields-editable-immediately stands.

## Accepted architecture (current CreateOrderService, with fixes below)
scratch transient (never submitted) → Save: ① CreateWithSalesOrderType ② item creates on the session context (nav binding) ③ SaveChanges → real ID ④ header-extras replay PATCH ⑤ enrich (stub until backend) ⑥ IoH (stub until backend). Failure before ③ = nothing persisted; after ③ = order exists, complete via change mode.

## Required fixes (this is the work order)
1. **Group isolation:** create replay must NOT run in `vrEdit`. Dedicated `vrCreateReplay` group (manifest-registered) OR block create entry while `hasPendingChanges("vrEdit")` — implement the dedicated group; add grep DoD: `vrEdit` only in change-mode paths.
2. **Session hygiene:** on any failure after the create action succeeds and before/at SaveChanges → invoke `DiscardChanges` on the session context in the cleanup path. Add `ServiceSchema.discardAction` (qualified name from $metadata). Also call it for user Cancel if Save already started and failed mid-way.
3. **Prove sessionless PATCH persists** (load-bearing for step ④ AND all of change mode): live test — set Priority during create, finish, hard-refresh + VA03 check. Record verdict in NOTES. If it does NOT persist: wrap step ④ and EditRequestService.save() in `PrepareForEdit` … `SaveChanges` brackets (session-based edit), and re-test 412 behavior in that shape.
4. **Replay-list drift guard:** comment block in Details/OrgData/Shipping fragments: "adding an editable createMode field REQUIRES adding it to ServiceSchema.createReplayHeaderProperties"; add a DoD grep pairing check.

## Verification trace (replaces the seven-line trace)
Create click → 0 requests · fill everything incl. items → 0 requests · Save → ①②③ in sequence (network tab), ID appears after ③, ④ persists extras (VA03 check) · Cancel pre-Save → 0 backend artifacts · forced failure at ② or ③ → DiscardChanges observed, nothing in VBAK, messages in MessagePopover · pending-edit-then-create scenario → no vrEdit changes ride the create batch.
