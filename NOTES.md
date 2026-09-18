# NOTES

## Bugfix — Select forceSelection race on OData V4 two-way `selectedKey` — 2026-09-18

Live-tested and confirmed fixed. Two related bugs, same root cause:

- **Header**: reading an existing order (master list -> detail) threw
  `Error: Must not change a property before it has been read` while
  updating `CustomerPurchaseOrderType`. Cause: `sap.m.Select` defaults
  `forceSelection=true` — its `items` list (a real async backend VH read,
  `/CustomerPurchaseOrderType`) could resolve before the header entity's own
  property read completed, so the Select fell back to selecting/writing the
  first VH item before the real value had ever been fetched, tripping V4's
  guard against writing an unread property.
- **Items**: the fundType (`MaterialGroup2`) column silently showed the
  wrong value on row read (e.g. "VFC" displayed for a row whose real
  `MaterialGroup2` was "PAN", confirmed via the raw OData GET response) — no
  thrown error this time since the item list (`fundTypes>/list`) is a
  synchronous local JSON model, but the same forceSelection fallback still
  fired per-row before that row's own property had been read.
- **Fix**: added `forceSelection="false"` to all three Selects in the
  cockpit app whose `selectedKey` is two-way bound directly to a real OData
  V4 property — `CustomerPurchaseOrderType` (Details.fragment.xml),
  `MaterialGroup1`/`MaterialGroup2` (Items.fragment.xml). Selects bound to a
  local JSON model instead (`priorityState>/value`, `createEnrich>/status`)
  aren't exposed to this race and were left unchanged. Matches the
  `forceSelection="false"` convention already used consistently throughout
  the sibling `lp2preq` project — the pattern to follow for any new Select
  bound straight to a real entity property in this codebase.
- Full technical writeup in repo memory
  (`vtrcks-create-order-sticky-session.md`, "Select forceSelection race..."
  section) for any agent picking up a similar symptom later.

## Session Prompt — Fund Split Dialog (Display/Edit Allocation per Item) — 2026-09-18

Static-editing session (no live backend access this session). Scope: one
dialog fragment + controller, its open triggers, and the minimal fund-layer
modules it depends on — no save choreography/sticky/IoH/Parties changes.

- **AUTHORITY CONFLICT LOGGED**: the session prompt's §1 references
  `design/E008_FundSplit_Session_Prompt.md` as design authority for the fund
  mapping/logic layer "if present" — it does NOT exist anywhere in `design/`
  (confirmed via file search). Proceeded on the session prompt's own §2
  Step-0 instructions alone, which are self-contained (they specify the
  exact interim `FundMapProvider.js` table and `FundLogicService.js` API to
  build when no such files exist). Similarly, §5 says NOTES/OPEN_QUESTIONS
  should update "the Default Split backend logic" open question — no such
  entry exists in `OPEN_QUESTIONS.md` either (grepped, not found); logged
  here instead of editing a nonexistent entry, see OPEN_QUESTIONS.md's new
  Fund Split section for the resolution written up fresh.
- **Step-0 verdicts**: `model/FundMapProvider.js` and `service/FundLogicService.js`
  did NOT exist — both created fresh, exactly as specified (interim table,
  today's 8 codes, `IsAllocatable=false` for SPL/N/A, pediatric-only
  eligibility gate for VFC/CHP via MaterialGroup1 PED/MIX). The Fund Type
  Select (Items.fragment.xml) was confirmed HARDCODED (a `FUND_TYPES` module
  constant in `Detail.controller.js`, unrelated to the new provider) — per
  the prompt's explicit instruction, this was NOT reworked to read from
  `FundMapProvider`; the two data sources are intentionally allowed to
  diverge structurally as long as both correctly reflect the same known fund
  codes/eligibility rules (they do — this was cross-checked by hand, not by
  a shared runtime call). One necessary, in-scope touch to that existing
  Select: `SPL`'s hardcoded `disabled: true` flag was removed (it must be
  selectable for Trigger 1 to ever fire) — nothing else about that Select's
  architecture changed.
- **Eligible-rows-only deviation from legacy CRM_UI (record for UAT/training)**:
  the new dialog's allocation table shows ONLY fund types where
  `IsAllocatable && IsEligible` for the invoking row's Material/Intent (today:
  gated purely on MaterialGroup1 pediatric-containment for VFC/CHP, since no
  per-Material rule source exists yet) — e.g. an Adult-intent item shows 317/
  S/L/PAN/ARR but never VFC/CHP rows at all. Legacy CRM_UI rendered every
  fund type and merely disabled the inapplicable ones. This is confirmed
  correct-by-design (session prompt §1), not a bug — flag to UAT/training so
  testers don't report "missing rows" against the legacy screenshots.
- **Default Split — resolved, client-side zero-all**: `Default Split` (in
  edit mode only) sets every working-copy Quantity to 0 in the dialog's local
  JSONModel; nothing is sent to the backend until the user then presses
  `Done`. No backend logic of any kind is involved — purely a client-side
  reset, matching legacy behavior.
- **Commit semantics**: `Done` (edit mode) calls `FundLogicService.commitSplit`,
  which writes EVERY eligible option's `TargetFieldName` back onto the row
  context — including zeros, since the six `ZZ..QTY` fields are all
  `Edm.Int32 Nullable="false"` (design/so.xml) and must never be left unset.
  This rides whatever update group the Items section is already bound to
  (`vrEdit`/`vrCreate`) — no new group, no early submit.
- **Both triggers wired, no fallback-to-one**: (1) the Fund Type Select's
  existing `onFundTypeChange` handler (Detail.controller.js) now also opens
  the dialog in edit mode whenever the newly-picked key is SPL
  (`FundLogicService.isSplitFund`); (2) the Items row Action menu's
  "Fund Split" `MenuItem` (previously a permanently-disabled placeholder,
  Items.fragment.xml) is now wired to a new `onItemsFundSplitPress` handler,
  enabled whenever the row has any fund selected (same createMode-phasing
  gate the Fund Type Select itself already uses), mode decided the same way.
  Both call through a single lazily-created, reused `FundSplitDialog`
  instance (`_getFundSplitDialog`) — its `open()` fully rebuilds the working-
  copy JSONModel every call, so there is no state bleed between rows.
- New files: `model/FundMapProvider.js`, `service/FundLogicService.js`,
  `controller/FundSplitDialog.js` (fragment controller, not a
  `sap.ui.core.mvc.Controller` — a plain constructor passed as `Fragment.load`'s
  `controller` option, same idea as this codebase's existing per-purpose
  helper modules like `SectionFactory.js`), `view/fragments/FundSplitDialog.fragment.xml`.
  New i18n keys added under `i18n.properties` (`fundSplit*`,
  `rowActionFundSplitTooltip`) — none hardcoded in XML/JS.
- Not live-tested (no backend access this session, consistent with every
  other entry in this file) — next agent with system access should run the
  Definition of Done checklist from the session prompt end to end.


## Session Prompt — Layout cleanup, Items fund-type rework, Delete row, Itm# calc — 2026-09-16/17

Static-editing session (no live backend access until the final live test
reported at the end of this entry). Two unrelated batches of work:

- **Layout/form cleanup** (Details/OrgData/Shipping fragments): normalized
  `sap.ui.layout.GridData` on every label/field (`XL4 L4 M4 S12`
  `linebreak="true"` label / `XL8 L8 M8 S12` field), converted `f:SimpleForm`
  to `f:Form`/`f:ResponsiveGridLayout`/`f:FormContainer`/`f:FormElement` in
  `OrgData.fragment.xml`/`Shipping.fragment.xml` to match `Details.fragment.xml`'s
  existing pattern, and swapped the Details Category field from `ComboBox` to
  `Select` (binding unchanged, tag only).
- **Items grid — fund type (MaterialGroup2) rework, Delete row, Itm# calc**
  (three-part client request):
  - Fund Type `Select` is now data-driven off a new `"fundTypes"` JSONModel
    (`Detail.controller.js#_createFundTypesModel`, built from a new
    `FUND_TYPES` module constant) instead of 8 hardcoded `core:Item`s — each
    entry carries its own `targetField` (resolved via
    `ServiceSchema.itemProperties`), `pediatricOnly`, and `disabled` flags.
    Added `qty317`/`chipQty`/`panQty`/`resQty` to
    `ServiceSchema.itemProperties` (`ZZ317QTY`/`ZZCHIPQTY`/`ZZPANQTY`/`ZZRESQTY`,
    all `Edm.Int32 Nullable="false"`, seeded to 0 on Add same as the existing
    `ZZVFCQTY`/`ZZSTATEQTY`). `SPL` stays disabled (split-funding UI not built).
  - `onFundTypeChange` (new): mirrors the row's current Quantity onto the
    newly-picked fund type's own `targetField`, clears every other fund type's
    `targetField` to 0 (only one active per item). `onProdQtyChange` rewritten
    to resolve the row's *current* fund type's `targetField` dynamically
    (`_getFundTypeEntry`) instead of always writing `ZZSTATEQTY`.
  - `onOrderIntentionChange` (new, added 2026-09-17 after live-test bug #2
    below): disabling a now-invalid `core:Item` in the Fund Type `Select`
    (`formatter.fundTypeItemEnabled`) does NOT itself clear an already-selected
    key — changing Order Intention (MaterialGroup1) left a stale, now-invalid
    Fund Type selected with no visible reaction. Fix: on Intention change,
    re-validate the row's current Fund Type against the new Intention and
    clear it (+ its `targetField`) if no longer valid.
  - **Delete row**: `Items.fragment.xml`'s Delete `MenuItem` rewired from a
    disabled placeholder to `press=".onItemsDeleteRow"` (`MessageBox.confirm`
    + real `oRowContext.delete()`, same pattern as `onPartiesDeleteRow` —
    rides whatever update group the Items section is already bound to,
    `vrEdit` or `vrCreate`, no new group needed).
  - **Itm# (SalesOrderItem) on Add**: new `_computeNextItemNumber` helper
    scans `oBinding.getCurrentContexts()` for the max existing item number,
    adds 10, zero-pads to 6 digits (SD +10 convention; `SalesOrderItem` is
    `Edm.String MaxLength=6`) — set directly in `onItemsAddRow`'s `create()`
    payload. `SalesOrderItem` is annotated `@Core.Computed` in so.xml, so per
    OData V4 semantics the backend should ignore this client value and assign
    the real one at Save — **this client-side placeholder is never actually
    transmitted meaningfully, see the live-test bug below.**
  - `CreateOrderService.js` needed NO change for any of the above — its item
    replay step already copies ALL of a scratch item context's own properties
    generically (the `ITEM_PROPERTIES` filtered constant near the top of that
    file is dead code, confirmed unused).
- **Live-test bug #1, confirmed (2026-09-16): MVGR1 (Order Intention) codes
  were wrong placeholders, not the real domain.** `Items.fragment.xml`'s
  Intention `Select` used `"Adult"`/`"Pediatric"`/`"AdultPediatric"` as
  `core:Item` keys — `MaterialGroup1` is `Edm.String MaxLength="3"`, so those
  values physically cannot be what's stored server-side. Symptom: create an
  item as Pediatric + a pediatric-only Fund Type (e.g. STATE), Save succeeds,
  but on reload Intention silently reverts to "Adult" (`sap.m.Select` falls
  back to its first item when the bound value matches none of its
  `core:Item` keys) and Fund Type reverts to VFC (the gating formatter
  re-evaluates against the now-wrong Intention). Real codes confirmed by the
  client: **MVGR1** `ADU`=Adult, `PED`=Pediatric, `MIX`=Pediatric and Adult;
  **MVGR2** (Fund Type) codes were already correct (`VFC`/`317`/`S/L`/`CHP`/
  `SPL`/`PAN`/`ARR`/`N/A`) — no change needed there. Fixed:
  `Items.fragment.xml` `core:Item` keys, `formatter.js#fnFundTypeItemEnabled`'s
  string comparisons, and the (dead-code, currently unused)
  `Enums.js#FUND_TYPE_BY_INTENTION` map, all updated to `ADU`/`PED`/`MIX`.
- **Live-test bug #2**: see `onOrderIntentionChange` above (Fund Type not
  clearing when Intention changes) — same live-test session, found and fixed
  right after bug #1.
- **Item # / Rejection Reason columns hidden in createMode**: per client
  request, since `SalesOrderItem` is never really transmitted (Computed) in
  createMode and Rejection Reason only ever applies to an existing order's
  items — both column headers and cells now combine their existing
  `itemsColumns>` personalization-visibility binding with
  `!${sectionFlags>/createMode}` via `{= ... }` expressions (escaped as
  `&amp;&amp;` in the XML attribute, not raw `&&`, per prior `so.xml`-adjacent
  lesson about unescaped ampersands in attribute values).


Static-editing session (no live backend access, consistent with every prior
entry in this file) implementing the Session Prompt spec's items 3.1-3.9. All
of 3.1-3.7 and 3.9 are implemented; 3.8 (IoH live binding) is confirmed still
ON HOLD per the spec's own instruction — no IoH-related code was touched.

- **manifest.json**: new `"po"` OData V4 model wired to a new
  `providerOrderService` dataSource (`zui_providerorder_srv`,
  `operationMode: "Server"`, `autoExpandSelect: true`, `groupId: "$auto"`).
  URL is `TODO-VERIFY` — the exact SICF/RAP binding name was never confirmed
  against a live system this session; verify in `/IWFND/MAINT_SERVICE` before
  relying on it.
- **3.1 Priority**: confirmed (again) no header-level DeliveryPriority
  property/navigation exists on `SalesOrderManageType` — stays a VIRTUAL
  header field. `Detail.controller.js` now computes a header display value
  from every item's real `DeliveryPriority` (`_computeHeaderPriority`,
  uniform/mixed detection) and propagates a user-changed value back onto
  every item at Save time only (`_propagatePriorityToItems`, called from
  `onSectionSavePress` for the "details" section and from `onCreateSavePress`
  for createMode). **TODO-VERIFY(priority-ordering)**: "most urgent = lowest
  DeliveryPriority code" is assumed (standard SD convention), never
  independently confirmed against the live `/DeliveryPriority` VH data.
- **3.2 Category**: rebound from the old `SalesOrderType`-alias/hardcoded-enum
  concept onto the real, independently writable `CustomerPurchaseOrderType`
  header property (confirmed in so.xml, own `CustomerPurchaseOrderType` fixed
  VH entity set, `_CustomerPurchaseOrderType` navigation for display text).
  Added to `updatableHeaderProperties` (auto-flows into the create-replay
  header PATCH). The old `ZZ_BSARK_SDH`/enum-based Category concept is fully
  retired — it was never a real header field.
- **3.3 Tax Amount**: confirmed (again) no header-level Tax field exists —
  `headerProperties.taxAmount` stays `null`. The Details section's Tax Amount
  is now a plain CLIENT-SIDE SUM of item `TaxAmount` (`_computeHeaderTaxAmount`,
  called on order load and after an Items section save) — never part of any
  create/edit payload.
- **3.4 Org Data Service fields**: removed (per spec — not backend-supported,
  see `OrgData.fragment.xml`).
