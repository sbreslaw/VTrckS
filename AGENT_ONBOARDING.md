# Agent Onboarding — E008 Vaccine Ordering (CDC VTrckS on S/4HANA)

**Purpose:** Bring any AI agent up to speed on the E008 project, its architecture, and how to work here.
**Environment:** SAP S/4HANA 2025 **on-premise** (no BTP runtime dependency), ADT/Eclipse + abapGit for backend, VS Code/BAS for frontend.
**Last Updated:** 2026-07-31 — living doc; update it as part of any change that affects it.

---

## 1. Working Relationship & Core Rules

**You are a Senior SAP Engineer (UI5/Fiori or RAP/ABAP depending on assignment).** The human lead is an equal technical partner and the solution architect of record.

1. **Understand Before Acting** — read the referenced spec/code before answering. Never speculate about code you haven't opened. If a file is referenced, READ IT FIRST.
2. **Check In Before Major Changes** — propose the approach and wait for approval on significant modifications.
3. **Communicate Clearly** — concise explanation of what changed and why, every step.
4. **Simplicity Above All** — smallest change that solves the problem. When in doubt, simpler.
5. **Maintain Documentation** — update the affected living docs with every change. No new ad-hoc .md files.
6. **Push Back** — if an idea is technically problematic, say so with reasons.
7. **Never invent SAP artifact names, config keys, or API signatures.** If unsure whether an object exists on the target release, mark it `TODO-VERIFY` and say so. This rule has teeth on this project.

---

## 2. Project Context (read once, internalize)

E008 replaces a CRM_UI (WebDynpro) vaccine ordering application for the CDC. Users: **Awardee** (external customers, jurisdiction-scoped) and **CDC** (internal, full scope). Orders are real SD sales orders. The architecture in one paragraph:

> Custom **unmanaged RAP BO** (`ZR_VaccineRequestTP` + items + IoH, **no draft**, late numbering) sourced from released `I_SalesDocument*` views, persisting **exclusively through the standard sales order API** via one adapter class. One behavior layer enforces validations (delegated to E006), status-driven field control, jurisdiction authorization (DCL + instance auth), and all actions — identically for the **OData V4 UI binding** (freestyle cockpit + FE List Report) and the **V4 Web API binding**. UI: FlexibleColumnLayout shell; detail screen = stacked expandable `sap.m.Panel` sections (CRM assignment-block idiom), section set driven per order type by the config resolver.

### Authoritative documents (never contradict these; propose revisions instead)
| Document | Governs |
|---|---|
| `E008_Solution_Functional_Specification.docx` (Rev 1.1) | Scope, AD-1…AD-8 decisions, UI design, FRs |
| `E008_TechSpec_RAP_BO.docx` | Backend contract: CDS, BDEF, handlers, services |
| `E008_ClaudeCode_Build_Prompt.md` | Backend repo generation rules & DoD |
| `E008_ROM_Estimate_Phased.xlsx` | Phasing: Phase 0 / MVP-1 / MVP-2 / v1.1 |
| Ratified status dictionary (OI-1 output) | 1A–1G semantics — field control derives from it |

### Delivery phases (know which one you're in)
- **MVP-1 (read path):** CDS read model + DCL + FE List Report + display cockpit shell.
- **MVP-2 (transactional core):** create/edit + IoH + save (hard/soft stop) + cancel matrix + resubmit.
- **v1.1:** copy, return/replacement, un-cancel (pending OI-2), Web API, cascading value helps, config tables.

---

## 3. Hard Guardrails (violations = rejected work)

1. **No external hosting of anything.** No Vercel/CDN-hosted UI5 libraries, no externally hosted mock services, no third-party runtime dependencies. This is a federal (CDC) system: SAPUI5 is served **by the S/4 system / FLP**; all services run on the dev landscape. The `ui5.blckrbbt.host` pattern from other workspaces is explicitly banned here.
2. **No mock-data architecture.** Development and prototyping run against the **real MVP-1 read service** (`ZUI_VACCINEREQUEST_O4`) on the dev system. A hardcoded local stub is permitted only as a ≤1-week bridge while the read service activates — it must never grow branching logic (`_isJSONModel()`-style dual paths are banned).
3. **No draft.** No draft artifacts in any BDEF; unsaved-state protection is client-side; concurrency = ETag (412 handling mandatory in the UI).
4. **Persistence only via `ZCL_VR_SD_ADAPTER`.** Any direct write to VBAK/VBAP/VBKD/VBPA or other SD tables, anywhere, is a failed build. No `COMMIT WORK` outside the RAP framework.
5. **No business rules in the client.** Field enablement, action availability, and section visibility come from service metadata (resolver → feature control). If you find yourself hardcoding a status check in a controller, stop — it belongs in the resolver.
6. **Never reference `R_SalesOrderTP` / `C_SalesOrderManage*` / `C_SALESORDERMANAGE_SRV`** in any layer. Reuse happens only at released `I_*` views. **Sanctioned temporary exception:** the Phase 1 `frontend/cockpit` prototype is deliberately re-pointed at the standard `C_SALESORDERMANAGE_SRV`/`C_SALESORDERMANAGE_SD` V4 service per `design/E008 prototype repoint prompt.md`, as an interim bridge until `ZUI_VACCINEREQUEST_O4` is available — see `NOTES.md` for details. This exception is scoped to that prototype only; it does not relax the rule anywhere else.
7. **Real CDC data never leaves the landscape.** Test data on dev is representative/synthetic.
8. **Section 508 is an acceptance criterion**, not a polish item: keyboard-complete, announced expand/collapse, labeled fields, message announcements.

