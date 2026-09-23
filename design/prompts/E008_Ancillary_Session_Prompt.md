# Session Prompt — Ancillary Items & Opt-Out (Interactive Items in the Sticky Session)

## 1. AUTHORITY
Read first: `AGENT_ONBOARDING.md` · `UI5_AGENT_PLAYBOOK.md` · `NOTES.md` (newest first) · `design/E008_CRUD1_v5_Sticky_Amendment.md` (create-flow authority — this prompt AMENDS its item handling, §3.1 below) · `/prompts/ancillary-Opt-Ouit.md` (the observed opt-out batch trace — treat as the empirical spec) · this file.
**Scope guard (tightest yet — this touches the most settled code):** items handling in create mode + the opt-out control + child-row rendering. Do NOT touch: header scratch/replay (steps ① ③ ④ unchanged), bootstrap, MessageExtractor internals, fund provider/dialog internals (only the child-row exclusions named below), Parties, IoH (hold).
**Facts from traces (implement against these, do not re-derive):**
- The ancillary/quantity user-exit runs SERVER-SIDE in the sticky session. Item POST with qty 100 returns the item with `RequestedQuantity` already adjusted (e.g. 140). Ancillary sub-items are auto-inserted with `HigherLevelItem` = parent item number, quantities synced to the parent's ADJUSTED quantity.
- Opt-out mechanism (observed, BOTH directions — traces `ancillary-Opt-Out.md` + `ancillary-out-out-uncheck_flow.md` in design/prompts/): PATCH `{"ZZ1_SKIPADDANC_SDI": true|false}` on the MAIN item (`Prefer: return=minimal`, 204) — NOT ZZ1_OptOutAncillary_SDI despite the name. Same $auto batch re-reads item + header + item LIST. Check: optional ancillary removed server-side, mandatory stays. Uncheck: optional ancillary REINSERTED server-side **with a NEW item number** (12 came back as 13), quantity re-derived from the parent's adjusted qty; zero client POSTs.
- **Ancillary identity is disposable**: never cache, key UI state by, or reference ancillary item numbers across an opt-out cycle. Every opt-out toggle ends in a full items-binding refresh from the server — no client-side row patching/restoration, ever.
- Flag semantics (observed): `ZZ1_SKIPADDANC_SDI` round-trips with the checkbox; `ZZ1_SKIPANC` went true on first item POST and STAYED true after uncheck — it behaves as a sticky "ancillary determination ran" marker, moves independently, and must NOT be bound or used as has-ancillaries logic (derive children-exist from the item list). Backend confirmation of the trio still owed (§5).
- Mandatory vs optional is NOT client-visible (`Deletable: true` on both). Observed instance: the ancillary matching the parent's MaterialGroup1 stayed; the cross-intent one was removed. Heuristic only — do not encode it as a rule.

## 2. STEP-0 RECONCILE (verdicts to NOTES)
- [ ] Current item-entry flow state (scratch rows harvested at Save, per v5) — identify the seam where a row becomes "complete" (product + MaterialGroup1 + MaterialGroup2 + quantity entered).
- [ ] Uncheck trace: ALREADY CAPTURED (`design/prompts/ancillary-out-out-uncheck_flow.md`) — verdicts folded into §1 facts above; read the trace once to internalize the batch shape, no re-capture needed.
- [ ] LIVE CAPTURE: on an in-session item whose qty was adjusted (100→140), PATCH quantity to 200 in F3893 — does the exit re-fire (→280)? do child quantities re-sync? Record; this decides whether our qty-edit handler needs a post-PATCH item-list refresh too.
- [ ] Confirm `ZZ1_SKIPADDANC_SDI`, `ZZ1_SKIPANC`, `ZZ1_OptOutAncillary_SDI` all present in ServiceSchema.itemProperties (add as constants; semantics of the trio = backend ask, log it — bind only SKIPADDANC per the trace).

## 3. THE WORK

