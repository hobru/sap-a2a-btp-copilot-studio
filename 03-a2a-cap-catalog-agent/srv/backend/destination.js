"use strict";

/**
 * Thin wrapper around the SAP Cloud SDK HTTP client for calling the on-prem
 * SAP backend through a BTP destination + Cloud Connector.
 *
 * The destination name is configurable via the SAP_DESTINATION_NAME env var so
 * that operators can rename the destination without touching code; it defaults
 * to "pm4-ssl" (the destination configured on the trial subaccount).
 *
 * A GET-only helper is exposed because the first wave of skills is read-only.
 * When write skills are added later, add a matching `post`/`patch` helper here.
 */

const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");
const requestContext = require("../a2a/request-context");

const DESTINATION_NAME = process.env.SAP_DESTINATION_NAME || "pm4-ssl";

// Whether to thread the inbound IAS JWT into the outbound Cloud SDK call.
// Phase 1 (current): destination `pm4-ssl` is Proxy Type Internet +
// BasicAuthentication (technical user), so the backend identity comes from the
// destination itself and NO user token is needed outbound. Passing an IAS token
// as the destination-lookup token in this phase can break the destination
// service call, so it is left OFF by default.
// Phase 2 (later): switch the destination to Proxy Type OnPremise +
// PrincipalPropagation (Cloud Connector) and set PRINCIPAL_PROPAGATION=true so
// the caller's identity (email) flows through to the on-prem system. No code
// change required - only this flag + the destination config.
const PRINCIPAL_PROPAGATION =
  String(process.env.PRINCIPAL_PROPAGATION).toLowerCase() === "true";

/**
 * Perform a GET against the backend via the configured destination.
 *
 * When PRINCIPAL_PROPAGATION is enabled AND the current request carries an
 * authenticated IAS JWT (put in scope by the auth middleware, see
 * srv/a2a/auth.js + request-context.js), the JWT is passed to the SAP Cloud SDK
 * so the destination performs *principal propagation*: the caller's identity
 * (email) flows through the Cloud Connector to the on-prem system. Otherwise the
 * destination's own technical/basic auth is used.
 *
 * @param {string} url  relative OData URL (path + query), e.g.
 *                      "/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder('1')?$format=json"
 * @param {Object} [opts]
 * @param {string} [opts.destinationName]  override the destination name
 * @returns {Promise<any>} parsed response body (OData V2 JSON: `{ d: ... }`)
 */
async function get(url, opts = {}) {
  const destinationName = opts.destinationName || DESTINATION_NAME;
  const { jwt } = requestContext.current();

  const destination =
    PRINCIPAL_PROPAGATION && jwt ? { destinationName, jwt } : { destinationName };
  const response = await executeHttpRequest(destination, {
    method: "get",
    url,
    headers: { Accept: "application/json" },
  });
  return response.data;
}

module.exports = { get, DESTINATION_NAME, PRINCIPAL_PROPAGATION };
