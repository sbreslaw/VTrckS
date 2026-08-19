# PROMPT_TEMPLATE — Agent Work Orders (v1.0)

**What this is:** the standard skeleton for AI-agent task prompts, distilled from the E008 build (Claude Code backend packages, Copilot UI work orders). Copy it, fill it, delete what a given task doesn't need — but delete consciously: each section exists because its absence produced a real failure mode.

**Project-independent.** Lives in the generic docs layer; project specifics enter through the Authority section's references, never by editing this file's structure.

---

## The one dial: decision density

Same skeleton, two settings — choose by agent:

| | **Autonomous agent** (Claude Code, long-session CLI agents) | **Collaborative agent** (Copilot, inline assistants) |
|---|---|---|
| Prompt shape | Narrative spec: constraints, object specs, build order, DoD — agent decides module boundaries and sequencing details | File-by-file work order: files to CREATE / files to MODIFY, function signatures, control-by-control layouts |
| Trust level | Makes structural decisions inside declared constraints | Implements inside pre-made shapes only |
| Session style | One prompt, full execution loop, evidence at the end | Work the file sequence stepwise; keep target files open in the editor (context weighting); human drives verification |
| Verification | Agent self-verifies per DoD, documents proof | DoD proof is human+agent activity — assume the agent won't close its own loop |

If unsure: more decisions pre-made is the safe direction. An over-specified prompt wastes some agent capability; an under-specified one wastes a session.

---

## Skeleton (five mandatory sections)

### 1. AUTHORITY
- Name the documents to read first, in order.
- Name the single authoritative spec and the conflict rule: *"On any conflict, X wins; log the conflict in NOTES."*
- Name superseded artifacts explicitly (*"v2 supersedes v1; delete/ignore v1"*) — agents blend contradictory versions silently if both are readable.
- State the scope guard: what this task must NOT touch.

*Failure mode prevented: averaging across stale docs; helpful out-of-scope "improvements."*

### 2. STEP-0 RECONCILE
- Checklist of assumptions about current state, each verifiable: repo facts (controls, markers, constants), environment facts (`$metadata` contents, service availability).
- Instruction: verify before any edit; where an assumption is false, adapt and **record the delta in NOTES** — deltas are findings, not blockers.
- Include known-lesson tripwires (*"if the old placeholder constant is still present, fix it now — known defect class"*).

*Failure mode prevented: building on drift; repeating documented mistakes. Doubles as remote-review substitute when the human/architect can't inspect the repo.*

### 3. THE WORK (density per the dial)
- Settled decisions stated as settled: *"implement, don't re-decide."*
- **Named seams for pending decisions:** adjustable constants (`MIN_ITEMS = 1`), status-stamped contract files (`UNCONFIRMED — pending sign-off`), `TODO-VERIFY(n)` tags numbered against a verify list, interface + test-double for every external dependency not yet real.
- Never let the agent invent facts it can't verify: uncertain names/APIs go behind abstractions with verify tags. State this rule in the prompt; agents fabricate helpfully by default.
- Degradation patterns for missing dependencies (disabled+tooltip, designed empty-state, mock-resolve-removed-before-DoD) so absent backends never block or get faked.
- Build order when sequence matters; per-file specs at high density.

*Failure mode prevented: buried assumptions; fabricated artifact names; blocked-or-faked dependencies.*

### 4. DEFINITION OF DONE
- Functional positives (happy path, error path — both proven live where a system exists).
- **Adversarial negatives, grep-verifiable:** *"grep X returns hits only in Y"*, "no <banned pattern> anywhere." Agents pass positive checklists and violate prohibitions silently; make prohibitions mechanically checkable.
- Cross-cutting constants: i18n complete, console clean, keyboard/a11y pass, isolation checks — restate per task; agents don't inherit obligations from other prompts.
- "Work to completion — no stopping at scaffolding" (autonomous agents) / explicit human-verification handoff points (collaborative agents).

*Failure mode prevented: scaffolding declared done; silent guardrail violations.*

### 5. EVIDENCE OBLIGATIONS
- Which living docs the agent updates (NOTES, audit file, open-questions) and **what specifically must be written**: step-0 deltas, shapes discovered in metadata, behavior assertions ("record whether status read-back = 1A; report as config gap, don't compensate"), decision/deviation log with one-line rationales.
- Strategic evidence capture where the task informs a pending decision (*"neutral-tone paragraph on the actual cost/experience of X, for the architecture gate review"*).
- Handoff rule: anything not captured in the repo dies with the session — sessions are disposable, docs are the only carrier.

*Failure mode prevented: tribal knowledge in volatile context; decision reviews argued from recollection instead of records.*

---

## Session hygiene (applies around the prompt, not in it)
- **Session per phase/task**; fresh agent + repo docs beats a long-context veteran defending its own past work — especially for auditing defects it may have written.
- Before killing a session: *"flush any decisions/gotchas not captured in repo docs into NOTES."* An answer of "nothing beyond the docs" is the docs' health check.
- One prompt version in the repo at a time; superseded prompts are removed, not accumulated.
- Kickoff message names the docs, the prompt file, and the supersession rule — three lines, always the same shape.
