// No. of Boxes options (issues/RET-NoOfBoxes-Dropdown, customer 2026-11-16):
// whole numbers MIN..MAX inclusive, offered by the Returns Details dropdown.
// Keys are the strings written to the Edm.String(4) header property
// (ServiceSchema.headerProperties.noOfBoxes). Pure, no UI5 controls.
sap.ui.define([], function () {
  "use strict";

  var MIN = 0;
  var MAX = 25;

  return {
    MIN: MIN,
    MAX: MAX,

    options: function () {
      var aOptions = [];
      for (var i = MIN; i <= MAX; i++) {
        aOptions.push({ key: String(i), text: String(i) });
      }
      return aOptions;
    }
  };
});