### 3.1 v5 amendment — items go interactive-in-session (create mode)
- When a scratch row becomes complete (Step-0 seam): POST it to the sticky session immediately via the session context's `_Item` list binding ($auto), then REFRESH the items binding — the table now renders server truth: adjusted quantity + any auto-inserted ancillary children. Subsequent edits to that row are PATCHes to the session item (not scratch mutations).
- The items table's source in create mode switches to the session's item list once the first item posts (scratch rows only exist pre-completion; an incomplete row renders as the existing add-row editor line).
- Save chain change: step ② (bulk item creates) DISAPPEARS for rows already posted — SaveChanges commits what the session holds. Header scratch/replay untouched.
- Failure of an item POST → MessageExtractor path, row stays scratch/editable. DiscardChanges cleanup semantics unchanged.
- User-visible consequence to preserve, not "fix": entered 100 becomes 140 in the row after post — add a subtle row highlight/toast-free indicator (i18n "quantity adjusted by program rules" tooltip on the qty cell when returned ≠ entered).

### 3.2 Child-row rendering
- Rows with `HigherLevelItem` render as children of their parent: indented product cell (or tree-style grouping consistent with sap.ui.table constraints — pick the house-consistent minimal approach), read-only across ALL cells, no fund Select, no Fund Split menu, no item Edit navigation, excluded from fund-split logic and from the priority normalization set? — NO: priority propagation still covers every item incl. ancillaries (they are real items); only fund/edit gestures are excluded.
- Sort: parent order, children immediately after their parent (`SalesOrderItem` order already delivers this — verify, don't re-sort blindly).

### 3.3 Opt-out control
- Main-item rows get the "Anc Opt-Out" checkbox (column or row detail per Items layout), ENABLED only when the item has children in the current list; bound display to `ZZ1_SKIPADDANC_SDI`.
- Check → PATCH `{ZZ1_SKIPADDANC_SDI: true}` on that item ($auto, return=minimal) → FULL items-binding refresh (one batch, mirroring the trace). Optional children disappear per server logic. Uncheck → PATCH false → same full refresh; reinserted children arrive with NEW item numbers (per the uncheck trace) — the refresh-from-server choreography is the only correct shape, no optimistic row handling.
- Busy state on the row during the round trip; failures via MessageExtractor; checkbox reflects server state after refresh (never optimistic).

### 3.4 Manual ancillary deletion
- Ancillary child rows get the delete action (session delete + list refresh). Mandatory-vs-optional is not client-visible: attempt the delete and surface the server's rejection through the MessagePopover if refused (fallback ruling until a backend indicator ships — OPEN_QUESTIONS entry: request an IsMandatoryAncillary flag on the item entity).

## 4. DEFINITION OF DONE
- Live create: add COV-19 item qty 100 → row shows 140 + two child rows under it, children read-only, qty tooltip present; opt-out checkbox enabled on the parent only.
- Check opt-out → one $batch (PATCH + refresh) → optional child gone, mandatory stays, checkbox true; uncheck → behavior matches the captured uncheck trace, children restored.
- Fund Split menu absent/disabled on child rows; fund dialog never opens for them; parent's fund gestures unaffected.
- Delete on the optional child succeeds; delete on the mandatory child surfaces the server message (or succeeds if the server allows — record whichever is true).
- Save → SaveChanges commits parent + surviving children; SE16 shows HigherLevelItem chain intact.
- Both Step-0 captures committed to /prompts/ with one-paragraph verdicts in NOTES; console clean; keyboard pass; i18n complete.

## 5. EVIDENCE OBLIGATIONS
NOTES: the interactive-items amendment recorded as superseding v5's step ② for posted rows; uncheck + qty-refire verdicts; flag-trio semantics: observed behavior recorded (SKIPADDANC = user toggle; SKIPANC = sticky determination marker; OptOutAncillary unused on the wire) — backend email to CONFIRM definitions, not discover them; mandatory-indicator ask. OPEN_QUESTIONS: IsMandatoryAncillary indicator; V1/028 discontinued ancillary materials (functional chase — the admin-kit materials are flagged "Discontd w/o Replace" in live messages); change-mode opt-out behavior (saved orders — separate verification once sessionless-PATCH/PrepareForEdit ruling is final).
