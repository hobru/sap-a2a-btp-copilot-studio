"use strict";

/**
 * Deterministic A2A skill executor.
 *
 * This is the single generic executor for ALL skills — there is no per-skill
 * code. It:
 *   1. extracts a skill id + params from the incoming A2A message,
 *   2. looks the skill up in the registry (the loaded YAML manifests),
 *   3. validates & normalizes params (required/default/pad/min-max/date),
 *   4. builds the OData V2 URL from the skill's `backend` block,
 *   5. calls the on-prem backend through the BTP destination,
 *   6. unwraps the OData V2 envelope and publishes A2A task events
 *      (submitted -> working -> artifact -> completed).
 *
 * Adding or changing a skill therefore never touches this file — it is pure
 * configuration in `srv/a2a/skills/*.yaml`.
 */

const crypto = require("crypto");

const { getSkill, getSkills } = require("./registry");
const { normalizeParams, resolveTop, resolveExpands, ParamError } = require("./params");
const { buildUrl, buildDynamicUrl, literalForEdmType } = require("../backend/odata");
const backend = require("../backend/destination");
const catalog = require("./catalog");
const { resolveIntent } = require("./nlu");

function uuid() {
  return crypto.randomUUID();
}

/**
 * Pull a skill id + params object out of an A2A user message.
 *
 * Copilot Studio / other A2A clients differ in exactly where they place the
 * structured tool call, so we look in priority order:
 *   1. a DataPart's `data` object: { skill|skillId, params|parameters|arguments }
 *   2. the message `metadata`:      { skill|skillId, params|parameters|arguments }
 *
 * @param {import('@a2a-js/sdk').Message} message
 * @returns {{ skillId?: string, params: Object, rawData?: Object }}
 */
function extractInvocation(message) {
  const parts = (message && message.parts) || [];
  for (const part of parts) {
    if (part && part.kind === "data" && part.data && typeof part.data === "object") {
      const d = part.data;
      const skillId = d.skill || d.skillId || d.skill_id;
      const params = d.params || d.parameters || d.arguments || {};
      if (skillId) return { skillId, params, rawData: d };
    }
  }
  const meta = (message && message.metadata) || {};
  const skillId = meta.skill || meta.skillId || meta.skill_id;
  if (skillId) {
    const params = meta.params || meta.parameters || meta.arguments || {};
    return { skillId, params };
  }
  return { params: {} };
}

