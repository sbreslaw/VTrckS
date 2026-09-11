# Session Prompt — Detail View Adjustments: Custom Service Wiring, VH Rebinds, IoH Live Binding, Parties Section

## 1. AUTHORITY
Read first: `AGENT_ONBOARDING.md` · `UI5_AGENT_PLAYBOOK.md` · `NOTES.md` (newest first) · `design/E008_CRUD1_v5_Sticky_Amendment.md` · `design/so.xml` + `design/zui_providerorder_meta.xml` (both refreshed — the metadata in these files is authoritative for names) · this file.
Scope guard: Detail view fields/sections + manifest/ServiceSchema wiring. No changes to save choreography, sticky handling, MessageExtractor, Master list, or the fund-split feature. Entity routing is settled — implement, don't re-route: **standard service** = DeliveryPriority, CustomerPurchaseOrderType, ShippingCondition, Product, HeaderPartner, PartnerFunction VHs; **zui_providerorder_srv** = ProviderContact, ZZ_IoH.

## 2. STEP-0 RECONCILE (record every verdict in NOTES; degrade per noted fallback where red)
- [ ] Manifest: add V4 dataSource for `zui_providerorder_srv` (URL from the service binding — TODO-VERIFY exact path), named model **`po`**, `autoExpandSelect`, `operationMode: Server`. ServiceSchema gains a `providerOrderService` block (URL, entity sets, properties).
- [ ] so.xml: `DeliveryPriority` property exists on the ITEM entity (header has none — that's the point of change 1.1); VH set `DeliveryPriority` code/text property names. Item `TaxAmount` property name. Header `CustomerPurchaseOrderType` + `ShippingCondition` updatability (no Computed/Immutable). `Product` entity: key + description + `BaseUnit` + how NDC is represented (Product number vs a standard-ID property — read the props, don't assume). `HeaderPartner`: full property list (does a main-partner flag exist? if absent → column renders disabled with TODO-VERIFY, no local fake), Insert/Update/DeleteRestrictions capabilities, and the sold-to PartnerFunction code present in live data (read one order — do not hardcode 'AG' vs 'SP' from memory).
- [ ] zui meta: `ProviderContact` filterability by `BusinessPartnerCompany`; **live probe**: filter with a known provider's KUNNR — confirm BP-company number equals customer number on this system (CVI same-number convention) or record the mapping need. (ZZ_IoH checks removed — IoH on hold per §3.8.)
- [ ] Current fragment state for: Priority/Category/Contact/Shipping Condition bindings (Enums vs pending), Service Org fields present in OrgData, IoH section binding (local/prepop vs entity), no Parties section yet.

## 3. THE WORK

