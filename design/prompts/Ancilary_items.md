app: SalesOrder-manageV2
SalesOrder-manageV2&/SalesOrderManage(%27%27)

Standard Sales Order Manage app V2. 
User Exit implemented and perform various functions on product entry:
- adjust quantities (100 to 140)
- insert ancillary items

- Odata batch calls:
##1 - PAYLOAD --batch_id-1790190641863-6089
Content-Type:application/http
Content-Transfer-Encoding:binary

POST SalesOrderManage('')/_Item?sap-client=300 HTTP/1.1
Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true
Accept-Language:en-US
SAP-ContextId:SID:ANON:sapapp2dh1_DH1_00:Rj5Ac9BTyfZJYNMqNBg1YPZzCtOrEH1pV0aPnoAX-ATT
Content-Type:application/json;charset=UTF-8;IEEE754Compatible=true

{"Product":"80777-0273-98","RequestedQuantityUnit":"DOS","MaterialGroup1":"PED","MaterialGroup2":"VFC","RequestedQuantity":"100"}
--batch_id-1790190641863-6089--
Group ID: $auto

##1 -- RESPONSE --18EAC9907F49222513BFD1167127EB550
Content-Type: application/http
Content-Length: 5088
content-transfer-encoding: binary

HTTP/1.1 201 Created
Content-Type: application/json;ieee754compatible=true;odata.metadata=minimal
Content-Length: 4828
location: ../SalesOrderItem(SalesOrder='',SalesOrderItem='10')
odata-version: 4.0
cache-control: no-cache, no-store, must-revalidate

{"@odata.context":"../$metadata#SalesOrderItem/$entity","@odata.metadataEtag":"W/\"20260911190145\"","#com.sap.gateway.srvd.c_salesordermanage_sd.v0001.CreatePartner":{},"#com.sap.gateway.srvd.c_salesordermanage_sd.v0001.CreatePricingElement":{},"#com.sap.gateway.srvd.c_salesordermanage_sd.v0001.EnableBillingPlan":{},"#com.sap.gateway.srvd.c_salesordermanage_sd.v0001.SetBillingBlock":{},"#com.sap.gateway.srvd.c_salesordermanage_sd.v0001.SetRejectionReason":{},"#com.sap.gateway.srvd.c_salesordermanage_sd.v0001.UpdatePrices":{},"SalesOrder":"","SalesOrderItem":"10","HigherLevelItem":null,"SalesOrderItemCategory":"ZKBN","SalesOrderItemText":"COV-19 ; MDV14; 10-pack","Product":"80777-0273-98","ProductGroup":"158","CustomerGroup":"","MaterialByCustomer":"","PurchaseOrderByCustomer":"","InternationalArticleNumber":"","RequestedDeliveryDate":"2026-09-23","ConfirmedDeliveryDate":"2026-09-23","ConfdDelivQtyInOrderQtyUnit":"100","OrderQuantityUnit":"DOS","RequestedQuantity":"140","RequestedQuantityUnit":"DOS","ItemGrossWeight":"0.000","ItemNetWeight":"0.000","ItemWeightUnit":"KG","ItemVolume":"0.000","ItemVolumeUnit":"","PricingDate":"2026-09-23","ServicesRenderedDate":null,"BillingDocumentDate":"2026-09-23","Batch":"","Plant":"1062","ValueChainCategory":"","TransitPlant":"","FinancialChain":"0","PlantIsTransitPlant":true,"ValueChainIsFinChainHidden":true,"StorageLocation":"","ShippingPoint":"1000","ShippingType":"","Route":"","DeliveryPriority":"0","PartialDeliveryIsAllowed":"","MaxNmbrOfPartialDelivery":"0","DeliveryGroup":"0","DeliveryDateQuantityIsFixed":false,"DeliveryDateTypeRule":"","ReceivingPoint":"","IncotermsClassification":"","IncotermsLocation1":"","IncotermsLocation2":"","OrderCombinationIsAllowed":false,"IncotermsVersion":"","CustomerPaymentTerms":"","CustomerPriceGroup":"","MaterialPricingGroup":"","ItemBillingBlockReason":"","SalesDocumentRjcnReason":"","TransactionCurrency":"USD","NetAmount":"0.00","TaxAmount":"0.00","ProfitCenter":"","ProfitCenterName":"","ControllingArea":"1000","WBSElementExternalID":"","MatlAccountAssignmentGroup":"","BusinessArea":"","SDPricingProcedure":"ZRVCDC","ItemCategoryGroup":"NORM","SDDocumentItemUsage":"","HigherLevelItemCategory":"","MRPTpFltrForSlsDocSchdLnCatVH":"","PartnerDeterminationProcedure":"N","SDProcessStatus":"A","SDDocumentRejectionStatus":"A","SDDocRejectionStsCriticality":3,"DeliveryStatus":"A","DeliveryStatusCriticality":0,"BillingBlockStatus":"","BillingBlockStatusCriticality":0,"ItemGeneralIncompletionStatus":"C","ItmGenIncompltnStsCriticality":3,"DeliveryBlockStatus":"","DeliveryBlockStatusCriticality":0,"ChmlCmplncStatus":"","ChmlCmplncStsCriticality":0,"DangerousGoodsStatus":"","DngrsGdsStsCriticality":0,"SafetyDataSheetStatus":"","SftyDataShtStatCriticality":0,"TrdCmplncEmbargoStsCritlty":0,"TrdCmplncSnctndListCritlty":0,"OvrlTrdCmplncLglCtrlStsCritlty":0,"OrderRelatedBillingStatus":"","OrderRelatedBillingStsCritlty":0,"SlsOrderItemDownPaymentStatus":"","ItemDownPaymentStatusCritlty":0,"UICT_ItemDownPaymentStatus":true,"UICT_OrderRelatedBillingStatus":true,"UICT_BillingPlanType":true,"UICT_ScheduleLine":false,"TrdCmplncEmbargoSts":"","TrdCmplncSnctndListChkSts":"","OvrlTrdCmplncLegalCtrlChkSts":"","SalesOrderType":"ZKB","SalesOrganization":"1000","MaterialGroup1":"PED","MaterialGroup2":"VFC","MaterialGroup3":"","MaterialGroup4":"","MaterialGroup5":"","ZZIndustryStandardName":"","ZZVFCQTY":0,"ZZ317QTY":0,"ZZSTATEQTY":0,"ZZCHIPQTY":0,"ZZPANQTY":0,"ZZRESQTY":0,"ZZ1_SKIPADDANC_SDI":false,"ZZ1_SKIPANC":true,"ZZ1_OptOutAncillary_SDI":false,"__CreateByAssociationControl":{"_ItemText":true,"_ScheduleLine":true},"__EntityControl":{"Deletable":true,"Updatable":true},"__FieldControl":{"Batch":3,"BillingDocumentDate":3,"CustomerPaymentTerms":3,"CustomerPriceGroup":3,"DeliveryDateQuantityIsFixed":3,"DeliveryDateTypeRule":1,"DeliveryGroup":3,"DeliveryPriority":3,"HigherLevelItem":3,"IncotermsClassification":3,"IncotermsLocation1":3,"IncotermsLocation2":1,"ItemGrossWeight":1,"ItemNetWeight":1,"ItemVolume":1,"ItemVolumeUnit":1,"ItemWeightUnit":1,"MaterialByCustomer":3,"MaterialPricingGroup":3,"MaxNmbrOfPartialDelivery":3,"OrderCombinationIsAllowed":3,"PartialDeliveryIsAllowed":3,"Plant":3,"PricingDate":3,"Product":1,"ProductGroup":3,"ProfitCenter":3,"PurchaseOrderByCustomer":3,"ReceivingPoint":3,"RequestedDeliveryDate":3,"RequestedQuantity":3,"RequestedQuantityUnit":3,"Route":3,"SalesOrderItemCategory":3,"SalesOrderItemText":3,"ServicesRenderedDate":3,"ShippingPoint":3,"ShippingType":3,"StorageLocation":3,"WBSElementExternalID":3},"__OperationControl":{"CreatePartner":true,"CreatePricingElement":true,"EnableBillingPlan":true,"RemoveBillingBlock":false,"RemoveBillingPlan":false,"RemoveRejectionReason":false,"SetBillingBlock":true,"SetRejectionReason":true,"UpdatePrices":true},"SAP__Messages":[]}
--18EAC9907F49222513BFD1167127EB550--


