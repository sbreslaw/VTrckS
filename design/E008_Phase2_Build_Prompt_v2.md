# Phase 2 Prompt v2 — Design Compliance Build (supersedes Phase 2 v1)

Read `AGENT_ONBOARDING.md` and `UI5_AGENT_PLAYBOOK.md` in this repo. Scope guard: **UI layout & approved actions surface only — no transactional behavior.** Every mutating action renders as placeholder. Phase-1 rules stand: ServiceSchema isolation (grep check at end), no mocked business data, i18n everything, 508/keyboard pass, console clean.

This prompt is based on a verified audit of the current code — the baseline below is fact, not assumption. Where it says FIX, the defect is confirmed present.

## P1 fixes first
1. **Draft keys (FIX):** the standard service is draft-enabled. `ServiceSchema.buildHeaderPath()` must include `,IsActiveEntity=true` in the key predicate, and `_getFixedFilters()` must add `new Filter("IsActiveEntity", EQ, true)`. Verify against live `$metadata` first (if the entity has no IsActiveEntity key, log that in NOTES and skip — but expect it does). Update the detail route parsing if the pattern carries keys.
2. **Anchor strip (FIX):** anchors are hardcoded in `Detail.view.xml` while panels come from SectionFactory config — single-source them: generate the anchor links from the same section descriptor array (factory exposes it or a shared `sections/SectionConfig.js` module both consume). New sections below must appear in anchors automatically.
3. **Mock demotion:** `ui5-mock.yaml` + `localService/` stay only as an explicitly non-default test artifact; README note that default run targets the dev service. Remove any mock reference from the default `ui5.yaml` path if present.

## A. Master — list columns (replace current template in `_bindMasterItems`)
Order and controls, exactly:
1. Vaccine Request — `Text` (row remains type=Navigation)
2. Description — `Text` (bind if service exposes an order description; else em-dash + BLOCKED-BY-SERVICE in audit)
3. Provider — `ObjectIdentifier` title=`{providerName}` text=`{providerId}` (plain, no link yet — future custom Provider app)
4. Status — `ObjectIdentifier` title=status text, text=status code (per customer instruction; note in audit that semantic coloring moves to detail header)
5. Contact — `Text` (BLOCKED-BY-SERVICE likely; em-dash)
6. Created At — `Text` with date type formatting
7. Employee Responsible — `ObjectIdentifier` title=name text=pernr (BLOCKED-BY-SERVICE likely)
8. Created By — `ObjectIdentifier` title=name text=userid (name via user display if unavailable, show id as title, audit-note it)
Drop the Net Value column (customer design excludes it) — record removal in audit. Column widths/popin priorities set so the begin column stays readable at default FCL width.

## B. Master — filters (rework `filterGroupItems`)
Visible by default (`visibleInFilterBar=true`): Provider PIN, Vaccine Request ID, ExIS ID, Provider (single Input matching name OR id — build OR filter over providerName/providerId), Employee Responsible (single Input, name OR pernr — BLOCKED-BY-SERVICE for filtering until the field exists; render enabled=false + tooltip), NDC Code (stays disabled+tooltip on this service).
Available under Filters dialog only (`visibleInFilterBar=false`): Create Date (existing DateRangeSelection), Contact, Ship-To-Party (name-or-ID single Input), Created By, Sales Order Type (Input or ComboBox over `fixedOrderTypes`), Status (existing MultiComboBox), Grantee (existing jurisdiction), Priority, Delivery Block Reason, Rejection Reason. Wire the ones the service supports (verify Sales Order Type, Delivery Block Reason, ExIS ID=`PurchaseOrderByCustomer` in metadata); disabled+tooltip pattern for the rest. Provider PIN: disabled+tooltip (provider-master field, pending custom service).
**Max Number of Hits:** `sap.m.Slider` 10–100 (step 10, default 50) as a FilterGroupItem (visible in dialog, not in bar) → applied as `$top`/growingThreshold on search.
**Clear:** enable FilterBar clear handling — reset all controls + slider + table filters.
**Variants:** activate FilterBar variant management (search variants) AND master-table layout personalization (`sap.m.p13n` column order/visibility) — both persisted through one `model/VariantStore.js` wrapper (FLP personalization service when available, localStorage fallback), so persistence is swappable. Document the wrapper in NOTES.

