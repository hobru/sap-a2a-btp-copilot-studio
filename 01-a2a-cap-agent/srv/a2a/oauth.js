"use strict";

/**
 * Resolve the OAuth 2.0 metadata that the Agent Card advertises so A2A clients
 * (Microsoft Copilot Studio) can obtain a token without any manual endpoint
 * entry. Copilot Studio's "Dynamic" OAuth 2.0 mode reads the authorization and
 * token URLs straight from the card's `securitySchemes`, so the more the card
 * exposes, the fewer fields a human has to fill in — only the client id/secret
 * (which are per-consumer and cannot live in a public card) remain manual.
 *
 * Resolution order for the IAS base URL:
 *   1. `A2A_OAUTH_ISSUER` env (explicit override)
 *   2. the bound `identity` (IAS) service credentials — `url`
 *
 * Individual endpoints can also be pinned directly via
 * `A2A_OAUTH_AUTHORIZATION_URL` / `A2A_OAUTH_TOKEN_URL`, which take precedence
 * over the derived `${issuer}/oauth2/(authorize|token)` values.
 *
 * If nothing can be resolved (e.g. local dev with no identity binding and no
 * env), this returns `null` and the card is served WITHOUT a security scheme,
 * matching the current unauthenticated dev behaviour.
 */

const cds = require("@sap/cds");
const xsenv = require("@sap/xsenv");

const LOG = cds.log("a2a");

/** Human-readable descriptions for the standard OIDC scopes we request. */
const SCOPE_DESCRIPTIONS = {
  openid: "Sign in and issue an OpenID Connect ID token.",
  email: "Read the user's email address (the `mail` claim used as the SAP principal).",
  profile: "Read basic profile information.",
};

function stripTrailingSlash(u) {
  return typeof u === "string" ? u.replace(/\/+$/, "") : u;
}

/** IAS tenant base URL from the bound `identity` service, if present. */
function iasBaseFromBinding() {
  try {
    const { identity } = xsenv.getServices({ identity: { label: "identity" } });
    if (!identity) return undefined;
    // Depending on the binding shape the URL may sit at the top level or under
    // `credentials`; accept either.
    return identity.url || (identity.credentials && identity.credentials.url);
  } catch (err) {
    LOG.warn("could not read identity binding for OAuth metadata", {
      error: err.message,
    });
    return undefined;
  }
}

/**
 * @returns {null | {
 *   authorizationUrl: string,
 *   tokenUrl: string,
 *   scopes: Record<string,string>,
 *   issuer: string | undefined,
 * }}
 */
function resolveOAuthConfig() {
  const issuer = stripTrailingSlash(
    process.env.A2A_OAUTH_ISSUER || iasBaseFromBinding()
  );

  const authorizationUrl =
    process.env.A2A_OAUTH_AUTHORIZATION_URL ||
    (issuer && `${issuer}/oauth2/authorize`);
  const tokenUrl =
    process.env.A2A_OAUTH_TOKEN_URL || (issuer && `${issuer}/oauth2/token`);

  if (!authorizationUrl || !tokenUrl) return null;

  const scopeNames = (process.env.A2A_OAUTH_SCOPES || "openid email")
    .split(/[\s,]+/)
    .filter(Boolean);
  const scopes = {};
  for (const name of scopeNames) {
    scopes[name] = SCOPE_DESCRIPTIONS[name] || name;
  }

  return { authorizationUrl, tokenUrl, scopes, issuer };
}

/**
 * Build the A2A `securitySchemes` + `security` fragment from a resolved OAuth
 * config, or `{}` when there is no config (dev / unsecured).
 *
 * @param {ReturnType<typeof resolveOAuthConfig>} oauth
 * @param {string} [schemeName]
 */
function buildSecurity(oauth, schemeName = "sap_ias_sso") {
  if (!oauth) return {};
  return {
    securitySchemes: {
      [schemeName]: {
        type: "oauth2",
        description:
          "SAP Cloud Identity Services (IAS) — OAuth 2.0 authorization-code " +
          "(Entra-federated SSO). The issued token is validated inside the " +
          "agent before any skill runs.",
        flows: {
          authorizationCode: {
            authorizationUrl: oauth.authorizationUrl,
            tokenUrl: oauth.tokenUrl,
            scopes: oauth.scopes,
          },
        },
      },
    },
    security: [{ [schemeName]: Object.keys(oauth.scopes) }],
  };
}

module.exports = { resolveOAuthConfig, buildSecurity, SCOPE_DESCRIPTIONS };