##2. - PaYLOAD --batch_id-1790190642284-6090
Content-Type:application/http
Content-Transfer-Encoding:binary

GET SalesOrderManage('')/_Item(SalesOrder='',SalesOrderItem='10')?sap-client=300&$select=_ItemCategory&$expand=_ItemCategory($select=SalesDocumentItemCategory,SalesDocumentItemCategory_Text),_Product($select=Product,Product_Text) HTTP/1.1
Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true
Accept-Language:en-US
SAP-ContextId:SID:ANON:sapapp2dh1_DH1_00:Rj5Ac9BTyfZJYNMqNBg1YPZzCtOrEH1pV0aPnoAX-ATT
Content-Type:application/json;charset=UTF-8;IEEE754Compatible=true

--batch_id-1790190642284-6090--
Group ID: $auto.Workers

##2 -- RESPONSE --F4349540A3309F6BF4D2A3538B415C540
Content-Type: application/http
Content-Length: 662
content-transfer-encoding: binary

HTTP/1.1 200 OK
Content-Type: application/json;ieee754compatible=true;odata.metadata=minimal
Content-Length: 472
odata-version: 4.0
cache-control: no-cache, no-store, must-revalidate

{"@odata.context":"../$metadata#SalesOrderItem(_ItemCategory,SalesOrder,SalesOrderItem,_ItemCategory(SalesDocumentItemCategory,SalesDocumentItemCategory_Text),_Product(Product,Product_Text))/$entity","@odata.metadataEtag":"W/\"20260911190145\"","SalesOrder":"","SalesOrderItem":"10","_ItemCategory":{"SalesDocumentItemCategory":"ZKBN","SalesDocumentItemCategory_Text":"Vaccine Request Item"},"_Product":{"Product":"80777-0273-98","Product_Text":"COV-19 ; MDV14; 10-pack"}}
--F4349540A3309F6BF4D2A3538B415C540--



##3. - PAYLOAD --batch_id-1790190642379-6103
Content-Type:application/http
Content-Transfer-Encoding:binary

GET SalesOrderManage('')?sap-client=300&$select=BillingDocumentDate,CompleteDeliveryIsDefined,CreatedByUser,CustomerGroup,CustomerName,CustomerPaymentTerms,CustomerPriceGroup,DistributionChannel,IncotermsClassification,IncotermsLocation1,IncotermsLocation2,IncotermsVersion,LastChangeDateTime,LastChangedByUser,NumberOfAttachments,OrderCombinationIsAllowed,OrganizationDivision,OverallSDProcessStatus,PaymentMethod,PriceListType,PricingDate,PurchaseOrderByCustomer,ReferenceDistributionChannel,RequestedDeliveryDate,SAP__Messages,SDDocumentReason,SDPricingProcedure,SalesDistrict,SalesDocumentCreationDateTime,SalesGroup,SalesOffice,SalesOrder,SalesOrderDate,SalesOrderType,SalesOrganization,ServicesRenderedDate,ShippingCondition,SlsDocOvrlGenIncompltnStsText,SlsDocOvrlIncompltnStsCritlty,SoldToParty,TotalBlockStatus,TotalBlockStatusCriticality,TotalNetAmount,TransactionCurrency,UICT_BillingPlan,UICT_BillingPlanType,UICT_CreateDlvFromSalesDoc,UICT_CustomerCreditLimitAmount,UICT_LastChangeDateTime,UICT_LegacyOutputCntrl,UICT_OutputRequestUUID,UICT_WithdrawFromApproval,__CreateByAssociationControl/_Item,__EntityControl/Updatable,__FieldControl/BillingDocumentDate,__FieldControl/CustomerPaymentTerms,__FieldControl/DistributionChannel,__FieldControl/IncotermsClassification,__FieldControl/IncotermsLocation1,__FieldControl/IncotermsLocation2,__FieldControl/IncotermsVersion,__FieldControl/OrderCombinationIsAllowed,__FieldControl/OrganizationDivision,__FieldControl/PaymentMethod,__FieldControl/PricingDate,__FieldControl/SalesOrganization,__FieldControl/ServicesRenderedDate,__FieldControl/SoldToParty,__FieldControl/TransactionCurrency,__OperationControl/ActivateIncompletenessInfo,__OperationControl/CreatePartner,__OperationControl/PrepareForEdit,__OperationControl/ProposeItems,__OperationControl/RemoveBillingBlock,__OperationControl/RemoveDeliveryBlock,__OperationControl/SetBillingBlock,__OperationControl/SetDeliveryBlock,__OperationControl/SetRejectionReasonToAllItems,__OperationControl/UpdatePrices,__OperationControl/WithdrawFromApproval&$expand=_CreatedByUser($select=UserDescription,UserID),_CustomerGroup($select=CustomerGroup,CustomerGroup_Text),_CustomerPaymentTerms($select=CustomerPaymentTerms,CustomerPaymentTerms_Text),_CustomerPriceGroup($select=CustomerPriceGroup,CustomerPriceGroup_Text),_DistributionChannel($select=DistributionChannel,DistributionChannel_Text),_IncotermsClassification($select=IncotermsClassification,IncotermsClassification_Text),_IncotermsVersion($select=IncotermsVersion,IncotermsVersion_Text),_LastChangedByUser($select=UserDescription,UserID),_OrganizationDivision($select=Division,Division_Text),_OverallSDProcessStatus($select=OverallSDProcessStatus,OverallSDProcessStatus_Text),_PaymentMethodVH($select=BillingCompanyCode,PaymentMethod,PaymentMethodDescription),_PriceListType($select=PriceListType,PriceListType_Text),_SDDocumentReason($select=SDDocumentReason,SDDocumentReason_Text),_SDPricingProcedure($select=PricingProcedure,PricingProcedure_Text),_SalesDistrict($select=SalesDistrict,SalesDistrict_Text),_SalesGroup($select=SalesGroup,SalesGroup_Text),_SalesOffice($select=SalesOffice,SalesOffice_Text),_SalesOrderType($select=SalesOrderType,SalesOrderType_Text),_SalesOrganization($select=SalesOrganization,SalesOrganization_Text),_ShippingCondition($select=ShippingCondition,ShippingCondition_Text),_TotalBlockStatus($select=TotalBlockStatus,TotalBlockStatus_Text),_TransactionCurrency($select=Currency,Currency_Text) HTTP/1.1
Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true
Accept-Language:en-US
SAP-ContextId:SID:ANON:sapapp2dh1_DH1_00:Rj5Ac9BTyfZJYNMqNBg1YPZzCtOrEH1pV0aPnoAX-ATT
Content-Type:application/json;charset=UTF-8;IEEE754Compatible=true


--batch_id-1790190642379-6103
Content-Type:application/http
Content-Transfer-Encoding:binary

