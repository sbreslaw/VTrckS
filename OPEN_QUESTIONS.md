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
   backend team attention**: (a) should `CL_SD_S4H_STD_PARTNER_CONTACT=CM002`
   handle `cx_rap_query_filter_no_range` gracefully instead of asserting, and
   (b) is the Detail page's single-entity read of this same navigation (Contact/
   Ship-To address, Billing's Payer/Bill-To party) safe, or does it need the
   same client-side removal? **Not yet verified live** — please test opening a
   Detail record after this fix and report whether it also 500s.
9. **Confirm the real E008 vaccine-order `SalesOrderType`(s)** — `ServiceSchema.fixedOrderTypes`
   was set to `["ZVR1"]` as an unconfirmed placeholder and was found live
   2026-08-03 to incorrectly exclude a real, valid order (500000043) from every
   search (it doesn't appear to be type `ZVR1`). The automatic search-time
   restriction to this list has been **removed** (search now matches the
   unfiltered initial list load — see NOTES.md), but the optional "Order Type"
   filter dropdown still only offers `ZVR1` as a choice. Please confirm the
   correct order type code(s) for E008 vaccine requests on this system so the
   dropdown's allow-list can be corrected (or replaced with the full
   `SalesOrderType` value-help entity if there's no fixed E008-specific set).

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
