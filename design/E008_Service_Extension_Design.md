# E008 Service Extension Design — C_SALESORDERMANAGE_SD (Bridge Architecture)

**Status:** DRAFT for backend-team review · 08/2026 · Companion: CR-002 (below), `Fiori-Awardee_Orders__Analysis__003_.xlsx` (authoritative field mapping)
**Scope:** Extend the standard Manage Sales Orders V4 service to carry all 13 cockpit sections. Order type **ZKB** (Vaccine Request); Replacement order type TBD-VERIFY. All `TODO-VERIFY` items resolve in ADT/live system, never from memory.

---

## CR-002 — IoH Final Disposition (supersedes CR-001)

CR-001 (read-only IoH) is **void** per its step 3: functional team confirms IoH is editable. New disposition:
- IoH is a **separate activity document** (custom persistence, `ZCDC_IOH`-family), created **along with** the ZKB request at save — with explicit acceptance that creation may be **event-triggered/decoupled**; no modification of the standard save is required.
- IoH lines are **modifiable on a Rejected request during resubmission**.
- Consequence for the architecture ledger: the strict same-LUW composition requirement is retired **by business decision** (eventual consistency accepted). IoH becomes a custom side-BO feasible beside the standard service. Remaining MVP-2 gate items unchanged: draft protocol in the client, action semantics envelope (behavior-extension spike), field-control injection, jurisdiction DCL, split enforcement.
- Cascade: solution spec FR-07 restored to editable with the *decoupled* creation model; ROM lines for IoH editing return (~+10–14 PD vs. CR-001 state, net −2 to −4 vs. original because no save-sequence integration); agent onboarding IoH note re-patched.

---

## 1. Mechanism Overview — one of five per section

| # | Mechanism | Used for |
|---|---|---|
| M1 | **Standard entities as delivered** (already exposed) | Details core, Items core, Shipping, Org Data, Price Totals, Parties Involved, Alternative Shipping (read) |
| M2 | **ZZ view extensions** (base `R_SalesOrderTP` + projection `C_SalesOrderManage`) | Flattened header fields: Contact name (done), ER name/PERNR; verify-and-map item fields (MVGR1/2, ZZ opt-out) |
| M3 | **Custom read-only CDS entities** via `extend service` | Shipping Transactions & Transaction History (VBFA), Change History (CDHDR/CDPOS) |
| M4 | **Custom transactional RAP BO** via `extend service` | **Inventory on Hand** (managed, own tables), Notes (unmanaged over text API) |
| M5 | **Reuse component, no service change** | Attachments (GOS/DMS attachment reuse UI on the sales document) |

Service definition extension (one object, additive):
```abap
extend service C_SALESORDERMANAGE_SD {
  expose ZC_VR_IoH            as ZZ_IoH;
  expose ZC_VR_IoHLine        as ZZ_IoHLine;
  expose ZC_VR_Note           as ZZ_Note;
  expose ZC_VR_DocFlow        as ZZ_DocFlow;        " Shipping Trans + Trans History
  expose ZC_VR_ChangeHistory  as ZZ_ChangeHistory;
  expose ZI_VR_TextTypeVH     as ZZ_TextTypeVH;     " 8 note types value help
}
```
Same activation ritual as prior extensions: activate → `/IWFND/CACHE_CLEANUP` + V4 cache cleanup → fresh `$metadata` check.

## 2. Section-by-Section Design