GET SalesOrderManage('')?sap-client=300&$select=SalesOrder HTTP/1.1
Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true
Accept-Language:en-US
SAP-ContextId:SID:ANON:sapapp2dh1_DH1_00:Rj5Ac9BTyfZJYNMqNBg1YPZzCtOrEH1pV0aPnoAX-ATT
Content-Type:application/json;charset=UTF-8;IEEE754Compatible=true


--batch_id-1790190642379-6103
Content-Type:application/http
Content-Transfer-Encoding:binary

GET SalesOrderManage('')/_Item?sap-client=300&$count=true&$select=ConfdDelivQtyInOrderQtyUnit,ConfirmedDeliveryDate,HigherLevelItem,MaterialGroup1,MaterialGroup2,NetAmount,OrderQuantityUnit,Product,RequestedDeliveryDate,RequestedQuantity,RequestedQuantityUnit,SalesOrder,SalesOrderItem,SalesOrderItemCategory,SalesOrderItemText,TransactionCurrency,UICT_ScheduleLine,ZZ1_SKIPADDANC_SDI,__EntityControl/Deletable,__EntityControl/Updatable,__FieldControl/HigherLevelItem,__FieldControl/Product,__FieldControl/RequestedQuantity,__FieldControl/RequestedQuantityUnit,__FieldControl/SalesOrderItemCategory,__OperationControl/EnableBillingPlan,__OperationControl/RemoveBillingBlock,__OperationControl/RemoveBillingPlan,__OperationControl/RemoveRejectionReason,__OperationControl/SetBillingBlock,__OperationControl/SetRejectionReason,__OperationControl/UpdatePrices&$orderby=SalesOrderItem&$expand=_ItemCategory($select=SalesDocumentItemCategory,SalesDocumentItemCategory_Text),_Product($select=Product,Product_Text)&$skip=0&$top=153 HTTP/1.1
Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true
Accept-Language:en-US
SAP-ContextId:SID:ANON:sapapp2dh1_DH1_00:Rj5Ac9BTyfZJYNMqNBg1YPZzCtOrEH1pV0aPnoAX-ATT
Content-Type:application/json;charset=UTF-8;IEEE754Compatible=true


--batch_id-1790190642379-6103--
Group ID: $auto

## -- RESPONSE ----88DE677C023A23C662FB1AEBCA96C3780
Content-Type: application/http
Content-Length: 7471
content-transfer-encoding: binary

HTTP/1.1 200 OK
Content-Type: application/json;ieee754compatible=true;odata.metadata=minimal
Content-Length: 7231
odata-version: 4.0
etag: W/"SADL-000000000000000000000C~0.0000000"
cache-control: no-cache, no-store, must-revalidate

{"@odata.context":"$metadata#SalesOrderManage(BillingDocumentDate,CompleteDeliveryIsDefined,CreatedByUser,CustomerGroup,CustomerName,CustomerPaymentTerms,CustomerPriceGroup,DistributionChannel,IncotermsClassification,IncotermsLocation1,IncotermsLocation2,IncotermsVersion,LastChangeDateTime,LastChangedByUser,NumberOfAttachments,OrderCombinationIsAllowed,OrganizationDivision,OverallSDProcessStatus,PaymentMethod,PriceListType,PricingDate,PurchaseOrderByCustomer,ReferenceDistributionChannel,RequestedDeliveryDate,SAP__Messages,SDDocumentReason,SDPricingProcedure,SalesDistrict,SalesDocumentCreationDateTime,SalesGroup,SalesOffice,SalesOrder,SalesOrderDate,SalesOrderType,SalesOrganization,ServicesRenderedDate,ShippingCondition,SlsDocOvrlGenIncompltnStsText,SlsDocOvrlIncompltnStsCritlty,SoldToParty,TotalBlockStatus,TotalBlockStatusCriticality,TotalNetAmount,TransactionCurrency,UICT_BillingPlan,UICT_BillingPlanType,UICT_CreateDlvFromSalesDoc,UICT_CustomerCreditLimitAmount,UICT_LastChangeDateTime,UICT_LegacyOutputCntrl,UICT_OutputRequestUUID,UICT_WithdrawFromApproval,__CreateByAssociationControl/_Item,__EntityControl/Updatable,__FieldControl/BillingDocumentDate,__FieldControl/CustomerPaymentTerms,__FieldControl/DistributionChannel,__FieldControl/IncotermsClassification,__FieldControl/IncotermsLocation1,__FieldControl/IncotermsLocation2,__FieldControl/IncotermsVersion,__FieldControl/OrderCombinationIsAllowed,__FieldControl/OrganizationDivision,__FieldControl/PaymentMethod,__FieldControl/PricingDate,__FieldControl/SalesOrganization,__FieldControl/ServicesRenderedDate,__FieldControl/SoldToParty,__FieldControl/TransactionCurrency,__OperationControl/ActivateIncompletenessInfo,__OperationControl/CreatePartner,__OperationControl/PrepareForEdit,__OperationControl/ProposeItems,__OperationControl/RemoveBillingBlock,__OperationControl/RemoveDeliveryBlock,__OperationControl/SetBillingBlock,__OperationControl/SetDeliveryBlock,__OperationControl/SetRejectionReasonToAllItems,__OperationControl/UpdatePrices,__OperationControl/WithdrawFromApproval,_CreatedByUser(UserDescription,UserID),_CustomerGroup(CustomerGroup,CustomerGroup_Text),_CustomerPaymentTerms(CustomerPaymentTerms,CustomerPaymentTerms_Text),_CustomerPriceGroup(CustomerPriceGroup,CustomerPriceGroup_Text),_DistributionChannel(DistributionChannel,DistributionChannel_Text),_IncotermsClassification(IncotermsClassification,IncotermsClassification_Text),_IncotermsVersion(IncotermsVersion,IncotermsVersion_Text),_LastChangedByUser(UserDescription,UserID),_OrganizationDivision(Division,Division_Text),_OverallSDProcessStatus(OverallSDProcessStatus,OverallSDProcessStatus_Text),_PaymentMethodVH(BillingCompanyCode,PaymentMethod,PaymentMethodDescription),_PriceListType(PriceListType,PriceListType_Text),_SDDocumentReason(SDDocumentReason,SDDocumentReason_Text),_SDPricingProcedure(PricingProcedure,PricingProcedure_Text),_SalesDistrict(SalesDistrict,SalesDistrict_Text),_SalesGroup(SalesGroup,SalesGroup_Text),_SalesOffice(SalesOffice,SalesOffice_Text),_SalesOrderType(SalesOrderType,SalesOrderType_Text),_SalesOrganization(SalesOrganization,SalesOrganization_Text),_ShippingCondition(ShippingCondition,ShippingCondition_Text),_TotalBlockStatus(TotalBlockStatus,TotalBlockStatus_Text),_TransactionCurrency(Currency,Currency_Text))/$entity","@odata.metadataEtag":"W/\"20260911190145\"","@odata.etag":"W/\"SADL-000000000000000000000C~0.0000000\"","SalesOrder":"","SalesOrderType":"ZKB","SoldToParty":"40029638","CustomerName":"MILWAUKEE FAMILY PRACTICE","SalesOrganization":"1000","DistributionChannel":"10","ReferenceDistributionChannel":"10","OrganizationDivision":"10","SalesOffice":"162","SalesGroup":"","SalesDistrict":"","SalesOrderDate":"2026-09-23","PurchaseOrderByCustomer":"","CustomerGroup":"","SDDocumentReason":"","PricingDate":"2026-09-23","ServicesRenderedDate":null,"BillingDocumentDate":"2026-09-23","SDPricingProcedure":"ZRVCDC","CustomerPriceGroup":"","PriceListType":"","RequestedDeliveryDate":"2026-09-23","ShippingCondition":"01","CompleteDeliveryIsDefined":false,"OrderCombinationIsAllowed":false,"IncotermsClassification":"","IncotermsVersion":"","IncotermsLocation1":"","IncotermsLocation2":"","CustomerPaymentTerms":"","PaymentMethod":"","TotalNetAmount":"0.00","TransactionCurrency":"USD","OverallSDProcessStatus":"A","TotalBlockStatus":"","TotalBlockStatusCriticality":3,"SlsDocOvrlGenIncompltnStsText":"Incomplete","SlsDocOvrlIncompltnStsCritlty":1,"LastChangeDateTime":null,"CreatedByUser":"BU77","SalesDocumentCreationDateTime":"2026-09-23T19:09:33Z","LastChangedByUser":"","UICT_BillingPlanType":true,"UICT_BillingPlan":true,"UICT_OutputRequestUUID":true,"UICT_CustomerCreditLimitAmount":true,"UICT_LastChangeDateTime":true,"UICT_WithdrawFromApproval":true,"NumberOfAttachments":0,"UICT_CreateDlvFromSalesDoc":false,"UICT_LegacyOutputCntrl":true,"__CreateByAssociationControl":{"_Item":true},"__EntityControl":{"Updatable":true},"__FieldControl":{"BillingDocumentDate":3,"CustomerPaymentTerms":3,"DistributionChannel":1,"IncotermsClassification":3,"IncotermsLocation1":3,"IncotermsLocation2":1,"IncotermsVersion":3,"OrderCombinationIsAllowed":3,"OrganizationDivision":1,"PaymentMethod":3,"PricingDate":3,"SalesOrganization":1,"ServicesRenderedDate":3,"SoldToParty":7,"TransactionCurrency":3},"__OperationControl":{"ActivateIncompletenessInfo":true,"CreatePartner":true,"PrepareForEdit":true,"ProposeItems":false,"RemoveBillingBlock":false,"RemoveDeliveryBlock":false,"SetBillingBlock":true,"SetDeliveryBlock":true,"SetRejectionReasonToAllItems":true,"UpdatePrices":true,"WithdrawFromApproval":false},"SAP__Messages":[{"code":"V1/028","message":"Material 11111-0011-02 has status: Discontd w/o Replace","target":"","additionalTargets":[],"transition":false,"numericSeverity":3,"longtextUrl":null},{"code":"V1/028","message":"Material 11111-0011-01 has status: Discontd w/o Replace","target":"","additionalTargets":[],"transition":false,"numericSeverity":3,"longtextUrl":null}],"_CreatedByUser":{"UserID":"BU77","UserDescription":""},"_CustomerGroup":null,"_CustomerPaymentTerms":{"CustomerPaymentTerms":"","CustomerPaymentTerms_Text":""},"_CustomerPriceGroup":null,"_DistributionChannel":{"DistributionChannel":"10","DistributionChannel_Text":"VTrckS Dist. Channel"},"_IncotermsClassification":null,"_IncotermsVersion":null,"_LastChangedByUser":null,"_OrganizationDivision":{"Division":"10","Division_Text":"VTrckS Division"},"_OverallSDProcessStatus":{"OverallSDProcessStatus":"A","OverallSDProcessStatus_Text":"Open"},"_PaymentMethodVH":null,"_PriceListType":null,"_SalesDistrict":null,"_SalesGroup":null,"_SalesOffice":{"SalesOffice":"162","SalesOffice_Text":"Wisconsin"},"_SalesOrderType":{"SalesOrderType":"ZKB","SalesOrderType_Text":"Provider Order"},"_SalesOrganization":{"SalesOrganization":"1000","SalesOrganization_Text":"VTrckS Sales Org"},"_SDDocumentReason":null,"_SDPricingProcedure":{"PricingProcedure":"ZRVCDC","PricingProcedure_Text":"CDC Standard (New Split)"},"_ShippingCondition":{"ShippingCondition":"01","ShippingCondition_Text":"Standard - Mail"},"_TotalBlockStatus":{"TotalBlockStatus":"","TotalBlockStatus_Text":"Not Blocked"},"_TransactionCurrency":{"Currency":"USD","Currency_Text":"United States Dollar"}}
--88DE677C023A23C662FB1AEBCA96C3780
Content-Type: application/http
Content-Length: 427
content-transfer-encoding: binary