- **3.5 Contact VH**: rewired off the old `/StandardPartnerContactInfo` source
  (which 501'd on any standalone query anyway) onto the new custom service's
  `po>/ProviderContact` entity set, filtered to the selected Provider's
  `BusinessPartnerCompany` (**TODO-VERIFY**: assumed 1:1 with SoldToParty,
  never confirmed live) and client-side to each row's own Validity window.
  Provider change already cleared Contact (`_prefillMainContact`) from a
  prior session — reused, extended to also clear `contactId`.
- **3.6 Shipping Condition**: reconfirmed already correctly wired to the real
  `/ShippingCondition` entity set in a prior session — no changes needed.
- **3.7 UOM**: reverted to read-only, now auto-defaulted from the selected
  NDC's own `Product.BaseUnit` (real property, so.xml) via
  `onItemNdcValueHelpRequest` — no more manual per-row typing.
- **3.8 IoH**: confirmed untouched/ON HOLD, no code changes.
- **3.9 Parties Involved**: full rewrite off the old read-only SimpleForm
  placeholder onto a real table over the header's `_Partner` navigation.
  `SectionConfig.js`'s `partiesInvolved` entry no longer has
  `createVisible: true` — the only way to add a row, the bound `CreatePartner`
  action, requires an already-persisted header context and cannot target the
  createMode scratch transient context. Add uses `CreatePartner` (the only
  sanctioned insert path, `InsertRestrictions.Insertable=false` on the
  `_Partner` nav itself) followed by a `Customer` PATCH (the only settable
  field `CreatePartner` doesn't itself take as a parameter); Delete is a real,
  immediate per-row DELETE gated by the row's own dynamic
  `__EntityControl/Deletable`; Name/Customer change reuses the existing
  Provider-picker dialog (`_openShipToPartyValueHelpDialog`). Edit (other
  fields) is an explicit placeholder, deferred to a later phase (see
  OPEN_QUESTIONS.md). "Main Partner" checkbox is unbound/disabled — no such
  flag exists anywhere on `HeaderPartnerType` in so.xml.
- Caught and fixed one self-introduced bug before it shipped: two `visible=`
  expression bindings in the new `PartiesInvolved.fragment.xml` compared a
  raw string property (`PartnerFunction`) with `!==` inside a `{= ... }`
  expression — same class of `FormatException` documented in
  `/memories/repo/vtrcks-create-order-sticky-session.md` ("Fourth follow-up",
  bug #3): expression bindings auto-convert every embedded `${...}` to the
  target property's type (Boolean, for `visible`) before the JS expression
  ever runs. Fixed by switching both to the no-auto-conversion `{:= ... }`
  form.

## Item ZZVFCQTY (Edm.Int32 quantity mirror) — 2026-09-10

Client-added `onProdQtyChange` (Detail.controller.js) keeps a new custom item
field, `ZZVFCQTY` (C_SALESORDERITEMMANAGE extension, `Edm.Int32`), mirrored to
`RequestedQuantity` (`Edm.Decimal`) whenever the Qty input changes.

- **Root cause of the live crash**: the Quantity `Input`'s `change` event
  value is `RequestedQuantity`'s OWN type-formatted decimal string (e.g.
  `"67.000"`, matching its Scale) - sending that verbatim for an `Edm.Int32`
  property fails Gateway-side deserialization ("Property 'ZZVFCQTY' ... has
  invalid value '67.000'"), and that failure is severe enough that the
  Gateway's OWN error response comes back malformed - the client can't even
  parse it ("Error while parsing an XML stream"), which cascades into every
  OTHER request in the same batch failing to parse too (the sticky item
  POST's automatic retry, the best-effort `DiscardChanges` cleanup).
- **Fix**: `onProdQtyChange` now sends `Math.round(parseFloat(sQty))` (a
  real JS integer, never the decimal string), falling back to `0` on `NaN`.
  Added `ServiceSchema.itemProperties.vfcQty` (`"ZZVFCQTY"`) instead of the
  hardcoded literal, and added it to `CreateOrderService.js`'s item
  deep-create `ITEM_PROPERTIES` whitelist - it was missing there, which is
  the likely explanation for the client's own separate report that a
  manually-`parseInt`'d attempt sent a correct `67` in the JSON payload but
  the backend still recorded `0` (a value not in that whitelist array is
  silently dropped from the deep-create payload entirely, regardless of
  what's staged on the create-mode scratch row). Also seeded `ZZVFCQTY: 0`
  in `onItemsAddRow` (`Nullable="false"` per `design/so.xml`, matching how
  `RequestedQuantity`/`RequestedQuantityUnit` are already seeded there).
- **Not yet live-verified** - ask for a fresh redeploy + create-flow test
  (enter a Qty, confirm `ZZVFCQTY` arrives as a plain integer in the item
  deep-create payload and the backend records the matching value, not 0).

## Header Description/Net/Gross value + Item Brand (Industry Standard Name) — 2026-09-01

Client requirement: wire up several new custom SDH (Sales Document Header)
fields and a Product VH extension, none of which are yet reflected in the
local cached metadata mirrors (`localService/metadata.xml`/`design/so.xml`)
— trusted directly per the client's explicit field-name instruction, same as
the Fund Type task's confirmed codes. **TODO-VERIFY on first live save**:
`ZZ_KTEXT_SDH`/`ZZ_NET_VALUE_SDH`/`ZZ_GROSS_VALUE_SDH` (header) have no
metadata confirmation in this repo yet - if the deploy 400s on any of these
three, the real field name differs from what was given.

- **`headerProperties.description` → `ZZ_KTEXT_SDH`**, opened for entry
  ONLY in create mode (`Details.fragment.xml` - `Input` visible only when
  `sectionFlags>/createMode`, gated by `createState>/providerChosen`; a plain
  `Text` otherwise) — matches the client's literal ask ("Open this field for
  entry on Create new order"), NOT wired as change-mode-editable. Added to
  `ServiceSchema.updatableHeaderProperties` anyway — that map is also the
  sole source of `createReplayHeaderProperties`
  (`CreateOrderService.js#_replayHeaderProperties`, step ④'s header PATCH
  after `SaveChanges`), the ONLY mechanism that can persist a value entered
  during create (there is no create-action parameter for it). Flagged in a
  code comment that this does NOT mean change-mode PATCHability is
  confirmed - verify separately before ever adding a change-mode Input.
- **`headerProperties.netValue`**: `TotalNetAmount` → `ZZ_NET_VALUE_SDH`
  (bound in `Details.fragment.xml` and via `Detail.controller.js`'s
  `detailNetValue` `ObjectNumber`, the latter already resolves through the
  `ServiceSchema` constant so needed no direct edit).
- **`headerProperties.grossAmount`**: `null` → `ZZ_GROSS_VALUE_SDH` (was
  BLOCKED-BY-SERVICE; static "—" placeholder in `Details.fragment.xml`
  replaced with a real `ObjectNumber`). `taxAmount` stays `null` - not part
  of this request, still no header-level Tax field in the metadata.
- **`itemProperties.brand` → `ZZIndustryStandardName`** (was `null`) and
  **`productProperties.industryStandardName` → `IndustryStandardName`** (new)
  — per the client, `I_ProductStdVH` is extended by `ZI_PRODUCTSTDVH_EXT` to
  add this field to the NDC value help. Unlike the header fields above,
  BOTH of these properties are already present in the cached metadata
  mirror (`ZZIndustryStandardName` on `SalesOrderItemType`,
  `IndustryStandardName` on `ProductType`) - no TODO-VERIFY needed here.
  Wired: `Detail.controller.js#_openProductValueHelpDialog`'s `$select` now
  includes `IndustryStandardName`; `onItemNdcValueHelpRequest` carries it
  over onto the row's `ZZIndustryStandardName` alongside Product/
  SalesOrderItemText. `Items.fragment.xml`'s Brand column cell is now a
  read-only `Text` bound to the real property (never manually typed, only
  ever set via NDC selection, per the client's "carried over" wording).
  Also added `brand` to `CreateOrderService.js`'s item deep-create
  `ITEM_PROPERTIES` (so a brand value picked during create-mode item entry
  actually persists) and fixed `onItemsExport`'s Brand column to read the
  real property instead of a hardcoded "—" (introduced by this same change).

## Fund Type (MaterialGroup2 / VBAP-MVGR2) opened for entry — 2026-08-31

Client requirement: the Items table's Fund Type column (previously a static
"—" placeholder, `ServiceSchema.itemProperties.fundType: null`) is now a real,
editable field mapped to `MaterialGroup2` (VBAP-MVGR2) — same pattern already
used for Order Intention/`MaterialGroup1` (no fixed-values VH exposed by this
service, hardcoded `Select` options).

- **Selectable values, gated by Order Intention** (client-specified): Adult →
  317/S/L/SPL; Pediatric → VFC/317/S/L/CHP/SPL. Implemented as per-`core:Item`
  `enabled` expressions in `Items.fragment.xml` keyed off the row's own
  `MaterialGroup1` (VFC/CHP disabled unless Pediatric or the combined
  "AdultPediatric" intention — the other three are common to both, always
  enabled). `Enums.js` gained `FUND_TYPE` (the 8 real domain codes) and
  `FUND_TYPE_BY_INTENTION` (the map) for reuse.
- **Real backend codes confirmed by the client (2026-08-31)** — resolves the
  MaxLength=3 concern originally flagged (the client's first-pass wording
  used full words like "STATE"/"SPLIT"/"CHIP" that don't fit
  `MaterialGroup2`'s `Edm.String MaxLength="3"`): `317:317`, `ARR:ARRA`,
  `CHP:CHIP`, `N/A:N/A`, `PAN:PANDEMIC`, `S/L:STATE`, `SPL:SPLIT`, `VFC:VFC`.
  `ARR`/`N/A` weren't part of the original Adult/Pediatric business rule, so
  they're included as always-selectable (no gating rule given for them),
  matching how existing data using those codes would need to display.
- **PAN auto-default from the NDC's Pan indicator — NOT implemented, per the
  prompt's own "(TBD)" caveat.** This service's `Product`/NDC value help
  entity (`ProductType`) exposes only `Product`/`Product_Text`
  (`ServiceSchema.productProperties`) — no Pan-indicator-shaped property
  anywhere in `design/so.xml`/`metadata.xml` (confirmed by grep before
  implementing). There is nothing to read yet, so no auto-default logic was
  written — PAN is left as a normal, always-selectable manual option instead.
  **Next step, backend-side**: expose the Material Master Pan indicator
  through this service (or the NDC value help) before this can be wired up;
  do not invent a property name for it in the meantime.
- Also wired: `CreateOrderService.js`'s `ITEM_PROPERTIES` now includes
  `fundType` so a value picked during create-mode item entry is actually
  replayed in the item deep-create payload (mirrors how `orderIntention` was
  already wired in). Change-mode edits need no separate service code — the
  Items table's cells are already live two-way bindings against a real
  context, same as the sibling Order Intention Select. Also fixed
  `onItemsExport`'s Fund Type column to read the real property instead of a
  hardcoded "—" (introduced by this same change; left the pre-existing,
  unrelated `orderIntention` export placeholder alone — out of this task's
  scope).

## Message Accuracy & Hygiene (Create/Edit Flows) — 2026-08-31

Session scope per `COPILOT_PROMPT_TEMPLATE.md`-style prompt: message
extraction/dedup/attribution/presentation only — `CreateOrderService.js#save`'s
①–④ choreography, the sticky-session/scratch-context pattern, the Provider
picker, and `EditRequestService.js`'s PATCH/ETag mechanics were NOT touched.
`design/E008_CRUD1_v5_Sticky_Amendment.md` remains the sole create-flow
architecture authority and was not contradicted by anything in this pass.

### Step-0 reconciliation deltas
- `model/MessageExtractor.js`, cause-chain walking, target→section map, and
  its invocation from `Detail.controller.js`'s create-save error path all
  verified present and correct, exactly as the prompt assumed — extended in
  place, not rewritten.
- `MessagePopover` confirmed bound to `Messaging.getMessageModel()` (named
  model `"message"`, set in `Detail.controller.js#onInit`) — unchanged.
- `design/prompts/E008_CRUD1_Fix_Sequencing_Prompt.md` **deleted** this
  session (Step-0 required it) — it was superseded by
  `design/E008_CRUD1_v5_Sticky_Amendment.md` and must stop being citable; the
  v5 amendment is confirmed as sole create-flow authority going forward.
- **Live fixture run (VI-028/FI-759) — NOT executed this session.** This
  workspace has no connection to the live SAP backend from this environment;
  the baseline-vs-after popover comparison the prompt asks for could not be
  captured here. All work below is implemented and reviewed statically; it
  still needs a live pass against the real fixture before being considered
  verified (same status as several open items already tracked in
  `/memories/repo/vtrcks-create-order-sticky-session.md`).
- **Does the V4 model auto-add its own technical messages to `Messaging` on
  a failed request? UNCONFIRMED** — no live backend access this session.
  The dedup/clearing design below (Gap 1/2) is written to be correct either
  way (it doesn't assume the answer), but the "how much Gap 2 matters"
  question the prompt asks for is still open — needs a live double-failure
  test with devtools open on `Messaging.getMessageModel().getData()` to
  settle.

### Gap 0 — Enable the bound-message channel (implemented this pass; previously missed)
- A prior pass of this task implemented Gaps 1–5 and the `MessageToast`
  removal but never actually added `SAP__Messages` to any `$select` — Gap 0
  is the reason the wire lacked specifics in the first place, so without it
  Gaps 1–4 can only ever dedupe/attribute whatever generic text already
  reaches the client today. Closed this pass: added explicit
  `$select: "SAP__Messages"` (never `$$inheritExpandSelect`, per the prompt's
  own preference given the workaround bindings already in play) to:
  - the Detail context binding, change mode (`Detail.controller.js#_onObjectMatched`'s
    `bindElement` call),
  - the create action's operation binding (`CreateOrderService.js#save`'s
    `oAction = oModel.bindContext(ServiceSchema.createAction + "(...)", ...)`),
  - the `SaveChanges` operation binding on its plain-path binding
    (`CreateOrderService.js#save`'s `oSaveAction`).
- **F3893 verification experiment — NOT executed.** Same constraint as the
  rest of this task: no live SAP backend reachable from this environment, so
  the prompt's "diff F3893's SaveChanges batch part vs ours" experiment could
  not be run. The `$select` additions above are the correct, standard V4
  mechanism for opting into a `Common.v1.Messages`-annotated bound-message
  property (design/so.xml confirms `SAP__common.Messages` annotations
  pointing at `SAP__Messages` on the relevant entity types) and are applied
  on faith that this matches F3893's behavior, but this is UNVERIFIED against
  a live response and needs the live diff before being trusted as complete.
  If a live test shows `SAP__Messages` is empty/absent even with `$select`
  applied, that is the tail-branch condition the prompt describes (SAP
  implementation gap → OSS-incident evidence package), not a client bug to
  re-diagnose here.
- Not touched: `EditRequestService.js` has no operation binding of its own
  (change-mode save is a plain PATCH via `submitBatch`, no bound action) — so
  the Detail context binding's `$select` above is the only Gap 0 change that
  applies to the change-mode path; there is no second binding to add it to.

### Gap 0 correction (live test, 2026-08-31): item-level messages missed entirely
- **Live network evidence** (user-supplied batch trace): the create action's
  request correctly showed `?sap-client=100&$select=SAP__Messages`, but the
  very next batch part — `POST SalesOrderManage(SalesOrder='')/_Item` (the
  item deep-create, `CreateOrderService.js#save`'s `oStickyItemsBinding`) —
  had NO `$select` at all. The live fixture's actual failures (VI-028/FI-759)
  are ITEM-level validations, not header/whole-SO validations, so they attach
  to the `_Item` entity's own `SAP__Messages`, not the header's — this is
  exactly why the first Gap 0 pass (header/action bindings only) showed no
  change: it never touched the one binding that mattered for this fixture.
- Fixed: added `$select: "SAP__Messages"` to `oStickyItemsBinding` in
  `CreateOrderService.js#save` (the create-flow item deep-create list
  binding). Also added the same to `Detail.controller.js#_rebindItemsGroup`
  (the Items table's `_Item` list binding, used by BOTH change-mode item
  edits/adds and the createMode Items table — the actual runtime rebind
  point; the static XML binding in `Items.fragment.xml` carries no group/
  select of its own, this function is where it's set).
- Still needs a live re-test to confirm `SAP__Messages` now actually comes
  back populated on the `_Item` POST — not yet done as of this note.

### Gap 2 correction (live test, 2026-08-31): "Save failed" still showing twice alongside the real message
- **Live result after the item-binding fix above**: the real message ("Fund
  does not exist in FM area 1000", VI-028) now correctly arrives, but the
  popover showed it sandwiched between TWO generic `"Save failed"` entries -
  net 3 messages for 1 actual error.
- Root cause, both self-inflicted (not the backend's fault this time): (1)
  `extract()` always added `oBody.message` (the top-level wrapper, literally
  `"Save failed"` here) as its OWN separate message in addition to whatever
  `oBody.details[]` contained - redundant noise whenever details actually
  carry the real message(s). (2) `removeDuplicateAutoMessages()` only
  removed an untagged (model-auto) duplicate when its TEXT matched one we'd
  just added - the model's own auto-added technical message for this same
  failure evidently uses different generic wrapper text than our own, so the
  text-substring match never fired and it was never removed.
- Fixed (both in `MessageExtractor.js`): `extract()` now only adds the
  top-level `oBody.message` when `oBody.details` is empty (never drops the
  only message available; simply stops duplicating it when something more
  specific exists). `removeDuplicateAutoMessages()` no longer requires a text
  match - once we've added at least one real message this attempt, ANY
  remaining untagged message with `technicalDetails.httpStatus` set (the
  same trusted model-auto signal Gap 1/`_hasConflictMessage` already rely
  on) is removed outright as noise.
- Still needs a live re-test to confirm exactly one message (the real
  VI-028 one) now shows for this fixture - not yet done as of this note.

### Gap 2 correction #2 (live test, 2026-08-31): a SECOND, genuinely different "Save failed" — from SaveChanges, not the item POST
- **Live result**: the item-level fixes above worked — exactly one item
  message now shows ("Fund does not exist in FM area 1000", VI-028), auto-
  surfaced by the V4 model itself from the item POST's `SAP__Messages`
  (confirms Gap 0's premise: enabling the channel lets the model push bound
  messages into `Messaging` with no extractor code needed for THAT step).
  But a second message still appeared: `"Save failed" (RAP_SD_SLS_COMMON/007)`
  — traced (user-supplied evidence) to a SEPARATE, LATER batch call, the
  `SaveChanges` request itself (`$select=SAP__Messages` present, confirming
  the Gap 0 header-action fix reached the wire) — its response is a genuine
  HTTP error body `{"error":{"code":"RAP_SD_SLS_COMMON/007","message":"Save
  failed","target":"$Parameter/_it",...}}`, no `details[]`. This is the SAME
  message class/number/target already seen and diagnosed in the 2026-08-28
  round-6/7 live tests (`/memories/repo/vtrcks-create-order-sticky-session.md`)
  — RAP's generic "whole-document commit rejected" wrapper, text redacted by
  the gateway, thrown whenever ANY buffered validation issue (here, the same
  VI-028 fund problem) blocks the final commit. It is not new information —
  just the SAME underlying failure reported a second time, from a later step,
  with no specifics of its own.
- This is NOT a text-match duplicate of the item message (different code,
  different target, different request) — Gap 2's existing dedup logic
  (matches on target/text) correctly did NOT suppress it as such. Per the
  user's explicit direction ("Only actual error messages need to be
  displayed. Do not include 'Save Failed'"), the fix generalizes beyond
  literal duplicate detection: `MessageExtractor.js` now recognizes bare
  generic-wrapper text (`isGenericWrapper()`, prefix-matches `"save failed"`
  — extend this list if a new bare-wrapper string surfaces live) and skips
  adding it, in BOTH the "no details[]" and "no parsed error body at all"
  branches of `extract()`, whenever `hasRealMessage()` finds at least one
  OTHER, non-generic message already in `Messaging` (i.e. the real cause was
  already surfaced by an earlier step in the SAME save attempt). If nothing
  else is present, the generic wrapper is still added — never drop the only
  message available.
- Trade-off, noted deliberately: the `RAP_SD_SLS_COMMON/007` CODE is now
  silently dropped along with its wrapper text when suppressed — acceptable
  since a bare code with no text conveys nothing actionable on its own and
  the user explicitly asked for it gone; if a future need arises to retain
  it for diagnostics, log it to console rather than resurrecting it in the
  popover.
- Still needs a live re-test to confirm exactly ONE message (VI-028) now
  shows end-to-end for this fixture - not yet done as of this note.

### Gap 2 correction #3 (live test, 2026-08-31): opposite symptom — the REAL message vanished, only "Save failed" survived
- **Live evidence**: `CreateOrderService.js`'s own pre-extract debug dump
  (`logMessages()`, which reads `Messaging` BEFORE `MessageExtractor.extract()`
  ever runs) proved the V4 model had ALREADY auto-added BOTH the real
  message ("Total Split Qty - 0 does not match the Order Qty - 3") AND "Save
  failed" to `Messaging` straight from `SAP__Messages` on the failed
  SaveChanges response — Gap 0 working exactly as intended. The bug was
  entirely inside `extract()`: `oBody.details[]` on the thrown error also
  carried both of these same two messages; `isDuplicate()` correctly matched
  the REAL one against the model's already-present copy and skipped
  re-adding it (so it stayed untagged — no `SOURCE_TAG`), but the generic
  wrapper detail did NOT match as a duplicate (e.g. target shape differs)
  and got freshly re-added WITH `SOURCE_TAG`. That made the old
  `removeDuplicateAutoMessages(aAdded)` run (guarded on "was anything added
  this pass") and blanket-remove EVERY untagged message with
  `technicalDetails.httpStatus` set — collaterally wiping out the real,
  untagged, duplicate-skipped message right along with the actual noise.
- **Fix**: `removeDuplicateAutoMessages()` now targets ONLY messages whose
  own text is itself `isGenericWrapper()` (never a blanket tag+httpStatus
  removal), and is gated on `hasRealMessage()` instead of "did extract() add
  something new this call" — the `aAdded` tracking that used to drive that
  guard was removed entirely, no longer needed. It's now structurally
  impossible for this cleanup step to remove a real business message,
  regardless of how `isDuplicate()` classified it.
- **Lesson**: "was something added this pass" is the wrong trigger for a
  cleanup/removal step — a message can be simultaneously real AND untagged
  (because it was correctly recognized as an existing duplicate and skipped).
  Any removal logic must judge each candidate message on its OWN merits
  (here: is its own text generic noise), never on a side-channel signal
  about unrelated work that happened in the same function call.


### Gap 1 — Pre-attempt clearing
`MessageExtractor.clearStaleMessages()` (new) removes only (a) messages this
module added, identified by `technicalDetails.source === "vrExtract"`, and
(b) technical messages the OData model itself added, identified by
`technicalDetails.httpStatus !== undefined` (the same signal
`EditRequestService.js#_hasConflictMessage` already relies on for its 412
check, so this reuses an existing, already-trusted convention rather than
inventing a new one). Called at the top of `CreateOrderService.js#save`
(create chain ①–④ entry point) and `EditRequestService.js#save` (change-mode
save entry point) — both are the actual entry points of their respective
save attempts, so no caller in `Detail.controller.js` needed to change to
get this coverage.

### Gap 2 — Duplicate suppression (tagging + dedup scheme, as implemented)
- **Tagging**: every message `MessageExtractor.extract()`/`addNote()` adds
  carries `technicalDetails: { source: "vrExtract", code, numericSeverity }`
  — `MessageExtractor.SOURCE_TAG` exports the literal string `"vrExtract"`
  for reuse/grep.
- **Add-time dedup** (`isDuplicate()`): before adding, an existing message is
  treated as a duplicate if its `target` matches (when either side has one),
  its `technicalDetails.code` doesn't conflict, and its display text
  *contains* the new message's raw (undecorated) text. Substring match, not
  equality, because our own decorated text embeds the raw text inside an
  item/field-label prefix and a `(CODE)` suffix (see Gap 3/4), while a
  model-auto message would carry the bare raw text only.
- **Post-add cleanup** (`removeDuplicateAutoMessages()`): after our tagged
  message(s) for this error are added, any *other*, untagged message already
  in `Messaging` matching the same (target, raw text) is actively removed
  from the shared message model — implemented as active removal from
  `Messaging` rather than a popover-only view filter, since `Messaging` is
  the single source feeding both the message-button badge
  (`formatter.messagePopoverButtonText/Type`) and the popover; removing
  duplicates there keeps both in sync automatically with no extra binding
  logic needed in `Detail.controller.js`/`Detail.view.xml`.
- `sap.m.MessagePopover`'s own `groupItems: true` (now set in
  `Detail.controller.js#_openMessagePopover`) covers the presentation half of
  Gap 4 (errors first, warnings collapsible) essentially for free.

### Gap 3 — Item/field attribution (implemented)
- `MessageExtractor` gained `ITEM_TARGET_RE` to match a target reaching
  through `_Item(SalesOrder='...',SalesOrderItem='000010')/...`, capturing
  and de-zero-padding the item number → prefixes `"Item 10: <text>"`
  (i18n key `msgItemPrefix`, format `"Item {0}"`).
- Header-only targets (never reachable through `_Item`) get a short field
  label prefix from a new `HEADER_FIELD_LABEL_I18N` map (`SoldToParty`/
  `SoldToPartyForCreate` → `msgFieldProvider`, `SalesOrderType` →
  `msgFieldOrderType`, `SalesOrganization` → `msgFieldSalesOrg`,
  `DistributionChannel` → `msgFieldDistributionChannel`,
  `OrganizationDivision` → `msgFieldDivision`). Unresolvable targets render
  the raw text untouched — never dropped, per the prompt's own rule.
- `extract()` gained an optional 3rd parameter, `oBundle` (a resource
  bundle), needed for the i18n'd prefixes above; both call sites
  (`onCreateSavePress`, and the now-newly-wired `onSectionSavePress`, see
  Gap "MessageToast removal" below) pass `this.getResourceBundle()`. Existing
  behavior is preserved if `oBundle` is omitted (attribution is skipped,
  text still shown as before) — backward compatible, not a breaking change
  to the function's existing contract.

### Gap 4 — Code + severity fidelity (implemented, with a documented gap)
- **Code**: `sap.ui.core.message.Message`'s public API was NOT confirmed to
  expose a first-class, renderable `code` property in this UI5 version
  (Onboarding guardrail 7 — never invent an API without verifying it) — the
  code is stashed in `technicalDetails.code` (safe, arbitrary bag, also used
  for dedup matching) AND appended to the display text as `"(VI/028)"`,
  per the prompt's own fallback instruction ("if the popover item doesn't
  render the code property, append it to the text instead") — confirmed the
  current `MessageItem` template in `_openMessagePopover` only binds
  `type`/`message`/`additionalText`/`description`, never a `code` property,
  so the fallback path is the one actually exercised today.
- **Severity mapping table** (`SEVERITY_MAP` in `MessageExtractor.js`):

  | `@Common.numericSeverity` | UI5 `MessageType` |
  |---|---|
  | 1 | Success |
  | 2 | Information |
  | 3 | Warning |
  | 4 | Error |
  | absent / unrecognized | Error (fail-loud default, per the prompt) |

  **TODO-VERIFY**: the exact annotation key/casing (`@Common.numericSeverity`)
  has not been seen on a live error body from this backend yet — this is
  the literal key name the prompt specified; flagging it as unverified
  rather than silently assuming it's correct.
- **Grouping**: `groupItems: true` on the `MessagePopover` (see Gap 2 above)
  — errors first, warnings collapsible, via the control's own built-in
  severity grouping rather than custom code.

### Gap 5 — Success-with-messages: OBSERVED BEHAVIOR NOT CAPTURED
No live backend access this session — could not exercise a real
successful-save-with-transition-warnings scenario to observe whether
`sap-messages`/action-response warnings land in `Messaging` automatically or
whether the badge reflects them. Per the prompt's own instruction, nothing
was built for this (no custom header parsing added). **Needs a live test**:
save a change that's expected to succeed but carry a backend warning, then
check `Messaging.getMessageModel().getData()` and the message button badge
immediately after.

### MessageToast removal from backend-failure paths
- `Detail.controller.js#onSectionSavePress`'s non-conflict failure branch
  previously showed a generic `MessageToast` (`editSaveError`) for every
  change-mode save failure alike — this was the one still-generic backend-
  failure path in the app and is now routed through the same
  `MessageExtractor.extract()` + `_openMessagePopover()` pattern the create
  flow already used, auto-expanding whichever section(s) the extracted
  messages resolved to (falling back to the section being saved if none
  resolved). The `editSaveError` i18n key is now unused but left in place
  (not deleted — out of this task's scope to prune unrelated i18n).
- `onCreateSavePress`'s `createPartialFailure` notice (order created despite
  an enrichment/IoH failure) was also converted from a `MessageToast` to a
  tracked `MessageExtractor.addNote(..., "Information")` call, so it shows
  in the same popover (grouped as Information, per Gap 4) instead of a
  separate, easy-to-miss toast channel, and gets cleared automatically by
  Gap 1 on the next save attempt like any other extractor-added message.
- Remaining `MessageToast` calls in `Detail.controller.js` (Validate button,
  Items Excel-export failure, both save-success toasts, both pre-flight
  client-side validation guards before any network call) are NOT
  backend-failure paths and were deliberately left alone — grep for
  `MessageToast\.show` in that file to re-verify this claim after any future
  change.

### Grep-check state (self-verified, static — not live-tested)
- `source: "vrExtract"` tagging: present on every message
  `MessageExtractor.extract()`/`addNote()` adds (verified by reading the
  code — `SOURCE_TAG` is the one and only place the literal string is
  defined, exported as `MessageExtractor.SOURCE_TAG`).
- `MessageToast` absent from backend-failure paths in create/edit flows:
  verified by grep — see "MessageToast removal" above for what's left and
  why each is out of scope.
- Sequencing prompt file: confirmed deleted (`file_search` found zero
  matches after deletion).


## v5 Sticky Amendment realignment — scratch-context/replay restored (2026-08-28)

`design/E008_CRUD1_v5_Sticky_Amendment.md` VOIDS the "Provider-first
bootstrap" mandate (Fix-Sequencing Prompt) that the section below described.
It reinstates CRUD Task 1 v4's original scratch-context + replay design as
the accepted architecture — confirmed to be exactly what was git-committed
before the Corrective Work Order (`git show 9c23e67`) — with four required
fixes layered on top:

1. **Group isolation**: the create replay (action call, item deep-creates,
   SaveChanges, header-extras PATCH) now runs entirely in a new dedicated
   group, `vrCreateReplay` (manifest.json + `ServiceSchema.createReplayGroup`),
   never `vrEdit`.
2. **Session hygiene**: `CreateOrderService.js#save` now calls the unbound
   `DiscardChanges` action (`ServiceSchema.discardAction`) as a best-effort
   cleanup whenever a replay step fails AFTER `CreateWithSalesOrderType` has
   already opened a sticky session.
3. **Sessionless PATCH persistence — UNVERIFIED, live-test task**: step ④
   (the header-extras replay) PATCHes the new, fully-numbered context with no
   `PrepareForEdit`/`SaveChanges` bracket around it. Needs a live check: set
   an `updatableHeaderProperties` field (e.g. Order Reason) during create,
   hard-refresh, VA03-check. If it doesn't persist, wrap that PATCH in an
   edit-session bracket instead (`EditRequestService.js`'s pattern).
4. **Replay-list drift guard**: `ServiceSchema.createReplayHeaderProperties`
   is now derived from `updatableHeaderProperties` (not hand-maintained), so
   there is nothing to keep in sync manually.

`CreateOrderService.js` and `Detail.controller.js`'s create-flow are rewritten
back to the scratch-context pattern (`enter()`/`save(oScratchContext,
oItemsBinding)`/`cancel()`, `_onCreateMatched` using
`CreateOrderService.enter()` + `setBindingContext()`, no more
`sectionFlags>/bootstrapped` gating anywhere). Two post-commit improvements
were preserved on top of the restored baseline (NOT reverted): the
`CustomerSalesArea`-based Provider picker (see section below) and
`MessageExtractor.js`-based error handling in `onCreateSavePress`.

This supersedes the "RAISE_SHORTDUMP resolved... SaveChanges re-added to
bootstrap" note that used to be here: that patch (chaining `SaveChanges`
directly into a standalone bootstrap-on-Provider-pick call) was built on the
now-void Provider-first-bootstrap architecture. The underlying finding it was
chasing (`CreateWithSalesOrderType` alone returns `SalesOrder:""`, `SaveChanges`
is what actually assigns the key) is still correct and is preserved — it's
just applied in the right place now: `SaveChanges` fires from
`CreateOrderService.js#save`, AFTER item deep-creates, at Save time, not
immediately after Provider is picked.

## v5 amendment update — UX phasing + triad sourcing (2026-08-28)

`design/E008_CRUD1_v5_Sticky_Amendment.md` was updated with a second layer of
design decisions, both implemented this session:

1. **Phased entry as pure UI gating**: createMode now opens with only the
   Provider field enabled; every other createMode field/Items row-action/IoH
   control is bound `enabled="{createState>/providerChosen}"` (new local
   JSONModel, reset false each time createMode is (re-)entered — see
   `Detail.controller.js#_setCreateMode`/`onInit`) and unlocks the instant a
   Provider is picked. Fields also used in normal Change-Mode editing (e.g.
   Order Reason, Sales Office/Group, Shipping Condition, item Qty/NDC) use the
   combined expression `{= !${sectionFlags>/createMode} || ${createState>/providerChosen} }`
   so this gating only applies during createMode, never during a normal edit
   session. Save's ①–④ choreography (`CreateOrderService.js#save`) is
   untouched by this — it's presentation-only.
2. **Sales-area triad sourced from the Provider picker, not hardcoded
   constants**: `_openShipToPartyValueHelpDialog` (Detail.controller.js) no
   longer filters `/CustomerSalesArea` down to the fixed
   `ServiceSchema.salesArea` triplet — only a soft pre-filter on
   SalesOrganization remains. A customer extended to multiple distribution
   channels/divisions now surfaces as multiple, disambiguated rows (area
   triad shown in the list item's `info`). The picked row's own
   `SalesOrganization`/`DistributionChannel`/`Division` are harvested onto
   the scratch context (`onProviderValueHelpRequest`) alongside `SoldToParty`,
   overwriting the constants `CreateOrderService.js#enter` seeded for display
   purposes only. `CreateOrderService.js#save` now reads these three off the
   scratch context first, falling back to `ServiceSchema.salesArea` only if a
   picked row somehow lacked them (should never happen in practice —
   TODO-VERIFY(B4) is kept as a fallback-only note, not deleted). This makes
   the "sold-to not defined for sales area" failure class unconstructible, as
   the design doc intended.
3. Required Fix 4 (replay-list drift guard) already had the stronger
   auto-derivation fix (`ServiceSchema.createReplayHeaderProperties` computed
   from `updatableHeaderProperties`); added the doc's requested short comment
   blocks to `Details.fragment.xml`/`OrgData.fragment.xml`/`Shipping.fragment.xml`
   on top of that, pointing at the auto-derivation.

## Provider picker showed duplicate rows for the same customer (2026-08-28)

`HeaderShipToParty` (backing the Provider/Ship-To value help,
`Detail.controller.js#_openShipToPartyValueHelpDialog`) is keyed by
`SalesOrder`, not `Partner` (design/so.xml ~line 1902) — it's a per-order
snapshot, so a customer with N past orders returned N rows, one per order.

**Proper fix (2026-08-28, supersedes an earlier client-side dedup
workaround)**: query the right entity set instead of masking symptoms on the
wrong one. Switched the picker to `/CustomerSalesArea` (design/so.xml ~line
1131), keyed by `Customer`+`SalesOrganization`+`DistributionChannel`+
`Division`, filtered to the fixed `ServiceSchema.salesArea` triplet that
`CreateWithSalesOrderType` requires anyway. That key structure makes
`(Customer, 1000, 10, 10)` unique per customer, so no dedup logic is needed
at all, and as a bonus only customers actually extended to that sales area
are selectable (previously any past ship-to could be picked, sales-area
extension or not). No `FormattedPostalAddressDesc` field exists on
`CustomerSalesAreaType`, so the picker now composes a display address from
`CityName`/`PostalCode`/`Country_Text` instead. See
`ServiceSchema.customerSalesAreaProperties`/`entitySets.customerSalesArea`.



## Correction — the shortdump is IN the bootstrap action call itself, not a follow-up batch (2026-08-28)

Re-testing after the fix below still shows the shortdump — but with the
circular-JSON logging bug also fixed, the console now shows it cleanly for
what it is: `CreateOrderService.bootstrap: CreateWithSalesOrderType failed`,
caused by `Error: HTTP request was not processed because $batch failed`,
itself caused by `Error: ABAP Runtime error 'RAISE_SHORTDUMP'`. This is the
**bootstrap action's own request** — there is no second batch involved this
time; the "second batch" theory in the section below was a real bug (worth
keeping fixed) but was NOT this dump's cause.

This is an **unhandled backend exception** (an ABAP short dump, not a normal
business-rule rejection) — it cannot be fixed or worked around from the UI5
app. **RULED OUT (2026-08-28)**: the `TODO-VERIFY(B4)` sales-area triplet in
`ServiceSchema.js` (`salesArea: {"1000","10","10"}`) was suspected as an
unverified customer-extension mismatch — confirmed (by the user, backend
side) that customer 40000421 IS extended (KNVV) to sales org 1000/
distribution channel 10/division 10, so this is NOT the shortdump's cause.
The hardcoding of that triplet itself is a deliberate, spec-mandated design
choice (`design/prompts/E008_CRUD1_Fix_Sequencing_Prompt.md`, Fix 1 pt.1 —
"seed with the values that worked in backend debugging"), not something
invented in this app; a real per-customer lookup entity (`/CustomerSalesArea`,
keyed by Customer+SalesOrganization+DistributionChannel+Division) exists in
`design/so.xml` (~line 1131) as a future option, but switching to it was
explicitly deferred by the user for now.

Remaining hypotheses (unconfirmed — need an ST22 dump to narrow down further,
browser console can't retrieve the actual dump/callstack, only the generic
"RAISE_SHORTDUMP" runtime error class): (a) sales order type `ZKB` not
customized/assigned to sales area 1000/10/10 (OVAZ — "assign sales order
types permitted per sales area" — a different check than customer
extension); (b) a RAP behavior-implementation bug specific to invoking
`CreateWithSalesOrderType` standalone/immediately.

To help correlate against an ST22 dump when one is available,
`CreateOrderService.bootstrap()`'s error log now also prints the exact 5
parameters sent (`SalesOrderType`/`SalesOrganization`/`DistributionChannel`/
`OrganizationDivision`/`SoldToPartyForCreate`) alongside the error.
`MessageExtractor.extract()` was also taught to walk the error's `cause`
chain so the popover shows "ABAP Runtime error 'RAISE_SHORTDUMP'" instead of
the uninformative generic "$batch failed" wrapper text.

**Action needed (not something this app can self-resolve)**: get the actual
ST22 dump (runtime error class/callstack) for this request from the backend
team — that's the only way to get a definitive root cause from here.

## Corrective Work Order follow-up — shortdump on the rebind after bootstrap (2026-08-28)

Live testing of the sequencing fix below surfaced a second bug: `CreateWithSalesOrderType`
itself completed fine (200, own `$auto` batch), but an immediate SECOND
`$batch` right after it came back `500` with an ABAP `RAISE_SHORTDUMP`. Root
cause was `_bootstrapCreate` rebinding the view with
`getView().setBindingContext(oNewContext)` where `oNewContext` was a bare
`Context` from an orphan `oModel.bindContext(...)` never attached to any
element binding — child property bindings in that state don't inherit the
context binding's `$$updateGroupId`, they fall back to the model's default
`"$auto"` group, so every header property in the view fired its own
immediate GET the instant the context was assigned, all merged into one
unwanted `$batch` — that's the request that hit the shortdump. Fix:
`CreateOrderService.bootstrap()` now resolves with the plain new order id
(a string) instead of a Context, and `_bootstrapCreate` rebinds via
`getView().unbindElement()` + `getView().bindElement({path, parameters:
{$$updateGroupId: "vrCreate"}})` — the same proven pattern
`_reloadHeaderContext`/`_onObjectMatched` already use for the change-mode
spine, so header property reads correctly stay deferred under `vrCreate`
instead of auto-firing.

Also fixed while investigating: the diagnostic `console.error(...,
JSON.stringify(Messaging.getMessageModel().getData(), null, 2))` calls added
for Fix 1/2 could themselves throw `Converting circular structure to JSON`
(`sap.ui.core.message.Message#processor` points back at the model itself) —
this was masking the real backend error in the console with an unrelated
`TypeError` and made the shortdump above harder to diagnose than it should
have been. Fixed by passing the live message array/objects straight to
`console.error` instead of stringifying them — devtools renders circular
objects fine natively.

## Corrective Work Order — Create Flow Sequencing Fix (2026-08-28)

Follow-up to v4 below: v4's own design had a group-contamination bug baked
in — `CreateWithSalesOrderType` rode inside the Save batch, under `vrEdit`
(the change-mode group), alongside unrelated header PATCHes/item creates. A
failure anywhere in that shared changeset (a bad item row, a rejected PATCH)
produced one generic `createSaveError` toast indistinguishable from an actual
bootstrap failure, and there was no clean way to tell "order was never
created" apart from "order was created but a later step in the same batch
failed" — both surfaced identically.

**Sequencing correction**: `CreateWithSalesOrderType` now fires alone, the
instant Provider is confirmed in the value-help picker (createMode only) —
never inside Save, never under `vrEdit`, and never under `vrCreate` either.
It runs in its own group, `bootstrapGroup: "$auto"` (`ServiceSchema.js`),
which submits immediately and can't be batched with anything else — see
`CreateOrderService.js#bootstrap`. On success the Detail view is rebound
directly to the real, canonical `/SalesOrderManage(key)` context the action
returns (no more transient scratch context/replay-at-Save — every createMode
fragment now binds straight to the real entity, two-way, in the deferred
`vrCreate` group), and `sectionFlags>/bootstrapped` flips true to unlock the
rest of the form (`Detail.controller.js#_bootstrapCreate`). Save
(`onCreateSavePress`) is now just `submitBatch("vrCreate")` — the header
PATCHes/item creates that batch already accumulated — followed by the
existing enrichment/IoH follow-up steps. Cancel after a successful bootstrap
discards that batch and deletes the just-created skeleton order
(`CreateOrderService.cancel`); cancel before bootstrap is a plain
navigate-back, since nothing exists yet.

**Field gating (Fix 3)**: pre-bootstrap, only the Provider field is enabled —
everything else (Details/Shipping/OrgData inputs, the Items toolbar, the
whole IoH table) is disabled via the `bootstrapped` flag, not just
`visible`. Post-bootstrap, the three sales-area fields
(SalesOrganization/DistributionChannel/OrganizationDivision) are fixed by the
action and now render as read-only `Text` in createMode too (previously
user-editable ComboBoxes) — see `OrgData.fragment.xml`. Provider itself stays
read-only once bootstrapped, with a tooltip explaining that changing it means
cancelling and starting over (`providerLockedTooltip`, i18n).

**Sales-area constants**: `ServiceSchema.salesArea`
(`salesOrganization`/`distributionChannel`/`organizationDivision` = "1000"/
"10"/"10") is new — sourced from a live backend-debugging session
(2026-08-27, provider "TALBERT MEDICAL GROUP") rather than invented. Tagged
`TODO-VERIFY(B4)` in `ServiceSchema.js`: the correct sales-area combination
for a brand-new order is a backend business rule, and this triplet needs to
be re-confirmed live before being treated as final — a wrong value here
fails `CreateWithSalesOrderType` itself, and Fix 4's `MessageExtractor` (not
a generic toast) is what will surface that rejection if so.

**Group-contamination risk note**: this is the root cause the whole
corrective work order exists to fix — `$auto` (bootstrap), `vrCreate`
(create-mode Save), and `vrEdit` (change-mode Save) must never mix. Mixing
an immediate/auto-submit action into a deferred batch, or a create-mode
batch into an edit-mode group, reproduces exactly the "one failure looks
like every other failure" symptom this fix addresses. Grep check: `vrEdit`
should only appear in change-mode paths (`EditRequestService.js`,
`Detail.controller.js` comments about the change-mode spine) — confirmed
clean as of this pass.

**Shared error extraction (Fix 4)**: new `model/MessageExtractor.js` parses
OData V4 action/batch error bodies (lead `message` + `details[]`, each
optionally carrying a `target`) into `sap/ui/core/Messaging`, maps
recognized targets to their owning section (`details`/`orgData`/`items`) so
it can be auto-expanded, and returns the list of section ids touched.
Bootstrap failure and Save/enrichment/IoH failure both route through it now
— the generic `createSaveError` toast is gone from every create-flow failure
path; only the message popover (`_openMessagePopover`, extracted from the
old `onMessagePopoverPress`) surfaces them.

**SaveChanges — open risk, needs live re-verification**: repo memory
(`/memories/repo/vtrcks-create-order-sticky-session.md`) documents a live
test one day before this pass (2026-08-27) showing
`CreateWithSalesOrderType` alone returns `SalesOrder:""` — i.e. this entity
set is `SAP__session.StickySessionSupported`, and the action only opens a
buffered sticky session; the sticky `SaveAction` (`SaveChanges`) was
required to actually assign a real key in that test. This corrective work
order's Fix 1 explicitly calls for the action alone to be sufficient, and
per an explicit decision at the start of this pass, **`SaveChanges` was
dropped** — `bootstrap()` in `CreateOrderService.js` now throws if
`CreateWithSalesOrderType`'s own result still comes back with an empty key,
with a `TODO-VERIFY(B4)` comment spelling out exactly what to re-add
(`SaveChanges`, still as one ungated, immediate operation next to the
action — never deferred into `vrCreate`/`vrEdit`) if that empty-key symptom
recurs against the live backend. Treat this as unverified until re-tested.

## CRUD Task 1 v4 — Action-Based Create supersedes v3's spine (2026-08-26)

Live testing surfaced `405 Method Not Allowed` / "Creating operations are
disabled for entity '$SRVD#C_SALESORDERMANAGE_SD~C_SALESORDERMANAGE'" on
Save. Root cause confirmed in `design/so.xml`, `Annotations
Target="SAP__self.Container/SalesOrderManage"` (~line 10234): a static,
unconditional `SAP__capabilities.InsertRestrictions.Insertable="false"` — a
raw POST/deep-insert against `SalesOrderManage` can never succeed on this
service, no matter the payload. This invalidates v3's "standard CRUD create"
spine assumption below (a transient list-binding context + one
`submitBatch`) — that POST was always going to 405.

The service instead exposes a bound action, `CreateWithSalesOrderType`
(`SalesOrderType`/`SalesOrganization`/`DistributionChannel`/
`OrganizationDivision`/`SoldToPartyForCreate`, all `Nullable="false"`,
returns the new `SalesOrderManageType`) — also flagged via a
`Session.NewAction` annotation pointing at it in the same metadata, and
already noted below (v1 section, "Confirmed blocker") as the only creation-
shaped action this service actually exposes.

**Fix, not a redesign of the UI**: rather than rewrite every createMode
fragment (Details/OrgData/Shipping/Items all bind directly to the createMode
binding context), the v3 transient context is kept as a local scratchpad
only — fragments keep editing it exactly as before, in the deferred
`vrCreate` group, but that group's own batch is never submitted (the POST it
would produce always 405s). At Save (`CreateOrderService.js#save`), its
accumulated header/item values are harvested and replayed as: (1) the
`CreateWithSalesOrderType` action call, (2) a PATCH of any other header field
the action doesn't accept (`ServiceSchema.createReplayHeaderProperties`:
ExIS ID/Sales Office/Sales Group/Shipping Condition/Order Reason — all
already-confirmed-PATCHable-on-an-existing-order fields per the Change Mode
edit flow), (3) real deep-creates of each scratch item row — all against the
new real context, in `vrEdit` (the same group + `_Item` nav
`onItemsAddRow`/edit-mode "Add Item" already uses successfully). The scratch
context is then discarded locally (`delete()`).

Net effect: two sequential batches instead of v3's one (the item creates
can't be expressed until the header action returns a real key), but every
individual request this now sends is one already proven to work against this
service. Added client-side validation for the three Org Data fields
(`onCreateSavePress`) since they're now required action parameters, not just
UI nice-to-haves.

## CRUD Task 1 v3 — In-Place Create supersedes the Create dialog (design/prompts/CRUD Task 1 Prompt v3.md, ADDENDUM-001)

Replaces the v2 Create dialog design (design/NEwVaccReq.md, CRUD Task 1 v2)
entirely, per the user's explicit architecture change (`design/Architecture
change.md`) and `design/prompts/CRUD Task 1 Prompt v3.md`. Creation now
happens in-place in the Detail view (new `"create"` route, same view/
controller/target as `"detail"`), via a standard OData V4 CRUD spine: a
transient list-binding context in a new deferred update group `vrCreate`
(`manifest.json` groupProperties, `ServiceSchema.createUpdateGroup`), one
`submitBatch("vrCreate")` — no custom `OrderCreate` action, no payload
contract. `PAYLOAD_CONTRACT.md`'s `OrderCreate` action design is now void;
left in place as historical record, not deleted.

**Scope decision (user-approved, "Build spine now, stub the rest")**: the
client-side spine (steps ① create+submitBatch, ④ rebind/exit/refresh) is
fully functional. Steps ② (post-create "enrichment action" — Description/
Status/Category/Contact) and ③ (IoH deep-create) are BLOCKED-BY-SERVICE —
neither the enrichment action (a planned BDEF extension action per
ADDENDUM-001) nor the IoH BO/companion service `ZUI_VR_EXT`
(`design/prompts/e008_ext_build.md`) is activated on-system. Both are stubbed
in `CreateOrderService.js` (`ServiceSchema.enrichmentAction`/`iohCreateAction`
are `null` — never invented) and resolve `{skipped:true, reason:...}`.
Affected fields (Description/Status/Category/Priority) stay read-only in
createMode too; IoH rows are collected locally but not persisted — a real
functional gap, documented here and in `OPEN_QUESTIONS.md`, not silently
degraded.

**Partial-failure semantics implemented exactly as specified**: step ①
failing keeps the user in createMode with messages. Step ②/③ failing (only
possible once the stubs above are replaced with real calls) means the order
already exists — the user is dropped into the normal saved-order view with a
message, no compensating deletes (`Detail.controller.js#onCreateSavePress`/
`_completeCreate`).

**Key implementation notes**:
- Deleted `controller/CreateRequestDialog.js`, `view/fragments/CreateRequestDialog.fragment.xml`,
  `service/CreateRequestService.js`. New `service/CreateOrderService.js` is the
  only place the literal `"vrCreate"` group id appears outside
  `ServiceSchema.js`/`manifest.json` (grep isolation, same convention as
  `EditRequestService.js`/`"vrEdit"`).
- `sectionFlags` model gains a top-level `/createMode` boolean. The four
  `editLive` sections (Details/Items/Shipping/Org Data) simply get their
  existing `/{id}/editing` flag forced `true` for the duration of createMode —
  their existing Change-Mode Input/ComboBox toggles show with **zero fragment
  changes**. `SectionFactory.js` suppresses the per-section Edit/Save/Cancel
  buttons whenever createMode is on (global Save/Cancel live on the
  DynamicPage title instead, `Detail.view.xml`).
- `SectionConfig.js` gained a `createVisible` flag: sections without it are
  hidden entirely while createMode is on (`SectionFactory.js` panel `visible`
  binding + matching anchor-strip visibility in `Detail.view.xml`). Two new
  sections added: `partiesInvolved`, `attachments` — both always read-only
  placeholders (no per-partner write entity / no attachment entity exists in
  this service at all, in any mode).
- **Items table update-group problem (the main technical obstacle)**: a
  nested `_Item` list binding's `$$updateGroupId` must match its parent
  context's own group for a deep create, but this parameter can only be set
  as a binding-time literal — it cannot be an XML expression binding that
  switches between `"vrEdit"` (existing order) and `"vrCreate"` (transient
  order) depending on route. Resolved by stripping the parameter from
  `Items.fragment.xml`'s static binding entirely and rebinding it
  programmatically (`Detail.controller.js#_rebindItemsGroup`, reusing the
  XML-declared template via `oTable.getBindingInfo("items")`) the first time
  the Items panel's content loads — a new `SectionFactory.js` content-loaded
  callback hook fires this regardless of whether the panel was expanded by
  the user or forced open by createMode.
- **Org Data**: `SalesOrganization`/`DistributionChannel`/`OrganizationDivision`
  are creatable-only per the finding in the entry below (backend rejects PATCH
  on an existing order) — new ComboBoxes for these three are visible **only**
  when `/createMode` is true (not tied to `/orgData/editing`, unlike
  SalesOffice/SalesGroup, which stay editable in normal edit sessions too).
  Entity sets + `_Text` property names confirmed in `design/so.xml`
  (`SalesOrganizationType.SalesOrganization_Text`,
  `DistributionChannelType.DistributionChannel_Text`,
  `OrganizationDivisionType.Division_Text`).
- **Provider** (`SoldToParty`): only writable at create time; a plain
  required `Input` (no VH — see the CRUD Task 1 v2 entry below, a full F4
  dialog was judged disproportionate scope and that judgment still holds).
- Master's Create button now navigates to the `"create"` route instead of
  opening a dialog (`Master.controller.js#onCreateRequest`); an `EventBus`
  channel `"app"`/`"orderCreated"` (deliberately distinct from the `"vrCreate"`
  update-group literal) lets `Detail.controller.js` notify Master to refresh
  its list after a successful in-place create, mirroring the old dialog's
  success-callback responsibility split.
- `Enums.js`'s `PRIORITY`/`ORDER_REASON`/`CATEGORY`/`INTENTION` arrays are now
  fully unused (Order Reason already uses a real VH; Priority/Category/
  Intention remain hard BLOCKED-BY-SERVICE regardless of createMode) — left
  in place (harmless), only `MIN_ITEMS` is still referenced
  (`CreateOrderService.js#hasMinItems`).

## CRUD Task 2 follow-up — Shipping, Org Data, Billing wired editable (2026-08-21)

Extended the Change Mode pattern (Details/Items) to three more sections, per
user request. Same mechanics reused as-is: `editLive` in `SectionConfig.js`,
generic Edit/Save/Cancel wiring in `SectionFactory.js`/`Detail.controller.js`,
`vrEdit` update group inherited from the header's `bindElement` context (no
per-field `$$updateGroupId`), full context reload on save (`_aSectionsNeedingFullReload`)
since all three sections' editable fields are code/text nav pairs subject to
the same "Key predicate changed" `requestSideEffects` limitation already found
for Order Reason.

Step-0 (metadata.xml annotation check — no `Core.Immutable`/`Core.Computed`):

- **Shipping** — `ShippingCondition` confirmed editable (real fixed-values VH,
  entity set `ShippingCondition`). `OverallDeliveryStatus`/`OverallDeliveryBlockStatus`
  confirmed `Core.Computed` (server-derived aggregates) — correctly stay
  read-only, unchanged.
- **Billing** — `CustomerPaymentTerms` confirmed editable (`Common.FieldControl`,
  no Computed; VH entity set `CustomerPaymentTerms`). `OverallOrdReltdBillgStatus`/
  `OverallBillingBlockStatus` confirmed `Core.Computed` — stay read-only.
  Payer/Bill-To Party (`_SoldToPartyContactInfo`) are read-only contact-derived
  fields with no update path of their own — left untouched.
- **Org Data** — `SalesOffice` and `SalesGroup` confirmed editable (no
  Immutable/Computed, real VH entity sets). `SalesOrganization`,
  `DistributionChannel`, `OrganizationDivision` were initially left read-only as
  a judgment call (see below), then wired editable on 2026-08-21 per explicit
  user request ("Org Data: all fields should be editable") — **and reverted
  back to read-only the same day**: live testing confirmed the predicted risk,
  the backend rejects the PATCH with `"Read-only fields must not be changed"`
  for all three. This confirms their `Common.FieldControl` dynamically
  resolves to read-only for an existing sales order (standard SD behavior —
  the sales area is fixed at document creation), even though the static
  `$metadata` annotation alone doesn't say so. Lesson: a missing static
  `Core.Immutable`/`Core.Computed` annotation is **not** sufficient proof a
  field is actually writable when `Common.FieldControl` is present and
  dynamic — it must be live-tested, not just read from the metadata, before
  trusting it. Service Org Unit/Service Organization remain the existing
  em-dash BLOCKED-BY-SERVICE placeholders (no such fields exist on this
  service at all).
- **Billing — Payer/Bill-To Party CANNOT be wired editable; this is a hard
  metadata fact, not a judgment call**, discovered while implementing the
  2026-08-21 "all fields editable" request. Both are properties of
  `_SoldToPartyContactInfo` (`StandardPartnerContactInfoType`), and the
  `StandardPartnerContactInfo` EntitySet has an explicit
  `SAP__capabilities.UpdateRestrictions.Updatable = false` (also
  `Insertable`/`Deletable = false`) in `metadata.xml` — it's a read-only
  convenience projection, not a writable partner record. The real partner data
  lives in a separate `_Partner` collection (`HeaderPartnerType`, keyed by
  `PartnerFunction`) with its own bound `CreatePartner` action — changing
  Payer/Bill-To for real would mean updating/creating rows in that collection
  (by `PartnerFunction` role, e.g. `RG`=Payer, `RE`=Bill-to) via that action,
  which is a materially different and larger feature than a simple field edit
  (no existing UI section reads `_Partner` at all today). Left read-only this
  pass; flagged in `OPEN_QUESTIONS.md` as a separate follow-up task, not
  attempted here. `OverallOrdReltdBillgStatus`/`OverallBillingBlockStatus`
  remain read-only too — confirmed `Core.Computed` (server-derived), not a
  writable field under any circumstance.
- Display text upgrade: Shipping's Shipping Condition and Billing's Payment
  Terms display Text switched from the raw code
  (`{ShippingCondition}`/`{CustomerPaymentTerms}`) to the expanded VH text
  (`_ShippingCondition/ShippingCondition_Text`/`_CustomerPaymentTerms/CustomerPaymentTerms_Text`),
  matching the Order Reason display pattern, since both now have a real VH
  with a proper description.

## CRUD Task 2 v2 — Change Mode (per-section edit, PATCH + ETag) — 2026-08-19

Implemented per `design/Work Order 2 - CRUD Task 2 - Change Mode.md` (v2 —
supersedes v1's draft-protocol design). v2's rationale: the `R_SalesOrderTP`
BDEF was verified in ADT as **unmanaged, no draft, late numbering, lock
master, ETag master LastChangeTime**. Independently re-confirmed against the
service actually bound today (`C_SALESORDERMANAGE_SRV`/`C_SALESORDERMANAGE_SD`):
`design/so.xml`/`localService/metadata.xml` carries `SAP__core.OptimisticConcurrency`
on `SalesOrderManageType/LastChangeDateTime` (matches "etag master
LastChangeTime") and, per the P1 finding already on record (`PHASE2_AUDIT.md`),
no `IsActiveEntity` key exists anywhere. **This closes gate item #1 for good**:
edit is a plain PATCH against the active entity; concurrency is ETag/412; no
draft artifacts (Edit/Activate/Discard, DraftAdministrativeData) were built —
v1's draft choreography never shipped and is not present anywhere in this repo.

### Step-0 findings (some deviate from the work order's assumptions — verified, not assumed)

- **Order Reason (`SDDocumentReason`)** — confirmed real and editable: no
  `Core.Immutable`/`Core.Computed` annotation, and it carries a genuine fixed
  value list (`SAP__common.ValueListReferences` → `c_slsdocallowedorderreasonvh`,
  `ValueListWithFixedValues`). Wired as a `ComboBox` bound to the `SDDocumentReason`
  entity set directly (same VH-entity pattern already used for Delivery Block
  Reason in the Master filter bar).
- **ExIS ID / Customer Reference (`PurchaseOrderByCustomer`)** — confirmed real
  and editable (no Immutable/Computed annotation). Wired as a plain `Input`.
- **Priority — deviates from the work order's expectation.** The work order
  assumed Priority would be writable; Step-0 re-confirms the pre-existing
  Phase 2 finding (`PHASE2_AUDIT.md` Section B/E) that there is **no
  header-level Priority field at all** on `SalesOrderManageType` (item-level
  only, via `SalesOrderItemType/DeliveryPriority`). Not wired as editable —
  still the same em-dash placeholder as before. This is a metadata fact, not a
  writability question, so there is nothing to "make editable" here without
  inventing a field.
- **Category — not wired as editable.** `headerProperties.category` is an
  alias to `SalesOrderType` (a display placeholder only, no real dedicated
  Category field exists — see the Phase 2 audit entry). Wiring "Category" as
  editable would silently PATCH `SalesOrderType` on a live SD order under a
  misleading label — judged unacceptable risk for a field that was never a
  real field to begin with. Stays the existing em-dash placeholder.
- **Description — confirmed NOT writable** (as the work order expected): no
  real Description/KTEXT field or update micro-action exists in the bound
  `$metadata` (`headerProperties.description` is an alias to `SalesOrder` for
  display only — pre-existing BLOCKED-BY-SERVICE finding). Stays read-only,
  now with an explanatory tooltip (`editDescriptionUnavailable`).
- **Item Quantity (`RequestedQuantity`)** — confirmed editable (governed by a
  `SAP__common.FieldControl` reference, no Immutable/Computed annotation).
  Wired as an `Input` shown only during an Items edit session.
- **Item "Intention" — cannot be wired at all, deviates from the work order.**
  The work order asks for Add Item to include "Intention with NDC-default
  logic per TS-B2.2" (`design/TechSpecs/TS_B2-2_NDCVH.docx`). That field
  (`itemProperties.orderIntention`) has **no backing property anywhere in the
  bound `$metadata`** — this was already established BLOCKED-BY-SERVICE in the
  Phase 2 pass (same status as Fund Type/PO Reference/Brand) and remains so;
  there is nothing to PATCH. `TS_B2-2_NDCVH.docx` is a binary `.docx` not
  parsed in this pass (no text-extraction tool used), but even its NDC-default
  logic couldn't be wired regardless, since the target field doesn't exist on
  this service. Add Item therefore only sends NDC (`Product`) + Quantity
  (`RequestedQuantity`, unit fixed to `EA` via the existing
  `ServiceSchema.createPayloadUom`); the Intention column keeps its pre-existing
  em-dash placeholder for new rows too.
- **NDC value help** — not live (`ZI_VR_NDCVH` still pending, see
  `OPEN_QUESTIONS.md` item 11.3), so the new-row NDC field is a plain `Input`,
  matching the CRUD Task 1 precedent.
- **Contact / Employee Responsible** — stay read-only this task; partner-change
  writability ruling is still pending (see `OPEN_QUESTIONS.md`).

### Message-to-panel auto-expand — did not actually exist before this task

`UI5_AGENT_PLAYBOOK.md` §3.6 and this work order's Step-0 both describe a
"message-to-panel auto-expand" mechanism as an existing Phase 2 deliverable —
a repo-wide grep found no such code anywhere before this task. Built the
minimal version this task actually needs: `SectionFactory.prototype.expandSection(sSectionId)`
(expand the panel + ensure its fragment content is loaded). In practice the
editing section is already expanded when Save is pressed (Save only lives in
that section's own headerToolbar), so this mostly documents the mechanism
explicitly rather than doing real work today — a general message-target-path →
section resolver for arbitrary collapsed panels was judged out of scope
(over-engineering for a 2-section task) and is not built; flag for whoever
picks up the next `editLive` section.

### 412 (ETag conflict) handling — also built fresh, no pre-existing "reload dialog"

Contrary to this work order's phrasing ("existing reload dialog"), a grep
found no prior 412/MessageBox/reload-dialog code anywhere in the app —
`UI5_AGENT_PLAYBOOK.md` §3.5 was a documented *pattern*, not shipped code.
Built it in `Detail.controller.js#_showConflictDialog`, following that pattern.
Detection of "is this actually a 412, not just a validation error" relies on:
`oModel.submitBatch("vrEdit")` resolving (V4 batches resolve even when an
individual change failed) → check `oModel.hasPendingChanges("vrEdit")` → if
true, inspect `Messaging.getMessageModel()` for a message whose
`getTechnicalDetails().httpStatus === 412`. The `getTechnicalDetails()` shape
is `TODO-VERIFY` (`EditRequestService.js`) — not yet exercised against a real
412 response; flagged for live verification per the Definition of Done.

### `EditRequestService.js` — the gate-item-#1 closing paragraph

~70 lines. Public surface: `beginEdit(oContext, sSectionId, aProperties)`
(snapshot bookkeeping only — no server round trip), `save(oContext)`
(`submitBatch("vrEdit")` + pending-changes/message inspection for 412
detection), `cancel(oContext)` (`resetChanges("vrEdit")`). No draft context,
no `IsActiveEntity`, no Edit/Activate/Discard actions, no
`DraftAdministrativeData` anywhere in this module or any file it touches (grep
clean). **Judgment**: client complexity is exactly as trivial as v2 predicted
— the entire "edit" feature is two model calls (`submitBatch`/`resetChanges`)
plus ordinary two-way XML bindings with a `$$updateGroupId` parameter; the
serialization ("one section at a time") and Save/Cancel button choreography
live in `Detail.controller.js`/`SectionFactory.js`, not in this service. v1's
draft-protocol design (Edit/Activate/Discard actions, draft-context rebinding,
own/foreign-draft resume logic) would have been substantially more code and
more edge cases for a service that, per the BDEF finding, never needed any of
it. This is primary evidence for the MVP-2 architecture gate discussion:
non-draft RAP BOs make client-side change handling materially simpler than the
draft protocol, at least for this single-section-at-a-time edit model.

### Runtime correction — Order Reason display text stale after Save

Live smoke test: after editing/saving Order Reason, the on-screen text (bound
to `_SDDocumentReason/SDDocumentReason_Text`) kept showing the pre-save value
until the order was reopened. Root cause, found across two iterations:
1. The PATCH updates the `SDDocumentReason` code only; V4 doesn't
   auto-refetch the expanded text-nav entity for a changed foreign key.
2. `requestSideEffects(["_SDDocumentReason/SDDocumentReason_Text"])` (first
   attempted fix) throws `Key predicate of '_SDDocumentReason' changed from
   undefined to ('200')` — changing the code points that to-one nav at a
   *different* entity, and `requestSideEffects`' cache-merge logic rejects a
   nav target's identity changing (it expects only property values within
   the same target to change, not which target the FK points to).
Fixed by dropping `requestSideEffects` entirely for this case and doing a
full context reload instead — `unbindElement()` + `bindElement()` on the same
path, i.e. exactly what happens when reopening the order (which the user
confirmed always shows the correct value). Scoped to the Details section only
via `_aSectionsNeedingFullReload` (`Detail.controller.js#onSectionSavePress`/
`_reloadHeaderContext`), since Items' editable fields (Quantity, NDC) have no
such to-one code/text nav.

### Runtime correction — `$$updateGroupId` is not a property-binding parameter

Live smoke test threw `Unsupported binding parameter: $$updateGroupId` from
`ODataPropertyBinding`. That parameter is only supported on context/list
bindings (`ODataContextBinding`/`ODataListBinding`), not on individual property
bindings. Fixed by moving it up: the header's `view.bindElement(...)` (in
`_onObjectMatched`) now carries `parameters: { $$updateGroupId: ServiceSchema.editUpdateGroup }`,
and the Items table's `_Item` list binding already carried it correctly.
Removed the (invalid) per-field `parameters: {$$updateGroupId: 'vrEdit'}` from
the Order Reason `ComboBox`, ExIS ID `Input`, and the Items NDC/Quantity
`Input`s — plain property bindings now inherit the update group from their
owning context/list binding, per the V4 model's group-ID resolution rules.

## E008 Prototype Repoint (temporary C_SALESORDERMANAGE) - 2026-07-28

### Metadata Discovery (Step 0)

- Metadata source used: `design/so.xml` (local service metadata snapshot).

### Confirmed service facts from so.xml

- Service root URL: `/sap/opu/odata4/sap/c_salesordermanage_sd/srvd/sap/c_salesordermanage/0001/`
- Header entity set: `SalesOrderManage` (EntityType `SalesOrderManageType`)
- Item entity set: `SalesOrderItem` (EntityType `SalesOrderItemType`)
- Header key: `SalesOrder` only (no `IsActiveEntity` key in metadata)
- Header -> item navigation: `_Item`
- Header -> partner navigation: `_Partner` (to `HeaderPartner`)
- Header -> ship-to navigation: `_ShipToParty` (to `HeaderShipToParty`)
- Header -> contact navigation: `_SoldToPartyContactInfo` (to `StandardPartnerContactInfo`)
- Status value list set: `OverallSDProcessStatus` with text `OverallSDProcessStatus_Text`

### Provisional schema values (all TODO-VERIFY)

- Remaining TODO: E008 order-type allow-list currently keeps placeholder `ZVR1` until backend confirms full set.

### Draft and scope behavior implemented

- Fixed list filter for order type allow-list: `SalesOrderType in [ZVR1]` (placeholder)
- `IsActiveEntity` fixed filter was removed because the key/property is not present in `so.xml` metadata.

### Custom fields

- `ZZ1_*` fields found on item entity:
  - `ZZ1_SKIPADDANC_SDI`
  - `ZZ1_OptOutAncillary_SDI`
  - `ZZ1_SKIPANC`
- No `ZZ1_*` fields found on `SalesOrderManageType` header entity in this metadata file.

### Validation-session warning

- The standard service will show all authorized SD orders unless the order-type filter is correctly configured.
- DCL jurisdiction scoping from the custom E008 service is not present in this temporary service shape.

## Frontend Runtime / Deploy Findings - 2026-07-28

### Verified local runtime facts

- Dev host in use: `https://sapapp2dh1.cdc.gov:44300` with client `100`.
- The host serves UI5 core from `/sap/public/bc/ui5_ui5/resources/sap-ui-core.js`.
- The host does **not** expose `sap/ushell/bootstrap/sandbox.js` at the public UI5 resource/test-resource paths that were probed.
- Working local sandbox pattern for `frontend/cockpit`:
  - proxy `/sap` to the host
  - proxy `/resources` to `https://sapapp2dh1.cdc.gov:44300/sap/public/bc/ui5_ui5`
  - serve `/test-resources` locally from UI5 tooling
- `webapp/localService/metadata.xml` was created from `design/so.xml` because the generated local profile expected a metadata file that was missing.

### Deployment findings

- `ui5-deploy.yaml` was generated with:
  - app name `ZCDC_VTRCKS`
  - package `ZCM`
  - target host `https://sapapp2dh1.cdc.gov:44300`
  - client `100`
- `fiori deploy --testMode true` builds successfully and reaches the ABAP authentication prompt.
- On this workstation/landscape, `fiori deploy` does not consume the developer's SNC session; it prompts for HTTP credentials.
- If the developer has SNC-only access and no ABAP password, deployment must be done through an SNC-enabled SAP-side tool/session instead of the Node CLI.
- `ui5-deploy.yaml` still contains `transport: REPLACE_WITH_TRANSPORT`; do not treat it as production-ready until a real transport path is decided.

## Guardrail Doc Gap + Service Activation Finding - 2026-07-29

### Guardrail doc gap (documentation only, not a real conflict)

- `AGENT_ONBOARDING.md` §3 guardrail #6 bans referencing `C_SalesOrderManage*` in any layer, with no exception noted.
- `design/E008 prototype repoint prompt.md` is the actual instruction that authorized this bridge, and explicitly names the V4 service definition `C_SALESORDERMANAGE_SD` (not the classic V2 `C_SALESORDERMANAGE_SRV`) as an **interim decision by the backend team**, expected to be temporary until `ZUI_VACCINEREQUEST_O4` is available.
- So this is a sanctioned exception, not a rogue deviation — but `AGENT_ONBOARDING.md` guardrail #6 was never updated to reference the repoint prompt/exception, so any agent reading only the onboarding doc will (as I initially did) incorrectly flag it as a violation. TODO: add a one-line pointer in guardrail #6 to `design/E008 prototype repoint prompt.md` so this stops getting re-flagged.

### RESOLVED: root cause was a swapped URL segment, not a backend activation issue

- Symptom: `sap.ui.model.odata.v4.ODataListBinding` errors: `Service group 'C_SALESORDERMANAGE_SD' not published`, underlying `Could not load metadata: 404 Not Found`, when running the deployed FLP tile.
- The V4 OData URL pattern on this system is `/sap/opu/odata4/sap/{service-group/binding name}/srvd/sap/{service-definition name}/{version}/`.
- The manifest/ServiceSchema had the two segments **swapped**: `.../c_salesordermanage_sd/srvd/sap/c_salesordermanage/0001/` (service group = `_sd`, service definition = no suffix).
- User confirmed via direct backend test that the actually-published path is `.../c_salesordermanage_srv/srvd/sap/c_salesordermanage_sd/0001/` — service group (binding) name is `c_salesordermanage_srv`, service definition name is `c_salesordermanage_sd`.
- Fixed in 4 places: `webapp/manifest.json` (`dataSources.mainService.uri`), `webapp/model/ServiceSchema.js` (`serviceRoot`), `ui5-local.yaml` (`urlBasePath`), `ui5-mock.yaml` (`urlPath`). `dist/**` copies are stale build output and will be regenerated on next `npm run build`; not hand-edited.
- Lesson for future agents: when a V4 service reports "service group 'X' not published", double-check which URL segment `X` is being read from — it may be a segment-order/name mismatch in the manifest rather than an actual backend activation problem.

## Prototype Stabilization Pass (live-backend bug fixes) - 2026-07-29

Found and fixed while running the cockpit against the real dev-system service, one console error at a time:

- **Whole-entity `path: "."` binding anti-pattern (400 Bad Request on `SalesOrderManage('...')/.`)**: with `autoExpandSelect: true`, OData V4 needs concrete property paths to compute `$select`; binding a control to `"."` isn't resolvable and the model issued a literal (invalid) request for path `.`. Fixed in `Master.controller.js` (`_bindMasterItems`, table cell bindings) and `Detail.controller.js` (new `_bindDetailHeader()` method, called after `bindElement` in `_onObjectMatched`) — both now bind explicit `ServiceSchema.*` property paths/`parts` instead of the whole row/entity. `Detail.view.xml` controls lost their inline bindings in favor of stable IDs bound programmatically (keeps the "no literal entity/property names in views" isolation rule from the repoint prompt). `formatter.js`'s `master*`/`detail*` functions were changed to accept plain values instead of a row object; the now-dead `getValue(oRow, sProperty)` helper was removed. `sections/*.fragment.xml` were checked and do **not** have this anti-pattern.
- **`sap.ui.comp.filterbar.FilterBar` unknown setting `showAdaptFiltersButton`**: that property belongs to the newer, different `sap.ui.mdc.FilterBar` control, not this one. Verified against the live SAPUI5 1.136.0 API metadata; correct property on this control is `showFilterConfiguration` (boolean, default `true`, controls visibility of the Filters/Adapt button). Fixed in `Master.view.xml`.
- **Master page overlay/busy indicator never clearing**: `App.controller.js` set the root `App` control's `busy` flag to `true` at init (`App.view.xml` binds `busy="{appView>/busy}"`), but the code that was supposed to clear it (`fnSetAppNotBusy`, wired to `metadataLoaded()`/`attachMetadataFailed`) was commented out — leftover from a copy-pasted template. Those two APIs are also V2-only and don't exist on the V4 `ODataModel` in use here, so simply uncommenting would have thrown. Fixed by wiring `fnSetAppNotBusy` to `getModel().getMetaModel().requestObject("/")`, the correct V4 equivalent, resolved/rejected either way so the overlay always clears.
- **"General" block (and, less visibly, the rest of the Details section form) rendered twice**: race condition in `sections/SectionFactory.js#ensurePanelContent` — the `_mLoaded[sId]` flag was only set *inside* the `Fragment.load().then()` callback, so a second call for the same panel arriving before that promise resolved (the auto-expanded "details" panel gets `ensurePanelContent` called once from `onAfterRendering → ensurePanels()` and again from `_onObjectMatched → rebind()`, which can race on first navigation) would kick off a second concurrent `Fragment.load` and append the fragment's content twice. Fixed by setting `_mLoaded[sId] = true` synchronously before calling `Fragment.load`, not after.
- Lesson for future agents: this codebase (App.controller.js in particular) has some sections copy-pasted from an older, unrelated template (`sap.ushell`/personalization/import-sheet code paths that don't apply to this app) with commented-out logic that looks intentional but references APIs that don't exist on the models actually in use here (V2 model APIs on a V4 model). Don't trust commented-out code as a spec — verify against the actual API before re-enabling it.

## Phase 1 (Initial Prototyping) — COMPLETE - 2026-07-31

Phase 1 scope was a working, live-backend-connected read-only prototype of the cockpit shell: FCL master/detail routing, filterable master list, detail header + expandable panel sections, all wired to the temporary standard `C_SALESORDERMANAGE_SRV`/`C_SALESORDERMANAGE_SD` V4 service via `ServiceSchema.js`. That is now done and stable against the real dev-system service (`https://sapapp2dh1.cdc.gov:44300`, client 100) — see the stabilization pass above for the bugs found and fixed along the way.

**Next up — Phase 2: Search and Content section UI adjustments.** Customer requirements for the Master-view Search (filter bar) and the Detail-view Content (panel sections) need the UI reshaped to match; this has not been scoped in code yet. Before starting, re-read the customer requirement doc(s) once shared and confirm which `ServiceSchema` fields/entity sets are already available vs. need a backend ask, per Onboarding §5 ("if the service lacks something, file a backend request — don't work around it client-side").

## Phase 2 (Design Compliance Build) — COMPLETE - 2026-08-01

Implemented the full Phase 2 prompt: Master list 8-column rework, Master filter bar rework (visible-in-bar vs dialog-only groups, hit-count slider, Clear, custom lightweight variant management, custom lightweight table personalization), Detail title actions, per-section dynamic Edit button, Details panel regrouped into 4 form groups, Items panel 15-column rework + Export/Personalize, 6 new Detail sections (Price/Totals, Billing, Payment Method, Scheduled Actions, Status, Dates) plus Shipping/OrgData field additions.

### Metadata verification pass — corrections found and fixed

While cross-checking every literal property/navigation name touched in this phase against `design/so.xml` (per Onboarding "never invent SAP artifact names"), found and fixed three pre-existing `ServiceSchema.js` constants that did not actually match the header entity (`SalesOrderManageType`, defined at `so.xml` line 364):

- **`headerProperties.shipToParty: "Partner"` — WRONG.** There is no direct `Partner` property on `SalesOrderManageType`. `Partner` only exists on `HeaderShipToPartyType`, reached via the `_ShipToParty` navigation. Fixed: removed the direct-property constant, added `shipToPartyProperties: { id: "Partner", fullName: "FullName" }`, and `Master.controller.js`'s ship-to-party OR-filter now filters only via `_ShipToParty/Partner` and `_ShipToParty/FullName` (nav-qualified paths).
- **`headerProperties.priority: "DeliveryPriority"` / `navigation.headerToDeliveryPriority: "_DeliveryPriority"` — WRONG.** `DeliveryPriority` (and the `_DeliveryPriority` navigation to `DeliveryPriorityType`) exists only on `SalesOrderItemType` (item level), not on the header entity at all. Priority as a **header/master-list** field is BLOCKED-BY-SERVICE. Fixed: removed the header-level constants, disabled the `filterPriority` ComboBox in the Master filter bar (same treatment as NDC/Employee Responsible/Rejection Reason), removed it from `onSearch`'s filter-push logic and from the variant-capture control list, and changed the Details "Priority" field to an em-dash placeholder. Kept `entitySets.deliveryPriority` / `valueHelpProperties.deliveryPriorityCode|Text` defined (harmless, valid VH entity) for potential future item-level use.
- **`headerProperties.taxAmount: "TotalTaxAmount"` / `headerProperties.grossAmount: "TotalGrossAmount"` — WRONG, fabricated.** `SalesOrderManageType` only has `TotalNetAmount` at header level; there is no header-level Tax or Gross amount field anywhere in `so.xml` (a plain `TaxAmount` exists only on `SalesOrderItemType`). Fixed: nulled both constants, changed the Details "Value" group's Tax/Gross rows to em-dash placeholders (Net Value stays real, bound to `TotalNetAmount`).

Also confirmed while there: `OverallSDProcessStatus_Text` and item `DeliveryStatus` are **not** flat properties either — both are only reachable via their respective code-to-text navigation (`_OverallSDProcessStatus/OverallSDProcessStatus_Text`, `_DeliveryStatus/DeliveryStatus_Text`) per the `SAP__common.Text` annotations in `so.xml`. The Details header Status field was switched to use the existing `formatter.detailStatusText` code→text mapping (consistent with the rest of the codebase); the Items table's Delivery Status column and the Export mapping were switched to bind the real `_DeliveryStatus/DeliveryStatus_Text` nav path instead of the raw one-letter code.

Also confirmed the header entity **does** have a real, single-value `PaymentMethod` property (+ `_PaymentMethodVH` nav to `PaymentMethodType`, giving `PaymentMethodName`/`PaymentMethodDescription`) — this is an SD payment-method *code* (e.g. check/transfer/cash), not a stored card/payment-instrument record. Added `headerProperties.paymentMethod` / `navigation.headerToPaymentMethod` / `paymentMethodProperties.text` and surfaced the real code above the (still BLOCKED-BY-SERVICE, no-card-entity) Payment Method table in `PaymentMethod.fragment.xml`.

All other literal properties/navigations introduced in this phase (Billing, OrgData, Shipping fields; Items table's 15 columns; Master's 8 columns and dialog-only filters) were individually confirmed present on `SalesOrderManageType` / `SalesOrderItemType` / their respective VH entity types by direct inspection of `so.xml` — see `PHASE2_AUDIT.md` for the full per-requirement list.

See `PHASE2_AUDIT.md` for the DONE/BLOCKED-BY-SERVICE status of every Phase 2 requirement, and `OPEN_QUESTIONS.md` for open items requiring backend/customer input.

## Master list: grid table migration + toolbar actions — 2026-08-18

Replaced `sap.m.Table` with `sap.ui.table.Table` on the Master view (grid table
for column drag-reorder/resize) and added a header toolbar (Create/Refresh/
Personalize) in the table's `extension` aggregation. Full DONE/deviation list
in `PHASE2_AUDIT.md` Section I. Findings worth keeping for future agents:

- **Task prompt assumed two things that don't hold for this codebase** — caught
  by reading the actual files before touching them (Onboarding rule 1):
  1. It asked to keep fixed filters `IsActiveEntity eq true` + order type `ZKB`
     on the rows binding. This app has **no draft** (`SalesOrderManageType` has
     no `IsActiveEntity` key — guardrail #3 bans draft anyway) and no `ZKB`
     order type (the allow-list is `ZVR1`, and a force-applied order-type
     filter was deliberately removed back on 2026-08-03 as a bug fix — see the
     Phase 2 entry above). Did not add either filter; kept the rows binding's
     filter behavior identical to the old items binding.
  2. It asked to re-register the table with "the existing `sap.m.p13n.Engine`
     setup" / a "SelectionController metadata helper." **Neither exists in this
     codebase.** Master's (and Items') personalization has always been a
     hand-rolled dialog + `VariantStore.js` (see the Phase 2 entry above,
     Section A/F) — a deliberate simplification because there's no live FLP
     flex-persistence backend to target yet. Rewired *that* mechanism to the
     grid table instead of introducing `p13n.Engine` net-new (would be a large,
     out-of-scope architecture change for a "two changes to Master only" task):
     the persisted layout (`VariantStore` key `masterTableLayout`) now also
     carries per-column `widths` and the interactive `rowCount`, and
     `columnMove`/`columnResize` (debounced) plus the row-count-drag path
     (`rowsUpdated`) write into it alongside the existing dialog-driven
     order/visibility — same storage path, so everything survives reload.
  - Lesson: when a task prompt describes framework pieces (event names,
    control APIs, service filters) that don't turn up anywhere in a grep of the
    actual codebase, verify against the real files and flag the mismatch
    (`PHASE2_AUDIT.md`/here) rather than inventing the described piece from
    scratch — matches Onboarding guardrail #7 ("never invent SAP artifact
    names, config keys, or API signatures").
- `manifest.json`'s `sap.ui5.dependencies.libs` was missing `sap.ui.table`
  entirely — only `ui5-local.yaml`'s framework library list (used for the
  local mock-server dev profile) had it. Added it to the manifest; that's the
  list that actually drives runtime library loading for the deployed/FLP app.
- The prompt says "same nine columns" for Section A; this app's Master list
  has always had **8** columns (see Phase 2 entry above and `PHASE2_AUDIT.md`
  Section A) — carried over all 8 as-is, no ninth column exists to add.
- `sap.ui.table.Table` API surface (`RowActionItem` press parameter,
  `columnMove`/`columnResize` event parameters) is new to this codebase and
  was not independently verified against a live UI5 API reference in this
  pass — flagged `TODO-VERIFY` at each usage per guardrail #7; re-check before
  sign-off.

### Runtime correction: `$top` is not a valid V4 list-binding parameter (2026-08-18)

Live testing threw `Uncaught (in promise) Error: System query option $top is
not supported` (`ODataModel-dbg.js` `buildQueryOptions`) as soon as the Master
route bound the grid table. Root cause: the task prompt's instruction to keep
"Max Hits semantics: slider still caps via `$top`" doesn't hold for
`sap.ui.model.odata.v4.ODataListBinding` — **`$top`/`$skip` cannot be set as
client bind parameters at all** (neither in the initial `bindRows(...)`
`parameters` map nor via `oBinding.changeParameters(...)`); V4 paging for
`sap.ui.table.Table`'s virtual scrolling is fully automatic and owns those two
query options itself. This is a hard model restriction, not a config mistake.

Fix applied: removed `$top` from both `_bindMasterRows`'s initial `bindRows`
parameters and `onSearch`'s `changeParameters` call (both `Master.controller.js`).
`$count: true` stays (that one **is** allowed and is what drives the result
count display). The Max Hits slider UI, its variant capture, and
`this._iMaxHits` bookkeeping are all still in place, but **the value is
currently advisory only — it no longer enforces a hard fetch cap**, since
there is no verified, safe V4-idiomatic way to do so from the client for this
service without risking un-tested `$apply=top(N)` transformation-string
behavior against a live SD-based V4 service (would need to be confirmed
against a real `$apply` capability check before use — not attempted here).
Flag for follow-up: decide whether Max Hits should (a) stay advisory, (b) be
enforced via a verified `$apply` top-transformation once confirmed against the
live service, or (c) be dropped/re-labeled now that grid-table virtual
scrolling makes a "growing threshold"-style batch-size control moot (the old
`sap.m.Table` behavior wasn't a true hard cap either — `growingThreshold` was
just the per-page batch size, see the removed `setGrowingThreshold` call).



Running the Phase 2 build against the real dev-system service surfaced a backend crash on the very first Master list load:

- Symptom: `POST .../c_salesordermanage_srv/srvd/sap/c_salesordermanage_sd/0001/$batch` → `500 Internal Server Error`, ABAP dump `ASSERTION_FAILED`. The master list never populated and the Search ("Go") button appeared to do nothing (because the underlying list binding never successfully resolved).
- Original hypothesis (disproven): suspected the newly-added `ResponsibleEmployee` field in `$expand=_SoldToPartyContactInfo($select=FullName,ResponsibleEmployee,SalesDocument)`. Removed it and redeployed — **same crash still occurred** with a fresh batch payload confirming `ResponsibleEmployee` was fully gone from the wire (`$select=FullName,SalesDocument` only). This proved the field itself was not the cause.
- **Root cause (confirmed via ST22 short dump, 2026-08-03 13:10)**: the crash originates in a **custom backend RAP query provider**, `CL_SD_S4H_STD_PARTNER_CONTACT=CM002` (the class behind `StandardPartnerContactInfoType`/the `_SoldToPartyContactInfo` navigation), method `IF_RAP_QUERY_PROVIDER~SELECT`:
  ```abap
  try.
      data(lt_filter) = io_request->get_filter( )->get_as_ranges( ).
    catch cx_rap_query_filter_no_range.
      assert 1 = 0.        " <-- unconditional crash instead of graceful handling
  endtry.
  ```
  The call stack (`CL_SADL_GW_EXPAND_LEVEL=>READ_DATA` / `_PROCESS_EXPAND` under `READ_ENTITY_LIST`) shows this happens specifically when `_SoldToPartyContactInfo` is `$expand`-ed while reading the **master LIST** (multiple `SalesOrderManage` header rows on one page). Whatever filter shape the RAP framework passes down for a multi-row expand can't be converted to simple ranges by `get_as_ranges()`, and the custom class's own error handling just asserts/crashes instead of falling back — **this is independent of which fields are `$select`-ed**, which is exactly why removing `ResponsibleEmployee` alone didn't help: the still-present `FullName` (used for the Master "Contact" column) was equally implicated.
- Fixed: removed `_SoldToPartyContactInfo` `$expand`/`$filter` entirely from the **Master list** context:
  - `Master.controller.js`'s "Contact" column no longer binds through `_SoldToPartyContactInfo/FullName` — shows em-dash (`formatter.masterContact()` with no value).
  - `Master.controller.js`'s "Contact" filter box (`filterContact`) is now disabled (same treatment as NDC/Provider Pin/Rejection Reason/Priority/Employee Responsible) and removed from variant capture, since filtering by this nav would hit the same crash.
  - "Employee Responsible" master column / Details field remain em-dash from the earlier (disproven-as-root-cause, but still valid) defensive fix.
- **Verified live (2026-08-06)**: the Detail page's single-entity read (`Details.fragment.xml`'s Contact/`FullName`, `FormattedPostalAddressDesc`, and `ResponsibleEmployee`) confirmed working with no crash. The ST22 call stack showed the crash is specific to the **list-context** expand (`READ_ENTITY_LIST`); the single-entity `bindElement` read (`READ_ENTITY`, one sales order) is a different code path and does **not** hit `cx_rap_query_filter_no_range`/`ASSERTION_FAILED`. `ResponsibleEmployee` is therefore bound directly on the Detail page (no em-dash needed there); the em-dash workaround remains required only for the Master **list** (Contact and Employee Responsible columns) and the Contact filter, where the crash is real.
- Lesson: **presence in `$metadata` does not guarantee a field/navigation is safe to request, and a custom-class-backed entity (RAP unmanaged query provider) can behave very differently for list-context `$expand` vs single-entity reads.** Always get the ST22 short dump's "Error analysis" / "Information on where terminated" / "Source Code Extract" sections when diagnosing a live `ASSERTION_FAILED` — it gives the exact class/method/line immediately instead of guessing field-by-field from `$select` clauses.
- **This is a backend defect, not a metadata-design issue** — see `OPEN_QUESTIONS.md` for the item to report to the backend/ABAP team (`CL_SD_S4H_STD_PARTNER_CONTACT=CM002`, unconditional `assert 1 = 0` on `cx_rap_query_filter_no_range`).

## Live-backend regression: `detailStatusText` "this.statusText is not a function" — 2026-08-03

- Symptom: opening the Detail page threw `this.statusText is not a function` from `formatter.detailStatusText`, bound in `Details.fragment.xml` via the bare XML string `'.formatter.detailStatusText'`.
- Root cause: `detailStatusText`/`masterStatusText`/`statusText`/`statusState` all internally called `this.statusText(...)`/`this.statusState(...)`. That only works when the formatter function is explicitly `.bind(formatter)`-ed (done for `Master.controller.js`'s JS-side binding), not when referenced as a bare string in XML (`Details.fragment.xml`), where `this` isn't guaranteed to be the formatter module.
- Fixed: extracted the status-code lookup into private module-level functions (`fnStatusText`/`fnStatusState`, not object methods, no `this` dependency) in `formatter.js`; all four public formatter functions now call these directly. Confirmed no other `this.xxx(...)` internal calls remain in `formatter.js`.
- Lesson: in `formatter.js`, never call another formatter method via `this.otherFn(...)` — some callers (bare XML string formatter refs) don't bind `this`. Extract shared logic to a private top-level function instead.

## Master search regression: hidden `SalesOrderType = ZVR1` restriction excluded real orders — 2026-08-03

- Symptom: a known, valid order (e.g. 500000043) appears on the Master list's unfiltered initial load, but searching for it by Vaccine Request ID (or any other filter) returns zero results.
- Root cause: `onSearch` unconditionally AND-ed a hidden `_getFixedFilters()` restriction (`SalesOrderType eq 'ZVR1'`) onto every search — confirmed via the live request `$filter=(SalesOrderType eq 'ZVR1') and contains(SalesOrder,'500000043')`. `ZVR1` was an unconfirmed `TODO-VERIFY` placeholder (`ServiceSchema.fixedOrderTypes`) that was never actually checked against real order data, and evidently doesn't match this order's real type. Because the initial unfiltered `_bindMasterItems()` load never applied this restriction (only `onSearch` did), the order was visible until the user tried to search for it — an inconsistency that had been noted internally as low-priority but turned out to be the actual bug.
- Fixed: removed the automatic `SalesOrderType = ZVR1` restriction from `onSearch` entirely (removed the now-dead `_getFixedFilters()` method and its call site) — search behavior now matches the unfiltered initial load (no hidden type restriction). The optional "Order Type" filter dropdown (`filterSalesOrderType`) is unchanged and still only offers `ZVR1` as a manual, opt-in choice (`ServiceSchema.fixedOrderTypes` allow-list) — this may need to be revisited/expanded once real order types for this workflow are confirmed with the backend team.
- Lesson: a restriction applied inconsistently (only on searched loads, not the initial load) is a red flag worth investigating immediately, not deferring as "lower priority."

## UX change: Master list no longer auto-populates on initial load — 2026-08-04

- Requirement: the hit list should stay empty until the user presses "Go" — previously `_bindMasterItems()` bound the table with no filter at all on `onInit`, so it always showed every order (e.g. 60 results) before any search.
- Change: `onInit` now seeds `this._aCurrentFilters` with a guaranteed-empty filter (`SalesOrder eq ''` — safe since `SalesOrder` is a non-nullable key field, never blank) before calling `_bindMasterItems()`, which now passes `filters: this._aCurrentFilters` into `bindItems()`. `onSearch` overwrites `this._aCurrentFilters` with the real filters (or an empty array if no criteria entered, which then shows everything — same as the old initial-load behavior, just now requiring an explicit Go) and always sets `/masterHasSearch` to `true` (previously only true when at least one filter was set).
- Added `noDataText` on `requestsTable` bound to `{i18n>masterNoDataBeforeSearch}` ("Enter search criteria and choose Go to see results"), shown only while `view>/masterHasSearch` is `false`, so the empty initial state doesn't look broken/blank.
- Table personalization/column-layout changes (`_applyColumnDialog` → `_bindMasterItems()`) reuse `this._aCurrentFilters`, so re-rendering columns doesn't reset back to the unfiltered/empty state.

## Verified live: single-entity Detail reads through `_SoldToPartyContactInfo` are safe — 2026-08-06

- Confirmed live that `Details.fragment.xml`'s Contact (`FullName`), Ship-To address (`FormattedPostalAddressDesc`), and Employee Responsible (`ResponsibleEmployee`) fields all bind and render correctly on the Detail page with no crash. This confirms the `ASSERTION_FAILED` regression documented above is specific to the **list-context** `$expand` of `_SoldToPartyContactInfo` (Master list); the **single-entity** `bindElement` read (Detail page, `READ_ENTITY`) is a different backend code path and is not affected.
- `ResponsibleEmployee` is therefore bound directly on the Detail page. The em-dash workaround remains required only for the Master list's Contact/Employee Responsible columns and the Contact filter, where the crash is real.

## Rebranding: app renamed from "Vaccine Request" to "Provider Order" — 2026-08-07

- All user-facing "Vaccine Request(s)" labels renamed to "Provider Order(s)": app title (`appTitle`), Master list title (`masterTitle`), Vaccine Request ID filter/column (`filterRequestId`, `colRequestId`), Detail page title/prefix (`detailTitle`, `detailTitlePrefix`), and the FLP sandbox tile title/description in `flpSandbox.html`/`flpSandboxMockServer.html`.
- `manifest.json`'s `sap.app/title` already referenced the `{{appTitle}}` i18n key, so no code change was needed there.
- The technical namespace/app ID (`cdc.vaccreq`) was intentionally left unchanged — this is a code-level identifier, not a display label, and renaming it would be a much larger, riskier refactor (component ID, manifest, module paths, variant persistence keys) out of scope for a display-text rename.

## Status field switched to `UserStatusDerived` (E008-specific derived status) — 2026-08-06/07

- Both the Master list Status column and the Detail page status control were switched from `OverallSDProcessStatus` (generic SD document status, `status`/`statusSource: "standard"`) to `UserStatusDerived` (`headerProperties.userStatus`, `statusSource: "e008"`), which carries the E008-specific workflow status.
- `UserStatusDerived`'s raw value is a combined `"<code> <description>"` string (e.g. `"1A In Process"`), not a bare code. `formatter.js` was updated accordingly:
  - `fnStatusText` (e008 branch) now strips the leading code word (`removeFirstWord`) and displays the remainder as-is, rather than looking up a hardcoded text map.
  - `fnStatusCode` extracts just the leading code word (`sCode.split(' ')[0]`) for status-state (color) lookup via `mStatusStateE008`.
  - `mStatusTextE008`/`mStatusStateE008` were updated to the confirmed E008 code set (`0A`, `1A`-`1G`, `2A`-`2C`) with corrected descriptions/severities (`mStatusTextE008` is now effectively a fallback/reference map since the display text comes directly from the backend string).
- Detail page: `Details.fragment.xml`'s status field and `Detail.controller.js`'s `_bindDetailHeader()` both now bind `UserStatusDerived` (previously `OverallSDProcessStatus`), and the status control changed from `sap.m.ObjectStatus` to `sap.m.GenericTag` (property `status`, type `sap.ui.core.ValueState` — matches the values `fnStatusState` returns: `None`/`Information`/`Success`/`Warning`/`Error`). The controller's binding was updated from `.bindProperty("state", ...)` to `.bindProperty("status", ...)` to match `GenericTag`'s actual property name.
- Fixed a typo while reviewing: `mStatusStateE008` had a stray `"0A:"` key (trailing colon) instead of `"0A"` — corrected; behavior was unaffected since the lookup miss fell back to the same `"None"` value either way.

## UX addition: Detail page full-screen toggle — 2026-08-06/07

- Added a full-screen toggle button pair (`enterFullScreen`/`exitFullScreen`, mutually exclusive via `visible` bindings on `appView>/actionButtonsInfo/midColumn/fullScreen`) to `Detail.view.xml`'s `f:DynamicPageTitle/f:navigationActions`, wired to a new `toggleFullScreen` handler in `Detail.controller.js` that flips the `appView` model's `midColumn.fullScreen` flag and swaps `/layout` between `TwoColumnsMidExpanded` and the previously-stored layout.
- `App.controller.js`'s default `appView` model now starts with `actionButtonsInfo.midColumn.fullScreen: true` (was `false`), and `manifest.json`'s `detail` route layout changed from `TwoColumnsMidExpanded` to `MidColumnFullScreen` to match — the Detail page now opens full-screen by default, with the option to return to the split two-column layout.

## Master list Contact column masks contact info — 2026-08-07

- `formatter.masterContact()` now unconditionally returns the literal string `*****` instead of the contact's full name or an em-dash (the previous `orDash(sFullName)` call is commented out, and the Master list doesn't pass it any value regardless). Confirmed intentional (PII masking) — the Master list Contact column intentionally does not display real contact names, independent of whether `_SoldToPartyContactInfo` is available. **Open question**: the current implementation is a hardcoded literal, not a real masking transform — revisit if partial-reveal or per-record masking is ever needed.

## Master table personalization rework + Link navigation + column-variant management — 2026-08-19

Follow-up task list (5 items) applied to `Master.view.xml`/`Master.controller.js`/`i18n.properties`, building on the grid-table migration above. Item 5 (hard 100-record cap) was **explicitly deferred by the user** — not implemented in this pass; the `$top`/`$skip`/`$apply` research from the earlier `$top` crash fix still applies and remains the starting point when this is picked up (no fully-safe client-side mechanism was found — see the `$top` correction entry above).

- **Item 1 — standard p13n personalization dialog (sort + group enabled)**: replaced the hand-rolled `sap.m.Dialog`/`sap.m.List`/`CheckBox`/move-up-down-button column dialog (`onMasterTablePersonalize`/`_createColumnDialog`/`_onMoveColumn`/`_applyColumnDialog`) with `sap.m.p13n.Popup` + `sap.m.p13n.SelectionPanel`/`SortPanel`/`GroupPanel` (verified live via the official UI5 1.151 API reference — available since 1.96/1.97, not deprecated). Deliberately **not** `sap.m.p13n.Engine` + `SelectionController`/`SortController`/`GroupController`: those are abstract base classes meant to be subclassed per control type for `sap.ui.fl`-backed, cross-control persistence — overkill and unverified for this app, which has no live FLP flex backend and already has its own `VariantStore` persistence. Also deliberately **not** the deprecated `sap.m.P13nDialog`/`P13nColumnsPanel` pattern shown by the user via the unrelated `lp2preq` project reference — confirmed via grep that every usage of that pattern in `lp2preq` is dead/commented-out code in `BaseController.js`, and that project is a completely different, older, OData V2 app (`lmco.ces.preq`) — not a live example to replicate.
  - State is layered onto the existing `_getColumnLayout()`/`_saveColumnLayout()` object (VariantStore key `masterTableLayout`) with two new optional fields: `layout.sort` (`{key, descending}`) and `layout.group` (`{key}`).
  - **Confirmed hard restriction (via `sap.ui.table.Table` API docs, 1.151)**: the table's native `enableGrouping`/`groupBy` group-header-row visualization is client-model-only — "Grouping does not work with OData models." True OData V4 group-header rendering would need `sap.ui.table.TreeTable` + `ODataListBinding#setAggregation` (data aggregation/`groupLevels`), a materially different control — out of scope here. "Group by" is therefore implemented as a **primary sort key** (`_buildSorters`): rows sharing the grouped value become contiguous, but there is **no visual group-header divider row**. This is a documented technical limitation, not a shortcut/guess.
  - Only columns with a real, single bindable server property (`sortPath` on the column def) are offered in the Sort/Group panels — `description`, `contact`, and `employeeResponsible` are excluded (formatter-composed/placeholder values, no clean single path to sort/group by).
  - `TODO-VERIFY`: the exact item property names expected by `SelectionPanel`/`SortPanel`/`GroupPanel#setP13nData`/`getP13nData` (`key`/`label`/`visible`/`position`/`sorted`/`descending`/`grouped`) were not published in the fetched API reference (only that the methods exist, not their parameter shape) — implemented per the standard mdc p13n item shape used across SAP samples; verify against the running app and adjust field names if the panels don't render/apply state as expected.

### Manual tweaks to `Master.view.xml` after the above (2026-08-19)

Applied directly by the user, not via an agent edit:

- `t:Table`: `visibleRowCountMode` `Interactive` → `Fixed`, `visibleRowCount` `12` → `10`, added `alternateRowColors="true"`, added `enableGrouping="true"`. Wrapping `VBox` `height` `100%` → `80%`.
- Effect on existing controller logic: with `visibleRowCountMode="Fixed"` there is no drag handle, so `onRowsUpdated`/`_persistVisibleRowCount` (which persists a user-dragged row count into the `masterTableLayout` variant) is now effectively dead code — harmless, just unreachable until/unless the mode is switched back to `Interactive`. `_bindMasterRows`'s `oTable.setVisibleRowCount(oLayout.rowCount || 12)` still runs and still works in `Fixed` mode (it's a one-time programmatic set, not tied to the interactive handle).
- `enableGrouping="true"` is a no-op as currently wired: `sap.ui.table.Table`'s native grouping needs both `enableGrouping` **and** a `groupBy` column/binding parameter, and this app never calls `setGroupBy()`/passes a `groupBy` parameter (item 1's "group" personalization is implemented as a sort-key, per the confirmed `enableGrouping` + OData-models restriction documented above) — so this flag currently has no visible effect and doesn't reintroduce the documented OData-incompatibility risk. Flagged for the user in case the intent was to test native grouping directly.
- **Item 2 — column-layout variant management**: added a second Select + Save As/Manage UI (toolbar of the grid table, next to the "Columns" button) mirroring the existing FilterBar search-variant pattern, backed by a new `VariantStore` key `masterColumnVariants` (distinct from the single active-layout entry under `masterTableLayout`). New controller methods: `_refreshColumnVariantsModel`, `onColumnVariantSelect`, `onColumnVariantSaveAs`, `onColumnVariantManage`.
- **Item 3 — Provider Order column navigation via Link**: removed `rowActionCount`/`<t:rowActionTemplate>`/`RowActionItem`/`onRowActionPress` entirely. The `requestId` column's cell template is now a `sap.m.Link` (imported `sap/m/Link`) whose `press` handler resolves the row's binding context and calls the existing `_navigateToOrder()` helper (reused, not duplicated).
- **Item 4 — Description column width**: `_getColumnDefs()`'s `description` entry changed from `"12rem"` to `"40rem"` initial width. Any already-persisted `VariantStore` layout with the old `12rem` width is left untouched (expected personalization behavior — user-saved widths win over the new default).
- i18n: added `p13nDialogTitle`, `p13nSelectionPanelTitle`, `p13nSortPanelTitle`, `p13nGroupPanelTitle`, `columnVariantLabel`, `columnVariantSaveDialogTitle`, `columnVariantManageDialogTitle`; removed `columnDialogTitle`/`moveUp`/`moveDown` (only used by the removed hand-rolled dialog).

## CRUD Task 1 — Create New Provider Order (dialog + OrderCreate action) — 2026-08-19

Implemented per `design/NEwVaccReq.md` ("CRUD Task 1 Prompt v2 — supersedes v1"). **Spec filename note**: the user's work order referenced `design/E008_CRUD1_Create_Prompt.md`, which does not exist in this repo — the actual matching document (same title/content) is `design/NEwVaccReq.md`; used that as authoritative.

### Step 0 reconciliation deltas found

- `ServiceSchema.fixedOrderTypes` was still `["ZVR1"]` — fixed to `["ZKB"]` per the confirmed lesson in `design/E008_Service_Extension_Design.md` §6 (also resolves `OPEN_QUESTIONS.md` item 9).
- **Confirmed blocker**: no custom `OrderCreate` action exists anywhere in the currently bound `$metadata` (checked both `frontend/cockpit/webapp/localService/metadata.xml` and `design/so.xml` — only standard `C_SALESORDERMANAGE_SD` actions such as `CreateWithSalesOrderType`/`CreateWithRefFromSlsQuotation` are present). Per the work order's own instruction, this is bridged with an explicitly-flagged temporary mock (`CreateRequestService.USE_MOCK = true`) rather than inventing an action name or blocking entirely — see `PAYLOAD_CONTRACT.md`/`OPEN_QUESTIONS.md` item 11.
- **Provider value help**: `SoldToParty` does have a real `SAP__common.ValueListReferences` annotation in `design/so.xml` (`c_soldtosalesareavh` F4 service), but implementing a full F4 dialog was judged disproportionate scope here — used a plain required `Input`, consistent with the existing `filterProvider` precedent in the Master filter bar. Deferred enhancement, not an oversight.
- **No `ZZ_ContactVH`/NDC VH entities exist** anywhere in the metadata — Contact is a **disabled** `Input` + the existing `availableWithE008Service` tooltip (same pattern used for other pending-backend filter fields); NDC is a **plain enabled** `Input` with the same tooltip (per the spec's exact distinction between the two fields).
- **Logged spec/reality conflict**: the spec says to navigate to the detail page with a key "incl. `IsActiveEntity=true`" — this service has no `IsActiveEntity` key at all (confirmed in `manifest.json`'s `detail` route pattern `detail/{orderId}` and `ServiceSchema.keys`, which has no such key). Resolution: reused the existing, correct `_navigateToOrder(sId)` helper unchanged for the CRUD1 success path rather than inventing a key that doesn't exist.

### Files created

- `frontend/cockpit/webapp/model/Enums.js` — `PRIORITY`/`ORDER_REASON`/`CATEGORY`/`INTENTION` key+i18nKey lists, `INTENTION_DEFAULT = "PED_AND_ADULT"`, `MIN_ITEMS = 1`. All marked `TODO: replace with backend value help; keys pending config confirmation`.
- `frontend/cockpit/webapp/service/CreateRequestService.js` — `buildPayload(oDialogData)` (single mapper, omits empty optional header fields, drops invalid item rows) and `create(oModel, oPayload)` (Promise-based). `USE_MOCK = true` resolves a fake `salesDocument` after a short delay; the real-invocation code path (`oModel.bindContext(...).invoke()`) is present but gated behind the flag, with `TODO-VERIFY` on the action name (`ServiceSchema.orderCreateAction`) and the parameter shape (structured vs. single JSON string — unconfirmed).
- `frontend/cockpit/webapp/view/fragments/CreateRequestDialog.fragment.xml` + `frontend/cockpit/webapp/controller/CreateRequestDialog.js` — standalone dialog handler object (not `Controller.extend`), lazy-instantiated once by `Master.controller.js` via `new CreateRequestDialog(this)`, `open(fnOnSuccess)` API. Local `create` JSONModel holds form fields + an `items` array + resolved enum `{key,text}` lists for the four Selects. Validates Provider/Description required + at least `Enums.MIN_ITEMS` valid item rows (NDC + positive quantity) before calling the service; maps backend failure `messages[].target` onto the same per-field `valueState`s where recognized, else into a top-level `MessageStrip` summary.
- `PAYLOAD_CONTRACT.md` (repo root) — request/response shape, status **"UNCONFIRMED — pending backend sign-off"**, backend dependency list (5 items).

### Files modified

- `ServiceSchema.js` — `fixedOrderTypes` → `["ZKB"]`; added `orderCreateAction` (`TODO-VERIFY`), `createPayloadFields` (payload key-name isolation block), `createPayloadUom = "EA"`.
- `Master.controller.js` — `onCreateRequest` now lazy-loads/opens `CreateRequestDialog`; added `_onCreateRequestSuccess` (toast with the new ID, refreshes `requestsTable`'s `rows` binding, calls the existing `_navigateToOrder`). Removed the old placeholder toast (`masterCreateToast` i18n key removed, no other references).
- `i18n.properties` — added all Create-dialog labels/tooltips/messages and enum display texts; removed `masterCreateToast`.
- `OPEN_QUESTIONS.md` — item 9 marked resolved (ZKB); added item 11 listing the 4 remaining CRUD1 backend dependencies (OrderCreate action, ContactVH, NDCVH, enum code confirmation).

### Known limitations / not done in this pass

- **Live verification against a real `OrderCreate` action is impossible** — the action doesn't exist yet on any bound service. The mock-backed happy path (dialog → mock resolve → toast → refresh → navigate) is the only thing that can be exercised today; the forced-failure/message-mapping path is implemented but only unit-testable by temporarily rejecting the mock, not verified against a real backend error response.
- `manifest.json` routes were reviewed (`detail/{orderId}`, no `IsActiveEntity`) to confirm the `_navigateToOrder` reuse decision above — no route changes were needed.

