# Getting started — running, extending & deploying the A2A CAP agent

This is the operator guide for the CAP app in this folder. It covers local dev,
how to add or change skills, the exact A2A request shape Copilot Studio must
send, and how to deploy to Cloud Foundry with **CAP-native IAS** inbound auth
(no approuter, no XSUAA).

For the *why* (architecture, identity chain, destination), read the design docs
under [`docs/`](./docs). This file is the *how*.

---

## 1. Prerequisites

- Node 20+, and `@sap/cds-dk` global (`cds -v` shows a cds-dk version).
- `cf` CLI (Cloud Foundry) and `mbt` (Cloud MTA Build Tool) for build/deploy.
- Access to the BTP trial subaccount (region **ap21**,
  API endpoint `https://api.cf.ap21.hana.ondemand.com`) with entitlements for
  `identity` (plan `application`), `destination` (lite), `connectivity` (lite),
  and `application-logs` (lite).
- The BTP **destination** `pm4-ssl` already created in the subaccount
  (Proxy Type `Internet` + `BasicAuthentication` for phase 1 — see
  [`docs/03-destination-and-connectivity.md`](./docs/03-destination-and-connectivity.md)).

Install dependencies once:

```powershell
cd 01-a2a-cap-agent
npm ci
```

---

## 2. Run locally (mocked auth)

Local dev uses a **mocked** auth strategy (see `package.json` → `cds.requires.auth`),
so no IAS token is needed. Copy the example env and start the server:

```powershell
Copy-Item .env.example .env      # adjust if needed; never commit .env
npm start                        # cds-serve; first boot compiles + deploys in-memory sqlite (~60s)
```

Wait for `[a2a] Agent "..." ready with 11 skill(s); card at /.well-known/agent-card.json`.

### Smoke-test the three endpoints

**Health (public):**

```powershell
curl.exe http://localhost:4004/health
# {"status":"ok","skills":11}
```

**Agent Card (public):**

```powershell
curl.exe http://localhost:4004/.well-known/agent-card.json
```

**A2A JSON-RPC `message/send` (protected).** Locally, the `x-dev-email` header
stands in for the authenticated IAS principal. Write the body to a file first
(PowerShell mangles inline JSON):

```powershell
@'
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "kind": "message",
      "role": "user",
      "messageId": "m1",
      "parts": [
        { "kind": "data", "data": { "skill": "get-sales-order-status", "params": { "salesOrder": "12345" } } }
      ]
    }
  }
}
'@ | Out-File -Encoding ascii body.json

curl.exe -s -X POST http://localhost:4004/ `
  -H "content-type: application/json" `
  -H "x-dev-email: dev.user@example.com" `
  --data "@body.json"