HTTP/1.1 200 OK
Content-Type: application/json;ieee754compatible=true;odata.metadata=minimal
Content-Length: 188
odata-version: 4.0
etag: W/"SADL-000000000000000000000C~0.0000000"
cache-control: no-cache, no-store, must-revalidate

{"@odata.context":"$metadata#SalesOrderManage(SalesOrder)/$entity","@odata.metadataEtag":"W/\"20260911190145\"","@odata.etag":"W/\"SADL-000000000000000000000C~0.0000000\"","SalesOrder":""}
--88DE677C023A23C662FB1AEBCA96C3780
Content-Type: application/http
Content-Length: 4481
content-transfer-encoding: binary

HTTP/1.1 200 OK
Content-Type: application/json;ieee754compatible=true;odata.metadata=minimal
Content-Length: 4290
odata-version: 4.0
cache-control: no-cache, no-store, must-revalidate

{"@odata.context":"../$metadata#SalesOrderItem(ConfdDelivQtyInOrderQtyUnit,ConfirmedDeliveryDate,HigherLevelItem,MaterialGroup1,MaterialGroup2,NetAmount,OrderQuantityUnit,Product,RequestedDeliveryDate,RequestedQuantity,RequestedQuantityUnit,SalesOrder,SalesOrderItem,SalesOrderItemCategory,SalesOrderItemText,TransactionCurrency,UICT_ScheduleLine,ZZ1_SKIPADDANC_SDI,__EntityControl/Deletable,__EntityControl/Updatable,__FieldControl/HigherLevelItem,__FieldControl/Product,__FieldControl/RequestedQuantity,__FieldControl/RequestedQuantityUnit,__FieldControl/SalesOrderItemCategory,__OperationControl/EnableBillingPlan,__OperationControl/RemoveBillingBlock,__OperationControl/RemoveBillingPlan,__OperationControl/RemoveRejectionReason,__OperationControl/SetBillingBlock,__OperationControl/SetRejectionReason,__OperationControl/UpdatePrices,_ItemCategory(SalesDocumentItemCategory,SalesDocumentItemCategory_Text),_Product(Product,Product_Text))","@odata.metadataEtag":"W/\"20260911190145\"","@odata.count":"3","value":[{"SalesOrder":"","SalesOrderItem":"10","HigherLevelItem":null,"SalesOrderItemCategory":"ZKBN","SalesOrderItemText":"COV-19 ; MDV14; 10-pack","Product":"80777-0273-98","RequestedDeliveryDate":"2026-09-23","ConfirmedDeliveryDate":"2026-09-23","ConfdDelivQtyInOrderQtyUnit":"100","OrderQuantityUnit":"DOS","RequestedQuantity":"140","RequestedQuantityUnit":"DOS","TransactionCurrency":"USD","NetAmount":"0.00","UICT_ScheduleLine":false,"MaterialGroup1":"PED","MaterialGroup2":"VFC","ZZ1_SKIPADDANC_SDI":false,"__EntityControl":{"Deletable":true,"Updatable":true},"__FieldControl":{"HigherLevelItem":3,"Product":1,"RequestedQuantity":3,"RequestedQuantityUnit":3,"SalesOrderItemCategory":3},"__OperationControl":{"EnableBillingPlan":true,"RemoveBillingBlock":false,"RemoveBillingPlan":false,"RemoveRejectionReason":false,"SetBillingBlock":true,"SetRejectionReason":true,"UpdatePrices":true},"_ItemCategory":{"SalesDocumentItemCategory":"ZKBN","SalesDocumentItemCategory_Text":"Vaccine Request Item"},"_Product":{"Product":"80777-0273-98","Product_Text":"COV-19 ; MDV14; 10-pack"}},{"SalesOrder":"","SalesOrderItem":"11","HigherLevelItem":"10","SalesOrderItemCategory":"ZKBN","SalesOrderItemText":"Admin kit:  Standard Syr -140 (PED)","Product":"11111-0011-01","RequestedDeliveryDate":"2026-09-23","ConfirmedDeliveryDate":"2026-09-23","ConfdDelivQtyInOrderQtyUnit":"140","OrderQuantityUnit":"DOS","RequestedQuantity":"140","RequestedQuantityUnit":"DOS","TransactionCurrency":"USD","NetAmount":"0.00","UICT_ScheduleLine":false,"MaterialGroup1":"PED","MaterialGroup2":"VFC","ZZ1_SKIPADDANC_SDI":false,"__EntityControl":{"Deletable":true,"Updatable":true},"__FieldControl":{"HigherLevelItem":3,"Product":3,"RequestedQuantity":3,"RequestedQuantityUnit":3,"SalesOrderItemCategory":3},"__OperationControl":{"EnableBillingPlan":true,"RemoveBillingBlock":false,"RemoveBillingPlan":false,"RemoveRejectionReason":false,"SetBillingBlock":true,"SetRejectionReason":true,"UpdatePrices":true},"_ItemCategory":{"SalesDocumentItemCategory":"ZKBN","SalesDocumentItemCategory_Text":"Vaccine Request Item"},"_Product":{"Product":"11111-0011-01","Product_Text":"Admin kit:  Standard Syr -140 (PED)"}},{"SalesOrder":"","SalesOrderItem":"12","HigherLevelItem":"10","SalesOrderItemCategory":"ZKBN","SalesOrderItemText":"Admin kit:  Standard Syr -140 (ADU)","Product":"11111-0011-02","RequestedDeliveryDate":"2026-09-23","ConfirmedDeliveryDate":"2026-09-23","ConfdDelivQtyInOrderQtyUnit":"140","OrderQuantityUnit":"DOS","RequestedQuantity":"140","RequestedQuantityUnit":"DOS","TransactionCurrency":"USD","NetAmount":"0.00","UICT_ScheduleLine":false,"MaterialGroup1":"ADU","MaterialGroup2":"VFC","ZZ1_SKIPADDANC_SDI":false,"__EntityControl":{"Deletable":true,"Updatable":true},"__FieldControl":{"HigherLevelItem":3,"Product":3,"RequestedQuantity":3,"RequestedQuantityUnit":3,"SalesOrderItemCategory":3},"__OperationControl":{"EnableBillingPlan":true,"RemoveBillingBlock":false,"RemoveBillingPlan":false,"RemoveRejectionReason":false,"SetBillingBlock":true,"SetRejectionReason":true,"UpdatePrices":true},"_ItemCategory":{"SalesDocumentItemCategory":"ZKBN","SalesDocumentItemCategory_Text":"Vaccine Request Item"},"_Product":{"Product":"11111-0011-02","Product_Text":"Admin kit:  Standard Syr -140 (ADU)"}}]}
--88DE677C023A23C662FB1AEBCA96C3780--


