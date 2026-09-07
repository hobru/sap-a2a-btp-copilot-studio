# 07 · Next steps

A phased roadmap from this preparation package to a working, Copilot-Studio-consumable A2A agent. Each phase is small and independently verifiable.

## Phased roadmap

### Phase 0 — Decisions (before any code)
Confirm the open questions in [Decisions to confirm](#decisions-to-confirm) below.

### Phase 1 — Scaffold the CAP project
- `cds init a2a-agent`; add `srv/service.cds` with `service dummy {}`.
- Add deps: `@a2a-js/sdk @sap/cds @sap/xssec @sap-cloud-sdk/http-client @sap-cloud-sdk/connectivity` (+ dev: `@sap/cds-dk @cap-js/cds-typer typescript tsx`).
- **Pin the `@a2a-js/sdk` version** and read its `dist/**/*.d.ts` to confirm the exact `A2ARequestHandler`, task-store, executor, and Express-handler signatures. Adjust the skeletons in [`05-project-structure.md`](./05-project-structure.md) to match.
- **Verify:** `cds watch` starts; a stub Agent Card is served at `/.well-known/agent-card.json`.

### Phase 2 — One read-only skill, mocked backend
- Implement `get-sales-order-status` per [`04-agent-card-and-skills.md`](./04-agent-card-and-skills.md), against a **mocked** OData response first.
- **Verify:** POST an A2A `message/send` locally and get the shaped JSON artifact back.

### Phase 3 — Destination + Cloud Connector (real backend)
- Confirm the on-prem virtual host + `/sap/opu/odata/sap/` resource is exposed in the Cloud Connector (reuse [`guides/05-bulk-connector-automation.md`](https://github.com/hobru/sap-mcp-gateway-copilot-studio/blob/main/guides/05-bulk-connector-automation.md)).
- Create the `pm4-ssl` destination (`PrincipalPropagation`) per [`03-destination-and-connectivity.md`](./03-destination-and-connectivity.md).
- Switch the skill from mock to `executeHttpRequest({ destinationName: "pm4-ssl" })`.
- **Verify:** the skill returns real data for a known sales order (initially with a technical user or dev principal, before SSO is wired).

### Phase 4 — Inbound SSO (CAP-native IAS ↔ Entra ID)
- Bind the `identity` (IAS) service to the single `srv` module; IAS federates to **Entra ID** as the default auth provider.
- Validate the IAS JWT **inside the CAP app** (`srv/a2a/auth.js`, `@sap/xssec` against the bound `identity` service) — no App Router, no XSUAA, no `xs-security.json`.
- **Verify:** the JSON-RPC endpoint rejects unauthenticated calls; an IAS-issued token (aud == the app clientid) is accepted and the `mail`/`email` claim reaches the executor and drives principal propagation to the **real ABAP user**.

### Phase 5 — Deploy to Cloud Foundry
- Author `mta.yaml` (single `srv` module + `identity`/`connectivity`/`destination`/`application-logs` resources); `mbt build`; `cf deploy mta_archives/<app>_<ver>.mtar`.
- Set `A2A_SERVER_URL` to the public route so the served card advertises the real URL.
- **Verify:** the card is reachable at the deployed route and one skill works over the deployed chain.

### Phase 6 — Register in Copilot Studio
- Register the deployed Agent Card URL and configure the IAS OAuth2 connection per [`06-copilot-studio-integration.md`](./06-copilot-studio-integration.md).
- **Verify:** end-to-end, a Copilot Studio question runs `get-sales-order-status` **as the signed-in user**.

### Phase 7 — Expand the skill catalog
- Add skills incrementally across Sales → Procurement → Finance, one file + one `skills[]` entry each.
- **Verify each** against real backend data; keep entity-set/field names confirmed via `$metadata` / the `cap`/ADT MCP servers.

### Phase 8 (optional) — Broader NLU / server-side orchestration with Azure AI
- **Shipped:** plain-text questions are resolved to `(skill, params)` by the NLU in `srv/a2a/nlu.js` — **option A** (deterministic keyword/regex) is the default and needs no model. **Option B** (Azure OpenAI extraction) is already wired and env-gated: set the `AZURE_OPENAI_*` vars (see [`GETTING-STARTED.md`](../GETTING-STARTED.md) Section 6.1) to enable it; it falls back to A on any error.
- **Remaining (optional):** extend option B into a multi-service *planner* only if a single skill must plan across services from free text, keeping execution deterministic.
- **Deterministic by default.** Default design ships without any server-side model.

## Decisions to confirm

- [x] **Inbound auth boundary:** resolved — **CAP-native IAS** (the app validates the IAS JWT itself via `srv/a2a/auth.js`; no App Router, no XSUAA).
- [x] **First skill:** resolved — shipped with an 11-skill catalog across Sales/Procurement/Finance; `list-sales-orders` is the reference skill verified end-to-end.
- [x] **Entity/field verification:** resolved — entity sets + properties verified against the live backend for the shipped skills (OData **V2**).
- [ ] **Streaming:** advertise `capabilities.streaming: true` and implement `message/stream`, or start request/response only.
- [x] **Language:** resolved — **JavaScript** for the `srv` module.
- [x] **Naming:** resolved — destination `pm4-ssl`, project folder `a2a-cap-agent`.

## Prerequisites checklist

- [ ] BTP subaccount with CF, Destination, Connectivity, SAP Cloud Identity Services (`identity`), Application Logging entitlements ([`02-btp-services.md`](./02-btp-services.md))
- [ ] IAS tenant federated to Entra ID, trusted by the subaccount (Part 3)
- [ ] Cloud Connector connected, on-prem SAP virtual host + `/sap/opu/odata/sap/` resource exposed (Part 4 / guide 05)
- [ ] CERTRULE / principal-propagation mapping validated for a test user (Part 4)
- [ ] Local toolchain: Node, `@sap/cds-dk` (`cds -v` shows cds-dk), `cf` CLI, `mbt`
- [ ] Copilot Studio environment with permission to register an external agent + create an OAuth2 connection

## Out of scope for the first release

- Write/action skills (create/change) — read-only first.
- Composite multi-service skills — after single-service skills are proven.
- Server-side LLM — Copilot Studio does the reasoning.
