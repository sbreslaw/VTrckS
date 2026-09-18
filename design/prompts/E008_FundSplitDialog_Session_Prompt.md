# Session Prompt — Fund Split Dialog (Display/Edit Allocation per Item)

## 1. AUTHORITY
Read first: `AGENT_ONBOARDING.md` · `UI5_AGENT_PLAYBOOK.md` · `NOTES.md` (newest first) · `design/E008_FundSplit_Session_Prompt.md` if present (design authority for the fund mapping/logic layer — this session builds its §4.4 dialog) · this file. This file wins for dialog scope; log conflicts in NOTES.
**Scope guard:** one dialog fragment + controller, its open triggers, and the minimal FundMapProvider/FundLogicService pieces it depends on IF they don't exist yet. Do NOT touch save choreography, sticky handling, MessageExtractor, IoH (on hold), or the Parties section.
**Settled decisions (implement, don't re-decide):**
- Dialog lists **only fund types applicable to this item** — the rows come from the fund mapping (VH/provider) filtered `IsAllocatable && IsEligible` for the row's (Material, MaterialGroup1). This deliberately DIFFERS from legacy CRM_UI, which rendered all fund types and merely disabled inapplicable ones. Fewer rows than legacy is correct behavior — record in NOTES for UAT expectation-setting.
- **Default Split = set every quantity input to 0** (confirmed legacy behavior — it is a client-side reset, nothing backend). This closes the prior OPEN_QUESTIONS entry "Default Split backend logic" — update it: resolved, client-side zero-all.
- Split-sum validation is BACKEND-only at save (standing decision). The dialog shows a **non-authoritative running total** beside Order Quantity; it never blocks Done.

## 2. STEP-0 RECONCILE (verdicts to NOTES)
- [ ] Does `model/FundMapProvider.js` exist (interim/vh provider per the fund-session contract: FundCode, FundText, TargetFieldName, IsAllocatable, IsEligible, SortOrder)? If NOT: create the **interim** implementation now as specified there — one TEMPORARY data table in that single file, today's codes (VFC, 317, S/L, CHP, SPL, PAN, ARR, N/A) with TargetFieldNames (`S/L`→ZZSTATEQTY, `ARR`→ZZRESQTY, VFC/317/CHP/PAN→ZZ<code>QTY), IsAllocatable=false for SPL and N/A, eligibility rules as data (VFC/CHP require Pediatric-containing intent). No fund literals anywhere else — grep-enforced.
- [ ] Does `service/FundLogicService.js` exist (applyFundSelection / isSplitFund)? If NOT: create only what the dialog needs — `isSplitFund(row)`, `getAllocatableOptions(material, intent)`, `commitSplit(oRowCtx, aWorkingRows)` (writes each TargetFieldName value into the row context in the current mode's group), `readAllocation(oRowCtx, aOptions)` (builds working rows from current ZZ values).
- [ ] Current fund Select state (hardcoded vs provider-driven) — do not rework the Select in this session; only ensure the dialog reads the SAME provider so both stay consistent.
- [ ] ServiceSchema: `itemProperties` carries the six ZZ quantity constants and `fundType: "MaterialGroup2"`; Fund Split menu/action wiring point in Items fragment (currently disabled placeholder — this session enables it).
- [ ] Item row facts available for the header block: Provider (id + name from order context), Material + description, ItemNumber, RequestedQuantity, Brand (`ZZIndustryStandardName`), Intent (`MaterialGroup1`).

## 3. THE WORK

### 3.1 Fragment — `view/fragments/FundSplitDialog.fragment.xml` (+ `controller/FundSplitDialog.js`)
Layout per the legacy screenshots, modernized to Fiori controls (sap.m.Dialog, form + table):
- **Header block (all read-only, from the invoking row/order context):** Provider (ID | name), Material (ID | description), Item Number, Order Quantity, Brand, Order Intent. Two-column arrangement mirroring the screenshots; labels i18n.
- **Allocation table:** one row per mapping entry (`IsAllocatable && IsEligible` only): Fund Code (RO) | Fund Text (RO) | **Quantity** (Input type Number, right-aligned). Rows sorted by SortOrder.
- **Running total line:** "Allocated: X of {OrderQuantity}" beneath the table — display only, updates live, styled neutrally (no error state; the backend judges at save).
- **Footer:** `Done` · `Default Split` · `Cancel` (order per screenshots).

### 3.2 Modes
- **Edit mode** (invoked when the row's fund = SPL): quantity inputs editable, working-copy model seeded from the row's current ZZ values (`readAllocation`); `Default Split` sets every working-copy quantity to 0; `Done` commits via `commitSplit` — every TargetFieldName in the eligible set written (zeros included — the fields are non-nullable Int32), values land in the row context under the active mode's group (vrCreate/vrEdit semantics unchanged); `Cancel`/Escape discards the working copy, row untouched.
- **View mode** (invoked for any single-fund row, from the same menu action): identical layout, all inputs read-only showing the current allocation (full quantity on the selected fund's row), `Done` and `Default Split` rendered **disabled** (matches legacy screenshot 2), `Cancel`/close only.
- Mode is decided by the invoking row's fund via `FundLogicService.isSplitFund` — no fund literals in the dialog controller.

### 3.3 Triggers & wiring (both triggers are REQUIRED — no fallback-to-one)
- **Trigger 1 — automatic:** selecting the SPLIT fund type in the row's fund dropdown opens the dialog in edit mode immediately (Select change event → `isSplitFund` → open). If `FundLogicService.applyFundSelection` exists, hook there; if not, wire the change handler directly — the auto-open ships either way. Cancel from an auto-opened dialog leaves the fund selection as SPL with current (possibly zero) allocations — do not revert the dropdown.
- **Trigger 2 — item Action menu "Fund Split":** currently greyed out and unwired — enable it and link to this dialog. Enabled whenever the row has ANY fund selected: SPL → edit mode, single fund → view mode (§3.2). No fund selected yet → remains disabled (nothing to display); tooltip i18n "select a fund type first."
- Dialog is a single lazy-loaded fragment instance reused across rows; working copy fully rebuilt per open (no state bleed between rows — test it).
- Quantity inputs: integer-only, min 0; working copy holds numbers (never null — Int32 non-nullable fields downstream).

## 4. DEFINITION OF DONE
- Adult-intent item: dialog shows only the eligible allocatable funds (no VFC/CHP rows), matching the provider data — demonstrated live; NOTES records the row set vs legacy expectation note.
- Edit mode: allocate 30 as 10/20 across two funds → Done → row's ZZ fields hold 10/20/0/0…; save the order → SE16 confirms persisted values.
- Default Split: all inputs go to 0; Done then commits zeros.
- View mode: single-fund row (e.g. STATE=30) opens read-only with Done/Default Split disabled — pixel-parity in spirit with screenshot 2.
- Cancel discards edits (row values unchanged, `hasPendingChanges` unaffected by the working copy); cancel from an auto-opened dialog keeps SPL selected in the dropdown.
- Both triggers proven live: SPL selection auto-opens in edit mode; menu action opens edit mode on a SPL row and view mode on a single-fund row; menu disabled with tooltip on a no-fund row.
- Row-switch test: open dialog on item 10, cancel, open on item 20 — no state bleed.
- Greps: fund literals only in `FundMapProvider.js` (+ `isSplitFund`); no validation blocking Done on sum mismatch; console clean; dialog fully keyboard-operable (tab order: table → total → footer); all strings i18n.

## 5. EVIDENCE OBLIGATIONS
NOTES: Step-0 verdicts (which fund-layer modules existed vs created); the eligible-rows-only deviation from legacy recorded for UAT/training; Default Split resolution (client-side zero-all — closes the open question); commit semantics (all TargetFieldNames written incl. zeros). OPEN_QUESTIONS: update the Default Split entry to resolved; add nothing new unless discovered.
