# Session Prompt — Message Accuracy & Hygiene (Create/Edit Flows)

## 1. AUTHORITY
Read in order before any edit: `AGENT_ONBOARDING.md` · `UI5_AGENT_PLAYBOOK.md` · `NOTES.md` (newest sections first — the 2026-08-28 entries describe the current create-flow state) · `design/E008_CRUD1_v5_Sticky_Amendment.md` (sole create-flow design authority) · this file.
On conflict: this file wins for this task's scope; the v5 amendment wins for create-flow architecture; log any conflict found in NOTES.
**Scope guard:** message extraction, deduplication, attribution, and presentation ONLY. Do not modify the save choreography (`CreateOrderService.js#save` steps ①–④), the sticky-session handling, the scratch-context pattern, the Provider picker, or `EditRequestService`'s PATCH/ETag mechanics. Backend data issues (VI-028 funds config, FI-759 material master) are the functional team's — do not attempt workarounds; they are this task's live test fixture while they exist.

## 2. STEP-0 RECONCILE (verify, record deltas in NOTES, then proceed)
- [ ] `model/MessageExtractor.js` exists with cause-chain walking (`deepestMessage`/`deepestErrorBody`), target→section map, and is invoked from `Detail.controller.js` create-save error path. It is CORRECT — this task extends it, never rewrites it.
- [ ] The MessagePopover binds `Messaging.getMessageModel()` (named model "message", set in `Detail.controller.js#onInit`).
- [ ] `design/prompts/E008_CRUD1_Fix_Sequencing_Prompt.md`: if present in the repo, **delete it now** (superseded by the v5 amendment; it must stop being citable) and note the deletion.
- [ ] Reproduce the live fixture once before changing anything: create an order that triggers VI-028/FI-759; screenshot/record what the popover currently shows (baseline for the DoD comparison).
- [ ] Check whether the V4 model auto-adds its own technical messages to Messaging on the same failure (count popover entries vs. distinct backend messages) — this determines how much Gap 2 matters.

## 3. THE WORK (Gap 0 first — it changes what the other gaps receive)

### Gap 0 — Enable the bound-message channel (the reason the wire lacked specifics)
The service declares `SAP__Messages` (Common.v1.Messages) on its entity types — RAP's bound-message channel, which freestyle apps must OPT INTO via `$select`. Our requests never did; F3893 (Fiori Elements) does automatically — that is how it receives the detailed messages from the same backend.
- Add `SAP__Messages` to `$select` on: the Detail context binding (change mode), the SaveChanges operation binding (explicit `parameters: {$select: 'SAP__Messages'}` on its plain-path binding), and the create action's operation binding. Prefer explicit `$select` over `$$inheritExpandSelect` given the workaround bindings in play.
- Verification experiment (do this FIRST, 15 min): reproduce the same failing order in F3893, network tab open; diff its SaveChanges batch part vs ours — URL `$select`/`$expand`, Prefer headers, and where the VI-028 text appears in the response (error body vs SAP__Messages vs header). Replicate the delta; record it in NOTES as the empirical message-channel spec.
- After enabling: the V4 model auto-pushes bound messages into Messaging with resolved targets — Gaps 1–2 (clearing + dedupe) become load-bearing since messages now arrive on two channels.
- Tail branch: if F3893 shows the SAME generic-only behavior for this case → SAP implementation gap → package evidence for an OSS incident (batch diff + debugger observation of FILL_FAILED_AND_REPORTED) and note in the ledger; continue with Gaps 1–5 against whatever channel does deliver.

### The five gaps (in this order)

### Gap 1 — Pre-attempt clearing (stale messages)
Before EVERY save attempt (create chain ①–④ entry point and change-mode save): remove prior messages that (a) were added by MessageExtractor — tag them on add via `technicalDetails: { source: "vrExtract" }` so they're surgically identifiable — or (b) are technical messages whose processor is the OData model. Do NOT blanket-clear `Messaging`: client-side validation messages from other sources must survive.

### Gap 2 — Duplicate suppression
The V4 model may auto-report parsed/technical messages for failed requests alongside the extractor's additions. Dedupe at extraction time: before `addMessage`, skip if an existing message matches on (code + text + target). Additionally, filter the popover's items binding to hide untagged technical duplicates when a tagged extracted equivalent exists.

### Gap 3 — Item attribution in the title
Item-targeted messages carry the item key predicate (e.g. `.../_Item(SalesOrder='...',SalesOrderItem='000010')/Product`). Parse `SalesOrderItem` from the target, strip leading zeros, prefix the title: `Item 10: <text>`. Header-targeted messages: prefix with the field label where the target's last segment maps to a known fragment binding; unresolvable targets render untouched — never drop a message. Keep the existing section auto-expand behavior as-is.

### Gap 4 — Code + severity fidelity
- Carry the OData error `code` (e.g. `VI/028`) into each `sap/ui/core/message/Message`; if the popover item doesn't render the code property, append `(VI/028)` to the text instead.
- Map `@Common.numericSeverity` from each detail where present (1→Success, 2→Information, 3→Warning, 4→Error) instead of hardcoding Error. Unknown/absent severity defaults to Error (fail-loud).
- Popover presentation: grouped by severity, errors first, warnings collapsible.

### Gap 5 — Success-with-messages (observe, don't build)
After a successful save, check whether transition warnings (sap-messages header / action response) appear in Messaging automatically and whether the badge reflects them. Record the observed behavior in NOTES. Do NOT build custom header parsing in this task.

## 4. DEFINITION OF DONE
- **Live fixture run:** create → Save → popover lists VI-028 and FI-759, exactly once each, with message codes, correct item-number prefixes, correct severity; no generic toast; console free of unhandled rejections.
- **Double-failure run:** trigger the same failure twice in a row → second attempt shows its messages exactly once; zero stale carryover from attempt one.
- **Change-mode regression:** force an edit-save failure → same guarantees through the same popover.
- **Post-fix behavior (written test if config is still broken):** after a fully successful save, badge and popover clear correctly; any surfaced warnings render as warnings, not errors.
- **Grep checks:** `MessageToast` absent from all backend-failure paths in create/edit flows; `source: "vrExtract"` tagging present on every extractor-added message; Sequencing prompt file absent from the repo.
- i18n complete for any new user-facing strings; keyboard pass on the popover unchanged.

## 5. EVIDENCE OBLIGATIONS
NOTES entries required: (1) baseline vs. after screenshot/description of the fixture run; (2) the tagging scheme and dedupe rule as implemented; (3) the severity mapping table; (4) Gap-5 observed behavior; (5) confirmation of the Sequencing-prompt deletion with the v5 amendment cited as sole create-flow authority; (6) any Step-0 deltas. OPEN_QUESTIONS: none expected from this task — if one emerges, log it rather than expanding scope.