---

## 4. Workspace Layout

```
e008/
├── backend/                    # abapGit repo (see E008_ClaudeCode_Build_Prompt.md for full tree)
│   └── src/zvr_order/          # _cds, _bo, _srv, _cfg, _tst sub-packages
├── frontend/
│   ├── cockpit/webapp/         # Freestyle SAPUI5 app (OData V4)
│   │   ├── Component.js
│   │   ├── manifest.json       # dataSource -> /sap/opu/odata4/sap/zui_vaccinerequest_o4/...
│   │   ├── view/               # App (FCL), Cockpit, section fragments
│   │   ├── controller/
│   │   ├── sections/           # Panel section fragments + SectionFactory.js
│   │   ├── model/formatter.js
│   │   └── i18n/
│   └── listreport/             # FE V4 List Report (annotation-driven; minimal code)
├── docs/                       # the authoritative documents (§2) + this file + playbook
└── AGENT_ONBOARDING.md         # THIS FILE
```

Backend agents: work in `backend/` per the Claude Code build prompt; activation happens on-system via abapGit pull + ADT — flag anything needing on-system action in your summary.
Frontend agents: work in `frontend/`; the app runs against the dev-system service (see playbook §1 for proxy setup).

### Current Implementation Status (2026-07-31)

**Phase 1 (initial prototyping) is COMPLETE.** `frontend/cockpit` is a working, live-backend-connected read-only prototype: FCL shell, master/detail routing, filterable master list, detail header + expandable panel sections, all wired to the temporary standard `C_SALESORDERMANAGE_SRV`/`C_SALESORDERMANAGE_SD` V4 service through the centralized `ServiceSchema.js` module. It runs clean (no console errors) against the real dev-system service. See `NOTES.md` for the full list of bugs found/fixed while stabilizing it (URL segment swap, whole-entity binding anti-pattern, `FilterBar` property name, App busy-overlay, `SectionFactory` duplicate-content race).

- Verified dev landscape host for current frontend work: `https://sapapp2dh1.cdc.gov:44300` with client `100`.
- Local prototype runtime currently depends on a checked-in metadata snapshot at `frontend/cockpit/webapp/localService/metadata.xml`, copied from `design/so.xml`, so the mock/server tooling can start before the custom E008 read service is available.
- `frontend/cockpit` local sandbox only works with a mixed library setup: `/resources` proxied from the SAP host and `/test-resources` served locally by UI5 tooling. Proxying `/test-resources` to the host breaks `sap/ushell/bootstrap/sandbox.js` on this landscape.
- `ui5-deploy.yaml` was generated for ABAP deploy (`ZCDC_VTRCKS`, package `ZCM`), but the current landscape is SNC-only for the human developer. `fiori deploy` reaches an HTTP username/password prompt and does not reuse the SAP GUI SNC session.
- For this landscape, the expected deployment path is `npm run build` followed by ABAP-side upload with an SNC-enabled SAP tool such as `/UI5/UI5_REPOSITORY_LOAD`, then FLP catalog/target mapping maintenance on-system.
- `backend/` RAP package and `frontend/listreport/` FE app are not yet implemented in this repository.

**Phase 2 (in progress, starting now): Search and Content section UI adjustments.** Customer requirements call for reshaping the Master-view Search (filter bar) and Detail-view Content (panel sections) to match actual customer needs — this has not been scoped in code yet. Before implementing: re-read whatever customer requirement doc(s) get shared, and confirm which `ServiceSchema` fields/entity sets are already available vs. need a backend ask (Onboarding §5 — don't work around a missing field client-side, file a backend request instead).

---

## 5. Roles per Agent Assignment

**Frontend agent:** cockpit views/controllers/sections, List Report annotations, formatter, i18n, OPA5/QUnit. Consumes the V4 service as-is; if the service lacks something, you file a backend request in your summary — you do not work around it client-side.
**Backend agent:** everything under `backend/` per the tech spec + build prompt. You do not change the service contract (entity names, action signatures) without an approved spec revision.
**Either:** update docs you affect; keep the console/ATC clean; ask when the spec is ambiguous, decide-and-log when it's merely silent on a detail.

---

## 6. Testing Checklist (before finishing any task)

- [ ] App loads with zero console errors against the **real dev service**
- [ ] Works for both roles (CDC full-scope, Awardee jurisdiction-scoped) — empty result ≠ bug: check DCL first
- [ ] ETag conflict (412) path behaves: reload dialog, no data loss surprise
- [ ] Messages anchor to fields/panels; collapsed-panel errors auto-expand
- [ ] Keyboard-only pass on anything you touched (508)
- [ ] i18n keys, no hardcoded strings
- [ ] Backend: EML tests green, ATC clean incl. the no-VB*-writes check
- [ ] "Did I update every doc this change affects?"

---

*Companion: `E008_UI5_V4_PLAYBOOK.md` for frontend patterns. The LMI workspace docs (Vercel hosting, dual-mode, V2 patterns, UI5 1.71) do NOT apply here.*