```

Without a bound destination this call runs the full path (auth → skill lookup →
param validation → URL build → backend call) and then fails at the destination
lookup — that is expected locally. Against CF with `pm4-ssl` bound, it returns
the shaped OData record. For a real backend call locally, use
`cds bind` against a destination service instance instead of hardcoding creds.

---

## 3. The A2A request shape (what Copilot Studio sends)

The executor (`srv/a2a/executor.js` → `resolveInvocation`) resolves the skill id
and params from the incoming message in **priority order**:

1. **Structured call** (`extractInvocation`) — preferred when present:
   - a **DataPart**: a message part with `kind: "data"` whose `data` object holds
     `skill` (or `skillId`) and `params` (or `parameters` / `arguments`); or
   - the message **`metadata`**: `{ skill, params }`.
   Params keys are **camelCase** and must match the skill manifest's
   `params[].name` exactly (e.g. `salesOrder`, `businessPartner`, `product`).
2. **Plain-text NLU** (`srv/a2a/nlu.js` → `resolveIntent`) — the fallback used
   in practice, because **Copilot Studio sends the user sentence as a text part**,
   not a structured DataPart. The agent parses the sentence into `{ skill, params }`
   itself. Confirmed working end-to-end (e.g. *"show me 5 sales orders"* →
   `list-sales-orders`).

### How plain-text NLU resolves a sentence

- **(A) Deterministic parser (default, always on).** Scores every skill by
  phrase/keyword/tag overlap against the sentence, requires a best score ≥ 3, then
  regex-extracts params (order numbers, BP IDs, dates, `$top`) by canonical param
  name. Fast, free, deterministic, and covered by the offline harness
  `scripts/test-nlu.js`. New skills that reuse a known param name get extraction
  for free.
- **(B) Azure OpenAI extraction (optional).** If the three `AZURE_OPENAI_*` env
  vars are set (Section 6.1), the agent first asks Azure OpenAI (JSON mode,
  `temperature 0`, 8 s timeout) to return `{ skill, params }` from the sentence +
  skill catalog, then executes deterministically. On **any** failure it silently
  falls back to (A), so enabling it never introduces a hard dependency. Turn it on
  only where an Azure OpenAI endpoint is available and broader phrasing coverage is
  wanted; leave it off to stay fully deterministic and offline-testable.

Both paths produce raw params; `srv/a2a/params.js` pads/coerces/validates/caps them
downstream, so (A) and (B) share identical execution.

### How results come back

The backend OData V2 response is shaped for display in the artifact's **text**
part (Copilot Studio surfaces the text, not the structured `data`):
- arrays → a **Markdown table** (capped at 50 rows, with a "showing first N" note);
- a single record → a **bullet list**;
- `/Date(ms)/` → `YYYY-MM-DD`, and `__metadata`/`__deferred` are stripped.
The full unshaped records are still attached as a `kind: "data"` part for clients
that consume structured output.

---

## 4. Add or change a skill (the extensibility surface)

Skills are **declarative YAML** in [`srv/a2a/skills/`](./srv/a2a/skills). Each file
drives *both* the Agent Card `skills[]` entry *and* the deterministic OData call —
no code change is required to add one. The schema is
[`srv/a2a/skill-schema.json`](./srv/a2a/skill-schema.json); every file is validated
against it at startup.

To add a skill:

1. Copy an existing manifest (e.g. `get-sales-order-status.yaml`) to a new file.
2. Set `id` (kebab-case, unique), `name`, `description`, `domain`, `tags`, `examples`.
3. Declare `params` (camelCase `name`, `type`, `required`, `description`).
4. Fill `backend`:
   - `service` — the OData service name (e.g. `API_SALES_ORDER_SRV`).
   - `entitySet` — the entity set (e.g. `A_SalesOrder`).
   - `operation` — `getByKey` (single record) or `list` (filtered collection).
   - `key` — for `getByKey`: map each key `field` to a `param`.
   - `filter` / `select` / `top` — for `list` / projections.
5. Restart (`npm start`). The new skill appears in `/health` count and the Agent Card.

Use [`reference/focused-skill-catalog.md`](./reference/focused-skill-catalog.md) and
[`reference/odata-catalog.json`](./reference/odata-catalog.json) as the authoritative
source for verified entity sets, keys, fields, and navigation — these ship with the
app so they are always in sync with what the backend actually exposes.

Removing a skill is just deleting its YAML file.

---

## 5. Build & deploy to Cloud Foundry

```powershell
cf login --sso   # target https://api.cf.ap21.hana.ondemand.com, the trial subaccount

# Confirm the required service plans exist on this subaccount:
cf marketplace | Select-String "identity|destination|connectivity|application-logs"

