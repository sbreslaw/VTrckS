sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/m/Panel",
  "sap/m/OverflowToolbar",
  "sap/m/ToolbarSpacer",
  "sap/m/Title",
  "sap/m/Button",
  "sap/m/MessageToast",
  "cdc/vaccreq/model/ServiceSchema"
], function (Fragment, Panel, OverflowToolbar, ToolbarSpacer, Title, Button, MessageToast, ServiceSchema) {
  "use strict";

  // Item Details view session prompt, Step-0: "prefer parameterizing the
  // existing factory" over a mirror copy. Two additive, backward-compatible
  // parameters were added: `sFlagsModel` (4th ctor arg, defaults to
  // "sectionFlags" so every existing SectionConfig.js/Detail.view.xml caller
  // is unaffected) lets a second panel stack (ItemDetail.view.xml) drive its
  // own edit-button visibility off its own "itemSectionFlags" model instead of
  // colliding with the order Detail view's; `oMeta.extraHeaderButtons` (an
  // optional array on a SectionConfig-style entry) renders additional
  // disabled, tooltip-only buttons in a section's header toolbar (e.g.
  // Shipping's "Alternative Shipping Address" parity button) without a new
  // per-button code path. `oMeta.headerAction` adds an enabled command beside
  // the title, before the spacer, for section-specific workflows such as
  // Inventory's Edit List loader.
  // `sOrderUiModel` (6th arg, default "orderUi") drives each panel's
  // `visible` from <model>>/sections/<id>/visible (OrderModeConfig.js); a view
  // without that model (ItemDetail) leaves every panel visible. Hidden panels
  // never load their fragment and ignore expandSection.
  function SectionFactory(oView, aMeta, fnOnContentLoaded, sFlagsModel, sContainerId, sOrderUiModel) {
    this._oView = oView;
    this._aMeta = aMeta || [];
    this._mLoaded = {};
    // CRUD Task 1 v3 (In-Place Create): notified with (sSectionId, oPanel) once
    // a section's fragment content finishes loading — lets Detail.controller.js
    // react to a section becoming available (e.g. rebind the Items table to the
    // right update group) regardless of whether it loaded via user expand or a
    // forced createMode expand.
    this._fnOnContentLoaded = fnOnContentLoaded;
    this._sFlagsModel = sFlagsModel || "sectionFlags";
    this._sContainerId = sContainerId || "sectionsContainer";
    this._sOrderUiModel = sOrderUiModel || "orderUi";
  }

  SectionFactory.prototype.ensurePanels = function () {
    var oContainer = this._oView.byId(this._sContainerId);
    if (!oContainer || oContainer.getItems().length) {
      return;
    }

    var oBundle = this._oView.getModel("i18n").getResourceBundle();
    var oController = this._oView.getController();
    var sFlags = this._sFlagsModel;
    this._aMeta.forEach(function (oMeta, iIndex) {
      var aToolbarContent = [
          new Title(this._oView.createId(oMeta.id + "-title"), {
            text: oBundle.getText(oMeta.titleKey),
            level: "H2",
            titleStyle: "H4"
          })
      ];

        if (oMeta.headerAction) {
          aToolbarContent.push(new Button(this._oView.createId(oMeta.id + "-" + oMeta.headerAction.id + "-btn"), {
            text: oBundle.getText(oMeta.headerAction.titleKey),
            visible: oMeta.headerAction.createOnly ? "{" + sFlags + ">/createMode}" : true,
            press: function () { oController[oMeta.headerAction.press](); }
          }));
        }
        aToolbarContent.push(new ToolbarSpacer());

      // Non-editable sections (histories, totals, designed-empty placeholders)
      // get no Edit button at all (Phase 2 Prompt v2, item D).
      if (oMeta.editable) {
        if (oMeta.editLive) {
          // CRUD Task 2 (Change Mode): a real per-section edit session. Edit
          // hides itself once the session starts; Save/Cancel take its place.
          // CRUD Task 1 v3: none of these three show at all in createMode —
          // that mode uses the DynamicPage-title Save/Cancel instead (Detail.view.xml).
          aToolbarContent.push(new Button(this._oView.createId(oMeta.id + "-editBtn"), {
            text: oBundle.getText("sectionEdit"),
            visible: {
              parts: [sFlags + ">/" + oMeta.id + "/editVisible", sFlags + ">/" + oMeta.id + "/editing", sFlags + ">/createMode"],
              formatter: function (bVisible, bEditing, bCreateMode) { return !!bVisible && !bEditing && !bCreateMode; }
            },
            enabled: "{" + sFlags + ">/" + oMeta.id + "/editEnabled}",
            press: function () { oController.onSectionEditPress(oMeta.id); }
          }));
          aToolbarContent.push(new Button(this._oView.createId(oMeta.id + "-saveBtn"), {
            text: oBundle.getText("actionSave"),
            type: "Emphasized",
            visible: {
              parts: [sFlags + ">/" + oMeta.id + "/editing", sFlags + ">/createMode"],
              formatter: function (bEditing, bCreateMode) { return !!bEditing && !bCreateMode; }
            },
            press: function () { oController.onSectionSavePress(oMeta.id); }
          }));
          aToolbarContent.push(new Button(this._oView.createId(oMeta.id + "-cancelBtn"), {
            text: oBundle.getText("actionCancel"),
            visible: {
              parts: [sFlags + ">/" + oMeta.id + "/editing", sFlags + ">/createMode"],
              formatter: function (bEditing, bCreateMode) { return !!bEditing && !bCreateMode; }
            },
            press: function () { oController.onSectionCancelPress(oMeta.id); }
          }));
        } else {
          aToolbarContent.push(new Button(this._oView.createId(oMeta.id + "-editBtn"), {
            text: oBundle.getText("sectionEdit"),
            visible: {
              parts: [sFlags + ">/" + oMeta.id + "/editVisible", sFlags + ">/createMode"],
              formatter: function (bVisible, bCreateMode) { return !!bVisible && !bCreateMode; }
            },
            enabled: "{" + sFlags + ">/" + oMeta.id + "/editEnabled}",
            tooltip: oBundle.getText("editAvailableLaterPhase"),
            press: function () {
              MessageToast.show(oBundle.getText("editAvailableLaterPhase"));
            }
          }));
        }
      }

      // Item Details view session prompt: optional extra disabled, tooltip-only
      // header buttons beyond the standard Edit/Save/Cancel triad (e.g.
      // Shipping's "Alternative Shipping Address" parity button) - additive,
      // no existing SectionConfig.js entry sets this so nothing else changes.
      (oMeta.extraHeaderButtons || []).forEach(function (oBtnMeta) {
        aToolbarContent.push(new Button(this._oView.createId(oMeta.id + "-" + oBtnMeta.id + "-btn"), {
          text: oBundle.getText(oBtnMeta.titleKey),
          enabled: false,
          tooltip: oBundle.getText(oBtnMeta.tooltipKey || "editAvailableLaterPhase")
        }));
      }, this);

      var oToolbar = new OverflowToolbar({ content: aToolbarContent });
      oToolbar.addStyleClass("detailSectionToolbar");

      var oPanel = new Panel(this._oView.createId(oMeta.id), {
        headerToolbar: oToolbar,
        expandable: true,
        expanded: iIndex === 0 || !!oMeta.expanded,
        visible: {
          path: this._sOrderUiModel + ">/sections/" + oMeta.id + "/visible",
          formatter: function (bVisible) { return bVisible !== false; }
        },
        expand: this._oView.getController().onExpandPanel.bind(this._oView.getController())
      });
      oPanel.addStyleClass("detailSectionPanel");

      oPanel.data("fragment", oMeta.fragment);
      oContainer.addItem(oPanel);

      if (oPanel.getExpanded()) {
        this.ensurePanelContent(oPanel);
      }
    }, this);
  };

  SectionFactory.prototype.ensurePanelContent = function (oPanel) {
    var sId = oPanel.getId();
    if (this._mLoaded[sId] || !oPanel.getVisible()) {
      return;
    }
    // Mark as loading immediately (not just after Fragment.load resolves) so
    // that a second call arriving before the async load finishes (e.g. from
    // onAfterRendering and _onObjectMatched/rebind racing each other) doesn't
    // kick off a duplicate Fragment.load and add the content twice.
    this._mLoaded[sId] = true;

    var sFragment = oPanel.data("fragment");
    if (!sFragment) {
      return;
    }

    var that = this;
    this._loadFragment(sId, sFragment).then(function (oContent) {
      // Fragments with more than one root control (e.g. a form plus a sibling
      // MessageStrip) resolve with an array - addContent only accepts one
      // control at a time.
      (Array.isArray(oContent) ? oContent : [oContent]).forEach(function (oControl) {
        oPanel.addContent(oControl);
      });
      if (that._fnOnContentLoaded) {
        that._fnOnContentLoaded(that._oView.getLocalId(sId) || sId, oPanel);
      }
    });
  };

  // ADR-002 (Returns_Single_App_Service_Profile) decision 3: a handful of
  // sections (today: "details", "items") contain a few literal OData property
  // names that differ between service profiles (e.g. {SalesOrder} vs
  // {CustomerReturn}) and cannot be fixed by an orderUi visible toggle alone
  // (Form FormElement visibility, unlike sap.m.Table column visibility, does
  // NOT exclude the bound property from autoExpandSelect's $select). For
  // those, the profile declares its own variant under a `<profileId>/`
  // subfolder (e.g. `sections/returns/Details.fragment.xml`); every other
  // profile (today: "orders") has no variant file and keeps using the
  // shared `<name>.fragment.xml`. Fragment.load's resource fetch fails
  // (404) BEFORE any control is instantiated, so retrying with the base
  // name after a rejected variant load is safe - no partial/colliding
  // controls are left behind under the shared `id: sId` prefix.
  // NOTE: Fragment.load's `name` resolves EVERY "." in the string to a "/"
  // (module-path convention) - a variant suffix cannot be appended as a
  // literal dot onto the existing dotted name (that previously produced
  // ".../sections/Items/returns.fragment.xml", a 404 - confirmed live). The
  // profile id must be its own path SEGMENT, inserted before the last one.
  SectionFactory.prototype._loadFragment = function (sId, sFragment) {
    var oController = this._oView.getController();
    var sProfileId = ServiceSchema.profileId;
    if (!sProfileId || sProfileId === "orders") {
      return Fragment.load({ id: sId, name: sFragment, controller: oController });
    }
    var iLastDot = sFragment.lastIndexOf(".");
    var sVariantName = sFragment.slice(0, iLastDot) + "." + sProfileId + sFragment.slice(iLastDot);
    return Fragment.load({ id: sId, name: sVariantName, controller: oController })
      .catch(function () {
        return Fragment.load({ id: sId, name: sFragment, controller: oController });
      });
  };

  SectionFactory.prototype.rebind = function () {
    var oContainer = this._oView.byId(this._sContainerId);
    if (!oContainer) {
      return;
    }
    oContainer.getItems().forEach(function (oPanel) {
      if (oPanel.getExpanded()) {
        this.ensurePanelContent(oPanel);
      }
    }, this);
  };

  // CRUD Task 2 (Change Mode): keep a section's panel expanded and its content
  // loaded \u2014 used after a failed Save so a panel-anchored message stays visible.
  // In practice the editing section is already expanded (Save only fires from
  // within it), but this keeps the behavior explicit for future callers.
  SectionFactory.prototype.expandSection = function (sSectionId) {
    var oPanel = this._oView.byId(sSectionId);
    if (!oPanel || !oPanel.getVisible()) {
      return;
    }
    oPanel.setExpanded(true);
    this.ensurePanelContent(oPanel);
  };

  return SectionFactory;
});
