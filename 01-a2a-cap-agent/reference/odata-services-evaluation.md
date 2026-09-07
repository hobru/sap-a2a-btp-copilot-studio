# Reference · OData services backend evaluation

This is the **evaluation of the 20 target OData services against the live SAP backend**. Every service below was reached through its `$metadata` endpoint and parsed; the entity sets, keys, and function imports here are **ground truth from the backend**, not assumptions. Use this as the authoritative orchestration surface when the skill catalog in [`../docs/04-agent-card-and-skills.md`](../docs/04-agent-card-and-skills.md) is implemented.

> **How this was produced:** each service's `.../<SERVICE>/$metadata` was fetched over the Cloud Connector virtual-host equivalent (direct backend during evaluation) and parsed. Raw metadata and the parsed summary were kept as **session artifacts only** — they are **not** committed, and **no credentials are stored in this repo**.

> **Full entity-set catalog:** this evaluation lists the **header** set per service (the read-skill target). For the **exhaustive** list of all 214 entity sets across the 20 services — every child/item/partner/text/value-help set, its keys, `$expand` navigation path, and full field detail — see [`odata-catalog.md`](./odata-catalog.md) (human-readable) and [`odata-catalog.json`](./odata-catalog.json) (machine-readable). That catalog is the complete raw menu; the focused skill set in [`../docs/04-agent-card-and-skills.md`](../docs/04-agent-card-and-skills.md) is curated from it.

## Headline finding — all services are OData **V2**

Every one of the 20 services is **OData V2** (`edmx Version="1.0"`, SAP NetWeaver Gateway), **not V4**. This is the single correction to fold into the design:

- **Key access uses V2 parentheses syntax:** `.../A_SalesOrder('12345')` and, for multi-part keys, `.../A_SupplierInvoice(SupplierInvoice='...',FiscalYear='...')`.
- **JSON must be requested explicitly** with `?$format=json` (V2 defaults to XML/Atom). The `get-sales-order-status` example call in `docs/04` already does this — keep it.
- `$select`, `$filter`, `$top`, `$expand` all work as in the design docs. Collection responses are wrapped in `{ "d": { "results": [...] } }`; a single-entity read is wrapped in `{ "d": { ... } }`. The executor's mapping step must read from `d` / `d.results`.
- The raw `executeHttpRequest({ destinationName })` approach is unchanged and still correct — only the response envelope and `$format=json` requirement differ from V4.

## Read vs. write surface

- **Entity sets** are the **read** surface. For a read-only-first agent, skills bind to the **header entity set** of each service (listed below).
- **FunctionImports** are the **write / action** surface (post goods issue, approve, cancel, release, …). These are **deferred** to a later, deliberate phase per the ground rules — they are catalogued here only so the write surface is known.

## Service-by-service evaluation

The **header entity set** is the document-level set a read skill should target; its key(s) are the identifier(s) a skill takes as input. "Entity sets" is the total count in the service (header + item + partner + text + pricing + flow sets, etc.).

### Sales

| Service | Ver | Header entity set | Header key(s) | Entity sets | FunctionImports (write/action) |
|---|---|---|---|---|---|
| `API_SALES_ORDER_SRV` | V2 | `A_SalesOrder` | `SalesOrder` | 23 | rejectApprovalRequest, releaseApprovalRequest |
| `API_OUTBOUND_DELIVERY_SRV` | V2 | `A_OutbDeliveryHeader` | `DeliveryDocument` | 7 | PostGoodsIssue, ReverseGoodsIssue, ConfirmPickingAllItems, ConfirmPickingOneItem, PickAllItems, PickOneItem |
| `API_CUSTOMER_RETURN_SRV` | V2 | `A_CustomerReturn` | `CustomerReturn` | 15 | rejectApprovalRequest, releaseApprovalRequest |
| `API_SALES_QUOTATION_SRV` | V2 | `A_SalesQuotation` | `SalesQuotation` | 15 | releaseApprovalRequest, rejectApprovalRequest |
| `API_SALES_INQUIRY_SRV` | V2 | `A_SalesInquiry` | `SalesInquiry` | 7 | none |
| `API_BUSINESS_PARTNER` | V2 | `A_BusinessPartner` | `BusinessPartner` | 56 | none |
| `API_PRODUCT_SRV` | V2 | `A_Product` | `Product` | 32 | none |

### Procurement

