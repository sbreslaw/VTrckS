# frontend/returns — agent kickoff (cdc.vaccret, "Manage Returns")

This folder is the CDC VTrckS E008 **Manage Returns** app (`cdc.vaccret`), a
separate SAPUI5 freestyle app from `frontend/cockpit` (ADR-001). `main` is
branch-protected: pull request + code-owner review required; direct pushes
are rejected by GitHub.

## Branch rules (every code change)
- Start from fresh `main`: `git checkout main && git pull --ff-only`.
- Work on `feature/<task-slug>` (or `fix/<slug>`); one task per branch.
- Commit small, logical steps: `<Area>: <what changed>`.
- Rebase on `origin/main` before the PR; push the branch; open a PR
  (`gh pr create --fill --base main`, or give the user the compare URL) and
  fill the PR template's Evidence section.
- Never push `main`, never force-push a shared branch, never merge your own
  PR. The session ends with the PR open.

## Conventions reviewers enforce
- All OData names from `webapp/model/ServiceSchema.js`; no entity/property
  string literals in fragments or controllers. Unknown name → `null` +
  `TODO-VERIFY`, never invented.
- No business codes (return types, statuses) in views — they come from data
  or `ReturnTypeConfig.js`.
- OData V4 APIs only; this app is **read-only in MVP-1** — no create, no
  edit, no PATCH/POST, no sticky session calls.
- Backend messages via the shared `util/MessageExtractor.js`/message popover
  (never a MessageToast for a read failure).
- `sap.ui.layout.form.Form` with FormContainers (never `SimpleForm`); every
  string in `i18n.properties`; console clean; keyboard operable.
- `util/VariantStore.js`'s `localStorage` fallback is personalization-only
  scratch storage (column layout/filter variants), copied verbatim from the
  cockpit's own module of the same shape — not business data. Flagged in
  NOTES.md, not a violation of the "no localStorage" rule for business state.
- Verify live API documentation before writing any API call; never fabricate
  configuration parameters; flag uncertainty explicitly.

Task specs, design decisions and project notes are maintained in the sibling
`VTrckS-design` repo (`prompts/E008_Returns_MVP1_Session_Prompt.md`,
`design/ADR-001_Returns_Separate_App.md`).