## Batch call on 'Opt-Out Ancillary item':
###-- PAYLOAD ---
--batch_id-1790196697091-2899
Content-Type:application/http
Content-Transfer-Encoding:binary

PATCH SalesOrderItem(SalesOrder='',SalesOrderItem='10')?sap-client=300 HTTP/1.1
Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true
Accept-Language:en-US
SAP-ContextId:SID:ANON:sapapp1dh1_DH1_00:Rj5AFCyCjh6T2k-x6aoBCBMWsfyrEH3GTEZRsjfZ-ATT
Prefer:return=minimal
Content-Type:application/json;charset=UTF-8;IEEE754Compatible=true

{"ZZ1_SKIPADDANC_SDI":true}
--batch_id-1790196697091-2899
Content-Type:application/http
Content-Transfer-Encoding:binary

GET SalesOrderManage('')/_Item(SalesOrder='',SalesOrderItem='10')?sap-client=300&$select=ConfdDelivQtyInOrderQtyUnit,HigherLevelItem,MaterialGroup1,MaterialGroup2,NetAmount,OrderQuantityUnit,Product,RequestedQuantity,RequestedQuantityUnit,SAP__Messages,SalesOrder,SalesOrderItem,SalesOrderItemCategory,SalesOrderItemText,TransactionCurrency,UICT_ScheduleLine,ZZ1_SKIPADDANC_SDI,ZZ1_SKIPANC,__EntityControl/Deletable,__EntityControl/Updatable,__FieldControl/HigherLevelItem,__FieldControl/Product,__FieldControl/RequestedQuantity,__FieldControl/RequestedQuantityUnit,__FieldControl/SalesOrderItemCategory,__OperationControl/EnableBillingPlan,__OperationControl/RemoveBillingBlock,__OperationControl/RemoveBillingPlan,__OperationControl/RemoveRejectionReason,__OperationControl/SetBillingBlock,__OperationControl/SetRejectionReason,__OperationControl/UpdatePrices&$expand=_ItemCategory($select=SalesDocumentItemCategory,SalesDocumentItemCategory_Text),_Product($select=Product,Product_Text) HTTP/1.1
Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true
Accept-Language:en-US
SAP-ContextId:SID:ANON:sapapp1dh1_DH1_00:Rj5AFCyCjh6T2k-x6aoBCBMWsfyrEH3GTEZRsjfZ-ATT
Content-Type:application/json;charset=UTF-8;IEEE754Compatible=true


--batch_id-1790196697091-2899
Content-Type:application/http
Content-Transfer-Encoding:binary