/** Concatenate all text parts of an A2A message into a single string. */
function collectText(message) {
  const parts = (message && message.parts) || [];
  return parts
    .filter((p) => p && p.kind === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

/**
 * Resolve a skill invocation from an A2A message.
 *
 * Structured input always wins: if the caller supplied a DataPart or metadata
 * naming a skill, use it verbatim. Only when no structured skill is present do
 * we fall back to natural-language resolution over the message's text parts
 * (deterministic by default, optionally Azure OpenAI — see srv/a2a/nlu.js).
 *
 * @param {import('@a2a-js/sdk').Message} message
 * @returns {Promise<{ skillId?: string, params: Object, resolvedBy: string }>}
 */
async function resolveInvocation(message) {
  const structured = extractInvocation(message);
  if (structured.skillId) return { ...structured, resolvedBy: "structured" };

  const text = collectText(message);
  if (!text) return { params: {}, resolvedBy: "none" };

  const intent = await resolveIntent(text, getSkills());
  if (intent.skillId) return { skillId: intent.skillId, params: intent.params, resolvedBy: "nlu" };
  return { params: {}, resolvedBy: "none" };
}

/** Unwrap an OData V2 JSON body: `{ d: {...} }` or `{ d: { results: [...] } }`. */
function unwrapODataV2(body) {
  if (!body || typeof body !== "object") return body;
  const d = "d" in body ? body.d : body;
  if (d && typeof d === "object" && Array.isArray(d.results)) return d.results;
  return d;
}

/** Max rows rendered into the human-readable text table. */
const MAX_RENDER_ROWS = 50;

/** Normalize a single OData value for display (OData V2 `/Date(ms)/` -> ISO date). */
function formatValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") {
    const m = v.match(/^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/);
    if (m) {
      const d = new Date(Number(m[1]));
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return v;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Strip OData plumbing (`__metadata`, deferred navs) and normalize values. */
function cleanRecord(rec) {
  if (!rec || typeof rec !== "object") return rec;
  const out = {};
  for (const [k, val] of Object.entries(rec)) {
    if (k === "__metadata") continue;
    if (val && typeof val === "object" && "__deferred" in val) continue;
    out[k] = formatValue(val);
  }
  return out;
}

/** Render an array of records as a Markdown table. */
function renderTable(records) {
  const cleaned = records.map(cleanRecord);
  const cols = [];
  for (const r of cleaned) {
    for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  }
  if (cols.length === 0) return "";
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
  const header = `| ${cols.join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const rows = cleaned.map((r) => `| ${cols.map((c) => esc(r[c])).join(" | ")} |`);
  return [header, sep, ...rows].join("\n");
}

/** Build a human-readable rendering of the result payload (shown by the A2A client). */
function summarize(skill, data) {
  if (Array.isArray(data)) {
    if (data.length === 0) return `${skill.name}: no records found.`;
    const table = renderTable(data.slice(0, MAX_RENDER_ROWS));
    const more =
      data.length > MAX_RENDER_ROWS
        ? `\n\n_Showing first ${MAX_RENDER_ROWS} of ${data.length} records._`
        : "";
    const body = table ? `\n\n${table}` : "";
    return `${skill.name}: ${data.length} record(s).${body}${more}`;
  }
  if (data && typeof data === "object") {
    const r = cleanRecord(data);
    const lines = Object.entries(r).map(([k, v]) => `- **${k}**: ${v}`);
    return lines.length
      ? `${skill.name}:\n${lines.join("\n")}`
      : `${skill.name}: returned 1 record.`;
  }
  return `${skill.name}: no data returned.`;
}

/** Default $top for a dynamic list when the skill declares no `top` block. */
const DYN_DEFAULT_TOP = 20;

/**
 * Resolve + VALIDATE a `dynamic` operation against the capability index and
 * return a relative OData URL. All service/entitySet/filter/select/key values
 * come from RUNTIME params; every one is checked against the index before any
 * URL is built. Throws catalog.CatalogError (listing valid options) on any
 * violation — the caller turns that into an A2A `input-required` state and does
 * NOT touch the SAP backend.
 *
 * @param {Object} be      the skill's `backend` block (operation: 'dynamic')
 * @param {Object} values  normalized runtime param values
 * @returns {string} relative OData V2 URL
 */
function buildDynamicRequest(be, values) {
  const mode = be.mode;
  const service = values[be.serviceParam];
  const entitySet = values[be.entitySetParam];

  if (!service) {
    throw new catalog.CatalogError(
      `Missing service. Valid services: ${catalog.serviceNames().join(", ")}.`
    );
  }
  // getEntitySet throws CatalogError listing valid sets if either is unknown.
  const set = catalog.getEntitySet(service, entitySet);
  const svc = catalog.getService(service);
  const namespace = be.namespace || svc.namespace || "sap";

  // $select: caller-supplied (validated) or a narrow default derived from index.
  const rawSelect = be.selectParam ? values[be.selectParam] : undefined;
  const select =
    Array.isArray(rawSelect) && rawSelect.length
      ? catalog.validateSelect(set, rawSelect)
      : catalog.defaultSelect(set);

  if (mode === "getByKey") {
    const keyVal = values[be.keyParam];
    if (keyVal === undefined || keyVal === null || keyVal === "") {
      throw new catalog.CatalogError(
        `Missing key value. Key field(s): ${(set.keys || []).join(", ")}.`
      );
    }
    const parts = catalog.validateKey(set, keyVal); // ordered [{field,value,edmType}]
    const keyPredicate =
      parts.length === 1
        ? "(" + literalForEdmType(parts[0].value, parts[0].edmType) + ")"
        : "(" + parts.map((p) => p.field + "=" + literalForEdmType(p.value, p.edmType)).join(",") + ")";
    return buildDynamicUrl({ namespace, service, entitySet, mode, keyPredicate, select });
  }

  // list
  const rawFilter = be.filterParam ? values[be.filterParam] : undefined;
  const typed = catalog.validateFilter(set, rawFilter || []); // [{field,op,value,edmType}]
  const filterString = typed.length
    ? typed.map((c) => `${c.field} ${c.op} ${literalForEdmType(c.value, c.edmType)}`).join(" and ")
    : null;

  let top = resolveTop(be, values);
  if (top === undefined) top = DYN_DEFAULT_TOP;

  return buildDynamicUrl({ namespace, service, entitySet, mode, filterString, select, top });
}

/** Human-readable text for a `catalog` view artifact. */
function summarizeView(view) {
  if (!view || typeof view !== "object") return "Catalog: no data.";
  switch (view.view) {
    case "listServices": {
      const lines = (view.services || []).map(
        (s) => `- **${s.service}** (${s.domain || "?"}) — ${s.entitySetCount} entity set(s)`
      );
      const scope = view.filteredByDomain ? ` in domain '${view.filteredByDomain}'` : "";
      return `${view.count} service(s)${scope}:\n${lines.join("\n")}\n\n_${view.hint}_`;
    }
    case "describeService": {
      const lines = (view.entitySets || []).map(
        (e) => `- **${e.entitySet}** (${e.role || "?"}) — key: ${(e.keys || []).join(", ") || "n/a"}; ${e.filterableCount} filterable field(s)`
      );
      return `Service **${view.service}** (${view.domain || "?"}), ${view.entitySetCount} entity set(s):\n${lines.join("\n")}\n\n_${view.hint}_`;
    }
    case "describeEntitySet": {
      const lines = (view.properties || []).map(
        (p) => `- **${p.name}** (${p.type})${p.key ? " [key]" : ""}${p.filterable ? " [filterable]" : ""} — ${p.label || ""}`
      );
      return `**${view.service}** / **${view.entitySet}** — key: ${(view.keys || []).join(", ") || "n/a"}\n${lines.join("\n")}\n\n_${view.hint}_`;
    }
    default:
      return "Catalog view.";
  }
}

class BackendExecutor {
  /**
   * @param {import('@a2a-js/sdk/server').RequestContext} requestContext
   * @param {import('@a2a-js/sdk/server').ExecutionEventBus} eventBus
   */
  async execute(requestContext, eventBus) {
    const userMessage = requestContext.userMessage;
    const taskId = requestContext.taskId || uuid();
    const contextId = requestContext.contextId || uuid();

    // Announce the task.
    eventBus.publish({
      kind: "task",
      id: taskId,
      contextId,
      status: { state: "submitted", timestamp: new Date().toISOString() },
      history: userMessage ? [userMessage] : [],
    });

    const { skillId, params } = await resolveInvocation(userMessage);

    // No skill selected -> ask the caller to rephrase / pick one.
    if (!skillId) {
      return this.finishWithState(eventBus, taskId, contextId, "input-required",
        "I couldn't determine which skill matches your request. Please rephrase, or " +
          "name one of the available skills: " +
          getSkills().map((s) => s.id).join(", ") + ".");
    }

    const skill = getSkill(skillId);
    if (!skill) {
      return this.finishWithState(eventBus, taskId, contextId, "failed",
        `Unknown skill '${skillId}'. Available skills: ` +
          getSkills().map((s) => s.id).join(", ") + ".");
    }

    // Move to working.
    eventBus.publish({
      kind: "status-update",
      taskId,
      contextId,
      status: { state: "working", timestamp: new Date().toISOString() },
      final: false,
    });

    let values, paramTypes;
    try {
      ({ values, paramTypes } = normalizeParams(skill, params));
    } catch (err) {
      if (err instanceof ParamError) {
        return this.finishWithState(eventBus, taskId, contextId, "input-required", err.message);
      }
      throw err;
    }

    let data;
    const operation = skill.backend.operation;

    if (operation === "catalog") {
      // LOCAL capability-index lookup — never touches the SAP backend.
      try {
        data = catalog.runView(skill.backend.view, {
          service: skill.backend.serviceParam ? values[skill.backend.serviceParam] : undefined,
          entitySet: skill.backend.entitySetParam ? values[skill.backend.entitySetParam] : undefined,
          domain: skill.backend.domainParam ? values[skill.backend.domainParam] : undefined,
        });
      } catch (err) {
        if (err instanceof catalog.CatalogError) {
          return this.finishWithState(eventBus, taskId, contextId, "input-required", err.message);
        }
        return this.finishWithState(eventBus, taskId, contextId, "failed",
          `Catalog lookup for skill '${skillId}' failed: ${(err && err.message) || String(err)}`);
      }
    } else if (operation === "dynamic") {
      // Resolve + VALIDATE against the index BEFORE any backend call.
      let url;
      try {
        url = buildDynamicRequest(skill.backend, values);
      } catch (err) {
        if (err instanceof catalog.CatalogError || err instanceof ParamError) {
          return this.finishWithState(eventBus, taskId, contextId, "input-required", err.message);
        }
        return this.finishWithState(eventBus, taskId, contextId, "failed",
          `Request build for skill '${skillId}' failed: ${(err && err.message) || String(err)}`);
      }
      try {
        const body = await backend.get(url);
        data = unwrapODataV2(body);
      } catch (err) {
        const detail = (err && (err.rootCause?.message || err.message)) || String(err);
        return this.finishWithState(eventBus, taskId, contextId, "failed",
          `Backend call for skill '${skillId}' failed: ${detail}`);
      }
    } else {
      // Static getByKey / list — byte-identical to the 02 template behavior.
      try {
        const url = buildUrl({
          backend: skill.backend,
          params: values,
          paramTypes,
          expandNavs: resolveExpands(skill.backend, values),
          top: operation === "list" ? resolveTop(skill.backend, values) : undefined,
        });
        const body = await backend.get(url);
        data = unwrapODataV2(body);
      } catch (err) {
        const detail = (err && (err.rootCause?.message || err.message)) || String(err);
        return this.finishWithState(eventBus, taskId, contextId, "failed",
          `Backend call for skill '${skillId}' failed: ${detail}`);
      }
    }

    // Publish the result as an artifact (structured data + a text summary).
    const summaryText = operation === "catalog" ? summarizeView(data) : summarize(skill, data);
    eventBus.publish({
      kind: "artifact-update",
      taskId,
      contextId,
      artifact: {
        artifactId: uuid(),
        name: skill.id,
        description: skill.name,
        parts: [
          { kind: "text", text: summaryText },
          { kind: "data", data: { skill: skill.id, result: data } },
        ],
      },
      append: false,
      lastChunk: true,
    });

    // Complete.
    eventBus.publish({
      kind: "status-update",
      taskId,
      contextId,
      status: { state: "completed", timestamp: new Date().toISOString() },
      final: true,
    });
    eventBus.finished();
  }

  /** Publish a terminal status carrying an agent text message, then finish. */
  finishWithState(eventBus, taskId, contextId, state, text) {
    eventBus.publish({
      kind: "status-update",
      taskId,
      contextId,
      status: {
        state,
        timestamp: new Date().toISOString(),
        message: {
          kind: "message",
          messageId: uuid(),
          role: "agent",
          parts: [{ kind: "text", text }],
          taskId,
          contextId,
        },
      },
      final: true,
    });
    eventBus.finished();
  }

  /** Optional cancel hook — nothing to clean up for synchronous calls. */
  async cancelTask(taskId, eventBus) {
    eventBus.publish({
      kind: "status-update",
      taskId,
      contextId: uuid(),
      status: { state: "canceled", timestamp: new Date().toISOString() },
      final: true,
    });
    eventBus.finished();
  }
}

module.exports = { BackendExecutor, extractInvocation, resolveInvocation, collectText, unwrapODataV2 };
