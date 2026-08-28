# Open Questions — Phase 2 (Design Compliance Build)

## Data/design questions for the customer or backend team

1. **Description / Category (Master column + Details field)** — no free-text
   description or category field exists on `SalesOrderManageType` in the current
   temporary service. Is there a customer-side field (custom Z-field, long text,
   or something on a different entity) that should back these, or should they
   stay permanently blank/em-dash until `ZUI_VACCINEREQUEST_O4` is available?
2. **Employee Responsible display name** — only the personnel number
   (`_SoldToPartyContactInfo/ResponsibleEmployee`) is exposed; there is no name
   resolution (e.g. via `UserType`/`BusinessPartner`) for it in this service,
   unlike Created By (`_CreatedByUser/UserDescription`, which does resolve to a
   name). Master column and Detail "Employee Responsible" title both show the
   raw number only. Should the backend expose a resolved name, or is the raw
   personnel number acceptable for this prototype?
3. **Priority (header-level)** — `DeliveryPriority` exists only on
   `SalesOrderItemType` in this service, not on the header. The Phase 2 design
   calls for a header/master-list Priority filter and Detail field. Is Priority
   meant to be an **item-level, multi-value** concept (i.e. each vaccine line
   item can have its own priority, no single header priority), or should the
   permanent `ZUI_VACCINEREQUEST_O4` service expose a header-level Priority
   field? If item-level is correct by design, the master filter/Detail field
   should probably be redesigned around "any item has priority X" semantics
   rather than left disabled.
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
    4. Confirmation of the Priority/Order Reason/Category/Intention enum
       codes used in `webapp/model/Enums.js` (Intention likely maps to
       MVGR1).
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
    5. **Item "Intention"** — confirmed no backing field anywhere in the
       bound `$metadata` (same BLOCKED-BY-SERVICE status as Fund Type/PO
       Reference/Brand); Add Item cannot set it. Confirm whether
       `ZUI_VACCINEREQUEST_O4` will expose an item-level Intention field, and
       whether `TS_B2-2_NDCVH.docx`'s NDC-default logic should drive its
       initial value once it does.
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
16. **Parties Involved / Attachments (new sections, CRUD Task 1 v3)** — both
    are read-only placeholders in every mode. Parties Involved has no
    per-partner write entity wired (see item 14 above — same `_Partner`
    gap); Attachments has no backing entity in this service or any confirmed
    companion service at all. Both are out of scope for this pass; flagged
    here in case a future task wants to scope either as real functionality.

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
