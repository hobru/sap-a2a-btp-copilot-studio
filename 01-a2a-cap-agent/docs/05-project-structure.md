# 05 · Project structure

The CAP project layout **as shipped and deployed**. This is JavaScript (not TypeScript), the skills are **config-driven** (one YAML manifest per skill), and inbound auth is **CAP-native IAS** — there is a single Node.js module, no App Router and no `xs-security.json`.

## Actual layout

```
a2a-cap-agent/                       # the CAP project
├── package.json                     # deps: @a2a-js/sdk, @sap/cds, @sap/xssec,
│                                    #       @sap-cloud-sdk/http-client, @sap-cloud-sdk/connectivity
├── mta.yaml                         # CF deploy: ONE srv module + identity/connectivity/destination/logs
├── .env.example                     # local config (destination, optional AZURE_OPENAI_*, PRINCIPAL_PROPAGATION)
├── srv/
│   ├── service.cds                  # service dummy {}  → makes CAP start Express
│   ├── server.js                    # cds.on("bootstrap"): mount A2A handlers + auth + /health
│   ├── a2a/
│   │   ├── agent-card.js            # buildAgentCard(): assembles the card from the skill registry
│   │   ├── auth.js                  # CAP-native IAS JWT validation (@sap/xssec against bound identity)
│   │   ├── request-context.js       # AsyncLocalStorage carrying the caller JWT for principal propagation
│   │   ├── executor.js              # BackendExecutor: NLU → resolve skill → OData call → render artifact
│   │   ├── nlu.js                   # intent resolution: (A) deterministic default, (B) optional Azure OpenAI
│   │   ├── registry.js             # loads + validates all skills/*.yaml into a skill registry
│   │   ├── params.js               # regex/param extraction + coercion helpers
│   │   ├── skill-schema.json       # JSON Schema every skill manifest is validated against
│   │   └── skills/                 # ONE YAML manifest per skill (the whole catalog)
│   │       ├── list-sales-orders.yaml            # reference skill (verified end-to-end)
│   │       ├── get-sales-order-status.yaml
│   │       ├── get-business-partner-details.yaml
│   │       ├── get-product-details.yaml
│   │       ├── get-purchase-order-status.yaml
│   │       └── … (11 skills total)
│   └── backend/
│       ├── destination.js           # thin wrapper over executeHttpRequest({ destinationName })
│       └── odata.js                 # helpers: build $select/$filter, shape V2 responses
├── scripts/
│   ├── list-skills.js               # print the loaded skill catalog
│   ├── validate-skills.js           # validate every skills/*.yaml against skill-schema.json
│   └── test-nlu.js                  # exercise intent resolution offline
├── reference/                       # OData evaluation + catalog + agent-card example (not runtime)
└── docs/                            # this documentation set
```

## Key files and their role

### `srv/service.cds`

A single placeholder so CAP boots an Express app the A2A handlers can attach to:

```cds
service dummy {}
```

### `srv/server.js`

Wires the A2A SDK into CAP's Express during bootstrap and enforces inbound auth (shipped code):

```js
const cds = require("@sap/cds");
const { AGENT_CARD_PATH } = require("@a2a-js/sdk");
const { DefaultRequestHandler, InMemoryTaskStore } = require("@a2a-js/sdk/server");
const { agentCardHandler, jsonRpcHandler, UserBuilder } = require("@a2a-js/sdk/server/express");
const { buildAgentCard } = require("./a2a/agent-card");
const { BackendExecutor } = require("./a2a/executor");
const { authenticate } = require("./a2a/auth");
const requestContext = require("./a2a/request-context");

cds.on("bootstrap", (app) => {
  const agentCard = buildAgentCard();
  const requestHandler = new DefaultRequestHandler(
    agentCard, new InMemoryTaskStore(), new BackendExecutor()
  );

  app.get("/health", (_req, res) => res.json({ status: "ok", skills: agentCard.skills.length }));

  // Public card so Copilot Studio can discover the agent before it has a token.
  app.use("/" + AGENT_CARD_PATH, agentCardHandler({ agentCardProvider: requestHandler }));

  // JSON-RPC endpoint: our own IAS middleware authenticates first, then runs the
  // request in a context carrying the caller's JWT for principal propagation.
  const rpc = jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication });
  app.use("/", authenticate((req, res, next) =>
    requestContext.run({ jwt: req.jwt, principal: req.principal }, () => rpc(req, res, next))
  ));
});
```

> `UserBuilder.noAuthentication` is intentional: the SDK's own auth is a no-op because the `authenticate` middleware (`srv/a2a/auth.js`) has **already** validated the IAS JWT. There is no App Router or XSUAA in front of the app.

### `srv/a2a/auth.js`

CAP-native inbound auth: validates the IAS-issued JWT with `@sap/xssec` against the bound `identity` service (signature + `aud` == the app's clientid), extracts the `mail`/`email` claim as the principal, and rejects unauthenticated JSON-RPC calls. The card and `/health` stay public.

### `srv/a2a/executor.js`

Implements `AgentExecutor.execute(ctx, bus)`: runs NLU (`nlu.js`) to resolve the target skill + params from the user's text, looks the skill up in the registry, calls the backend OData service, and publishes task status + a rendered artifact (Markdown table for row data) on the event bus. Deterministic dispatch — any model use is confined to optional NLU.

### `srv/a2a/nlu.js`

Resolves `{ skill, params }` from free text. **(A)** deterministic keyword/tag scoring + regex param extraction is the default. **(B)** if all `AZURE_OPENAI_*` env vars are set, it first tries Azure OpenAI (JSON mode, short timeout) and silently falls back to (A) on any failure.

### `srv/a2a/skills/*.yaml` + `registry.js` + `skill-schema.json`

Each skill is a **declarative YAML manifest** (id, name, description, tags, examples, the backend service/entity set, `$select`/`$filter` shape, and param rules). `registry.js` loads and validates every manifest against `skill-schema.json` at startup and exposes the registry to both the executor and `buildAgentCard()`. **Adding a skill = adding one YAML file** — no new JS.

### `srv/backend/destination.js`

Centralizes outbound calls so every skill uses the same destination and error handling:

```js
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");

function odataGet(path) {
  return executeHttpRequest({ destinationName: process.env.SAP_DESTINATION_NAME }, { method: "get", url: path });
}
```

### `mta.yaml`

**One** `nodejs` module (`a2a-cap-agent-srv`, served from source via `cds-serve`) requiring four managed services: `identity` (IAS — inbound auth, with the OAuth2 redirect URIs re-applied on every deploy), `connectivity` + `destination` (outbound to the on-prem backend), and `application-logs`. There is **no** approuter module and **no** `xs-security.json`.

## Separation of concerns

| Layer | Files | Responsibility |
|---|---|---|
| Transport | `server.js`, `a2a/agent-card.js` | Speak A2A; publish the card |
| Inbound auth | `a2a/auth.js`, `a2a/request-context.js` | CAP-native IAS JWT validation + principal context |
| Intent | `a2a/nlu.js`, `a2a/params.js` | Text → `{ skill, params }` (A default, B optional) |
| Dispatch | `a2a/executor.js`, `a2a/registry.js` | Skill routing + artifact rendering |
| Skill logic | `a2a/skills/*.yaml`, `a2a/skill-schema.json` | Declarative param → OData mapping |
| Backend | `backend/destination.js`, `backend/odata.js` | One place for destination + OData plumbing |
| Deploy | `mta.yaml` | Single CF module + service bindings |

This keeps **adding a skill** a localized change (one new file under `skills/`), which is what makes scaling from 1 to many services across the OData sources manageable.
