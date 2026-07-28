# Claude Code Build Prompt — E008 Vaccine Request RAP BO (complete OData package)

You are building the backend package for **E008 — Custom Vaccine Ordering Application** on on-premise SAP S/4HANA: a **custom RAP business object (unmanaged, NO draft)** with behavior implementation, CDS model, service definitions, and **two OData V4 bindings** (UI + Web API). Produce an **abapGit-compatible repository** of syntactically valid ABAP/CDS/BDL sources. You have no SAP system connection: generate sources for import via abapGit; activation and the items marked `TODO-VERIFY` happen on-system.

## Hard constraints — violating any of these is a failed build

1. **Unmanaged** RAP implementation. The BO owns its transactional buffer. **Persistence goes exclusively through `ZCL_VR_SD_ADAPTER`** (the single gateway to the standard sales order API). Any `INSERT/UPDATE/MODIFY/DELETE` on `VBAK/VBAP/VBKD/VBPA` or other SD tables anywhere in the codebase = failure.
2. **No draft.** No `with draft`, no draft tables, no draft actions, no `prepare`. Concurrency = ETag (`LastChangedAt` on root) + SD enqueue in `FOR LOCK`.
3. **Late numbering** on root and item (`VaccineRequestID`/VBELN and `ItemNumber`/POSNR assigned by the standard API in `adjust_numbers`).
4. **No `COMMIT WORK`/`ROLLBACK WORK`** anywhere — the RAP framework owns the LUW. The adapter calls the create/change API without its own commit.
5. **Never invent SAP API names, view names, or config keys.** Where the exact released artifact depends on the target release, implement against an internal abstraction and mark the call site with `" TODO-VERIFY(B1):` plus a one-line description. Known-classic candidates you may reference in comments (still marked TODO-VERIFY): `BAPI_SALESORDER_CREATEFROMDAT2`, `BAPI_SALESORDER_CHANGE`, `STATUS_CHANGE_EXTERN`, lock object `EVVBAKE`. Do not fabricate alternatives.
6. **Business rules are delegated, not implemented.** E006 rule content and E007 IoH persistence are external: implement `ZIF_VR_E006_RULES` and `ZIF_VR_E007_IOH` as interfaces plus **test doubles**; never hardcode a business policy that belongs to E006.
7. ABAP language version: **Standard ABAP** (on-prem classic tier), clean-code style (final classes, `##NO_TODO` not used, meaningful names), all objects in package `ZVR_ORDER` with sub-packages `_CDS`, `_BO`, `_SRV`, `_CFG`, `_TST`.

## Repository layout (abapGit default folder logic)

```
/src/zvr_order/
  zvr_order_cds/   ZR_VACCINEREQUESTTP, ZR_VACCINEREQUESTITEMTP, ZR_VACCINEREQUESTIOHTP,  (root view + same-named BDEF pair)
                   ZI_VACCREQPARTNER, ZI_VACCREQPRICING, ZI_VACCREQHISTORY,
                   ZC_VACCINEREQUEST, ZC_VACCINEREQUESTITEM, ZC_VACCINEREQUESTIOH,
                   ZC_* metadata extensions, ZI_VH_* value helps, ZVR_ACCESS_VACCREQ (DCL)
  zvr_order_bo/    ZR_VACCINEREQUESTTP (BDEF base, same name as root), ZC_VACCINEREQUEST (BDEF projection),
                   ZBP_VACCINEREQUESTTP (+ local handler/saver classes),
                   ZCL_VR_BUFFER, ZCL_VR_SD_ADAPTER, ZCL_VR_CONFIG_RESOLVER,
                   ZIF_VR_E006_RULES, ZIF_VR_E007_IOH,
                   abstract entities ZVR_A_REJECTIONREASON, ZVR_A_UNCANCELPARAMS
  zvr_order_cfg/   ZVR_ORDTYPE_CFG, ZVR_SECT_CFG, ZVR_FIELD_CFG, ZVR_ACT_CFG (tables + TMG note)
  zvr_order_srv/   ZUI_VACCINEREQUEST, ZAPI_VACCINEREQUEST (service definitions),
                   ZUI_VACCINEREQUEST_O4, ZAPI_VACCINEREQUEST_O4 (binding descriptors as docs)
  zvr_order_tst/   EML unit tests, doubles (ZCL_VR_E006_DOUBLE, ZCL_VR_E007_DOUBLE),
                   contract-test skeleton
README.md          activation order, TODO-VERIFY list, on-system steps
```

