# 03 · Destination & connectivity

All 20 OData services (21 catalogue rows minus the duplicate `API_SUPPLIERINVOICE_PROCESS_SRV`) live on the **same on-prem SAP system**, already exposed through the **Cloud Connector** virtual host from [Part 4](https://github.com/hobru/sap-mcp-gateway-copilot-studio/blob/main/guides/04-principal-propagation.md). That means **one destination** — not 20 — with per-service paths differentiating the calls.

> **Validated against the backend.** All 20 services were reached and parsed live and are **OData V2** — see [`../reference/odata-services-evaluation.md`](../reference/odata-services-evaluation.md) for verified entity sets, keys, and the V2 call conventions (`$format=json`, `d`/`d.results` envelope, `EntitySet('key')` access).

> Values below are **masked** and carried over from Part 4 for continuity. Replace with your real subaccount / backend values at build time.

## The single destination — two phases

We roll this out in two phases against **one** destination the skills reference by name (`pm4-ssl`).

**Phase 1 — current trial setup (IAS SSO first).** The destination already exists on the subaccount as a plain Internet call with a technical user, so we can prove the inbound IAS SSO flow end-to-end before touching the Cloud Connector:

| Property | Value | Notes |
|---|---|---|
| `Name` | `pm4-ssl` | Referenced in code as `destinationName` (env `SAP_DESTINATION_NAME`) |
| `Type` | `HTTP` | |
| `URL` | `https://microsoftintegrationdemo.com:44301` | Direct backend host (no Cloud Connector yet) |
| `ProxyType` | `Internet` | Direct outbound |
| `Authentication` | `BasicAuthentication` | Stored technical user (backend identity comes from the destination) |

In phase 1 the CAP app does **not** thread the caller's IAS token outbound (`PRINCIPAL_PROPAGATION` is unset/false), so the destination's own basic auth is used. This isolates and validates the inbound side: Copilot Studio → IAS (federated to Entra) → CAP app.

**Phase 2 — target on-prem setup (per-user SSO to ABAP).** Once the IAS flow works, the **same** destination is switched to route through the Cloud Connector with principal propagation — no code change, only the destination config plus setting `PRINCIPAL_PROPAGATION=true`:

| Property | Value | Notes |
|---|---|---|
| `Name` | `pm4-ssl` | Unchanged — code keeps calling the same name |
| `Type` | `HTTP` | |
| `URL` | `https://pm4.internal.ssl:44301` | The **Cloud Connector virtual host**, not the real host |
| `ProxyType` | `OnPremise` | Routes through Connectivity + Cloud Connector |
| `Authentication` | `PrincipalPropagation` | Per-user SSO; no stored technical credential |
| `CloudConnectorLocationId` | `PM4-Trial` | Matches the Cloud Connector Location ID |
| `sap-client` (URL param or header) | `400` | Backend client |

Additional properties commonly set for OData/HTML5 consumption (optional at this stage): `WebIDEEnabled=true`, `HTML5.DynamicDestination=true`, `sap-platform=ABAP`.

In **phase 2** the destination uses **PrincipalPropagation**, so the outbound call carries the **end user's identity** (from the IAS `mail` claim) all the way to a **real ABAP user** via the Cloud Connector's short-lived X.509 cert + **CERTRULE** mapping — exactly as in Part 4. No service/technical user is stored in the destination.

## Principal propagation chain (reused, unchanged)

```
CAP app ─▶ Destination (PrincipalPropagation) ─▶ Connectivity proxy ─▶ Cloud Connector
   │                                                                      │
   │  identity = IAS `mail` claim                    mints short-lived per-user X.509 (CN = mail)
   ▼                                                                      ▼
   answer ◀──────────────────── on-prem SAP ICM (mutual TLS) ◀── CERTRULE maps cert → SU01 user
```

Masked example mapping from Part 4: `hobru…t.com` → ABAP user `HOBR…CHE`, backend `PM4` / client `400`, CA = the Cloud Connector Principal-Propagation CA.

## Calling a service in code (design shape)

The SAP Cloud SDK resolves the destination and tunnels through the Cloud Connector; the skill executor only supplies the **relative** OData path:

```ts
import { executeHttpRequest } from "@sap-cloud-sdk/http-client";

const res = await executeHttpRequest(
  { destinationName: "pm4-ssl" },
  {
    method: "get",
    url: "/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder('12345')?$format=json",
  },
);
```

Every service is reached at `/sap/opu/odata/sap/<SERVICE>/<EntitySet>` on the same destination.

## Service → base path map (21 catalogue rows / 20 unique)

### Sales (7)

| Service | Base path |
|---|---|
| `API_SALES_ORDER_SRV` | `/sap/opu/odata/sap/API_SALES_ORDER_SRV/` |
| `API_OUTBOUND_DELIVERY_SRV` | `/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV/` |
| `API_CUSTOMER_RETURN_SRV` | `/sap/opu/odata/sap/API_CUSTOMER_RETURN_SRV/` |
| `API_SALES_QUOTATION_SRV` | `/sap/opu/odata/sap/API_SALES_QUOTATION_SRV/` |
| `API_SALES_INQUIRY_SRV` | `/sap/opu/odata/sap/API_SALES_INQUIRY_SRV/` |
| `API_BUSINESS_PARTNER` | `/sap/opu/odata/sap/API_BUSINESS_PARTNER/` |
| `API_PRODUCT_SRV` | `/sap/opu/odata/sap/API_PRODUCT_SRV/` |

### Procurement (8)

| Service | Base path |
|---|---|
| `API_PURCHASEORDER_PROCESS_SRV` | `/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/` |
| `API_PURCHASEREQ_PROCESS_SRV` | `/sap/opu/odata/sap/API_PURCHASEREQ_PROCESS_SRV/` |
| `API_PURCHASECONTRACT_PROCESS_SRV` | `/sap/opu/odata/sap/API_PURCHASECONTRACT_PROCESS_SRV/` |
| `API_RFQ_PROCESS_SRV` | `/sap/opu/odata/sap/API_RFQ_PROCESS_SRV/` |
| `API_QTN_PROCESS_SRV` | `/sap/opu/odata/sap/API_QTN_PROCESS_SRV/` |
| `API_SUPPLIERINVOICE_PROCESS_SRV` | `/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/` |
| `API_INFORECORD_PROCESS_SRV` | `/sap/opu/odata/sap/API_INFORECORD_PROCESS_SRV/` |
| `API_SERVICE_ENTRY_SHEET_SRV` | `/sap/opu/odata/sap/API_SERVICE_ENTRY_SHEET_SRV/` |

### Finance (6)

| Service | Base path |
|---|---|
| `API_GLACCOUNTLINEITEM` | `/sap/opu/odata/sap/API_GLACCOUNTLINEITEM/` |
| `API_OPLACCTGDOCITEMCUBE_SRV` | `/sap/opu/odata/sap/API_OPLACCTGDOCITEMCUBE_SRV/` |
| `API_JOURNALENTRYITEMBASIC_SRV` | `/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV/` |
| `API_CHARTOFACCOUNTS_SRV` | `/sap/opu/odata/sap/API_CHARTOFACCOUNTS_SRV/` |
| `API_GLACCOUNTINCHARTOFACCOUNTS_SRV` | `/sap/opu/odata/sap/API_GLACCOUNTINCHARTOFACCOUNTS_SRV/` |
| `API_SUPPLIERINVOICE_PROCESS_SRV` | `/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/` |

> `API_SUPPLIERINVOICE_PROCESS_SRV` appears in both Procurement and Finance — it is **one** service on the backend and needs the Cloud Connector resource exposed **once**. Skills in either group reuse the same path.

## Cloud Connector resource exposure

For each service the Cloud Connector's **Access Control → Resources** for the virtual host must permit the path prefix `/sap/opu/odata/sap/` (or each `<SERVICE>` sub-path explicitly). Because all services share the `/sap/opu/odata/sap/` root, a single **path + sub-paths** resource entry covers all 20. The metadata endpoints (`/$metadata`) under the same prefix are covered by the same rule.

> Automating this exposure across many services is exactly what [`guides/05-bulk-connector-automation.md`](https://github.com/hobru/sap-mcp-gateway-copilot-studio/blob/main/guides/05-bulk-connector-automation.md) covers — reuse that approach rather than clicking 21 entries by hand.
