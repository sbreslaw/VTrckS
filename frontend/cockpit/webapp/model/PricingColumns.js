sap.ui.define([
  "cdc/vaccreq/model/ServiceSchema",
  "sap/ui/core/format/NumberFormat",
  "sap/ui/model/Sorter",
  "sap/m/Column",
  "sap/m/ColumnListItem",
  "sap/m/Text"
], function (ServiceSchema, NumberFormat, Sorter, Column, ColumnListItem, Text) {
  "use strict";

  // Prices Tables (Header "Price Totals" + Item "Prices") session prompt:
  // ONE shared column/formatter definition, consumed by both
  // Detail.controller.js (priceTotals section) and ItemDetail.controller.js
  // (itemPrices section) - zero duplicated column logic. Property literals
  // live in ServiceSchema.pricingElements; this module never re-spells them.
  var P = ServiceSchema.pricingElements.properties;

  var oAmountFormat = NumberFormat.getFloatInstance({ minFractionDigits: 2, maxFractionDigits: 2, groupingEnabled: true });
  var oRatioFormat = NumberFormat.getFloatInstance({ minFractionDigits: 2, maxFractionDigits: 3, groupingEnabled: true });
  var oQuantityFormat = NumberFormat.getFloatInstance({ groupingEnabled: true });

  function toNumber(vValue) {
    if (vValue === null || vValue === undefined || vValue === "") {
      return null;
    }
    var fValue = parseFloat(vValue);
    return isNaN(fValue) ? null : fValue;
  }

  // Price column: ConditionRateAmount OR ConditionRateRatio, discriminated by
  // the two Is* flags; ratio renders with "%"; ConditionRateValueIsNull -> blank.
  function priceValue(bIsNull, bIsRatio, bIsAmount, sRateAmount, sRateRatio) {
    if (bIsNull) {
      return "";
    }
    if (bIsRatio) {
      var fRatio = toNumber(sRateRatio);
      return fRatio === null ? "" : (oRatioFormat.format(fRatio) + " %");
    }
    if (bIsAmount) {
      var fAmount = toNumber(sRateAmount);
      return fAmount === null ? "" : oAmountFormat.format(fAmount);
    }
    return "";
  }

  // Unit column: rate currency, blank for a percentage row or whenever Price is null.
  function rateUnit(bIsNull, bIsRatio, sConditionCurrency) {
    return (bIsNull || bIsRatio) ? "" : (sConditionCurrency || "");
  }

  // Price Unit column: the per-N quantity; 0/null -> blank.
  function priceUnit(sConditionQuantity) {
    var fQuantity = toNumber(sConditionQuantity);
    if (fQuantity === null || fQuantity === 0) {
      return "";
    }
    return oQuantityFormat.format(fQuantity);
  }

  // End Value column: ConditionAmountIsNull -> blank.
  function endValue(bIsNull, sConditionAmount) {
    if (bIsNull) {
      return "";
    }
    var fAmount = toNumber(sConditionAmount);
    return fAmount === null ? "" : oAmountFormat.format(fAmount);
  }

  var Formatter = {
    priceValue: priceValue,
    rateUnit: rateUnit,
    priceUnit: priceUnit,
    endValue: endValue
  };

  // 7 read-only columns (Actions/Status from the legacy screen are
  // deliberately dropped, session prompt §2) - identical for both tables.
  function createColumns(oBundle) {
    return [
      new Column({ header: new Text({ text: oBundle.getText("pricingColElement") }) }),
      new Column({ hAlign: "End", header: new Text({ text: oBundle.getText("pricingColPrice") }) }),
      new Column({ header: new Text({ text: oBundle.getText("pricingColUnit") }) }),
      new Column({ hAlign: "End", header: new Text({ text: oBundle.getText("pricingColPriceUnit") }) }),
      new Column({ header: new Text({ text: oBundle.getText("pricingColUom") }) }),
      new Column({ hAlign: "End", header: new Text({ text: oBundle.getText("pricingColEndValue") }) }),
      new Column({ header: new Text({ text: oBundle.getText("pricingColCurrency") }) })
    ];
  }

  function createRowTemplate() {
    return new ColumnListItem({
      cells: [
        new Text({ text: "{" + P.conditionTypeName + "}" }),
        new Text({
          text: {
            parts: [P.rateValueIsNull, P.rateValueIsRatio, P.rateValueIsAmount, P.rateAmount, P.rateRatio],
            formatter: priceValue,
            useRawValues: true
          }
        }),
        new Text({
          text: { parts: [P.rateValueIsNull, P.rateValueIsRatio, P.conditionCurrency], formatter: rateUnit, useRawValues: true }
        }),
        new Text({
          text: { path: P.conditionQuantity, formatter: priceUnit }
        }),
        new Text({ text: "{" + P.conditionQuantityUnit + "}" }),
        new Text({
          text: { parts: [P.conditionAmountIsNull, P.conditionAmount], formatter: endValue, useRawValues: true }
        }),
        new Text({ text: "{" + P.transactionCurrency + "}" })
      ]
    });
  }

  // Builds the 7 columns + binds `items` on the given Table to the section's
  // own pricing-elements navigation (header: "_PricingElement", item:
  // "_ItemPricingElement" - ServiceSchema.pricingElements). Sort:
  // PricingProcedureStep asc, PricingProcedureCounter asc (reproduces the
  // pricing-procedure order from the legacy screenshots) - no client re-sort
  // UI. No `$count` parameter: this backend 501s on "$count not supported on
  // expand", which poisons the whole combined batch request (breaks sibling
  // reads like _Item/SalesOrderType too) - the table's noData text already
  // shows correctly off a plain zero-row result, $count isn't needed for it.
  function bindTable(oTable, oBundle, sNavPath) {
    if (!oTable || oTable.getColumns().length) {
      return;
    }
    createColumns(oBundle).forEach(function (oColumn) {
      oTable.addColumn(oColumn);
    });
    oTable.bindItems({
      path: sNavPath,
      template: createRowTemplate(),
      templateShareable: false,
      sorter: [
        new Sorter(P.step, false),
        new Sorter(P.counter, false)
      ]
    });
  }

  return {
    formatter: Formatter,
    bindTable: bindTable
  };
});
