// Returns profile (ADR-002 Returns_Single_App_Service_Profile): PR1 (read
// paths) mapping of UI_CUSTOMERRETURNMANAGE names into the SAME key shape as
// OrdersSchema.js in this folder, served through model/ServiceSchema.js's
// facade (ServiceSchema.use(ReturnsSchema) in Component.init when the launch
// category is "_RET").
//
// SOURCE OF TRUTH: frontend/returns/webapp/model/ServiceSchema.js (the
// now-superseded separate-app prototype) - its own header comment states its
// names were "verified directly against
// design/metadata/ui_customerreturnmanage_2026-10-26.xml" (VTrckS-design).
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
      deliveryBlockReason: null,
      deliveryPriority: null,
      orderReason: "ReturnsOrderReason",
      shipToParty: "HeaderShipToParty",
      // Absent on this service - the Provider picker triad is sourced from
      // providerOrderService.entitySets.customerSalesArea (po model) instead,
      // confirmed live (NOTES.md "Returns MVP-2 Step-0", 2026-10-26, §6).
      customerSalesArea: null,
      contactInfo: null,
      // NDC Code Value Help lives on a SEPARATE F4 service for returns
      // (f4Product block below, c_custretprodbyslsorgdistrchnl via srvd_f4),
      // not a top-level entity set on this main service - PR2 concern.
      product: null,
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
      userStatus: null,
      createdOn: "CreationDate",
      createdBy: "CreatedByUser",
      netValue: "TotalNetAmount",
      taxAmount: null,
      grossAmount: null,
      currency: "TransactionCurrency",
      paymentMethod: null,
      salesOrderType: "CustomerReturnType",
      salesOrganization: null,
      distributionChannel: null,
      division: null,
      salesOffice: null,
      salesGroup: null,
      shippingCondition: "ShippingCondition",
      deliveryStatus: null,
      deliveryBlockStatus: null,
      deliveryBlockReason: null,
      billingBlockReason: null,
      billingBlockStatus: null,
      billingStatus: null,
      paymentTerms: null,
      priority: null,
      orderReason: "ReturnsOrderReason",
      customerReference: "PurchaseOrderByCustomer",
      exisId: "PurchaseOrderByCustomer",
      // The "return type" concept IS the header's own salesOrderType
      // (CustomerReturnType) on this service - no separate SpecialProcessingCode
      // field exists (that was an orders-only bolt-on). Hidden via orderUi
      // detailsReturnType for every _RET type.
      returnType: null,
      // CustomerPurchaseOrderDate - absent (not in the live-verified returns
      // ServiceSchema.js headerProperties list). Hidden via orderUi detailsExisDate.
      exisDate: null,
      // CustomerPurchaseOrderSuplmnt - absent. Hidden via orderUi detailsNoOfBoxes.
      noOfBoxes: null,
      labelAddress: null,
      // ZOrdDesc - absent; no free-text header description field confirmed on
      // CustomerReturnManageType.
      description: null,
      category: null
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

    // HeaderShipToPartyType (via _ShipToParty) - confirmed shape differs
    // slightly from orders' (no AddressID property documented).
    shipToPartyProperties: {
      id: "Partner",
      fullName: "FullName",
      addressId: null,
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

    // Matches entitySets.customerSalesArea = null above (see providerOrderService instead).
    customerSalesAreaProperties: null,

    paymentMethodProperties: null,

    // _CreatedByUser navigates to UserType (UserID, UserDescription) - same shape as orders.
    createdByUserProperties: {
      name: "UserDescription"
    },

    // NDC Code Value Help is the f4Product block below (separate F4 service), not
    // a top-level entity set on this service - PR2 concern.
    productProperties: null,

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
      itemCategory: null,
      netAmount: "NetAmount",
      currency: "TransactionCurrency",
      // NOTE (ADR-002 Step-0 follow-up, found this session - not one of the
      // original "4 literal XML hazards"): this service's item-level exisId
      // property is PurchaseOrderByCustomer, NOT ExisItemNumber like orders.
      // Items.fragment.xml's exisId column still hardcodes {ExisItemNumber} -
      // hidden for _RET via OrderModeConfig.js RETURNS_UI_HIDDEN.columns.exisId
      // (added this session) until a 5th sub-fragment pair is built. See
      // OPEN_QUESTIONS.md.
      exisId: "PurchaseOrderByCustomer",
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
      taxAmount: null,
      batch: "Batch",
      // Not in the live-verified returns itemProperties list - absent.
      expirationDate: null
    },

    // Mapped from the live-verified returns ServiceSchema.js itemFieldLimits/
    // headerFieldLimits into OrdersSchema's key shape.
    itemFieldLimits: {
      exisIdMaxLength: 35,
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
      taxAmount: null,
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
      properties: {
        step: null,
        counter: null,
        conditionTypeName: "ConditionTypeName",
        rateAmount: "ConditionRateAmount",
        rateRatio: "ConditionRateRatio",
        rateValueIsAmount: "ConditionRateValueIsAmount",
        rateValueIsRatio: "ConditionRateValueIsRatio",
        rateValueIsNull: null,
        conditionCurrency: "ConditionCurrency",
        conditionQuantity: null,
        conditionQuantityUnit: null,
        conditionAmount: "ConditionAmount",
        conditionAmountIsNull: null,
        transactionCurrency: null
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

    // No hardcoded fallback triad on this service - the real triad is sourced
    // from providerOrderService.entitySets.customerSalesArea (po model),
    // confirmed live (NOTES.md 2026-10-26 §6) - PR2 concern.
    salesArea: null,

    enrichmentAction: null,

    // No CreatePartner-equivalent action documented; Parties section hidden anyway.
    createPartnerAction: null,

    statusProperties: {
      code: "OverallSDProcessStatus",
      text: "OverallSDProcessStatus_Text"
    },

    contactPartnerFunction: null,

    // HeaderPartnerType - confirmed shape is much smaller than orders' (no
    // customer/contactPerson/phone/email/postalCode/cityName/country/street/
    // houseNumber properties documented); Parties section hidden anyway.
    headerPartnerProperties: {
      salesOrder: "CustomerReturn",
      partnerFunction: "PartnerFunction",
      customer: null,
      partner: "Partner",
      contactPerson: null,
      fullName: "FullName",
      phone: null,
      email: null,
      address: "FormattedPostalAddressDesc",
      postalCode: null,
      cityName: null,
      country: null,
      streetName: null,
      houseNumber: null,
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
    // future library extraction; frontend/returns ServiceSchema.js's own `po`
    // block already independently mirrors a subset of this same source).
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
    // JS number, not a string, on this service); Batch confirmed PATCHable;
    // ExpirationDate not confirmed to exist on this item type at all.
    updatableItemProperties: {
      quantity: "RequestedQuantity",
      batch: "Batch",
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
    // SEPARATE F4 service (srvd_f4), confirmed live
    // (frontend/returns/webapp/model/ServiceSchema.js) - PR2 concern.
    f4Product: {
      serviceRoot: "/sap/opu/odata4/sap/ui_customerreturnmanage/srvd_f4/sap/c_custretprodbyslsorgdistrchnl/0001/",
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
