# CLAUDE.md — CSR Auditing Application · ABAP Backend (VS Code + ADT tooling)

You are developing the **classic ABAP backend** of the CSR Auditing Application
(package `ZCSR`) from VS Code, connected to the DEV system through ADT services.
The reference sources live in `abap/` (one file per repository object). Design
authority: `CSR_Technical_Specification.docx` v0.3 and
`CSR_ABAP_Development_Specification.docx` v0.1. Where this file conflicts with
your general knowledge, **this file wins**.

## Prime directive: never fabricate — verify first

Before writing any call against an API you are not 100% certain of — ABAP
classes, function modules, Gateway framework methods, DDIC types — **verify
against live sources first**: the connected system itself (navigate to the
class/FM via the remote filesystem and read its signature) or SAP Help. The
connected DEV system is the ultimate truth for what exists on this release.
If you cannot verify, say so explicitly and propose a verified alternative.
The same applies to tooling: on first setup, confirm extension configuration
keys against the extension's own README rather than assuming.

Never invent: OData/DDIC properties, FM parameters, generated method names,
SAP notes, or customizing values. State uncertainty; never paper over it.

## 1. Platform & syntax ceiling — never violate

| Aspect | Constraint |
|---|---|
| System | SAP ECC8 on **NW 7.50** — classic ABAP OO |
| Syntax | ABAP **7.50 maximum**. Allowed: inline `DATA(...)`, `VALUE`/`COND`/`CONV`/`REDUCE`, string templates, `@` host variables/expressions in Open SQL, `boolc( )` |
| Forbidden | ABAP Cloud syntax, RAP/BDEF, released-API-only mode, `FINAL(...)` inline declarations, CDS behavior/`@`annotations beyond plain DDL, any statement newer than 7.50 — when unsure, check the ABAP keyword docs version selector for 7.50 |
| Gateway | OData **V2** via SEGW project `ZCSR_CHECKLIST`; only `..._DPC_EXT` / `..._MPC_EXT` are hand-edited — **never modify generated base classes** |
| Namespace | Everything `ZCSR_*` / `ZCX_CSR` / `ZIF_CSR_*` / `ZCL_CSR_*`, package `ZCSR` |

## 2. Toolchain (VS Code)

Required extensions:
- **`murbani.vscode-abap-remote-fs`** (ABAP remote filesystem) — edit, syntax-check,
  activate, and run ABAP Unit directly against DEV via ADT. Requires ICF node
  `/sap/bc/adt` active on DEV.
- **`abaplint.vscode-abaplint`** — offline static analysis of the `abap/` files.
- **`larshp.vscode-abap`** — syntax highlighting for local `.abap` files.

Connection: workspace `settings.json` carries an `abapfs.remote` entry for DEV
(url, client, language; credentials prompted — **never commit passwords**).
Verify the exact key names in the extension README on first connect.

Working model — two surfaces, one truth:
1. **Online (authoritative)**: the mounted `adt://DEV/` filesystem. All
   activation, syntax checks, and ABAP Unit runs happen here.
2. **Offline (repo)**: `abap/*.abap` reference files, kept in sync with the
   system via abapGit (`ZCSR` package linked to this repo). After changing an
   object online, pull it back into `abap/`; after editing offline, push and
   activate. Repo and system must not drift — if they have, the system wins,
   then reconcile the repo.

What cannot be built from VS Code on 7.50 — do these in SAPGUI and record the
fact in the commit message: DDIC tables/domains/data elements (SE11), lock
object `EZCSR_HEADER` (SE11), message class `ZCSR` (SE91), SCDO object `ZCSR`,
SEGW modeling (`SEGW`), SM59 destination `ZCSR_LLM`, TVARVC `ZCSR_FLP_URL`,
PFCG roles. Claude prepares exact field-by-field instructions for these; a
human executes them.

## 3. Object inventory & activation order

DDIC first (Tech Spec §2–3), then in this order (each activates cleanly before
the next):

1. `ZCX_CSR` — exception class; requires message class `ZCSR` (texts in `abap/README.md` §3)
2. `ZIF_CSR_ATTACH_STORE` → `ZCL_CSR_ATTACH_DB` → `ZCL_CSR_ATTACH_AL`
3. `ZCL_CSR_VALIDATION`
4. `ZCL_CSR_MODEL`
5. `ZCL_CSR_CATALOG`
6. `ZCL_CSR_AI_CLIENT`
7. `ZCL_CSR_NOTIFY`
8. SEGW generation, then `ZCL_ZCSR_CHECKLIST_DPC_EXT`
9. `ZCSR_REMINDER_JOB`, `ZCSR_AI_TRIAGE_JOB`

## 4. Hard behavioral rules the code must keep enforcing

These are structural guarantees — any change that weakens one is wrong even if
it "works":

- Status changes exist **only** inside `ZCL_CSR_MODEL->check_transition` /
  `set_status`. No `UPDATE zcsr_header SET status` anywhere else, DPC included.
  Matrix: NS→IP; IP→IP/SB; SB→UR; UR→CP/RT; RT→IP/SB; CP terminal.
- Electronic signature = `sy-uname` + server `GET TIME STAMP` at submit.
  Client-supplied identity or time is never accepted.