### 3.1 Header — Priority (virtual header field over item-level DeliveryPriority)
- The header field stays visually where it is but binds **client state** (createState/scratch property in createMode; change mode: computed from items). It is NEVER sent as a header property.
- **Mixed priorities must not survive this tool** (settled rule): uniform item values → display that value; mixed values encountered on an existing order → display the HIGHEST priority among them, and the next Save normalizes ALL items to it. Highest = per SD delivery-priority semantics (conventionally the lowest numeric code = most urgent — **TODO-VERIFY the ordering with functional/VH data before relying on it**; derive from the VH's sort if it encodes rank).
- **Propagation at Save only**: createMode → include `DeliveryPriority` in every item create payload (harvest step); change mode → if the user changed the value OR mixed values were detected at load, add an item PATCH per line into `vrEdit` so all items leave Save uniform. No immediate replication on field change.
- VH: dropdown/ComboBox items bound to standard `DeliveryPriority` entity set (code+text from Step-0). Delete `Enums.PRIORITY` and its i18n texts.

### 3.2 Header — Category → `CustomerPurchaseOrderType`
- Rebind `ServiceSchema.headerProperties.category` to `CustomerPurchaseOrderType` (standard, expected writable → rides create replay/vrEdit natively; confirm via Step-0). VH: standard `CustomerPurchaseOrderType` set. Delete `Enums.CATEGORY` + i18n. Retire any ZZ_BSARK_SDH binding for this field (NOTES: superseded).

### 3.3 Header — TaxAmount (computed, display-only)
- Read-only field = client-side SUM of item `TaxAmount` over the items binding; recompute on items data events; formatted with currency. Never sent, no schema write entry. In createMode pre-commit it shows em-dash/0 (pricing runs at SaveChanges) — refresh after save populates it; note in NOTES.

### 3.4 Header — remove Service Org Unit + Service Organization
- Delete both fields from the OrgData fragment, their i18n keys, and any schema/sectionFlags references. NOTES: removed per customer decision (no S/4 equivalent — terminology map trap #retired).

### 3.5 Header — Contact via `po>/ProviderContact`
- Value help dialog over `ProviderContact` filtered by the selected provider (`BusinessPartnerCompany` = provider per Step-0 probe); display `BusinessPartnerPerson_Text`, hold key `BusinessPartnerPerson`; filter out rows outside `ValidityStartDate/EndDate` (client filter, note it). Provider change clears the selection (existing rule).
- **Write path unchanged-pending**: store selection in scratch/client state; persisting the contact onto the order remains the partner-write/enrichment question — keep the existing pending behavior for persistence, log in OPEN_QUESTIONS (do not invent a write).

### 3.6 Header — Shipping Conditions
- Bind the field to header `ShippingCondition` (writable per Step-0 → joins create replay + vrEdit like other standard fields); VH from the standard `ShippingCondition` set; i18n label.

### 3.7 Items — UOM read-only, defaulted from `Product.BaseUnit`
- NDC selection handler: after material chosen, read the standard `Product` entity for that material and set the row's unit property to `BaseUnit`; UOM cell renders read-only text (remove any input affordance). If the NDC value help gets rebuilt on `Product`, return BaseUnit from the picked row instead of a second read — prefer that if the entity's props support the NDC search (Step-0 verdict decides).

### 3.8 IoH section — ON HOLD (do not implement)
- IoH rework is deferred pending a backend architecture discussion. Leave the current IoH section exactly as it is — no `ZZ_IoH` binding, no pencil/edit machinery, no `ioh` group. Do not remove or modify existing IoH code in this session.
- NOTES entry: "IoH live-binding on hold per architect (backend architecture discussion pending); ZZ_IoH entity available in zui_providerorder_srv when unblocked." Remove ZZ_IoH items from your Step-0 pass.

### 3.9 NEW section "Parties Involved" — standard `HeaderPartner`
- SectionConfig entry + fragment; table bound to `HeaderPartner` filtered to the current order (association or `$filter=SalesOrder eq` per metadata), lazy per section pattern.
- Columns: **Actions**: Edit (placeholder — MessageToast "Partner editing dialog — next phase" + `// TODO(partner-dialog)`) and Delete · **Partner Function** (editable Select, VH = standard `PartnerFunction` set) · **Partner ID** = the partner number property (Customer/Partner per Step-0 reading, RO) · **Name** = `FullName`, with value help REUSING the provider picker (CustomerSalesArea dialog; selection sets the row's customer/partner value) · **Address** (RO — compose from the row's own address properties; for newly added rows default the display from the provider's address per spec) · **Main Partner** checkbox column rendered but **UNBOUND and disabled** (settled: no data binding now; column exists visually with an i18n header and a disabled CheckBox; `// TODO(main-partner): binding to be defined` — will be revisited).
- **Sold-To row rule:** the row whose PartnerFunction = the verified sold-to code renders fully read-only except Edit (allowed), Delete hidden. Enforce client-side; the backend will also refuse — that's fine.
- Write capability per Step-0 capabilities: if HeaderPartner is not insertable/updatable/deletable through this service (the historical partner-write gate item), build the section **read-only** with Add/Delete/function-edit disabled + pending tooltips, and record BLOCKED-BY-SERVICE — do not simulate partner changes locally. Row adds (if permitted): via list binding create in `vrEdit`/`vrCreate` group per mode.

## 4. DEFINITION OF DONE
- Manifest/two-model wiring live; `po` model reads succeed (network tab evidence).
- Priority: VH-driven; create → all items carry the chosen DeliveryPriority (SE16/payload check); change mode → edit header value + Save → every item PATCHed; mixed-values case: order with differing item priorities displays the highest and Save normalizes all items to it (demonstrated live; ordering rule verdict in NOTES).
- Category + Shipping Condition: VH-driven, persisted through the existing save paths (survive hard refresh).
- TaxAmount: equals the sum of item tax amounts on a saved order; read-only; absent from all payloads (network check).
- Service Org fields gone (grep i18n + fragments).
- Contact: dialog lists only the selected provider's valid contacts (two-provider isolation test); selection held client-side; OPEN_QUESTIONS entry present.
- UOM: read-only, correct BaseUnit appears on NDC selection.
- IoH section untouched (diff shows no changes to it); NOTES hold entry present.
- Parties: section renders live partner rows; sold-to row locked per rule; Edit placeholder toast; capability-driven enablement documented either way.
- Greps: no fund/VH literals outside seam modules; Enums.PRIORITY/CATEGORY and their i18n gone; console clean; keyboard pass on new/changed controls incl. the Parties table.

## 5. EVIDENCE OBLIGATIONS
NOTES: every Step-0 verdict (esp. HeaderPartner capabilities, ProviderContact KUNNR probe, sold-to function code as read from live data); the IoH hold entry; Priority mixed-normalization rule + ordering verdict; ZZ_BSARK supersession. OPEN_QUESTIONS: contact persistence path; partner edit dialog (next phase); Main Partner binding (deferred); IoH architecture discussion outcome; ProductUOM availability (unused, noted).