GET SalesOrderManage('')?sap-client=300&$select=BillingDocumentDate,CompleteDeliveryIsDefined,CreatedByUser,CustomerGroup,CustomerName,CustomerPaymentTerms,CustomerPriceGroup,DistributionChannel,IncotermsClassification,IncotermsLocation1,IncotermsLocation2,IncotermsVersion,LastChangeDateTime,LastChangedByUser,NumberOfAttachments,OrderCombinationIsAllowed,OrganizationDivision,OverallSDProcessStatus,PaymentMethod,PriceListType,PricingDate,PurchaseOrderByCustomer,ReferenceDistributionChannel,RequestedDeliveryDate,SAP__Messages,SDDocumentReason,SDPricingProcedure,SalesDistrict,SalesDocumentCreationDateTime,SalesGroup,SalesOffice,SalesOrder,SalesOrderDate,SalesOrderType,SalesOrganization,ServicesRenderedDate,ShippingCondition,SlsDocOvrlGenIncompltnStsText,SlsDocOvrlIncompltnStsCritlty,SoldToParty,TotalBlockStatus,TotalBlockStatusCriticality,TotalNetAmount,TransactionCurrency,UICT_BillingPlan,UICT_BillingPlanType,UICT_CreateDlvFromSalesDoc,UICT_CustomerCreditLimitAmount,UICT_LastChangeDateTime,UICT_LegacyOutputCntrl,UICT_OutputRequestUUID,UICT_WithdrawFromApproval,__CreateByAssociationControl/_Item,__EntityControl/Updatable,__FieldControl/BillingDocumentDate,__FieldControl/CustomerPaymentTerms,__FieldControl/DistributionChannel,__FieldControl/IncotermsClassification,__FieldControl/IncotermsLocation1,__FieldControl/IncotermsLocation2,__FieldControl/IncotermsVersion,__FieldControl/OrderCombinationIsAllowed,__FieldControl/OrganizationDivision,__FieldControl/PaymentMethod,__FieldControl/PricingDate,__FieldControl/SalesOrganization,__FieldControl/ServicesRenderedDate,__FieldControl/SoldToParty,__FieldControl/TransactionCurrency,__OperationControl/ActivateIncompletenessInfo,__OperationControl/CreatePartner,__OperationControl/PrepareForEdit,__OperationControl/ProposeItems,__OperationControl/RemoveBillingBlock,__OperationControl/RemoveDeliveryBlock,__OperationControl/SetBillingBlock,__OperationControl/SetDeliveryBlock,__OperationControl/SetRejectionReasonToAllItems,__OperationControl/UpdatePrices,__OperationControl/WithdrawFromApproval&$expand=_CreatedByUser($select=UserDescription,UserID),_CustomerGroup($select=CustomerGroup,CustomerGroup_Text),_CustomerPaymentTerms($select=CustomerPaymentTerms,CustomerPaymentTerms_Text),_CustomerPriceGroup($select=CustomerPriceGroup,CustomerPriceGroup_Text),_DistributionChannel($select=DistributionChannel,DistributionChannel_Text),_IncotermsClassification($select=IncotermsClassification,IncotermsClassification_Text),_IncotermsVersion($select=IncotermsVersion,IncotermsVersion_Text),_LastChangedByUser($select=UserDescription,UserID),_OrganizationDivision($select=Division,Division_Text),_OverallSDProcessStatus($select=OverallSDProcessStatus,OverallSDProcessStatus_Text),_PaymentMethodVH($select=BillingCompanyCode,PaymentMethod,PaymentMethodDescription),_PriceListType($select=PriceListType,PriceListType_Text),_SDDocumentReason($select=SDDocumentReason,SDDocumentReason_Text),_SDPricingProcedure($select=PricingProcedure,PricingProcedure_Text),_SalesDistrict($select=SalesDistrict,SalesDistrict_Text),_SalesGroup($select=SalesGroup,SalesGroup_Text),_SalesOffice($select=SalesOffice,SalesOffice_Text),_SalesOrderType($select=SalesOrderType,SalesOrderType_Text),_SalesOrganization($select=SalesOrganization,SalesOrganization_Text),_ShippingCondition($select=ShippingCondition,ShippingCondition_Text),_TotalBlockStatus($select=TotalBlockStatus,TotalBlockStatus_Text),_TransactionCurrency($select=Currency,Currency_Text) HTTP/1.1
Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true
Accept-Language:en-US
SAP-ContextId:SID:ANON:sapapp1dh1_DH1_00:Rj5AFCyCjh6T2k-x6aoBCBMWsfyrEH3GTEZRsjfZ-ATT
Content-Type:application/json;charset=UTF-8;IEEE754Compatible=true


--batch_id-1790196697091-2899
Content-Type:application/http
Content-Transfer-Encoding:binary

GET SalesOrderManage('')?sap-client=300&$select=SalesOrder HTTP/1.1
Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true
Accept-Language:en-US
SAP-ContextId:SID:ANON:sapapp1dh1_DH1_00:Rj5AFCyCjh6T2k-x6aoBCBMWsfyrEH3GTEZRsjfZ-ATT
Content-Type:application/json;charset=UTF-8;IEEE754Compatible=true


--batch_id-1790196697091-2899
Content-Type:application/http
Content-Transfer-Encoding:binary

GET SalesOrderManage('')/_Item?sap-client=300&$count=true&$select=ConfdDelivQtyInOrderQtyUnit,HigherLevelItem,MaterialGroup1,MaterialGroup2,NetAmount,OrderQuantityUnit,Product,RequestedQuantity,RequestedQuantityUnit,SalesOrder,SalesOrderItem,SalesOrderItemCategory,SalesOrderItemText,TransactionCurrency,UICT_ScheduleLine,ZZ1_SKIPADDANC_SDI,ZZ1_SKIPANC,__EntityControl/Deletable,__EntityControl/Updatable,__FieldControl/HigherLevelItem,__FieldControl/Product,__FieldControl/RequestedQuantity,__FieldControl/RequestedQuantityUnit,__FieldControl/SalesOrderItemCategory,__OperationControl/EnableBillingPlan,__OperationControl/RemoveBillingBlock,__OperationControl/RemoveBillingPlan,__OperationControl/RemoveRejectionReason,__OperationControl/SetBillingBlock,__OperationControl/SetRejectionReason,__OperationControl/UpdatePrices&$orderby=SalesOrderItem&$expand=_ItemCategory($select=SalesDocumentItemCategory,SalesDocumentItemCategory_Text),_Product($select=Product,Product_Text)&$skip=0&$top=153 HTTP/1.1
Accept:application/json;odata.metadata=minimal;IEEE754Compatible=true
Accept-Language:en-US
SAP-ContextId:SID:ANON:sapapp1dh1_DH1_00:Rj5AFCyCjh6T2k-x6aoBCBMWsfyrEH3GTEZRsjfZ-ATT
Content-Type:application/json;charset=UTF-8;IEEE754Compatible=true


--batch_id-1790196697091-2899--
Group ID: $auto

###--- RESPONSE ---
--F7C7765528EA15F86F14955CD19B1C100
Content-Type: application/http
Content-Length: 154
content-transfer-encoding: binary

HTTP/1.1 204 No Content
Content-Length: 0
cache-control: no-cache, no-store, must-revalidate
preference-applied: return=minimal
odata-version: 4.0


--F7C7765528EA15F86F14955CD19B1C100
Content-Type: application/http
Content-Length: 2205
content-transfer-encoding: binary

HTTP/1.1 200 OK
Content-Type: application/json;ieee754compatible=true;odata.metadata=minimal
Content-Length: 2014
odata-version: 4.0
cache-control: no-cache, no-store, must-revalidate

{"@odata.context":"../$metadata#SalesOrderItem(ConfdDelivQtyInOrderQtyUnit,HigherLevelItem,MaterialGroup1,MaterialGroup2,NetAmount,OrderQuantityUnit,Product,RequestedQuantity,RequestedQuantityUnit,SAP__Messages,SalesOrder,SalesOrderItem,SalesOrderItemCategory,SalesOrderItemText,TransactionCurrency,UICT_ScheduleLine,ZZ1_SKIPADDANC_SDI,ZZ1_SKIPANC,__EntityControl/Deletable,__EntityControl/Updatable,__FieldControl/HigherLevelItem,__FieldControl/Product,__FieldControl/RequestedQuantity,__FieldControl/RequestedQuantityUnit,__FieldControl/SalesOrderItemCategory,__OperationControl/EnableBillingPlan,__OperationControl/RemoveBillingBlock,__OperationControl/RemoveBillingPlan,__OperationControl/RemoveRejectionReason,__OperationControl/SetBillingBlock,__OperationControl/SetRejectionReason,__OperationControl/UpdatePrices,_ItemCategory(SalesDocumentItemCategory,SalesDocumentItemCategory_Text),_Product(Product,Product_Text))/$entity","@odata.metadataEtag":"W/\"20260911190145\"","SalesOrder":"","SalesOrderItem":"10","HigherLevelItem":null,"SalesOrderItemCategory":"ZKBN","SalesOrderItemText":"COV-19 ; MDV14; 10-pack","Product":"80777-0273-98","ConfdDelivQtyInOrderQtyUnit":"100","OrderQuantityUnit":"DOS","RequestedQuantity":"140","RequestedQuantityUnit":"DOS","TransactionCurrency":"USD","NetAmount":"0.00","UICT_ScheduleLine":false,"MaterialGroup1":"PED","MaterialGroup2":"VFC","ZZ1_SKIPADDANC_SDI":true,"ZZ1_SKIPANC":true,"__EntityControl":{"Deletable":true,"Updatable":true},"__FieldControl":{"HigherLevelItem":3,"Product":1,"RequestedQuantity":3,"RequestedQuantityUnit":3,"SalesOrderItemCategory":3},"__OperationControl":{"EnableBillingPlan":true,"RemoveBillingBlock":false,"RemoveBillingPlan":false,"RemoveRejectionReason":false,"SetBillingBlock":true,"SetRejectionReason":true,"UpdatePrices":true},"SAP__Messages":[],"_ItemCategory":{"SalesDocumentItemCategory":"ZKBN","SalesDocumentItemCategory_Text":"Vaccine Request Item"},"_Product":{"Product":"80777-0273-98","Product_Text":"COV-19 ; MDV14; 10-pack"}}
--F7C7765528EA15F86F14955CD19B1C100
Content-Type: application/http
Content-Length: 7114
content-transfer-encoding: binary

