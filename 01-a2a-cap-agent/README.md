# A2A CAP Agent on SAP BTP

A **SAP CAP (Node.js)** application on **SAP BTP, Cloud Foundry** that exposes an **Agent-to-Agent (A2A)** server and **orchestrates over multiple on-premise SAP OData services** reached through a **BTP Destination + SAP Cloud Connector**. The A2A agent is consumed by **Microsoft Copilot Studio** over **SSO** — the same **SAP IAS (federated to Entra ID) → Cloud Connector → principal-propagation** identity chain used in Parts 3–4 of this series.

> **Status:** deployed to Cloud Foundry and **verified end-to-end from Microsoft Copilot Studio** (SSO via IAS→Entra; live sales-order query returns a Markdown table). The CAP app serves a public **Agent Card** + **health** endpoint and an **IAS-protected** JSON-RPC A2A endpoint, backed by a **declarative, extensible skill catalog** (`srv/a2a/skills/*.yaml`) executed by one generic deterministic OData executor, with a plain-text **NLU** (option A deterministic default; option B Azure OpenAI, env-gated) resolving free-text questions to skills. Inbound auth is **CAP-native IAS** (no approuter, no XSUAA). See [`GETTING-STARTED.md`](./GETTING-STARTED.md) to run it locally, add skills, and deploy. The design docs under [`docs/`](./docs) remain the architecture reference; [`docs/07-next-steps.md`](./docs/07-next-steps.md) tracks the remaining phases.

## Why this exists — a third front door

