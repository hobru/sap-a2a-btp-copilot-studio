"use strict";

/**
 * Minimal OData V2 URL builder for the deterministic skill executor.
 *
 * All helpers here are pure string builders — they do not perform any I/O.
 * They translate a validated skill `backend` block + normalized params into a
 * relative OData V2 request URL (path + query), always requesting JSON.
 *
 * OData V2 conventions handled:
 *  - `&$format=json`
 *  - single unnamed key:      Set('value')
 *  - composite named keys:    Set(Key1='a',Key2='b')
 *  - date literals:           datetime'2026-01-01T00:00:00'
 *  - $select / $expand / $filter / $orderby / $top
 */

/** OData V2 string-literal escaping: single quote is doubled. */
function odataString(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

/** Format a value as an OData V2 date literal (datetime'...'), midnight UTC. */
function odataDate(value) {
  // Accept YYYY-MM-DD or a full ISO timestamp; keep only the date portion.
  const s = String(value);
  const datePart = s.length >= 10 ? s.slice(0, 10) : s;
  return "datetime'" + datePart + "T00:00:00'";
}

/**
 * Render a scalar param value as an OData literal, based on its declared type.
 * `date` -> datetime'...'; `integer`/`boolean` -> bare; everything else -> quoted string.
 */
function literalForType(value, type) {
  if (type === "date") return odataDate(value);
  if (type === "integer") return String(value);
  if (type === "boolean") return value ? "true" : "false";
  return odataString(value);
}

/**
 * Build the entity-set key predicate segment, e.g. `('12345')` or
 * `(SupplierInvoice='...',FiscalYear='...')`.
 *
 * @param {Array<{field:string, param:string}>} keys
 * @param {Object} params        normalized param values keyed by param name
 * @param {Object} paramTypes    map of param name -> declared type
 */
function buildKeyPredicate(keys, params, paramTypes) {
  if (!keys || keys.length === 0) {
    throw new Error("getByKey requires at least one key");
  }
  if (keys.length === 1) {
    const k = keys[0];
    return "(" + literalForType(params[k.param], paramTypes[k.param]) + ")";
  }
  const parts = keys.map(
    (k) => k.field + "=" + literalForType(params[k.param], paramTypes[k.param])
  );
  return "(" + parts.join(",") + ")";
}

/**
 * Build a `$filter` string from filter specs whose params are present.
 * Operators supported: eq (default), ne, gt, ge, lt, le.
 *
 * @param {Array<{field:string, param:string, operator?:string}>} filters
 */
function buildFilter(filters, params, paramTypes) {
  if (!filters || filters.length === 0) return null;
  const clauses = [];
  for (const f of filters) {
    const v = params[f.param];
    if (v === undefined || v === null || v === "") continue; // skip absent optional filters
    const op = f.operator || "eq";
    clauses.push(`${f.field} ${op} ${literalForType(v, paramTypes[f.param])}`);
  }
  return clauses.length ? clauses.join(" and ") : null;
}

/** Build a `$orderby` string from [{field,direction}]. */
function buildOrderby(orderby) {
  if (!orderby || orderby.length === 0) return null;
  return orderby
    .map((o) => o.field + (o.direction ? " " + o.direction : ""))
    .join(",");
}

/**
 * Build a relative OData V2 URL (path + query) for a skill invocation.
 *
 * @param {Object} args
 * @param {Object} args.backend    the skill's validated `backend` block
 * @param {Object} args.params     normalized param values
 * @param {Object} args.paramTypes map of param name -> declared type
 * @param {Array<string>} [args.expandNavs] resolved navigation names to $expand
 * @param {number} [args.top]      resolved $top value (list only)
 * @returns {string} relative URL beginning with "/sap/opu/odata/sap/..."
 */
function buildUrl({ backend, params, paramTypes, expandNavs, top }) {
  const base =
    "/sap/opu/odata/sap/" + backend.service + "/" + backend.entitySet;

  let path = base;
  const query = [];

  if (backend.operation === "getByKey") {
    path += buildKeyPredicate(backend.key, params, paramTypes);
  } else {
    // list
    const filter = buildFilter(backend.filter, params, paramTypes);
    if (filter) query.push("$filter=" + encodeURIComponent(filter));
    const orderby = buildOrderby(backend.orderby);
    if (orderby) query.push("$orderby=" + encodeURIComponent(orderby));
    if (typeof top === "number") query.push("$top=" + top);
  }

  if (backend.select && backend.select.length) {
    query.push("$select=" + encodeURIComponent(backend.select.join(",")));
  }
  if (expandNavs && expandNavs.length) {
    query.push("$expand=" + encodeURIComponent(expandNavs.join(",")));
  }

  query.push("$format=json");

  return path + "?" + query.join("&");
}

module.exports = {
  odataString,
  odataDate,
  literalForType,
  buildKeyPredicate,
  buildFilter,
  buildOrderby,
  buildUrl,
};
