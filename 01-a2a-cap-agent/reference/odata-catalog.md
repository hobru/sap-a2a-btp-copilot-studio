# Full OData entity-set catalog (all 214 sets)

> **Status: exhaustive raw menu, not the final skill set.** This lists *every* entity set across all 20 backend OData services so we have a complete picture. Exposing all of these as A2A skills would be poor design (LLM skill-selection degrades badly past a few dozen skills). The next step is to slim this into a **focused skill catalog** (see `docs/04-agent-card-and-skills.md`). Full field-level detail (every property, EDM type, filterable/sortable/creatable/updatable, navigation) lives in the machine-readable `odata-catalog.json` next to this file.

## How to read this

- **All 20 services are OData V2** (SAP Gateway, edmx 1.0). Always send `?$format=json`; collection responses are wrapped `{ "d": { "results": [...] } }`, single entities `{ "d": {...} }`. Key access uses parentheses, e.g. `A_SalesOrder('12345')`, composite `A_SupplierInvoice(SupplierInvoice='...',FiscalYear='...')`. See `reference/odata-services-evaluation.md` for the full V2 call conventions.

- **Role** classifies each entity set:
  - **root** — independently queryable top of a navigation tree (business-document headers and standalone master-data/sub-object roots). These are the candidates to promote to skills.
  - **child** — only meaningful under a parent; reach it via `$expand` or a keyed parent path (e.g. `A_SalesOrder('123')/to_Item`) rather than a top-level skill.
  - **text/value-help** — description texts and F4/value-help sets; use for lookups/enrichment, not as primary skills.

- **Representative fields** shows the human `sap:label` of the first non-key properties, just to convey what the entity is about. It is **not** the full field list — every field, its EDM type and all `sap:*` flags are in `odata-catalog.json`.

- **Base path** for every service: `/sap/opu/odata/sap/<SERVICE>` behind the single `SAP_BACKEND` destination (see `docs/03-destination-and-connectivity.md`).

## Totals

| Metric | Count |
| --- | --- |
| Services | 20 |
| Entity sets | 214 |
| — root (skill candidates) | 55 |
| — child (via `$expand`) | 138 |
| — text / value-help | 21 |
| Function imports (actions) | 34 |

## Service index

