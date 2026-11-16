// No. of Boxes options (issues/RET-NoOfBoxes-Dropdown, customer 2026-11-16):
// whole numbers MIN..MAX inclusive, offered by the Returns Details dropdown.
// Keys are the strings written to the Edm.String(4) header property
// (ServiceSchema.headerProperties.noOfBoxes). Pure, no UI5 controls.
//
// Code-owner rule (2026-11-16): No. of Boxes "0" sets Shipping Condition to
// "01" (Standard - Mail in the ShippingCondition value list, DH1) and locks
// it; any other value unlocks it again (the value stays as it is).
sap.ui.define([], function () {
  "use strict";

  var MIN = 0;
  var MAX = 25;
  var ZERO_BOXES = "0";
  var ZERO_BOXES_SHIPPING_CONDITION = "01";

  return {
    MIN: MIN,
    MAX: MAX,

    options: function () {
      var aOptions = [];
      for (var i = MIN; i <= MAX; i++) {
        aOptions.push({ key: String(i), text: String(i) });
      }
      return aOptions;
    },

    locksShippingCondition: function (sNoOfBoxes) {
      return sNoOfBoxes === ZERO_BOXES;
    },

    // Shipping Condition a picked No. of Boxes forces, or null when it forces none.
    shippingConditionFor: function (sNoOfBoxes) {
      return sNoOfBoxes === ZERO_BOXES ? ZERO_BOXES_SHIPPING_CONDITION : null;
    }
  };
});
