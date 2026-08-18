# UI Task Prompt — Master List: Grid Table Migration + Toolbar Actions

Read `AGENT_ONBOARDING.md` and `UI5_AGENT_PLAYBOOK.md` first; all standing rules apply (OData V4 idioms only, ServiceSchema isolation, i18n for every string, 508/keyboard pass, console clean, no transactional behavior yet). Scope: **two changes to the Master view only.** Do not touch Detail, sections, or ServiceSchema mappings.

## Task 1 — Replace `sap.m.Table` with `sap.ui.table.Table` (grid table)

Reason: users need column drag-reorder and resize on the request list.

### View (`Master.view.xml`)
- Replace the responsive table with `sap.ui.table.Table`:
  - `rows` binding to the same entity set via ServiceSchema constant (was `items`); keep the existing fixed filters (`IsActiveEntity eq true`, order type `ZKB`) — applied in the controller exactly as today, `Filter` objects on the **rows** binding.
  - `selectionMode="Single"`, `selectionBehavior="RowOnly"`.
  - **Layout (prescribed — proven pattern for this control inside DynamicPage/FCL):** wrap the table in a `<VBox fitContainer="true" renderType="Bare" width="100%" height="100%">` placed as the DynamicPage content. Table uses `visibleRowCountMode="Interactive"` with `visibleRowCount="12"` initial — the user resizes the visible row area via the drag handle. Persist the user's row-count adjustment into the variant state alongside column state (listen to the row-count change event, debounce, VariantStore). Do not use `Auto` mode.
  - `fixedColumnCount="2"` — **Vaccine Request and Description are the fixed pair**: first two columns, frozen. In the p13n metadata mark both as non-hideable and non-movable, and block drag-reorder from moving any column into/out of the fixed zone (guard in the `columnMove` handler if the control doesn't enforce it).
  - `enableColumnReordering="true"`; every column `resizable="true"` with an explicit initial `width` and `autoResizable="true"`.
  - **Navigation:** grid tables have no `type="Navigation"` rows. Add a `rowActionTemplate` with one `sap.ui.table.RowActionItem type="Navigation"` (`rowActionCount="1"`), press → existing detail-navigation handler (resolve the row's binding context from the event). Keep row *selection* independent of navigation.
- Columns: same nine columns, same order, same cell templates (the ObjectIdentifier specs carry over — templates move into each `sap.ui.table.Column`'s `template` aggregation; column headers become `label` with i18n texts). Multi-line popin behavior no longer exists — verify no column relied on popin content.
- `noData` text: preserve the current two-state empty text logic.

### Controller (`Master.controller.js`)
- Rebind logic: `getBinding("rows")` everywhere `getBinding("items")` was used (search, clear, Max Hits `$top` via `changeParameters`, fixed filters).
- Result count in the page title: `updateFinished` doesn't exist on grid tables — use the binding's `change`/`dataReceived` events (or `rowsUpdated`) and `oBinding.getCount()` (requires `$count: true` binding parameter — add it).
- Growing is gone: the grid table + V4 model do virtual scrolling natively. Remove growing-related code. Keep Max Hits semantics: slider still caps via `$top`.

### Personalization rewiring (this is the subtle part)
- Re-register the table with the existing `sap.m.p13n.Engine` setup: the SelectionController metadata helper must now enumerate `sap.ui.table.Column`s; visibility maps to `column.setVisible`, order to column re-insertion. Column **width** joins the persisted state.
- **Two-way sync requirement:** user drag-reorders and drag-resizes must flow *into* the persisted variant, not just dialog-driven changes. Attach `columnMove` and `columnResize` events → update the p13n/VariantStore state (debounce resize). Test: drag a column, reload the app, order persists; same for width and for dialog-driven hide/show.
- Persistence stays behind the existing `model/VariantStore.js` wrapper — no new storage paths.

## Task 2 — Header toolbar actions

Add an `OverflowToolbar` in the grid table's `extension` aggregation: `Title` (list title + count) · `ToolbarSpacer` · **Create** · **Refresh** · existing **Personalize** button (relocate here if it lives elsewhere).

1. **Create New Request** — `sap.m.Button icon="sap-icon://create"` (falls under the requested "New Document" glyph; use `sap-icon://add` only if `create` renders poorly in Horizon), `tooltip` + text from i18n. CRUD is the *next* task: wire press to the established placeholder pattern — `MessageToast` "Create Vaccine Request — available with the next release" — and leave a single `// TODO(CRUD): navigate to create context` marker at the handler. Enabled, visible, placeholder-behaving.
2. **Refresh** — `sap-icon://refresh`, functional now: `getBinding("rows").refresh()`, keeping current filters/sort/$top intact (refresh, not rebind). Show a brief busy state on the table during the round trip.

## Definition of done
- Column drag-reorder, resize, the p13n dialog, and the interactive row-count handle all work **and** all persist through VariantStore (reload survives; saved variants capture order+visibility+width+row count). Fixed pair (Vaccine Request, Description) stays frozen, unhideable, unmovable.
- Navigation to detail works via the row-action chevron; deep link and FCL behavior unchanged.
- Search, Clear, Max Hits, fixed ZKB/IsActiveEntity filters, count display: all behave exactly as before against the rows binding.
- Refresh functional; Create shows the placeholder toast; both keyboard-reachable with tooltips.
- Keyboard pass on the grid table (built-in support — verify the row action is reachable and announced); no popin regressions; i18n complete; console clean.
- Update `PHASE2_AUDIT.md` (table control change + toolbar actions) and `NOTES.md` (any grid-table/FCL sizing findings, p13n rewiring decisions).
