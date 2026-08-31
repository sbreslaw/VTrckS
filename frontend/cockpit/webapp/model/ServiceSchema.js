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
      product: "Product"
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
      netValue: "TotalNetAmount",
      // No header-level Tax/Gross amount field exists on SalesOrderManageType in
      // design/so.xml (only TotalNetAmount) — TaxAmount/GrossAmount exist only on
      // SalesOrderItemType. BLOCKED-BY-SERVICE at header level; see PHASE2_AUDIT.md.
      taxAmount: null,
      grossAmount: null,
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
      // No header-level Priority field/nav exists (see navigation comment above) —
      // BLOCKED-BY-SERVICE at header level; only present per-item.
      priority: null,
      orderReason: "SDDocumentReason",
      // No header-level "Partner" property exists either — Ship-To-Party ID/name
      // are only reachable via the _ShipToParty navigation (HeaderShipToPartyType).
      customerReference: "PurchaseOrderByCustomer",
      exisId: "PurchaseOrderByCustomer",
      // Not present on SalesOrderManageType in design/so.xml — no free-text
      // "description"/"category" field found at header level. BLOCKED-BY-SERVICE.
      description: "SalesOrder",
      category: "SalesOrderType"
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
      text: "Product_Text"
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
      fundType: null,
      // MVGR1 - real field (MaterialGroup1), but no ValueListReferences/fixed
      // values exposed for it in this service; Order Intention Select values
      // are a temporary hardcoded set (Adult/Pediatric/Adult+Pediatric) until
      // a real value list is confirmed.
      orderIntention: "MaterialGroup1",
      // No distinct "PO Reference" field at item level beyond PurchaseOrderByCustomer
      // (already used for ExIS ID) — BLOCKED-BY-SERVICE, see PHASE2_AUDIT.md.
      poReference: null,
      brand: null
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
      salesGroupText: "SalesGroup_Text"
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
    // NO header-level field at all (item-level only, see headerProperties.priority
    // above) and Category has no real dedicated field (aliased to SalesOrderType
    // for display only) — neither is wired as editable here. Wiring "Category" as
    // editable would silently PATCH SalesOrderType on a live SD order. Only
    // Order Reason and ExIS ID/Customer Reference are confirmed real, editable
    // header fields (no Core.Immutable/Computed annotation in the metadata).
    updatableHeaderProperties: {
      orderReason: "SDDocumentReason",
      exisId: "PurchaseOrderByCustomer",
      // Shipping/Billing/Org Data follow-up (2026-08-21) - confirmed no
      // Core.Immutable/Computed annotation.
      shippingCondition: "ShippingCondition",
      paymentTerms: "CustomerPaymentTerms",
      salesOffice: "SalesOffice",
      salesGroup: "SalesGroup"
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