HTTP/1.1 200 OK
Content-Type: application/json;ieee754compatible=true;odata.metadata=minimal
Content-Length: 6874
odata-version: 4.0
etag: W/"SADL-000000000000000000000C~0.0000000"
cache-control: no-cache, no-store, must-revalidate

{"@odata.context":"$metadata#SalesOrderManage(BillingDocumentDate,CompleteDeliveryIsDefined,CreatedByUser,CustomerGroup,CustomerName,CustomerPaymentTerms,CustomerPriceGroup,DistributionChannel,IncotermsClassification,IncotermsLocation1,IncotermsLocation2,IncotermsVersion,LastChangeDateTime,LastChangedByUser,NumberOfAttachments,OrderCombinationIsAllowed,OrganizationDivision,OverallSDProcessStatus,PaymentMethod,PriceListType,PricingDate,PurchaseOrderByCustomer,ReferenceDistributionChannel,RequestedDeliveryDate,SAP__Messages,SDDocumentReason,SDPricingProcedure,SalesDistrict,SalesDocumentCreationDateTime,SalesGroup,SalesOffice,SalesOrder,SalesOrderDate,SalesOrderType,SalesOrganization,ServicesRenderedDate,ShippingCondition,SlsDocOvrlGenIncompltnStsText,SlsDocOvrlIncompltnStsCritlty,SoldToParty,TotalBlockStatus,TotalBlockStatusCriticality,TotalNetAmount,TransactionCurrency,UICT_BillingPlan,UICT_BillingPlanType,UICT_CreateDlvFromSalesDoc,UICT_CustomerCreditLimitAmount,UICT_LastChangeDateTime,UICT_LegacyOutputCntrl,UICT_OutputRequestUUID,UICT_WithdrawFromApproval,__CreateByAssociationControl/_Item,__EntityControl/Updatable,__FieldControl/BillingDocumentDate,__FieldControl/CustomerPaymentTerms,__FieldControl/DistributionChannel,__FieldControl/IncotermsClassification,__FieldControl/IncotermsLocation1,__FieldControl/IncotermsLocation2,__FieldControl/IncotermsVersion,__FieldControl/OrderCombinationIsAllowed,__FieldControl/OrganizationDivision,__FieldControl/PaymentMethod,__FieldControl/PricingDate,__FieldControl/SalesOrganization,__FieldControl/ServicesRenderedDate,__FieldControl/SoldToParty,__FieldControl/TransactionCurrency,__OperationControl/ActivateIncompletenessInfo,__OperationControl/CreatePartner,__OperationControl/PrepareForEdit,__OperationControl/ProposeItems,__OperationControl/RemoveBillingBlock,__OperationControl/RemoveDeliveryBlock,__OperationControl/SetBillingBlock,__OperationControl/SetDeliveryBlock,__OperationControl/SetRejectionReasonToAllItems,__OperationControl/UpdatePrices,__OperationControl/WithdrawFromApproval,_CreatedByUser(UserDescription,UserID),_CustomerGroup(CustomerGroup,CustomerGroup_Text),_CustomerPaymentTerms(CustomerPaymentTerms,CustomerPaymentTerms_Text),_CustomerPriceGroup(CustomerPriceGroup,CustomerPriceGroup_Text),_DistributionChannel(DistributionChannel,DistributionChannel_Text),_IncotermsClassification(IncotermsClassification,IncotermsClassification_Text),_IncotermsVersion(IncotermsVersion,IncotermsVersion_Text),_LastChangedByUser(UserDescription,UserID),_OrganizationDivision(Division,Division_Text),_OverallSDProcessStatus(OverallSDProcessStatus,OverallSDProcessStatus_Text),_PaymentMethodVH(BillingCompanyCode,PaymentMethod,PaymentMethodDescription),_PriceListType(PriceListType,PriceListType_Text),_SDDocumentReason(SDDocumentReason,SDDocumentReason_Text),_SDPricingProcedure(PricingProcedure,PricingProcedure_Text),_SalesDistrict(SalesDistrict,SalesDistrict_Text),_SalesGroup(SalesGroup,SalesGroup_Text),_SalesOffice(SalesOffice,SalesOffice_Text),_SalesOrderType(SalesOrderType,SalesOrderType_Text),_SalesOrganization(SalesOrganization,SalesOrganization_Text),_ShippingCondition(ShippingCondition,ShippingCondition_Text),_TotalBlockStatus(TotalBlockStatus,TotalBlockStatus_Text),_TransactionCurrency(Currency,Currency_Text))/$entity","@odata.metadataEtag":"W/\"20260911190145\"","@odata.etag":"W/\"SADL-000000000000000000000C~0.0000000\"","SalesOrder":"","SalesOrderType":"ZKB","SoldToParty":"40029638","CustomerName":"MILWAUKEE FAMILY PRACTICE","SalesOrganization":"1000","DistributionChannel":"10","ReferenceDistributionChannel":"10","OrganizationDivision":"10","SalesOffice":"162","SalesGroup":"","SalesDistrict":"","SalesOrderDate":"2026-09-23","PurchaseOrderByCustomer":"","CustomerGroup":"","SDDocumentReason":"","PricingDate":"2026-09-23","ServicesRenderedDate":null,"BillingDocumentDate":"2026-09-23","SDPricingProcedure":"ZRVCDC","CustomerPriceGroup":"","PriceListType":"","RequestedDeliveryDate":"2026-09-23","ShippingCondition":"01","CompleteDeliveryIsDefined":false,"OrderCombinationIsAllowed":false,"IncotermsClassification":"","IncotermsVersion":"","IncotermsLocation1":"","IncotermsLocation2":"","CustomerPaymentTerms":"","PaymentMethod":"","TotalNetAmount":"0.00","TransactionCurrency":"USD","OverallSDProcessStatus":"A","TotalBlockStatus":"","TotalBlockStatusCriticality":3,"SlsDocOvrlGenIncompltnStsText":"Incomplete","SlsDocOvrlIncompltnStsCritlty":1,"LastChangeDateTime":null,"CreatedByUser":"BU77","SalesDocumentCreationDateTime":"2026-09-23T20:50:46Z","LastChangedByUser":"","UICT_BillingPlanType":true,"UICT_BillingPlan":true,"UICT_OutputRequestUUID":true,"UICT_CustomerCreditLimitAmount":true,"UICT_LastChangeDateTime":true,"UICT_WithdrawFromApproval":true,"NumberOfAttachments":0,"UICT_CreateDlvFromSalesDoc":false,"UICT_LegacyOutputCntrl":true,"__CreateByAssociationControl":{"_Item":true},"__EntityControl":{"Updatable":true},"__FieldControl":{"BillingDocumentDate":3,"CustomerPaymentTerms":3,"DistributionChannel":1,"IncotermsClassification":3,"IncotermsLocation1":3,"IncotermsLocation2":1,"IncotermsVersion":3,"OrderCombinationIsAllowed":3,"OrganizationDivision":1,"PaymentMethod":3,"PricingDate":3,"SalesOrganization":1,"ServicesRenderedDate":3,"SoldToParty":7,"TransactionCurrency":3},"__OperationControl":{"ActivateIncompletenessInfo":true,"CreatePartner":true,"PrepareForEdit":true,"ProposeItems":false,"RemoveBillingBlock":false,"RemoveDeliveryBlock":false,"SetBillingBlock":true,"SetDeliveryBlock":true,"SetRejectionReasonToAllItems":true,"UpdatePrices":true,"WithdrawFromApproval":false},"SAP__Messages":[],"_CreatedByUser":{"UserID":"BU77","UserDescription":""},"_CustomerGroup":null,"_CustomerPaymentTerms":{"CustomerPaymentTerms":"","CustomerPaymentTerms_Text":""},"_CustomerPriceGroup":null,"_DistributionChannel":{"DistributionChannel":"10","DistributionChannel_Text":"VTrckS Dist. Channel"},"_IncotermsClassification":null,"_IncotermsVersion":null,"_LastChangedByUser":null,"_OrganizationDivision":{"Division":"10","Division_Text":"VTrckS Division"},"_OverallSDProcessStatus":{"OverallSDProcessStatus":"A","OverallSDProcessStatus_Text":"Open"},"_PaymentMethodVH":null,"_PriceListType":null,"_SalesDistrict":null,"_SalesGroup":null,"_SalesOffice":{"SalesOffice":"162","SalesOffice_Text":"Wisconsin"},"_SalesOrderType":{"SalesOrderType":"ZKB","SalesOrderType_Text":"Provider Order"},"_SalesOrganization":{"SalesOrganization":"1000","SalesOrganization_Text":"VTrckS Sales Org"},"_SDDocumentReason":null,"_SDPricingProcedure":{"PricingProcedure":"ZRVCDC","PricingProcedure_Text":"CDC Standard (New Split)"},"_ShippingCondition":{"ShippingCondition":"01","ShippingCondition_Text":"Standard - Mail"},"_TotalBlockStatus":{"TotalBlockStatus":"","TotalBlockStatus_Text":"Not Blocked"},"_TransactionCurrency":{"Currency":"USD","Currency_Text":"United States Dollar"}}
--F7C7765528EA15F86F14955CD19B1C100
Content-Type: application/http
Content-Length: 427
content-transfer-encoding: binary

