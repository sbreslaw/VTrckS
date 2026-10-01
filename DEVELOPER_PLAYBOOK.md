# VTrckS Developer Playbook — Branches, Pull Requests, and the Daily Loop

Welcome to the VTrckS cockpit codebase. This document explains how code gets from your editor into
`main`. It's short on purpose: the whole workflow is one loop you'll repeat for every task, and after
the second time it's muscle memory. Read it once end to end; keep the "Daily loop" section handy.

---

## 1. The one rule, and why

**Nothing is committed directly to `main`.** Every change — yours, mine, the AI-assisted sessions —
goes on its own branch and arrives in `main` through a pull request (PR) that the code owner reviews.

This isn't about trust; it's standard practice on any shared codebase:
- `main` is always in a known-good, deployable state. If something breaks, we know it didn't come from `main`.
- Every change has a reviewer and a written trail (the PR) — invaluable six months from now when someone asks "why does this gate expression exist?"
- Two people editing the same files can't silently overwrite each other; conflicts surface in the PR, where they're visible and fixable.

`main` is **protected by GitHub itself**: a direct push is rejected by the server, force-pushes and
deletions are blocked, and merging requires an approved review. You can't break this rule by accident —
if you try to push to `main`, you'll get an error (see §6) and simply switch to a branch.

---

## 2. One-time setup

```bash
git clone https://github.com/sbreslaw/VTrckS.git
cd VTrckS
git config user.name  "Your Name"
git config user.email "you@example.com"
```
Copy the two agent-instruction templates to their live names (they are personal and git-ignored, so you can adjust them freely):
```bash
cp CLAUDE.example.md CLAUDE.md
cp .github/copilot-instructions.example.md .github/copilot-instructions.md
```
Open the folder in VS Code. The app lives under `frontend/cockpit/`. Read `CONTRIBUTING.md` (2 minutes)
and skim `frontend/cockpit/webapp/model/ServiceSchema.js` — every OData name in the app lives there,
which matters for §8.

---

## 3. The daily loop (this is the whole workflow)

```bash
# 1 — Start from fresh main. ALWAYS. Never start a branch from an old branch.
git checkout main
git pull

# 2 — Create your branch. One branch per task.
git checkout -b feature/short-task-name        # e.g. feature/prices-tables
                                               #      fix/select-race
                                               #      docs/update-readme

# 3 — Work. Commit small, logical steps with clear messages (see §5).
git add -A
git commit -m "Items: apply editing gate to fund type select"

# 4 — Before you open the PR, bring main's latest changes into your branch.
git pull --rebase origin main                  # if this reports conflicts, see §7

# 5 — Push your branch and open the PR.
git push -u origin feature/short-task-name
# Then on GitHub: the yellow "Compare & pull request" banner → fill in the template → Create.

# 6 — Respond to review (§4). When approved and merged:
git checkout main
git pull
git branch -d feature/short-task-name          # tidy up; start the next task from step 1
```

That's it. Six steps, every task. Steps 1 and 4 are the ones people skip and regret — starting from
stale `main` or opening a PR that's behind `main` is where most merge headaches come from.

---

## 4. Pull requests and review

**Opening the PR.** The description template loads automatically. Fill it honestly:
- *What / why* — one paragraph. What changed and the reason. Link a task/prompt if there is one.
- *Evidence* — what you actually tested on the dev system, and the three boxes: console clean,
  keyboard works, i18n complete. If you didn't test something, say so — "not tested on a saved order"
  is far more useful than a checkbox ticked from hope.
- *Checklist* — the code conventions (§8). Tick what's true.

