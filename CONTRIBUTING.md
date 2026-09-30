# Contributing to VTrckS (frontend/cockpit)

> New here? Read **`DEVELOPER_PLAYBOOK.md`** first — it walks the whole branch/PR loop step by step,
> including what to do when a push is rejected or a rebase conflicts. This file is the short reference.

`main` is protected: **nobody commits to it directly.** All work lands through a pull request
reviewed by the code owner.

## Daily flow
```bash
git checkout main && git pull                 # always start from fresh main
git checkout -b feature/<short-task-slug>     # e.g. feature/prices-tables, fix/select-race
# ... work, commit in small logical steps ...
git push -u origin feature/<short-task-slug>
# open a PR on GitHub (the PR template fills in) and request review
```
- Rebase (or merge main) into your branch before requesting review so the PR is up to date.
- Address review comments with new commits (don't force-push over a reviewed branch unless asked).
- After merge, delete the branch and start the next one from fresh `main`.

## Conventions (the code owner provides the full program guidelines document on request)
- All OData names live in `webapp/model/ServiceSchema.js` — never string literals in fragments/controllers.
- OData V4 APIs only; deferred update groups per flow; messages via the shared MessageExtractor/popover.
- Every user-visible string in `i18n.properties`; keyboard operability is part of "done".
- Console must be clean (no errors/warnings) before you open a PR.

## Design docs, task specs, project notes
Maintained by the code owner outside this repo; the relevant excerpts come with each task or in the
PR. If a PR implements a task spec you were given, reference it in the PR description.
