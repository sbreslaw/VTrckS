# Claude Code Build Prompt — E008 Bridge Extension Package for C_SALESORDERMANAGE_SD

You are building the **backend extension package** specified in `E008_Service_Extension_Design.md` (read it first; it is authoritative — this prompt operationalizes it, and on any conflict the design doc wins, logged in README "Deviations"). Target: on-prem S/4HANA 2025, Standard ABAP, ADT/abapGit. Produce an **abapGit-compatible repository** of syntactically valid sources. No system connection: generated sources import via abapGit; activation and every `TODO-VERIFY(n)` resolve on-system (n = item number from the design doc's §5 verify list where applicable).

## Hard constraints — any violation is a failed build
1. **Never modify SAP objects.** Only additive extension objects (`extend view entity`, `extend service`) and Z-artifacts. Grep for `C_SalesOrderManage`/`R_SalesOrderTP` must hit only extension-object sources.
2. **No draft anywhere** in our BOs. Concurrency = ETag; managed-BO locking via framework.
3. **No `COMMIT WORK` / `ROLLBACK WORK`.** RAP owns the LUW — including inside the text adapter and event handler.
4. **Texts are API-written only.** STXH may be SELECTed (read-only list); text content read/write goes exclusively through `ZCL_VR_TEXT_ADAPTER` (classic `READ_TEXT`/`SAVE_TEXT`/`DELETE_TEXT` — mark each call site `TODO-VERIFY(4)` for the released S/4 equivalents). Direct STXL access anywhere = failure.
5. **DCL on every new readable entity** — IoH, IoH lines, Notes, DocFlow, ChangeHistory, value helps. Jurisdiction scoping via Sales Office PFCG mapping; the auth object name is a placeholder constant (`zif_vr_const=>auth_object_jurisdiction`), never invented.
6. **Never invent SAP artifact names.** Uncertain view/FM/event names → implement behind an interface/abstraction, comment `" TODO-VERIFY(n): <what to confirm>`.
7. **Query classes we write implement the full filter contract** — ranges *and* expression-tree paths, paging, sorting. Handle `cx_rap_query_filter_no_range` by processing the expression tree, never by assert (this codifies the `CL_SD_S4H_STD_PARTNER_CONTACT` lesson; cite it in the class header comment).
8. Package `ZVR_EXT` with sub-packages `_ddic`, `_cds`, `_bo`, `_srv`, `_tst`. Prefixes: tables/artifacts `ZVR_`, exposed aliases `ZZ_`, extension elements `ZZ_`.

## Repository layout
```
/src/zvr_ext/
  zvr_ext_ddic/  ZVR_IOH_H, ZVR_IOH_I (tables) · ZVR_IOH_STATUS (domain: SUBMITTED/…)
                 ZVR_D_* domains/data elements as needed · note: number range object ZVR_IOH → README on-system step
  zvr_ext_cds/   ZR_VR_IOHTP, ZR_VR_IOHLINETP (+ same-named BDEF pair in _bo)
                 ZC_VR_IOH, ZC_VR_IOHLINE (+ projection BDEF) + metadata extensions
                 ZC_VR_NOTE (custom entity) · ZI_VR_TEXTTYPEVH (8 types: 1000, ZAPP, ZBHR, ZORD, ZORJ, ZSHP, ZVRH, ZVRL — source TTXIT filtered TDOBJECT for sales header texts, TODO-VERIFY(4))
                 ZI_VR_DOCFLOW (read-only; VBFA-based, joined to follow-on doc headers; prefer a released doc-flow view if present — TODO-VERIFY; VBFA transparent fallback is acceptable)
                 ZC_VR_CHANGEHISTORY (custom entity + query class; CDHDR/CDPOS for object class VERKBELEG — CDS-readability TODO-VERIFY(5), query-class fallback is the default implementation)
                 ZI_VR_SDDOCEMPLRESP (ER partner source, mirrors the delivered contact-source pattern)
                 ZX_VR_SALESORDER_ER / ZX_VR_SALESORDERMANAGE_ER (base+projection view extensions: ZZ_EmplRespName, ZZ_EmplRespID — partner function TODO-VERIFY per terminology map)
                 ZVR_ACCESS_* (DCL per constraint 5)
  zvr_ext_bo/    ZBP_VR_IOH (managed; handlers+saver-additions) · ZBP_VR_NOTE (unmanaged)
                 ZCL_VR_TEXT_ADAPTER · ZCL_VR_IOH_PREPOP · ZCL_VR_IOH_EVENT_HANDLER (stub)
                 ZCL_VR_CHANGEHIST_QUERY (query provider per constraint 7)
                 ZIF_VR_CONST (ZKB, status values, auth-object placeholder)
                 ZIF_VR_ORDER_STATUS (+ CDS-backed default impl + test double) — reads referenced order's user status for feature control
                 ZIF_VR_CONSIGNMENT_READ (+ double) — prepop source per E007 logic ("last submitted IoH + shipments since": implement as prepop-class strategy with the consignment query behind the interface, rule documented in class header)
  zvr_ext_srv/   ZVR_EXT_SALESORDERMANAGE (service definition extension — the six exposes exactly per design §1)
  zvr_ext_tst/   EML tests + doubles + query-class unit tests
README.md        activation order · on-system checklist (number range, cache cleanup ritual, DCL/PFCG, event subscription) · TODO-VERIFY inventory with counts · Deviations log
```

## Object specifications

### IoH BO (design §3 — implement exactly)
- **Tables:** `ZVR_IOH_H` (client, IOH_ID NUMC10 key; SALESDOCUMENT VBELN-typed; PROVIDER KUNNR-typed; JURISDICTION VKBUR-typed; IOH_STATUS; CREATED_BY/AT; LOCAL_LAST_CHANGED_AT timestampl) · `ZVR_IOH_I` (client, IOH_ID, LINE_ID NUMC6 keys; NDC MATNR-typed; LOT CHARG-typed; QUANTITY QUAN + UOM; EXPIRATION_DATE; ZSOURCE CHAR1 P/M). Standard admin-field annotations for managed RAP.
- **BDEF:** managed, `strict(2)`, no draft; per the design's sketch verbatim: root create/update/delete + `submit` action (features:instance) + `setDefaults` determination + `validateLines`; line update/delete (features:instance), `Quantity` the only feature-controlled editable on prepop lines (readonly NDC/Lot/ExpirationDate); `etag master LocalLastChangedAt`; `authorization master (instance)`; late numbering NOT used — IOH_ID via number range in a determination (`early numbering` acceptable alternative; choose, justify in README).
- **Feature control = resubmission rule:** instance features consult `ZIF_VR_ORDER_STATUS` for the referenced order: editable when order status ∈ {created-this-context, Rejected}; locked otherwise; `submit` enabled only pre-Submitted. All matrix logic in one private method, unit-tested through the double.
- **Instance authorization:** jurisdiction check against the header snapshot (same PFCG mapping as DCL).
- **Prepop:** `ZCL_VR_IOH_PREPOP->build_proposal( provider )` returns line proposals (ZSOURCE='P') via `ZIF_VR_CONSIGNMENT_READ`; invoked by a static factory action `createFromProposal parameter (provider, salesdocument)` on the root — so the client's post-activation deep-create can alternatively call one action. Implement both paths (plain deep create AND factory action).
- **Event assurance:** `ZCL_VR_IOH_EVENT_HANDLER` as a stub class with one public method `ensure_ioh_for_order( salesdocument )` (idempotent: exists-check → create from proposal) + a commented subscription skeleton; the actual event wiring is on-system `TODO-VERIFY(6)`.

### Notes BO (design §4)
- `ZC_VR_NOTE` custom entity: keys SalesDocument, TextType, Language; elements Sequence (if the text object supports it — else drop, README-note), TextString (String), Editable (virtual, from feature logic). Query class lists from STXH (SELECT allowed) + content via adapter.
- Unmanaged BDEF on the custom entity: create/update/delete with feature control per order status (same `ZIF_VR_ORDER_STATUS`); save phase calls `ZCL_VR_TEXT_ADAPTER`. Private-notes semantics: author-only visibility for the designated type — implement as a query-class filter + feature control, README-note that final semantics await confirmation (design §2 "Private Notes").

### Read entities
- `ZI_VR_DOCFLOW`: SalesDocument (preceding), FollowOnDocument, DocCategory, TransactionType, CreatedOn, Status-text-ready fields; DCL via join to the order's Sales Office.
- `ZC_VR_CHANGEHISTORY` + `ZCL_VR_CHANGEHIST_QUERY`: filter contract per constraint 7; map ChangeLevel (TABNAME→friendly), Old/New value, ChangedBy/On/At.

### Service definition extension
Exactly the six exposes from design §1, aliases `ZZ_*`. README documents the cache-cleanup + `$metadata` verification ritual (it exists in the design; copy it).

## Build order
1. `ZIF_VR_CONST`, interfaces + doubles, domains/tables.
2. IoH CDS stack → BDEF pair → behavior pool → EML tests (feature-control matrix ≥8 cases incl. Rejected-editable and Submitted-locked; validation ≥1-line; jurisdiction negative test via double).
3. Prepop class + factory action + tests.
4. Notes: adapter (+double) → custom entity + query class → unmanaged BDEF → tests (create/update/delete through double; direct-STXL grep guard).
5. DocFlow + ChangeHistory (+ query-class unit tests: ranges path, expression-tree path, paging).
6. ER view extensions (mirror the contact pattern).
7. DCLs for everything; service definition extension; metadata extensions.
8. README: activation order, on-system checklist, TODO-VERIFY inventory, ten-line explanation of how the IoH edit window (create + Rejected-resubmit) is enforced server-side.

## Definition of done
- abapGit-importable; references to standard objects listed in README; zero unresolved refs among generated objects.
- Grep-verifiable: no draft artifacts; no COMMIT/ROLLBACK; no STXL writes; no direct writes to any SD table; standard-object names only inside extension sources; every new entity has a DCL.
- All unit tests green against doubles; query classes tested on both filter paths.
- TODO-VERIFY items numbered against design §5 and counted in README.
- Deviations log: any judgment call this prompt or the design left open, one line + rationale. Work the build order to completion — no stopping at scaffolding.
