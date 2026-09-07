# Focused skill catalog (the curated “good A2A design”)

This is the **curated** skill set the A2A agent actually exposes — the deliberately small,
well-described surface Copilot Studio consumes. It is distilled from the exhaustive
[`odata-catalog.md`](./odata-catalog.md) (all **214 entity sets** across 20 services), which
is the *raw menu*. Exposing 214 sets as skills would be poor A2A design; this document is
the opposite end — a tight list of **11 read-only skills** that cover the three domains and
demonstrate every access pattern the executor needs.

> **Status:** design artifact. No skill here is wired to a running service yet. Field and
> entity-set names are **verified against the live backend** (see
> [`odata-services-evaluation.md`](./odata-services-evaluation.md)); all 20 services are
> **OData V2**.

---

## Design principles

1. **Few skills, rich descriptions.** The LLM in Copilot Studio only ever sees the Agent
   Card `skills[]`: `id`, `name`, `description`, `tags`, `examples`, `outputModes`. It picks
   a skill and extracts parameters from natural language — it does **not** build OData URLs.
   The precise OData binding lives in the deterministic **server-side executor**.
2. **One skill = one intent, not one entity set.** Child / item / partner / text sets are
   never separate skills. They are pulled *inside* a header skill via `$expand`.
3. **Three access patterns only** — every skill is one of:
   - **get-by-id** — read one document by its key (single or composite).
   - **get-by-id + `$expand`** — read one document plus selected child/text sets.
   - **list-with-filter** — read a small, filtered, `$top`-capped collection.
4. **Read-only first.** No create/update/delete. Function imports and write actions from the
   full catalog are intentionally excluded.
5. **Server-side validation.** The executor validates/normalises every parameter (pad IDs,
   check formats, enforce mandatory filters, cap `$top`) before calling the backend.

### OData V2 conventions the executor applies (all skills)

- Always request JSON: append `&$format=json`.
- Read single entity from `d`, collections from `d.results`.
- Key access uses parentheses: `A_SalesOrder('12345')`; composite keys are named:
  `A_SupplierInvoice(SupplierInvoice='...',FiscalYear='...')`.
- Date literals: `datetime'2026-01-01T00:00:00'`.
- Narrow every read with `$select`; cap every list with `$top` (default 20, max 100).

---

## Catalog overview

| # | Skill id | Domain | Backend service · entity set | Pattern |
|---|---|---|---|---|
| 1 | `get-sales-order-status` | Sales | `API_SALES_ORDER_SRV` · `A_SalesOrder` | get-by-id |
| 2 | `list-sales-orders-for-customer` | Sales | `API_SALES_ORDER_SRV` · `A_SalesOrder` | list-with-filter |
| 3 | `get-outbound-delivery-status` | Sales | `API_OUTBOUND_DELIVERY_SRV` · `A_OutbDeliveryHeader` | get-by-id |
| 4 | `get-sales-quotation-status` | Sales | `API_SALES_QUOTATION_SRV` · `A_SalesQuotation` | get-by-id |
| 5 | `get-business-partner-details` | Sales | `API_BUSINESS_PARTNER` · `A_BusinessPartner` | get-by-id + `$expand` |
| 6 | `get-product-details` | Sales | `API_PRODUCT_SRV` · `A_Product` | get-by-id + `$expand` |
| 7 | `get-purchase-order-status` | Procurement | `API_PURCHASEORDER_PROCESS_SRV` · `A_PurchaseOrder` | get-by-id + `$expand` |
| 8 | `list-purchase-orders-for-supplier` | Procurement | `API_PURCHASEORDER_PROCESS_SRV` · `A_PurchaseOrder` | list-with-filter |
| 9 | `get-supplier-invoice-status` | Procurement | `API_SUPPLIERINVOICE_PROCESS_SRV` · `A_SupplierInvoice` | get-by-id (composite key) |
| 10 | `list-gl-account-line-items` | Finance | `API_GLACCOUNTLINEITEM` · `GLAccountLineItem` | list-with-filter (mandatory) |
| 11 | `get-gl-account-in-coa` | Finance | `API_GLACCOUNTINCHARTOFACCOUNTS_SRV` · `A_GLAccountInChartOfAccounts` | get-by-id (composite key) |

