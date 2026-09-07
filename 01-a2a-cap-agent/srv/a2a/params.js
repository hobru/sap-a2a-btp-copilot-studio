"use strict";

/**
 * Server-side parameter validation & normalization for a skill invocation.
 *
 * This is deterministic and schema-driven: the skill's `params[]` block is the
 * single source of truth. Given the raw params supplied by the A2A client we:
 *   - enforce `required`
 *   - apply `default`
 *   - coerce to the declared `type` (string | integer | boolean | date)
 *   - left-pad strings to `pad` length with '0' (e.g. accounts, partners)
 *   - enforce integer `min`/`max`
 *   - validate `date` format (YYYY-MM-DD)
 * Unknown params are ignored (lenient), so different A2A clients can add hints
 * without breaking the call.
 *
 * On any violation a `ParamError` is thrown with a user-facing message; the
 * executor turns that into an A2A `input-required`/`failed` state.
 */

class ParamError extends Error {
  constructor(message) {
    super(message);
    this.name = "ParamError";
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function isEmpty(v) {
  return v === undefined || v === null || v === "";
}

function coerce(param, value) {
  switch (param.type) {
    case "integer": {
      const n = typeof value === "number" ? value : parseInt(String(value), 10);
      if (!Number.isFinite(n)) {
        throw new ParamError(`Parameter '${param.name}' must be an integer.`);
      }
      if (param.min !== undefined && n < param.min) {
        throw new ParamError(
          `Parameter '${param.name}' must be >= ${param.min}.`
        );
      }
      if (param.max !== undefined && n > param.max) {
        // Cap silently at max rather than erroring — friendlier for page sizes.
        return param.max;
      }
      return n;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      const s = String(value).toLowerCase();
      if (s === "true" || s === "1") return true;
      if (s === "false" || s === "0") return false;
      throw new ParamError(`Parameter '${param.name}' must be a boolean.`);
    }
    case "date": {
      const s = String(value);
      if (!DATE_RE.test(s)) {
        throw new ParamError(
          `Parameter '${param.name}' must be a date in YYYY-MM-DD format.`
        );
      }
      return s;
    }
    default: {
      // string
      let s = String(value);
      if (param.pad && s.length < param.pad) {
        s = s.padStart(param.pad, "0");
      }
      return s;
    }
  }
}

/**
 * Validate & normalize raw params for a skill.
 *
 * @param {Object} skill      loaded skill manifest
 * @param {Object} rawParams  arbitrary object of client-supplied params
 * @returns {{ values: Object, paramTypes: Object }}
 */
function normalizeParams(skill, rawParams) {
  const raw = rawParams && typeof rawParams === "object" ? rawParams : {};
  const values = {};
  const paramTypes = {};

  for (const param of skill.params || []) {
    paramTypes[param.name] = param.type;
    let value = raw[param.name];

    if (isEmpty(value)) {
      if (param.default !== undefined) {
        values[param.name] = param.default;
        continue;
      }
      if (param.required) {
        throw new ParamError(`Missing required parameter '${param.name}'.`);
      }
      continue; // optional, no default -> leave unset
    }

    values[param.name] = coerce(param, value);
  }

  return { values, paramTypes };
}

/**
 * Resolve the effective $top value for a list skill from normalized params.
 * Honors the backend.top {param, default, max} block.
 */
function resolveTop(backend, values) {
  if (!backend.top) return undefined;
  const { param, default: def = 20, max = 100 } = backend.top;
  let top = param && values[param] !== undefined ? values[param] : def;
  if (typeof top !== "number") top = def;
  if (top > max) top = max;
  if (top < 1) top = 1;
  return top;
}

/**
 * Resolve which navigation properties to $expand, honoring conditional
 * `when: <booleanParam>` gates.
 */
function resolveExpands(backend, values) {
  if (!backend.expand || !backend.expand.length) return [];
  const navs = [];
  for (const e of backend.expand) {
    if (e.when) {
      if (values[e.when] === true) navs.push(e.nav);
    } else {
      navs.push(e.nav);
    }
  }
  return navs;
}

module.exports = {
  ParamError,
  normalizeParams,
  resolveTop,
  resolveExpands,
};
