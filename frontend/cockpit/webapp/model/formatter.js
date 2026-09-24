sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "sap/ui/core/format/DateFormat"
], function (ServiceSchema, DateFormat) {
  "use strict";

  var EM_DASH = "\u2014";

  var oDateFormat = DateFormat.getDateInstance();

  function orDash(vValue) {
    if (vValue === null || vValue === undefined || vValue === "") {
      return EM_DASH;
    }
    return vValue;
  }

  var mStatusText = {
    "0A": "Draft (no status)",
    "1A": "In Process",
    "1B": "On-Hold",
    "1C": "Rejected",
    "1D": "Approved",
    "1E": "Approved by Grantee",
    "1F": "Cancelled",
    "1G": "Complete",
    "2A": "Open Replacement",
    "2B": "Complete",    
    "2C": "Cancelled"
  };

  var mStatusState = {
    "0A": "None",
    "1A": "Information",
    "1B": "Warning",
    "1C": "Error",
    "1D": "Success",
    "1E": "Success",
    "1F": "None",
    "1G": "Success",
    "2A": "Information",
    "2B": "Success",    
    "2C": "None"
  };

  // SalesOrderType -> display label for the Details section title (only ZKB
  // is a supported order type in this app - see ServiceSchema.js#fixedOrderTypes).
  var mOrderTypeLabel = {
    ZKB: "Vaccine Order"
  };


  // Extracted as plain functions (not object methods) so status formatting
  // works correctly regardless of how the caller invokes it: some XML fragments
  // reference formatters as bare strings (e.g. '.formatter.detailStatusText'),
  // which does NOT guarantee `this` is bound to the formatter module — using
  // `this.statusText(...)` inside an object method broke under that call style
  // ("this.statusText is not a function", found live 2026-08-03).

  function removeFirstWord(str) {
    if (typeof str !== "string") {
        throw new TypeError("Input must be a string");
    }

    // Trim leading/trailing spaces
    str = str.trim();

    // Find the index of the first space
    const firstSpaceIndex = str.indexOf(" ");

    // If no space found, return empty string (only one word present)
    if (firstSpaceIndex === -1) {
        return "";
    }

    // Return everything after the first space, trimmed
    return str.slice(firstSpaceIndex + 1).trim();
  };

  function fnStatusText(sCode) {
    if (!!sCode) {
      return removeFirstWord(sCode) || sCode || "Draft";
    }
    return sCode || "Draft";
  }

  function fnStatusCode(sCode) {
    if (!!sCode) {
      let _code = sCode.split(' ')[0];
      return _code || '0A';
    }
    return sCode || "";
  }

  function fnUserStatusText(sCode) {
    if (!!sCode) {
      return mStatusText[sCode] || sCode || "";
    }
    return sCode || "";
  }

  function fnStatusState(sCode) {
    let _code = (!!sCode)?fnStatusCode(sCode):'';
      return mStatusState[_code] || "None";
  }

  // Items fundType (MaterialGroup2) Select core:Item enablement - VFC/CHP
  // require Adult+Pediatric/Pediatric order intention (client-stated gating,
  // see fundTypes model); bDisabled is kept for any future permanently-
  // disabled entry (none currently - SPL is selectable, see Detail.controller.js
  // FUND_TYPES / the Fund Split dialog session prompt).
  function fnFundTypeItemEnabled(sMaterialGroup1, bPediatricOnly, bDisabled) {
    if (bDisabled) {
      return false;
    }
    if (bPediatricOnly) {
      // Real MVGR1 codes (2026-09-16 client confirmation) - PED=Pediatric, MIX=Pediatric and Adult.
      return sMaterialGroup1 === "PED" || sMaterialGroup1 === "MIX";
    }
    return true;
  }

  // Ancillary Items & Opt-Out session prompt §3.3: the Opt-Out checkbox is
  // only ever meaningful/enabled on a PARENT row (never itself a child,
  // sHigherLevelItem unset) that actually HAS ancillary children right now
  // (oChildParents, keyed by SalesOrderItem - Detail.controller.js#
  // _computeAncillaryParents), on top of the usual createMode phasing gate.
  function fnItemOptOutEnabled(sItemNumber, sHigherLevelItem, oChildParents, bCreateMode, bProviderChosen) {
    if (sHigherLevelItem) {
      return false;
    }
    if (bCreateMode && !bProviderChosen) {
      return false;
    }
    return !!(oChildParents && sItemNumber && oChildParents[sItemNumber]);
  }

  // The checkbox itself never renders on an ancillary child row (HigherLevelItem
  // set) - a child never gets an opt-out control at all, not just a disabled one.
  function fnItemOptOutVisible(bColumnVisible, sHigherLevelItem) {
    return !!bColumnVisible && !sHigherLevelItem;
  }

  return {
    masterRequestId: function (sOrderId) {
      return sOrderId || "";
    },

    masterProvider: function (sId, sName) {
      sId = sId || "";
      sName = sName || "";
      return sName ? (sId + " - " + sName) : sId;
    },

    masterStatusText: function (sCode) {
      return fnStatusText(sCode);
    },

    masterStatusCode: function (sCode) {
      return fnStatusCode(sCode);
    },

    userStatusText: function (sCode) {
      return fnUserStatusText(sCode);
    },

    masterStatusState: function (sCode) {
      return fnStatusState(sCode);
    },

    fundTypeItemEnabled: function (sMaterialGroup1, bPediatricOnly, bDisabled) {
      return fnFundTypeItemEnabled(sMaterialGroup1, bPediatricOnly, bDisabled);
    },

    itemOptOutEnabled: function (sItemNumber, sHigherLevelItem, oChildParents, bCreateMode, bProviderChosen) {
      return fnItemOptOutEnabled(sItemNumber, sHigherLevelItem, oChildParents, bCreateMode, bProviderChosen);
    },

    itemOptOutVisible: function (bColumnVisible, sHigherLevelItem) {
      return fnItemOptOutVisible(bColumnVisible, sHigherLevelItem);
    },

    masterCreatedOn: function (sValue) {
      return sValue || "";
    },

    masterCreatedBy: function (sValue) {
      return sValue || "";
    },

    masterNetValue: function (sValue) {
      return sValue || "";
    },

    masterCurrency: function (sValue) {
      return sValue || "";
    },

    // BLOCKED-BY-SERVICE: no free-text order description on the header entity.
    masterDescription: function (sValue) {
      return sValue || EM_DASH;
    },

    masterContact: function (sFullName) {
      return '*****';
      // return orDash(sFullName);
    },

    masterCreatedAt: function (oValue) {
      if (!oValue) {
        return "";
      }
      if (oValue instanceof Date) {
        return oDateFormat.format(oValue);
      }
      return oValue;
    },

    // CRUD Task 1 v4: defaults the Details "Created At" field to today while
    // in createMode (CreationDate is unset on a transient context - the real
    // backend-assigned value is shown once the order is saved).
    detailCreatedAt: function (oValue) {
      if (oValue instanceof Date) {
        return oDateFormat.format(oValue);
      }
      if (!oValue) {
        return oDateFormat.format(new Date());
      }
      return oValue;
    },

    // Employee Responsible name is not exposed by this service (only the personnel
    // number via the contact-info navigation's ResponsibleEmployee field) — title is BLOCKED-BY-SERVICE.
    masterEmployeeResponsibleTitle: function () {
      return EM_DASH;
    },

    masterEmployeeResponsibleText: function (sPernr) {
      return orDash(sPernr);
    },

    masterCreatedByTitle: function (sName) {
      return orDash(sName);
    },

    orDash: function (vValue) {
      return orDash(vValue);
    },

    maskCardNumber: function (sValue) {
      if (!sValue) {
        return EM_DASH;
      }
      var sDigits = String(sValue).replace(/\s+/g, "");
      var sLast4 = sDigits.slice(-4);
      return "\u2022\u2022\u2022\u2022 " + sLast4;
    },

    // Standard "message button" pattern: count + severity-driven button type,
    // bound to sap/ui/core/Messaging's message model (live plumbing; empty in
    // Phase 2 since there is no transactional flow yet to raise messages).
    messagePopoverButtonText: function (aMessages) {
      return String((aMessages || []).length);
    },

    messagePopoverButtonType: function (aMessages) {
      aMessages = aMessages || [];
      if (!aMessages.length) {
        return "Transparent";
      }
      var bHasError = aMessages.some(function (oMessage) { return oMessage.type === "Error"; });
      if (bHasError) {
        return "Negative";
      }
      var bHasWarning = aMessages.some(function (oMessage) { return oMessage.type === "Warning"; });
      return bHasWarning ? "Critical" : "Neutral";
    },

    detailTitle: function (sOrderId, sContact, sPrefix, sFallback) {
      if (!sOrderId) {
        return sFallback;
      }
      return sContact ? (sPrefix + ":" + sOrderId + ", " + sContact) : (sPrefix + ":" + sOrderId);
    },

    detailStatusText: function (sCode) {
      return fnStatusText(sCode);
    },

    detailStatusState: function (sCode) {
      return fnStatusState(sCode);
    },

    // Section Panel title = "<order type label> <section text>" (e.g. "Vaccine
    // Order Details"/"Vaccine Order Items" for ZKB), falling back to the plain
    // i18n section text for an unmapped/not-yet-known order type.
    orderTypeSectionTitle: function (sOrderType, sSectionText) {
      var sLabel = mOrderTypeLabel[sOrderType];
      return sLabel ? (sLabel + " " + sSectionText) : sSectionText;
    },

    detailCreatedOnBy: function (sOn, sBy, sLabel) {
      sOn = sOn || "";
      sBy = sBy || "";
      return sLabel + ": " + sOn + " / " + sBy;
    },

    detailNetValue: function (sValue) {
      return sValue || "";
    },

    detailCurrency: function (sValue) {
      return sValue || "";
    },

    statusText: function (sCode) {
      return fnStatusText(sCode);
    },

    statusState: function (sCode) {
      return fnStatusState(sCode);
    },

    // Item Details view (FCL end column) - Title = "<Product> <Product_Text>".
    itemDetailTitle: function (sProduct, sProductText) {
      if (!sProduct) {
        return "";
      }
      return sProductText ? (sProduct + " " + sProductText) : sProduct;
    },

    // Subtitle = "<orderPrefix>: <orderId> / <itemPrefix>: <itemNumber>",
    // i18n-composed (sOrderPrefix/sItemPrefix come from i18n bundle text via
    // the caller's binding parts, not hardcoded here).
    itemDetailSubtitle: function (sOrderId, sItemNumber, sOrderPrefix, sItemPrefix) {
      if (!sOrderId) {
        return "";
      }
      return sOrderPrefix + ": " + sOrderId + " / " + sItemPrefix + ": " + (sItemNumber || "");
    },

    // No item-level Gross Value field exists (ZZ_GROSS_VALUE_SDH is
    // header-only, so.xml confirmed) - computed client-side as Net + Tax,
    // same pattern as the header's virtual Tax Amount
    // (Detail.controller.js#_computeHeaderTaxAmount).
    itemDetailGrossValue: function (sNetAmount, sTaxAmount) {
      var fNet = parseFloat(sNetAmount) || 0;
      var fTax = parseFloat(sTaxAmount) || 0;
      return String(fNet + fTax);
    }
  };
});
