<!-- TEMPLATE: copy this file to CLAUDE.md (untracked, personal) and adjust for your own tooling. The copy is git-ignored; this template is the shared baseline. -->
# VTrckS — auto-loaded agent kickoff

This repo is the CDC VTrckS E008 ordering cockpit (`frontend/cockpit`). `main` is branch-protected: pull request + code-owner review required; direct pushes are rejected by GitHub.

## Branch rules (every code change)
- Start from fresh `main`: `git checkout main && git pull --ff-only`.
- Work on `feature/<task-slug>` (or `fix/<slug>`); one task per branch.
- Commit small, logical steps: `<Area>: <what changed>`.
- Rebase on `origin/main` before the PR; push the branch; open a PR (`gh pr create --fill --base main`, or give the user the compare URL) and fill the PR template's Evidence section.
- Never push `main`, never force-push a shared branch, never merge your own PR. The session ends with the PR open.

## Conventions reviewers enforce
- All OData names from `webapp/model/ServiceSchema.js`; no entity/property/action string literals in fragments or controllers. Unknown name → `null` + `TODO-VERIFY`, never invented.
- No business codes (fund types, statuses) in views — they come from data or the designated provider modules.
- OData V4 APIs only; deferred update groups belong to their own flow; backend messages via the shared MessageExtractor/popover (never a MessageToast for a failure).
- `sap.ui.layout.form.Form` with FormContainers (never `SimpleForm`); no `localStorage`; every string in `i18n.properties`; console clean; keyboard operable.
- Verify live API documentation before writing any API call; never fabricate configuration parameters; flag uncertainty explicitly.

Task specs, design decisions and project notes are maintained by the code owner and supplied with each task.