| Service | Ver | Header entity set | Header key(s) | Entity sets | FunctionImports (write/action) |
|---|---|---|---|---|---|
| `API_PURCHASEORDER_PROCESS_SRV` | V2 | `A_PurchaseOrder` | `PurchaseOrder` | 9 | GetOutputBinaryData, GetPDF |
| `API_PURCHASEREQ_PROCESS_SRV` | V2 | `A_PurchaseRequisitionHeader` | `PurchaseRequisition` | 5 | Validate, DiscardFromPurchasing, EnableForPurchasing |
| `API_PURCHASECONTRACT_PROCESS_SRV` | V2 | `A_PurchaseContract` | `PurchaseContract` | 7 | WithdrawFromApproval, RejectDocument, ApproveDocument |
| `API_RFQ_PROCESS_SRV` | V2 | `A_RequestForQuotation` | `RequestForQuotation` | 3 | Complete, Cancel, SubmitForApproval |
| `API_QTN_PROCESS_SRV` | V2 | `A_SupplierQuotation` | `SupplierQuotation` | 2 | Submit, Complete, Cancel, SubmitForApproval, CreateFromRFQ |
| `API_SUPPLIERINVOICE_PROCESS_SRV` | V2 | `A_SupplierInvoice` | `SupplierInvoice,FiscalYear` | 12 | Post, Release, Cancel |
| `API_INFORECORD_PROCESS_SRV` | V2 | `A_PurchasingInfoRecord` | `PurchasingInfoRecord` | 7 | none |
| `API_SERVICE_ENTRY_SHEET_SRV` | V2 | `A_ServiceEntrySheet` | `ServiceEntrySheet` | 3 | SubmitForApproval, RevokeApproval, WithdrawFromApproval |

### Finance

| Service | Ver | Header entity set | Header key(s) | Entity sets | FunctionImports (write/action) |
|---|---|---|---|---|---|
| `API_GLACCOUNTLINEITEM` | V2 | `GLAccountLineItem` | `ID` | 1 | none |
| `API_OPLACCTGDOCITEMCUBE_SRV` | V2 | `A_OperationalAcctgDocItemCube` | `CompanyCode,FiscalYear,AccountingDocument,AccountingDocumentItem` | 1 | none |
| `API_JOURNALENTRYITEMBASIC_SRV` | V2 | `A_JournalEntryItemBasic` | `ID` | 5 | none |
| `API_CHARTOFACCOUNTS_SRV` | V2 | `A_ChartOfAccounts` | `ChartOfAccounts` | 2 | none |
| `API_GLACCOUNTINCHARTOFACCOUNTS_SRV` | V2 | `A_GLAccountInChartOfAccounts` | `ChartOfAccounts,GLAccount` | 2 | none |

> `API_SUPPLIERINVOICE_PROCESS_SRV` is listed under both Procurement and Finance in the source catalogue but is a **single backend service** → **20 unique services** evaluated. Its header key is composite (`SupplierInvoice` + `FiscalYear`), so any invoice skill takes **both** values.

## Notes that affect skill design

- **Composite keys are common.** `API_SUPPLIERINVOICE_PROCESS_SRV` (`SupplierInvoice`,`FiscalYear`) and `API_OPLACCTGDOCITEMCUBE_SRV` (four-part key) need every key part as a skill input. Single-key services (`SalesOrder`, `PurchaseOrder`, `BusinessPartner`, `Product`, …) map to a single input parameter.
- **Finance is mostly line-item / cube data.** `API_GLACCOUNTLINEITEM` and `API_OPLACCTGDOCITEMCUBE_SRV` expose a **single** analytical entity set each — these are **list/filter** skills (by account, company code, period), not single-document reads. `API_JOURNALENTRYITEMBASIC_SRV` additionally exposes master-data sets (`A_CompanyCode`, `A_CostCenter`, `A_ProfitCenter`, `A_GLAccountInChartOfAccounts`).
- **Verified against the design.** The fully-specified `get-sales-order-status` skill in `docs/04` is backend-valid: `A_SalesOrder` exists, key = `SalesOrder`, and it carries `OverallSDProcessStatus`, `OverallDeliveryStatus`, `OverallOrdReltdBillgStatus`, `TotalCreditCheckStatus`, `SalesDocApprovalStatus`, `SoldToParty`, `SalesOrderType`, `TransactionCurrency`, `TotalNetAmount`. `A_BusinessPartner` carries `BusinessPartnerFullName`, `BusinessPartnerName`, `BusinessPartnerCategory`, `BusinessPartnerGrouping`, `FirstName`/`LastName`, `OrganizationBPName1`.
- **Every service returned HTTP 200** on `$metadata`, so all 20 are reachable and exposed with the evaluated user's authorizations. At build time the same reachability must hold through the **Cloud Connector resource** (`/sap/opu/odata/sap/`) and **principal propagation**, per [`../docs/03-destination-and-connectivity.md`](../docs/03-destination-and-connectivity.md).

## Suggested first-wave read skills (all backend-verified)

| Skill | Service · header set | Key input(s) |
|---|---|---|
| `get-sales-order-status` | `API_SALES_ORDER_SRV` · `A_SalesOrder` | `SalesOrder` |
| `get-business-partner-details` | `API_BUSINESS_PARTNER` · `A_BusinessPartner` | `BusinessPartner` |
| `get-product-details` | `API_PRODUCT_SRV` · `A_Product` | `Product` |
| `get-purchase-order-status` | `API_PURCHASEORDER_PROCESS_SRV` · `A_PurchaseOrder` | `PurchaseOrder` |
| `get-outbound-delivery-status` | `API_OUTBOUND_DELIVERY_SRV` · `A_OutbDeliveryHeader` | `DeliveryDocument` |
| `get-supplier-invoice-status` | `API_SUPPLIERINVOICE_PROCESS_SRV` · `A_SupplierInvoice` | `SupplierInvoice` + `FiscalYear` |

These reuse the single `get-sales-order-status` executor template — only the service path, header set, key parameter(s), and `$select` fields change.
