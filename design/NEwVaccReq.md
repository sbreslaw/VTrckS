# CRUD Task 1 Prompt v2 — Create New Vaccine Request (Dialog + OrderCreate Action) — supersedes v1

Read `AGENT_ONBOARDING.md`, `UI5_AGENT_PLAYBOOK.md`, `NOTES.md` first. Standing rules apply (V4 idioms, ServiceSchema isolation, i18n, 508, console clean). Architectural change vs. v1: **creation is server-side** — the backend exposes a custom **OrderCreate action** that receives the collected data and creates the order (backend supplies order type ZKB, org data, determinations, remaining mandatory fields). **No client-side draft orchestration for create.** Delete/ignore any v1 draft-sequence guidance.

## Architecture (settled)
- Modal dialog collects input into a **local JSON model**; backend touched only on Create press.
- On Create: `service/CreateRequestService.js` builds the payload, invokes the OrderCreate action, handles the result.
  - **Action discovery:** read the action's fully-qualified name and parameter shape from `$metadata` — never guess. Handle both plausible parameter styles: a single structured/deep parameter (map fields directly) or a single `Edm.String` payload parameter (`JSON.stringify`). Record which shape shipped in NOTES.
  - **Contract (proposed — CONFIRM WITH BACKEND before building the mapper; put the confirmed version in a `PAYLOAD_CONTRACT.md` at repo root):** request `{provider, description, contactId?, priority?, orderReason?, category?, exisId?, items:[{ndc, quantity, uom:"EA", intention}]}`; response: new order key (SalesDocument) + messages `[{type, text, target?}]`.
- **Failure:** action errors render in the dialog message area (MessageStrip + per-field valueState where targets map); dialog stays open. Nothing to clean up — the action is atomic server-side.
- **Success:** close dialog; i18n toast with the new Request ID; refresh master rows binding; navigate to detail (key predicate incl. `IsActiveEntity=true`).
- `CreateRequestService.js` header comment: notes that create bypasses the client draft protocol via the server-side action (ledger reference — gate item #1 now applies to edit flows only).

## Dialog content (fragment + local JSON model)
**General Data:**
- **Provider** — required. Value help over the provider/SoldToParty VH (existing service VH if annotated; else pending-pattern input). On selection, display read-only Provider Address (partner/address association) — display only, never sent.
- **Description** — required. Plain Input. (Physical mapping backend-side; payload field `description`.)
- **Contact** — optional. Value help over `ZI_VR_CONTACTVH` (BUT051 `RELTYP='BUR001'`, **filtered by the selected provider's BP** — backend dependency; until exposed: disabled input + established pending tooltip). Cleared automatically if Provider changes.
- **Priority** (Normal, High), **Order Reason** (Natural Disaster, Outbreak Response, Other), **Category** (Internet Sales, Provider eMailed, Provider Faxed, Provider Telephoned, VACMAN) — optional `Select`s, key/text pairs hardcoded in `model/Enums.js` with `// TODO: backend value help`; keys are placeholders pending config confirmation — payload sends keys.
- **ExIS ID** — optional Input.
- Not in dialog: Employee Responsible, Notes, values/currency, Status (backend/status-profile concerns). After first successful create, read back the order and record in NOTES whether status = 1A (config assertion, not UI compensation).

**Items — minimum one row required:**
- Editable `sap.m.Table` on the local model; Add Row / per-row delete; create blocked with message until ≥1 valid row (enforce via `zconst MIN_ITEMS = 1` so the rule is one-line adjustable).
- Columns: **NDC** (value help over MARA VH — backend dependency `ZI_VR_NDCVH`; plain input with pending tooltip until exposed), **Quantity** (required per row, positive; **UOM fixed "EA"** shown as read-only text beside it and sent literally), **Intention** — `Select` from Enums.js: Adult / Pediatric and Adult / Pediatric, **default "Pediatric and Adult"**; payload sends the key.

**Dialog UX:** client-side required validation (Provider, Description, ≥1 item, per-row quantity) before invoking; busy state during the action; Escape/Cancel closes with no side effects; keyboard-complete; all strings i18n.

## Backend dependencies (list verbatim in PHASE2_AUDIT as coordination items)
1. OrderCreate action: name, parameter shape, response shape — contract confirmation (blocker for the mapper only; dialog builds regardless).
2. `ZI_VR_CONTACTVH` (BUT051/BUT000, provider-parameterized) — value help exposure.
3. `ZI_VR_NDCVH` (MARA/MAKT) — value help exposure.
4. Enum key confirmation: priority/order-reason/category code values; Intention keys (MVGR1 mapping).
5. Description physical mapping (informational — backend-side concern under this architecture).

## Definition of done
- Happy path against dev: dialog → Create → action succeeds → new ZKB order in master list, opens in detail, toast shows Request ID.
- Error path proven: force an action failure → messages in-dialog, field targeting where provided → correct → succeed.
- ≥1-item rule enforced; UOM sent as EA; Intention defaults correctly.
- Contract file `PAYLOAD_CONTRACT.md` committed with the confirmed shape (or the proposed shape marked UNCONFIRMED if backend hasn't answered — build the mapper behind one function so a shape change is a one-file edit).
- `PHASE2_AUDIT.md` + `NOTES.md` updated (incl. action shape found in $metadata, status read-back assertion, ledger note).
- Grep: no draft artifacts introduced anywhere by this task; i18n complete; console clean; keyboard pass.