The MCP Gateway series ([Parts 1–5](https://github.com/hobru/sap-mcp-gateway-copilot-studio/blob/main/README.md)) connects Copilot Studio to SAP through the **MCP Gateway** on Integration Suite. This package designs an **alternative front door** for the *same* backend and the *same* identity chain:

| | MCP Gateway (Parts 1–5) | API Management (mentioned in series) | **A2A CAP agent (this package)** |
|---|---|---|---|
| Runtime | Integration Suite / Integration Cell | API Management + Integration Cell | **CAP Node.js app on Cloud Foundry** |
| Protocol to Copilot Studio | MCP (custom connectors) | REST | **A2A** (Agent Card + JSON-RPC) |
| Backend reach | BTP Destination → Cloud Connector | BTP Destination → Cloud Connector | **BTP Destination → Cloud Connector** |
| Inbound identity | IAS JWT (real user) | IAS JWT (real user) | **IAS JWT (real user), CAP-native (no approuter)** |
| Backend execution | Principal propagation → real ABAP user | Principal propagation → real ABAP user | **Principal propagation → real ABAP user** |
| Orchestration | One flow per endpoint | One API per endpoint | **One agent, many skills over many OData services** |

The key difference is **orchestration**: instead of one connector per OData endpoint, a single A2A agent exposes a curated set of **skills** and can compose several backend OData calls to answer one business question — while Copilot Studio remains the reasoning layer.

> Like the MCP Gateway, this pattern stays inside the **[SAP API Policy](https://help.sap.com/doc/sap-api-policy/latest/en-US/API_Policy_latest.pdf)**: the CAP agent calls **published** OData services as a **Documented Use**, and every call runs as the **real ABAP user** via principal propagation.

## Contents

| Doc | What it covers |
|---|---|
| [`GETTING-STARTED.md`](./GETTING-STARTED.md) | **How to run it** — local dev with mocked auth, adding/editing skills (YAML), the exact A2A request shape, `mbt build`/`cf deploy`, IAS + Entra federation, and Copilot Studio registration |
| [`docs/01-architecture.md`](./docs/01-architecture.md) | End-to-end architecture, request flow, the reused SSO identity chain, and where orchestration lives |
| [`docs/02-btp-services.md`](./docs/02-btp-services.md) | Required BTP services, entitlements/plans, and service bindings |
| [`docs/03-destination-and-connectivity.md`](./docs/03-destination-and-connectivity.md) | The Destination + Cloud Connector setup and per-service base paths for all 20 OData services |
| [`docs/04-agent-card-and-skills.md`](./docs/04-agent-card-and-skills.md) | A2A Agent Card design, inbound security scheme, and the skill catalog over Sales / Procurement / Finance (one read-only skill fully specified) |
| [`docs/05-project-structure.md`](./docs/05-project-structure.md) | The intended CAP project layout (files described, not created) |
| [`docs/06-copilot-studio-integration.md`](./docs/06-copilot-studio-integration.md) | Registering and consuming the A2A agent from Copilot Studio with SSO |
| [`docs/07-next-steps.md`](./docs/07-next-steps.md) | Phased build roadmap, decisions to confirm, and prerequisites |
| [`reference/odata-services-evaluation.md`](./reference/odata-services-evaluation.md) | **Backend evaluation of all 20 OData services** — verified entity sets, keys, and function imports; headline finding: all services are **OData V2** |
| [`reference/focused-skill-catalog.md`](./reference/focused-skill-catalog.md) | **The curated “good A2A design”** — 11 fully-specified read-only skills across Sales / Procurement / Finance (get-by-id, get-by-id + `$expand`, list-with-filter), each backed by verified entity sets/keys/fields. The tight surface Copilot Studio actually consumes, distilled from the 214-set full menu |
| [`reference/odata-catalog.md`](./reference/odata-catalog.md) | **Full exhaustive catalog of all 214 entity sets** (55 root / 138 child / 21 text-value-help) + 34 function imports, grouped by domain → service. The complete raw menu the focused skill set is drawn from (intentionally over-complete — see the doc's status note) |
| [`reference/odata-catalog.json`](./reference/odata-catalog.json) | Machine-readable version of the full catalog: every property with EDM type, `sap:label`/`quickinfo`, filterable/sortable/creatable/updatable flags, keys, and navigation |
| [`reference/agent-card.example.json`](./reference/agent-card.example.json) | Illustrative Agent Card (design artifact — not yet wired to a running service) |

## Target OData services (the orchestration surface)

The agent will eventually orchestrate over the S/4HANA OData services documented in [Part 5](https://github.com/hobru/sap-mcp-gateway-copilot-studio/blob/main/guides/05-bulk-connector-automation.md) — Sales (7) + Procurement (8) + Finance (6). The catalogue lists 21 rows, but `API_SUPPLIERINVOICE_PROCESS_SRV` appears under both Procurement and Finance, so there are **20 unique services**. All 20 have been **evaluated against the live backend** — see [`reference/odata-services-evaluation.md`](./reference/odata-services-evaluation.md) (headline: every service is **OData V2**). Full mapping to skills is in [`docs/04-agent-card-and-skills.md`](./docs/04-agent-card-and-skills.md).

## Ground rules for this design

- **Deterministic by default; reasoning in Copilot Studio.** If server-side model reasoning is ever required, use **Azure AI (Azure OpenAI)** — see the optional orchestration note in [`docs/01-architecture.md`](./docs/01-architecture.md). The default design keeps the CAP app **deterministic** and leaves reasoning to Copilot Studio.
- **Read-only first.** The first implemented skill is a single read-only use case (sales-order status); write/action skills are a later, deliberate phase.
- **Reuse, don't rebuild, the identity chain.** IAS, Entra federation, Cloud Connector, and CERTRULE mapping from Part 4 are assumed to be in place.

## Credits & inspiration

This package was inspired by SAP's own pro-code A2A work. It adapts the pattern so the reasoning LLM lives in **Microsoft Copilot Studio** and the CAP app is a deterministic OData skill executor. Credit for the underlying pattern (wiring A2A into CAP, the Agent Card / handler / executor shape, destination-based backend calls) goes to these SAP sources:

- **SAP blog — [A2A Agents on SAP BTP: Wiring the Agent-to-Agent Protocol into CAP](https://community.sap.com/t5/technology-blog-posts-by-sap/a2a-agents-on-sap-btp-wiring-the-agent-to-agent-protocol-into-cap/ba-p/14378591)** — the most directly reused idea: mounting the `@a2a-js/sdk` Express handlers into CAP's `cds.on("bootstrap")` so the Agent Card + JSON-RPC endpoint are served natively by the CAP app.
- **SAP blog series — Building a Pro-Code Agent on SAP BTP:**
  - [Part 1 — The Data Layer (CAP, HANA, and MCP)](https://community.sap.com/t5/technology-blog-posts-by-sap/building-a-pro-code-agent-on-sap-btp-part-1-the-data-layer-cap-hana-and-mcp/ba-p/14462561)
  - [Part 2 — The Agent (LangGraph + GenAI Hub)](https://community.sap.com/t5/technology-blog-posts-by-sap/building-a-pro-code-agent-on-sap-btp-part-2-the-agent-langgraph-genai-hub/ba-p/14464244)
  - [Part 3 — Joule Integration via A2A](https://community.sap.com/t5/technology-blog-posts-by-sap/building-a-pro-code-agent-on-sap-btp-part-3-joule-integration-via-a2a/ba-p/14465454) — the A2A "Bring Your Own Agent" integration this package builds on for Copilot Studio.
- **SAP sample repo — [SAP-samples/btp-joule-a2a-pro-code-agent](https://github.com/SAP-samples/btp-joule-a2a-pro-code-agent)** — the reference `server.ts` A2A bootstrap (Agent Card, task store, executor). This package keeps that server shape with its own deterministic OData executor.
- **SAP blog — [Build a Pro-Code A2A Agent for SAP S/4HANA Cloud with the CAP Agent Plugin](https://community.sap.com/t5/technology-blog-posts-by-sap/build-a-pro-code-a2a-agent-for-sap-s-4hana-cloud-with-the-cap-agent-plugin/ba-p/14468390)** *(further reading)* — a newer take that builds the agent with SAP's official **`@cap-js/agents` CAP Agent Plugin** (currently **Beta**): you import the S/4HANA OData API (EDMX → CDS), expose entities plus a `createDelivery` action in a CAP service, and add an `@agent` annotation to register it as an A2A/MCP endpoint. Crucially it binds an **in-process LLM via SAP AI Core** (`llm: { kind: "aicore", model: "anthropic--claude-4.6-sonnet" }`) and is tested from an **MCP client (Claude Desktop)**, with **Joule** integration promised in a follow-up post. This package takes the complementary approach — here the CAP app stays a **deterministic, in-process-LLM-free** OData executor and reasoning lives **client-side in Microsoft Copilot Studio**. Worth reading to see the official plugin path and to compare the two design trade-offs.
- **SAP blog — [Integrate a Pro-Code CAP A2A Agent with Joule](https://community.sap.com/t5/technology-blog-posts-by-sap/integrate-a-pro-code-cap-a2a-agent-with-joule/ba-p/14470264)** *(further reading)* — the follow-up to the CAP Agent Plugin post above: it registers the deployed `@cap-js/agents` endpoint with **Joule** as a "Bring Your Own Agent". Read it alongside our Copilot Studio integration to compare the two consuming channels for the *same* A2A boundary.
