# Open Questions — Phase 2 (Design Compliance Build)

## Data/design questions for the customer or backend team

1. **Description / Category (Master column + Details field)** — ~~no
   free-text description or category field exists on `SalesOrderManageType` in
   the current temporary service.~~ **Category superseded (2026-09-11, Session
   Prompt "Detail View Adjustments" 3.2)**: rebound to the real,
   independently writable `CustomerPurchaseOrderType` header property — no
   longer blocked. Description (`ZZ_KTEXT_SDH`) was separately resolved as a
   real custom header field (see NOTES.md 2026-09-01 entry) but is still
   create-mode-only — its PATCHability on an *existing* order remains
   unconfirmed, see that entry before wiring a change-mode Input for it.
2. **Employee Responsible display name** — only the personnel number
   (`_SoldToPartyContactInfo/ResponsibleEmployee`) is exposed; there is no name
   resolution (e.g. via `UserType`/`BusinessPartner`) for it in this service,
   unlike Created By (`_CreatedByUser/UserDescription`, which does resolve to a
   name). Master column and Detail "Employee Responsible" title both show the
   raw number only. Should the backend expose a resolved name, or is the raw
   personnel number acceptable for this prototype?
3. **Priority (header-level)** — ~~`DeliveryPriority` exists only on
   `SalesOrderItemType` in this service, not on the header.~~ **Superseded
   (2026-09-11, Session Prompt "Detail View Adjustments" 3.1)**: re-confirmed
   still item-level-only; the header Priority field is now a VIRTUAL
   read/write projection over every item's `DeliveryPriority` (uniform value
   shown directly, multiple distinct values shown as "mixed" + the
   highest-priority one found, a user change is propagated to every item at
   Save) — see `Detail.controller.js#_computeHeaderPriority`/
   `_propagatePriorityToItems`. Still no header-level Priority *property* to
   PATCH — this is a client-side aggregation, not a new backend field. The
   "most urgent = lowest code" ordering convention remains an unconfirmed
   assumption (see item 17).
4. **Header Tax/Gross amount** — only `TotalNetAmount` exists at header level;
   Tax/Gross amounts exist only per item (`TaxAmount` on `SalesOrderItemType`,
   no header rollup for either). Should the Details "Value" group show a
   client-side sum of item Tax/Net-as-Gross amounts instead of leaving them
   blank, or wait for a header-level rollup field in the permanent service?
5. **CVV / Payment Method entity** — no payment-instrument (card number, holder,
   expiry, limit, authorization) entity exists anywhere in this service; only a
   single header `PaymentMethod` code (check/transfer/cash-style) is available.
   **Proposal (needs sign-off):** if/when a real payment-instrument entity is
   added in `ZUI_VACCINEREQUEST_O4`, the CVV/security code must **never** be
   stored or displayed in this UI (PCI-DSS) — the current empty-state design
   deliberately has no CVV column and this should remain a hard rule, not just
   an artifact of "no data available yet."
