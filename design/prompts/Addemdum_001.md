# ADDENDUM-001 — Exposure Vehicle Correction (applies across the TS pack)

**Date:** 08/2026 · **Trigger:** on-system verification — `C_SALESORDERMANAGE_SD` service definition carries **no extensible flag**; `extend service` on it is rejected. The service-definition-extension plan (`ZVR_EXT_SALESORDERMANAGE`) is **void**. This addendum supersedes the "Exposure" statements in: TS-E008-B2.1/B2.2/B2.3/B2.4a–d, TS-E008-B2.4-CFG (unaffected content-wise, referenced for completeness), TS-E008-IOH-OPT1/OPT4, and §1/M-table of `E008_Service_Extension_Design.md`. All other content of those documents stands.

## Corrected exposure
1. **New companion service `ZUI_VR_EXT`** (custom service definition + OData V4 UI binding, package `ZVR_EXT`): exposes **all custom entities** — `ZZ_IoH`, `ZZ_IoHLine`, `ZZ_Note`, `ZZ_DocFlow`, `ZZ_ChangeHistory`, `ZZ_TextTypeVH`, and the value helps `ZZ_ContactVH`, `ZZ_ProviderVH` (if custom-built per its gate), `ZZ_NdcVH`, `ZZ_PriorityVH`, `ZZ_OrderReasonVH`, `ZZ_CategoryVH` (gated), `ZZ_IntentionVH`. Aliases unchanged from the specs. Standard service untouched.
2. **OrderCreate action re-routed (B0.1 updated):** preferred vehicle is now a **behavior-definition extension action** on the standard BO — the BDEF is verified `extensible`, and extension actions surface automatically in the existing standard service (no service-definition change needed). Verify the instance-less/static variant activates on our release; **fallback:** unbound action exposed in `ZUI_VR_EXT`. TS-E008-B1 §Interface otherwise unchanged.
3. **ZZ *view* (field) extensions unaffected** — `ZZ_Description`, contact/ER fields ride the entity through the standard service as specified (TS-E008-B3 stands; note the separate open check on association-bearing view extensions from the IoH activation failure).

## Rationale (recorded so this isn't relitigated)
Companion service chosen over a custom definition exposing `C_SalesOrderManage` alongside our entities: the latter would consume an unreleased SAP projection in a custom definition (new unreleased-usage surface), move the app off the standard binding that SAP support incidents reference (contact-crash OSS incident hygiene), and blur the service-swap evaluation narrative. The two-model cost on the frontend is accepted: `$batch` is per-service, but every consumer of `ZUI_VR_EXT` (IoH section, Notes, VH dialogs, history reads) is a lazy, separate round trip by design — no existing flow batched across the boundary. Consolidation fallback (single custom definition exposing both) remains documented in NOTES if the two-model overhead ever measurably bites.

## Frontend consequences (one work-order note, next session)
- `manifest.json`: second dataSource + named model (suggested name `vrExt`), same V4 settings.
- `ServiceSchema.js`: new `extService` section (URL, entity sets, VH names) — isolation grep now covers both sections.
- Fragments/dialogs consuming custom entities bind the named model; standard-service bindings unchanged.
- NOTES: record the two-model decision + the addendum reference.

## Ledger entry
Wall #4 on the bridge: advertised extension *mechanism* vs. per-object extensible flag — same genus as the view-extensibility annotations (IoH association), the query-provider filter contract (contact crash), and the write-mapping gap (KTEXT). None fatal; each cost a detour and a companion object. The MVP-2 gate's framing question absorbs this instance unchanged: *where do CDC's controls and integrations live, and who guarantees they run.*