## Functional shape (authoritative summary — follow exactly)

**Entities.** Root `ZR_VaccineRequestTP` over `I_SalesDocument` (filter: order types from `ZVR_ORDTYPE_CFG`), key `VaccineRequestID` (VBELN), fields incl. `OrderType`, `ProviderID` (SoldToParty), `Jurisdiction` (SalesOffice), `UserStatus` (1A–1G via status association — TODO-VERIFY exact released status view), `LastChangedAt` (ETag). Compositions: `_Item` (`ZR_VaccineRequestItemTP` over `I_SalesDocumentItem`: `Product`/NDC, `Quantity`, `FundType`, `OrderIntention`, `Brand`, `ProductDescription`, `NetValue`, `DeliveryStatus`) and `_IoH` (`ZR_VaccineRequestIoHTP`: buffer-only lines `NDC`, `Lot`, `QuantityOnHand`, `ExpirationDate` — no own persistence; handed to E007 at save). Read-only associations: `_Partner`, `_Pricing` (PRCD_ELEMENTS-based — TODO-VERIFY released view), `_History`.

**BDEF base (`ZR_VACCINEREQUESTTP` — same-named pair with the root view entity)** — implement exactly:
- `unmanaged implementation in class zbp_vaccinerequesttp unique; strict ( 2 );`
- Root: `late numbering`, `lock master`, `authorization master ( instance, global )`, `etag master LastChangedAt`; `create;` `update ( features : instance );` **no delete**.
- Field control: `readonly` VaccineRequestID, NetValue, TaxAmount, GrossValue, ProviderAddress, Channel, CreatedByUser, LastChangedAt; `readonly : update` OrderType, ProviderID; `features : instance` UserStatus, RejectionReason, Category, Priority, OrderReason, ShippingCondition; `mandatory` OrderType, ProviderID.
- Actions: `cancelOrder` (param `ZVR_A_RejectionReason`, features+auth instance), `unCancelItem` (param `ZVR_A_UnCancelParams`, features+auth instance, guard entire implementation behind constant `zif_vr_scope=>uncancel_active` for the OI-2 decision), `resubmit` (features), `print`; factory actions `copyOrder 1`, `createReturn 1` (auth), `createReplacement 1` (auth).
- Determinations: `determineDefaults on modify {create}` (Category default, UserStatus 1A, USD, EmployeeResponsible from sy-uname, values 0.00); `determineChannel on save {create}` (Channel "UI" vs "API" from binding context — resolve via the service binding info, TODO-VERIFY exact API); `deriveItemAggregates on modify {field _Item.Quantity}`.
- Validations: `validateHeader`, `validateE006Rules`, `validateIoH` `on save`; item: `validateItem`; item determination `deriveFromProduct on modify {field Product}`.
- Item: `lock/authorization/etag dependent by _VaccineRequest`, `late numbering`, `update (features:instance)`, **no delete** (line removal = `cancelItem` action with reason param), `mandatory:create` Product, Quantity.
- IoH: dependent, `update; delete;` (pre-save lines only), `features:instance` QuantityOnHand.
- `mapping for VBAK`/`VBAP` blocks with the obvious field mappings; mark uncertain ones TODO-VERIFY rather than guessing.

**Projection BDEF (`ZC_VACCINEREQUEST`)**: `use` everything above; **side effects**: `ProviderID` affects `ProviderAddress`, `_Partner`, `ContactID`; `Priority` affects `OrderReason`; item `Product` affects `Brand`, `ProductDescription`, `OrderIntention`; item `Quantity` affects `FundType`, `NetValue`; action `resubmit` affects `UserStatus`, `$self.messages`.

