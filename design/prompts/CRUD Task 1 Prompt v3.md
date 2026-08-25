# CRUD Task 1 Prompt v3 — In-Place Create (Detail View, Standard CRUD Spine) — supersedes v2

Read `AGENT_ONBOARDING.md`, `UI5_AGENT_PLAYBOOK.md`, `NOTES.md`, `ADDENDUM-001`, this file. v3 rationale: customer decision — CRM_UI parity; the Create dialog is REMOVED; creation happens in-place in the Detail view. Spine = **standard CRUD create on the standard service** (verified non-draft: transient context in a deferred group, one submitBatch). Three concerns relocated (see table in design discussion / NOTES): jurisdiction → backend behavior-extension validation; Description/Status/Category/Contact → post-create **enrichment action**; IoH → post-save per CR-002. Delete the dialog fragment/controller; salvage validation + payload mapping into the new flow.

## Architecture (settled)
- **Enter create mode:** Create button → route `/create` → Detail view in createMode: `oListBinding.create({OrderType:'ZKB', ...})` with **updateGroupId `vrCreate` (deferred)** → transient context bound to the whole view. No backend contact until Save. Cancel = `oContext.delete()` (transient) + navigate back — nothing to clean up.
- **Sections in edit simultaneously (no per-section Save/Cancel, no Edit buttons in createMode):** General Data, Items, IoH, Shipping, Org Data, Parties Involved, Attachments — `sectionFlags` gains a `createMode` dimension: per-section editability flags suppressed; field editability = writable-map ∪ createMode rules.
- **Global Save (DynamicPage title):** ① `submitBatch("vrCreate")` — atomic standard create (header + items) ② on success: **enrichment action** (name/params via $metadata + ServiceSchema constant; carries description, status if user changed from default, category, contactId; skip call entirely if nothing to enrich) ③ IoH deep-create/`createFromProposal` from the local IoH rows ④ rebind view to the returned VBELN key, exit createMode, refresh master. Global Cancel: confirm-if-dirty → delete transient context → back.
- **Partial-failure semantics (document in NOTES verbatim):** step ① failure = nothing exists, stay in createMode with messages. Step ②/③ failure = order EXISTS; exit createMode to the saved order, messages shown, user completes via change mode. No compensating deletes.
- **Messages:** every step feeds `sap/ui/core/Messaging` → the existing **MessagePopover**; field/section targeting with the auto-expand machinery; no MessageStrip.

## Section treatment in createMode
- **General Data:** editable — Provider (VH; on selection: address display read-only, contact VH re-scoped, IoH prepop trigger), Description, Priority/Order Reason/Category (VH entities via `vrExt` model if live, else Enums), ExIS ID, **Status: Select over the 5 dictionary values, default 1A** — send via enrichment only if changed; add OPEN_QUESTIONS: functional ruling on legal initial statuses. Read-only: Request ID (“<new>” placeholder until save), Created At/By, values/currency (populate after save).
- **Items:** the existing grid/table editable against the transient context’s nav binding (group `vrCreate`): NDC (VH + DefaultIntention prefill + UoM per TS-B2.2), Quantity, Intention; add/remove rows freely pre-save (transient deletes are local). `MIN_ITEMS` client rule enforced at Save.
- **IoH:** editable table on a **local JSON model** (no backend context exists pre-save): prepop rows on provider selection via the prepop/consignment read (vrExt), quantity edits, add/delete; transferred in step ③. Label the section subtly (e.g. “will be submitted with the order”).
- **Shipping / Org Data:** editable per the standard writable-map from Step-0 metadata check (org fields often creatable-only — bind editable in createMode, read-only afterward). Ship whatever the map allows; em-dash/read-only the rest, no compensation.
- **Parties Involved:** render determination results read-only + note; partner editing stays on the verify list (OPEN_QUESTIONS).
- **Attachments:** panel visible, disabled, i18n note “available after first save”; activates on step ④.
- All other sections: hidden or read-only-empty in createMode per SectionConfig flag.

## Step-0 reconcile (beyond the standing checklist)
- [ ] $metadata: creatable/updatable map for header + item + org/shipping fields; item nav creatability; enrichment action presence (name; absence = degrade: skip step ②, Description/Status/Category read-only in createMode, note prominently).
- [ ] Confirm dialog artifacts removed cleanly (fragment, controller, i18n orphans).
- [ ] VH availability on both models (standard + vrExt per ADDENDUM-001); two-model wiring present or add it here.
- [ ] Backend: behavior-extension jurisdiction validation status (informational — enforcement is server-side either way; record whether it’s live so the joint test includes the negative case).

## Definition of done
- Happy path: full in-place create incl. items + IoH + description/status → one visible order correct in list/detail/SE16; Request ID appears at save; attachments panel activates post-save.
- Cancel path: dirty create cancelled → zero backend artifacts (verify via list + direct reads).
- Step-① failure (e.g. bad org data): stays in createMode, MessagePopover targeted. Step-② forced failure: order exists, user lands in saved state with messages — behavior documented.
- Awardee jurisdiction negative test (if backend validation live): create for foreign provider rejected at step ① with message.
- MIN_ITEMS enforced; NDC prefills intention/UoM; grep: no dialog remnants, no draft vocabulary, group `vrCreate` handling confined to the create service module; i18n; console clean; keyboard pass across all editable sections.
- NOTES: writable-map findings, enrichment action shape, partial-failure paths as implemented, ledger note (create = standard spine + relocations; OrderCreate core preserved as enrichment/API-channel unit; jurisdiction now extension-validation — spike promoted to load-bearing).
