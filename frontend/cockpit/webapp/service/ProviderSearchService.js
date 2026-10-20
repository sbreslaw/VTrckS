sap.ui.define([
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "cdc/vaccreq/model/ServiceSchema",
  "cdc/vaccreq/util/FilterValue"
], function (Filter, FilterOperator, ServiceSchema, FilterValue) {
  "use strict";

  var MODE_ALL = "all";
  var MODE_CONTACT = "contact";
  var MODE_PROVIDER = "provider";
  var DEFAULT_ROW_LIMIT = 50;
  var MAX_CONTACT_SOURCE_ROWS = 1000;

  var FIELD_PATHS = {
    name: "_searchName",
    pin: "_searchPin",
    city: "_searchCity",
    id: "_searchId",
    contactName: "_contactName",
    contactId: "_contactId",
    contactPin: "_contactPin",
    providerName: "_providerName",
    providerId: "_providerId",
    providerPin: "_providerPin",
    providerCity: "_providerCity"
  };
  var RESULT_PATHS = {
    id: "_resultId",
    pin: "_resultPin",
    name: "_resultName",
    city: "_resultCity",
    phone: "_resultPhone",
    street: "_resultStreet"
  };

  var SEARCH_MODES = [
    {
      key: MODE_ALL,
      labelKey: "providerSearchModeAll",
      fields: [
        { path: FIELD_PATHS.name, labelKey: "providerSearchNameOrLastName" },
        { path: FIELD_PATHS.pin, labelKey: "providerSearchPin" },
        { path: FIELD_PATHS.city, labelKey: "providerHelpCity" },
        { path: FIELD_PATHS.id, labelKey: "providerSearchId" }
      ],
      columns: [
        { path: RESULT_PATHS.id, labelKey: "providerSearchId", width: "11rem" },
        { path: RESULT_PATHS.pin, labelKey: "providerSearchPin", width: "14rem" },
        { path: RESULT_PATHS.name, labelKey: "providerSearchName", width: "22rem" },
        { path: RESULT_PATHS.phone, labelKey: "providerSearchPhone", width: "14rem" },
        { path: RESULT_PATHS.street, labelKey: "providerSearchStreet", width: "20rem" },
        { path: RESULT_PATHS.city, labelKey: "providerHelpCity", width: "12rem" },
        { path: "PostalCode", labelKey: "providerHelpPostalCode", width: "10rem" },
        { path: "Country_Text", labelKey: "providerHelpCountry", width: "12rem" }
      ]
    },
    {
      key: MODE_CONTACT,
      labelKey: "providerSearchModeContact",
      fields: [
        { path: FIELD_PATHS.contactName, labelKey: "providerSearchContactLastName" },
        { path: FIELD_PATHS.contactId, labelKey: "providerSearchContactId" },
        { path: FIELD_PATHS.contactPin, labelKey: "providerSearchContactPin" }
      ],
      columns: [
        { path: RESULT_PATHS.id, labelKey: "providerSearchContactId", width: "11rem" },
        { path: RESULT_PATHS.pin, labelKey: "providerSearchContactPin", width: "14rem" },
        { path: RESULT_PATHS.name, labelKey: "providerSearchContactName", width: "22rem" },
        { path: "Customer", labelKey: "providerHelpId", width: "11rem" },
        { path: RESULT_PATHS.phone, labelKey: "providerSearchContactPhone", width: "14rem" },
        { path: RESULT_PATHS.street, labelKey: "providerSearchContactStreet", width: "20rem" },
        { path: RESULT_PATHS.city, labelKey: "providerHelpCity", width: "12rem" },
        { path: "PostalCode", labelKey: "providerHelpPostalCode", width: "10rem" },
        { path: "Country_Text", labelKey: "providerHelpCountry", width: "12rem" }
      ]
    },
    {
      key: MODE_PROVIDER,
      labelKey: "providerSearchModeProvider",
      fields: [
        { path: FIELD_PATHS.providerName, labelKey: "providerHelpName" },
        { path: FIELD_PATHS.providerId, labelKey: "providerHelpId" },
        { path: FIELD_PATHS.providerPin, labelKey: "filterProviderPin" },
        { path: FIELD_PATHS.providerCity, labelKey: "providerHelpCity" }
      ],
      columns: [
        { path: "Customer", labelKey: "providerHelpId", width: "11rem" },
        { path: RESULT_PATHS.pin, labelKey: "filterProviderPin", width: "14rem" },
        { path: "CustomerName", labelKey: "providerHelpName", width: "22rem" },
        { path: "CityName", labelKey: "providerHelpCity", width: "12rem" },
        { path: "PostalCode", labelKey: "providerHelpPostalCode", width: "10rem" },
        { path: "Country_Text", labelKey: "providerHelpCountry", width: "12rem" }
      ]
    }
  ];

  function unique(aValues) {
    return aValues.filter(function (sValue, iIndex) {
      return sValue && aValues.indexOf(sValue) === iIndex;
    });
  }

  function requestRows(oModel, sEntitySet, aSelect, aFilters, iRowLimit) {
    return oModel.bindList("/" + sEntitySet, undefined, undefined, aFilters || [], {
      $select: unique(aSelect).join(","),
      $count: false
    }).requestContexts(0, iRowLimit || DEFAULT_ROW_LIMIT).then(function (aContexts) {
      return aContexts.map(function (oContext) { return oContext.getObject(); });
    });
  }

  function containsFilter(sPath, sValue) {
    sValue = FilterValue.forFunction(sValue);
    return sValue ? new Filter(sPath, FilterOperator.Contains, sValue) : null;
  }

  function idsFilter(sPath, aIds) {
    if (!aIds.length) {
      return new Filter(sPath, FilterOperator.EQ, "");
    }
    return new Filter({
      filters: aIds.map(function (sId) { return new Filter(sPath, FilterOperator.EQ, sId); }),
      and: false
    });
  }

  function value(mValues, sPath) {
    return String(mValues[sPath] || "").trim();
  }

  function loadPinRows(oProviderModel, sPin) {
    var oProps = ServiceSchema.providerOrderService.soldToDetailsProperties;
    var aFilters = [];
    if (sPin) {
      aFilters.push(containsFilter(oProps.identificationNumber, sPin));
    }
    return requestRows(oProviderModel, ServiceSchema.providerOrderService.entitySets.soldToDetails, [
      oProps.soldToParty,
      oProps.identificationNumber
    ], aFilters, 200);
  }

  function pinMap(aRows) {
    var oProps = ServiceSchema.providerOrderService.soldToDetailsProperties;
    return aRows.reduce(function (mPins, oRow) {
      var sProviderId = oRow[oProps.soldToParty];
      if (!mPins[sProviderId]) {
        mPins[sProviderId] = oRow[oProps.identificationNumber];
      }
      return mPins;
    }, {});
  }

  function providerSelect() {
    var oProps = ServiceSchema.customerSalesAreaProperties;
    return [
      oProps.customer,
      oProps.customerName,
      oProps.postalCode,
      oProps.cityName,
      oProps.countryText,
      oProps.salesOrganization,
      oProps.distributionChannel,
      oProps.division
    ];
  }

  function normalizeProviderRows(aRows, mPins) {
    var oProps = ServiceSchema.customerSalesAreaProperties;
    return aRows.map(function (oRow) {
      return Object.assign({}, oRow, {
        _resultId: oRow[oProps.customer],
        _resultPin: mPins[oRow[oProps.customer]] || "",
        _resultName: oRow[oProps.customerName],
        _resultCity: oRow[oProps.cityName]
      });
    });
  }

  function loadProviderRows(oMainModel, oProviderModel, sName, sId, sPin, sCity, sBasicSearch, aBaseFilters,
    iRowLimit) {
    var oProps = ServiceSchema.customerSalesAreaProperties;
    var pPinRows = sPin ? loadPinRows(oProviderModel, sPin).catch(function () { return []; }) : Promise.resolve(null);
    return pPinRows.then(function (aMatchingPinRows) {
      var aFilters = (aBaseFilters || []).slice();
      aFilters.push(containsFilter(oProps.customerName, sName));
      aFilters.push(containsFilter(oProps.customer, sId));
      aFilters.push(containsFilter(oProps.cityName, sCity));
      if (sBasicSearch) {
        aFilters.push(new Filter({
          filters: [oProps.customerName, oProps.customer, oProps.cityName].map(function (sPath) {
            return containsFilter(sPath, sBasicSearch);
          }),
          and: false
        }));
      }
      if (aMatchingPinRows) {
        var oPinProps = ServiceSchema.providerOrderService.soldToDetailsProperties;
        aFilters.push(idsFilter(oProps.customer, unique(aMatchingPinRows.map(function (oRow) {
          return oRow[oPinProps.soldToParty];
        }))));
      }
      return requestRows(oMainModel, ServiceSchema.entitySets.customerSalesArea, providerSelect(),
        aFilters.filter(Boolean), iRowLimit);
    }).then(function (aProviderRows) {
      var aRows = normalizeProviderRows(aProviderRows, {});
      aRows.hasMore = aProviderRows.length >= iRowLimit;
      return aRows;
    });
  }

  function loadContactRows(oMainModel, oProviderModel, sName, sId, sPin, sCity, sBasicSearch, aBaseFilters,
    iRowLimit) {
    var oContactProps = ServiceSchema.headerPartnerProperties;
    var oProviderProps = ServiceSchema.customerSalesAreaProperties;
    var sSalesOrderNavigation = "_SalesOrder";
    if (sPin) {
      return Promise.resolve([]);
    }
    var aFilters = [
      new Filter(oContactProps.partnerFunction, FilterOperator.EQ, "AP"),
      new Filter(oContactProps.contactPerson, FilterOperator.NE, ""),
      new Filter(oContactProps.fullName, FilterOperator.NE, ""),
      containsFilter(oContactProps.fullName, sName),
      containsFilter(oContactProps.contactPerson, sId),
      containsFilter(oContactProps.cityName, sCity)
    ].filter(Boolean);
    if (sBasicSearch) {
      aFilters.push(new Filter({
        filters: [
          containsFilter(oContactProps.fullName, sBasicSearch),
          containsFilter(oContactProps.contactPerson, sBasicSearch)
        ],
        and: false
      }));
    }
    if (aBaseFilters && aBaseFilters.length) {
      aFilters.push(new Filter(sSalesOrderNavigation + "/" + oProviderProps.salesOrganization,
        FilterOperator.EQ, ServiceSchema.salesArea.salesOrganization));
    }
    var iSourceLimit = Math.min(iRowLimit * 5, MAX_CONTACT_SOURCE_ROWS);
    return oMainModel.bindList("/" + ServiceSchema.entitySets.headerPartner, undefined, undefined, aFilters, {
      $select: [oContactProps.salesOrder, oContactProps.partnerFunction, oContactProps.contactPerson,
        oContactProps.fullName, oContactProps.phone, oContactProps.postalCode, oContactProps.cityName,
        oContactProps.country, oContactProps.streetName, oContactProps.houseNumber].join(","),
      $expand: sSalesOrderNavigation + "($select=" + ["SoldToParty", "CustomerName", "SalesOrganization",
        "DistributionChannel", "OrganizationDivision"].join(",") + ")",
      $orderby: oContactProps.salesOrder + " desc",
      $count: false
    }).requestContexts(0, iSourceLimit).then(function (aContexts) {
      var mSeen = {};
      var aRows = aContexts.reduce(function (aContactRows, oContext) {
        var oContact = oContext.getObject();
        var oOrder = oContact[sSalesOrderNavigation];
        if (!oOrder || !oOrder.SoldToParty) {
          return aContactRows;
        }
        var sKey = oContact[oContactProps.contactPerson] + "|" + oOrder.SoldToParty;
        if (mSeen[sKey]) {
          return aContactRows;
        }
        mSeen[sKey] = true;
        aContactRows.push({
          Customer: oOrder.SoldToParty,
          CustomerName: oOrder.CustomerName,
          PostalCode: oContact[oContactProps.postalCode],
          CityName: oContact[oContactProps.cityName],
          Country_Text: oContact[oContactProps.country],
          SalesOrganization: oOrder.SalesOrganization,
          DistributionChannel: oOrder.DistributionChannel,
          Division: oOrder.OrganizationDivision,
          _resultId: oContact[oContactProps.contactPerson],
          _resultPin: "",
          _resultName: oContact[oContactProps.fullName],
          _resultPhone: oContact[oContactProps.phone],
          _resultStreet: [oContact[oContactProps.houseNumber], oContact[oContactProps.streetName]]
            .filter(Boolean).join(" "),
          _resultCity: oContact[oContactProps.cityName]
        });
        return aContactRows;
      }, []).slice(0, iRowLimit);
      aRows.hasMore = aContexts.length >= iSourceLimit && iSourceLimit < MAX_CONTACT_SOURCE_ROWS;
      return aRows;
    });
  }

  function interleaveRows(aProviderRows, aContactRows, iRowLimit) {
    var aRows = [];
    var iIndex = 0;
    while (aRows.length < iRowLimit && (iIndex < aProviderRows.length || iIndex < aContactRows.length)) {
      if (iIndex < aProviderRows.length) {
        aRows.push(aProviderRows[iIndex]);
      }
      if (aRows.length < iRowLimit && iIndex < aContactRows.length) {
        aRows.push(aContactRows[iIndex]);
      }
      iIndex += 1;
    }
    aRows.hasMore = !!(aProviderRows.hasMore || aContactRows.hasMore);
    return aRows;
  }

  function loadRows(oMainModel, oProviderModel, sMode, mValues, sBasicSearch, aBaseFilters, iRowLimit) {
    iRowLimit = iRowLimit || DEFAULT_ROW_LIMIT;
    var sName = value(mValues, sMode === MODE_CONTACT ? FIELD_PATHS.contactName :
      sMode === MODE_PROVIDER ? FIELD_PATHS.providerName : FIELD_PATHS.name);
    var sId = value(mValues, sMode === MODE_CONTACT ? FIELD_PATHS.contactId :
      sMode === MODE_PROVIDER ? FIELD_PATHS.providerId : FIELD_PATHS.id);
    var sPin = value(mValues, sMode === MODE_CONTACT ? FIELD_PATHS.contactPin :
      sMode === MODE_PROVIDER ? FIELD_PATHS.providerPin : FIELD_PATHS.pin);
    var sCity = value(mValues, sMode === MODE_PROVIDER ? FIELD_PATHS.providerCity : FIELD_PATHS.city);
    if (sMode === MODE_CONTACT) {
      return loadContactRows(oMainModel, oProviderModel, sName, sId, sPin, "", sBasicSearch, aBaseFilters,
        iRowLimit)
        .catch(function () { return []; });
    }
    if (sMode === MODE_PROVIDER) {
      return loadProviderRows(oMainModel, oProviderModel, sName, sId, sPin, sCity, sBasicSearch, aBaseFilters,
        iRowLimit);
    }
    return Promise.all([
      loadProviderRows(oMainModel, oProviderModel, sName, sId, sPin, sCity, sBasicSearch, aBaseFilters,
        iRowLimit),
      loadContactRows(oMainModel, oProviderModel, sName, sId, sPin, sCity, sBasicSearch, aBaseFilters,
        Math.ceil(iRowLimit / 2)).catch(function () { return []; })
    ]).then(function (aResults) {
      return interleaveRows(aResults[0], aResults[1], iRowLimit);
    });
  }

  return {
    modes: SEARCH_MODES,
    defaultMode: MODE_ALL,
    loadRows: loadRows
  };
});
