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
  // --- GWSAMPLE_BASIC: list vs getByKey routing --------------------------------
  // "N <things>" drives the top page-size extractor; sales orders is the unit word.
  {
    text: "List the 10 most recent sales orders with customer, amount and status.",
    skillId: "list-sales-orders",
    params: { top: 10 },
  },
  {
    text: "What has business partner 0100000000 ordered recently?",
    skillId: "list-sales-orders",
    params: {},
  },
  {
    text: "What are the details of sales order 0500000001?",
    skillId: "get-sales-order-details",
    params: {},
  },
  {
    text: "Show the line items of sales order 0500000000.",
    skillId: "list-sales-order-line-items",
    params: {},
  },
  {
    text: "What is the company name and e-mail of business partner 100000000?",
    skillId: "get-business-partner-details",
    params: {},
  },
  // Master data: list vs get by product.
  {
    text: "Show all products in category Notebooks.",
    skillId: "list-products",
    params: {},
  },
  {
    text: "What is the price and supplier of material HT-1001?",
    skillId: "get-product-details",
    params: {},
  },
  {
    text: "Show the details of product HT-1000.",
    skillId: "get-product-details",
    params: {},
  },
  // --- RMTSAMPLEFLIGHT: second backend, independent routing --------------------
  {
    text: "Show flights from FRA to JFK.",
    skillId: "list-flights",
    params: {},
  },
  {
    text: "Details for airline LH connection 0400 date 2017-11-15.",
    skillId: "get-flight-details",
    params: {},
  },
  // Should decline: nothing sensible to match.
  {
    text: "Hello there, how are you today?",
    skillId: null,
    params: {},
  },
];

/*
 * NOTE on params: this deterministic harness pins the routed skill id, plus the
 * universal `top` page-size where the text makes it explicit. It does NOT pin the
 * string key params (businessPartnerId, salesOrderId, productId, ...): the offline
 * extractor in nlu.js recognises a fixed set of canonical param names, and these
 * template skills use their own names. At runtime those keys are supplied either
 * as a structured A2A DataPart (Copilot Studio) or via the optional Azure OpenAI
 * parser -- and params.js marks any still-missing required key as input-required.
 * Routing + top is exactly what the offline path is responsible for.
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
