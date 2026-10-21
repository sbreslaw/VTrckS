const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const webapp = path.resolve(__dirname, "..", "..");

function loadModule(file, dependencies) {
  let result;
  vm.runInNewContext(fs.readFileSync(path.join(webapp, file), "utf8"), {
    sap: { ui: { define(names, factory) {
      result = factory(...names.map(name => dependencies[name] || {}));
    } } }
  }, { filename: file });
  return result;
}

const OrderModeConfig = loadModule("model\\OrderModeConfig.js", {});
const schema = loadModule("model\\ServiceSchema.js", {
  "cdc/vaccreq/model/OrderModeConfig": OrderModeConfig
});
const props = schema.customerSalesAreaProperties;
const area = schema.salesArea;
const plain = value => JSON.parse(JSON.stringify(value));
const event = parameters => ({ getParameter: name => parameters[name] });
const contexts = rows => rows.map(row => ({ getObject: () => row }));

function provider(overrides = {}) {
  return Object.assign({
    [props.customer]: "40001111",
    [props.customerName]: "Test Provider",
    [props.cityName]: "Atlanta",
    [props.postalCode]: "30333",
    [props.countryText]: "United States",
    [props.salesOrganization]: area.salesOrganization,
    [props.distributionChannel]: area.distributionChannel,
    [props.division]: area.organizationDivision
  }, overrides);
}

function setup() {
  const calls = { picks: [], busy: [], messages: [], requests: [], filters: [], destroyed: 0 };
  const state = { context: { getPath: () => "/test-context" }, createMode: true, chosen: false, name: "" };
  let resolve;
  let reject;
  const response = new Promise((yes, no) => { resolve = yes; reject = no; });
  const binding = {
    requestContexts(start, length) { calls.requests.push([start, length]); return response; },
    destroy() { calls.destroyed++; }
  };
  const model = { bindList(...args) { calls.filters.push(args); return binding; } };
  const view = {
    getBindingContext: () => state.context,
    getModel: name => name ? {
      getProperty: key => ({
        "/createMode": state.createMode,
        "/providerChosen": state.chosen,
        "/providerName": state.name
      })[key]
    } : model,
    setBusy: busy => calls.busy.push(busy)
  };
  const controller = loadModule("controller\\Detail.controller.js", {
    "sap/ui/core/mvc/Controller": { extend: (name, methods) => methods },
    "sap/ui/model/Filter": function (...args) { this.args = args; },
    "sap/ui/model/FilterOperator": { EQ: "EQ" },
    "sap/m/MessageBox": { information: (...args) => calls.messages.push(args) },
    "sap/m/MessageToast": { show: text => calls.messages.push(text) },
    "cdc/vaccreq/model/ServiceSchema": schema,
    "cdc/vaccreq/model/MessageExtractor": {
      addNote: (...args) => calls.messages.push(args),
      extract: error => calls.error = error
    }
  });
  Object.assign(controller, {
    getView: () => view,
    getResourceBundle: () => ({ getText: (key, args) => [key, ...(args || [])].join(":") }),
    _applyProviderPick: pick => calls.picks.push(plain(pick)),
    _setProviderValueState: valid => calls.valid = valid,
    _openMessagePopover: () => calls.popover = true,
    _getCreatableOrderTypes: () => ["ZKB"],
    _enterCreateMode: type => calls.entered = type,
    _oRouter: { navTo: (...args) => calls.navigation = args }
  });
  return { controller, calls, state, resolve, reject };
}

test("route without providerId retains manual creation without a lookup", () => {
  const { controller, calls } = setup();
  controller._onCreateMatched(event({ arguments: { orderType: "ZKB" } }));
  assert.equal(calls.entered, "ZKB");
  assert.equal(calls.requests.length, 0);
  assert.deepEqual(calls.picks, []);
});

test("route with providerId starts lookup; unauthorized type does not", async () => {
  const { controller, calls, resolve } = setup();
  controller._onCreateMatched(event({
    arguments: { orderType: "zkb", "?query": { providerId: " 40001111 " } }
  }));
  assert.equal(calls.entered, "ZKB");
  assert.equal(calls.filters[0][3][1].args[2], "40001111");
  resolve([]);
  await new Promise(setImmediate);

  const denied = setup();
  denied.controller._onCreateMatched(event({
    arguments: { orderType: "OTHER", "?query": { providerId: "40001111" } }
  }));
  assert.deepEqual(plain(denied.calls.navigation), ["master", {}, true]);
  assert.equal(denied.calls.requests.length, 0);
});