| Section (Type / Action) | Mechanism | Design notes |
|---|---|---|
| **Details** (Form/Edit) | M1 + M2 | Core VBAK/VBKD fields standard. `KTEXT` description, `AUGRU` order reason, ExIS `BSTKD` — verify presence in C_SalesOrderManage; extend via M2 if absent. User Status: **selectable set = the 5 values in the mapping** (In Process / On Hold / Approved / Approved by Grantee / Cancelled) — feeds OI-1 dictionary; surfacing = ZZ flattened fields from status framework (M2), edit via status logic TBD at gate. Category: legacy CRM concept — map or park (TODO-VERIFY target field). Priority `LPRIO/VSBED`. |
| **Item** (List/CDE) | M1 + M2 | Rich column set is mostly standard (VBAP/VBEP/LIPS/VBRP/PRCD). S/4 corrections apply to the legacy refs in the sheet: VBUP statuses → VBAP-level status fields; KONV → PRCD_ELEMENTS (CL-06). `ZZOPT_OUT` legacy field → CFL `ZZ1_*` on VBAP (exists per current metadata — reconcile naming). MVGR1 (intention) / MVGR2 (fund type): standard fields — verify exposure, M2 if hidden. Fulfillment columns (confirmed/delivered/GI/billed qty) via item associations — verify which the standard item entity carries; M3 supplementary read view if gaps. |
| **Inventory on Hand** (List/CDE) | **M4 — custom BO** | Full design §3. Source of truth `ZCDC_IOH` tables (ours). |
| **Shipping** (Form/Edit) | M1 | VBPA/VBAK/LIFSK per mapping; delivery status per S/4 correction. |
| **Alternative Shipping Address** (Form/Edit) | M1 read / **gate item** write | Read: SH partner → address (standard assoc). **Edit = document-address change on SAP's BO** — whether the standard behavior permits manual address maintenance through the service is a TODO-VERIFY; if not, this joins the gate list (it is order-write territory, not extendable from outside). |
| **Shipping Transactions** (List/RO) + **Transaction History** (List/RO) | M3 | One read-only CDS view `ZI_VR_DocFlow` over document flow (VBFA + follow-on doc headers), parameterized/filtered by preceding SalesDocument; two UI sections filter it by document category. Plain transparent tables → plain SQL, no query class, no ST22 exposure. DCL: restrict via the referenced order's jurisdiction (join to VBAK-VKBUR). |
| **Organizational Data** (Form/Edit) | M1 | VKORG/VTWEG/SPART/VKBUR/VKGRP standard. Service Org fields: free-text placeholders (unchanged decision). |
| **Notes** (List/CDE) | **M4 — unmanaged custom BO** | §4. Eight text types confirmed with legacy IDs (1000, ZAPP, ZBHR, ZORD, ZORJ, ZSHP, ZVRH, ZVRL) — text-ID config must exist in S/4 text determination for VBBK object (TODO-VERIFY migration of text types). |
| **Parties Involved** (List/CDE) | M1 read | Standard partner entity + BP/address associations for the contact-card fields (ADR2/ADR6 comms via BP views). Marked No/No for both order types in the mapping — build read-only, defer C/D/E (partner editing on SAP's BO = gate item). Territory fields: no S/4 source — park. |
| **Attachments** (List/CDE) | **M5** | GOS/DMS attachment reuse component on the sales document (FR-13 pattern): no service extension, frontend embeds the component post-save. Field list in the mapping matches GOS attributes. Virus-scan/MIME policy per security workstream. |
| **Price Totals** (Form/Edit) | M1 read | Header pricing element entity of the standard service (PRCD_ELEMENTS-based) — verify exposure + condition-type filter for the totals view. "Edit" of conditions through the standard BO = gate item; render read-only now. |
| **Change History** (List/RO) | M3 | `ZC_VR_ChangeHistory` — custom **read** entity over change documents for object class VERKBELEG keyed by VBELN. CDHDR/CDPOS access from CDS: TODO-VERIFY on release (CDPOS storage); fallback = custom entity with a **query implementation class we own** — acceptable here because *we* implement the full filter contract (expression tree, not ranges-only; the CL_SD_S4H lesson codified). |
| **Private Notes** (List/CDE) | M4 (Notes BO) | Additional text type or user-scoped note kind on the same Notes BO; visibility rule (author-only) via DCL/feature control. Requirements thin — confirm semantics before build. |

## 3. Inventory on Hand — Custom RAP BO (the centerpiece)

**Pattern:** managed RAP BO, own persistence, **draft-free**, exposed through the service extension. This is a fully-owned BO — feature control, validations, DCL, actions are ours; none of the standard-BO extension limits apply.

**Data model (align legacy `ZCDC_IOH` naming with basis team):**
```
ZVR_IOH_H  (header): IOH_ID (key, number range), SALESDOCUMENT (ZKB ref), PROVIDER (KUNNR),
                     JURISDICTION (VKBUR snapshot), IOH_STATUS (Submitted/...), CREATED_BY/_AT, LOCAL_LAST_CHANGED_AT
ZVR_IOH_I  (lines):  IOH_ID, LINE_ID (key), NDC (MATNR), LOT (CHARG), QUANTITY, UOM, EXPIRATION_DATE, ZSOURCE (prepop|manual)
```
CDS: `ZR_VR_IoHTP` root + `ZR_VR_IoHLineTP` composition → `ZC_VR_IoH/Line` projections → exposed. **DCL on both** via JURISDICTION — note this becomes the first jurisdiction-scoped entity in the bridge service; pattern documented for reuse.

**BDEF sketch (managed, strict(2), no draft):**
```abap
managed implementation in class zbp_vr_ioh unique;
define behavior for ZR_VR_IoHTP alias IoH
persistent table zvr_ioh_h lock master authorization master (instance)
etag master LocalLastChangedAt
{ create; update; delete;   " delete: pre-submission housekeeping only — feature-controlled
  field (readonly) IoHID, SalesDocument, Provider, Jurisdiction, IoHStatus;
  action (features:instance) submit result [1] $self;      " sets Submitted
  determination setDefaults on modify {create;}
  validation validateLines on save {create; update;}       " ≥1 line entered/modified rule lives HERE
  association _Line {create (features:instance);} }
define behavior for ZR_VR_IoHLineTP alias IoHLine
persistent table zvr_ioh_i lock dependent by _IoH etc.
{ update (features:instance); delete (features:instance);
  field (readonly) NDC, Lot, ExpirationDate;               " prepop lines locked except Quantity
  field (features:instance) Quantity; }
```
**Feature control = the resubmission rule:** instance features read the **referenced order's user status** (via association to the order view): editable while order unsaved-context/created-this-session or status = Rejected; locked otherwise. Fully ours to implement — no standard-BO fight.

**Creation flow (per the "event OK" disposition) — belt and suspenders:**
1. **Primary (client-orchestrated):** cockpit collects IoH lines during order creation → after order activation returns VBELN → `POST ZZ_IoH` deep-create (header + lines, prepop + user edits) → `submit` action. Same `$batch` as the post-activation refresh where possible.
2. **Assurance (event-driven):** subscribe to the sales order created event for type ZKB (RAP business event / SD event — TODO-VERIFY the delivered event and on-prem eventing wiring; fallback: output/workflow trigger or a short-cycle job). Handler ensures an IoH document exists for every ZKB order — creates one from consignment pre-population if the client step failed. Closes the decoupled-consistency gap the business accepted; the named risk ("inventory out of sync") gets a compensating control instead of an LUW.
3. **Pre-population:** consignment read (E007 logic / the bridge consignment view) seeds lines with `ZSOURCE='prepop'`; "last submitted IoH + shipments since" rule implemented in the prepop query per the mapping's note.

**Frontend:** IoH fragment gains edit mode against `ZZ_IoH` — quantity cells, row insert/delete, the ≥1-line message surfaced from the BO validation; `sectionFlags.inventory` now driven by the BO's feature control. Edit List button becomes real.

## 4. Notes — Unmanaged Custom BO over the Text API

SD texts (STXH/STXL) are not table-writable; the BO wraps READ_TEXT/SAVE_TEXT-family APIs (TODO-VERIFY released S/4 text API) in an **unmanaged** implementation: entity `ZC_VR_Note` (SalesDocument, TextType [8-value VH], Language, Sequence?, TextString), C/D/E via handlers, save via the text API in the RAP save. Feature control ties editability to order status per section rules. This is deliberately the same unmanaged pattern as the target custom service — the implementation transfers.

## 5. Verify List (consolidated)
1. Replacement order type code (mapping covers ZKB only).
2. Standard entity coverage: KTEXT/AUGRU/BSTKD on header; MVGR1/MVGR2, VBEP/LIPS/VBRP-derived columns on item; pricing element entity exposure.
3. Document-address edit capability through the standard BO (Alternative Shipping write).
4. Text types ZAPP…ZVRL configured in S/4 text determination; released text API name.
5. CDHDR/CDPOS readability from CDS on target release; else query-class fallback.
6. Sales order created event availability + eventing infrastructure on-prem (for IoH assurance path).
7. ADT extension grant list for M2 item fields; `ZZOPT_OUT` vs. `ZZ1_*` naming reconciliation.
8. Number range object for IOH_ID.

## 6. Resolver Config Seed (do not lose this)
Columns L/M of the mapping (field applicability per Vaccine Request vs. Replacement order) are the **AD-8 per-order-type field configuration content**, authored by the functional team. Action: transcribe into the config-table load format (or the interim hardcoded resolver) verbatim, and treat the spreadsheet as the signed source — when the resolver goes table-driven, this is its initial data load. Also harvested: the 5 selectable user-status values (OI-1 input) and order type ZKB (replace the ZVR1 placeholder in `ServiceSchema.fixedOrderTypes` — the hidden-filter lesson says do this everywhere, immediately).