**Handlers/saver (behavior pool locals):**
- `lhc_VaccineRequest`: create/update into `ZCL_VR_BUFFER`; `FOR READ` serves buffer-first then CDS; `FOR LOCK` enqueues SD lock for persisted keys (TODO-VERIFY FM); `get_instance_features` + `get_instance_authorizations` = thin adapters over `ZCL_VR_CONFIG_RESOLVER->resolve( order_type, user_status, role_context, item_attrs )` (precedence: config universe → status matrix → role matrix; most restrictive wins); `get_global_authorizations` gates create. Actions write **intents** into the buffer (cancel reasons, bypass flags, resubmit flag); `copyOrder` reads source via EML, strips ID/values/status, re-derives FundType and ancillary rules via the E006 facade, returns new `%cid` instance.
- `lsc_VaccineRequest` saver: `finalize` (channel, aggregates, assemble E006 payload) → `check_before_save` (run E006 double/real: HARD → `failed` + messages, nothing persists; SOFT → mark buffer to persist with UserStatus `1C`) → `adjust_numbers` (create path: adapter CREATE, map `%pid`→VBELN/POSNR) → `save` (update path: adapter CHANGE with **field-delta + update flags**, never full images; status transitions via status API; IoH lines → `ZIF_VR_E007_IOH->create_submitted`; cancel/uncancel intents applied) → `cleanup`.
- `ZCL_VR_SD_ADAPTER`: the only class referencing SD APIs; public methods `create_order`, `change_order`, `set_user_status`, `read_order`; maps BAPIRET2→RAP messages with `%element` targeting; unit-testable via injected function-module wrapper interface.

**Security:** DCL `ZVR_ACCESS_VACCREQ` filtering `Jurisdiction` by PFCG auth field for Awardee roles, full access for CDC role — applied to root, item, IoH, read-only assocs, and every `ZI_VH_*`. Plus instance auth per above. Document the PFCG object as a TODO for the security workstream; reference it by placeholder constant, don't invent its name.

**Config tables (`_CFG`)**: `ZVR_ORDTYPE_CFG` (order type registry incl. flags return/replacement), `ZVR_SECT_CFG` (sections per order type, sort, default-expanded), `ZVR_FIELD_CFG` (field behavior per order type/status), `ZVR_ACT_CFG` (action availability per order type/status/role). Keys and a short data dictionary in README; resolver reads them with a buffered access class.

**Service definitions**: `ZUI_VACCINEREQUEST` exposes the three ZC entities + read-only assocs + all `ZI_VH_*`; `ZAPI_VACCINEREQUEST` exposes only the three ZC entities. Binding descriptors (bindings are created on-system): document both as OData V4, note communication scenario/arrangement for the API binding and $batch requirement for UI.

## Build order (do it in this sequence, compiling mentally as you go)

1. Interfaces + abstract entities + config tables + resolver (with unit tests — the resolver matrix is the heart).
2. CDS interface views → projections → metadata extensions → value helps → DCL.
3. BDEF base + projection.
4. Buffer class (with tests: preliminary keys, delta computation, intent store).
5. Adapter (wrapper interface + double; TODO-VERIFY markers at every SD call site).
6. Behavior pool: handlers, then saver.
7. EML unit tests: create→save happy path (late numbering mapping), hard-stop rejection, soft-stop persists 1C, every action happy+negative (esp. Awardee attempting CDC-only actions), ETag conflict, feature-control matrix spot checks (min. 12 combinations across order type × status × role).
8. Service definitions + README (activation order, full TODO-VERIFY list, on-system checklist: bindings, comm arrangement, PFCG, TMG generation).

## Definition of done

- Repo imports via abapGit with no unresolved references **among generated objects** (references to standard SAP objects are expected and listed in README).
- Zero draft artifacts; zero direct SD table writes; zero COMMIT WORK; grep-verifiable.
- Every uncertain SAP artifact name carries `TODO-VERIFY(B1)` — count them in README.
- All unit tests green against the doubles; contract-test skeleton present for UI-vs-API parity.
- README explains, in ten lines, how a new order type is added **without code** (config entries only) — if you can't write that honestly, the resolver design is wrong; fix it.

Work through the build order completely; don't stop after scaffolding. Ask nothing you can decide from this prompt; log genuine ambiguities as README "Decisions taken" with one-line rationale.
