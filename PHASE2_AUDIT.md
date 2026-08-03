# Phase 2 Audit — Design Compliance Build

Status snapshot for the Phase 2 prompt ("Design Compliance Build") applied to the
E008 cockpit prototype at `frontend/cockpit` (temporary `C_SALESORDERMANAGE_SRV`/
`C_SALESORDERMANAGE_SD` V4 service). Legend: **DONE**, **DONE (simplified)** =
implemented with a deliberate custom simplification instead of the originally
suggested SAPUI5 framework feature, **BLOCKED-BY-SERVICE** = the backing field/
entity does not exist in `design/so.xml`, so the UI element is present but
disabled/em-dash/empty-state.

## P1 fixes

- Draft-key (`IsActiveEntity`) check — **DONE**. Confirmed absent from
  `SalesOrderManageType`'s `<Key>` block; no draft-related code added.
- `Detail.controller.js` dead code (`onMvp2Action`) — **DONE**, removed.

## Section A — Master list (8 columns)

- Vaccine Request ID, Description, Provider, Status, Contact, Created At,
  Employee Responsible, Created By — **DONE**. Description and Employee
  Responsible *title* are em-dash (**BLOCKED-BY-SERVICE**: no free-text header
  description field; no resolved display name for Employee Responsible, only a
  personnel number via `_SoldToPartyContactInfo/ResponsibleEmployee`).
- Column order/visibility is driver by `_getColumnDefs()` + a VariantStore-backed
  layout (`masterTableLayout` key) — **DONE (simplified)**: full reorder+visibility
  custom dialog instead of `sap.m.p13n.Engine`/`sap.ui.comp.p13n`, because there is
  no live FLP/`sap.ui.fl` backend to persist against in this prototype.

## Section B — Master filter bar

- 6 visible-in-bar groups (Provider Pin, Request ID, ExIS ID, Provider, Employee
  Responsible, NDC) + 10 dialog-only groups (Created On range, Contact, Ship-To
  Party, Created By, Order Type, Status, Jurisdiction, Priority, Delivery Block
  Reason, Rejection Reason) + hit-count Slider (10–100 step 10, default 50) —
  **DONE**, all fields wired via `sap.ui.comp.filterbar.FilterBar`.
  - Provider Pin, Employee Responsible, NDC Code, Rejection Reason filters —
    **BLOCKED-BY-SERVICE**: disabled controls with tooltip; no header-level field
    (NDC/Rejection Reason are item-only) or no reliable filterable path (Employee
    Responsible resolution).
  - **Priority filter — BLOCKED-BY-SERVICE** (found during this pass): `DeliveryPriority`
    exists only on `SalesOrderItemType`, not on the header entity at all — disabled
    with tooltip, same treatment as the other blocked filters. See NOTES.md
    "Phase 2 (Design Compliance Build)" entry for the correction history.
  - Jurisdiction filter conditionally disabled via `ServiceSchema.showJurisdictionFilter`
    (repoints to Sales Office as a stand-in — this temporary service has no DCL
    jurisdiction scoping, see original repoint prompt).
- Clear button — **DONE** (`onFilterBarClear`, resets all controls + slider to 50).
- Variant management (Select / Save As / Manage) — **DONE (simplified)**: custom
  `Select` + two `Dialog`s backed by `VariantStore.js` (browser `localStorage`),
  instead of `sap.m.VariantManagement`/`sap.ui.fl`, for the same no-live-FLP-backend
  reason as table personalization above.

## Section C — Detail title actions

- Save / Cancel / New / Copy / Create Return / Create Replacement — **DONE**, all
  present, disabled, with tooltip (`editAvailableLaterPhase`/`actionLaterTooltip`) —
  not BLOCKED-BY-SERVICE, just out of scope for this phase (no write operations yet).
- Preview Output / Refresh — **DONE**, enabled and functional (`onPreviewOutput`
  shows a placeholder dialog since there's no real output-preview endpoint wired
  yet; `onRefresh` re-reads the bound entity).

## Section D — Per-section dynamic Edit button

- **DONE**. `SectionFactory.js` renders a per-section Edit button bound to the
  `sectionFlags` model, visible/enabled only when `SectionConfig.js` marks that
  section `editable: true` (currently: Billing, Payment Method).

## Section E — Details fragment (4 form groups)

- **General Data, Dates, Value, Notes** groups — **DONE**.
  - Provider ID/Name, Order Type, Contact, Employee Responsible personnel #,
    Other Reason, Status, ExIS ID, Created At, Net Value — real data.
  - Description, Category — **BLOCKED-BY-SERVICE** (em-dash; no matching header field).
  - Priority — **BLOCKED-BY-SERVICE** (em-dash; item-level only field, see Section B).
  - Tax, Gross (Value group) — **BLOCKED-BY-SERVICE** (em-dash; only `TotalNetAmount`
    exists at header level — `TaxAmount`/no-gross-field exist only per item).
  - Notes — **BLOCKED-BY-SERVICE**: no notes/comments entity found; shown as a
    read-only placeholder text.
  - Pre-existing "Custom Fields" group left unchanged.

