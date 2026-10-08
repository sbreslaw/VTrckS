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
  // (Detail.controller.js#_createSectionFlagsModel). `editLive` (CRUD Task 2,
  // Change Mode) marks the sections whose Edit button is actually wired to a
  // real PATCH/ETag edit session (SectionFactory.js) \u2014 Details, Items, Shipping,
  // Org Data; every other `editable: true` section keeps the disabled,
  // tooltip-only placeholder behavior ("later phase").
  // Billing removed 2026-10-01 (client request) - Billing.fragment.xml is
  // kept on disk but no longer referenced here.
  //
  // `createVisible` marks the sections that expand and load immediately in
  // createMode. All configured sections remain available through the anchor
  // bar; sections without this flag stay collapsed until requested so their
  // content is not loaded eagerly.
  var aSectionConfig = [
    { id: "details", titleKey: "sectionDetails", fragment: "cdc.vaccreq.sections.Details", expanded: true, editable: true, editLive: true, createVisible: true },
    { id: "items", titleKey: "sectionItems", fragment: "cdc.vaccreq.sections.Items", expanded: true, editable: true, editLive: true, createVisible: true },
    {
      id: "inventory",
      titleKey: "sectionInventory",
      fragment: "cdc.vaccreq.sections.Inventory",
      expanded: false,
      editable: false,
      createVisible: true,
      headerAction: { id: "editList", titleKey: "sectionEditList", press: "onInventoryEditListPress", createOnly: true }
    },
    { id: "shipping", titleKey: "sectionShipping", fragment: "cdc.vaccreq.sections.Shipping", expanded: false, editable: true, editLive: true, createVisible: true },
    { id: "shippingTransactions", titleKey: "sectionShippingTransactions", fragment: "cdc.vaccreq.sections.ShippingTransactions", expanded: false, editable: false },
    { id: "transactionHistory", titleKey: "sectionTransactionHistory", fragment: "cdc.vaccreq.sections.TransactionHistory", expanded: false, editable: false },
    { id: "orgData", titleKey: "sectionOrgData", fragment: "cdc.vaccreq.sections.OrgData", expanded: false, editable: true, editLive: true, createVisible: true },
    // Prices Tables session prompt item 4: createVisible so createMode
    // (pre-save, transient header context) shows the section - the table's
    // own relative `_PricingElement` binding then simply yields zero rows
    // against that context, giving the designed empty state for free (no
    // extra createMode-specific handling needed here).
    { id: "priceTotals", titleKey: "sectionPriceTotals", fragment: "cdc.vaccreq.sections.PriceTotals", expanded: false, editable: false, createVisible: true },
    { id: "paymentMethod", titleKey: "sectionPaymentMethod", fragment: "cdc.vaccreq.sections.PaymentMethod", expanded: false, editable: true },
    { id: "scheduledActions", titleKey: "sectionScheduledActions", fragment: "cdc.vaccreq.sections.ScheduledActions", expanded: false, editable: false },
    { id: "status", titleKey: "sectionStatus", fragment: "cdc.vaccreq.sections.Status", expanded: false, editable: false },
    { id: "dates", titleKey: "sectionDates", fragment: "cdc.vaccreq.sections.Dates", expanded: false, editable: false },
    // New in CRUD Task 1 v3 \u2014 Attachments renders read-only/placeholder
    // content in every mode (no backing attachment entity exists in this
    // service). Session Prompt (Detail View Adjustments) 3.9: Parties
    // Involved is NO LONGER createVisible \u2014 CreatePartner (the only way to
    // add a HeaderPartner row) is bound to a real, already-persisted
    // SalesOrderManageType context and cannot target the createMode scratch
    // transient context, so the section is hidden until the order is saved.
    { id: "partiesInvolved", titleKey: "sectionPartiesInvolved", fragment: "cdc.vaccreq.sections.PartiesInvolved", expanded: false, editable: false },
    { id: "attachments", titleKey: "sectionAttachments", fragment: "cdc.vaccreq.sections.Attachments", expanded: false, editable: false, createVisible: true }
  ];

  return aSectionConfig;
});
