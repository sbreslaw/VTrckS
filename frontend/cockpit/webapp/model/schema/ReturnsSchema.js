// Returns profile (ADR-002 Returns_Single_App_Service_Profile): PR1 (read
// paths) mapping of UI_CUSTOMERRETURNMANAGE names into the SAME key shape as
// OrdersSchema.js in this folder, served through model/ServiceSchema.js's
// facade (ServiceSchema.use(ReturnsSchema) in Component.init when the launch
// category is "_RET").
//
// SOURCE OF TRUTH: originally cross-checked against the standalone
// cdc.vaccret prototype's own model/ServiceSchema.js (frontend/returns/,
// removed once this profile superseded it - see VTrckS-design NOTES.md for
// history), whose own header comment stated its names were "verified
// directly against design/metadata/ui_customerreturnmanage_2026-10-26.xml"
// (VTrckS-design).
// Every value below is either copied from that file or set to null with a
// comment when the orders-side concept has no confirmed returns equivalent -
// never guessed/invented (Onboarding non-negotiable).
//
// PR1 is READ-ONLY: most of the null leaves below sit behind orderUi
// sections/fields already hidden for every _RET order type
// (OrderModeConfig.js RETURNS_UI_HIDDEN) - they only matter once PR2 (create/
// edit) wires item/header editing for _RET.
sap.ui.define([
  "cdc/vaccreq/model/OrderModeConfig"
], function (OrderModeConfig) {
  "use strict";

  var ReturnsSchema = {
    // See OrdersSchema.js's comment on this key - SectionFactory.js uses it to
    // pick the "details"/"items" sections' <name>.returns.fragment.xml literal-
    // hazard variants over the shared <name>.fragment.xml (ADR-002 decision 3).
    profileId: "returns",

    serviceRoot: "/sap/opu/odata4/sap/ui_customerreturnmanage/srvd/sap/ui_customerreturnmanage/0001/",

    entitySets: {
      header: "CustomerReturnManage",
      item: "CustomerReturnItemManage",
      status: "OverallSDProcessStatus",
      salesOrderType: "CustomerReturnType",
      // DeliveryBlockReason (ret-10-28 #1): Edm.String raw code, SAP__UI.Hidden,
      // NO Text annotation/ValueListReferences on this service (confirmed live,
      // 2026-10-28 metadata) - no separate "entity set" concept, it's a plain
      // property on CustomerReturnManageType (see headerProperties below).
      deliveryBlockReason: null,
      deliveryPriority: null,
      orderReason: "ReturnsOrderReason",
      shipToParty: "HeaderShipToParty",
      // ret-10-28 #2: F4 c_soldtosalesareavh is confirmed triad-less live
      // (no SalesOrganization/DistributionChannel/Division - just
      // Customer/CustomerName/City/PostalCode/Country) - per session prompt's
      // own documented fallback, Provider VH/typeahead/suggest for _RET reads
      // CustomerSalesArea off the new named "ord" model (manifest.json,
      // C_SALESORDERMANAGE_SRV's own /CustomerSalesArea - same KNVV data,
      // has the triad) instead of this (ui_customerreturnmanage) service.
      // See providerLookupModel below.
      customerSalesArea: "CustomerSalesArea",
      contactInfo: null,
      // NDC Code Value Help lives on a SEPARATE F4 service for returns
      // (f4Product block below, c_custretprodbyslsorgdistrchnl via srvd_f4,
      // confirmed by the live Product ValueListReferences annotation on
      // CustomerReturnItemManageType). Named here too (PR2 wiring) so the
      // shared NDC controller code in Detail.controller.js can address it the
      // same way as Orders' own top-level /Product - see productLookupModel
      // below for which named model actually backs this entity set.
      product: "C_CustRetProdBySlsOrgDistrChnl",
      customerPurchaseOrderType: null,
      partnerFunction: "PartnerFunction",
      // Parties reads (_Partner/HeaderPartner) are a confirmed backend bug on
      // this service (500 RAISE_SHORTDUMP, NOTES.md) - entity set name kept
      // here for completeness, but the Parties section stays hidden for every
      // _RET order type (OrderModeConfig.js RETURNS_UI_HIDDEN.sections).
      headerPartner: "HeaderPartner",
      deliveryStatus: null,
      deliveryBlockStatus: null,
      // Real analog lives in textEntity (HeaderText via _Text) - different shape.
      salesOrderText: null,
      rejectionReason: "SalesDocumentRjcnReason"
    },

    navigation: {
      headerToItems: "_Item",
      headerToPartner: "_Partner",
      headerToShipToParty: "_ShipToParty",
      headerToContactInfo: null,
      headerToCreatedByUser: "_CreatedByUser",
      headerToOrderReason: "_ReturnsOrderReason",
      headerToPaymentMethod: null,
      itemToRejectionReason: "_SalesDocumentRjcnReason",
      itemToDeliveryStatus: null,
      itemToDeliveryPriority: null
    },

    keys: {
      orderId: "CustomerReturn"
    },

    headerProperties: {
      providerId: "SoldToParty",
      providerName: "SoldToPartyName",
      status: "OverallSDProcessStatus",
      // ret-10-28 #4: no separate writable business-status field exists on
      // CustomerReturnManageType (unlike orders' UserStatusDerived) -
      // OverallSDProcessStatus is CONFIRMED SAP__core.Computed (2026-10-28
      // metadata), i.e. not writable either way. Reusing this same key (not a
      // new one) lets onDetailStatusChange keep a single branch-free lookup
      // (ServiceSchema.headerProperties.userStatus); the Details Status Select
      // stays enabled=false for _RET so this write path never actually fires.
      userStatus: "OverallSDProcessStatus",
      createdOn: "CreationDate",
      createdBy: "CreatedByUser",
      netValue: "TotalNetAmount",
      // Header-level TaxAmount/GrossAmount confirmed genuinely absent on
      // CustomerReturnManageType (2026-10-27 metadata) - item-level TaxAmount
      // is the only real source (see itemProperties.taxAmount below).
      taxAmount: null,
      grossAmount: null,
      currency: "TransactionCurrency",
      // 2026-10-27 metadata re-audit: confirmed real on CustomerReturnManageType
      // (previously wrongly marked null/absent) - unmapped for PR1 (read-only,
      // OrgData/PaymentMethod sections stay hidden for _RET regardless).
      paymentMethod: "PaymentMethod",
      salesOrderType: "CustomerReturnType",
      salesOrganization: "SalesOrganization",
      distributionChannel: "DistributionChannel",
      division: "OrganizationDivision",
      salesOffice: "SalesOffice",
      salesGroup: "SalesGroup",
      shippingCondition: "ShippingCondition",
      deliveryStatus: null,
      deliveryBlockStatus: null,
      // ret-10-28 #1: real property on CustomerReturnManageType, raw code only
      // (no Text annotation exists for it on this service - see entitySets
      // comment above).
      deliveryBlockReason: "DeliveryBlockReason",
      billingBlockReason: "HeaderBillingBlockReason",
      billingBlockStatus: null,
      billingStatus: null,
      paymentTerms: "CustomerPaymentTerms",
      priority: null,
      orderReason: "ReturnsOrderReason",
      customerReference: "PurchaseOrderByCustomer",
      exisId: "PurchaseOrderByCustomer",
      // 2026-10-27 metadata re-audit: SpecialProcessingCode IS real on
      // CustomerReturnManageType (previous comment wrongly claimed it didn't
      // exist) - Details.fragment.xml's detailsReturnType FormElement was
      // already correctly bound to it all along, just hidden via orderUi.
      returnType: "SpecialProcessingCode",
      // 2026-10-27 metadata re-audit: CustomerPurchaseOrderDate IS real
      // (previous comment wrongly claimed it was absent) - Details.fragment.xml's
      // detailsExisDate FormElement was already correctly bound, just hidden.
      exisDate: "CustomerPurchaseOrderDate",
      // 2026-10-27 metadata re-audit: CustomerPurchaseOrderSuplmnt IS real
      // (previous comment wrongly claimed it was absent) - FormElement restored
      // in Details.fragment.xml (returns copy), same StepInput+formatter pattern
      // as the orders-side fragment.
      noOfBoxes: "CustomerPurchaseOrderSuplmnt",
      labelAddress: null,
      // ZOrdDesc - absent; no free-text header description field confirmed on
      // CustomerReturnManageType.
      description: null,
      // ret-10-28 #7 metadata re-audit: CustomerPurchaseOrderType IS real on
      // CustomerReturnManageType (previous comment wrongly claimed no category
      // concept existed) - raw code only here (categoryValueHelp above resolves
      // its text via the Orders service's own VH, same domain).
      category: "CustomerPurchaseOrderType"
    },

    // Parties reads 500 on this service (backend bug, excluded from scope) -
    // entire block null, Parties/Contact sections stay hidden for every _RET
    // order type regardless.
    contactProperties: {
      fullName: null,
      email: null,
      phone: null,
      mobilePhone: null,
      address: null,
      soldToParty: null,
      payerParty: null,
      billToParty: null,
      responsibleEmployee: null,
      salesEmployee: null
    },

    // HeaderShipToPartyType (via _ShipToParty) - 2026-10-27 metadata re-audit:
    // AddressID IS real (previous comment wrongly claimed it was undocumented).
    shipToPartyProperties: {
      id: "Partner",
      fullName: "FullName",
      addressId: "AddressID",
      address: "FormattedPostalAddressDesc"
    },

    // No C_SDCustomerAddressVH-equivalent confirmed on this service.
    shippingAddressValueHelp: null,

    f4Services: {
      salesDocumentUser: null
    },

    // Shared CSDL vocabulary terms - not service-specific, identical to OrdersSchema.
    valueListTerms: {
      parameterInOut: "com.sap.vocabularies.Common.v1.ValueListParameterInOut",
      parameterOut: "com.sap.vocabularies.Common.v1.ValueListParameterOut",
      parameterDisplayOnly: "com.sap.vocabularies.Common.v1.ValueListParameterDisplayOnly",
      text: "@com.sap.vocabularies.Common.v1.Text"
    },

    // ret-10-28 #2: F4 c_soldtosalesareavh is confirmed triad-less live - the
    // Provider VH/typeahead instead reads CustomerSalesArea off the "ord"
    // model (manifest.json, C_SALESORDERMANAGE_SRV's own entity set, same
    // KNVV data/shape as OrdersSchema's own customerSalesAreaProperties below -
    // this is a literal copy of that shape, not an independent re-derivation).
    // 2026-10-30: division MUST match OrdersSchema's own value ("Division"),
    // not this service's own headerProperties.division name - the query runs
    // against the Orders service's CustomerSalesArea entity type (via "ord"),
    // which has no "OrganizationDivision" property (confirmed live: threw
    // "Invalid (navigation) property 'OrganizationDivision' in $select").
    customerSalesAreaProperties: {
      customer: "Customer",
      customerName: "CustomerName",
      organizationName2: "OrganizationBPName2",
      cityName: "CityName",
      postalCode: "PostalCode",
      countryText: "Country_Text",
      salesOrganization: "SalesOrganization",
      distributionChannel: "DistributionChannel",
      division: "Division"
    },

    paymentMethodProperties: null,

    // _CreatedByUser navigates to UserType (UserID, UserDescription) - same shape as orders.
    createdByUserProperties: {
      name: "UserDescription"
    },

    // NDC Code Value Help is the f4Product block below (separate F4 service),
    // not a top-level entity set on this service. Mapped into the same
    // generic shape OrdersSchema.productProperties uses (so the shared
    // Detail.controller.js NDC handlers work unchanged for both profiles) -
    // group/industryStandardName (brand) have no equivalent on this F4
    // entity (C_CustRetProdBySlsOrgDistrChnl only exposes Product/
    // ProductName/RequestedQuantityUnit, see f4Product.properties below).
    productProperties: {
      id: "Product",
      text: "ProductName",
      group: null,
      industryStandardName: null,
      baseUnit: "RequestedQuantityUnit"
    },

    itemProperties: {
      material: "Product",
      itemText: "CustomerReturnItemText",
      itemNumber: "CustomerReturnItem",
      optOutAncillary: null,
      skipAddAncillary: null,
      skipAncMarker: null,
      higherLevelItem: "HigherLevelItem",
      quantity: "RequestedQuantity",
      unit: "RequestedQuantityUnit",
      // 2026-10-27 metadata re-audit: confirmed real as "CustomerReturnItemCategory"
      // (Edm.String, MaxLength 4) on CustomerReturnItemManageType.
      itemCategory: "CustomerReturnItemCategory",
      netAmount: "NetAmount",
      currency: "TransactionCurrency",
      // CORRECTED (2026-10-27 metadata re-audit): ExisItemNumber IS real on
      // CustomerReturnItemManageType (Edm.String, MaxLength 12) - a prior round
      // this session wrongly assumed it was absent (based on the OLDER
      // 2026-10-26 metadata dump, which omitted it) and switched this to
      // PurchaseOrderByCustomer; reverted now to match Orders' own
      // itemProperties.exisId convention (OrdersSchema.js).
      exisId: "ExisItemNumber",
      deliveryStatus: null,
      deliveryStatusText: null,
      rejectionReason: "SalesDocumentRjcnReason",
      rejectionReasonText: "SalesDocumentRjcnReason_Text",
      fundType: null,
      orderIntention: null,
      poReference: null,
      brand: null,
      vfcQty: null,
      stateQty: null,
      qty317: null,
      chipQty: null,
      panQty: null,
      resQty: null,
      deliveryPriority: null,
      // 2026-10-27 metadata re-audit: confirmed real (Edm.Decimal, Precision 13,
      // Scale variable) on CustomerReturnItemManageType.
      taxAmount: "TaxAmount",
      // 2026-10-28 metadata re-audit: LotNumber (Edm.String, MaxLength 10) was
      // just added to CustomerReturnItemManageType, no FieldControl/F4 ref -
      // the Lot Number column now reads/writes this instead of Batch (which
      // still exists on this entity but is no longer the field the backend
      // wants for this UI; sections/returns/Items.fragment.xml hazard #3).
      batch: "LotNumber",
      // 2026-10-27 metadata re-audit: confirmed real (Edm.Date) on
      // CustomerReturnItemManageType - Items.fragment.xml's ExpirationDate
      // DatePicker was already correctly bound to it all along.
      expirationDate: "ExpirationDate"
    },

    // Mapped from the live-verified returns ServiceSchema.js itemFieldLimits/
    // headerFieldLimits into OrdersSchema's key shape. exisIdMaxLength matches
    // ExisItemNumber's own MaxLength (12, 2026-10-27 metadata), same as orders.
    itemFieldLimits: {
      exisIdMaxLength: 12,
      ndcMaxLength: 18,
      qtyMax: null
    },

    // No UpdatePrices-equivalent bound action documented for this service.
    updatePricesAction: null,

    itemActions: {
      setRejectionReason: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.SetRejectionReason",
      // TODO-VERIFY: parameter name not independently confirmed for this
      // service (mirrors the property it sets, same convention as orders).
      setRejectionReasonParameter: "SalesDocumentRjcnReason",
      removeRejectionReason: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.RemoveRejectionReason"
    },

    // TODO-VERIFY: __OperationControl sub-path confirmed present on this
    // service (control block), but these exact per-action keys were not
    // independently re-verified this session.
    itemOperationControl: {
      setRejectionReason: "__OperationControl/SetRejectionReason",
      removeRejectionReason: "__OperationControl/RemoveRejectionReason"
    },

    // Item Detail view - most sections hidden for every _RET order type
    // (OrderModeConfig.js RETURNS_UI_HIDDEN.sections: priceTotals,
    // shippingTransactions, status, dates, etc.) - only the fields still
    // visible there are mapped; the rest are null (PR2 concern if ever unhidden).
    itemDetailProperties: {
      product: "Product",
      productText: null,
      quantity: "RequestedQuantity",
      quantityUnit: "RequestedQuantityUnit",
      quantityUnitText: null,
      rejectionReason: "SalesDocumentRjcnReason",
      rejectionReasonText: "_SalesDocumentRjcnReason/SalesDocumentRjcnReason_Text",
      status: null,
      statusText: null,
      orderIntention: null,
      fundType: null,
      poReference: null,
      deliveryStatus: null,
      deliveryStatusText: null,
      totalQtyDelivered: null,
      orderQuantityUnit: null,
      netAmount: "NetAmount",
      // 2026-10-27 metadata re-audit: confirmed real (same TaxAmount property
      // as itemProperties.taxAmount above) - unmapped for PR1 (priceTotals
      // section stays hidden for every _RET type regardless).
      taxAmount: "TaxAmount",
      netPricePerUnit: null,
      pricingUnit: null,
      grossValue: null,
      deliveryBlockReason: null,
      deliveryBlockStatus: null,
      partialDeliveryIsAllowed: null,
      partialDeliveryIsAllowedText: null,
      maxPartialDeliveries: null,
      deliveryGroup: null,
      orderCombinationIsAllowed: null
    },

    // HeaderPricingElement/ItemPricingElement entity sets + navigations are
    // confirmed identical names on this service; the properties sub-map uses
    // this service's own (slightly different) field names, rest null.
    pricingElements: {
      headerEntitySet: "HeaderPricingElement",
      itemEntitySet: "ItemPricingElement",
      headerNavigation: "_PricingElement",
      itemNavigation: "_ItemPricingElement",
      // 2026-10-27 metadata re-audit: rateValueIsNull/conditionQuantity/
      // conditionQuantityUnit/conditionAmountIsNull/transactionCurrency are all
      // confirmed real on Header/ItemPricingElementType (previously wrongly
      // marked null/absent) - unmapped for PR1 (priceTotals section stays
      // hidden for every _RET type regardless).
      properties: {
        step: null,
        counter: null,
        conditionTypeName: "ConditionTypeName",
        rateAmount: "ConditionRateAmount",
        rateRatio: "ConditionRateRatio",
        rateValueIsAmount: "ConditionRateValueIsAmount",
        rateValueIsRatio: "ConditionRateValueIsRatio",
        rateValueIsNull: "ConditionRateValueIsNull",
        conditionCurrency: "ConditionCurrency",
        conditionQuantity: "ConditionQuantity",
        conditionQuantityUnit: "ConditionQuantityUnit",
        conditionAmount: "ConditionAmount",
        conditionAmountIsNull: "ConditionAmountIsNull",
        transactionCurrency: "TransactionCurrency"
      }
    },

    customHeaderFields: [],
    customItemFields: [],

    fixedOrderTypes: OrderModeConfig.supportedOrderTypes,
    defaultOrderType: OrderModeConfig.defaultOrderType,

    // No "category" (direct-entry) concept exists on this service.
    defaultCategory: null,
    // TODO-VERIFY: a valid default ShippingCondition code for returns create
    // was not independently confirmed this session - left null rather than
    // reusing orders' "01" (PR2 concern).
    defaultShippingCondition: null,
    defaultDeliveryStatus: null,
    defaultDeliveryBlockStatus: null,

    createUpdateGroup: "vrCreate",
    // TODO-VERIFY: RequestedQuantityUnit default/source for returns item
    // create not confirmed this session (PR2 concern).
    createPayloadUom: null,
    itemInteractiveGroup: "$auto",
    createReplayGroup: "vrCreateReplay",

    createAction: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.CreateWithCustomerReturnType",
    saveAction: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.SaveChanges",
    discardAction: "/DiscardChanges",

    // No confirmed default SalesOrganization/DistributionChannel/Division
    // triad for returns (do not invent orders' "1000"/"10"/"10") - stays null,
    // callers must skip the soft pre-filter entirely when this is null rather
    // than filtering on an empty/invented value (ret-10-28 #2).
    salesArea: null,

    enrichmentAction: null,

    // No CreatePartner-equivalent action documented; Parties section hidden anyway.
    createPartnerAction: null,

    statusProperties: {
      code: "OverallSDProcessStatus",
      text: "OverallSDProcessStatus_Text"
    },

    // ret-10-28 #2: see OrdersSchema.js providerLookupModel comment - "ord"
    // points Provider VH/typeahead/suggest at C_SALESORDERMANAGE_SRV's own
    // /CustomerSalesArea instead of this (triad-less) service.
    providerLookupModel: "ord",

    // See OrdersSchema.js productLookupModel comment. "f4ProductVH" points
    // the Item-level NDC Code Value Help/typeahead at the separate F4 service
    // (manifest.json named model, f4Product.serviceRoot below) instead of
    // this (no top-level Product entity set) service.
    productLookupModel: "f4ProductVH",

    // ret-10-28 #3/#4: no per-order-type business status profile exists on
    // this service (unlike orders' po>/OrderStatus) - OverallSDProcessStatus
    // is the only "status" concept returns has, so it doubles as both the
    // display/filter source (statusProperties above) and the VH options
    // source here, unfiltered by order type (typeFilterProperty: null).
    statusValueHelp: {
      model: "",
      entitySet: "OverallSDProcessStatus",
      codeProperty: "OverallSDProcessStatus",
      textProperty: "OverallSDProcessStatus_Text",
      typeFilterProperty: null
    },

    // ret-10-28 #7: CustomerPurchaseOrderType is real on CustomerReturnManageType
    // (2026-10-28 metadata: SAP__UI.Hidden, no SAP__common.Text annotation - raw
    // code only on THIS service) but its VH entity set only exists on the Orders
    // service (c_salesordermanage_srv so.xml ~line 718) - same BSARK domain
    // (SD document purchase order type) is universal across both services, so
    // reuse it via the always-loaded "ord" model, same precedent as
    // providerLookupModel above.
    categoryValueHelp: {
      model: "ord",
      entitySet: "CustomerPurchaseOrderType",
      codeProperty: "CustomerPurchaseOrderType",
      textProperty: "CustomerPurchaseOrderType_Text"
    },

    contactPartnerFunction: "AP",

    // 2026-10-30: _Partner/HeaderPartner reads still 500 on this service
    // (confirmed backend bug, NOTES.md) - this is now a SEPARATE flag from
    // contactPartnerFunction above (which is also used for the unrelated
    // CreatePartner-replay write path and had to become "AP" for that), so
    // ProviderSearchService.js#loadContactRows can keep skipping its
    // Provider-VH "Contact" search mode for _RET without being re-enabled by
    // that change (confirmed live regression: a stale contactPartnerFunction
    // === null check let the HeaderPartner query fire again once that value
    // became "AP", throwing "invalid property '_SalesOrder'" on $expand).
    contactSearchSupported: false,

    // HeaderPartnerType - 2026-10-27 metadata re-audit: customer/contactPerson/
    // phone(InternationalPhoneNumber)/email(EmailAddress)/postalCode/cityName/
    // country/streetName/houseNumber are ALL confirmed real (previous comment
    // wrongly claimed a much smaller shape than orders'). Mapped for
    // correctness, but _Partner/HeaderPartner reads still 500 on this service
    // (confirmed backend bug, NOTES.md) - Parties section stays hidden for
    // every _RET order type regardless until the backend bug is fixed.
    headerPartnerProperties: {
      salesOrder: "CustomerReturn",
      partnerFunction: "PartnerFunction",
      customer: "Customer",
      partner: "Partner",
      contactPerson: "ContactPerson",
      fullName: "FullName",
      phone: "InternationalPhoneNumber",
      email: "EmailAddress",
      address: "FormattedPostalAddressDesc",
      postalCode: "PostalCode",
      cityName: "CityName",
      country: "Country",
      streetName: "StreetName",
      houseNumber: "HouseNumber",
      entityControl: null
    },

    valueHelpProperties: {
      deliveryBlockReasonCode: null,
      deliveryBlockReasonText: null,
      deliveryPriorityCode: null,
      deliveryPriorityText: null,
      salesOrderTypeCode: "CustomerReturnType",
      salesOrderTypeText: "CustomerReturnType_Text",
      orderReasonCode: "ReturnsOrderReason",
      orderReasonText: "ReturnsOrderReason_Text",
      shippingConditionCode: "ShippingCondition",
      shippingConditionText: "ShippingCondition_Text",
      paymentTermsCode: null,
      paymentTermsText: null,
      salesOfficeCode: null,
      salesOfficeText: null,
      salesGroupCode: null,
      salesGroupText: null,
      customerPurchaseOrderTypeCode: null,
      customerPurchaseOrderTypeText: null,
      partnerFunctionCode: "PartnerFunction",
      partnerFunctionText: "PartnerFunction_Text",
      rejectionReasonCode: "SalesDocumentRjcnReason",
      rejectionReasonText: "SalesDocumentRjcnReason_Text"
    },

    // Shared custom service (zui_providerorder_srv) - identical for both
    // profiles, copied verbatim from OrdersSchema.js (keep in sync until a
    // future library extraction).
    providerOrderService: {
      serviceRoot: "/sap/opu/odata4/sap/zui_providerorder_srv/srvd/sap/zui_providerorder_srv/0001/",
      entitySets: {
        customerSalesArea: "CustomerSalesArea",
        fundTypeValueHelp: "FundTypeVH",
        providerContact: "ProviderContact",
        providerIoh: "ProviderIOH",
        soldToDetails: "SoldToDetails",
        providerDeliveries: "ProvOrdDelvs",
        priorityType: "PriorityType",
        orderIntention: "OrderIntention",
        vaccineReturnType: "VaccineReturnType",
        batchValueHelp: "BatchValueHelp",
        orderStatus: "OrderStatus"
      },
      orderIntentionProperties: {
        code: "OrderingIntention",
        text: "OrderingIntentionText",
        sortOrder: "SortOrder",
        ndc: "NDC"
      },
      providerDeliveryProperties: {
        salesOrder: "SalesOrder",
        delivery: "Delivery",
        subsequentDocumentCategoryText: "SubsequentDocumentCategoryText",
        deliveryCreationDate: "DeliveryCreationDate"
      },
      submitInventoryAction: "com.sap.gateway.srvd.zui_providerorder_srv.v0001.submitInventory",
      customerSalesAreaProperties: {
        customer: "Customer",
        salesOrganization: "SalesOrganization",
        distributionChannel: "DistributionChannel",
        division: "Division",
        salesOffice: "SalesOffice",
        isActiveEntity: "IsActiveEntity"
      },
      fundTypeValueHelpProperties: {
        ndc: "NDC",
        orderIntention: "OrderIntention",
        fundType: "FundType",
        fundTypeText: "FundTypeText"
      },
      providerIohProperties: {
        soldToParty: "SoldToParty",
        material: "Material",
        batch: "Batch",
        quantity: "Quantity",
        unit: "Unit",
        expirationDate: "ExpirationDate",
        brand: "Brand"
      },
      soldToDetailsProperties: {
        soldToParty: "SoldToParty",
        identificationNumber: "IdentificationNumber"
      },
      providerContactProperties: {
        businessPartnerCompany: "BusinessPartnerCompany",
        businessPartnerPerson: "BusinessPartnerPerson",
        businessPartnerPersonText: "BusinessPartnerPerson_Text",
        isStandardRelationship: "IsStandardRelationship",
        relationshipCategory: "RelationshipCategory",
        validityStartDate: "ValidityStartDate",
        validityEndDate: "ValidityEndDate"
      },
      vaccineReturnTypeProperties: {
        code: "SpecialProcessingCode",
        text: "SpecialProcessingText"
      },
      batchValueHelpProperties: {
        material: "Matnr",
        batch: "Batch"
      },
      orderStatusProperties: {
        orderType: "OrderType",
        status: "Status",
        text: "StatusTextDescription",
        statusProfile: "StatusProfile"
      }
    },

    // Confirmed PATCHable together after CreateWithCustomerReturnType's header
    // PATCH unlocks (NOTES.md "Returns MVP-2 Step-0", 2026-10-26): ReturnsOrderReason,
    // PurchaseOrderByCustomer, ShippingCondition (RequestedDeliveryDate also accepted
    // but has no orders-side key to mirror - PR2 can add one if needed).
    updatableHeaderProperties: {
      orderReason: "ReturnsOrderReason",
      exisId: "PurchaseOrderByCustomer",
      shippingCondition: "ShippingCondition",
      paymentTerms: null,
      salesOffice: null,
      salesGroup: null,
      priority: null,
      description: null,
      category: null,
      returnType: null
    },

    // RequestedQuantity confirmed editable (NOTES.md - must be sent as a raw
    // JS number, not a string, on this service); LotNumber (2026-10-28
    // metadata, no FieldControl annotation found - same no-restriction shape
    // as Batch before it) presumed PATCHable, not independently re-confirmed
    // this session; ExpirationDate confirmed to exist (2026-10-27 metadata)
    // but its PATCH-ability was not independently re-confirmed this session -
    // stays null (read-only) until verified.
    updatableItemProperties: {
      quantity: "RequestedQuantity",
      batch: "LotNumber",
      expirationDate: null
    },

    editUpdateGroup: "vrEdit",

    // HeaderTextType (via _Text) - confirmed shape, no separate "ForEdit"
    // shadow properties documented (unlike orders' LanguageForEdit/
    // LongTextIDForEdit) - TODO-VERIFY insertProperties before PR2 wires Notes
    // create/edit for _RET.
    textEntity: {
      entitySet: "HeaderText",
      navigation: "_Text",
      properties: {
        salesOrder: "CustomerReturn",
        language: "Language",
        languageForEdit: null,
        longTextId: "LongTextID",
        longTextIdForEdit: null,
        longText: "LongText"
      },
      insertProperties: {
        language: null,
        longTextId: null,
        longText: "LongText"
      },
      prepareForEditAction: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.PrepareForEdit",
      defaultLanguage: "E",
      // "ZVRH" (orders' Notes long-text id) is orders-specific - no returns equivalent confirmed.
      notesLongTextId: null
    },

    // No jurisdiction-filter requirement confirmed for the returns Master list.
    showJurisdictionFilter: false,
    statusSource: "e008",

    // Returns-only extension (no orders analog): NDC Code Value Help, a
    // SEPARATE F4 service (srvd_f4). entitySet/properties confirmed live;
    // serviceRoot's ;ps=...;va=... context-parameter suffix confirmed from the
    // live Product ValueListReferences annotation on
    // CustomerReturnItemManageType (2026-10-28 metadata, same pattern already
    // used for shippingAddressValueHelp in manifest.json) - PR2 wiring (this
    // session), see productLookupModel/entitySets.product/productProperties
    // above.
    f4Product: {
      serviceRoot: "/sap/opu/odata4/sap/ui_customerreturnmanage/srvd_f4/sap/c_custretprodbyslsorgdistrchnl/0001;ps='srvd-ui_customerreturnmanage-0001';va='com.sap.gateway.srvd.ui_customerreturnmanage.v0001.et-c_customerreturnitemmanagetp.product'/",
      entitySet: "C_CustRetProdBySlsOrgDistrChnl",
      properties: {
        salesOrganization: "SalesOrganization",
        distributionChannel: "DistributionChannel",
        product: "Product",
        productName: "ProductName",
        requestedQuantityUnit: "RequestedQuantityUnit"
      }
    },

    buildHeaderPath: function (sOrderId) {
      return "/" + this.entitySets.header + "(" + this.keys.orderId + "='" + sOrderId + "')";
    },

    buildItemPath: function (sOrderId, sItemNumber) {
      return "/" + this.entitySets.item + "(CustomerReturn='" + sOrderId + "',CustomerReturnItem='" + sItemNumber + "')";
    }
  };

  // Mirrors OrdersSchema.js's derivation, but filters out the (expected) null
  // entries in updatableHeaderProperties above - never replay a null path.
  ReturnsSchema.createReplayHeaderProperties = Object.keys(ReturnsSchema.updatableHeaderProperties)
    .map(function (sKey) {
      return ReturnsSchema.updatableHeaderProperties[sKey];
    })
    .filter(function (vValue) {
      return vValue !== null;
    });

  return ReturnsSchema;
});
