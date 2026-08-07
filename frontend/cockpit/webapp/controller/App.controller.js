sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
  "use strict";

  return Controller.extend("cdc.vaccreq.controller.App", {
    onInit: function () {

    	var oViewModel,
				  fnSetAppNotBusy,
				  iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();


			let _self = this,
				_sp = this.getOwnerComponent().getComponentData().startupParameters;
			let _amode = (!!_sp)?_sp.mode || []: [];
			let _mode = (_amode.length>0?_amode[0]:'');
			let _cMode = (_mode==='Approve'?'A':'');
			let _user = sap.ushell.Container.getService('UserInfo');
			let _usrId = _user.getId();

			let _key = "/ContextSet(User='"+_usrId+"',Mode='"+_cMode+"')";

			oViewModel = new JSONModel({
				busy : true,
				delay : 0,
				approveMode : (_mode==='Approve'),
				opmode: '',
				editMode: false,
				reviewer: null,
				itemView: false,
				reqView: false,			
				layout : "OneColumn",
				itemLayout:"",
				bUserExist: true,
				bInputter: false,
				user: _user.getId(),
				fullName: _user.getFullName(),
				// xcsrf: this.getOwnerComponent().getModel().getHeaders()['x-csrf-token'],
				debugUser:'',
				useDebug:false,
				iApprCnt: '0',
				iHistCnt: '0',
				bAdmin:false,
				iCnt: '0',
				importSheet: 'UPLOAD',
				headerRow: 0,
				bMaint: false,
				bConfHeader:false,
				bConfMap:false,
				bSelSheet:false,
				previousLayout : "",
				actionButtonsInfo : {
					midColumn : {
						fullScreen : true
					},
					endColumn : {
						fullScreen : false
					}
				}
			});

			this.getOwnerComponent().setModel(oViewModel, "appView");

			// this.getModel().read(_key, {
			// 	// filters: [new sap.ui.model.Filter('Mode','EQ',_amode)],
			// 	success: function(oData) {

			// 		let _mdl = _self.getModel('appView');

			// 		if(!!oData.bMaint){
			// 			_mdl.setProperty('/bMaint',oData.bMaint);
			// 			_mdl.setProperty('/maintStart',oData.maintStart);
			// 			_mdl.setProperty('/maintEnd',oData.maintEnd);
			// 			_mdl.setProperty('/maintReason',oData.maintReason);
			// 			_mdl.setProperty('/maintContact',oData.maintContact);

			// 			_self.getRouter().getTargets().display("maint");
			// 			return;
			// 		}


			// 		let SheetName = 'UPLOAD',
			// 			HeaderRow = 0,
			// 			bConfHeader = false,
			// 			bConfMap = false,
			// 			bSelSheet = false;


			// 		_mdl.setProperty('/user',oData.User);
			// 		_mdl.setProperty('/iApprCnt',oData.iApprCnt.toString());
			// 		_mdl.setProperty('/iSubmitCnt',oData.iSubmitCnt.toString());
			// 		_mdl.setProperty('/iHistCnt',oData.iHistCnt.toString());
			// 		_mdl.setProperty('/iCnt',oData.iCnt.toString());
			// 		_mdl.setProperty('/bUserExist',oData.bExist);
			// 		_mdl.setProperty('/bInputter',oData.bInputter);
			// 		_mdl.setProperty('/debugUser',oData.DebugUser);
			// 		_mdl.setProperty('/useDebug',(!!oData.DebugUser)?true:false);	
			// 		_mdl.setProperty('/bAdvanced',oData.bAdvanced);	
			// 		_mdl.setProperty('/bAdmin',oData.bAdmin);	
			// 		_mdl.setProperty('/bMaint',oData.bMaint);	
			// 		// let _tabs = this.byId('masterTabBar');
			// 		// if(oData.iApprCnt<=0 && oData.iSubmitCnt>0){
			// 		// 	_tabs.setSelectedKey('submitted');
			// 		// }


			// 		// if(oData.bAdvanced){
			// 			_self._getPersonalization("lmco.ces").then(function (oContainer) {
			// 				if (oContainer) {
			
			// 					SheetName = oContainer.getItemValue('ImportSheet') || 'UPLOAD';
			// 					HeaderRow = parseInt(oContainer.getItemValue('HeaderRow')) || 0;
			// 					bConfHeader = oContainer.getItemValue('ConfirmHeaderRow') || true;
			// 					bConfMap = oContainer.getItemValue('ConfirmMapping') || true;
			// 					bSelSheet = oContainer.getItemValue('SelectSheet') || true;			
			// 					if(bSelSheet) SheetName = '';				
			// 				}
			// 			});	
			// 		// }

			// 		_mdl.setProperty('/importSheet',SheetName);
			// 		_mdl.setProperty('/headerRow',HeaderRow);
			// 		_mdl.setProperty('/bConfHeader',bConfHeader);
			// 		_mdl.setProperty('/bConfMap',bConfMap);
			// 		_mdl.setProperty('/bSelSheet',bSelSheet);
			// 		_mdl.refresh(true);

			// 	},
			// 	fail: function(oError){
			// 	}
			// });

			


			// fnSetAppNotBusy = function() {
			// 	oViewModel.setProperty("/busy", false);
			// 	oViewModel.setProperty("/delay", iOriginalBusyDelay);
			// };

			// this.getOwnerComponent().getModel().metadataLoaded().then(fnSetAppNotBusy);
			// this.getOwnerComponent().getModel().attachMetadataFailed(fnSetAppNotBusy);

			fnSetAppNotBusy = function() {
				oViewModel.setProperty("/busy", false);
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			};

			this.getOwnerComponent().getModel().getMetaModel().requestObject("/").then(fnSetAppNotBusy, fnSetAppNotBusy);

			// apply content density mode to root view
			// this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());

    }
  });
});
