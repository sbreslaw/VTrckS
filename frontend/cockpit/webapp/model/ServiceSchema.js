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
      deliveryPriority: "DeliveryPriority"
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
      payerParty: "PayerParty",
      billToParty: "BillToParty",
      responsibleEmployee: "ResponsibleEmployee",
      salesEmployee: "SalesEmployee"
    },

    // _ShipToParty navigates to HeaderShipToPartyType (id + display name), NOT a
    // direct "Partner" property on SalesOrderManageType itself.
    shipToPartyProperties: {
      id: "Partner",
      fullName: "FullName"
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
      orderIntention: null,
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

    // --- CRUD Task 1 (Create New Provider Order) — see design/NEwVaccReq.md ---
    // TODO-VERIFY: no custom OrderCreate action exists in the current $metadata
    // (confirmed 2026-08-19: only standard C_SALESORDERMANAGE_SD actions such as
    // CreateWithSalesOrderType/CreateWithRefFromSlsQuotation are present — see
    // NOTES.md "CRUD Task 1" entry, PAYLOAD_CONTRACT.md). This name is a
    // placeholder for when the backend action ships; CreateRequestService.js
    // falls back to a mock resolve until it's confirmed and corrected here.
    orderCreateAction: "OrderCreate",

    // Payload field names for the OrderCreate request contract (see
    // PAYLOAD_CONTRACT.md) — kept here, not literal in CreateRequestService.js/
    // CreateRequestDialog.js, so a contract change is a one-file edit and the
    // grep isolation check stays meaningful.
    createPayloadFields: {
      provider: "provider",
      description: "description",
      contactId: "contactId",
      priority: "priority",
      orderReason: "orderReason",
      category: "category",
      exisId: "exisId",
      itemNdc: "ndc",
      itemQuantity: "quantity",
      itemUom: "uom",
      itemIntention: "intention"
    },
    createPayloadUom: "EA",

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
      salesOrderTypeText: "SalesOrderType_Text"
    },

    showJurisdictionFilter: true,
    statusSource: "e008", // "standard" for temporary service, "e008" for swap-back

    buildHeaderPath: function (sOrderId) {
      return "/" + this.entitySets.header + "(" + this.keys.orderId + "='" + sOrderId + "')";
    }
  };

  return ServiceSchema;
});
