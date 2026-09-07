# 02 · Required BTP services

Everything the CAP A2A agent needs on **SAP BTP, Cloud Foundry**. Items marked **reused** already exist from Parts 3–4 and are not re-created.

## Services to entitle and bind

| Service | Plan (typical) | Why the agent needs it | Bound to |
|---|---|---|---|
| **Cloud Foundry runtime** | `MEMORY` / free-tier | Hosts the single CAP `srv` module | — |
| **Destination** | `lite` | Resolves the on-prem destination for outbound OData calls | `srv` |
| **Connectivity** | `lite` | Tunnels outbound calls through the **Cloud Connector** to the on-prem backend | `srv` |
| **SAP Cloud Identity Services (`identity`)** | `application` | Inbound token validation — the app validates the IAS-issued JWT itself (CAP-native, no XSUAA) | `srv` |
| **Application Logging** | `lite` | Structured logs / observability for the agent and skill calls | `srv` |
| **SAP Cloud Identity Services – IAS** | (subscription) · **reused** | Issues the SSO token Copilot Studio presents; federated to Entra ID | trust config |
| **SAP Cloud Connector** | (on-prem component) · **reused** | Exposes the on-prem SAP system under a virtual host; mints per-user X.509 | — |

> **Inbound auth is CAP-native IAS — there is no App Router and no XSUAA.** The `srv` module binds the `identity` service and validates the IAS JWT directly (`srv/a2a/auth.js`: signature via the bound service, `aud` == the app's clientid). This replaces the App Router + XSUAA front door used earlier in the series; the SSO experience for Copilot Studio is unchanged.

## Optional (only if server-side orchestration is added later)

| Service / resource | Purpose | Note |
|---|---|---|
| **Destination** entry for **Azure AI** | Holds the Azure OpenAI endpoint + key so the CAP app can call it via the SAP Cloud SDK | Optional; default design uses no server-side model |

> **Note:** reasoning stays in Copilot Studio; if a server-side model is ever required it is **Azure AI**.

## npm dependencies (for the eventual `srv` module)

Runtime:

- `@a2a-js/sdk` — A2A server: Agent Card + JSON-RPC Express handlers, task store, executor interfaces
- `@sap/cds` — CAP runtime (Express bootstrap hook)
- `@sap/xssec` — inbound IAS JWT validation against the bound `identity` service (CAP-native, no XSUAA)
- `@sap-cloud-sdk/http-client` + `@sap-cloud-sdk/connectivity` — outbound OData via destination + Cloud Connector

Dev:

- `@sap/cds-dk`, `@cap-js/cds-typer`, `typescript`, `tsx`

> Pin the **exact** `@a2a-js/sdk` version during scaffolding and confirm the handler / task-store / executor signatures against its `dist/**/*.d.ts` — the SDK surface evolves. This is a **build-phase** action, not part of this preparation.

## Entitlement checklist (subaccount)

- [ ] Cloud Foundry runtime enabled, org + space available
- [ ] Destination — `lite`
- [ ] Connectivity — `lite`
- [ ] SAP Cloud Identity Services (`identity`) — `application`
- [ ] Application Logging — `lite`
- [ ] IAS trust to the subaccount configured (reused from Part 3)
- [ ] Cloud Connector connected to the subaccount, backend virtual host exposed (reused from Part 4)
- [ ] (Optional) Destination entitlement headroom for an Azure AI endpoint

## How bindings appear in the deployment descriptor

At build time these become `resources` in `mta.yaml` and `requires` on the single `srv` module (the `identity` resource binds IAS). There is no `approuter` module and no `xs-security.json`. The descriptor itself is produced in the scaffolding phase — see [`05-project-structure.md`](./05-project-structure.md) for the intended file layout.
