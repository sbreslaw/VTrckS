sap.ui.define([
  "sap/ui/core/Fragment",
  "sap/m/Panel",
  "sap/m/OverflowToolbar",
  "sap/m/Title",
  "sap/m/Button",
  "sap/m/Text"
], function (Fragment, Panel, OverflowToolbar, Title, Button, Text) {
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
      var oToolbar = new OverflowToolbar({
        content: [
          new Title({ text: oBundle.getText(oMeta.titleKey), level: "H4" }),
          new Text({ text: "" }),
          new Button({
            text: oBundle.getText("mvp2Action"),
            enabled: false,
            tooltip: oBundle.getText("mvp2Only")
          })
        ]
      });

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