## C. Detail — title actions + messaging
`DynamicPageTitle` actions (OverflowToolbar): Save, Cancel, New, Copy, Create Return, Create Replacement Order, Preview Output (icon `sap-icon://print`), Refresh. **No Delete — confirmed decision.** Refresh functional (`refresh()` on the bound context); Preview Output opens a placeholder Dialog titled "Print Preview" with text "PDF output will be generated here" + Close; all others enabled=false, tooltip "Available in a later phase".
`navigationActions`/title area additionally: **MessagePopover button** (standard message-button pattern, bound to `sap/ui/core/Messaging` model — live plumbing, empty content) and **Validate button** (enabled placeholder: press → MessageToast "Validation will run here"; per customer it is a visible placeholder, not disabled).

## D. Per-section Edit — dynamic flag structure
Create JSON model `sectionFlags` (set on the Detail view): `{ details:{editVisible:true,editEnabled:false}, items:{...}, inventory:{...}, shipping:{...}, billing:{...}, paymentMethod:{...} }` — shape mirrors the future resolver feed (status/orderType/user-driven). SectionFactory: replace the generic disabled "MVP-2" button with, per section whose descriptor has `editable:true`, an **Edit** button bound `visible={sectionFlags>/<id>/editVisible}` `enabled={sectionFlags>/<id>/editEnabled}` (press → toast placeholder). Non-editable sections (histories, totals) get no Edit button. Extend descriptors with `editable`.

## E. Detail — Details section regroup (`sections/Details.fragment.xml`)
Four groups in the SimpleForm (use form group containers/titles): **General Data** (Vaccine Request ID, Description, Provider, Provider Address, Contact, Employee Responsible, Priority, Other Reason, Category, Status, ExIS ID), **Dates** (Created At), **Value** (Net, Tax, Gross — currency types), **Notes** (read-only TextArea, growing, bind if a notes source exists else empty + BLOCKED-BY-SERVICE). Pending-service fields: em-dash values, never fake.

## F. Items section upgrade (`sections/Items.fragment.xml`)
Columns in order: Row Action (menu button: Edit / Delete / Fund Split — all placeholder toasts, enabled=false), Opt-Out Ancillary (bind ZZ1 field from `customItemFields` — it exists in schema), Item Number, ExIS ID, Brand, NDC Code (Product), NDC Description (item text), Qty, UoM, Order Intention, Fund Type, PO Reference, Delivery Status, Net Value, Rejection Reason. Pending fields em-dash. Header toolbar: **Export to Excel** (functional, `sap.ui.export.Spreadsheet` over the binding) + **Personalize** (p13n via VariantStore). If `sap.m.Table` popin makes 15 columns unusable in the mid column, switch this fragment to `sap.ui.table.Table` with fixed first column — decide, justify in audit, keep keyboard support.

## G. New sections (extend SectionConfig; anchors auto-extend)
After existing sections, order: **Price Totals** (panel, NoData "Design TBD"), **Billing** (form: Payer, Bill-to Party, Payment Terms, Billing Status, Billing Block Status — map from service where present), **Payment Method** (table: Payment Method, Card Type, Valid Thru MM/YYYY, Card Number **masked last-4 via formatter**, Card Holder, Card Limit, Authorized Amount, Currency, Authorization Status — **no CVV column anywhere**; add to OPEN_QUESTIONS the best-practice proposal: CVV never stored/displayed, entry-only in future payment dialog, PAN tokenized/masked per PCI-DSS), **Scheduled Actions** (table: Row Action Execute/Delete disabled, Status, Action Definition, Processing Type, Created By, Created On, Created At, Executable — designed empty-state, NoData names the backend dependency), **Status** (table: Row Action, Status, Changed By, Changed On, Changed At — bind if change source exists, else designed empty-state), **Dates** (panel, NoData "Design TBD").
Shipping fragment: ensure fields Provider, Provider Address, Shipping Conditions, **Delivery Status (plain Text placeholder)**, **Delivery Block Status (plain Text placeholder)** — customer will define update semantics later. OrgData fragment: Sales Org Unit, Sales Organization, Distribution Channel, Division, Sales Office, Sales Group + **Service Org Unit and Service Organization as free-form editable-later Text fields (display em-dash now)** per customer instruction.

## H. Wrap-up
Update `PHASE2_AUDIT.md` (create at repo root): per requirement above DONE/BLOCKED-BY-SERVICE + the BLOCKED list grouped as "custom-service field requirements". Update `OPEN_QUESTIONS.md`: CVV proposal, Description/Contact/ER data sources, name-resolution for CreatedBy/ER. Swap-back statement refreshed (new fragments + SectionConfig listed). DoD: grep isolation passes; variants/export/p13n/slider/Clear/Refresh/MessagePopover functional; draft-key fix verified against live service; anchors generated; keyboard pass; i18n complete; console clean.
