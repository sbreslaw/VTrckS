sap.ui.define([], function () {
  "use strict";

  var ServiceSchema = {
    serviceRoot: "/sap/opu/odata4/sap/c_salesordermanage_sd/srvd/sap/c_salesordermanage/0001/", // TODO-VERIFY(META-1)

    // Swap-back block: previous custom service constants retained for quick rollback.
    // customServiceRoot: "/sap/opu/odata4/sap/zui_vaccinerequest_o4/srvd/sap/zui_vaccinerequest/0001/",
    // customHeaderEntitySet: "VaccineRequest",

    entitySets: {
      header: "SalesOrderManage", // TODO-VERIFY(META-2)
      item: "SalesOrderItemManage" // TODO-VERIFY(META-3)
    },

    navigation: {
      headerToItems: "to_Item" // TODO-VERIFY(META-4)
    },

    keys: {
      orderId: "SalesOrder", // TODO-VERIFY(META-5)
      isActive: "IsActiveEntity"
    },

    headerProperties: {
      providerId: "SoldToParty", // TODO-VERIFY(META-6)
      providerName: "SoldToPartyName", // TODO-VERIFY(META-7)
      status: "OverallSDProcessStatus", // TODO-VERIFY(META-8)
      createdOn: "CreationDate", // TODO-VERIFY(META-9)
      createdBy: "CreatedByUser", // TODO-VERIFY(META-10)
      netValue: "TotalNetAmount", // TODO-VERIFY(META-11)
      currency: "TransactionCurrency", // TODO-VERIFY(META-12)
      salesOrderType: "SalesOrderType", // TODO-VERIFY(META-13)
      salesOrganization: "SalesOrganization", // TODO-VERIFY(META-14)
      distributionChannel: "DistributionChannel", // TODO-VERIFY(META-15)
      division: "OrganizationDivision", // TODO-VERIFY(META-16)
      salesOffice: "SalesOffice", // TODO-VERIFY(META-17)
      shippingCondition: "ShippingCondition", // TODO-VERIFY(META-18)
      deliveryStatus: "OverallDeliveryStatus", // TODO-VERIFY(META-19)
      shipToParty: "ShipToParty", // TODO-VERIFY(META-20)
      customerReference: "CustomerPurchaseOrderNumber" // TODO-VERIFY(META-21)
    },

    itemProperties: {
      material: "Material", // TODO-VERIFY(META-22)
      itemText: "SalesOrderItemText", // TODO-VERIFY(META-23)
      quantity: "RequestedQuantity", // TODO-VERIFY(META-24)
      unit: "RequestedQuantityUnit", // TODO-VERIFY(META-25)
      itemCategory: "SalesDocumentItemCategory", // TODO-VERIFY(META-26)
      netAmount: "NetAmount", // TODO-VERIFY(META-27)
      currency: "TransactionCurrency", // TODO-VERIFY(META-28)
      fundType: "ZZ1_FUNDTYPE_SDI", // TODO-VERIFY(META-29)
      orderIntention: "ZZ1_ORDERINTENTION_SDI" // TODO-VERIFY(META-30)
    },

    customHeaderFields: [
      "ZZ1_FUNDTYPE_SDH",
      "ZZ1_ORDERINTENTION_SDH"
    ],

    fixedOrderTypes: [
      "ZVR1" // TODO-VERIFY(META-31)
    ],

    masterStatusCodes: [
      "A",
      "B",
      "C" // TODO-VERIFY(META-32)
    ],

    showJurisdictionFilter: true, // TODO-VERIFY(META-33)
    statusSource: "standard", // "standard" for temporary service, "e008" for swap-back

    buildHeaderPath: function (sOrderId, bIsActive) {
      return "/" + this.entitySets.header + "(" +
        this.keys.orderId + "='" + sOrderId + "'," +
        this.keys.isActive + "=" + (bIsActive !== false) + ")";
    }
  };

  return ServiceSchema;
});
