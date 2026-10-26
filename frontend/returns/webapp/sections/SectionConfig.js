sap.ui.define([], function () {
  "use strict";

  // Single source of truth for the Detail panel stack (SectionFactory.js) and
  // the anchor strip (Detail.controller.js#_createSectionsNavModel) alike —
  // same convention as the cockpit's SectionConfig.js. MVP-1 is read-only
  // (prompt §1/§4.3): every section is `editable:false` so SectionFactory
  // never renders an Edit button anywhere — do NOT fork the factory to force
  // this, the existing `editable` flag already does it.
  return [
    {
      id: "general",
      titleKey: "sectionGeneral",
      fragment: "cdc.vaccret.sections.General",
      expanded: true,
      editable: false
    },
    {
      id: "items",
      titleKey: "sectionItems",
      fragment: "cdc.vaccret.sections.Items",
      expanded: false,
      editable: false
    },
    {
      id: "parties",
      titleKey: "sectionParties",
      fragment: "cdc.vaccret.sections.Parties",
      expanded: false,
      editable: false
    },
    {
      id: "texts",
      titleKey: "sectionTexts",
      fragment: "cdc.vaccret.sections.Texts",
      expanded: false,
      editable: false
    },
    {
      id: "prices",
      titleKey: "sectionPrices",
      fragment: "cdc.vaccret.sections.Prices",
      expanded: false,
      editable: false
    }
  ];
});