Coverage: **6 of the 20 services**, **3 domains**, **all 3 access patterns**. Everything
else in the full catalog stays a curation candidate, not an exposed skill.

---

## Sales

### 1 · `get-sales-order-status` — get-by-id

The reference skill, **fully worked end-to-end** (executor logic, output artifact, error
handling) in [`../docs/04-agent-card-and-skills.md`](../docs/04-agent-card-and-skills.md).
Every other skill below is a variation on that template.

- **Params:** `salesOrder` (string, required).
- **Backend:** `GET /API_SALES_ORDER_SRV/A_SalesOrder('{salesOrder}')?$select=SalesOrder,SalesOrderType,SoldToParty,OverallSDProcessStatus,OverallDeliveryStatus,TotalNetAmount,TransactionCurrency,SalesOrderDate&$format=json`
- **Returns:** order number, type, sold-to, overall status, delivery status, net value, currency, document date.

### 2 · `list-sales-orders-for-customer` — list-with-filter

```jsonc
{
  "id": "list-sales-orders-for-customer",
  "name": "List sales orders for a customer",
  "description": "Returns the most recent sales orders for a given sold-to customer, newest first, with status and net value. Optionally restrict by sales organization.",
  "tags": ["sales", "odata", "read", "list"],
  "examples": [
    "Show the last 10 sales orders for customer 4711.",
    "List recent orders for sold-to party 0000004711 in sales org 1010."
  ],
  "outputModes": ["application/json"]
}
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `soldToParty` | string | yes | Customer (sold-to) number; executor left-pads to 10 chars |
| `salesOrganization` | string | no | Restrict to one sales org |
| `top` | integer | no | Page size, default 20, max 100 |

**Backend call**

```
GET /API_SALES_ORDER_SRV/A_SalesOrder
    ?$select=SalesOrder,SalesOrderType,SoldToParty,OverallSDProcessStatus,TotalNetAmount,TransactionCurrency,SalesOrderDate
    &$filter=SoldToParty eq '0000004711'   [ and SalesOrganization eq '1010' ]
    &$orderby=SalesOrderDate desc
    &$top=20
    &$format=json
```

**Returns:** array of `{ salesOrder, type, soldToParty, overallStatus, netAmount, currency, orderDate }` from `d.results`.

### 3 · `get-outbound-delivery-status` — get-by-id

```jsonc
{
  "id": "get-outbound-delivery-status",
  "name": "Get outbound delivery status",
  "description": "Returns the header and processing status of a single outbound delivery, given its delivery document number, including goods-movement and billing status.",
  "tags": ["sales", "logistics", "odata", "read"],
  "examples": [
    "What is the status of delivery 80001234?",
    "Has outbound delivery 80001234 been goods-issued yet?"
  ],
  "outputModes": ["application/json"]
}
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `deliveryDocument` | string | yes | Outbound delivery number |

**Backend call**

```
GET /API_OUTBOUND_DELIVERY_SRV/A_OutbDeliveryHeader('80001234')
    ?$select=DeliveryDocument,DeliveryDocumentType,ShippingPoint,SoldToParty,OverallSDProcessStatus,OverallGoodsMovementStatus,OverallDelivReltdBillgStatus,ActualGoodsMovementDate,PlannedGoodsIssueDate
    &$format=json
```

> **Filter note:** header fields on this service are **not filterable** — this service is
> get-by-key only. A “list deliveries” skill would need a different backend field set and is
> intentionally omitted.

**Returns:** `{ deliveryDocument, type, shippingPoint, soldToParty, overallStatus, goodsMovementStatus, billingStatus, actualGoodsIssueDate, plannedGoodsIssueDate }`.

