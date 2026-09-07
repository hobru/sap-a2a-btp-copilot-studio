# SAP A2A Agents for Microsoft Copilot Studio

Bring your **on-premise / private-cloud SAP** system to **Microsoft Copilot Studio** through the
**Agent-to-Agent (A2A)** protocol — built on **SAP CAP (Node.js)**, deployed to **SAP BTP,
Cloud Foundry**, and reaching the backend over a **BTP Destination + SAP Cloud Connector** with
the real ABAP user via **principal propagation** (IAS federated to Entra ID).

This repository is a **progression of three projects** over the *same* engine — a single
generic, deterministic OData executor driven by declarative **skill YAML** (no per-skill code).
Copilot Studio stays the reasoning layer.

## Ground rules (all three projects)

- **Deterministic executor, reasoning in Copilot Studio.** The CAP app is a deterministic OData skill
  executor; reasoning lives in **Microsoft Copilot Studio**. If server-side reasoning is ever
  needed, it uses **Azure OpenAI** (opt-in, env-gated).
- **Read-only first.** V1 skills are `getByKey` / `list` over **published** OData services as a
  Documented Use; write/action skills are a later, deliberate phase.
- **Reuse, don't rebuild, the identity chain.** IAS → Entra federation, Cloud Connector, and
  principal propagation are assumed in place.

## Architecture stance

This split is a deliberate strategic choice, not an incidental one:

- **Reasoning lives in the Microsoft Copilot layer by design.** Planning, tool selection, and
  natural-language understanding belong to **Copilot Studio** (and any other Microsoft Copilot
  channel) — never inside the SAP app.
- **The CAP app is a deterministic, auditable, read-only A2A skill provider.** Each skill maps to
  exactly **one** backend OData call; there is **no in-process LLM**. Behaviour is reproducible and
  reviewable, which is what makes it safe in front of a system of record.
- **Microsoft is the consuming client, on purpose.** Identity flows through **Entra ID ↔ IAS
  federation** with **principal propagation** to the SAP backend, so the real user — not a service
  account — reaches ABAP.
- **Relationship to SAP's pro-code A2A direction.** SAP's own `@cap-js/agents` path runs an
  in-process LLM engine; we deliberately keep reasoning **client-side** so the **same deterministic
  SAP boundary serves any Microsoft Copilot channel** without re-platforming. For the official
  plugin approach — `@agent`-annotated CAP services with an **in-process LLM bound via SAP AI Core**,
  callable from **MCP clients / Joule** — see SAP's [Build a Pro-Code A2A Agent for SAP S/4HANA Cloud
  with the CAP Agent Plugin](https://community.sap.com/t5/technology-blog-posts-by-sap/build-a-pro-code-a2a-agent-for-sap-s-4hana-cloud-with-the-cap-agent-plugin/ba-p/14468390)
  (`@cap-js/agents`, currently Beta — further reading).

### Why reasoning lives outside the app

This project deliberately keeps the language model **out** of the CAP application. The app is a
deterministic executor: each skill maps to exactly one backend call, so its behaviour is
reproducible, auditable, and reviewable — the properties you want in front of a system of record.
Reasoning, planning, and natural-language understanding live in the **consuming client** instead.

This separation buys three things. **Determinism at the data boundary** — no in-process model
means no non-reproducible behaviour where the app touches the backend. **Identity integrity** —
because the client reasons *as the user*, each backend call carries the real user's identity and
authorizations rather than a shared service account. **Channel independence** — the same
deterministic surface can be consumed by any reasoning client, so adding or switching front-ends
never requires re-platforming the backend layer.

The trade-off is explicit: the app is a *tool*, not an autonomous agent. It relies on a capable
external reasoner to be useful, and in return stays a small, predictable, per-user-authorized
capability provider.

## The three projects

| # | Project | What it is | Status |
|---|---------|------------|--------|
| **01** | **[Getting Started — preconfigured agent](./01-a2a-cap-agent/)** | The full working app: **11 skills across 9 S/4HANA OData services** (Sales / Procurement / Finance), deployed to Cloud Foundry and **verified end-to-end from Copilot Studio over SSO**. Clone, configure your destination, deploy. | ✅ **Ready** |
| **02** | **[DIY Skeleton — build your own](./02-a2a-cap-template/)** | The **same engine, content-emptied**: a template + `create-skill.js` scaffolder + a step-by-step **[TUTORIAL](./02-a2a-cap-template/TUTORIAL.md)** so you plug in **your own** OData service and add skills in YAML — no JS. Ships **8 demo skills** over the SAP sample services (GWSAMPLE_BASIC / RMTSAMPLEFLIGHT). `01` is the worked example to follow. | 🛠️ **In progress — try the [tutorial](./02-a2a-cap-template/TUTORIAL.md)** |
| **03** | **[SAP Catalog Agent](./03-a2a-cap-catalog-agent/)** | Points at **any** SAP backend, **introspects the OData catalog**, curates it, reads each service's `$metadata`, and generates a **capability index**. Exposes generic **meta-skills** (`listServices` → `describeService` → `describeEntitySet` → `searchEntitySet` / `getByKey`) plus a curated **featured** subset, over two new read-only engine operations (`catalog`, `dynamic`) — index-validated, deterministic SAP access at scale. | 🧪 **Preview/Built** — see [README](./03-a2a-cap-catalog-agent/README.md) |

> **Start with [`01-a2a-cap-agent/`](./01-a2a-cap-agent/)** — its
> [`README`](./01-a2a-cap-agent/README.md) explains the architecture and the reused SSO identity
> chain, and [`GETTING-STARTED.md`](./01-a2a-cap-agent/GETTING-STARTED.md) is the run/extend/deploy guide.

## How the three relate

```
        ┌─────────────────────── shared engine ───────────────────────┐
        │  registry (YAML loader) · generic OData executor · NLU        │
        └──────────────────────────────────────────────────────────────┘
01  preconfigured skills  →  02  empty template + scaffolder  →  03  skills generated from the live catalog
```

`01` proves the pattern with curated skills. `02` is `01` with the domain content removed so you
can reproduce it for your own service. `03` keeps the engine but **generates** the skill layer
(and adds a dynamic backend operation) so one agent can front an entire SAP system.

## Credits & inspiration

Inspired by SAP's pro-code A2A work, with reasoning in **Microsoft Copilot Studio**. See
[`01-a2a-cap-agent/README.md`](./01-a2a-cap-agent/README.md#credits--inspiration) for full attribution.
