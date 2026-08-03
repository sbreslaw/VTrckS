sap.ui.define([], function () {
  "use strict";

  // Single source of truth for the Detail panel stack: SectionFactory (panel
  // instantiation), the anchor strip (Detail.view.xml, via Detail.controller.js),
  // and the sectionFlags model (Edit button visibility/enablement) all read this
  // same array. Add a section here and it appears in the anchor strip automatically
  // (Phase 2 Prompt v2, item 2 "Anchor strip (FIX)").
  //
  // `editable` marks sections that get a per-section Edit button (Phase 2 Prompt v2,
  // item D) and must have a matching key in the sectionFlags model initial data
  // (Detail.controller.js#_createSectionFlagsModel).
  var aSectionConfig = [
    { id: "details", titleKey: "sectionDetails", fragment: "cdc.vaccreq.sections.Details", expanded: true, editable: true },
    { id: "items", titleKey: "sectionItems", fragment: "cdc.vaccreq.sections.Items", expanded: false, editable: true },
    { id: "inventory", titleKey: "sectionInventory", fragment: "cdc.vaccreq.sections.Inventory", expanded: false, editable: true },
    { id: "shipping", titleKey: "sectionShipping", fragment: "cdc.vaccreq.sections.Shipping", expanded: false, editable: true },
    { id: "shippingTransactions", titleKey: "sectionShippingTransactions", fragment: "cdc.vaccreq.sections.ShippingTransactions", expanded: false, editable: false },
    { id: "transactionHistory", titleKey: "sectionTransactionHistory", fragment: "cdc.vaccreq.sections.TransactionHistory", expanded: false, editable: false },
    { id: "orgData", titleKey: "sectionOrgData", fragment: "cdc.vaccreq.sections.OrgData", expanded: false, editable: false },
    { id: "priceTotals", titleKey: "sectionPriceTotals", fragment: "cdc.vaccreq.sections.PriceTotals", expanded: false, editable: false },
    { id: "billing", titleKey: "sectionBilling", fragment: "cdc.vaccreq.sections.Billing", expanded: false, editable: true },
    { id: "paymentMethod", titleKey: "sectionPaymentMethod", fragment: "cdc.vaccreq.sections.PaymentMethod", expanded: false, editable: true },
    { id: "scheduledActions", titleKey: "sectionScheduledActions", fragment: "cdc.vaccreq.sections.ScheduledActions", expanded: false, editable: false },
    { id: "status", titleKey: "sectionStatus", fragment: "cdc.vaccreq.sections.Status", expanded: false, editable: false },
    { id: "dates", titleKey: "sectionDates", fragment: "cdc.vaccreq.sections.Dates", expanded: false, editable: false }
  ];

  return aSectionConfig;
});