HTTP/1.1 200 OK
Content-Type: application/json;ieee754compatible=true;odata.metadata=minimal
Content-Length: 188
odata-version: 4.0
etag: W/"SADL-000000000000000000000C~0.0000000"
cache-control: no-cache, no-store, must-revalidate

{"@odata.context":"$metadata#SalesOrderManage(SalesOrder)/$entity","@odata.metadataEtag":"W/\"20260911190145\"","@odata.etag":"W/\"SADL-000000000000000000000C~0.0000000\"","SalesOrder":""}
--F7C7765528EA15F86F14955CD19B1C100
Content-Type: application/http
Content-Length: 3240
content-transfer-encoding: binary

HTTP/1.1 200 OK
Content-Type: application/json;ieee754compatible=true;odata.metadata=minimal
Content-Length: 3049
odata-version: 4.0
cache-control: no-cache, no-store, must-revalidate

{"@odata.context":"../$metadata#SalesOrderItem(ConfdDelivQtyInOrderQtyUnit,HigherLevelItem,MaterialGroup1,MaterialGroup2,NetAmount,OrderQuantityUnit,Product,RequestedQuantity,RequestedQuantityUnit,SalesOrder,SalesOrderItem,SalesOrderItemCategory,SalesOrderItemText,TransactionCurrency,UICT_ScheduleLine,ZZ1_SKIPADDANC_SDI,ZZ1_SKIPANC,__EntityControl/Deletable,__EntityControl/Updatable,__FieldControl/HigherLevelItem,__FieldControl/Product,__FieldControl/RequestedQuantity,__FieldControl/RequestedQuantityUnit,__FieldControl/SalesOrderItemCategory,__OperationControl/EnableBillingPlan,__OperationControl/RemoveBillingBlock,__OperationControl/RemoveBillingPlan,__OperationControl/RemoveRejectionReason,__OperationControl/SetBillingBlock,__OperationControl/SetRejectionReason,__OperationControl/UpdatePrices,_ItemCategory(SalesDocumentItemCategory,SalesDocumentItemCategory_Text),_Product(Product,Product_Text))","@odata.metadataEtag":"W/\"20260911190145\"","@odata.count":"2","value":[{"SalesOrder":"","SalesOrderItem":"10","HigherLevelItem":null,"SalesOrderItemCategory":"ZKBN","SalesOrderItemText":"COV-19 ; MDV14; 10-pack","Product":"80777-0273-98","ConfdDelivQtyInOrderQtyUnit":"100","OrderQuantityUnit":"DOS","RequestedQuantity":"140","RequestedQuantityUnit":"DOS","TransactionCurrency":"USD","NetAmount":"0.00","UICT_ScheduleLine":false,"MaterialGroup1":"PED","MaterialGroup2":"VFC","ZZ1_SKIPADDANC_SDI":true,"ZZ1_SKIPANC":true,"__EntityControl":{"Deletable":true,"Updatable":true},"__FieldControl":{"HigherLevelItem":3,"Product":1,"RequestedQuantity":3,"RequestedQuantityUnit":3,"SalesOrderItemCategory":3},"__OperationControl":{"EnableBillingPlan":true,"RemoveBillingBlock":false,"RemoveBillingPlan":false,"RemoveRejectionReason":false,"SetBillingBlock":true,"SetRejectionReason":true,"UpdatePrices":true},"_ItemCategory":{"SalesDocumentItemCategory":"ZKBN","SalesDocumentItemCategory_Text":"Vaccine Request Item"},"_Product":{"Product":"80777-0273-98","Product_Text":"COV-19 ; MDV14; 10-pack"}},{"SalesOrder":"","SalesOrderItem":"11","HigherLevelItem":"10","SalesOrderItemCategory":"ZKBN","SalesOrderItemText":"Admin kit:  Standard Syr -140 (PED)","Product":"11111-0011-01","ConfdDelivQtyInOrderQtyUnit":"140","OrderQuantityUnit":"DOS","RequestedQuantity":"140","RequestedQuantityUnit":"DOS","TransactionCurrency":"USD","NetAmount":"0.00","UICT_ScheduleLine":false,"MaterialGroup1":"PED","MaterialGroup2":"VFC","ZZ1_SKIPADDANC_SDI":false,"ZZ1_SKIPANC":false,"__EntityControl":{"Deletable":true,"Updatable":true},"__FieldControl":{"HigherLevelItem":3,"Product":3,"RequestedQuantity":3,"RequestedQuantityUnit":3,"SalesOrderItemCategory":3},"__OperationControl":{"EnableBillingPlan":true,"RemoveBillingBlock":false,"RemoveBillingPlan":false,"RemoveRejectionReason":false,"SetBillingBlock":true,"SetRejectionReason":true,"UpdatePrices":true},"_ItemCategory":{"SalesDocumentItemCategory":"ZKBN","SalesDocumentItemCategory_Text":"Vaccine Request Item"},"_Product":{"Product":"11111-0011-01","Product_Text":"Admin kit:  Standard Syr -140 (PED)"}}]}
--F7C7765528EA15F86F14955CD19B1C100--
