# CRUD Task 1 — v5 Amendment: Sticky-Session Reality (supersedes v4 + Fix-Sequencing order where they conflict)

**Verified facts (agent metadata find + live confirmation):** `C_SALESORDERMANAGE_SRV` is a sticky-session service (`SAP__session.StickySessionSupported`). Action quartet present: `CreateWithSalesOrderType` (opens create session; returns buffered order, `SalesOrder=""`), `PrepareForEdit`, `SaveChanges` (commits + late-numbers), `DiscardChanges`. Nothing persists before `SaveChanges`.

## Voided assumptions (Claude correction #4 — ledger)
- No skeleton order exists pre-commit → orphan/aged-skeleton question VOID; abandonment = session timeout, zero residue.
- Cancel ≠ DELETE; failure/cancel after the create action = **DiscardChanges**.
- Request ID displays only after SaveChanges (late numbering at commit).
- Provider-first bootstrap mandate DROPPED — the scratch-context + replay architecture (current code) is accepted as the design. All-fields-editable-immediately stands.

## Accepted architecture (current CreateOrderService, with fixes below)
scratch transient (never submitted) → Save: ① CreateWithSalesOrderType ② item creates on the session context (nav binding) ③ SaveChanges → real ID ④ header-extras replay PATCH ⑤ enrich (stub until backend) ⑥ IoH (stub until backend). Failure before ③ = nothing persisted; after ③ = order exists, complete via change mode.

## UX phasing + triad sourcing (customer-preferred refinement, rides on v5 unchanged)
- **Phased entry as pure UI gating:** createMode opens with only Provider enabled; on selection, Provider locks (tooltip: cancel to change) and all other fields/items unlock. Implemented as `enabled` bindings on a `createState>/providerChosen` flag over the SAME scratch context — Save's ①–④ choreography is untouched. No early session, no bootstrap step.
- **Sales-area triad from the picker, not constants:** the Provider value help is the `C_SoldToSalesAreaVH` F4 service (per the ValueListReferences finding) — KNVV-shaped, each row = provider × sales area. Harvest `SoldToParty` + `VKORG/VTWEG/SPART` from the selected row into the scratch data; these feed the CreateWithSalesOrderType parameters at Save. Providers extended to multiple areas appear as multiple rows — display the area columns for disambiguation; optionally pre-filter by expected VKORG. This makes the "sold-to not defined for sales area" failure class unconstructible.
- **Constants demoted, not deleted:** ServiceSchema `salesArea` values become default-filter + fallback only (if the VH row lacks area columns — verify that entity's $metadata), still `TODO-VERIFY(B4)`; the debug values 1000/10/10 are explicitly non-final.
- **TS-B2.3 spec note (record now):** the future jurisdiction-scoped `ZI_VR_PROVIDERVH` MUST also return the triad columns, or this determination source is silently lost at the swap.

## Required fixes — outcomes are fixed, mechanisms are negotiable (this is the work order)
1. **Cross-flow contamination excluded (outcome fixed, mechanism free):** stale `vrEdit` pending changes must never ride a create-flow submit (reachable scenario: FCL Detail in edit with pending changes → Master Create). Acceptable mechanisms, agent's choice: (a) demonstrate an existing dirty-guard makes the scenario unreachable (NOTES assertion + test), (b) add a one-line entry guard `hasPendingChanges("vrEdit") → block create with message`, or (c) dedicated replay group. (a)/(b) require zero changes to the working save mechanics — preferred if valid.
2. **Session hygiene:** on any failure after the create action succeeds and before/at SaveChanges → invoke `DiscardChanges` on the session context in the cleanup path. Add `ServiceSchema.discardAction` (qualified name from $metadata). Also call it for user Cancel if Save already started and failed mid-way.
3. **Prove sessionless PATCH *persists*, don't presume it** (load-bearing for step ④ AND change mode): one live test — set Priority during create, finish, hard-refresh + VA03 check; NOTES records the verdict. Note the distinction: "confirmed working" must mean survives-refresh, not 200-in-network-tab. Evidence it will pass: the agent's own `Core.OptimisticConcurrency` finding (ETags are meaningless inside sticky sessions — their presence implies sessionless updates are contemplated). Only a FAILING test triggers the conditional restructure (`PrepareForEdit`…`SaveChanges` brackets for step ④ and EditRequestService, with 412 re-test).
4. **Replay-list drift guard:** comment block in Details/OrgData/Shipping fragments: "adding an editable createMode field REQUIRES adding it to ServiceSchema.createReplayHeaderProperties"; add a DoD grep pairing check.

## Verification trace (replaces the seven-line trace)
Create click → 0 requests · fill everything incl. items → 0 requests · Save → ①②③ in sequence (network tab), ID appears after ③, ④ persists extras (VA03 check) · Cancel pre-Save → 0 backend artifacts · forced failure at ② or ③ → DiscardChanges observed, nothing in VBAK, messages in MessagePopover · pending-edit-then-create scenario → no vrEdit changes ride the create batch.
