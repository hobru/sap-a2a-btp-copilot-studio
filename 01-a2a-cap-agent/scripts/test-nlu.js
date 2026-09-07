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
  // The exact prompt that failed live in Copilot Studio.
  {
    text: "Retrieve 5 sales orders from SAP S/4HANA. Please return the sales order " +
      "number, customer, order date, and total value for each order.",
    skillId: "list-sales-orders",
    params: { top: 5 },
  },
  {
    text: "List the 10 most recent sales orders",
    skillId: "list-sales-orders",
    params: { top: 10 },
  },
  {
    text: "Show sales orders for customer 100123",
    skillId: "list-sales-orders",
    params: { soldToParty: "100123" },
  },
  // getByKey phrasings.
  {
    text: "What is the status of sales order 12345?",
    skillId: "get-sales-order-status",
    params: { salesOrder: "12345" },
  },
  {
    text: "Give me the details for business partner 100123",
    skillId: "get-business-partner-details",
    params: { businessPartner: "100123" },
  },
  {
    text: "Show product details for TG-11",
    skillId: "get-product-details",
    params: { product: "TG-11" },
  },
  {
    text: "Status of purchase order 4500000123 including items",
    skillId: "get-purchase-order-status",
    params: { purchaseOrder: "4500000123", includeItems: true },
  },
  {
    text: "Get outbound delivery status for delivery 80000123",
    skillId: "get-outbound-delivery-status",
    params: { deliveryDocument: "80000123" },
  },
  {
    text: "List purchase orders for supplier 17300001",
    skillId: "list-purchase-orders-for-supplier",
    params: { supplier: "17300001" },
  },
  // Should decline: nothing sensible to match.
  {
    text: "Hello there, how are you today?",
    skillId: null,
    params: {},
  },
];

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
