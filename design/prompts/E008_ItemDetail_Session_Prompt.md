# Session Prompt — Item Details View (FCL Third Column, Section-Panel Cockpit)

## 1. AUTHORITY
Read first: `AGENT_ONBOARDING.md` · `UI5_AGENT_PLAYBOOK.md` · `NOTES.md` (newest first) · `design/so.xml` (item entity is the binding source of truth) · this file. Reference screenshots: `design/details.png`, `design/shipping.png`, `design/prices.png` (commit them with this prompt).
Scope guard: new item-detail view + routing + item Action-menu wiring + section fragments. Do NOT touch order-level sections, save choreography, fund logic, or IoH (on hold). This is a **display-first** deliverable: all sections render read-only with the same disabled-Edit affordances the legacy screenshots show; item editing flows are later tasks.
**Hard UI rule:** all forms use `sap.ui.layout.form.Form` with `FormContainer`/`FormElement` — **`SimpleForm` is prohibited** (grep-enforced in DoD). Layout, spacing, and panel idiom must match the Order Details view exactly — same SectionFactory pattern, same Panel headers, same flags-model conventions.

## 2. STEP-0 RECONCILE (verdicts to NOTES)
- [ ] FCL setup: current layout handling in `App`/`Detail` controllers; confirm the app's `sap.f.FlexibleColumnLayout` supports an end column (routing config, layout model). Note how order-detail full-screen is currently expressed.
- [ ] Item Action menu in `Items.fragment.xml`: does an "Edit" option exist (greyed) or must it be added? Record.
- [ ] `SectionFactory`/`SectionConfig`: parameterizable for a second view (config injection) or Detail-coupled? **Prefer parameterizing the existing factory** (constructor/init takes a config + flags-model name); create a mirror only if parameterization risks Detail regressions — one-line rationale either way.
- [ ] Item entity property inventory from `design/so.xml` — map every screenshot field to a property or mark `TODO-VERIFY`/pending: Product + description; RequestedQuantity + unit; Rejection Reason (property + whether a RejectionReason VH entity set exists in the service); item Status (which status property backs "Open"); Order Intention (`MaterialGroup1`); Funding Type (`MaterialGroup2`); PO Reference (item-level customer reference — verify name); Delivery Status + Total Qty Delivered; Net Value per Unit + per/pricing unit; Net/Gross Value + currency; Shipping: item delivery block, partial-delivery/delivery control, order-combination indicator (each verified or pending — do not guess VBAP-era names into V4 properties).
- [ ] Prices entity: confirm ABSENT (backend in development) — placeholder path applies.

## 3. THE WORK

### 3.1 Routing & navigation (the exact UX contract)
- New route `order/{orderId}/item/{itemPath}` targeting a new `ItemDetail` view in the FCL **end column**; deep-linkable (direct URL load binds and renders correctly).
- **Open:** Item Action menu → Edit → navigate; FCL layout set to **`EndColumnFullScreen`** — the item view opens full screen, always.
- **Back (view header back button):** navigate to the order route with layout **`MidColumnFullScreen`** — per spec the order details returns FULL SCREEN regardless of the layout it had before the drill-down (deliberate; do not "restore previous layout").
- Item context binding on the standard model: item entity by `SalesOrder` + `SalesOrderItem` keys, `$select` including `SAP__Messages`; busy state while binding resolves; not-found target for stale links.

### 3.2 View shell
`ItemDetail.view.xml`: DynamicPage; title = Product ID + description, subtitle = order + item number (i18n-composed); back button per §3.1; content = the stacked-panel container built by the (parameterized) SectionFactory from a new `ItemSectionConfig` with its own flags model (`itemSectionFlags`). Sections lazy per the house pattern.

### 3.3 Sections
1. **Details** (`details.png`) — one Form, FormContainers exactly: **General Data** (Product ID [RO], Product [RO], Quantity + UoM [RO], Rejection Reason [RO field; VH-shaped control rendered disabled — display value only this phase], Status [RO]); **References** (Order Intention, Funding Type, PO Reference — all RO); **Shipping and Billing** (Delivery Status, Total Qty Delivered — RO); **Item Value** (Net Value per Unit + "per" pricing unit + UoM, Net Value + currency, Gross Value + currency — RO, amount formatting per house formatter); **Notes** (TextArea, disabled, pending tooltip — item text write path is a later backend task). Section header carries a disabled Edit button (parity with screenshot).
2. **Shipping** (`shipping.png`) — Form/FormContainers: Provider + Provider Address (from the ORDER context — display only), Delivery Status, Dlv. Block Reason, Delivery Control, Combine Orders (checkbox, RO) — each bound to its Step-0-verified item property or rendered with the pending pattern where unverified/absent. Disabled Edit + disabled "Alternative Shipping Address" action in the header (parity).
3. **Shipping Transactions** — placeholder panel: designed empty state (i18n "No shipping transactions — available in a later release"), no table machinery.
4. **Prices** (`prices.png`) — the entity set is in development: build the REAL table shell with the exact column set (Actions | Status | Price Element | Price | Unit | Price Unit | UoM | End Value | Currency), bound to a ServiceSchema constant that is `null` + `TODO-VERIFY(prices-entity)`, rendering the designed empty state "pricing details pending backend service"; toolbar per screenshot (Insert, Reprice, Complete Reprice, Add, Edit List, Filter) — all rendered **disabled** with pending tooltips. When backend delivers, wiring = one constant + binding activation; note this in the fragment header comment.
5. **Transaction History** — placeholder panel, same empty-state pattern, "TBD".

### 3.4 Wiring
- Items fragment: enable the Edit menu option → §3.1 navigation (row context supplies the keys). Keep Fund Split and other menu items untouched.
- `ServiceSchema`: `itemDetailProperties` block for every field mapped in Step-0 (constants only; pendings as null + TODO-VERIFY).
- i18n for all labels/titles/empty states/tooltips; `itemSectionFlags` defaults (all sections visible, edit affordances disabled).

## 4. DEFINITION OF DONE
- Live: Items table → Action → Edit on a real item → item view opens FULL SCREEN with Details + Shipping populated from the backend (spot-check three fields against the order in VA03/SE16); back button → order details FULL SCREEN; deep link to the item URL works cold.
- The three pending sections render their designed placeholders/disabled toolbars exactly; no fake data anywhere.
- Grep: zero `SimpleForm` usage; item property literals only in ServiceSchema; no edit/PATCH machinery introduced.
- Order Details view regression-checked (SectionFactory parameterization did not alter its rendering — quick visual pass all sections).
- Console clean; keyboard pass (menu → view → back, section expand/collapse); i18n complete.
- NOTES: Step-0 field-mapping table (property per screenshot field, incl. the unverified/pending ones); factory parameterization decision; the full-screen-both-ways navigation contract as implemented. OPEN_QUESTIONS: Prices entity contract expectations for backend (column↔property mapping proposal drawn from the screenshot — give the backend team a starting list); Rejection Reason VH availability; item Notes write path.