### 4 · `get-sales-quotation-status` — get-by-id

```jsonc
{
  "id": "get-sales-quotation-status",
  "name": "Get sales quotation status",
  "description": "Returns the header and overall status of a single sales quotation by its quotation number, including net value and sold-to party.",
  "tags": ["sales", "odata", "read"],
  "examples": [
    "What is the status of quotation 20000045?",
    "Show me sales quotation 20000045."
  ],
  "outputModes": ["application/json"]
}
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `salesQuotation` | string | yes | Sales quotation number |

**Backend call**

```
GET /API_SALES_QUOTATION_SRV/A_SalesQuotation('20000045')
    ?$select=SalesQuotation,SalesQuotationType,SalesOrganization,SoldToParty,OverallSDProcessStatus,TotalNetAmount,TransactionCurrency
    &$format=json
```

**Returns:** `{ salesQuotation, type, salesOrganization, soldToParty, overallStatus, netAmount, currency }`.

> **Easy clone:** `get-customer-return-status` over `API_CUSTOMER_RETURN_SRV` · `A_CustomerReturn`
> (key `CustomerReturn`; same status/net-value shape) is the identical template — add it when
> returns become in-scope.

### 5 · `get-business-partner-details` — get-by-id + `$expand`

```jsonc
{
  "id": "get-business-partner-details",
  "name": "Get business partner details",
  "description": "Returns master-data for a business partner (customer or supplier) by BP number: name, category, and primary address. Use for 'who is customer/supplier X' lookups.",
  "tags": ["master-data", "odata", "read"],
  "examples": [
    "Get the details of business partner 0000004711.",
    "What is the address of customer 4711?"
  ],
  "outputModes": ["application/json"]
}
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `businessPartner` | string | yes | BP number; executor left-pads to 10 chars |

**Backend call** (header + address child via `$expand`, no separate address skill)

```
GET /API_BUSINESS_PARTNER/A_BusinessPartner('0000004711')
    ?$select=BusinessPartner,BusinessPartnerFullName,BusinessPartnerCategory,OrganizationBPName1,FirstName,LastName,to_BusinessPartnerAddress/CityName,to_BusinessPartnerAddress/StreetName,to_BusinessPartnerAddress/PostalCode,to_BusinessPartnerAddress/Country
    &$expand=to_BusinessPartnerAddress
    &$format=json
```

**Returns:** `{ businessPartner, fullName, category, name1, firstName, lastName, addresses:[{ city, street, postalCode, country }] }`.

### 6 · `get-product-details` — get-by-id + `$expand`

```jsonc
{
  "id": "get-product-details",
  "name": "Get product details",
  "description": "Returns product master data by product number: type, group, base unit, weight, and the product description in the caller's language.",
  "tags": ["master-data", "product", "odata", "read"],
  "examples": [
    "Get details for product TG11.",
    "What is the base unit and description of material TG11?"
  ],
  "outputModes": ["application/json"]
}
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `product` | string | yes | Product / material number |

**Backend call** (header + description text via `$expand`)

```
GET /API_PRODUCT_SRV/A_Product('TG11')
    ?$select=Product,ProductType,ProductGroup,BaseUnit,GrossWeight,NetWeight,WeightUnit,to_Description/Language,to_Description/ProductDescription
    &$expand=to_Description
    &$format=json
```

**Returns:** `{ product, type, group, baseUnit, grossWeight, netWeight, weightUnit, descriptions:[{ language, text }] }`.

---

## Procurement

### 7 · `get-purchase-order-status` — get-by-id + `$expand`

```jsonc
{
  "id": "get-purchase-order-status",
  "name": "Get purchase order status",
  "description": "Returns the header of a purchase order by PO number — supplier, purchasing org/group, company code, currency — plus its line items (material, quantity, net price).",
  "tags": ["procurement", "odata", "read"],
  "examples": [
    "What is the status of purchase order 4500000123?",
    "Show the items on PO 4500000123."
  ],
  "outputModes": ["application/json"]
}
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `purchaseOrder` | string | yes | PO number |
| `includeItems` | boolean | no | When true, `$expand=to_PurchaseOrderItem` |

