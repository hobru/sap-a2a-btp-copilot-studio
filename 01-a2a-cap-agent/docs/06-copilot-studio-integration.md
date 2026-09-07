# 06 · Copilot Studio integration

How Microsoft Copilot Studio consumes the deployed A2A agent, and how SSO flows end to end. This mirrors the custom-connector + IAS pattern from Parts 2–3, but the target is an **A2A agent** instead of an MCP/REST connector.

## What Copilot Studio needs

1. **Agent Card URL** — the deployed public route (the card itself is public; the JSON-RPC endpoint is protected):
   `https://<srv-route>/.well-known/agent-card.json`
   (deployed example: `https://b3ef4c2btrial-dev-a2a-cap-agent-srv.cfapps.ap21.hana.ondemand.com/.well-known/agent-card.json`)
2. **SSO configuration** — an OAuth2 (authorization-code) connection to **IAS**, matching the `securitySchemes` the Agent Card advertises.

## Registering the agent

In Copilot Studio, add the agent as an **A2A / agent-to-agent** connection (or the current "connect to an external agent" surface) and point it at the Agent Card URL. Copilot Studio reads the card, discovers the **skills**, and can then invoke them over the A2A JSON-RPC endpoint.

> The exact menu path in Copilot Studio changes over time; the constants are: (a) it fetches the **agent-card.json**, and (b) it needs an **OAuth2 connection** to call the protected endpoint.

## SSO end to end

```
User in Copilot Studio
   │  signs in
   ▼
Entra ID ──(federation)──▶ SAP IAS ──OAuth2 auth-code──▶ IAS access token (JWT, `mail` claim)
   │
   ▼  Copilot Studio attaches the token as Bearer on the A2A call
App Router removed — the CAP A2A app validates the IAS JWT itself (CAP-native, `srv/a2a/auth.js`; reads `mail`)
   │
   ▼  skill executor
Destination (PrincipalPropagation) ──▶ Cloud Connector ──▶ on-prem SAP as the real ABAP user
```

Key points:

- The **user's real identity** reaches the SAP backend — audit, authorizations, and row-level security in SAP all apply per user. Copilot Studio never holds a technical SAP credential. *(This is the on-prem target shown above. The deployed demo currently uses the Internet + technical-user variant of the same destination; flipping to OnPremise + PrincipalPropagation needs no code change — see [`01-architecture.md`](01-architecture.md) and [`../GETTING-STARTED.md`](../GETTING-STARTED.md).)*
- The OAuth2 endpoints Copilot Studio uses are **IAS** `authorize` / `token`, the same tenant configured in Part 3.
- Token validation happens **inside the CAP app** (`srv/a2a/auth.js`): it verifies the IAS-issued JWT (signature via the bound `identity` service, `aud` == the app's clientid) before any skill runs, so the JSON-RPC endpoint is only reached by authenticated requests. There is **no App Router and no XSUAA** — inbound auth is CAP-native IAS.

## Configuring the OAuth2 connection in Copilot Studio

| Setting | Value |
|---|---|
| Identity provider / auth type | OAuth 2.0 — Authorization Code |
| Authorization URL | `https://<your-ias-tenant>.accounts.ondemand.com/oauth2/authorize` |
| Token URL | `https://<your-ias-tenant>.accounts.ondemand.com/oauth2/token` |
| Refresh URL | Same as the Token URL (`.../oauth2/token`) — required so Copilot Studio can renew tokens without a new interactive sign-in |
| Client ID / secret | The OAuth client registered in **IAS** for Copilot Studio |
| Scopes | `openid email offline_access` (IAS OIDC scopes; `email` yields the `mail` claim the app reads; `offline_access` makes IAS issue a **refresh token**) |
| Redirect URL | The Copilot Studio callback URL (register it in the IAS client) |

These are the same building blocks used for the earlier custom connectors — reuse the IAS application/registration approach from Part 3, just pointing at the new agent route.

> **Refresh tokens:** `offline_access` is what makes IAS return a refresh token, so Copilot Studio can silently renew the short-lived access token instead of forcing the user to sign in again. For this to work the IAS OAuth client must also **permit refresh-token issuance** (enable the refresh-token grant / token policy on the application in IAS). Without `offline_access` — or without that policy — the connection stops working once the first access token expires.

## Testing the integration

1. **Card reachable:** open `https://<route>/.well-known/agent-card.json` in a browser (it is public, no sign-in needed) and confirm the JSON renders with the expected `skills[]`. Note that opening the URL directly is **not** the same test Copilot Studio runs — see the CORS note below.
2. **Auth handshake:** trigger the connection in Copilot Studio and complete the IAS/Entra sign-in; confirm a token is issued.
3. **One skill:** ask a question that maps to `list-sales-orders` (e.g. "show me 5 sales orders"); confirm the backend answer comes back as a Markdown table and that the SAP call ran with the configured backend identity (technical user today; PrincipalPropagation once switched to on-prem).
4. **Negative path:** a non-existent order id should surface the skill's "not found" message, not a raw stack trace.

## Troubleshooting: "We couldn't find an agent card at this URL"

This is the most common first-connect failure, and it is almost always **CORS**, not a wrong URL:

- **Symptom:** Copilot Studio says *"We couldn't find an agent card at this URL. Please check that your endpoint URL is correct."* — yet the same URL opens fine in a browser and `curl` returns `200`.
- **Cause:** Copilot Studio fetches the card **from the browser**, so the cross-origin read is blocked unless the response carries `Access-Control-Allow-Origin`. Direct navigation and `curl` don't enforce CORS, which is why the URL "works" for you but not for Copilot Studio.
- **Fix:** ensure the CORS middleware in `srv/server.js` is present and runs **first** (see [`04-agent-card-and-skills.md`](04-agent-card-and-skills.md#browser-discoverability-cors)). Confirm the live response headers:

  ```bash
  curl -i https://<route>/.well-known/agent-card.json          # expect: access-control-allow-origin: *
  curl -i -X OPTIONS https://<route>/.well-known/agent-card.json   # expect: 204 + CORS headers
  ```

  If `access-control-allow-origin` is missing, redeploy — the middleware was lost or not applied.

## Relationship to the other front doors

This agent is a **third front door** alongside the series' MCP Gateway and API Management options — same identity plumbing, different protocol. Copilot Studio can consume all three; the A2A agent is the right choice when you want Copilot Studio to treat SAP as a **peer agent with named skills** rather than a raw tool/API surface. See the comparison in [`../README.md`](../README.md).
