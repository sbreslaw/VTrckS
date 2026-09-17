sap.ui.define([], function () {
  "use strict";

  var ServiceSchema = {
    serviceRoot: "/sap/opu/odata4/sap/c_salesordermanage_srv/srvd/sap/c_salesordermanage_sd/0001/",

    // Swap-back block: previous custom service constants retained for quick rollback.
    // customServiceRoot: "/sap/opu/odata4/sap/zui_vaccinerequest_o4/srvd/sap/zui_vaccinerequest/0001/",
    // customHeaderEntitySet: "VaccineRequest",

    entitySets: {
      header: "SalesOrderManage",
      item: "SalesOrderItem",
      status: "OverallSDProcessStatus",
      salesOrderType: "SalesOrderType",
      deliveryBlockReason: "DeliveryBlockReason",
      deliveryPriority: "DeliveryPriority",
      // CRUD Task 2 (Change Mode): SDDocumentReason has a real fixed-values VH
      // (ValueListReferences -> c_slsdocallowedorderreasonvh) confirmed in
      // design/so.xml/localService/metadata.xml, no Immutable/Computed annotation.
      orderReason: "SDDocumentReason",
      // Real per-order Ship-To snapshot (HeaderShipToPartyType, keyed by
      // SalesOrder) - used ONLY via the _ShipToParty navigation to display an
      // EXISTING order's ship-to address (Master.controller.js,
      // Details.fragment.xml). Do NOT use as a customer picker source: it is
      // keyed by SalesOrder, not Partner, so querying it top-level returns one
      // row per past order (a customer with N orders returns N rows) - this
      // was the cause of the Provider picker's duplicate-row bug; the picker
      // now uses customerSalesArea below instead.
      shipToParty: "HeaderShipToParty",
      // CRUD Task 1 v5 (design/E008_CRUD1_v5_Sticky_Amendment.md, "UX phasing +
      // triad sourcing"): Provider Value Help queried against this top-level
      // entity set - keyed by Customer + SalesOrganization + DistributionChannel
      // + Division (design/so.xml ~line 1131), the same KNVV-shaped row this
      // service's own SoldToParty ValueListReferences point at
      // (c_soldtoslsorgdistrchnldivvh). No longer filtered down to one fixed
      // triplet - a customer extended to multiple sales areas returns multiple
      // rows, one per area (soft pre-filtered to salesArea.salesOrganization
      // only, to keep the result set reasonable); the row the user picks
      // supplies the REAL SalesOrganization/DistributionChannel/Division for
      // that Save, not just Customer (see Detail.controller.js#
      // onProviderValueHelpRequest / CreateOrderService.js#save).
      customerSalesArea: "CustomerSalesArea",
      // CRUD Task 1 v4: Contact Value Help queried directly against this
      // top-level entity set (one row per sales document's standard-contact
      // snapshot, keyed by SalesDocument - see StandardPartnerContactInfoType
      // in metadata.xml), not via the per-order _SoldToPartyContactInfo
      // navigation. Also used to best-effort prefill the Contact field from the
      // selected Provider's most recent order (no dedicated "main contact"
      // master-data entity is exposed by this service).
      contactInfo: "StandardPartnerContactInfo",
      // CRUD Task 1 v5: NDC Code Value Help queried directly against this
      // top-level entity set (ProductType, part of this same service - see
      // so.xml) rather than the dedicated c_slsordprodbyslsorgdistrchnl F4
      // service referenced by the Product property's ValueListReferences.
      product: "Product",
      // Session Prompt (Detail View Adjustments) 3.2: real top-level fixed-
      // values VH entity set (CustomerPurchaseOrderTypeType, design/so.xml
      // ~line 718 - CustomerPurchaseOrderType/CustomerPurchaseOrderType_Text),
      // same shape as ShippingCondition/SalesOffice etc. below.
      customerPurchaseOrderType: "CustomerPurchaseOrderType",
      // 3.9: real top-level fixed-values VH entity set (PartnerFunctionType,
      // so.xml ~line 1250 - PartnerFunction/PartnerFunction_Text/
      // SDDocumentPartnerType).
      partnerFunction: "PartnerFunction",
      // 3.9: HeaderPartnerType (so.xml ~line 1065), reached in this app only
      // via the header's _Partner navigation (never queried top-level) -
      // listed here for completeness/grep-isolation, not used as a bind path.
      headerPartner: "HeaderPartner"
    },

    navigation: {
      headerToItems: "_Item",
      headerToPartner: "_Partner",
      headerToShipToParty: "_ShipToParty",
      headerToContactInfo: "_SoldToPartyContactInfo",
      headerToCreatedByUser: "_CreatedByUser",
      headerToOrderReason: "_SDDocumentReason",
      headerToPaymentMethod: "_PaymentMethodVH",
      itemToRejectionReason: "_SalesDocumentRjcnReason",
      itemToDeliveryStatus: "_DeliveryStatus",
      // _DeliveryPriority only exists on SalesOrderItemType in design/so.xml (line
      // ~201) — there is NO header-level DeliveryPriority property or navigation on
      // SalesOrderManageType. "Priority" as a header/master-list field is
      // BLOCKED-BY-SERVICE; do not add a headerToDeliveryPriority entry here.
      itemToDeliveryPriority: "_DeliveryPriority"
    },

    keys: {
      orderId: "SalesOrder"
      // NOTE: no "IsActiveEntity" key here — confirmed absent from SalesOrderManageType
      // in design/so.xml (Key block contains only PropertyRef "SalesOrder"). This service
      // is NOT draft-enabled. See NOTES.md "P1 Draft-Key Check" and PHASE2_AUDIT.md.
    },

    headerProperties: {
      providerId: "SoldToParty",
      providerName: "CustomerName",
      status: "OverallSDProcessStatus",
      userStatus: "UserStatusDerived",
      createdOn: "CreationDate",
      createdBy: "CreatedByUser",
      // Client requirement (2026-09-01): real custom header fields (SDH -
      // Sales Document Header - append), replacing the standard TotalNetAmount.
      netValue: "ZZ_NET_VALUE_SDH",
      // No header-level Tax field exists on SalesOrderManageType in design/so.xml
      // (TaxAmount only exists on SalesOrderItemType) - still BLOCKED-BY-SERVICE.
      taxAmount: null,
      // Client requirement (2026-09-01): real custom header field (SDH append).
      grossAmount: "ZZ_GROSS_VALUE_SDH",
      currency: "TransactionCurrency",
      paymentMethod: "PaymentMethod",
      salesOrderType: "SalesOrderType",
      salesOrganization: "SalesOrganization",
      distributionChannel: "DistributionChannel",
      division: "OrganizationDivision",
      salesOffice: "SalesOffice",
      salesGroup: "SalesGroup",
      shippingCondition: "ShippingCondition",
      deliveryStatus: "OverallDeliveryStatus",
      deliveryBlockStatus: "OverallDeliveryBlockStatus",
      deliveryBlockReason: "DeliveryBlockReason",
      billingBlockReason: "HeaderBillingBlockReason",
      billingBlockStatus: "OverallBillingBlockStatus",
      billingStatus: "OverallOrdReltdBillgStatus",
      paymentTerms: "CustomerPaymentTerms",
      // Session Prompt (Detail View Adjustments) 3.1: still no real header-level
      // Priority property/nav on SalesOrderManageType (confirmed again in so.xml
      // Step-0 reread) - Priority stays a VIRTUAL header field, computed from/
      // propagated to item DeliveryPriority (itemProperties.deliveryPriority
      // below), never a header property to bind/PATCH/select here. Left null so
      // any accidental future header-property reference fails loudly instead of
      // silently binding a nonexistent path.
      priority: null,
      orderReason: "SDDocumentReason",
      // No header-level "Partner" property exists either — Ship-To-Party ID/name
      // are only reachable via the _ShipToParty navigation (HeaderShipToPartyType).
      customerReference: "PurchaseOrderByCustomer",
      exisId: "PurchaseOrderByCustomer",
      // Client requirement (2026-09-01): real custom header field (SDH append),
      // open for entry on Create (Details.fragment.xml) - see
      // updatableHeaderProperties below for the create-replay persistence note.
      description: "ZZ_KTEXT_SDH",
      // Session Prompt (Detail View Adjustments) 3.2: rebound from the old
      // SalesOrderType display-only alias to the REAL, independently writable
      // CustomerPurchaseOrderType property (so.xml ~line 389, MaxLength 4, its
      // own CustomerPurchaseOrderType VH entity set - entitySets.
      // customerPurchaseOrderType above) - superseades the retired ZZ_BSARK_SDH/
      // enum-based Category field entirely. See updatableHeaderProperties below.
      category: "CustomerPurchaseOrderType",
      // Session Prompt (Detail View Adjustments) 3.3: still no header-level Tax
      // field on SalesOrderManageType (TaxAmount only exists on
      // SalesOrderItemType, see itemProperties.taxAmount below) -
      // BLOCKED-BY-SERVICE as a real header property; the Details fragment's
      // Tax Amount field is a CLIENT-SIDE sum of item TaxAmount instead (never
      // sent/read here) - see Detail.controller.js#_computeHeaderTaxAmount.
      taxAmount: null
    },

    // Fields reached via the header's single-cardinality _SoldToPartyContactInfo
    // navigation (StandardPartnerContactInfoType) — confirmed present in so.xml
    // metadata. NOTE: expanding/filtering this navigation across MULTIPLE header
    // rows (list context, e.g. the Master table or its Contact filter) is
    // RUNTIME-BLOCKED-BY-SERVICE — it causes a backend 500 ASSERTION_FAILED dump
    // (confirmed live 2026-08-03, see NOTES.md). Single-entity reads (Detail page
    // bindElement, one sales order) are a different backend code path and were
    // confirmed live (2026-08-06) to work fine, including "responsibleEmployee" —
    // safe to bind on the Detail page. Do NOT bind any of these fields on the
    // Master list/filter bar without re-verifying against the live backend first.
    contactProperties: {
      fullName: "FullName",
      email: "EmailAddress",
      phone: "InternationalPhoneNumber",
      mobilePhone: "InternationalMobilePhoneNumber",
      address: "FormattedPostalAddressDesc",
      soldToParty: "SoldToParty",
      payerParty: "PayerParty",
      billToParty: "BillToParty",
      responsibleEmployee: "ResponsibleEmployee",
      salesEmployee: "SalesEmployee"
    },

    // _ShipToParty navigates to HeaderShipToPartyType (id + display name), NOT a
    // direct "Partner" property on SalesOrderManageType itself.
    shipToPartyProperties: {
      id: "Partner",
      fullName: "FullName",
      address: "FormattedPostalAddressDesc"
    },

    // CustomerSalesAreaType (design/so.xml ~line 1131) - the Provider picker's
    // source. No single formatted-address field exists here (unlike
    // HeaderShipToPartyType), so the picker composes one from city/postal/country.
    customerSalesAreaProperties: {
      customer: "Customer",
      customerName: "CustomerName",
      cityName: "CityName",
      postalCode: "PostalCode",
      countryText: "Country_Text",
      salesOrganization: "SalesOrganization",
      distributionChannel: "DistributionChannel",
      division: "Division"
    },

    // _PaymentMethodVH navigates to PaymentMethodType (BillingCompanyCode +
    // PaymentMethod key, plus description/name text) — the header PaymentMethod
    // property is a single SD payment-method *code*, not a stored card/instrument;
    // there is no card/CVV/PAN entity anywhere in this service (see PaymentMethod
    // fragment + OPEN_QUESTIONS.md).
    paymentMethodProperties: {
      text: "PaymentMethodName"
    },

    // _CreatedByUser / _LastChangedByUser navigate to UserType (UserID, UserDescription).
    createdByUserProperties: {
      name: "UserDescription"
    },

    // ProductType (this same service's own top-level Product EntitySet) - used
    // for the NDC Code Value Help; ProductType has no base-UOM property, so
    // RequestedQuantityUnit cannot be derived from the selected Product here
    // (BLOCKED-BY-SERVICE, see itemsColumns>/uom usage in Items.fragment.xml).
    productProperties: {
      id: "Product",
      text: "Product_Text",
      // Client requirement (2026-09-01): I_ProductStdVH extended by
      // ZI_PRODUCTSTDVH_EXT to add this field - carried over to the item's
      // own ZZIndustryStandardName (brand) on NDC selection, see
      // onItemNdcValueHelpRequest in Detail.controller.js.
      industryStandardName: "IndustryStandardName",
      // Session Prompt (Detail View Adjustments) 3.7: real property on
      // ProductType (so.xml ~line 1615, MaxLength 3) - carried over to the
      // item's RequestedQuantityUnit on NDC selection (read-only from here on),
      // same pattern as industryStandardName/brand above.
      baseUnit: "BaseUnit"
    },

    itemProperties: {
      material: "Product",
      itemText: "SalesOrderItemText",
      itemNumber: "SalesOrderItem",
      optOutAncillary: "ZZ1_OptOutAncillary_SDI",
      quantity: "RequestedQuantity",
      unit: "RequestedQuantityUnit",
      itemCategory: "SalesOrderItemCategory",
      netAmount: "NetAmount",
      currency: "TransactionCurrency",
      exisId: "PurchaseOrderByCustomer",
      deliveryStatus: "DeliveryStatus",
      deliveryStatusText: "DeliveryStatus_Text",
      rejectionReason: "SalesDocumentRjcnReason",
      rejectionReasonText: "SalesDocumentRjcnReason_Text",
      // MVGR2 - real field (MaterialGroup2), client requirement (2026-08-31):
      // Fund Type (VFC/317/S/L/CHP/SPL/PAN/ARR/N/A - see Enums.js
      // FUND_TYPE/FUND_TYPE_BY_INTENTION), gated by Adult vs Pediatric.
      // Codes confirmed by the client (2026-08-31), all fit MaxLength=3
      // (design/so.xml/metadata.xml).
      fundType: "MaterialGroup2",
      // MVGR1 - real field (MaterialGroup1), but no ValueListReferences/fixed
      // values exposed for it in this service; Order Intention Select values
      // are a temporary hardcoded set (Adult/Pediatric/Adult+Pediatric) until
      // a real value list is confirmed.
      orderIntention: "MaterialGroup1",
      // No distinct "PO Reference" field at item level beyond PurchaseOrderByCustomer
      // (already used for ExIS ID) — BLOCKED-BY-SERVICE, see PHASE2_AUDIT.md.
      poReference: null,
      // Client requirement (2026-09-01): real field, carried over from the NDC's
      // own IndustryStandardName (productProperties above) on product selection,
      // never typed in directly - see onItemNdcValueHelpRequest.
      brand: "ZZIndustryStandardName",
      // Client requirement (2026-09-10): C_SALESORDERITEMMANAGE extension,
      // Edm.Int32 (design/so.xml) - RequestedQuantity is Edm.Decimal, so this
      // must always be sent as a real rounded integer, never that property's
      // own decimal-formatted display string (see onProdQtyChange in
      // Detail.controller.js - a non-integer value here crashes the Gateway
      // hard enough that even ITS error response comes back malformed).
      vfcQty: "ZZVFCQTY",
      stateQty: "ZZSTATEQTY",
      // Session Prompt (Detail View Adjustments) Items grid task: remaining
      // per-fund-type quantity mirrors (MaterialGroup2-gated, one active per
      // item - see Detail.controller.js#onFundTypeChange/onProdQtyChange).
      // All Edm.Int32 Nullable="false" (design/so.xml), seeded to 0 on Add.
      qty317: "ZZ317QTY",
      chipQty: "ZZCHIPQTY",
      panQty: "ZZPANQTY",
      resQty: "ZZRESQTY",
      // Session Prompt (Detail View Adjustments) 3.1: real property on
      // SalesOrderItemType (so.xml ~line 112, MaxLength 2) - this is the ONLY
      // place Priority actually lives; the Details section's header Priority
      // field is a virtual read/write projection over this per-item value (see
      // Detail.controller.js#_computeHeaderPriority/_propagatePriorityToItems).
      // Text reached via navigation.itemToDeliveryPriority (_DeliveryPriority).
      deliveryPriority: "DeliveryPriority",
      // Session Prompt (Detail View Adjustments) 3.3: real property on
      // SalesOrderItemType (so.xml ~line 131) - summed client-side into the
      // virtual header Tax Amount field (headerProperties.taxAmount is null;
      // this is the only real source).
      taxAmount: "TaxAmount"
    },

    customHeaderFields: [],

    customItemFields: [
      "ZZ1_SKIPADDANC_SDI",
      "ZZ1_OptOutAncillary_SDI",
      "ZZ1_SKIPANC"
    ],

    fixedOrderTypes: [
      // Confirmed 2026-08-19 via design/E008_Service_Extension_Design.md §6:
      // E008 vaccine-request order type is ZKB (replaces the old unconfirmed
      // "ZVR1" placeholder here — see OPEN_QUESTIONS.md item 9/NOTES.md).
      "ZKB"
    ],

    // --- CRUD Task 1 v5 (design/E008_CRUD1_v5_Sticky_Amendment.md) — the
    // "Provider-first bootstrap" mandate (Fix-Sequencing Prompt/v4) is VOID:
    // CreateWithSalesOrderType alone can never be a standalone, user-visible
    // step — this service is SAP__session.StickySessionSupported (design/
    // so.xml ~9983); the action only opens a buffered, not-yet-numbered
    // session (confirmed live: its own response has SalesOrder=""), and
    // nothing persists until SaveChanges commits it. Reinstated design: the
    // scratch transient list-binding context (CRUD Task 1 v3/v4) is the
    // createMode UI's only backing store — every fragment binds to it,
    // directly, in this deferred "vrCreate" group, and that group's batch is
    // NEVER submitted (Insertable=false on SalesOrderManage — see below).
    // Save harvests the scratch values and replays them for real (see
    // createReplayGroup/CreateOrderService.js#save). ---
    createUpdateGroup: "vrCreate",
    createPayloadUom: "EA",

    // v5 Required Fix 1 (group isolation): every request the replay at Save
    // sends — the CreateWithSalesOrderType call, the item deep-creates on the
    // sticky session, SaveChanges, and the header-extras PATCH — shares this
    // ONE dedicated group, never "vrEdit". Mixing replay into vrEdit was the
    // v4-era bug this fix closes: a stray pending change-mode edit could ride
    // the same changeset as the create replay. manifest.json registers this
    // as submit:"API" (deferred, explicit submitBatch), same as vrCreate/vrEdit.
    createReplayGroup: "vrCreateReplay",

    // Bound action CreateWithSalesOrderType (design/so.xml, EntitySetPath="_it",
    // IsBound="true") — the only way this service allows a new SalesOrderManage
    // row to come into existence (InsertRestrictions.Insertable=false on the
    // entity set itself — a raw POST/deep-insert 405s regardless of payload).
    // Invoked via the /SalesOrderManage list binding's header context
    // (oListBinding.getHeaderContext()), per the standard OData V4 client
    // pattern for actions bound to a collection.
    createAction: "com.sap.gateway.srvd.c_salesordermanage_sd.v0001.CreateWithSalesOrderType",

    // Sticky-session SaveAction (design/so.xml ~line 9994,
    // SAP__session.StickySessionSupported/SaveAction), bound action on the
    // entity itself (design/so.xml ~line 2318, EntitySetPath="_it", no extra
    // parameters). This is what actually commits the document and assigns
    // the real SalesOrder key — called only once the sticky session already
    // has its items attached (CreateOrderService.js#save), since SaveChanges
    // is the real SD commit (like VA01/VA02) and is expected to reject a
    // header-only order with zero items (hasMinItems() enforces this
    // client-side first).
    saveAction: "com.sap.gateway.srvd.c_salesordermanage_sd.v0001.SaveChanges",

    // Unbound DiscardAction (design/so.xml ~line 2251/2692, ActionImport
    // "DiscardChanges" — no bound "_it" parameter exists for it at all). v5
    // Required Fix 2 (session hygiene): on any Save failure AFTER
    // CreateWithSalesOrderType has already opened a sticky session (item
    // deep-create or SaveChanges itself rejected), this is called to discard
    // that buffered session server-side rather than leaving it to expire on
    // its own timeout. Invoke via the unqualified ActionImport path — per the
    // OData V4 sticky-session protocol the model correlates it to whichever
    // session THIS model instance currently has open (the SAP-ContextId
    // header the framework already tracks from the NewAction's response),
    // not a path this app addresses directly. TODO-VERIFY on first live
    // forced-failure test (v5 verification trace: "forced failure at ② or ③
    // → DiscardChanges observed, nothing in VBAK").
    discardAction: "/DiscardChanges",

    // DEMOTED (v5 amendment, "UX phasing + triad sourcing"): no longer the
    // primary source for CreateWithSalesOrderType's sales-area params — the
    // Provider VH row now supplies the real SalesOrganization/
    // DistributionChannel/Division for whichever area the user actually
    // picks (Detail.controller.js#onProviderValueHelpRequest,
    // CreateOrderService.js#save). This constant survives only as (a) the
    // soft pre-filter on the VH query (entitySets.customerSalesArea comment
    // above) and (b) a fallback if a picked VH row somehow lacked area
    // columns (TODO-VERIFY(B4) — should never happen in practice; originally
    // seeded from a live, working ZKB order, session 2026-08-27, provider
    // "TALBERT MEDICAL GROUP", customer 40000421). OrgData.fragment.xml still
    // renders the triad read-only in createMode (backend rejects them as
    // PATCHable org fields on an existing order — see updatableHeaderProperties
    // below), but now displays whatever CreateOrderService.js#enter seeded
    // (this constant) until a Provider row overwrites it with the harvested
    // real values.
    salesArea: {
      salesOrganization: "1000",
      distributionChannel: "10",
      organizationDivision: "10"
    },

    // Step ② "enrichment action" (ADDENDUM-001: re-routed to a behavior-
    // definition extension action on the standard BO, name/params TBD once
    // activated on-system) and step ③ IoH deep-create/createFromProposal
    // (design/prompts/e008_ext_build.md — ZUI_VR_EXT companion service, not yet
    // built/activated anywhere). Both are null = confirmed BLOCKED-BY-SERVICE,
    // never invented — CreateOrderService.js degrades per the v3 prompt's own
    // Step-0 rule (skip the call; affected fields stay read-only in createMode).
    enrichmentAction: null,
    iohCreateAction: null,

    // Session Prompt (Detail View Adjustments) 3.9: the ONLY way to add a new
    // HeaderPartner row - Container/HeaderPartner InsertRestrictions.
    // Insertable is statically false (so.xml ~15249), so a plain
    // oListBinding.create() against the _Partner navigation always 405s
    // regardless of payload. Bound action (so.xml ~2346, EntitySetPath=
    // "_it/_Partner", IsBound=true), bound directly to the header
    // (SalesOrderManageType) context - takes PartnerFunction as its only
    // parameter and returns the new HeaderPartnerType row (Customer is NOT a
    // parameter - set via a follow-up PATCH, since UpdateRestrictions.
    // NonUpdatableProperties only lists PartnerFunction, not Customer - so.xml
    // same block). See Detail.controller.js#onPartiesAddConfirm.
    createPartnerAction: "com.sap.gateway.srvd.c_salesordermanage_sd.v0001.CreatePartner",

    // Org Data fields confirmed creatable-only (writable at document creation,
    // rejected by the backend on an existing order — see updatableHeaderProperties
    // comment below/NOTES.md "CRUD Task 2 follow-up"). Still not user-editable
    // ComboBoxes in createMode — SalesOrganization/DistributionChannel/
    // OrganizationDivision are set as a SIDE EFFECT of the Provider VH pick
    // (harvested triad, v5 amendment), not typed in directly, so
    // OrgData.fragment.xml keeps rendering them read-only in every mode (the
    // createOnlyOrgProperties VH-code/text map this used to back is gone —
    // nothing else referenced it).

    statusProperties: {
      code: "OverallSDProcessStatus",
      text: "OverallSDProcessStatus_Text"
    },

    // HeaderPartnerType (so.xml ~line 1065) - reached only via the header's
    // _Partner navigation (navigation.headerToPartner), never queried
    // top-level. Session Prompt (Detail View Adjustments) 3.9.
    headerPartnerProperties: {
      partnerFunction: "PartnerFunction",
      // Customer is the real, settable partner-number field (set via a PATCH
      // after CreatePartner, see createPartnerAction above); Partner
      // (Computed, Label "Customer" in so.xml) is a generic display-only
      // mirror used for RO rendering of already-created rows.
      customer: "Customer",
      partner: "Partner",
      fullName: "FullName",
      address: "FormattedPostalAddressDesc",
      // Dynamic per-row capability structs (so.xml ~1065) - Delete/Update
      // enablement for each HeaderPartner row must read these, not a static
      // flag (Container/HeaderPartner UpdateRestrictions/DeleteRestrictions
      // are both dynamic Path expressions, not static booleans).
      entityControl: "__EntityControl"
      // NOTE: no "is main partner" boolean/flag anywhere on HeaderPartnerType -
      // confirmed absent from so.xml. The Parties Involved "Main Partner"
      // column is therefore unbound/disabled - see PartiesInvolved.fragment.xml
      // // TODO(main-partner) and OPEN_QUESTIONS.md.
    },

    // Value-help entity code/text property names for the filter ComboBoxes added
    // in Phase 2 (Priority, Delivery Block Reason). Kept here — not literal in any
    // controller — so the grep isolation check (design/E008 prototype repoint
    // prompt.md) still passes.
    valueHelpProperties: {
      deliveryBlockReasonCode: "DeliveryBlockReason",
      deliveryBlockReasonText: "DeliveryBlockReason_Text",
      deliveryPriorityCode: "DeliveryPriority",
      deliveryPriorityText: "DeliveryPriority_Text",
      salesOrderTypeCode: "SalesOrderType",
      salesOrderTypeText: "SalesOrderType_Text",
      orderReasonCode: "SDDocumentReason",
      orderReasonText: "SDDocumentReason_Text",
      // CRUD Task 2 follow-up (Shipping/Billing/Org Data) - all confirmed no
      // Core.Immutable/Computed annotation in metadata.xml, each with a real
      // fixed-values VH entity set (ShippingCondition, CustomerPaymentTerms,
      // SalesOffice, SalesGroup all exist as top-level EntitySets).
      shippingConditionCode: "ShippingCondition",
      shippingConditionText: "ShippingCondition_Text",
      paymentTermsCode: "CustomerPaymentTerms",
      paymentTermsText: "CustomerPaymentTerms_Text",
      salesOfficeCode: "SalesOffice",
      salesOfficeText: "SalesOffice_Text",
      salesGroupCode: "SalesGroup",
      salesGroupText: "SalesGroup_Text",
      // Session Prompt (Detail View Adjustments) 3.2/3.9.
      customerPurchaseOrderTypeCode: "CustomerPurchaseOrderType",
      customerPurchaseOrderTypeText: "CustomerPurchaseOrderType_Text",
      partnerFunctionCode: "PartnerFunction",
      partnerFunctionText: "PartnerFunction_Text"
    },

    // Session Prompt (Detail View Adjustments) 3.5, AUTHORITY block: the new
    // custom service (zui_providerorder_srv, manifest.json model "po") -
    // ProviderContact is the only entity this app reads from it this session;
    // ZZ_IoH stays ON HOLD (do not wire - see 3.8/NOTES.md) and ProductUOM is
    // unused/unwired (noted only, see OPEN_QUESTIONS.md).
    providerOrderService: {
      // TODO-VERIFY: URL follows the standard OData v4 SEGW/RAP binding-name
      // convention (design/zui_providerorder_meta.xml service definition name
      // "zui_providerorder_srv") mirrored from mainService's own
      // /<binding>/srvd/sap/<definition>/0001/ shape - the actual bound service
      // name (SICF/SEGW binding) was never independently confirmed against a
      // live system in this session (no backend access available - see
      // Onboarding guardrail on inventing endpoints). Verify in
      // /IWFND/MAINT_SERVICE or the Fiori launchpad's service catalog before
      // relying on this in a live test.
      entitySets: {
        providerContact: "ProviderContact"
      },
      // ProviderContactType (design/zui_providerorder_meta.xml) - key is
      // BusinessPartnerCompany + BusinessPartnerPerson; BusinessPartnerCompany
      // is assumed to correlate 1:1 with this app's SoldToParty/Provider id
      // (both are Business Partner customer numbers) - TODO-VERIFY: the exact
      // KUNNR-to-BusinessPartnerCompany mapping convention was never
      // independently confirmed live (no backend access this session).
      providerContactProperties: {
        businessPartnerCompany: "BusinessPartnerCompany",
        businessPartnerPerson: "BusinessPartnerPerson",
        businessPartnerPersonText: "BusinessPartnerPerson_Text",
        isStandardRelationship: "IsStandardRelationship",
        relationshipCategory: "RelationshipCategory",
        validityStartDate: "ValidityStartDate",
        validityEndDate: "ValidityEndDate"
      }
    },

    // --- CRUD Task 2 (Change Mode) — see design/Work Order 2 - CRUD Task 2 -
    // Change Mode.md (v2). R_SalesOrderTP BDEF verified unmanaged/no-draft/late-
    // numbering/lock-master/etag-master-LastChangeTime; confirmed independently
    // against this bound service too (Core.OptimisticConcurrency on
    // LastChangeDateTime, no IsActiveEntity key — see PHASE2_AUDIT.md P1).
    // Edit is a plain PATCH/ETag flow, no draft actions/DraftAdministrativeData —
    // if a draftActions block ever reappears here, delete it, it's wrong.
    //
    // Step-0 finding (deviates from the work order's assumption): Priority has
    // NO header-level field at all (item-level only, see itemProperties.
    // deliveryPriority above) - it is never PATCHed as a header property, even
    // though it now has a real, user-facing header UI (propagated to every
    // item instead, see Detail.controller.js#_propagatePriorityToItems). Only
    // Order Reason, ExIS ID/Customer Reference, Shipping Condition, Payment
    // Terms, Sales Office/Group, Description, and (Session Prompt, Detail View
    // Adjustments 3.2) Category/CustomerPurchaseOrderType are confirmed real,
    // editable header fields (no Core.Immutable/Computed annotation in the
    // metadata).
    updatableHeaderProperties: {
      orderReason: "SDDocumentReason",
      exisId: "PurchaseOrderByCustomer",
      // Shipping/Billing/Org Data follow-up (2026-08-21) - confirmed no
      // Core.Immutable/Computed annotation.
      shippingCondition: "ShippingCondition",
      paymentTerms: "CustomerPaymentTerms",
      salesOffice: "SalesOffice",
      salesGroup: "SalesGroup",
      // Client requirement (2026-09-01): needed here ONLY so the create-replay
      // step (CreateOrderService.js#_replayHeaderProperties) actually PATCHes
      // the value entered during Create - Description is deliberately NOT
      // rendered as an editable Input in change mode (Details.fragment.xml
      // shows create-mode-only), so its PATCHability on an EXISTING order is
      // still unconfirmed/out of this task's scope - verify before ever
      // wiring a change-mode Input for it.
      description: "ZZ_KTEXT_SDH",
      // Session Prompt (Detail View Adjustments) 3.2: real, independently
      // writable field (headerProperties.category above) - confirmed no
      // static Immutable/Computed annotation in so.xml, same as the other
      // fields in this list. Retires the old ZZ_BSARK_SDH/enum-based Category
      // concept entirely (never a real header field to begin with).
      category: "CustomerPurchaseOrderType"
      // SalesOrganization/DistributionChannel/OrganizationDivision were tried
      // here 2026-08-21 and reverted same day: backend rejects the PATCH with
      // "Read-only fields must not be changed" on an existing order, despite
      // no static Immutable/Computed annotation (dynamic FieldControl). See
      // NOTES.md.
    },

    // Item Quantity is the only Step-0-confirmed editable item property
    // (SAP__common.FieldControl-governed, no Immutable/Computed annotation).
    updatableItemProperties: {
      quantity: "RequestedQuantity"
    },

    // Update group for all edit-session PATCHes/creates (EditRequestService.js
    // + Details.fragment.xml/Items.fragment.xml $$updateGroupId bindings).
    editUpdateGroup: "vrEdit",

    showJurisdictionFilter: true,
    statusSource: "e008", // "standard" for temporary service, "e008" for swap-back

    buildHeaderPath: function (sOrderId) {
      return "/" + this.entitySets.header + "(" + this.keys.orderId + "='" + sOrderId + "')";
    }
  };

  // v5 Required Fix 4 (replay-list drift guard): step ④ of the create replay
  // (CreateOrderService.js#_replayHeaderProperties) PATCHes exactly the
  // fields the backend already confirms are PATCHable on an EXISTING order
  // (updatableHeaderProperties, above — Order Reason/ExIS ID/Shipping
  // Condition/Payment Terms/Sales Office/Sales Group). Deriving this list
  // FROM that map (instead of hand-maintaining a second, parallel array)
  // means adding a new editable createMode field to updatableHeaderProperties
  // is the ONLY step required to also replay it after Save — there is no
  // second list to remember to update, and nothing to drift out of sync.
  ServiceSchema.createReplayHeaderProperties = Object.keys(ServiceSchema.updatableHeaderProperties)
    .map(function (sKey) {
      return ServiceSchema.updatableHeaderProperties[sKey];
    });

  return ServiceSchema;
});
