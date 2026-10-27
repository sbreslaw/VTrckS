sap.ui.define([], function () {
  "use strict";

  // Single source of truth for every OData literal in this app (DoD grep
  // check: "no OData literal outside ServiceSchema.js"). Names verified
  // directly against design/metadata/ui_customerreturnmanage_2026-10-26.xml
  // (VTrckS-design) — never from memory, per the repo's non-negotiable rule.
  // Service: UI_CUSTOMERRETURNMANAGE V4, namespace
  // com.sap.gateway.srvd.ui_customerreturnmanage.v0001, no sticky
  // create/edit actions are exercised in MVP-1 (read-only scope guard,
  // prompt §1) — buildHeaderPath/buildItemPath below are plain GET paths.
  return {
    serviceRoot: "/sap/opu/odata4/sap/ui_customerreturnmanage/srvd/sap/ui_customerreturnmanage/0001/",

    sets: {
      header: "CustomerReturnManage",
      item: "CustomerReturnItemManage",
      returnType: "CustomerReturnType",
      returnsOrderReason: "ReturnsOrderReason",
      returnReason: "ReturnReason",
      salesDocumentRjcnReason: "SalesDocumentRjcnReason",
      shippingCondition: "ShippingCondition",
      overallSDProcessStatus: "OverallSDProcessStatus",
      returnsRefundType: "ReturnsRefundType",
      partnerFunction: "PartnerFunction",
      headerPartner: "HeaderPartner",
      headerPricingElement: "HeaderPricingElement",
      headerShipToParty: "HeaderShipToParty",
      headerText: "HeaderText",
      itemPartner: "ItemPartner",
      itemPricingElement: "ItemPricingElement",
      itemText: "ItemText",
      user: "User"
    },

    // Navigation property names (CustomerReturnManageType/CustomerReturnItemManageType).
    navs: {
      headerToItem: "_Item",
      headerToPartner: "_Partner",
      headerToPricingElement: "_PricingElement",
      headerToShipToParty: "_ShipToParty",
      headerToText: "_Text",
      headerToReturnType: "_CustomerReturnType",
      headerToReturnsOrderReason: "_ReturnsOrderReason",
      headerToShippingCondition: "_ShippingCondition",
      headerToStatus: "_OverallSDProcessStatus",
      headerToCreatedByUser: "_CreatedByUser",
      itemToItemPartner: "_ItemPartner",
      itemToItemPricingElement: "_ItemPricingElement",
      itemToItemText: "_ItemText",
      itemToReturnReason: "_ReturnReason",
      itemToReturnsRefundType: "_ReturnsRefundType",
      itemToRejectionReason: "_SalesDocumentRjcnReason",
      partnerToPartnerFunction: "_PartnerFunction"
    },

    keys: {
      returnId: "CustomerReturn",
      itemId: "CustomerReturnItem"
    },

    // MVP-2 Create/Edit (prompts/E008_Returns_MVP2_CRUD_Session_Prompt.md §4A/§4B).
    // Sticky-session write surface, verified live in Step-0
    // (traces/returns-create-probe-2026-10-26.md) — fully-qualified bound
    // action names per ui_customerreturnmanage_2026-10-26.xml.
    namespace: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001",
    actions: {
      createWithCustomerReturnType: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.CreateWithCustomerReturnType",
      prepareForEdit: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.PrepareForEdit",
      saveChanges: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.SaveChanges",
      // Unbound ActionImport (metadata EntityContainer) — invoked as
      // "/DiscardChanges(...)", never bound to a context (same convention as
      // the cockpit's ServiceSchema.discardAction).
      discardChanges: "/DiscardChanges",
      setRejectionReason: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.SetRejectionReason",
      removeRejectionReason: "com.sap.gateway.srvd.ui_customerreturnmanage.v0001.RemoveRejectionReason"
    },

    // Batch group ids — same isolation convention as the cockpit
    // (CreateOrderService.js/EditRequestService.js doc comments): "vrCreate"
    // is the ONLY group live-tested as needed for 4A (Step-0 found header
    // PATCHes stick without a post-SaveChanges replay batch, so no
    // "vrCreateReplay" group is wired yet — kept as a documented name only in
    // case a future field proves otherwise); "vrEdit" is the 4B edit-session
    // group (PrepareForEdit → PATCH → SaveChanges, mirrors EditRequestService).
    groups: {
      create: "vrCreate",
      createReplay: "vrCreateReplay",
      edit: "vrEdit"
    },

    // Control annotation property names (present on every read of
    // CustomerReturnManage/CustomerReturnItemManage — prompt §2.3).
    control: {
      field: "__FieldControl",
      entity: "__EntityControl",
      operation: "__OperationControl",
      createByAssociation: "__CreateByAssociationControl"
    },

    // Edm.MaxLength limits this app enforces client-side (Input maxLength),
    // read directly from ui_customerreturnmanage_2026-10-26.xml — never
    // hand-guessed (prompt §4A.5 itemFieldLimits).
    itemFieldLimits: {
      product: 18,
      batch: 10,
      requestedQuantityUnit: 3,
      purchaseOrderByCustomer: 35,
      returnsRefundType: 1
    },
    headerFieldLimits: {
      purchaseOrderByCustomer: 35,
      returnsOrderReason: 3,
      shippingCondition: 2
    },

    buildHeaderPath: function (sReturnId) {
      return "/" + this.sets.header + "('" + String(sReturnId).replace(/'/g, "''") + "')";
    },

    // Item-level deep path (Detail.controller.js#onPricesItemSelect — the one
    // dynamically-bound aggregation in this app, see Prices.fragment.xml).
    buildItemPath: function (sReturnId, sItemId) {
      return "/" + this.sets.item + "(" + this.keys.returnId + "='" + String(sReturnId).replace(/'/g, "''") + "',"
        + this.keys.itemId + "='" + String(sItemId).replace(/'/g, "''") + "')";
    },

    // CustomerReturnManageType — only the fields this app reads (Master
    // columns + General section, prompt §4.2/§4.3.1).
    headerProperties: {
      returnId: "CustomerReturn",
      returnType: "CustomerReturnType",
      returnDate: "CustomerReturnDate",
      soldToParty: "SoldToParty",
      soldToPartyName: "SoldToPartyName",
      exisId: "PurchaseOrderByCustomer",
      returnsOrderReason: "ReturnsOrderReason",
      shippingCondition: "ShippingCondition",
      requestedDeliveryDate: "RequestedDeliveryDate",
      status: "OverallSDProcessStatus",
      statusCriticality: "OvrlSDProcessStatusCriticality",
      incompletionText: "SlsDocOvrlGenIncompltnStsText",
      createdByUser: "CreatedByUser",
      creationDate: "CreationDate",
      netAmount: "TotalNetAmount",
      currency: "TransactionCurrency"
    },

    // Code->text properties available on the respective VH entity types.
    returnTypeProperties: { code: "CustomerReturnType", text: "CustomerReturnType_Text" },
    returnsOrderReasonProperties: { code: "ReturnsOrderReason", text: "ReturnsOrderReason_Text" },
    shippingConditionProperties: { code: "ShippingCondition", text: "ShippingCondition_Text" },
    overallSDProcessStatusProperties: { code: "OverallSDProcessStatus", text: "OverallSDProcessStatus_Text" },
    userProperties: { id: "UserID", name: "UserDescription" },

    // CustomerReturnItemManageType — Items section (prompt §4.3.2).
    itemProperties: {
      returnId: "CustomerReturn",
      itemId: "CustomerReturnItem",
      higherLevelItem: "HigherLevelItem",
      itemText: "CustomerReturnItemText",
      product: "Product",
      batch: "Batch",
      quantity: "RequestedQuantity",
      quantityUnit: "RequestedQuantityUnit",
      exisId: "PurchaseOrderByCustomer",
      returnReason: "ReturnReason",
      rejectionReason: "SalesDocumentRjcnReason",
      refundType: "ReturnsRefundType",
      netAmount: "NetAmount",
      currency: "TransactionCurrency"
    },
    returnReasonProperties: { code: "ReturnReason", text: "ReturnReason_Text" },
    rejectionReasonProperties: { code: "SalesDocumentRjcnReason", text: "SalesDocumentRjcnReason_Text" },
    returnsRefundTypeProperties: { code: "ReturnsRefundType", text: "ReturnsRefundType_Text" },

    // HeaderPartnerType / ItemPartnerType — Parties section (prompt §4.3.3).
    headerPartnerProperties: {
      returnId: "CustomerReturn",
      partnerFunction: "PartnerFunction",
      partner: "Partner",
      fullName: "FullName",
      formattedAddress: "FormattedPostalAddressDesc"
    },
    partnerFunctionProperties: { code: "PartnerFunction", text: "PartnerFunction_Text" },

    // HeaderShipToPartyType (1:1 via _ShipToParty) — Parties section header block.
    headerShipToPartyProperties: {
      returnId: "CustomerReturn",
      partner: "Partner",
      fullName: "FullName",
      cityName: "CityName",
      postalCode: "PostalCode",
      formattedAddress: "FormattedPostalAddressDesc"
    },

    // HeaderTextType — Texts section (prompt §4.3.4).
    headerTextProperties: {
      returnId: "CustomerReturn",
      language: "Language",
      longTextId: "LongTextID",
      longText: "LongText"
    },

    // HeaderPricingElementType / ItemPricingElementType — Prices section
    // (prompt §4.3.5), same five-column shape as the cockpit's Prices tables.
    pricingElementProperties: {
      conditionType: "ConditionType",
      conditionTypeName: "ConditionTypeName",
      conditionRateAmount: "ConditionRateAmount",
      conditionRateRatio: "ConditionRateRatio",
      conditionRateValueIsAmount: "ConditionRateValueIsAmount",
      conditionRateValueIsRatio: "ConditionRateValueIsRatio",
      conditionAmount: "ConditionAmount",
      conditionCurrency: "ConditionCurrency",
      conditionIsForStatistics: "ConditionIsForStatistics"
    },

    // Session Prompt §2/§4.1 AUTHORITY block: the provider/PIN picker is
    // copied from the cockpit verbatim — same custom service
    // (zui_providerorder_srv, manifest.json model "po"), same SoldToDetails
    // entity set/properties
    // (design/metadata/zui_providerorder_meta_2026-10-23.xml).
    // copied from frontend/cockpit @ VTrckS — keep in sync until library extraction.
    po: {
      serviceRoot: "/sap/opu/odata4/sap/zui_providerorder_srv/srvd/sap/zui_providerorder_srv/0001/",
      entitySets: {
        soldToDetails: "SoldToDetails",
        // MVP-2 Create (Step-0 §6): c_soldtosalesareavh carries no sales-area
        // triad at all — CreateWithCustomerReturnType's
        // SalesOrganization/DistributionChannel/OrganizationDivision come
        // from THIS existing entity set instead (zui_providerorder_meta
        // CustomerSalesAreaType, live-confirmed
        // traces/returns-create-probe-2026-10-26.md §6).
        customerSalesArea: "CustomerSalesArea"
      },
      soldToDetailsProperties: {
        soldToParty: "SoldToParty",
        identificationNumber: "IdentificationNumber"
      },
      customerSalesAreaProperties: {
        customer: "Customer",
        salesOrganization: "SalesOrganization",
        distributionChannel: "DistributionChannel",
        division: "Division"
      }
    },

    // MVP-2 Create (prompt §4A.5): Product value help, sales-area-restricted
    // — registered as its own OData V4 model ("f4Product", manifest.json) on
    // the srvd_f4 service, NOT the main service (the UI_CUSTOMERRETURNMANAGE
    // metadata only REFERENCES it via ValueListReferences). Step-0 §6 found
    // the Batch VH (i_batchstdvh) needs a Plant an item doesn't have at
    // create time — left unwired pending OPEN_QUESTIONS.md follow-up; Lot is
    // a plain Input for now (no typeahead), same conservative-default
    // instruction as the other open functional questions.
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
    }
  };
});
