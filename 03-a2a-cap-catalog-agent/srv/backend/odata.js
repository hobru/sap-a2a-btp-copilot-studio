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
 * Render a scalar value as an OData V2 literal based on the entity set property's
 * Edm type (from the capability index). This is used by the generic `dynamic`
 * operation, where types are not known from the static skill YAML but from the
 * index. Falls back to a quoted string for unknown/text types.
 *
 * @param {*} value
 * @param {string} edmType  e.g. "Edm.String", "Edm.Int32", "Edm.Decimal"
 * @returns {string} an OData V2 literal
 */
function literalForEdmType(value, edmType) {
  const t = String(edmType || "Edm.String");
  switch (t) {
    case "Edm.Boolean": {
      if (typeof value === "boolean") return value ? "true" : "false";
      const s = String(value).toLowerCase();
      return s === "true" || s === "1" || s === "x" ? "true" : "false";
    }
    case "Edm.Byte":
    case "Edm.SByte":
    case "Edm.Int16":
    case "Edm.Int32": {
      const n = typeof value === "number" ? value : parseInt(String(value), 10);
      if (!Number.isFinite(n)) throw new Error(`Value '${value}' is not a valid ${t}.`);
      return String(n);
    }
    case "Edm.Int64": {
      const s = String(value).trim();
      if (!/^-?\d+$/.test(s)) throw new Error(`Value '${value}' is not a valid Edm.Int64.`);
      return s + "L";
    }
    case "Edm.Decimal": {
      const s = String(value).trim();
      if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`Value '${value}' is not a valid Edm.Decimal.`);
      return s + "m";
    }
    case "Edm.Double": {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`Value '${value}' is not a valid Edm.Double.`);
      return String(n) + "d";
    }
    case "Edm.Single": {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`Value '${value}' is not a valid Edm.Single.`);
      return String(n) + "f";
    }
    case "Edm.Guid":
      return "guid'" + String(value).replace(/'/g, "''") + "'";
    case "Edm.DateTime":
      return odataDate(value);
    case "Edm.DateTimeOffset": {
      const s = String(value);
      const iso = s.length >= 10 && s.length < 20 ? s.slice(0, 10) + "T00:00:00Z" : s;
      return "datetimeoffset'" + iso + "'";
    }
    case "Edm.Time":
      return "time'" + String(value) + "'";
    default:
      // Edm.String and any unknown type -> safe quoted string.
      return odataString(value);
  }
}

/**
 * Build a relative OData V2 URL for the GENERIC `dynamic` operation. Every
 * component here has already been resolved from RUNTIME params AND validated
 * against the capability index by the executor — this function only assembles
 * the string. It never accepts a raw $filter; `filterString` is pre-built from
 * validated {field,op,value} conditions using `literalForEdmType`.
 *
 * @param {Object} args
 * @param {string} args.namespace      OData namespace (default "sap")
 * @param {string} args.service        validated service technical name
 * @param {string} args.entitySet      validated entity set name
 * @param {"list"|"getByKey"} args.mode
 * @param {string} [args.keyPredicate] e.g. "('123')" (getByKey)
 * @param {string} [args.filterString] pre-built $filter (list)
 * @param {string} [args.orderby]      pre-built $orderby (list)
 * @param {string[]} [args.select]     validated $select fields
 * @param {number} [args.top]          resolved $top (list)
 * @returns {string} relative URL beginning with "/sap/opu/odata/<namespace>/..."
 */
function buildDynamicUrl({ namespace, service, entitySet, mode, keyPredicate, filterString, orderby, select, top }) {
  const ns = namespace || "sap";
  let path = "/sap/opu/odata/" + ns + "/" + service + "/" + entitySet;
  const query = [];

  if (mode === "getByKey") {
    path += keyPredicate;
  } else {
    if (filterString) query.push("$filter=" + encodeURIComponent(filterString));
    if (orderby) query.push("$orderby=" + encodeURIComponent(orderby));
    if (typeof top === "number") query.push("$top=" + top);
  }

  if (select && select.length) {
    query.push("$select=" + encodeURIComponent(select.join(",")));
  }

  query.push("$format=json");

  return path + "?" + query.join("&");
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
 * @returns {string} relative URL beginning with "/sap/opu/odata/<namespace>/..."
 */
function buildUrl({ backend, params, paramTypes, expandNavs, top }) {
  // Gateway path is /sap/opu/odata/<namespace>/<service>/<entitySet>. The
  // namespace defaults to "sap" (standard S/4HANA APIs). SAP demo/reference
  // services (GWSAMPLE_BASIC, RMTSAMPLEFLIGHT, ...) live under "IWBEP", so a
  // skill can set `backend.namespace: IWBEP`. When namespace is absent this is
  // byte-for-byte identical to the fixed "/sap/opu/odata/sap/..." base.
  const namespace = backend.namespace || "sap";
  const base =
    "/sap/opu/odata/" + namespace + "/" + backend.service + "/" + backend.entitySet;

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
  literalForEdmType,
  buildKeyPredicate,
  buildFilter,
  buildOrderby,
  buildUrl,
  buildDynamicUrl,
};
