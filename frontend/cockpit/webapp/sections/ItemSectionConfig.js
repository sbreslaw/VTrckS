sap.ui.define([], function () {
  "use strict";

  // Item Details view (FCL end column) — Session Prompt "Item Details View".
  // Mirrors SectionConfig.js's contract exactly (same `id`/`titleKey`/
  // `fragment`/`expanded`/`editable`/`editLive` keys, same
  // SectionFactory.js consumer), driven by its own "itemSectionFlags" model
  // instead of "sectionFlags" (ItemDetail.controller.js passes the model
  // name into the shared, now-parameterized SectionFactory). This is a
  // display-first deliverable — every section here is `editable: true` at
  // most (a disabled "later phase" Edit button, same convention already used
  // app-wide for non-`editLive` sections), never `editLive: true`; no
  // createMode dimension exists for item detail (no create flow here), so no
  // entry sets `createVisible`.
  var aItemSectionConfig = [
    {
      id: "itemDetails",
      titleKey: "sectionItemDetails",
      fragment: "cdc.vaccreq.sections.ItemDetails",
      expanded: true,
      editable: true
    },
    {
      id: "itemShipping",
      titleKey: "sectionItemShipping",
      fragment: "cdc.vaccreq.sections.ItemShipping",
      expanded: false,
      editable: true,
      // Parity with shipping.png: a second, disabled header action beyond the
      // standard Edit button (SectionFactory.js `extraHeaderButtons`).
      extraHeaderButtons: [
        { id: "altShipAddr", titleKey: "itemShippingAlternativeAddress", tooltipKey: "editAvailableLaterPhase" }
      ]
    },
    {
      id: "itemShippingTransactions",
      titleKey: "sectionItemShippingTransactions",
      fragment: "cdc.vaccreq.sections.ItemShippingTransactions",
      expanded: false,
      editable: false
    },
    {
      id: "itemPrices",
      titleKey: "sectionItemPrices",
      fragment: "cdc.vaccreq.sections.ItemPrices",
      expanded: false,
      // The Prices toolbar (Insert/Reprice/Complete Reprice/Add/Edit
      // List/Filter) is its own custom, all-disabled toolbar built directly
      // into ItemPrices.fragment.xml (same idiom as Items.fragment.xml's own
      // table headerToolbar) - no panel-level Edit button here.
      editable: false
    },
    {
      id: "itemTransactionHistory",
      titleKey: "sectionItemTransactionHistory",
      fragment: "cdc.vaccreq.sections.ItemTransactionHistory",
      expanded: false,
      editable: false
    }
  ];

  return aItemSectionConfig;
});
