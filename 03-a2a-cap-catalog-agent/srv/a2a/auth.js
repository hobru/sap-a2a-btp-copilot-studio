"use strict";

/**
 * Inbound IAS (SAP Identity Authentication) JWT validation for the A2A
 * JSON-RPC endpoint, adapted from the hobru/CAP-Routing-App pattern.
 *
 * The A2A endpoints are custom Express routes mounted during CAP bootstrap, so
 * they are NOT covered by CAP's own service-level `kind: ias` auth. This
 * middleware closes that gap: it validates the Entra-federated IAS bearer token
 * with @sap/xssec, then runs the downstream handler inside a request-scoped
 * context that carries the raw JWT (reused for principal propagation on the
 * outbound OData call) and a `principal` (email/sub/issuer) for logging.
 *
 *   - `production` profile: a signature-verified Bearer token is MANDATORY.
 *   - other profiles (local dev): unauthenticated requests are accepted and a
 *     mock principal is derived from the `x-dev-email` header, so the agent
 *     card and message/send flow stay testable with `cds watch`.
 *
 * `/health` and `/.well-known/agent-card.json` are registered BEFORE the
 * JSON-RPC catch-all this guards, so they remain public (A2A discovery + CF
 * liveness must not require a token).
 */

const cds = require("@sap/cds");
const xsenv = require("@sap/xsenv");
const { createSecurityContext, IdentityService } = require("@sap/xssec");

const LOG = cds.log("a2a");

const isProduction = (cds.env.profiles || []).includes("production");

let _identityService; // lazily created, cached IAS validator

/**
 * Build (once) the IAS validator from the bound `identity` service credentials.
 * Returns null if no identity binding is present (e.g. local dev).
 */
function identityService() {
  if (_identityService !== undefined) return _identityService;
  try {
    const { identity } = xsenv.getServices({ identity: { label: "identity" } });
    _identityService = new IdentityService(identity);
  } catch (err) {
    LOG.warn("no identity service binding found", { error: err.message });
    _identityService = null;
  }
  return _identityService;
}

/** Extract the raw bearer token from the Authorization header. */
function bearerToken(req) {
  const h = req.headers["authorization"] || req.headers["Authorization"];
  if (!h || Array.isArray(h)) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : undefined;
}

/** Decode a JWT payload without verifying the signature (logging/dev only). */
function decodePayload(token) {
  try {
    const part = token.split(".")[1];
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

/** Best available user identifier for principal propagation + logging. */
function principalFromToken(token) {
  const p = (token && token.payload) || {};
  return {
    email: (token && token.email) || p.mail || p.email || p.user_name,
    sub: p.sub,
    issuer: (token && token.issuer) || p.iss,
  };
}

function unauthorized(res, req, reason) {
  LOG.warn("401 unauthorized", { correlationId: req.correlationId, reason });
  res.status(401);
  res.setHeader("WWW-Authenticate", "Bearer");
  res.json({ error: "unauthorized", reason });
}

/**
 * Express guard for the A2A JSON-RPC route. On success it attaches `req.jwt`
 * and `req.principal` and hands control to `onAuthenticated(req, res, next)`,
 * which is expected to run the remainder of the request inside the
 * request-scoped context (see request-context.js).
 *
 * @param {Function} onAuthenticated (req, res, next) => void
 * @returns Express middleware
 */
function authenticate(onAuthenticated) {
  return async function (req, res, next) {
    const token = bearerToken(req);

    // No token -----------------------------------------------------------
    if (!token) {
      if (isProduction) return unauthorized(res, req, "missing_bearer_token");
      const email = req.headers["x-dev-email"] || "dev.user@example.com";
      req.jwt = undefined;
      req.principal = { email, sub: "dev", issuer: "local-dev" };
      LOG.warn("DEV auth fallback in use — no token validated", { email });
      return onAuthenticated(req, res, next);
    }

    const ias = identityService();

    // Token but no IAS binding -------------------------------------------
    if (!ias) {
      if (isProduction) return unauthorized(res, req, "no_identity_binding");
      // Dev with a token but no binding: accept unverified so flows are testable.
      req.jwt = token;
      req.principal = principalFromToken({ payload: decodePayload(token) });
      LOG.warn("token accepted WITHOUT validation (no identity binding, dev only)");
      return onAuthenticated(req, res, next);
    }

    // Validate -----------------------------------------------------------
    try {
      const securityContext = await createSecurityContext(ias, { token });
      req.jwt = token;
      req.principal = principalFromToken(securityContext.token);
      return onAuthenticated(req, res, next);
    } catch (err) {
      const claims = decodePayload(token);
      LOG.warn("JWT validation failed", {
        error: err.message,
        sub: claims && claims.sub,
        iss: claims && claims.iss,
      });
      return unauthorized(res, req, "invalid_token");
    }
  };
}

module.exports = { authenticate, bearerToken, principalFromToken };