mbt build
cf deploy mta_archives\a2a-cap-agent_0.1.0.mtar
```

The MTA (`mta.yaml`) provisions the `identity`, `destination`, `connectivity`,
and `application-logs` services and binds them to the single Node.js module. The
app is served **from source** (`cds-serve`), so the `srv/a2a/skills/*.yaml`
manifests, `skill-schema.json`, and `reference/*` all ship as-is.

> If `connectivity` (lite) is not entitled on the trial, phase 1 does not need it
> (the `pm4-ssl` destination uses Proxy Type `Internet`). You can drop the
> `a2a-cap-agent-connectivity` resource + its `requires` entry to de-risk the
> deploy, and re-add it for phase-2 on-prem routing.

Post-deploy checks:

```powershell
cf apps
curl.exe https://<route>/health
curl.exe https://<route>/.well-known/agent-card.json
```

---

## 6. IAS configuration

Inbound auth is validated by the app itself (`srv/a2a/auth.js`) against the bound
`identity` service. Key points:

- **`oauth2-configuration` is re-applied on every deploy** from `mta.yaml`
  (redirect URIs + grant types). Edits made in the IAS admin UI are overwritten —
  change them in `mta.yaml` instead.
- **Audience:** the IAS token's `aud` claim **must equal the app's clientid**.
  This is the #1 cause of 401s. Get the clientid from a service key:

  ```powershell
  cf create-service-key a2a-cap-agent-identity k1
  cf service-key a2a-cap-agent-identity k1   # read `clientid`
  ```

- **Email claim:** the token must carry an `email`/`mail` claim that matches the
  backend SU01 user email — required for phase-2 principal propagation.
- **Entra federation:** configure IAS as federated to Entra ID (Corporate IdP), so
  Copilot Studio users authenticate via Entra and IAS mints the token this app
  validates. Same chain as Parts 3–4 of the series.

### 6.1 Optional — enable Azure OpenAI plain-text NLU (option B)

Plain-text parsing works out of the box with the deterministic parser (option A).
To additionally enable the Azure OpenAI path (Section 3, option B), set these app
env vars in Cloud Foundry (never commit them):

| Env var | Required | Notes |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | yes | e.g. `https://<resource>.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | yes | Azure OpenAI resource key — treat as a secret |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | yes | the chat deployment name (e.g. `gpt-4o-mini`) |
| `AZURE_OPENAI_API_VERSION` | no | defaults to `2024-06-01` |

```powershell
cf set-env a2a-cap-agent-srv AZURE_OPENAI_ENDPOINT "https://<resource>.openai.azure.com"
cf set-env a2a-cap-agent-srv AZURE_OPENAI_API_KEY "<key>"
cf set-env a2a-cap-agent-srv AZURE_OPENAI_DEPLOYMENT_NAME "<deployment>"
cf restage a2a-cap-agent-srv
```

All three must be present or the agent stays on option A. To disable, unset them
(`cf unset-env …`) and restage — the call goes straight to Azure over HTTPS.

---

## 7. Register the agent in Copilot Studio

1. In Copilot Studio, add an **A2A agent connection** pointing at
   `https://<route>/.well-known/agent-card.json`.
2. Provide the OIDC credentials so Copilot Studio can obtain an IAS token
   (client id/secret from the identity service key; issuer = the IAS tenant).
   Ensure the Copilot Studio consent redirect
   (`https://global.consent.azure-apim.net/redirect/**`) is in the IAS redirect
   URIs — it already is in `mta.yaml`.
3. Test one skill (e.g. *get-sales-order-status*) end-to-end and confirm the
   DataPart param shape (Section 3).

---

## 8. Phase 2 — principal propagation (per-user SSO to ABAP)

Phase 1 proves inbound IAS SSO while the `pm4-ssl` destination uses its own
technical user (Proxy Type `Internet` + `BasicAuthentication`). To move to
per-user SSO into the on-prem backend:

1. In the BTP cockpit, switch the **same** `pm4-ssl` destination to Proxy Type
   `OnPremise` + `PrincipalPropagation` (Cloud Connector virtual host, location id) —
   see [`docs/03-destination-and-connectivity.md`](./docs/03-destination-and-connectivity.md).
2. Set the app env flag so the caller's IAS JWT is threaded outbound:

   ```powershell
   cf set-env a2a-cap-agent-srv PRINCIPAL_PROPAGATION true
   cf restage a2a-cap-agent-srv
   ```

   The flag is read in `srv/backend/destination.js`; **no code change** is needed —
   only the destination config and this env var. (A JWT is only forwarded to the
   destination lookup when `PRINCIPAL_PROPAGATION=true`, which avoids breaking the
   phase-1 Internet+BasicAuth destination call.)

> **Authorization** (mapping IAS groups → skill/role restrictions) is deliberately
> deferred. Phase 1/2 authenticate the caller and propagate identity; fine-grained
> per-skill authorization is a later phase.