| Domain | Service | Sets | Root | Child | Txt/VH | FI | Hub |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sales | `API_SALES_ORDER_SRV` | 23 | 3 | 18 | 2 | 2 | [overview](https://api.sap.com/api/API_SALES_ORDER_SRV/overview) |
| Sales | `API_OUTBOUND_DELIVERY_SRV` | 7 | 3 | 4 | 0 | 6 | [overview](https://api.sap.com/api/API_OUTBOUND_DELIVERY_SRV/overview) |
| Sales | `API_CUSTOMER_RETURN_SRV` | 15 | 2 | 11 | 2 | 2 | [overview](https://api.sap.com/api/API_CUSTOMER_RETURN_SRV/overview) |
| Sales | `API_SALES_QUOTATION_SRV` | 15 | 1 | 12 | 2 | 2 | [overview](https://api.sap.com/api/API_SALES_QUOTATION_SRV/overview) |
| Sales | `API_SALES_INQUIRY_SRV` | 7 | 1 | 6 | 0 | 0 | [overview](https://api.sap.com/api/API_SALES_INQUIRY_SRV/overview) |
| Sales | `API_BUSINESS_PARTNER` | 56 | 9 | 41 | 6 | 0 | [overview](https://api.sap.com/api/API_BUSINESS_PARTNER/overview) |
| Sales | `API_PRODUCT_SRV` | 32 | 16 | 11 | 5 | 0 | [overview](https://api.sap.com/api/API_PRODUCT_SRV/overview) |
| Procurement | `API_PURCHASEORDER_PROCESS_SRV` | 9 | 1 | 8 | 0 | 2 | [overview](https://api.sap.com/api/API_PURCHASEORDER_PROCESS_SRV/overview) |
| Procurement | `API_PURCHASEREQ_PROCESS_SRV` | 5 | 2 | 2 | 1 | 3 | [overview](https://api.sap.com/api/API_PURCHASEREQ_PROCESS_SRV/overview) |
| Procurement | `API_PURCHASECONTRACT_PROCESS_SRV` | 7 | 1 | 6 | 0 | 3 | [overview](https://api.sap.com/api/API_PURCHASECONTRACT_PROCESS_SRV/overview) |
| Procurement | `API_RFQ_PROCESS_SRV` | 3 | 1 | 2 | 0 | 3 | [overview](https://api.sap.com/api/API_RFQ_PROCESS_SRV/overview) |
| Procurement | `API_QTN_PROCESS_SRV` | 2 | 1 | 1 | 0 | 5 | [overview](https://api.sap.com/api/API_QTN_PROCESS_SRV/overview) |
| Procurement | `API_INFORECORD_PROCESS_SRV` | 7 | 2 | 4 | 1 | 0 | [overview](https://api.sap.com/api/API_INFORECORD_PROCESS_SRV/overview) |
| Procurement | `API_SERVICE_ENTRY_SHEET_SRV` | 3 | 1 | 2 | 0 | 3 | [overview](https://api.sap.com/api/API_SERVICE_ENTRY_SHEET_SRV/overview) |
| Procurement/Finance | `API_SUPPLIERINVOICE_PROCESS_SRV` | 12 | 2 | 10 | 0 | 3 | [overview](https://api.sap.com/api/API_SUPPLIERINVOICE_PROCESS_SRV/overview) |
| Finance | `API_GLACCOUNTLINEITEM` | 1 | 1 | 0 | 0 | 0 | [overview](https://api.sap.com/api/API_GLACCOUNTLINEITEM/overview) |
| Finance | `API_OPLACCTGDOCITEMCUBE_SRV` | 1 | 1 | 0 | 0 | 0 | [overview](https://api.sap.com/api/API_OPLACCTGDOCITEMCUBE_SRV/overview) |
| Finance | `API_JOURNALENTRYITEMBASIC_SRV` | 5 | 5 | 0 | 0 | 0 | [overview](https://api.sap.com/api/API_JOURNALENTRYITEMBASIC_SRV/overview) |
| Finance | `API_CHARTOFACCOUNTS_SRV` | 2 | 1 | 0 | 1 | 0 | [overview](https://api.sap.com/api/API_CHARTOFACCOUNTS_SRV/overview) |
| Finance | `API_GLACCOUNTINCHARTOFACCOUNTS_SRV` | 2 | 1 | 0 | 1 | 0 | [overview](https://api.sap.com/api/API_GLACCOUNTINCHARTOFACCOUNTS_SRV/overview) |


---

# Sales


## `API_SALES_ORDER_SRV`

- **Domain:** Sales · **Base path:** `/sap/opu/odata/sap/API_SALES_ORDER_SRV` · **OData:** V2 · **Hub:** [API_SALES_ORDER_SRV](https://api.sap.com/api/API_SALES_ORDER_SRV/overview)
- **Entity sets:** 23 (3 root, 18 child, 2 text/value-help) · **Function imports:** 2

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_SalesOrder` | SalesOrder | 89 | Sales Order Type, Sales Organization, Distribution Channel, Division, Sales Group, Sales Office, Sales District, Sold-to Party, Created On, Created By |
| `A_SalesOrderBillingPlan` | SalesOrder, BillingPlan | 10 | Start Date, Origin of Start Date, Reference, Category, Billing Plan Type, End Date, Origin End Date, Search term |
| `A_SalesOrderItemBillingPlan` | SalesOrder, SalesOrderItem, BillingPlan | 12 | Header Billing Plan, Start Date, Origin of Start Date, Reference, Category, Billing Plan Type, End Date, Origin End Date, Search term |

<details>
<summary>Child / text / value-help entity sets (20)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_SalesOrderBillingPlanItem` | child | SalesOrder, BillingPlan, BillingPlanItem | `A_SalesOrderBillingPlan`·`to_BillingPlanItem` |
| `A_SalesOrderHeaderPartner` | child | SalesOrder, PartnerFunction | `A_SalesOrder`·`to_Partner` |
| `A_SalesOrderHeaderPrElement` | child | SalesOrder, PricingProcedureStep, PricingProcedureCounter | `A_SalesOrder`·`to_PricingElement` |
| `A_SalesOrderItem` | child | SalesOrder, SalesOrderItem | `A_SalesOrder`·`to_Item` |
| `A_SalesOrderItemPartner` | child | SalesOrder, SalesOrderItem, PartnerFunction | `A_SalesOrderItem`·`to_Partner` |
| `A_SalesOrderItemPartnerAddress` | child | SalesOrder, SalesOrderItem, PartnerFunction, AddressRepresentationCode | `A_SalesOrderItemPartner`·`to_Address` |
| `A_SalesOrderItemPrElement` | child | SalesOrder, SalesOrderItem, PricingProcedureStep, PricingProcedureCounter | `A_SalesOrderItem`·`to_PricingElement` |
| `A_SalesOrderItemRelatedObject` | child | SalesOrder, SalesOrderItem, SDDocRelatedObjectSequenceNmbr | `A_SalesOrderItem`·`to_RelatedObject` |
| `A_SalesOrderItemText` | text/value-help | SalesOrder, SalesOrderItem, Language, LongTextID | `A_SalesOrderItem`·`to_Text` |
| `A_SalesOrderItmPrecdgProcFlow` | child | SalesOrder, SalesOrderItem, DocRelationshipUUID | `A_SalesOrderItem`·`to_PrecedingProcFlowDocItem` |
| `A_SalesOrderItmSubsqntProcFlow` | child | SalesOrder, SalesOrderItem, DocRelationshipUUID | `A_SalesOrderItem`·`to_SubsequentProcFlowDocItem` |
| `A_SalesOrderPartnerAddress` | child | SalesOrder, PartnerFunction, AddressRepresentationCode | `A_SalesOrderHeaderPartner`·`to_Address` |
| `A_SalesOrderPrecdgProcFlow` | child | SalesOrder, DocRelationshipUUID | `A_SalesOrder`·`to_PrecedingProcFlowDoc` |
| `A_SalesOrderRelatedObject` | child | SalesOrder, SDDocRelatedObjectSequenceNmbr | `A_SalesOrder`·`to_RelatedObject` |
| `A_SalesOrderScheduleLine` | child | SalesOrder, SalesOrderItem, ScheduleLine | `A_SalesOrderItem`·`to_ScheduleLine` |
| `A_SalesOrderSubsqntProcFlow` | child | SalesOrder, DocRelationshipUUID | `A_SalesOrder`·`to_SubsequentProcFlowDoc` |
| `A_SalesOrderText` | text/value-help | SalesOrder, Language, LongTextID | `A_SalesOrder`·`to_Text` |
| `A_SalesOrderValAddedSrvc` | child | ValueAddedServiceType, ValueAddedSubServiceType, SalesOrder, SalesOrderItem | `A_SalesOrderItem`·`to_ValueAddedService` |
| `A_SlsOrderItemBillingPlanItem` | child | SalesOrder, SalesOrderItem, BillingPlan, BillingPlanItem | `A_SalesOrderItemBillingPlan`·`to_BillingPlanItem` |
| `A_SlsOrdPaymentPlanItemDetails` | child | SalesOrder, PaymentPlanItem | `A_SalesOrder`·`to_PaymentPlanItemDetails` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `rejectApprovalRequest` | POST | FunctionResult | SalesOrder |
| `releaseApprovalRequest` | POST | FunctionResult | SalesOrder |


## `API_OUTBOUND_DELIVERY_SRV`

- **Domain:** Sales · **Base path:** `/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV` · **OData:** V2 · **Hub:** [API_OUTBOUND_DELIVERY_SRV](https://api.sap.com/api/API_OUTBOUND_DELIVERY_SRV/overview)
- **Entity sets:** 7 (3 root, 4 child, 0 text/value-help) · **Function imports:** 6

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_OutbDeliveryHeader` | DeliveryDocument | 108 | Del. loc. tzone, Route, Rec. time zone, Actual GI Date, GI Time, Billing Date, Bill of Lading, Complete Dlv., Confirm. Time, Created By |
| `A_SerialNmbrDelivery` | MaintenanceItemObjectList | 5 | Date, Delivery, Item, Document Cat. |
| `A_OutbDeliveryAddress` | AddressID | 48 | Street 3, Street 5, Time Zone, Building Code, Name, Name 2, Name 3, Name 4, c/o, City Code |

<details>
<summary>Child / text / value-help entity sets (4)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_OutbDeliveryItem` | child | DeliveryDocument, DeliveryDocumentItem | `A_OutbDeliveryHeader`·`to_DeliveryDocumentItem` |
| `A_OutbDeliveryDocFlow` | child | PrecedingDocument, PrecedingDocumentItem, SubsequentDocumentCategory | `A_OutbDeliveryItem`·`to_DocumentFlow` |
| `A_MaintenanceItemObject` | child | MaintenanceItemObject, MaintenanceItemObjectList | `A_SerialNmbrDelivery`·`to_MaintenanceItemObject` |
| `A_OutbDeliveryPartner` | child | PartnerFunction, SDDocument | `A_OutbDeliveryHeader`·`to_DeliveryDocumentPartner` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `PostGoodsIssue` | POST | PickingReport) | DeliveryDocument |
| `ReverseGoodsIssue` | POST | Return) | DeliveryDocument, ActualGoodsMovementDate |
| `ConfirmPickingAllItems` | POST | PickingReport) | DeliveryDocument |
| `ConfirmPickingOneItem` | POST | PickingReport) | DeliveryDocumentItem, DeliveryDocument |
| `PickAllItems` | POST | PickingReport) | DeliveryDocument |
| `PickOneItem` | POST | PickingReport) | DeliveryDocument, DeliveryDocumentItem |


## `API_CUSTOMER_RETURN_SRV`

- **Domain:** Sales · **Base path:** `/sap/opu/odata/sap/API_CUSTOMER_RETURN_SRV` · **OData:** V2 · **Hub:** [API_CUSTOMER_RETURN_SRV](https://api.sap.com/api/API_CUSTOMER_RETURN_SRV/overview)
- **Entity sets:** 15 (2 root, 11 child, 2 text/value-help) · **Function imports:** 2

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_CustomerReturn` | CustomerReturn | 61 | Customer Return Type, Sales Organization, Distribution Channel, Division, Sales Group, Sales Office, Sales District, Sold-to Party, Created On, Created By |
| `A_CustomerReturnOverviewStatus` | RetsMgmtProcess | 5 | Document Number, Logistical Status, Refunding Status, Processing Status |

<details>
<summary>Child / text / value-help entity sets (13)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_CustomerReturnItem` | child | CustomerReturn, CustomerReturnItem | `A_CustomerReturn`·`to_Item` |
| `A_CustomerReturnItemPartner` | child | CustomerReturn, CustomerReturnItem, PartnerFunction | `A_CustomerReturnItem`·`to_Partner` |
| `A_CustomerReturnItemPrcgElmnt` | child | CustomerReturn, CustomerReturnItem, PricingProcedureStep, PricingProcedureCounter | `A_CustomerReturnItem`·`to_PricingElement` |
| `A_CustomerReturnItemRelatedObj` | child | CustomerReturn, CustomerReturnItem, SDDocRelatedObjectSequenceNmbr | `A_CustomerReturnItem`·`to_RelatedObject` |
| `A_CustomerReturnItemText` | text/value-help | CustomerReturn, CustomerReturnItem, Language, LongTextID | `A_CustomerReturnItem`·`to_Text` |
| `A_CustomerReturnPartner` | child | CustomerReturn, PartnerFunction | `A_CustomerReturn`·`to_Partner` |
| `A_CustomerReturnPrcgElmnt` | child | CustomerReturn, PricingProcedureStep, PricingProcedureCounter | `A_CustomerReturn`·`to_PricingElement` |
| `A_CustomerReturnProcessStep` | child | RetsMgmtProcess, RetsMgmtProcessItem, RetsMgmtProcItmQtySplit, RetsMgmtProcessStep, ReturnsDocumentType, ReturnsDocument, ReturnsDocumentItem | `A_CustomerReturnItem`·`to_ProcessStep` |
| `A_CustomerReturnRelatedObject` | child | CustomerReturn, SDDocRelatedObjectSequenceNmbr | `A_CustomerReturn`·`to_RelatedObject` |
| `A_CustomerReturnScheduleLine` | child | CustomerReturn, CustomerReturnItem, ScheduleLine | `A_CustomerReturnItem`·`to_ScheduleLine` |
| `A_CustomerReturnSerialNumber` | child | CustomerReturn, CustomerReturnItem, SerialNumber | `A_CustomerReturnItem`·`to_SerialNumber` |
| `A_CustomerReturnText` | text/value-help | CustomerReturn, Language, LongTextID | `A_CustomerReturn`·`to_Text` |
| `A_CustomerReturnValAddedSrvc` | child | ValueAddedServiceType, ValueAddedSubServiceType, CustomerReturn, CustomerReturnItem | `A_CustomerReturnItem`·`to_ValueAddedService` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `rejectApprovalRequest` | POST | FunctionResult | CustomerReturn |
| `releaseApprovalRequest` | POST | FunctionResult | CustomerReturn |


## `API_SALES_QUOTATION_SRV`

- **Domain:** Sales · **Base path:** `/sap/opu/odata/sap/API_SALES_QUOTATION_SRV` · **OData:** V2 · **Hub:** [API_SALES_QUOTATION_SRV](https://api.sap.com/api/API_SALES_QUOTATION_SRV/overview)
- **Entity sets:** 15 (1 root, 12 child, 2 text/value-help) · **Function imports:** 2

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_SalesQuotation` | SalesQuotation | 62 | Sales Document Type, Sales Organization, Distribution Channel, Division, Sales Group, Sales Office, Sales District, Sold-to Party, Created On, Created By |

<details>
<summary>Child / text / value-help entity sets (14)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_SalesQuotationItem` | child | SalesQuotation, SalesQuotationItem | `A_SalesQuotation`·`to_Item` |
| `A_SalesQuotationItemPartner` | child | SalesQuotation, SalesQuotationItem, PartnerFunction | `A_SalesQuotationItem`·`to_Partner` |
| `A_SalesQuotationItemPrcgElmnt` | child | SalesQuotation, SalesQuotationItem, PricingProcedureStep, PricingProcedureCounter | `A_SalesQuotationItem`·`to_PricingElement` |
| `A_SalesQuotationItemText` | text/value-help | SalesQuotation, SalesQuotationItem, Language, LongTextID | `A_SalesQuotationItem`·`to_Text` |
| `A_SalesQuotationPartner` | child | SalesQuotation, PartnerFunction | `A_SalesQuotation`·`to_Partner` |
| `A_SalesQuotationPrcgElmnt` | child | SalesQuotation, PricingProcedureStep, PricingProcedureCounter | `A_SalesQuotation`·`to_PricingElement` |
| `A_SalesQuotationRelatedObject` | child | SalesQuotation, SDDocRelatedObjectSequenceNmbr | `A_SalesQuotation`·`to_RelatedObject` |
| `A_SalesQuotationText` | text/value-help | SalesQuotation, Language, LongTextID | `A_SalesQuotation`·`to_Text` |
| `A_SalesQuotationValAddedSrvc` | child | ValueAddedServiceType, ValueAddedSubServiceType, SalesQuotation, SalesQuotationItem | `A_SalesQuotationItem`·`to_ValueAddedService` |
| `A_SlsQtanItemRelatedObject` | child | SalesQuotation, SalesQuotationItem, SDDocRelatedObjectSequenceNmbr | `A_SalesQuotationItem`·`to_RelatedObject` |
| `A_SlsQtanItmPrecdgProcFlow` | child | SalesQuotation, SalesQuotationItem, DocRelationshipUUID | `A_SalesQuotationItem`·`to_PrecedingProcFlowDocItem` |
| `A_SlsQtanItmSubsqntProcFlow` | child | SalesQuotation, SalesQuotationItem, DocRelationshipUUID | `A_SalesQuotationItem`·`to_SubsequentProcFlowDocItem` |
| `A_SlsQtanPrecdgProcFlow` | child | SalesQuotation, DocRelationshipUUID | `A_SalesQuotation`·`to_PrecedingProcFlowDoc` |
| `A_SlsQtanSubsqntProcFlow` | child | SalesQuotation, DocRelationshipUUID | `A_SalesQuotation`·`to_SubsequentProcFlowDoc` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `releaseApprovalRequest` | POST | FunctionResult | SalesQuotation |
| `rejectApprovalRequest` | POST | FunctionResult | SalesQuotation |


## `API_SALES_INQUIRY_SRV`

- **Domain:** Sales · **Base path:** `/sap/opu/odata/sap/API_SALES_INQUIRY_SRV` · **OData:** V2 · **Hub:** [API_SALES_INQUIRY_SRV](https://api.sap.com/api/API_SALES_INQUIRY_SRV/overview)
- **Entity sets:** 7 (1 root, 6 child, 0 text/value-help) · **Function imports:** 0

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_SalesInquiry` | SalesInquiry | 42 | Sales Document Type, Sales Organization, Distribution Channel, Division, Sales Group, Sales Office, Sales District, Sold-to Party, Created On, Created By |

<details>
<summary>Child / text / value-help entity sets (6)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_SalesInquiryItem` | child | SalesInquiry, SalesInquiryItem | `A_SalesInquiry`·`to_Item` |
| `A_SalesInquiryItemPartner` | child | SalesInquiry, SalesInquiryItem, PartnerFunction | `A_SalesInquiryItem`·`to_Partner` |
| `A_SalesInquiryItemPrcgElmnt` | child | SalesInquiry, SalesInquiryItem, PricingProcedureStep, PricingProcedureCounter | `A_SalesInquiryItem`·`to_PricingElement` |
| `A_SalesInquiryPartner` | child | SalesInquiry, PartnerFunction | `A_SalesInquiry`·`to_Partner` |
| `A_SalesInquiryPrcgElmnt` | child | SalesInquiry, PricingProcedureStep, PricingProcedureCounter | `A_SalesInquiry`·`to_PricingElement` |
| `A_SalesInquiryValAddedSrvc` | child | ValueAddedServiceType, ValueAddedSubServiceType, SalesInquiry, SalesInquiryItem | `A_SalesInquiryItem`·`to_ValueAddedService` |

</details>


## `API_BUSINESS_PARTNER`

- **Domain:** Sales · **Base path:** `/sap/opu/odata/sap/API_BUSINESS_PARTNER` · **OData:** V2 · **Hub:** [API_BUSINESS_PARTNER](https://api.sap.com/api/API_BUSINESS_PARTNER/overview)
- **Entity sets:** 56 (9 root, 41 child, 6 text/value-help) · **Function imports:** 0

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_BPAddrDepdntIntlLocNumber` | BusinessPartner, AddressID | 5 | Int. location no. 1, Int. location no. 2, Check digit |
| `A_BPContactToFuncAndDept` | RelationshipNumber, BusinessPartnerCompany, BusinessPartnerPerson, ValidityEndDate | 17 | Authority, Department, Company department, Function, Function name, Note, VIP, E-Mail Address, Fax, Extension |
| `A_BPCreditWorthiness` | BusinessPartner | 16 | Credit Standing, Stat.Cred.Stndg Info, Cred.Stndg Inst, Credit Standing Text, Dt.Cred. Stndg Info., Rating, Status of Leg. Proc., Date of Legal Proc., Affidavit, Date of affidavit |
| `A_BPFinancialServicesExtn` | BusinessPartner | 32 | VIP Business Partner, Trading Partner No., Factory calendar, C/R of Reg. Office, Region, Registered Office, Bal. Sheet Currency, Capital increase, Year, Bal.Sheet Disp. |
| `A_BPFinancialServicesReporting` | BusinessPartner | 32 | Non-Resident, Non-Resident Since, Multimillion Loan, Borrower Number, Borr. Entity No., GBA Information, Cred.Stand.Rev.Dat, Manag.Loan Recipient, Org. Relation., Creditor Number |
| `A_BusinessPartner` | BusinessPartner | 69 | Customer, Supplier, Academic Title 1, Authorization Group, BP Category, BusinessPartnerFullName, Grouping, BusinessPartnerName, BP GUID, Correspondence Lang. |
| `A_BusinessPartnerIsBank` | BusinessPartner | 4 | Bank Key, Bank Country/Region, Minimum Reserve Req. |
| `A_Customer` | Customer | 52 | Authorization, Billing block, Created by, Created On, Account group, Customer Classific., Customer Name, Customer Name, Name of Customer, Name of Customer |
| `A_Supplier` | Supplier | 38 | Alternative Payee, Authorization, Created by, Created On, Customer, Payment block, Posting Block, Purch. block, Account group, Supplier Name |

<details>
<summary>Child / text / value-help entity sets (47)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_AddressEmailAddress` | child | AddressID, Person, OrdinalNumber | `A_BPContactToAddress`·`to_EmailAddress`, `A_BusinessPartnerAddress`·`to_EmailAddress` |
| `A_AddressFaxNumber` | child | AddressID, Person, OrdinalNumber | `A_BPContactToAddress`·`to_FaxNumber`, `A_BusinessPartnerAddress`·`to_FaxNumber` |
| `A_AddressHomePageURL` | child | AddressID, Person, OrdinalNumber, ValidityStartDate, IsDefaultURLAddress | `A_BPContactToAddress`·`to_URLAddress`, `A_BusinessPartnerAddress`·`to_URLAddress` |
| `A_AddressPhoneNumber` | child | AddressID, Person, OrdinalNumber | `A_BPContactToAddress`·`to_MobilePhoneNumber`, `A_BPContactToAddress`·`to_PhoneNumber`, `A_BusinessPartnerAddress`·`to_MobilePhoneNumber`, `A_BusinessPartnerAddress`·`to_PhoneNumber` |
| `A_BPContactToAddress` | child | RelationshipNumber, BusinessPartnerCompany, BusinessPartnerPerson, ValidityEndDate, AddressID | `A_BusinessPartnerContact`·`to_ContactAddress` |
| `A_BPDataController` | child | BusinessPartner, DataController, PurposeForPersonalData | `A_BusinessPartner`·`to_BPDataController` |
| `A_BPEmployment` | child | BusinessPartner, BPEmploymentStartDate | `A_BusinessPartner`·`to_BPEmployment` |
| `A_BPFiscalYearInformation` | child | BusinessPartner, BusinessPartnerFiscalYear | `A_BusinessPartner`·`to_BPFiscalYearInformation` |
| `A_BPIntlAddressVersion` | child | BusinessPartner, AddressID, AddressRepresentationCode | `A_BusinessPartnerAddress`·`to_BPIntlAddressVersion` |
| `A_BPRelationship` | child | RelationshipNumber, BusinessPartner1, BusinessPartner2, ValidityEndDate | `A_BusinessPartner`·`to_BPRelationship` |
| `A_BPTaxCompliance` | child | BusinessPartner, BPTaxComplianceID | `A_BusinessPartner`·`to_BPTaxCompliance` |
| `A_BuPaAddressUsage` | child | BusinessPartner, ValidityEndDate, AddressUsage, AddressID | `A_BusinessPartnerAddress`·`to_AddressUsage` |
| `A_BuPaIdentification` | child | BusinessPartner, BPIdentificationType, BPIdentificationNumber | `A_BusinessPartner`·`to_BuPaIdentification` |
| `A_BuPaIndustry` | child | IndustrySector, IndustrySystemType, BusinessPartner | `A_BusinessPartner`·`to_BuPaIndustry` |
| `A_BusinessPartnerAddress` | child | BusinessPartner, AddressID | `A_BusinessPartner`·`to_BusinessPartnerAddress` |
| `A_BusinessPartnerAlias` | child | BusinessPartner, BPAliasPositionNumber | `A_BusinessPartner`·`to_BusinessPartnerAlias` |
| `A_BusinessPartnerBank` | child | BusinessPartner, BankIdentification | `A_BusinessPartner`·`to_BusinessPartnerBank` |
| `A_BusinessPartnerContact` | child | RelationshipNumber, BusinessPartnerCompany, BusinessPartnerPerson, ValidityEndDate | `A_BusinessPartner`·`to_BusinessPartnerContact` |
| `A_BusinessPartnerPaymentCard` | child | BusinessPartner, PaymentCardID, PaymentCardType, CardNumber | `A_BusinessPartner`·`to_PaymentCard` |
| `A_BusinessPartnerRating` | child | BusinessPartner, BusinessPartnerRatingProcedure, BPRatingValidityEndDate | `A_BusinessPartner`·`to_BusinessPartnerRating` |
| `A_BusinessPartnerRole` | child | BusinessPartner, BusinessPartnerRole | `A_BusinessPartner`·`to_BusinessPartnerRole` |
| `A_BusinessPartnerTaxNumber` | child | BusinessPartner, BPTaxType | `A_BusinessPartner`·`to_BusinessPartnerTax` |
| `A_BusPartAddrDepdntTaxNmbr` | child | BusinessPartner, AddressID, BPTaxType | `A_BusinessPartner`·`to_BusPartAddrDepdntTaxNmbr` |
| `A_CustAddrDepdntExtIdentifier` | child | Customer, AddressID | `A_Customer`·`to_CustAddrDepdntExtIdentifier` |
| `A_CustAddrDepdntInformation` | child | Customer, AddressID | `A_Customer`·`to_CustAddrDepdntInformation` |
| `A_CustomerCompany` | child | Customer, CompanyCode | `A_Customer`·`to_CustomerCompany` |
| `A_CustomerCompanyText` | text/value-help | Customer, CompanyCode, Language, LongTextID | `A_CustomerCompany`·`to_CompanyText` |
| `A_CustomerDunning` | child | Customer, CompanyCode, DunningArea | `A_CustomerCompany`·`to_CustomerDunning` |
| `A_CustomerSalesArea` | child | Customer, SalesOrganization, DistributionChannel, Division | `A_Customer`·`to_CustomerSalesArea` |
| `A_CustomerSalesAreaTax` | child | Customer, SalesOrganization, DistributionChannel, Division, DepartureCountry, CustomerTaxCategory | `A_CustomerSalesArea`·`to_SalesAreaTax` |
| `A_CustomerSalesAreaText` | text/value-help | Customer, SalesOrganization, DistributionChannel, Division, Language, LongTextID | `A_CustomerSalesArea`·`to_SalesAreaText` |
| `A_CustomerTaxGrouping` | child | Customer, CustomerTaxGroupingCode | `A_Customer`·`to_CustomerTaxGrouping` |
| `A_CustomerText` | text/value-help | Customer, Language, LongTextID | `A_Customer`·`to_CustomerText` |
| `A_CustomerUnloadingPoint` | child | Customer, UnloadingPointName | `A_Customer`·`to_CustomerUnloadingPoint` |
| `A_CustomerWithHoldingTax` | child | Customer, CompanyCode, WithholdingTaxType | `A_CustomerCompany`·`to_WithHoldingTax` |
| `A_CustSalesPartnerFunc` | child | Customer, SalesOrganization, DistributionChannel, Division, PartnerCounter, PartnerFunction | `A_CustomerSalesArea`·`to_PartnerFunction` |
| `A_CustSlsAreaAddrDepdntInfo` | child | Customer, SalesOrganization, DistributionChannel, Division, AddressID | `A_CustomerSalesArea`·`to_SlsAreaAddrDepdntInfo` |
| `A_CustSlsAreaAddrDepdntTaxInfo` | child | Customer, SalesOrganization, DistributionChannel, Division, AddressID, DepartureCountry, CustomerTaxCategory | `A_CustomerSalesAreaTax`·`to_SlsAreaAddrDepdntTax` |
| `A_CustUnldgPtAddrDepdntInfo` | child | Customer, AddressID, UnloadingPointName | `A_Customer`·`to_CustUnldgPtAddrDepdntInfo` |
| `A_SupplierCompany` | child | Supplier, CompanyCode | `A_Supplier`·`to_SupplierCompany` |
| `A_SupplierCompanyText` | text/value-help | Supplier, CompanyCode, Language, LongTextID | `A_SupplierCompany`·`to_CompanyText` |
| `A_SupplierDunning` | child | Supplier, CompanyCode, DunningArea | `A_SupplierCompany`·`to_SupplierDunning` |
| `A_SupplierPartnerFunc` | child | Supplier, PurchasingOrganization, SupplierSubrange, Plant, PartnerFunction, PartnerCounter | `A_SupplierPurchasingOrg`·`to_PartnerFunction` |
| `A_SupplierPurchasingOrg` | child | Supplier, PurchasingOrganization | `A_Supplier`·`to_SupplierPurchasingOrg` |
| `A_SupplierPurchasingOrgText` | text/value-help | Supplier, PurchasingOrganization, Language, LongTextID | `A_SupplierPurchasingOrg`·`to_PurchasingOrgText` |
| `A_SupplierText` | text/value-help | Supplier, Language, LongTextID | `A_Supplier`·`to_SupplierText` |
| `A_SupplierWithHoldingTax` | child | Supplier, CompanyCode, WithholdingTaxType | `A_SupplierCompany`·`to_SupplierWithHoldingTax` |

</details>


## `API_PRODUCT_SRV`

- **Domain:** Sales · **Base path:** `/sap/opu/odata/sap/API_PRODUCT_SRV` · **OData:** V2 · **Hub:** [API_PRODUCT_SRV](https://api.sap.com/api/API_PRODUCT_SRV/overview)
- **Entity sets:** 32 (16 root, 11 child, 5 text/value-help) · **Function imports:** 0

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_Product` | Product | 69 | Product Type, CrossPlantProdStatus, Valid from, Created On, Created By, Last Change, Changed By, Last Changed, Marked for Deletion, Old Product Number |
| `A_ProductPlantCosting` | Product, Plant | 15 | Co-Product, Costing Lot Size, Variance Key, Base Unit of Measure, Group Counter, Group, Task List Type, Production Version, Fixed-Price Co-Prod., Special Procurement Type |
| `A_ProductPlantForecasting` | Product, Plant | 6 | Date to, Multiplier, RefMatl: consumption, RefPlant:consumption |
| `A_ProductPlantIntlTrd` | Product, Plant | 8 | Country/Region of Origin, Region of Origin, Control Code, CAS number (pharm.), PRODCOM no., Intrastat Group |
| `A_ProductPlantProcurement` | Product, Plant | 6 | Automatic PO, Source list, Source of supply, JIT Delivery |
| `A_ProductPlantQualityMgmt` | Product, Plant | 10 | Max. Storage Period, QM Control Key, QM Material Auth., Post to insp. stock, Documentation reqd, Target QM System, Inspection Interval, Certificate Type |
| `A_ProductPlantSales` | Product, Plant | 9 | Loading Group, Replacement Part, Base quantity, Processing time, Setup time, Availability check, Base Unit of Measure |
| `A_ProductPlantStorage` | Product, Plant | 7 | CC Phys. Inv. Ind., Service Level, CC indicator fixed, Time unit, Putaway/StkRmvl |
| `A_ProductProcurement` | Product | 4 | Order Unit, Var. Order Unit, Purchasing value key |
| `A_ProductQualityMgmt` | Product | 2 | QM in Procur. Active |
| `A_ProductSales` | Product | 5 | X-distr.chain status, Cross-Distr. Chain Product Validity, Tax classification, Transportation Group |
| `A_ProductStorage` | Product | 12 | Storage conditions, Temp. conditions, Haz. material number, GR slips quantity, Label type, Label form, Min. Rem. Shelf Life, Expiration Date, Period Ind. for SLED, Total shelf life |
| `A_ProductSupplyPlanning` | Product, Plant | 59 | Fixed lot size, Maximum Lot Size, Minimum Lot Size, Rounding value, Lot Sizing Procedure, MRP Type, MRP Controller, Safety Stock, Min. Saf. Stock, Planning time fence |
| `A_ProductValuationAccount` | Product, ValuationArea, ValuationType | 15 | Commercial price 1, Commercial price 2, Commercial price 3, Devaluation Ind., Future Price, Valid from, TRUE, LIFO Pool, Tax price 1, Tax price 2 |
| `A_ProductValuationCosting` | Product, ValuationArea, ValuationType | 7 | With Qty Structure, Material origin, Origin Group, Overhead Group |
| `A_ProductWorkScheduling` | Product, Plant | 18 | Base quantity, Unltd Overdelivery, Overdelivery Toler., Underdelivery Toler., Storage Location, Base Unit of Measure, Processing time, Prodn Supervisor, Production unit, Batch entry |

<details>
<summary>Child / text / value-help entity sets (16)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_ProductBasicText` | text/value-help | Product, Language | `A_Product`·`to_ProductBasicText` |
| `A_ProductDescription` | child | Product, Language | `A_Product`·`to_Description` |
| `A_ProductInspectionText` | text/value-help | Product, Language | `A_Product`·`to_ProductInspectionText` |
| `A_ProductMLAccount` | child | Product, ValuationArea, ValuationType, CurrencyRole | `A_ProductValuation`·`to_MLAccount` |
| `A_ProductMLPrices` | child | Product, ValuationArea, ValuationType, CurrencyRole | `A_ProductValuation`·`to_MLPrices` |
| `A_ProductPlant` | child | Product, Plant | `A_Product`·`to_Plant` |
| `A_ProductPlantMRPArea` | child | Product, Plant, MRPArea | `A_ProductPlant`·`to_PlantMRPArea` |
| `A_ProductPlantText` | text/value-help | Product, Plant | — |
| `A_ProductPurchaseText` | text/value-help | Product, Language | `A_Product`·`to_ProductPurchaseText` |
| `A_ProductSalesDelivery` | child | Product, ProductSalesOrg, ProductDistributionChnl | `A_Product`·`to_SalesDelivery` |
| `A_ProductSalesTax` | child | Product, Country, TaxCategory, TaxClassification | `A_Product`·`to_ProductSalesTax`, `A_ProductSalesDelivery`·`to_SalesTax` |
| `A_ProductSalesText` | text/value-help | Product, ProductSalesOrg, ProductDistributionChnl, Language | `A_ProductSalesDelivery`·`to_SalesText` |
| `A_ProductStorageLocation` | child | Product, Plant, StorageLocation | `A_ProductPlant`·`to_StorageLocation` |
| `A_ProductUnitsOfMeasure` | child | Product, AlternativeUnit | `A_Product`·`to_ProductUnitsOfMeasure` |
| `A_ProductUnitsOfMeasureEAN` | child | Product, AlternativeUnit, ConsecutiveNumber | `A_ProductUnitsOfMeasure`·`to_InternationalArticleNumber` |
| `A_ProductValuation` | child | Product, ValuationArea, ValuationType | `A_Product`·`to_Valuation` |

</details>


---

# Procurement


## `API_PURCHASEORDER_PROCESS_SRV`

- **Domain:** Procurement · **Base path:** `/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV` · **OData:** V2 · **Hub:** [API_PURCHASEORDER_PROCESS_SRV](https://api.sap.com/api/API_PURCHASEORDER_PROCESS_SRV/overview)
- **Entity sets:** 9 (1 root, 8 child, 0 text/value-help) · **Function imports:** 2

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_PurchaseOrder` | PurchaseOrder | 57 | Company Code, Purchasing Doc. Type, Deletion Code, Proc. State, Created By, Created On, Last Changed, Supplier, Control indicator, Language Key |

<details>
<summary>Child / text / value-help entity sets (8)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_POSubcontractingComponent` | child | PurchaseOrder, PurchaseOrderItem, ScheduleLine, ReservationItem, RecordType | `A_PurchaseOrderScheduleLine`·`to_SubcontractingComponent` |
| `A_PurchaseOrderItem` | child | PurchaseOrder, PurchaseOrderItem | `A_PurchaseOrder`·`to_PurchaseOrderItem` |
| `A_PurchaseOrderItemNote` | child | PurchaseOrder, PurchaseOrderItem, TextObjectType, Language | `A_PurchaseOrderItem`·`to_PurchaseOrderItemNote` |
| `A_PurchaseOrderNote` | child | PurchaseOrder, TextObjectType, Language | `A_PurchaseOrder`·`to_PurchaseOrderNote` |
| `A_PurchaseOrderScheduleLine` | child | PurchasingDocument, PurchasingDocumentItem, ScheduleLine | `A_PurchaseOrderItem`·`to_ScheduleLine` |
| `A_PurOrdAccountAssignment` | child | PurchaseOrder, PurchaseOrderItem, AccountAssignmentNumber | `A_PurchaseOrderItem`·`to_AccountAssignment` |
| `A_PurOrdPricingElement` | child | PurchaseOrder, PurchaseOrderItem, PricingDocument, PricingDocumentItem, PricingProcedureStep, PricingProcedureCounter | `A_PurchaseOrderItem`·`to_PurchaseOrderPricingElement` |
| `A_ValAddedSrvcMM_2` | child | PurchaseOrder, PurchaseOrderItem, ValueAddedServiceType, ValueAddedSubServiceType | `A_PurchaseOrderItem`·`to_ValueAddedService_2` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `GetOutputBinaryData` | GET | GetPDFResult | PurchaseOrder |
| `GetPDF` | GET | GetPDFResult | PurchaseOrder |


## `API_PURCHASEREQ_PROCESS_SRV`

- **Domain:** Procurement · **Base path:** `/sap/opu/odata/sap/API_PURCHASEREQ_PROCESS_SRV` · **OData:** V2 · **Hub:** [API_PURCHASEREQ_PROCESS_SRV](https://api.sap.com/api/API_PURCHASEREQ_PROCESS_SRV/overview)
- **Entity sets:** 5 (2 root, 2 child, 1 text/value-help) · **Function imports:** 3

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_PurchaseRequisitionHeader` | PurchaseRequisition | 5 | Document Type, PurReqn Description, Checkbox, Boolean Variable (X = True, - = False, Space = Unknown) |
| `A_PurReqAddDelivery` | PurchaseRequisition, PurchaseRequisitionItem | 55 | Address, Plant, Address Type, Address, Address, c/o, Street 5, Language Key, Comm. Method, PO Box |

<details>
<summary>Child / text / value-help entity sets (3)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_PurchaseReqnItemText` | text/value-help | PurchaseRequisition, PurchaseRequisitionItem, DocumentText, TechnicalObjectType, Language | `A_PurchaseRequisitionItem`·`to_PurchaseReqnItemText` |
| `A_PurchaseRequisitionItem` | child | PurchaseRequisition, PurchaseRequisitionItem | `A_PurchaseRequisitionHeader`·`to_PurchaseReqnItem` |
| `A_PurReqnAcctAssgmt` | child | PurchaseRequisition, PurchaseRequisitionItem, PurchaseReqnAcctAssgmtNumber | `A_PurchaseRequisitionItem`·`to_PurchaseReqnAcctAssgmt` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `Validate` | GET | ValidationMessages) | PurchaseRequisition |
| `DiscardFromPurchasing` | POST | Messages) | PurchaseRequisitionItem, PurchaseRequisition |
| `EnableForPurchasing` | POST | Messages) | PurchaseRequisitionItem, PurchaseRequisition |


## `API_PURCHASECONTRACT_PROCESS_SRV`

- **Domain:** Procurement · **Base path:** `/sap/opu/odata/sap/API_PURCHASECONTRACT_PROCESS_SRV` · **OData:** V2 · **Hub:** [API_PURCHASECONTRACT_PROCESS_SRV](https://api.sap.com/api/API_PURCHASECONTRACT_PROCESS_SRV/overview)
- **Entity sets:** 7 (1 root, 6 child, 0 text/value-help) · **Function imports:** 3

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_PurchaseContract` | PurchaseContract | 40 | Purchasing Doc. Type, Company Code, Deletion Indicator, Created On, Created By, Supplier, Purch. Organization, Purchasing Group, Payment Terms, Days 1 |

<details>
<summary>Child / text / value-help entity sets (6)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_PurchaseContractItem` | child | PurchaseContract, PurchaseContractItem | `A_PurchaseContract`·`to_PurchaseContractItem` |
| `A_PurContrItemCondition` | child | PurchaseContract, PurchaseContractItem, ConditionValidityEndDate, ConditionType, ConditionRecord, ConditionSequentialNumber | `A_PurchaseContractItem`·`to_PurContrItemCondition` |
| `A_PurCtrAccount` | child | AccountAssignment, PurchaseContractItem, PurchaseContract | `A_PurchaseContractItem`·`to_PurCtrAccount` |
| `A_PurCtrAddress` | child | PurchaseContract, AddressID, PurchaseContractItem | `A_PurchaseContractItem`·`to_PurCtrAddress` |
| `A_PurCtrPartners` | child | PurchaseContract, PurchaseContractItem, PurchasingOrganization, PartnerFunction, Plant, SupplierSubrange, PartnerCounter | `A_PurchaseContract`·`to_PurCtrPartners` |
| `A_ValAddedSrvcMM` | child | ValAddedSrvcTransactionNumber, ValAddedSrvcItemGroup, ValAddedSrvcItemNumber, ValueAddedServiceType, ValueAddedSubServiceType | `A_PurchaseContractItem`·`to_ValueAddedService` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `WithdrawFromApproval` | POST | Messages) | PurchaseContract |
| `RejectDocument` | POST | Messages) | PurchaseContract |
| `ApproveDocument` | POST | Messages) | PurchaseContract |


## `API_RFQ_PROCESS_SRV`

- **Domain:** Procurement · **Base path:** `/sap/opu/odata/sap/API_RFQ_PROCESS_SRV` · **OData:** V2 · **Hub:** [API_RFQ_PROCESS_SRV](https://api.sap.com/api/API_RFQ_PROCESS_SRV/overview)
- **Entity sets:** 3 (1 root, 2 child, 0 text/value-help) · **Function imports:** 3

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_RequestForQuotation` | RequestForQuotation | 34 | Company Code, Purch. Doc. Category, RFQ Type, Created By, Created On, Last Changed, Language Key, Purchasing Organization, Purchasing Group, Currency |

<details>
<summary>Child / text / value-help entity sets (2)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_RequestForQuotationBidder` | child | RequestForQuotation, PartnerCounter | `A_RequestForQuotation`·`to_RequestForQuotationBidder` |
| `A_RequestForQuotationItem` | child | RequestForQuotationItem, RequestForQuotation | `A_RequestForQuotation`·`to_RequestForQuotationItem` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `Complete` | POST | ChangeStatusExportParameters | RequestForQuotation |
| `Cancel` | POST | ChangeStatusExportParameters | RequestForQuotation |
| `SubmitForApproval` | POST | ChangeStatusExportParameters | RequestForQuotation |


## `API_QTN_PROCESS_SRV`

- **Domain:** Procurement · **Base path:** `/sap/opu/odata/sap/API_QTN_PROCESS_SRV` · **OData:** V2 · **Hub:** [API_QTN_PROCESS_SRV](https://api.sap.com/api/API_QTN_PROCESS_SRV/overview)
- **Entity sets:** 2 (1 root, 1 child, 0 text/value-help) · **Function imports:** 5

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_SupplierQuotation` | SupplierQuotation | 37 | Company Code, Purch. Doc. Category, Quotation Type, Supplier, Created By, Created On, Last Changed, Language Key, Currency, Incoterms |

<details>
<summary>Child / text / value-help entity sets (1)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_SupplierQuotationItem` | child | SupplierQuotation, SupplierQuotationItem | `A_SupplierQuotation`·`to_SupplierQuotationItem` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `Submit` | POST | ChangeStatusExportParameters | SupplierQuotation |
| `Complete` | POST | ChangeStatusExportParameters | SupplierQuotation |
| `Cancel` | POST | ChangeStatusExportParameters | SupplierQuotation |
| `SubmitForApproval` | POST | ChangeStatusExportParameters | SupplierQuotation |
| `CreateFromRFQ` | POST | CreateExportParameters | QuotationSubmissionDate, Supplier, RequestForQuotation |


## `API_INFORECORD_PROCESS_SRV`

- **Domain:** Procurement · **Base path:** `/sap/opu/odata/sap/API_INFORECORD_PROCESS_SRV` · **OData:** V2 · **Hub:** [API_INFORECORD_PROCESS_SRV](https://api.sap.com/api/API_INFORECORD_PROCESS_SRV/overview)
- **Entity sets:** 7 (2 root, 4 child, 1 text/value-help) · **Function imports:** 0

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_PurchasingInfoRecord` | PurchasingInfoRecord | 31 | Supplier, Material, Material Group, Created On, Complete info record, Info Short Text, Sort Term, Order Unit, Equal To, Denominator |
| `A_PurInfoRecdPrcgCndn` | ConditionRecord | 42 | Sequent. No. of Cond, Application, Condition Type, Valid To, Valid From, Created By, Created On, Text number, Scale Type, Scale Base Type |

<details>
<summary>Child / text / value-help entity sets (5)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_PurgInfoRecdOrgPlantData` | child | PurchasingInfoRecord, PurchasingInfoRecordCategory, PurchasingOrganization, Plant | `A_PurchasingInfoRecord`·`to_PurgInfoRecdOrgPlantData` |
| `A_PurgInfoRecdOrgPOText` | text/value-help | Language, DocumentText, TechnicalObjectType, ArchObjectNumber, PurchasingInfoRecord, PurchasingOrganization, PurchasingInfoRecordCategory, Plant | `A_PurgInfoRecdOrgPlantData`·`to_PurInfoRecdPurOrgText` |
| `A_PurInfoRecdPrcgCndnScale` | child | ConditionRecord, ConditionSequentialNumber, ConditionScaleLine | `A_PurInfoRecdPrcgCndn`·`to_PurgInfoPricingCndnRecdScale`, `A_PurInfoRecdSuplmntPrcgCndn`·`to_PurgInfoPricingCndnRecdScale` |
| `A_PurInfoRecdPrcgCndnValidity` | child | ConditionRecord, ConditionValidityEndDate | `A_PurgInfoRecdOrgPlantData`·`to_PurInfoRecdPrcgCndnValidity`, `A_PurInfoRecdPrcgCndn`·`to_PurInfoRecdPrcgCndnValidity`, `A_PurInfoRecdSuplmntPrcgCndn`·`to_PurInfoRecdPrcgCndnValidity` |
| `A_PurInfoRecdSuplmntPrcgCndn` | child | ConditionRecord, ConditionSequentialNumber | `A_PurInfoRecdPrcgCndn`·`to_PurInfoRecdSuplmntPrcgCndn` |

</details>


## `API_SERVICE_ENTRY_SHEET_SRV`

- **Domain:** Procurement · **Base path:** `/sap/opu/odata/sap/API_SERVICE_ENTRY_SHEET_SRV` · **OData:** V2 · **Hub:** [API_SERVICE_ENTRY_SHEET_SRV](https://api.sap.com/api/API_SERVICE_ENTRY_SHEET_SRV/overview)
- **Entity sets:** 3 (1 root, 2 child, 0 text/value-help) · **Function imports:** 3

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_ServiceEntrySheet` | ServiceEntrySheet | 25 | Approval Date, Document Status, Approval Status, User Name, Time Stamp, Purch. Organization, Purchasing Group, Busin. Purp. Cmpltd., Currency, Deletion Indicator |

<details>
<summary>Child / text / value-help entity sets (2)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_ServiceEntrySheetItem` | child | ServiceEntrySheet, ServiceEntrySheetItem | `A_ServiceEntrySheet`·`to_ServiceEntrySheetItem` |
| `A_SrvcEntrShtAcctAssignment` | child | ServiceEntrySheet, ServiceEntrySheetItem, AccountAssignment | `A_ServiceEntrySheetItem`·`to_AccountAssignment` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `SubmitForApproval` | POST | ChangeStatusExportParameters | ServiceEntrySheet |
| `RevokeApproval` | POST | ChangeStatusExportParameters | ServiceEntrySheet, PostingDate |
| `WithdrawFromApproval` | POST | ChangeStatusExportParameters | ServiceEntrySheet |


---

# Procurement/Finance


## `API_SUPPLIERINVOICE_PROCESS_SRV`

- **Domain:** Procurement/Finance · **Base path:** `/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV` · **OData:** V2 · **Hub:** [API_SUPPLIERINVOICE_PROCESS_SRV](https://api.sap.com/api/API_SUPPLIERINVOICE_PROCESS_SRV/overview)
- **Entity sets:** 12 (2 root, 10 child, 0 text/value-help) · **Function imports:** 3

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_SuplrInvoiceAdditionalData` | SupplierInvoice, FiscalYear | 43 | Name, Name 2, Name 3, Name 4, Postal Code, City, Country/Region Key, Street, PO Box, P.O. Box Postal Code |
| `A_SupplierInvoice` | SupplierInvoice, FiscalYear | 81 | Company Code, Invoice Date, Posting Date, Entry Date, Reference, Invoicing Party, Currency, Gross Invoice Amount, Unplanned Del. Costs, Document Header Text |

<details>
<summary>Child / text / value-help entity sets (10)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_SuplrInvcHeaderWhldgTax` | child | SupplierInvoice, FiscalYear, WithholdingTaxType | `A_SupplierInvoice`·`to_SupplierInvoiceWhldgTax` |
| `A_SuplrInvcItemAcctAssgmt` | child | SupplierInvoice, FiscalYear, SupplierInvoiceItem, OrdinalNumber | `A_SuplrInvcItemPurOrdRef`·`to_SupplierInvoiceItmAcctAssgmt` |
| `A_SuplrInvcItemPurOrdRef` | child | SupplierInvoice, FiscalYear, SupplierInvoiceItem | `A_SupplierInvoice`·`to_SuplrInvcItemPurOrdRef` |
| `A_SuplrInvcSeldInbDeliveryNote` | child | SupplierInvoice, FiscalYear, InboundDeliveryNote | `A_SupplierInvoice`·`to_SelectedDeliveryNotes` |
| `A_SuplrInvcSeldPurgDocument` | child | SupplierInvoice, FiscalYear, PurchaseOrder, PurchaseOrderItem | `A_SupplierInvoice`·`to_SelectedPurchaseOrders` |
| `A_SuplrInvcSeldSrvcEntrShtLean` | child | SupplierInvoice, FiscalYear, ServiceEntrySheet, ServiceEntrySheetItem | `A_SupplierInvoice`·`to_SelectedServiceEntrySheets` |
| `A_SupplierInvoiceItemAsset` | child | SupplierInvoice, FiscalYear, SupplierInvoiceItem | `A_SupplierInvoice`·`to_SuplrInvcItemAsset` |
| `A_SupplierInvoiceItemGLAcct` | child | SupplierInvoice, FiscalYear, SupplierInvoiceItem | `A_SupplierInvoice`·`to_SupplierInvoiceItemGLAcct` |
| `A_SupplierInvoiceItemMaterial` | child | SupplierInvoice, FiscalYear, SupplierInvoiceItem | `A_SupplierInvoice`·`to_SuplrInvcItemMaterial` |
| `A_SupplierInvoiceTax` | child | SupplierInvoice, FiscalYear, TaxCode, SupplierInvoiceTaxCounter | `A_SupplierInvoice`·`to_SupplierInvoiceTax` |

</details>

### Function imports (actions)

| Name | HTTP | Returns | Params |
| --- | --- | --- | --- |
| `Post` | POST | PostInvoiceExportParameters | SupplierInvoice, FiscalYear |
| `Release` | POST | ReleaseInvoiceExportParameters | SupplierInvoice, FiscalYear, DiscountDaysHaveToBeShifted |
| `Cancel` | POST | CancelInvoiceExportParameters | PostingDate, ReversalReason, FiscalYear, SupplierInvoice |


---

# Finance


## `API_GLACCOUNTLINEITEM`

- **Domain:** Finance · **Base path:** `/sap/opu/odata/sap/API_GLACCOUNTLINEITEM` · **OData:** V2 · **Hub:** [API_GLACCOUNTLINEITEM](https://api.sap.com/api/API_GLACCOUNTLINEITEM/overview)
- **Entity sets:** 1 (1 root, 0 child, 0 text/value-help) · **Function imports:** 0

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `GLAccountLineItem` | ID | 247 | Source Ledger, Company Code, Fiscal Year, Journal Entry, Journal Entry Item, Ledger, Fiscal Year of Ledger, Record Type, Controlling Area, Chart of Accounts |


## `API_OPLACCTGDOCITEMCUBE_SRV`

- **Domain:** Finance · **Base path:** `/sap/opu/odata/sap/API_OPLACCTGDOCITEMCUBE_SRV` · **OData:** V2 · **Hub:** [API_OPLACCTGDOCITEMCUBE_SRV](https://api.sap.com/api/API_OPLACCTGDOCITEMCUBE_SRV/overview)
- **Entity sets:** 1 (1 root, 0 child, 0 text/value-help) · **Function imports:** 0

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_OperationalAcctgDocItemCube` | CompanyCode, FiscalYear, AccountingDocument, AccountingDocumentItem | 270 | Company Code Name, Chart of Accounts, Line Item ID, Clearing Date, Clrg Creation Date, Clearing Journal Entry, Is Cleared, Posting Key, Account Type, Special G/L |


## `API_JOURNALENTRYITEMBASIC_SRV`

- **Domain:** Finance · **Base path:** `/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV` · **OData:** V2 · **Hub:** [API_JOURNALENTRYITEMBASIC_SRV](https://api.sap.com/api/API_JOURNALENTRYITEMBASIC_SRV/overview)
- **Entity sets:** 5 (5 root, 0 child, 0 text/value-help) · **Function imports:** 0

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_CompanyCode` | CompanyCode | 21 | Company Name, City, Country/Region Key, Currency, Language Key, Chart of Accounts, Fiscal Year Variant, Company, Credit Control Area, Alternative COA |
| `A_CostCenter` | ControllingArea, CostCenter, ValidityEndDate | 29 | Valid From, Company Code, Business Area, Person Responsible, User Responsible, Currency, Profit Center, Department, Costing Sheet, Functional Area |
| `A_GLAccountInChartOfAccounts` | ChartOfAccounts, GLAccount | 19 | Balance sheet acct, Account Group, Group Account Number, P&L state. acct, Sample Account, Deletion Flag, Creation Block, Posting Block, Planning Block, Trading Partner No. |
| `A_JournalEntryItemBasic` | ID | 143 | Ledger, Ledger Name, Source Ledger, Fiscal Year of Ledger, Controlling Area, Ctrlg Area Name, Company Code, Company Code Name, G/L Account, G/L Account Name |
| `A_ProfitCenter` | ControllingArea, ProfitCenter, ValidityEndDate | 35 | Person Resp. for PC, Company Code, User Responsible, Valid From, Department, Hierarchy Area, Segment, Lock indicator, Form. Planning Temp., Title |


## `API_CHARTOFACCOUNTS_SRV`

- **Domain:** Finance · **Base path:** `/sap/opu/odata/sap/API_CHARTOFACCOUNTS_SRV` · **OData:** V2 · **Hub:** [API_CHARTOFACCOUNTS_SRV](https://api.sap.com/api/API_CHARTOFACCOUNTS_SRV/overview)
- **Entity sets:** 2 (1 root, 0 child, 1 text/value-help) · **Function imports:** 0

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_ChartOfAccounts` | ChartOfAccounts | 4 | Group Chart of Accts, Blocked, Maint.Language |

<details>
<summary>Child / text / value-help entity sets (1)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_ChartOfAccountsText` | text/value-help | ChartOfAccounts, Language | `A_ChartOfAccounts`·`to_Text` |

</details>


## `API_GLACCOUNTINCHARTOFACCOUNTS_SRV`

- **Domain:** Finance · **Base path:** `/sap/opu/odata/sap/API_GLACCOUNTINCHARTOFACCOUNTS_SRV` · **OData:** V2 · **Hub:** [API_GLACCOUNTINCHARTOFACCOUNTS_SRV](https://api.sap.com/api/API_GLACCOUNTINCHARTOFACCOUNTS_SRV/overview)
- **Entity sets:** 2 (1 root, 0 child, 1 text/value-help) · **Function imports:** 0

### Root entity sets

| Entity set | Key(s) | Props | Representative fields |
| --- | --- | --- | --- |
| `A_GLAccountInChartOfAccounts` | ChartOfAccounts, GLAccount | 19 | Balance sheet acct, Account Group, Group Account Number, P&L state. acct, Sample Account, Deletion Flag, Creation Block, Posting Block, Planning Block, Trading Partner No. |

<details>
<summary>Child / text / value-help entity sets (1)</summary>

| Entity set | Role | Key(s) | Reached from (parent · nav) |
| --- | --- | --- | --- |
| `A_GLAccountText` | text/value-help | ChartOfAccounts, GLAccount, Language | `A_GLAccountInChartOfAccounts`·`to_Text` |

</details>
