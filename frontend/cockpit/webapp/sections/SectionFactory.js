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

  function SectionFactory(oView, aMeta) {
    this._oView = oView;
    this._aMeta = aMeta || [];
    this._mLoaded = {};
  }

  SectionFactory.prototype.ensurePanels = function () {
    var oContainer = this._oView.byId("sectionsContainer");
    if (!oContainer || oContainer.getItems().length) {
      return;
    }

    var oBundle = this._oView.getModel("i18n").getResourceBundle();
    this._aMeta.forEach(function (oMeta, iIndex) {
      var aToolbarContent = [
        new Title({ text: oBundle.getText(oMeta.titleKey), level: "H4" }),
        new ToolbarSpacer()
      ];

      // Non-editable sections (histories, totals, designed-empty placeholders)
      // get no Edit button at all (Phase 2 Prompt v2, item D).
      if (oMeta.editable) {
        aToolbarContent.push(new Button(this._oView.createId(oMeta.id + "-editBtn"), {
          text: oBundle.getText("sectionEdit"),
          visible: "{sectionFlags>/" + oMeta.id + "/editVisible}",
          enabled: "{sectionFlags>/" + oMeta.id + "/editEnabled}",
          press: function () {
            MessageToast.show(oBundle.getText("editAvailableLaterPhase"));
          }
        }));
      }

      var oToolbar = new OverflowToolbar({ content: aToolbarContent });

      var oPanel = new Panel(this._oView.createId(oMeta.id), {
        headerToolbar: oToolbar,
        expandable: true,
        expanded: iIndex === 0 || !!oMeta.expanded,
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

    Fragment.load({
      id: sId,
      name: sFragment,
      controller: this._oView.getController()
    }).then(function (oContent) {
      oPanel.addContent(oContent);
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

  return SectionFactory;
});
