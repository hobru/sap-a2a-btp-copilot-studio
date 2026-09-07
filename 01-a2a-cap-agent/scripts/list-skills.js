#!/usr/bin/env node
"use strict";

/**
 * Print a human-readable summary of all registered skills.
 * Useful to see, at a glance, what the Agent Card will advertise.
 */

const { getSkills } = require("../srv/a2a/registry");

function main() {
  const skills = getSkills();
  console.log(`${skills.length} skill(s):\n`);

  for (const s of skills) {
    const b = s.backend;
    const params = (s.params || [])
      .map((p) => (p.required ? p.name + "*" : p.name))
      .join(", ");
    console.log(`- ${s.id}  [${s.domain || "-"}]`);
    console.log(`    ${s.name}`);
    console.log(`    ${b.operation} ${b.service}/${b.entitySet}`);
    console.log(`    params: ${params || "(none)"}`);
    console.log("");
  }
  console.log("* = required");
}

main();
