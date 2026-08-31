# NOTES

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