- Validation returns the **full** failure list; the DPC pushes all of it into
  the message container and raises `/IWBEP/CX_MGW_BUSI_EXCEPTION` once —
  one submit answers with every problem. (Note: `MGW`, not `MPC` — the MPC
  variant does not exist.)
- Attachments: XSTRING written directly to `ZCSR_ATTACH-CONTENT` (never
  `EXPORT ... TO DATA BUFFER`); SHA-256 server-side on save; soft delete only;
  `GET_STREAM` returns original MIME type + `Content-Disposition` filename —
  byte-identical round trip is a hard requirement with a test.
- AI is advisory **by construction**: `ZCL_CSR_AI_CLIENT->triage_checklist`
  keeps its single all-encompassing `TRY ... CATCH cx_root`; every failure
  path returns zero flags and never raises. Do not "improve" error handling
  by letting anything propagate.
- Catalog: `QUESTION_ID` assigned server-side; `INPTYPE` derived from Section
  (P→I, I→C) ignoring client input; writes only where version is Draft AND
  unbound; released versions have **no update path**; deletes are physical
  and Draft-only.
- Every write path: `AUTHORITY-CHECK Z_CSR_CHK` (ACTVT 70 for catalog),
  enqueue `EZCSR_HEADER` where an instance is touched, change document via
  `ZCL_CSR_MODEL->write_change_document`.
- All user-facing texts through message class `ZCSR` — no literals.

## 5. Deliberate open ends — do NOT silently "fix"

- `ZCL_CSR_MODEL->write_change_document` is a documented no-op until SCDO
  object `ZCSR` is generated; the generated FM `ZCSR_WRITE_DOCUMENT` has
  per-table X/Y parameters known only after generation. When wiring it, read
  the generated FM signature from the system first.
- `ZCL_CSR_ATTACH_AL` raises on use by design (ArchiveLink feasibility
  pending; OAC0/OAC2/OAC3 customizing does not exist yet).
- SEGW truncates generated method names (e.g. `CHECKLISTHEADE_GET_ENTITYSET`).
  After generation, read the actual names from the generated base class and
  align the `_EXT` redefinitions — never guess them.
- `checklistheade_get_entityset` still needs `$top`/`$skip` from
  `io_tech_request_context`; `ExportEvidence` gains change-doc history after
  SCDO and a PDF instead of `responses.txt` in production.

## 6. Static analysis — abaplint

`abaplint.json` at repo root; keep the target at 7.50 and fix findings rather
than suppressing them. Starter config:

```json
{
  "global": { "files": "/abap/**/*.abap" },
  "syntax": { "version": "v750", "errorNamespace": "^(Z|Y)" },
  "rules": {
    "7bit_ascii": true,
    "avoid_use": { "define": false },
    "check_syntax": true,
    "cloud_types": false,
    "obsolete_statement": true,
    "unknown_types": true,
    "unused_variables": true,
    "line_length": { "length": 100 }
  }
}
```

Note: the reference DPC uses a small `DEFINE` macro for parameter reads —
either keep `avoid_use.define` off or refactor to a private method when
touching that file. `unknown_types` will flag DDIC types until abaplint has
the table definitions; add `.abap` serializations of the DDIC objects via
abapGit to make offline lint fully green, or scope the rule to non-DDIC types.

## 7. Testing — ABAP Unit (run from VS Code against DEV)

Local test classes (`FOR TESTING RISK LEVEL HARMLESS DURATION SHORT`) per
object; run with the remote-fs ABAP Unit command after every activation.
Priority targets:

1. `ZCL_CSR_MODEL` — transition matrix: every allowed pair passes, every
   forbidden pair raises 002; CP is terminal.
2. `ZCL_CSR_VALIDATION` — matrix of RESP_REQUIRED × NA_ALLOWED × NA_FLAG ×
   response, and ATTACH_MODE R with 0 vs ≥1 non-deleted attachments; assert
   the failure list is COMPLETE, not first-error.
3. `ZCL_CSR_CATALOG` — ID generation (next free `<CHKTYPE>-Pnn`/`-Nnn`, gap
   tolerance), INPTYPE derivation, editability guard (Draft+unbound vs
   Released vs bound), release guards (015/011/012).
4. `ZCL_CSR_ATTACH_DB` — SHA-256 correctness against a known vector;
   byte-identical save→read round trip; soft-delete visibility in `list`.
5. `ZCL_CSR_AI_CLIENT` — malformed envelope / non-200 / broken inner JSON all
   yield zero flags and no exception (inject via a local test double for the
   HTTP layer; keep the double in the test include).

Isolate the database where practical (test doubles for reads; on 7.50, plain
dependency injection via local interfaces — `CL_OSQL_TEST_ENVIRONMENT` is
**not** available on this release, do not use it).

## 8. Workflow — every session

1. **Plan** multi-object tasks: list objects to touch and why; confirm
   anything architectural before editing.
2. Edit → **syntax check** (ADT) → **activate** → **abaplint** clean →
   **ABAP Unit** green. In that order, every object, every time.
3. All changes on a workbench transport of the `ZCSR` project; one logical
   change per task; note the transport number in the summary.
4. Sync `abap/` with the system state (abapGit) before ending the session.
5. Definition of done: activated in DEV, lint clean, unit tests green,
   reference file in `abap/` updated, open ends still marked as open ends.
6. If requirements are ambiguous or conflict with the Tech Spec or the
   metadata contract, ask — do not guess.