test("shared mapping preserves identity, sales area and address formatting", () => {
  const { controller } = setup();
  assert.deepEqual(plain(controller._providerRowToPick(provider({ [props.postalCode]: "" }))), {
    id: "40001111", fullName: "Test Provider", address: "Atlanta, United States",
    salesOrganization: area.salesOrganization,
    distributionChannel: area.distributionChannel, division: area.organizationDivision
  });
});

test("preselection waits for data, prefers configured sales area, and cleans up", async () => {
  const { controller, calls, resolve } = setup();
  const preferred = provider();
  const pending = controller._preselectProvider("40001111");
  assert.deepEqual(calls.picks, []);
  assert.deepEqual(calls.busy, [true]);
  assert.deepEqual(calls.requests, [[0, 20]]);
  assert.equal(calls.filters[0][0], "/" + schema.entitySets.customerSalesArea);
  assert.deepEqual(plain(calls.filters[0][3].map(filter => filter.args)), [
    [props.salesOrganization, "EQ", area.salesOrganization],
    [props.customer, "EQ", "40001111"]
  ]);
  resolve(contexts([provider({ [props.distributionChannel]: "other" }), preferred]));
  await pending;
  assert.deepEqual(calls.picks, [plain(controller._providerRowToPick(preferred))]);
  assert.deepEqual(calls.busy, [true, false]);
  assert.equal(calls.destroyed, 1);
});

test("without configured sales-area row, preselection still uses the first match", async () => {
  const { controller, calls, resolve } = setup();
  const first = provider({ [props.division]: "other" });
  const pending = controller._preselectProvider("40001111");
  resolve(contexts([first]));
  await pending;
  assert.deepEqual(calls.picks, [plain(controller._providerRowToPick(first))]);
});

test("unknown provider remains unselected and shows the localized message", async () => {
  const { controller, calls, resolve } = setup();
  const pending = controller._preselectProvider("missing");
  resolve([]);
  await pending;
  assert.deepEqual(calls.picks, []);
  assert.equal(calls.messages[0][0], "startupProviderNotFound:missing");
  assert.equal(calls.destroyed, 1);
  assert.deepEqual(calls.busy, [true, false]);
});

test("lookup failure uses the shared error flow and releases busy state", async () => {
  const { controller, calls, reject } = setup();
  const error = new Error("Request failed");
  const pending = controller._preselectProvider("40001111");
  reject(error);
  await pending;
  assert.deepEqual(calls.picks, []);
  assert.equal(calls.error, error);
  assert.equal(calls.popover, true);
  assert.equal(calls.messages[0][0], "startupProviderLookupFailed:40001111");
  assert.equal(calls.destroyed, 1);
  assert.deepEqual(calls.busy, [true, false]);
});

for (const change of ["context", "createMode", "chosen"]) {
  for (const failure of [false, true]) {
    test(`ignores stale ${failure ? "failure" : "result"} after ${change} changes`, async () => {
      const { controller, calls, state, resolve, reject } = setup();
      const pending = controller._preselectProvider("40001111");
      state[change] = change === "context" ? {} : change === "chosen";
      if (failure) {
        reject(new Error("Old request"));
      } else {
        resolve(contexts([provider()]));
      }
      await pending;
      assert.deepEqual(calls.picks, []);
      assert.deepEqual(calls.messages, []);
      assert.equal(calls.error, undefined);
      assert.equal(calls.destroyed, 1);
      assert.deepEqual(calls.busy, change === "context" ? [true] : [true, false]);
    });
  }
}

test("manual suggestion uses the same mapping as route preselection", () => {
  const { controller, calls } = setup();
  const row = provider();
  controller.onProviderSuggestionSelected(event({
    selectedItem: { getBindingContext: () => contexts([row])[0] }
  }));
  assert.deepEqual(calls.picks, [plain(controller._providerRowToPick(row))]);
  controller.onProviderSuggestionSelected(event({}));
  assert.equal(calls.picks.length, 1);
});

test("typed exact match uses shared mapping; ambiguous matches stay invalid", async () => {
  for (const rows of [[provider()], [], [provider(), provider()]]) {
    const { controller, calls, resolve } = setup();
    controller.onProviderChange(event({ value: "40001111" }));
    assert.deepEqual(calls.requests, [[0, 2]]);
    resolve(contexts(rows));
    await new Promise(setImmediate);
    if (rows.length === 1) {
      assert.deepEqual(calls.picks, [plain(controller._providerRowToPick(rows[0]))]);
    } else {
      assert.deepEqual(calls.picks, []);
      assert.equal(calls.valid, false);
    }
  }
});