6. **Price/Totals, Scheduled Actions, Status History, Dates sections** — all
   four are fully BLOCKED-BY-SERVICE (no backing entities found at all in
   `design/so.xml`). Confirm whether these are genuinely out of scope for the
   temporary service (expected, since it's a repoint of a standard SD service)
   or whether equivalent data exists somewhere not yet discovered (e.g. via a
   different entity set not currently modeled in `ServiceSchema.js`).
7. **Service Org Unit / Service Organization (OrgData)** — no matching fields
   found; this looks like a CRM/Service-industry concept this SD-based service
   doesn't have at all. Confirm these are expected to only appear once
   `ZUI_VACCINEREQUEST_O4` (the purpose-built vaccine-request service) is live.
8. **Backend defect — `_SoldToPartyContactInfo` crashes on master-list `$expand`
   (needs to be reported/fixed by the ABAP/backend team, not just a design
   question)** — confirmed via ST22 short dump 2026-08-03 that the custom RAP
   query provider `CL_SD_S4H_STD_PARTNER_CONTACT=CM002` (implementing
   `IF_RAP_QUERY_PROVIDER~SELECT` for `StandardPartnerContactInfoType`, the
   target of `_SoldToPartyContactInfo`) does:
   ```abap
   try.
       data(lt_filter) = io_request->get_filter( )->get_as_ranges( ).
     catch cx_rap_query_filter_no_range.
       assert 1 = 0.
   endtry.
   ```
   This unconditionally crashes (`ASSERTION_FAILED`, HTTP 500) whenever the
   navigation is `$expand`-ed/filtered across multiple `SalesOrderManage` rows
   at once (i.e. any master-list read), independent of which fields are
   selected — it broke the Master list's initial load entirely. Client-side
   workaround applied: the Master list's "Contact" and "Employee Responsible"
   columns/filters no longer use this navigation at all (em-dash,
   RUNTIME-BLOCKED-BY-SERVICE — see `PHASE2_AUDIT.md`/`NOTES.md`). **Needs
   backend team attention**: should `CL_SD_S4H_STD_PARTNER_CONTACT=CM002`
   handle `cx_rap_query_filter_no_range` gracefully instead of asserting (still
   worth reporting/fixing, since it's a real backend defect even though the UI
   now works around it). **Verified live 2026-08-06**: the Detail page's
   single-entity read of this same navigation (Contact, Ship-To address,
   Employee Responsible) does **not** crash — the assert is specific to
   list-context `$expand`, so the Detail page now binds these fields directly
   (no em-dash workaround needed there).
9. ~~**Confirm the real E008 vaccine-order `SalesOrderType`(s)**~~ — **RESOLVED
   2026-08-19.** `design/E008_Service_Extension_Design.md` §6 confirms the E008
   vaccine-request order type is **`ZKB`**. `ServiceSchema.fixedOrderTypes` has
   been updated from the `["ZVR1"]` placeholder to `["ZKB"]` (see NOTES.md,
   "CRUD Task 1" entry). The "Order Type" filter dropdown's allow-list should
   be reviewed against this in a follow-up pass if it still only offers `ZVR1`.
10. **`UserStatusDerived` string-format assumption** — the Master/Detail Status
    field was switched (2026-08-06/07) from `OverallSDProcessStatus` to
    `UserStatusDerived`, whose raw value is assumed to always be a
    `"<code> <description>"` string (e.g. `"1A In Process"`), parsed client-side
    in `formatter.js` (`removeFirstWord`/`fnStatusCode` split on the first
    space). Please confirm this format is stable/guaranteed for every possible
    status code (including `0A`/draft, and any future codes) and won't ever be
    a bare code with no description or a differently-formatted string — if it
    ever is, the display text/color would silently be wrong rather than error.
11. **CRUD Task 1 (Create New Provider Order) backend dependencies** —
    added 2026-08-19, see `PAYLOAD_CONTRACT.md` for full detail. Frontend
    scaffolding (dialog, service, enums) is built with a temporary mock
    (`CreateRequestService.USE_MOCK = true`) pending these:
    1. A custom `OrderCreate` action — confirmed **not present** in the
       current `$metadata` (only standard `C_SALESORDERMANAGE_SD` actions
       exist). Name, parameter shape, and response shape are all unconfirmed.
    2. `ZI_VR_CONTACTVH` — value help for the Contact field (currently a
       disabled Input with an "available with the E008 service" tooltip).
    3. `ZI_VR_NDCVH` — value help for the NDC field (currently a plain,
       enabled Input with the same pending tooltip).
    4. ~~Confirmation of the Priority/Order Reason/Category/Intention enum
       codes used in `webapp/model/Enums.js` (Intention likely maps to
       MVGR1).~~ **Intention/MVGR1 superseded (2026-09-16)**: real domain
       confirmed by the client — `ADU`/`PED`/`MIX` (see item 18 below). Fund
       Type/MVGR2 codes were already client-confirmed in a prior session.
       Priority/Order Reason/Category codes remain unconfirmed.
12. **CRUD Task 2 (Change Mode) backend dependencies** — added 2026-08-19,
    see `NOTES.md` "CRUD Task 2 v2" entry for full detail:
    1. **UpdateDescription/OrderUpdate micro-action** — no Description/KTEXT
       write path exists on the bound service; if/when a micro-action ships,
       record its name here and wire it as an additional Details save step.
    2. **Partner-change (Contact/Employee Responsible) writability ruling** —
       still unresolved; both fields stay read-only in edit mode this task.
    3. **Category — functional ruling needed, not just technical.** No real
       dedicated Category field exists on this service (`headerProperties.category`
       is a `SalesOrderType` display alias only) — confirm whether a real
       Category field is expected on `ZUI_VACCINEREQUEST_O4`, and if so,
       whether it should be independently editable post-creation.
    4. **Priority — confirm the item-level-only design intent** (same open
       point as item 3 above, restated for the edit context): if Priority is
       genuinely item-level only, there is no header field to ever make
       editable here; if a header-level Priority is planned for
       `ZUI_VACCINEREQUEST_O4`, note it as a new updatable-map entry when that
       service lands.
    5. ~~**Item "Intention"** — confirmed no backing field anywhere in the
       bound `$metadata`~~ **Superseded (predates this note; re-confirmed
       2026-09-16)**: `MaterialGroup1` IS a real, independently writable item
       field (`Edm.String MaxLength=3`) and is already live-wired (Items grid
       Select, real MVGR1 codes `ADU`/`PED`/`MIX` — see item 18). No NDC-default
       prefill logic exists for it yet, only manual selection.
13. **CRUD Task 2 follow-up (Shipping/Org Data/Billing) — Sales Area fields —
    RESOLVED (read-only) 2026-08-21.** `SalesOrganization`, `DistributionChannel`,
    and `OrganizationDivision` were briefly wired editable per explicit user
    request, then reverted the same day after live testing: saving any of the
    three fails with `"Read-only fields must not be changed"`. Confirms their
    `Common.FieldControl` dynamically resolves to read-only for an existing
    sales order (the sales area is normally fixed at document creation in
    standard SD) — no static metadata annotation says this, only live
    behavior does. Back to read-only in `OrgData.fragment.xml`/`ServiceSchema.js`;
    no further action needed unless a future backend change makes these
    genuinely updatable.
14. **Billing — Payer/Bill-To Party edit is a real feature gap, not a ruling
    question** — added 2026-08-21, discovered while implementing "Billing:
    all fields editable". `_SoldToPartyContactInfo` (`StandardPartnerContactInfoType`)
    is explicitly `SAP__capabilities.UpdateRestrictions.Updatable = false` in
    `$metadata` — a read-only convenience projection, confirmed not editable
    under any circumstance via that path. The real write path for changing a
    Payer/Bill-To partner is the separate `_Partner` collection
    (`HeaderPartnerType`, keyed by `PartnerFunction`, e.g. `RG` = Payer) plus
    its bound `CreatePartner` action — nothing in the app reads or writes that
    collection today. If Payer/Bill-To edit is actually wanted, it needs to be
    scoped as its own task (new fragment content bound to `_Partner`, likely a
    partner-role picker + `CreatePartner`/update call), not a ComboBox bolted
    onto the existing Billing form. Left read-only for now.
15. **CRUD Task 1 v3 (In-Place Create) backend dependencies — added
    2026-08-22** — supersedes item 11 above (the v2 `OrderCreate` action design
    is void; see `NOTES.md` "CRUD Task 1 v3"). Two real, functional gaps remain
    once the backend ships, tracked here so they aren't lost:
    - **Enrichment action** (Description/Status/Category/Contact after create)
      — per ADDENDUM-001, planned as a behavior-definition extension action on
      the standard BO. Not yet activated on any bound service. Blocks: setting
      Description/Category/an initial non-default Status at create time.
      `ServiceSchema.enrichmentAction` is `null` pending the real action name.
    - **IoH deep-create** — the IoH BO/companion service `ZUI_VR_EXT`
      (`design/prompts/e008_ext_build.md`) is a build prompt only, nothing is
      activated on-system. `Inventory.fragment.xml`'s createMode table collects
      rows into a local `ioh` JSONModel; `CreateOrderService.js#submitIoH` is a
      stub that skips the call and the rows are lost on exit. Once the backend
      ships: wire a real deep-create/`createFromProposal` call, and revisit
      whether IoH rows should survive a partial-failure exit (currently they do
      not — the user re-enters them in a future IoH-specific screen/section).
    - Neither gap blocks the standard-CRUD spine itself (header + items create
      atomically today); both degrade to "field/section stays read-only or
      inert", not a broken Save.
16. **Parties Involved / Attachments (new sections, CRUD Task 1 v3)** — ~~both
    are read-only placeholders in every mode.~~ **Parties Involved superseded
    (2026-09-11, Session Prompt "Detail View Adjustments" 3.9)**: rewritten as
    a real table over `_Partner`, with a working Add (`CreatePartner` bound
    action) and Delete (real DELETE) — see item 17 below for the gaps this
    left open. Attachments is unchanged — still has no backing entity in this
    service or any confirmed companion service at all; still out of scope.

17. **Session Prompt "Detail View Adjustments" (2026-09-11) — gaps left open
    by this pass, tracked here so they aren't lost:**
    - **Contact persistence** — the new `po>/ProviderContact` Value Help
      (item 3.5) lets the user pick a contact and shows it in the createMode
      Contact field, but there is still no confirmed write-back path for
      persisting that selection onto the order itself (no header/item
      property for it was identified in so.xml this session) — the picked
      value only lives in the local `createEnrich` model today.
    - **`zui_providerorder_srv` service binding name** — `manifest.json`'s new
      `po` model URL follows the standard OData v4 SEGW/RAP binding-name
      convention mirrored from `mainService`'s own shape, but was never
      independently confirmed against a live system (no backend access this
      session) — verify in `/IWFND/MAINT_SERVICE` before relying on it live.
      Same caveat for `BusinessPartnerCompany` being assumed 1:1 with this
      app's `SoldToParty`/Provider id.
    - **Priority ordering convention** — "lowest `DeliveryPriority` code =
      most urgent" is the standard SD assumption used by
      `_computeHeaderPriority`'s "mixed" resolution, never independently
      confirmed against the live `/DeliveryPriority` VH data/any ranking
      annotation.
    - **Partner edit dialog** — `onPartiesEditRow` is an explicit placeholder
      toast (`partiesInvolvedEditPlaceholder`); no dialog for editing a
      `HeaderPartner` row's other fields exists yet, only the Name/Customer
      change (reusing the Provider picker) and Delete are real.
    - **"Main Partner" flag** — the Parties Involved table's Main Partner
      column is unbound/disabled; no such flag exists anywhere on
      `HeaderPartnerType` in so.xml. If the client needs this, it likely
      requires a new backend field/determination, not a client-side fix.
    - **`ProductUOM`/`c_productunitsofmeasurevh`** — confirmed still
      unused/unwired this session (UOM auto-default now comes from the NDC's
      own `BaseUnit` property instead, item 3.7) — noted here only for future
      reference, no action needed unless `BaseUnit` turns out to be wrong for
      some materials.

18. **Items grid fund-type rework / Delete row / Itm# calc (2026-09-16/17) —
    gaps left open by this pass:**
    - **`SalesOrderItem` client-side placeholder numbering is unverified
      against a real deep-create POST.** `onItemsAddRow` now sets a
      client-computed "next +10" value on new rows, relying on the property's
      `@Core.Computed` annotation (so.xml) to mean the backend silently
      ignores/overwrites it rather than rejecting the request outright. Never
      confirmed live this session — if a create-mode Save ever starts failing
      specifically on item creation after this change, this is the first
      thing to re-check (strip `SalesOrderItem` from the `create()` payload if
      so).
    - **Two live-test bugs found and fixed same session**: (1) MVGR1 core:Item
      keys were placeholder full words, not the real 3-char domain — fixed to
      `ADU`/`PED`/`MIX` (client-confirmed); (2) changing Order Intention did
      not clear an already-selected, now-invalid Fund Type (a disabled
      `core:Item` doesn't auto-deselect itself) — fixed via new
      `onOrderIntentionChange` handler. See NOTES.md 2026-09-16/17 entry for
      full detail on both.
    - **`ARR`/`N/A`/`S/L` all share one `ZZRESQTY` mirror** — no per-code split
      was specified by the client for these three; if a future requirement
      needs them tracked separately, `ZZRESQTY` would need to be split into
      three real backend fields first (none exist today).
    - **SPL ("Split") stays permanently disabled** — split-funding UI/logic
      was explicitly out of scope for this pass, not just deferred pending
      data.

## Swap-back readiness statement (target: `ZUI_VACCINEREQUEST_O4`)

Files that must change when swapping the temporary
`C_SALESORDERMANAGE_SRV`/`C_SALESORDERMANAGE_SD` service back to the permanent
`ZUI_VACCINEREQUEST_O4` service:

- `frontend/cockpit/webapp/model/ServiceSchema.js` — every entity set, property,
  and navigation constant (the single source of truth; this is the file the
  grep isolation check confirms is the *only* place literal SAP artifact names
  from the temporary service appear in `.js` files).
- `frontend/cockpit/webapp/manifest.json` — `dataSources.mainService.uri`.
- `frontend/cockpit/webapp/localService/metadata.xml` (mock metadata snapshot;
  currently copied from `design/so.xml`).
- `ui5-local.yaml` / `ui5-mock.yaml` — `urlBasePath` / `urlPath`.
- All `.fragment.xml` files under `frontend/cockpit/webapp/sections/` — these are
  the sanctioned "declared swap surface" containing literal SAP property/nav
  names directly in XML bindings (by design, per the repoint prompt), so every
  fragment needs its field paths re-verified against the new service's metadata:
  `Details.fragment.xml`, `Items.fragment.xml`, `Shipping.fragment.xml`,
  `OrgData.fragment.xml`, `PriceTotals.fragment.xml`, `Billing.fragment.xml`,
  `PaymentMethod.fragment.xml`, `ScheduledActions.fragment.xml`,
  `Status.fragment.xml`, `Dates.fragment.xml`.
- The two draft touchpoints noted in the original repoint prompt (fixed-filter/
  key handling) — re-check whether `ZUI_VACCINEREQUEST_O4` is draft-enabled
  (unlike this temporary service, which is confirmed NOT draft-enabled); if it
  is, `keys.orderId`-only binding and the removed `IsActiveEntity` handling in
  `Master.controller.js`/`Detail.controller.js` will need to be reinstated.
- Once swapped, every field currently marked BLOCKED-BY-SERVICE in
  `PHASE2_AUDIT.md` should be re-checked — several (Description, Category,
  header Priority, Tax/Gross, Payment instrument, Scheduled Actions, Status
  History, Dates, Service Org Unit/Organization) may become available and
  should be un-blocked.

**Target answer confirmed:** the grep isolation check
(`grep -rn "SalesOrderManage|SoldToParty|OverallSD" webapp/ --include=*.js`)
currently returns hits **only** in `ServiceSchema.js` — see `PHASE2_AUDIT.md`
Section H. This confirms the swap-back surface is limited to `ServiceSchema.js`
+ the fragments + the two draft touchpoints, nothing else.
