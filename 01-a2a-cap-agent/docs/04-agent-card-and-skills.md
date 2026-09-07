# 04 · Agent Card & skill design

The **Agent Card** at `/.well-known/agent-card.json` is the contract Copilot Studio consumes. It declares who the agent is, how to authenticate (SSO), and the **skills** available. This document designs that card and the skill catalog over the 21 OData services. A concrete example lives in [`../reference/agent-card.example.json`](../reference/agent-card.example.json) — that file is a **design artifact**, not deployed config.

## Agent Card shape

| Field | Value / intent |
|---|---|
| `name` | `SAP Backend Agent` |
| `description` | Read access to SAP Sales, Procurement and Finance data via OData. |
| `url` | The deployed public route, injected at runtime from `A2A_SERVER_URL` |
| `provider` | `{ organization, url }` |
| `version` | Semantic version of the agent (e.g. `0.1.0`) |
| `protocolVersion` | A2A protocol version supported by the pinned `@a2a-js/sdk` |
| `capabilities` | `{ streaming: true, pushNotifications: false, stateTransitionHistory: false }` |
| `defaultInputModes` | `["text"]` |
| `defaultOutputModes` | `["text", "json"]` |
| `securitySchemes` | **OAuth2 authorization-code** pointing at **IAS** authorize/token URLs (SSO) |
| `security` | Requires the OAuth2 scheme above |
| `skills[]` | The catalog below |

### Inbound security scheme (SSO)

The card advertises how Copilot Studio obtains a token — the same **IAS / Entra-federated** OAuth2 auth-code flow used by the earlier custom connectors:

```jsonc
"securitySchemes": {
  "sap_ias_sso": {
    "type": "oauth2",
    "flows": {
      "authorizationCode": {
        "authorizationUrl": "https://<your-ias-tenant>.accounts.ondemand.com/oauth2/authorize",
        "tokenUrl": "https://<your-ias-tenant>.accounts.ondemand.com/oauth2/token",
        "scopes": {}
      }
    }
  }
},
"security": [{ "sap_ias_sso": [] }]
```

The token Copilot Studio receives is validated **inside the CAP app** (`srv/a2a/auth.js`, CAP-native IAS — no App Router, no XSUAA) before the request reaches the skill executor; the `mail` claim drives principal propagation to the backend.

### Browser discoverability (CORS)

The card is fetched **from the browser** by Copilot Studio during discovery, so the response **must** carry CORS headers — otherwise the browser blocks the cross-origin read and Copilot Studio reports *"We couldn't find an agent card at this URL"* even though the endpoint returns `200` and renders fine when you open it directly.

`srv/server.js` therefore installs a CORS middleware as the **first** handler in `cds.on("bootstrap")`, before any route, so both the card and the JSON-RPC endpoint answer pre-flight requests:

```js
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});
```

This only governs **who may read the response in a browser**; it is not authentication. The JSON-RPC endpoint stays protected by the IAS token check above — a token-less `POST` still returns `401`. Verify with:

```bash
curl -i https://<route>/.well-known/agent-card.json   # expect: access-control-allow-origin: *
curl -i -X OPTIONS https://<route>/.well-known/agent-card.json   # expect: 204 + CORS headers
```

## Skill catalog (design)

Skills are **read-only** first, grouped by domain. Each row becomes one `skills[]` entry (with `id`, `name`, `description`, `tags`, `examples`, `outputModes`) and maps to a deterministic OData call in the executor. The catalog is intentionally **curated** — not one skill per entity set — so Copilot Studio sees a small, well-described surface.

> **This curated list is drawn from the full menu.** The complete, exhaustive catalog of all **214 entity sets** across the 20 services lives in [`../reference/odata-catalog.md`](../reference/odata-catalog.md) (and `odata-catalog.json`). Exposing all of them as skills would be poor A2A design; the skills below are the deliberately small subset promoted from that menu. Child/item/text sets are reached via `$expand` *inside* these header skills, not as separate skills.
>
> **Fully-specified version:** the table below is an overview. Every skill is specified in full (Agent Card entry + input params + verified backend `GET` with `$select`/`$filter`/`$expand` + output shape) in [`../reference/focused-skill-catalog.md`](../reference/focused-skill-catalog.md) — the authoritative curated catalog.

### Sales

