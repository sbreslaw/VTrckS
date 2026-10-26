// copied from frontend/cockpit/webapp/sections/SectionFactory.js @ VTrckS —
// keep in sync until library extraction. 100% generic (no cockpit-specific
// business logic — verified by full read before copying).
sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/m/Panel",
  "sap/m/OverflowToolbar",
  "sap/m/ToolbarSpacer",
  "sap/m/Title",
  "sap/m/Button",
  "sap/m/MessageToast"
], function (Fragment, Panel, OverflowToolbar, ToolbarSpacer, Title, Button, MessageToast) {
  "use strict";

  // `sFlagsModel` (4th ctor arg, defaults to "sectionFlags") lets a panel
  // stack drive its own edit-button visibility off its own flags model.
  // `oMeta.extraHeaderButtons` (an optional array on a SectionConfig-style
  // entry) renders additional disabled, tooltip-only buttons in a section's
  // header toolbar. `oMeta.headerAction` adds an enabled command beside the
  // title, before the spacer, for section-specific workflows.
  // `sOrderUiModel` (6th arg, default "orderUi"; this app passes "returnUi")
  // drives each panel's `visible` from <model>>/sections/<id>/visible
  // (ReturnTypeConfig.js); a view without that model leaves every panel
  // visible. Hidden panels never load their fragment and ignore expandSection.
  function SectionFactory(oView, aMeta, fnOnContentLoaded, sFlagsModel, sContainerId, sOrderUiModel) {
    this._oView = oView;
    this._aMeta = aMeta || [];
    this._mLoaded = {};
    // Notified with (sSectionId, oPanel) once a section's fragment content
    // finishes loading — lets the controller react to a section becoming
    // available regardless of whether it loaded via user expand or a forced
    // rebind-driven expand.
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
      // get no Edit button at all.
      if (oMeta.editable) {
        if (oMeta.editLive) {
          // A real per-section edit session. Edit hides itself once the
          // session starts; Save/Cancel take its place.
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

      // Optional extra disabled, tooltip-only header buttons beyond the
      // standard Edit/Save/Cancel triad — additive, no existing
      // SectionConfig.js entry sets this so nothing else changes.
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
    // that a second call arriving before the async load finishes doesn't
    // kick off a duplicate Fragment.load and add the content twice.
    this._mLoaded[sId] = true;

    var sFragment = oPanel.data("fragment");
    if (!sFragment) {
      return;
    }

    var that = this;
    Fragment.load({
      id: sId,
      name: sFragment,
      controller: this._oView.getController()
    }).then(function (oContent) {
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

  // Keep a section's panel expanded and its content loaded — used after a
  // navigation/anchor press so the right panel is loaded and visible.
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
