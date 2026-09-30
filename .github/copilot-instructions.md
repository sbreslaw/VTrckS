# VTrckS — code repo (auto-loaded agent kickoff)

This repo is **code only** (`frontend/cockpit`). Project context, session prompts, `NOTES.md`, design docs and metadata live in the sibling **working repo `../VTrckS-design`** — read its `CLAUDE.md` / `workflow/AGENT_ONBOARDING.md` §0 before changing anything here.

## Branch rules (enforced by GitHub — direct pushes to `main` are rejected)
- Start from fresh `main`: `git checkout main && git pull --ff-only`.
- Work on `feature/<task-slug>` (or `fix/<slug>`); one task per branch.
- Rebase on `origin/main` before the PR; push the branch; open a PR (`gh pr create --fill --base main`, or give the user the compare URL) and fill the PR template's Evidence section.
- Never push `main`, never force-push a shared branch, never merge your own PR. Session ends with the PR open and the NOTES entry pushed in `../VTrckS-design`.

## Conventions reviewers enforce
- All OData names from `webapp/model/ServiceSchema.js`; no string literals in fragments/controllers.
- OData V4 only; update groups per flow; messages via the shared MessageExtractor/popover; `sap.ui.layout.form.Form` (never `SimpleForm`); no `localStorage`; every string in `i18n.properties`; console clean; keyboard operable.