| Skill id | Backend service · entity set | Purpose |
|---|---|---|
| `get-sales-order-status` | `API_SALES_ORDER_SRV` · `A_SalesOrder` | Status + header of a sales order by id |
| `list-sales-orders-for-customer` | `API_SALES_ORDER_SRV` · `A_SalesOrder` | Recent orders filtered by sold-to party |
| `get-outbound-delivery-status` | `API_OUTBOUND_DELIVERY_SRV` · `A_OutbDeliveryHeader` | Delivery status by delivery id |
| `get-sales-quotation-status` | `API_SALES_QUOTATION_SRV` · `A_SalesQuotation` | Quotation status + header by quotation id |
| `get-business-partner-details` | `API_BUSINESS_PARTNER` · `A_BusinessPartner` | Master-data lookup by BP number (+`$expand` address) |
| `get-product-details` | `API_PRODUCT_SRV` · `A_Product` | Product master lookup by product id (+`$expand` description) |

### Procurement

| Skill id | Backend service · entity set | Purpose |
|---|---|---|
| `get-purchase-order-status` | `API_PURCHASEORDER_PROCESS_SRV` · `A_PurchaseOrder` | PO header + status by PO number (+`$expand` items) |
| `list-purchase-orders-for-supplier` | `API_PURCHASEORDER_PROCESS_SRV` · `A_PurchaseOrder` | Recent POs filtered by supplier |
| `get-supplier-invoice-status` | `API_SUPPLIERINVOICE_PROCESS_SRV` · `A_SupplierInvoice` | Invoice status by document id + fiscal year (composite key) |

### Finance

| Skill id | Backend service · entity set | Purpose |
|---|---|---|
| `list-gl-account-line-items` | `API_GLACCOUNTLINEITEM` · `GLAccountLineItem` | G/L line items by company code / account / posting-date range |
| `get-gl-account-in-coa` | `API_GLACCOUNTINCHARTOFACCOUNTS_SRV` · `A_GLAccountInChartOfAccounts` | G/L account master in a chart of accounts (composite key) |

> The entity-set and property names above have been **verified against the live backend** — all 20 services are **OData V2**, and the header entity sets / keys are confirmed in [`../reference/odata-services-evaluation.md`](../reference/odata-services-evaluation.md). When implementing, request JSON explicitly (`$format=json`) and read results from the V2 `d` / `d.results` envelope.

## One skill, fully specified — `get-sales-order-status`

The reference skill the first build iteration should implement end-to-end.

**Agent Card entry**

```jsonc
{
  "id": "get-sales-order-status",
  "name": "Get sales order status",
  "description": "Returns the header and overall status of a single sales order, given its sales order number.",
  "tags": ["sales", "odata", "read"],
  "examples": [
    "What is the status of sales order 12345?",
    "Show me the details of sales order number 12345."
  ],
  "outputModes": ["application/json"]
}
```

**Input parameters** (parsed by the executor from the A2A message)

| Name | Type | Required | Notes |
|---|---|---|---|
| `salesOrder` | string | yes | Sales order number (e.g. `12345`) |

**Backend call**

```
GET /sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder('12345')
    ?$select=SalesOrder,SalesOrderType,SoldToParty,OverallSDProcessStatus,TotalNetAmount,TransactionCurrency
    &$format=json
```

**Executor logic (deterministic)**

1. Validate `salesOrder` is present and well-formed.
2. Build the URL above with `$select` narrowed to the fields the skill returns.
3. `executeHttpRequest({ destinationName: "pm4-ssl" }, { method: "get", url })`.
4. Map the OData entity to a compact JSON artifact:
   ```json
   {
     "salesOrder": "12345",
     "type": "OR",
     "soldToParty": "0000004711",
     "overallStatus": "C",
     "netAmount": "1500.00",
     "currency": "EUR"
   }
   ```
5. Publish the artifact + a `completed` task status on the A2A event bus.
6. On `404` / empty result, return a `failed`/`input-required` task with a clear message ("Sales order 12345 not found").

**Why read-only, single-entity first:** it exercises the entire chain — A2A JSON-RPC in, IAS identity, principal propagation, Cloud Connector, one OData `GET`, artifact out — with the least surface area. Every subsequent skill is a variation on this template.

## Composite skills (later)

Some questions naturally span services — e.g. *"Show sales order 12345 with the sold-to party's name and address."* A composite skill would call `API_SALES_ORDER_SRV` then `API_BUSINESS_PARTNER` and merge the results. This composition is **hand-written and deterministic**, added only after the single-service skills work. It is **not** an LLM planning step (that would be the optional Azure AI phase in [`07-next-steps.md`](./07-next-steps.md)).