**Backend call**

```
GET /API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('4500000123')
    ?$select=PurchaseOrder,PurchaseOrderType,Supplier,PurchasingOrganization,PurchasingGroup,CompanyCode,PurchaseOrderDate,DocumentCurrency
    [ &$expand=to_PurchaseOrderItem ]
    &$format=json
```

**Returns:** `{ purchaseOrder, type, supplier, purchasingOrg, purchasingGroup, companyCode, orderDate, currency, items?:[...] }`.

### 8 · `list-purchase-orders-for-supplier` — list-with-filter

```jsonc
{
  "id": "list-purchase-orders-for-supplier",
  "name": "List purchase orders for a supplier",
  "description": "Returns recent purchase orders for a given supplier, newest first, with type, company code and currency. Optionally restrict by purchasing organization.",
  "tags": ["procurement", "odata", "read", "list"],
  "examples": [
    "List the last 20 purchase orders for supplier 10300001.",
    "Show recent POs for vendor 10300001 in purchasing org 1010."
  ],
  "outputModes": ["application/json"]
}
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `supplier` | string | yes | Supplier number; executor left-pads to 10 chars |
| `purchasingOrganization` | string | no | Restrict to one purchasing org |
| `top` | integer | no | Page size, default 20, max 100 |

**Backend call**

```
GET /API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder
    ?$select=PurchaseOrder,PurchaseOrderType,Supplier,PurchasingOrganization,CompanyCode,PurchaseOrderDate,DocumentCurrency
    &$filter=Supplier eq '0010300001'   [ and PurchasingOrganization eq '1010' ]
    &$orderby=PurchaseOrderDate desc
    &$top=20
    &$format=json
```

**Returns:** array of `{ purchaseOrder, type, supplier, purchasingOrg, companyCode, orderDate, currency }`.

### 9 · `get-supplier-invoice-status` — get-by-id (composite key)

```jsonc
{
  "id": "get-supplier-invoice-status",
  "name": "Get supplier invoice status",
  "description": "Returns a supplier (incoming) invoice by its document number and fiscal year: company code, dates, gross amount, currency and payment terms.",
  "tags": ["procurement", "finance", "odata", "read"],
  "examples": [
    "Get supplier invoice 5105600001 for fiscal year 2026.",
    "What is the gross amount of invoice 5105600001 / 2026?"
  ],
  "outputModes": ["application/json"]
}
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `supplierInvoice` | string | yes | Invoice document number |
| `fiscalYear` | string | yes | 4-digit fiscal year — part of the composite key |

**Backend call** (named composite key)

```
GET /API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice(SupplierInvoice='5105600001',FiscalYear='2026')
    ?$select=SupplierInvoice,FiscalYear,CompanyCode,DocumentDate,PostingDate,InvoiceGrossAmount,DocumentCurrency,PaymentTerms
    &$format=json
```

**Returns:** `{ supplierInvoice, fiscalYear, companyCode, documentDate, postingDate, grossAmount, currency, paymentTerms }`.

---

## Finance

### 10 · `list-gl-account-line-items` — list-with-filter (mandatory filter)

