# 02 — DIY Skeleton: build your own A2A CAP agent

The **same deterministic engine** as [`01-a2a-cap-agent/`](../01-a2a-cap-agent/),
content-emptied into a **template + tutorial** so you can plug in **your own** SAP
OData services and add skills in **YAML — no JavaScript**. Reasoning stays in
**Microsoft Copilot Studio**; this app is a read-only OData executor.

## 👉 Start with the tutorial

**[TUTORIAL.md](./TUTORIAL.md)** is the centerpiece — a copy-paste-runnable, 10-step
guide from *"npm install"* to *"registered in Copilot Studio"*. It covers running the
engine in 5 minutes, the skill-YAML anatomy (incl. the `sap` vs `IWBEP` namespace
gotcha), scaffolding skills, two orchestration patterns, and deployment.

## What ships here

- The reused engine (`srv/**`, `srv/a2a/skill-schema.json`, `srv/backend/*.js`) with
  one small backward-compatible enhancement: an optional `namespace` field on
  `backend` (default `sap`) so you can reach services under `/sap/opu/odata/IWBEP/`.
- **8 demo skills** over the public SAP Gateway sample services (below).
- A heavily-commented [`_TEMPLATE.yaml.example`](./srv/a2a/skills/_TEMPLATE.yaml.example)
  showing every schema field.
- A skill scaffolder, [`scripts/create-skill.js`](./scripts/create-skill.js)
  (`npm run create:skill`).

## The 8 demo skills

| # | Skill id | Service | Namespace | Op | Reads |
|---|----------|---------|-----------|----|-------|
| 1 | `get-business-partner-details` | GWSAMPLE_BASIC | IWBEP | getByKey | one business partner |
| 2 | `list-products` | GWSAMPLE_BASIC | IWBEP | list | products (opt. by category) |
| 3 | `get-product-details` | GWSAMPLE_BASIC | IWBEP | getByKey | one product |
| 4 | `list-sales-orders` | GWSAMPLE_BASIC | IWBEP | list | sales orders (opt. by customer) |
| 5 | `get-sales-order-details` | GWSAMPLE_BASIC | IWBEP | getByKey | one sales-order header |
| 6 | `list-sales-order-line-items` | GWSAMPLE_BASIC | IWBEP | list | line items of one order |
| 7 | `list-flights` | RMTSAMPLEFLIGHT | IWBEP | list | flights (opt. by carrier/city) |
| 8 | `get-flight-details` | RMTSAMPLEFLIGHT | IWBEP | getByKey | one flight (composite key) |

> ⚠️ **Verify-TODO:** GWSAMPLE_BASIC names are standard. The **RMTSAMPLEFLIGHT**
> field names in skills 7–8 were not verifiable against a live `$metadata` while
> authoring — confirm them against `…/IWBEP/RMTSAMPLEFLIGHT/$metadata` before relying
> on them (both flight skills carry an inline note). See
> [TUTORIAL §8](./TUTORIAL.md#8-add-a-second-backend-rmtsampleflight).

## Quick start

```powershell
cd 02-a2a-cap-template
npm install
Copy-Item .env.example .env          # local dev only; never commit .env
npm run start                        # then open http://localhost:4004/.well-known/agent-card.json
```

Useful scripts: `npm run validate:skills` · `npm run list:skills` ·
`npm run test:nlu` · `npm run create:skill`.

## Ground rules

- **Reasoning lives in Copilot Studio.** Any optional server-side reasoning uses
  **Azure OpenAI** (env-gated).
- **Read-only.** Only `getByKey` and `list` — no writes, no actions.
- **OData V2 only**, always narrowed with a `$select`.
- **Deterministic.** The agent executes declared skills; it never plans.

## See also

- Repository overview: [root README](../README.md)
- The worked reference agent: [`01-a2a-cap-agent/`](../01-a2a-cap-agent/) and its
  [operator guide](../01-a2a-cap-agent/GETTING-STARTED.md) (deploy / IAS / NLU depth).
