# Corrective Work Order — Create Flow Sequencing Fix (references CRUD1 Prompt v4)

The in-place create flow is mis-sequenced: the `CreateWithSalesOrderType` action currently rides inside the Save batch (and under the wrong group, `vrEdit`), so the changeset fails as a unit and every attempt shows the same generic toast. This work order corrects sequencing, grouping, gating, and message extraction. **Read `design/E008_CRUD1_Create_Prompt.md` (v4) first — it is authoritative; this order operationalizes its bootstrap flow.** Scope: create flow only; do not touch change-mode (`vrEdit` remains ITS group), Master, or backend contracts.

## Fix 1 — Bootstrap fires on Provider selection, alone, immediately
- Remove the action invocation from the Save handler entirely.
- New handler on Provider value-help confirmation (createMode only):
  1. Build the five parameters: `SalesOrderType` = ServiceSchema constant `ZKB`; `SalesOrganization` / `DistributionChannel` / `OrganizationDivision` = **new ServiceSchema constants** (`salesArea` block; seed with the values that worked in backend debugging, tagged `// TODO-VERIFY(B4): ZKB sales area`); `SoldToPartyForCreate` = selected KUNNR.
  2. Invoke via `oModel.bindContext("/<EntitySet>/<qualified action name>(...)")`, `setParameter` ×5, `invoke()` — **NOT in a deferred group**: use `$auto` (or a dedicated immediate group) so it round-trips now. `await` it; busy indicator on the view.
  3. Success → `oAction.getBoundContext()` is the created order; **rebind the Detail view to this context**; Request ID renders (late numbering); unlock all createMode sections.
  4. Failure → extract messages (Fix 4) into the MessagePopover; remain pre-bootstrap (Provider re-selectable); no partial state.

## Fix 2 — Group hygiene: `vrCreate` everywhere in createMode, `vrEdit` nowhere
- All createMode two-way bindings and item creates use **updateGroupId `vrCreate`** (deferred; register in manifest model settings if not present).
- Save = `submitBatch("vrCreate")` → then enrichment/IoH steps per v4 → exit createMode.
- Cancel post-bootstrap = `resetChanges("vrCreate")` + delete the skeleton context per v4; pre-bootstrap = navigate back.
- Grep DoD: `vrEdit` appears only in change-mode code paths; `vrCreate` only in create paths; no shared handlers submitting both.

## Fix 3 — Field gating pre-bootstrap
- In createMode before bootstrap: Provider enabled; every other input, the Items table toolbar, and IoH editing **disabled** (bind enabled to a `createState>/bootstrapped` flag) — there is no entity to bind them to yet, and local-value transfer is explicitly NOT to be built.
- After bootstrap: enable per the v4 section treatment (org/sales-area fields read-only — fixed by the action; Provider read-only with the tooltip "to change provider, cancel and start over").

## Fix 4 — Message extraction (the reason this bug took three debugging rounds)
- Implement the shared error extractor now: parse V4 action/batch error bodies — lead message + `details[]` with `target` — into `sap/ui/core/Messaging`; map targets to controls/sections where resolvable (existing panel auto-expand machinery); untargeted → popover-level entries. Kill the generic toast for backend failures.
- Apply to: bootstrap invoke, submitBatch, enrichment, IoH steps.

## Definition of done
- Click Create → view opens, only Provider active. Select provider → ONE network request (the action, own batch/direct), order exists (SE16 check), Request ID shown, sections unlock.
- Enter header fields + 2 items → **zero** network traffic until Save. Save → one `$batch` under `vrCreate` containing PATCHes + item POSTs → success → order complete in list/detail.
- Cancel after bootstrap → skeleton deleted (list + SE16 verify). Cancel before → no artifacts.
- Forced bootstrap failure (invalid provider) → targeted messages in MessagePopover, no toast, pre-bootstrap state intact.
- Grep checks per Fix 2; console clean; NOTES updated: sequencing correction, sales-area constants + verify tag, the group-contamination risk note (why vrEdit/vrCreate must never mix).