```jsonc
{
  "id": "list-gl-account-line-items",
  "name": "List G/L account line items",
  "description": "Returns journal-entry (G/L) line items for a company code and G/L account within a posting-date range. Use for 'what was posted to account X in period Y'. A company code, a G/L account and a date range are required.",
  "tags": ["finance", "gl", "odata", "read", "list"],
  "examples": [
    "Show line items for G/L account 0000400000 in company code 1010 for January 2026.",
    "List postings on account 400000 between 2026-01-01 and 2026-01-31 for company 1010."
  ],
  "outputModes": ["application/json"]
}
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `companyCode` | string | yes | Mandatory selection |
| `glAccount` | string | yes | Mandatory; executor left-pads to 10 chars |
| `postingDateFrom` | date | yes | Lower bound of posting date |
| `postingDateTo` | date | yes | Upper bound of posting date |
| `top` | integer | no | Page size, default 50, max 100 |

**Backend call** — this cube-style set **must** be constrained; the executor rejects the
call if company code, account or date range is missing.

```
GET /API_GLACCOUNTLINEITEM/GLAccountLineItem
    ?$select=CompanyCode,FiscalYear,GLAccount,AccountingDocument,PostingDate,DocumentDate,AmountInCompanyCodeCurrency,CompanyCodeCurrency,DebitCreditCode,DocumentItemText
    &$filter=CompanyCode eq '1010' and GLAccount eq '0000400000' and PostingDate ge datetime'2026-01-01T00:00:00' and PostingDate le datetime'2026-01-31T00:00:00'
    &$top=50
    &$format=json
```

**Returns:** array of `{ companyCode, fiscalYear, glAccount, accountingDocument, postingDate, documentDate, amount, currency, debitCredit, itemText }` from `d.results`.

### 11 · `get-gl-account-in-coa` — get-by-id (composite key)

```jsonc
{
  "id": "get-gl-account-in-coa",
  "name": "Get G/L account master (in chart of accounts)",
  "description": "Returns the chart-of-accounts master record for a G/L account: account type, account group, and corporate group account number.",
  "tags": ["finance", "master-data", "odata", "read"],
  "examples": [
    "Get G/L account 0000400000 in chart of accounts YCOA.",
    "What is the account group of account 400000 in COA YCOA?"
  ],
  "outputModes": ["application/json"]
}
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `chartOfAccounts` | string | yes | Part of composite key |
| `glAccount` | string | yes | Part of composite key; executor left-pads to 10 chars |

**Backend call**

```
GET /API_GLACCOUNTINCHARTOFACCOUNTS_SRV/A_GLAccountInChartOfAccounts(ChartOfAccounts='YCOA',GLAccount='0000400000')
    ?$select=ChartOfAccounts,GLAccount,GLAccountType,GLAccountGroup,CorporateGroupAccount
    &$format=json
```

**Returns:** `{ chartOfAccounts, glAccount, accountType, accountGroup, corporateGroupAccount }`.

---

## How this maps to the Agent Card and executor

- Each skill above contributes exactly one entry to the Agent Card `skills[]` array
  (the `jsonc` blocks are the entries verbatim; skill 1 lives in
  [`../docs/04-agent-card-and-skills.md`](../docs/04-agent-card-and-skills.md)).
- The executor keeps a static **skill → OData binding** table (service base path, entity set,
  key template or `$filter` template, `$select`, optional `$expand`, `$top` cap). The LLM
  never sees these bindings.
- All 6 services share the **single destination** described in
  [`../docs/03-destination-and-connectivity.md`](../docs/03-destination-and-connectivity.md);
  only the base path (`/sap/opu/odata/sap/<SERVICE>`) differs per skill.

## Composite skills (later, deterministic)

Cross-service questions — e.g. *“Show sales order 12345 with the sold-to party’s name and
address”* — are handled by **hand-written composite skills** that chain
`get-sales-order-status` → `get-business-partner-details` and merge the results. These are
added only after the single-service skills work and are **not** LLM planning steps. See
[`../docs/07-next-steps.md`](../docs/07-next-steps.md).

## Not in the focused catalog (and why)

- **All write actions / function imports** (34 in the full catalog) — read-only-first.
- **Child / item / partner / text / value-help sets** (159 of the 214) — reached via
  `$expand` inside header skills, never exposed directly.
- **13 of the 20 services** — no first-wave use case yet. Promoting one is cheap: pick its
  header set from [`odata-catalog.md`](./odata-catalog.md), copy the nearest template above.
