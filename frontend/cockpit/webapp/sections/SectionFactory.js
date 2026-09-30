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
  // per-button code path.
  function SectionFactory(oView, aMeta, fnOnContentLoaded, sFlagsModel) {
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
  }

  SectionFactory.prototype.ensurePanels = function () {
    var oContainer = this._oView.byId("sectionsContainer");
    if (!oContainer || oContainer.getItems().length) {
      return;
    }

    var oBundle = this._oView.getModel("i18n").getResourceBundle();
    var oController = this._oView.getController();
    var sFlags = this._sFlagsModel;
    this._aMeta.forEach(function (oMeta, iIndex) {
      var aToolbarContent = [
        new Title(this._oView.createId(oMeta.id + "-title"), { text: oBundle.getText(oMeta.titleKey), level: "H4" }),
        new ToolbarSpacer()
      ];

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
            visible: "{" + sFlags + ">/" + oMeta.id + "/editVisible}",
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

      var oPanel = new Panel(this._oView.createId(oMeta.id), {
        headerToolbar: oToolbar,
        expandable: true,
        expanded: iIndex === 0 || !!oMeta.expanded,
        // CRUD Task 1 v3: sections not flagged createVisible in SectionConfig.js
        // are hidden entirely while createMode is on (design/prompts/CRUD Task 1
        // Prompt v3.md "All other sections: hidden ... per SectionConfig flag").
        visible: {
          path: sFlags + ">/createMode",
          formatter: function (bCreateMode) { return !bCreateMode || !!oMeta.createVisible; }
        },
        expand: this._oView.getController().onExpandPanel.bind(this._oView.getController())
      });

      oPanel.data("fragment", oMeta.fragment);
      oContainer.addItem(oPanel);

      if (oPanel.getExpanded()) {
        this.ensurePanelContent(oPanel);
      }
    }, this);
  };

  SectionFactory.prototype.ensurePanelContent = function (oPanel) {
    var sId = oPanel.getId();
    if (this._mLoaded[sId]) {
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
    var oContainer = this._oView.byId("sectionsContainer");
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
    if (!oPanel) {
      return;
    }
    oPanel.setExpanded(true);
    this.ensurePanelContent(oPanel);
  };

  return SectionFactory;
});
