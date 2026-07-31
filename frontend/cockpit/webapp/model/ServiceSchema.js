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
      status: "OverallSDProcessStatus"
    },

    navigation: {
      headerToItems: "_Item"
    },

    keys: {
      orderId: "SalesOrder"
    },

    headerProperties: {
      providerId: "SoldToParty",
      providerName: "CustomerName",
      status: "OverallSDProcessStatus",
      createdOn: "CreationDate",
      createdBy: "CreatedByUser",
      netValue: "TotalNetAmount",
      currency: "TransactionCurrency",
      salesOrderType: "SalesOrderType",
      salesOrganization: "SalesOrganization",
      distributionChannel: "DistributionChannel",
      division: "OrganizationDivision",
      salesOffice: "SalesOffice",
      shippingCondition: "ShippingCondition",
      deliveryStatus: "OverallDeliveryStatus",
      shipToParty: "Partner",
      customerReference: "PurchaseOrderByCustomer"
    },

    itemProperties: {
      material: "Product",
      itemText: "SalesOrderItemText",
      quantity: "RequestedQuantity",
      unit: "RequestedQuantityUnit",
      itemCategory: "SalesOrderItemCategory",
      netAmount: "NetAmount",
      currency: "TransactionCurrency",
      fundType: null,
      orderIntention: null
    },

    customHeaderFields: [],

    customItemFields: [
      "ZZ1_SKIPADDANC_SDI",
      "ZZ1_OptOutAncillary_SDI",
      "ZZ1_SKIPANC"
    ],

    fixedOrderTypes: [
      "ZVR1" // TODO-VERIFY: confirm E008 order types with backend
    ],

    statusProperties: {
      code: "OverallSDProcessStatus",
      text: "OverallSDProcessStatus_Text"
    },

    showJurisdictionFilter: true,
    statusSource: "standard", // "standard" for temporary service, "e008" for swap-back

    buildHeaderPath: function (sOrderId) {
      return "/" + this.entitySets.header + "(" + this.keys.orderId + "='" + sOrderId + "')";
    }
  };

  return ServiceSchema;
});
