#!/usr/bin/env node
"use strict";

/**
 * Offline test harness for the deterministic NLU parser (strategy A).
 *
 * Runs a set of plain-text prompts through parseDeterministic() against the
 * real skill registry and asserts the resolved skill id + selected params.
 * No backend, no Azure, no network — pure text -> {skillId, params}.
 *
 *   node scripts/test-nlu.js
 *
 * Exit code 0 = all cases passed, 1 = at least one failed.
 */

const { parseDeterministic } = require("../srv/a2a/nlu");
const { getSkills } = require("../srv/a2a/registry");

const skills = getSkills();

/**
 * Each case: the user text, the expected skill id (or null when the parser
 * should decline), and a subset of params that MUST match exactly. Params not
 * listed are ignored, so we only pin the values we actually care about.
 */
const CASES = [
  // --- Meta-skills: the generic discovery chain -------------------------------
  {
    text: "List all the SAP services available in the catalog.",
    skillId: "list-services",
    params: {},
  },
  {
    text: "Which SAP services do we have in finance?",
    skillId: "list-services",
    params: { domain: "finance" },
  },
  {
    text: "Describe the service API_SALES_ORDER_SRV and its entity sets.",
    skillId: "describe-service",
    params: { service: "API_SALES_ORDER_SRV" },
  },
  {
    text: "Describe entity set A_Supplier in service API_SUPPLIER, list its fields.",
    skillId: "describe-entity-set",
    params: { service: "API_SUPPLIER", entitySet: "A_Supplier" },
  },
  {
    text: "Search the entity set A_Supplier in service API_SUPPLIER, first 5 rows.",
    skillId: "search-entity-set",
    params: { service: "API_SUPPLIER", entitySet: "A_Supplier", top: 5 },
  },
  {
    text: "Get the record with key 300000 from A_Supplier in API_SUPPLIER.",
    skillId: "get-by-key",
    params: { service: "API_SUPPLIER", entitySet: "A_Supplier", key: "300000" },
  },
  // --- Featured curated skills still route on their domain vocabulary ----------
  {
    text: "List the 10 most recent sales orders.",
    skillId: "featured-sales-order-list",
    params: { top: 10 },
  },
  {
    text: "List purchase orders, the top 15.",
    skillId: "featured-purchase-order-list",
    params: { top: 15 },
  },
  // Should decline: nothing sensible to match.
  {
    text: "Hello there, how are you today?",
    skillId: null,
    params: {},
  },
];

/*
 * NOTE on params: this deterministic harness pins the routed skill id, the
 * universal `top` page-size, and the GENERIC catalog identifiers the offline
 * extractor recognises: `service` (API_*), `entitySet` (A_*), `domain`, and a
 * single-field `key`. It never pins a structured `filter` -- that is
 * injection-sensitive and is only ever supplied as a structured A2A DataPart by
 * Copilot Studio (or the optional Azure OpenAI parser). Routing + these generic
 * identifiers are exactly what the offline path is responsible for; params.js
 * marks any still-missing required value as input-required at execution time.
 */

function fmt(v) {
  return JSON.stringify(v);
}

function checkParams(expected, actual) {
  const misses = [];
  for (const [k, want] of Object.entries(expected)) {
    if (fmt(actual[k]) !== fmt(want)) {
      misses.push(`${k}: expected ${fmt(want)}, got ${fmt(actual[k])}`);
    }
  }
  return misses;
}

function main() {
  let failed = 0;

  for (const c of CASES) {
    const res = parseDeterministic(c.text, skills) || {};
    const gotSkill = res.skillId || null;
    const gotParams = res.params || {};

    const problems = [];
    if (gotSkill !== c.skillId) {
      problems.push(`skill: expected ${fmt(c.skillId)}, got ${fmt(gotSkill)}`);
    }
    if (c.skillId) {
      problems.push(...checkParams(c.params, gotParams));
    }

    if (problems.length === 0) {
      console.log(`PASS  ${c.text.slice(0, 60)}`);
    } else {
      failed++;
      console.log(`FAIL  ${c.text.slice(0, 60)}`);
      for (const p of problems) console.log(`        ${p}`);
      console.log(`        -> ${gotSkill} ${fmt(gotParams)}`);
    }
  }

  console.log("");
  const total = CASES.length;
  console.log(`${total - failed}/${total} passed`);
  process.exit(failed ? 1 : 0);
}

main();