**Review.** The code owner is auto-requested (that's what `.github/CODEOWNERS` does). Expect comments;
they're the normal texture of a shared codebase, not a grade. Address each one either by changing the
code (push a new commit to the same branch — the PR updates automatically) or by replying with why
you think the current version is right. Mark conversations resolved once they're settled. The PR
can't merge with open conversations — by design.

**What not to do on a branch under review:** don't `--force` push over it. Reviewers lose the ability
to see what changed since their last look. Add commits instead; we squash on merge if the history is noisy.

**Merging.** The code owner merges after approval. You don't need to do anything at that point except
the cleanup in §3 step 6.

---

## 5. Naming and messages

**Branches:** `type/short-slug`, lowercase, hyphens.
- `feature/…` new functionality · `fix/…` defects · `docs/…` documentation · `chore/…` housekeeping
- Good: `feature/item-detail-edit-mode`, `fix/opt-out-refresh-race`. Avoid: `mybranch`, `test`, `new`.

**Commit messages:** `<Area>: <what changed>` — area is the part of the app, then a plain statement.
- `Items: add /items/editing gate to ExIS, intention and fund selects`
- `ServiceSchema: add pricingElements block (HeaderPricingElement/ItemPricingElement)`
- `Detail: fix priority propagation when items are mixed`
- Why over how: the diff shows *how*; the message should tell the next reader *why*.

---

## 6. "I pushed to main and it was rejected"

You'll see something like:
```
! [remote rejected] main -> main (protected branch hook declined)
error: GH006: Protected branch update failed
```
Nothing is broken and nothing was lost. Your commits are safe on your local `main`. Move them to a branch:
```bash
git checkout -b feature/my-task     # creates a branch containing your local commits
git push -u origin feature/my-task  # push it
git checkout main
git reset --hard origin/main        # put your local main back in sync with the real one
```
Then open the PR from `feature/my-task` as usual. This is the single most common first-week moment;
it happens to everyone once.

---

## 7. Conflicts (they're normal)

If `git pull --rebase origin main` (step 4) stops with conflicts, git tells you which files. For each:
1. Open the file; look for `<<<<<<<`, `=======`, `>>>>>>>` markers.
2. Keep what's correct — usually *both* sides in some combination, rarely just one. **Never resolve
   by deleting the other person's change** because it's in the way; if you're not sure what it does,
   ask before resolving.
3. Remove the markers, save, `git add <file>`, then `git rebase --continue`.
4. If it's gone wrong and you want to start the rebase over: `git rebase --abort` returns you to
   exactly where you were. Nothing is lost.

Two files conflict more than others in this app: `webapp/model/ServiceSchema.js` and
`webapp/sections/Items.fragment.xml`. If a conflict lands in either of those, it's worth a quick
message to the code owner before resolving — they're the most interconnected files in the codebase.

If a rebase feels risky, `git merge origin/main` instead of `--rebase` is perfectly acceptable — it's
slightly messier history but easier to reason about. Either is fine; up-to-date is what matters.

---

## 8. Code conventions that reviewers will check

The full set is in the program guidelines; these are the ones that come up in nearly every review:
- **No OData names as string literals** in fragments or controllers — entity sets, properties,
  actions, navigation paths all come from `model/ServiceSchema.js`. If a name isn't there, add it there.
- **No business codes in views** (fund types, statuses, etc.) — they come from data or the designated provider modules.
- **OData V4 APIs only.** Deferred update groups belong to their own flow; don't reuse a group across flows.
- **`sap.ui.layout.form.Form` with FormContainers — not `SimpleForm`.** No `localStorage`.
- **Every visible string in `i18n.properties`.** Keyboard operability is part of "done."
- **Console clean** — no errors or warnings — before you open a PR.
- **Backend messages surface through the shared MessagePopover** — never a `MessageToast` for a failure.

---

## 9. Where things live

| What | Where |
|---|---|
| The app | this repo, `frontend/cockpit/` |
| Design decisions, specs, task descriptions, project notes | maintained by the code owner; the relevant excerpts come with each task or PR |
| Program-wide UI5 guidelines | provided by the code owner as a document (ask for the current copy) |
| Questions | the code owner — earlier is always better than later; a 2-minute question beats a rewritten PR |

---

## 10. Quick reference card

```
start   : git checkout main && git pull && git checkout -b feature/<slug>
work    : small commits, "<Area>: <what changed>"
sync    : git pull --rebase origin main           (or git merge origin/main)
ship    : git push -u origin feature/<slug>  →  open PR, fill template
review  : address comments with new commits; resolve conversations; no force-push
after   : git checkout main && git pull && git branch -d feature/<slug>
oops    : pushed to main? → §6.   conflicts? → §7.   unsure? → ask.
```