## Section F — Items fragment (15 columns) + Export/Personalize

- Row Action (menu, all items disabled), Opt-Out Ancillary, Item #, ExIS ID,
  Brand, NDC Code, NDC Description, Qty, UoM, Order Intention, Fund Type,
  PO Reference, Delivery Status, Net Value, Rejection Reason — **DONE**.
  - Brand, Order Intention, Fund Type — **BLOCKED-BY-SERVICE** (em-dash; no
    matching item-level field found).
  - PO Reference — **BLOCKED-BY-SERVICE** (em-dash; only `PurchaseOrderByCustomer`
    exists, already used for ExIS ID — no distinct second PO-reference field).
  - Delivery Status shown via `_DeliveryStatus/DeliveryStatus_Text` (corrected
    from the raw one-letter code during this pass, per its `SAP__common.Text`
    annotation in `so.xml`).
- Export to Excel — **DONE**, `sap.ui.export.Spreadsheet` (`onItemsExport`),
  respects current column visibility; `sap.ui.export` added to
  `manifest.json`'s `sap.ui5.dependencies.libs`.
- Personalize (visibility only) — **DONE (simplified)**: custom show/hide-only
  dialog (fixed column order) backed by `VariantStore.saveVariant("itemsColumns", ...)`,
  instead of `sap.m.p13n.Engine`, same no-live-FLP-backend reason as Master.

## Section G — New sections + Shipping/OrgData additions

- **Shipping.fragment.xml**: added Delivery Block Status — **DONE**, real field
  (`OverallDeliveryBlockStatus`).
- **OrgData.fragment.xml**: added Sales Group (real, `SalesGroup`) — **DONE**;
  Service Org Unit, Service Organization — **BLOCKED-BY-SERVICE** (em-dash; no
  matching fields found — this service has no CRM/Service-org concept at all).
- **PriceTotals.fragment.xml** (new) — **BLOCKED-BY-SERVICE**: no distinct
  pricing-breakdown/condition-summary entity beyond header Net/Tax/Gross
  (themselves partially blocked, see Section E); shown as a `MessageStrip` TBD
  placeholder.
- **Billing.fragment.xml** (new) — **DONE**: Payer, Bill-To Party (via
  `_SoldToPartyContactInfo`), Payment Terms (`CustomerPaymentTerms`), Billing
  Status (`OverallOrdReltdBillgStatus`), Billing Block Status
  (`OverallBillingBlockStatus`) — all confirmed real header fields.
- **PaymentMethod.fragment.xml** (new) — **DONE (partial)**: the header's
  single-value `PaymentMethod` code (+ `_PaymentMethodVH` text) IS real and shown
  as a form field (added during this pass, previously missed). The
  card/payment-instrument table (card #, holder, limit, authorization) below it
  is **BLOCKED-BY-SERVICE**: no such entity exists in this service at all — shown
  as a designed empty state. Deliberately **no CVV column** anywhere (PCI-DSS —
  CVV must never be stored/displayed even if such an entity existed later; see
  OPEN_QUESTIONS.md).
- **ScheduledActions.fragment.xml** (new) — **BLOCKED-BY-SERVICE**: no scheduled
  actions/workflow entity found; designed empty-state table.
- **Status.fragment.xml** (new) — **BLOCKED-BY-SERVICE**: no status-history/audit
  trail entity found (only the current-value status fields already on the
  header); designed empty-state table.
- **Dates.fragment.xml** (new) — **BLOCKED-BY-SERVICE**: no additional
  date-tracking entity beyond `CreationDate` (already in Details/General); shown
  as a `MessageStrip` TBD placeholder.

## Section H — Documentation & isolation

- `NOTES.md` — **DONE**, dated Phase 2 entry added documenting the metadata
  corrections found during this pass (ship-to-party, priority, tax/gross amount,
  status/delivery-status text paths, payment method).
- `PHASE2_AUDIT.md` — **DONE**, this file.
- `OPEN_QUESTIONS.md` — **DONE**, see companion file.
- Grep isolation DoD (`grep -rn "SalesOrderManage|SoldToParty|OverallSD" webapp/ --include=*.js`
  restricted to only hit `ServiceSchema.js`) — **DONE, PASSING**. Two comment-only
  hits in `formatter.js` were reworded to remove literal SAP artifact names during
  this pass so the check is now clean.

## Custom simplifications summary (vs. originally suggested SAPUI5 features)

| Area | Suggested | Implemented instead | Why |
|---|---|---|---|
| Master/Items column personalization | `sap.m.p13n.Engine` / `sap.ui.comp` p13n | Custom Dialog + `VariantStore` | No live FLP/`sap.ui.fl` backend in this prototype to persist against |
| Master filter variants | `sap.m.VariantManagement` | Custom `Select` + Save/Manage Dialogs + `VariantStore` | Same — `sap.ui.fl` needs a real ABAP FLP/CTS backend |

All of the above are marked with `TODO-VERIFY`/simplification comments in code
and should be revisited once `ZUI_VACCINEREQUEST_O4` (the target permanent
service) and its FLP integration are available — see OPEN_QUESTIONS.md
"swap-back readiness".
