"use strict";

/**
 * CAP bootstrap that mounts the A2A server into the Express app CAP creates.
 *
 * We keep a `service dummy {}` in srv/service.cds purely so CAP starts an
 * Express app we can hook into here. All A2A behaviour is provided by the
 * @a2a-js/sdk Express handlers wired to our deterministic BackendExecutor.
 *
 * Routes (registered in order so the JSON-RPC catch-all is last):
 *   GET  /health                        -> liveness probe
 *   GET  /.well-known/agent-card.json   -> A2A Agent Card
 *   POST /                              -> A2A JSON-RPC (message/send, tasks/*)
 */

const cds = require("@sap/cds");

const { AGENT_CARD_PATH } = require("@a2a-js/sdk");
const {
  DefaultRequestHandler,
  InMemoryTaskStore,
} = require("@a2a-js/sdk/server");
const {
  agentCardHandler,
  jsonRpcHandler,
  UserBuilder,
} = require("@a2a-js/sdk/server/express");

const { buildAgentCard } = require("./a2a/agent-card");
const { BackendExecutor } = require("./a2a/executor");
const { authenticate } = require("./a2a/auth");
const requestContext = require("./a2a/request-context");

cds.on("bootstrap", (app) => {
  // CORS: A2A clients such as Microsoft Copilot Studio perform agent-card
  // discovery (and subsequent JSON-RPC calls) from the browser. A cross-origin
  // fetch whose response carries no `Access-Control-Allow-Origin` header is
  // blocked by the browser, which surfaces in Copilot Studio as
  // "We couldn't find an agent card at this URL" even though the card is served
  // correctly (a direct browser navigation works because it is not subject to
  // CORS). The card is public, so we reflect any origin and allow the headers
  // Copilot Studio sends. This must run before every route below.
  app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
    res.set("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });

  const agentCard = buildAgentCard();
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    new InMemoryTaskStore(),
    new BackendExecutor()
  );

  // Liveness probe (registered first so the '/' catch-all never shadows it).
  // Public: CF health checks must not require a token.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", skills: agentCard.skills.length });
  });

  // A2A Agent Card at /.well-known/agent-card.json — public so A2A clients
  // (Copilot Studio) can discover the agent before obtaining a token.
  app.use(
    "/" + AGENT_CARD_PATH,
    agentCardHandler({ agentCardProvider: requestHandler })
  );

  // A2A JSON-RPC endpoint (message/send, tasks/*). Protected by inbound IAS
  // JWT validation (see srv/a2a/auth.js). On success the request runs inside a
  // request-scoped context that carries the caller's JWT so the backend OData
  // call can perform principal propagation through the destination. The SDK's
  // own auth stays `noAuthentication` because our middleware already
  // authenticated the caller.
  const rpc = jsonRpcHandler({
    requestHandler,
    userBuilder: UserBuilder.noAuthentication,
  });
  app.use(
    "/",
    authenticate((req, res, next) =>
      requestContext.run(
        { jwt: req.jwt, principal: req.principal },
        () => rpc(req, res, next)
      )
    )
  );

  const skillCount = agentCard.skills.length;
  const authMode = agentCard.securitySchemes
    ? "OAuth2/IAS advertised"
    : "no security scheme (dev/unsecured)";
  console.log(
    `[a2a] Agent "${agentCard.name}" ready with ${skillCount} skill(s); ` +
      `card at /${AGENT_CARD_PATH}; ${authMode}`
  );
});

module.exports = cds.server;
