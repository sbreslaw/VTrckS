// GH-95: Returns Items grid (sap.ui.table.Table) layout state for the view selector and
// the personalization dialog. A column's key is its itemsColumns visible binding path (as
// Detail.controller.js#_applyItemsGridSortProperties). No OData names, no category checks.
// State = { columns: [{ key, width }] (table order), visible: { key: bool }, sort: [{ key, descending }] }.
// Stored item = { version: 1, views: [{ key, title, state }], defaultKey, lastSelectedKey }.
sap.ui.define([
  "sap/ui/model/Sorter"
], function (Sorter) {
  "use strict";

  var STANDARD_KEY = "*standard*";
  var STORE_VERSION = 1;

  function columnKey(oColumn) {
    return (oColumn.getBindingPath("visible") || "").replace(/^\//, "");
  }

  function readColumns(oTable) {
    return oTable.getColumns().map(function (oColumn) {
      return { key: columnKey(oColumn), width: oColumn.getWidth() };
    });
  }

  // Keys of the grid's first iCount columns (its fixedColumnCount).
  function frozenKeys(oTable, iCount) {
    return readColumns(oTable).slice(0, Math.max(0, iCount || 0)).map(function (oEntry) { return oEntry.key; });
  }

  // Listed keys first, in the given order; columns not listed keep their relative order after them.
  function applyColumns(oTable, aColumns) {
    var iTarget = 0;
    aColumns.forEach(function (oEntry) {
      var aCurrent = oTable.getColumns();
      var oColumn = aCurrent.filter(function (oCandidate) { return columnKey(oCandidate) === oEntry.key; })[0];
      if (!oColumn) {
        return;
      }
      if (aCurrent.indexOf(oColumn) !== iTarget) {
        oTable.removeColumn(oColumn);
        oTable.insertColumn(oColumn, iTarget);
      }
      if (oEntry.width !== undefined && oColumn.getWidth() !== oEntry.width) {
        oColumn.setWidth(oEntry.width);
      }
      iTarget += 1;
    });
  }

  function isObject(vValue) {
    return !!vValue && typeof vValue === "object" && !Array.isArray(vValue);
  }

  // A complete state against the delivered columns; null = Standard (delivered, all visible, no sort).
  // Frozen keys (the grid's fixed columns) stay first in delivered order and are always visible.
  function normalizeState(oState, oDelivered, aMandatory, aSortableKeys, aFrozenKeys) {
    var aFrozen = aFrozenKeys || [];
    var aDelivered = oDelivered.columns;
    var aDeliveredKeys = aDelivered.map(function (oEntry) { return oEntry.key; });
    var oSource = isObject(oState) ? oState : {};
    var aColumns = [];
    (Array.isArray(oSource.columns) ? oSource.columns : []).forEach(function (oEntry) {
      var bKnown = isObject(oEntry) && aDeliveredKeys.indexOf(oEntry.key) !== -1;
      var bSeen = bKnown && aColumns.some(function (oSeen) { return oSeen.key === oEntry.key; });
      if (bKnown && !bSeen) {
        aColumns.push({ key: oEntry.key, width: typeof oEntry.width === "string" ? oEntry.width : aDelivered[aDeliveredKeys.indexOf(oEntry.key)].width });
      }
    });
    aDelivered.forEach(function (oEntry, iIndex) {
      if (!aColumns.some(function (oSeen) { return oSeen.key === oEntry.key; })) {
        aColumns.splice(Math.min(iIndex, aColumns.length), 0, { key: oEntry.key, width: oEntry.width });
      }
    });
    var aPinned = aDeliveredKeys.filter(function (sKey) { return aFrozen.indexOf(sKey) !== -1; }).map(function (sKey) {
      return aColumns.filter(function (oEntry) { return oEntry.key === sKey; })[0];
    });
    aColumns = aPinned.concat(aColumns.filter(function (oEntry) { return aFrozen.indexOf(oEntry.key) === -1; }));
    var oVisibleIn = isObject(oSource.visible) ? oSource.visible : {};
    var oVisible = {};
    aDeliveredKeys.forEach(function (sKey) {
      oVisible[sKey] = aMandatory.indexOf(sKey) !== -1 || aFrozen.indexOf(sKey) !== -1 || oVisibleIn[sKey] !== false;
    });
    var aSort = [];
    (Array.isArray(oSource.sort) ? oSource.sort : []).forEach(function (oEntry) {
      if (isObject(oEntry) && aSortableKeys.indexOf(oEntry.key) !== -1 &&
          !aSort.some(function (oSeen) { return oSeen.key === oEntry.key; })) {
        aSort.push({ key: oEntry.key, descending: !!oEntry.descending });
      }
    });
    return { columns: aColumns, visible: oVisible, sort: aSort };
  }

  function visibility(aKeys, fnTypeVisible, oVisible, aMandatory) {
    var oResult = {};
    aKeys.forEach(function (sKey) {
      oResult[sKey] = fnTypeVisible(sKey) && (aMandatory.indexOf(sKey) !== -1 || !oVisible || oVisible[sKey] !== false);
    });
    return oResult;
  }

  function toSorters(aSort, fnSortPath) {
    return aSort.map(function (oEntry) {
      var sPath = fnSortPath(oEntry.key);
      return sPath ? new Sorter(sPath, !!oEntry.descending) : null;
    }).filter(Boolean);
  }

  // Header sort (sap.ui.table.Table "sort" event): None removes, columnAdded adds/replaces, else replaces all.
  function nextSort(aSort, sKey, sSortOrder, bAdd) {
    var aCopy = aSort.map(function (oEntry) { return { key: oEntry.key, descending: !!oEntry.descending }; });
    if (sSortOrder === "None") {
      return aCopy.filter(function (oEntry) { return oEntry.key !== sKey; });
    }
    var oNew = { key: sKey, descending: sSortOrder === "Descending" };
    if (!bAdd) {
      return [oNew];
    }
    var iIndex = aCopy.map(function (oEntry) { return oEntry.key; }).indexOf(sKey);
    if (iIndex === -1) {
      aCopy.push(oNew);
    } else {
      aCopy[iIndex] = oNew;
    }
    return aCopy;
  }

  // sap.m.p13n.Item / SortItem shapes (name, not key).
  function selectionItems(aColumnKeys, oVisible, aMandatory, fnLabel) {
    return aColumnKeys.map(function (sKey) {
      return { name: sKey, label: fnLabel(sKey), visible: aMandatory.indexOf(sKey) !== -1 || !oVisible || oVisible[sKey] !== false };
    });
  }

  function sortItems(aSortableKeys, aSort, fnLabel) {
    var aSorted = aSort.filter(function (oEntry) { return aSortableKeys.indexOf(oEntry.key) !== -1; });
    var aSortedKeys = aSorted.map(function (oEntry) { return oEntry.key; });
    return aSorted.map(function (oEntry) {
      return { name: oEntry.key, label: fnLabel(oEntry.key), sorted: true, descending: !!oEntry.descending };
    }).concat(aSortableKeys.filter(function (sKey) { return aSortedKeys.indexOf(sKey) === -1; }).map(function (sKey) {
      return { name: sKey, label: fnLabel(sKey), sorted: false, descending: false };
    }));
  }

  function emptyStore() {
    return { version: STORE_VERSION, views: [], defaultKey: null, lastSelectedKey: null };
  }

  // null = nothing stored; false = unreadable (not a version-1 object); otherwise the cleaned store.
  function normalizeStore(vRaw) {
    if (vRaw === null || vRaw === undefined) {
      return null;
    }
    if (!isObject(vRaw) || vRaw.version !== STORE_VERSION) {
      return false;
    }
    var oStore = emptyStore();
    (Array.isArray(vRaw.views) ? vRaw.views : []).forEach(function (oView) {
      if (isObject(oView) && typeof oView.key === "string" && oView.key && oView.key !== STANDARD_KEY &&
          typeof oView.title === "string" && oView.title && isObject(oView.state) &&
          !oStore.views.some(function (oSeen) { return oSeen.key === oView.key; })) {
        oStore.views.push({ key: oView.key, title: oView.title, state: oView.state });
      }
    });
    var fnValid = function (sKey) {
      return sKey === STANDARD_KEY || oStore.views.some(function (oView) { return oView.key === sKey; });
    };
    oStore.defaultKey = fnValid(vRaw.defaultKey) ? vRaw.defaultKey : null;
    oStore.lastSelectedKey = fnValid(vRaw.lastSelectedKey) ? vRaw.lastSelectedKey : null;
    return oStore;
  }

  function initialKey(oStore) {
    return oStore.defaultKey || oStore.lastSelectedKey || STANDARD_KEY;
  }

  function newKey(oStore) {
    var sBase = "v" + Date.now().toString(36);
    var sKey = sBase;
    var iSuffix = 1;
    var fnTaken = function (sCandidate) {
      return oStore.views.some(function (oView) { return oView.key === sCandidate; });
    };
    while (fnTaken(sKey)) {
      sKey = sBase + "_" + iSuffix;
      iSuffix += 1;
    }
    return sKey;
  }

  function vmItems(oStore, sStandardTitle) {
    return [{ key: STANDARD_KEY, title: sStandardTitle, changeable: false, remove: false, rename: false }].concat(
      oStore.views.map(function (oView) {
        return { key: oView.key, title: oView.title, changeable: true, remove: true, rename: true };
      }));
  }

  return {
    STANDARD_KEY: STANDARD_KEY,
    STORE_ITEM: "itemsGridViews",
    columnKey: columnKey,
    readColumns: readColumns,
    frozenKeys: frozenKeys,
    applyColumns: applyColumns,
    normalizeState: normalizeState,
    visibility: visibility,
    toSorters: toSorters,
    nextSort: nextSort,
    selectionItems: selectionItems,
    sortItems: sortItems,
    emptyStore: emptyStore,
    normalizeStore: normalizeStore,
    initialKey: initialKey,
    newKey: newKey,
    vmItems: vmItems
  };
});
