#!/usr/bin/env node
"use strict";

/**
 * Validate every skill manifest under srv/a2a/skills against skill-schema.json.
 *
 * Checks performed:
 *   1. JSON Schema validation (structure, types, required fields).
 *   2. Skill id uniqueness across all files.
 *   3. Referential integrity: every param referenced by backend.key / backend.filter /
 *      backend.top / backend.expand[].when actually exists in params[].
 *   4. Operation-specific rules (getByKey needs key[], list must not use key[]).
 *
 * Exit code 0 = all valid, 1 = at least one problem found.
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Ajv = require("ajv");

const skillsDir = path.join(__dirname, "..", "srv", "a2a", "skills");
const schemaPath = path.join(__dirname, "..", "srv", "a2a", "skill-schema.json");

function loadSkillFiles() {
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(skillsDir, f));
}

function main() {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  const files = loadSkillFiles();
  if (files.length === 0) {
    console.error("No skill files found in " + skillsDir);
    process.exit(1);
  }

  let errors = 0;
  const seenIds = new Map();

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    let skill;
    try {
      skill = yaml.load(fs.readFileSync(file, "utf8"));
    } catch (e) {
      console.error(`[${rel}] YAML parse error: ${e.message}`);
      errors++;
      continue;
    }

    if (!validate(skill)) {
      for (const err of validate.errors) {
        console.error(`[${rel}] schema${err.instancePath || ""} ${err.message}`);
      }
      errors++;
      continue;
    }

    // id uniqueness
    if (seenIds.has(skill.id)) {
      console.error(`[${rel}] duplicate skill id "${skill.id}" (also in ${seenIds.get(skill.id)})`);
      errors++;
    } else {
      seenIds.set(skill.id, rel);
    }

    // referential integrity
    const paramNames = new Set((skill.params || []).map((p) => p.name));
    const b = skill.backend;

    const refCheck = (paramName, where) => {
      if (paramName && !paramNames.has(paramName)) {
        console.error(`[${rel}] ${where} references unknown param "${paramName}"`);
        errors++;
      }
    };

    (b.key || []).forEach((k) => refCheck(k.param, `backend.key[${k.field}]`));
    (b.filter || []).forEach((f) => refCheck(f.param, `backend.filter[${f.field}]`));
    (b.expand || []).forEach((e) => e.when && refCheck(e.when, `backend.expand[${e.nav}].when`));
    if (b.top) refCheck(b.top.param, "backend.top");
    // dynamic/catalog *Param references must resolve to a declared param.
    refCheck(b.serviceParam, "backend.serviceParam");
    refCheck(b.entitySetParam, "backend.entitySetParam");
    refCheck(b.filterParam, "backend.filterParam");
    refCheck(b.keyParam, "backend.keyParam");
    refCheck(b.domainParam, "backend.domainParam");
    refCheck(b.selectParam, "backend.selectParam");

    // operation-specific rules
    if (b.operation === "getByKey" && (!b.key || b.key.length === 0)) {
      console.error(`[${rel}] operation getByKey requires backend.key[]`);
      errors++;
    }
    if (b.operation === "list" && b.key && b.key.length > 0) {
      console.error(`[${rel}] operation list must not define backend.key[]`);
      errors++;
    }
    if (b.operation === "catalog") {
      if (!b.view) {
        console.error(`[${rel}] operation catalog requires backend.view`);
        errors++;
      }
      if ((b.key && b.key.length) || (b.filter && b.filter.length)) {
        console.error(`[${rel}] operation catalog must not define static backend.key[]/filter[]`);
        errors++;
      }
      if (b.view === "describeService" && !b.serviceParam) {
        console.error(`[${rel}] catalog view describeService requires backend.serviceParam`);
        errors++;
      }
      if (b.view === "describeEntitySet" && (!b.serviceParam || !b.entitySetParam)) {
        console.error(`[${rel}] catalog view describeEntitySet requires backend.serviceParam + backend.entitySetParam`);
        errors++;
      }
    }
    if (b.operation === "dynamic") {
      if (!b.serviceParam || !b.entitySetParam || !b.mode) {
        console.error(`[${rel}] operation dynamic requires backend.serviceParam + backend.entitySetParam + backend.mode`);
        errors++;
      }
      if ((b.key && b.key.length) || (b.filter && b.filter.length)) {
        console.error(`[${rel}] operation dynamic must not define static backend.key[]/filter[] (use keyParam/filterParam)`);
        errors++;
      }
      if (b.mode === "getByKey" && !b.keyParam) {
        console.error(`[${rel}] dynamic mode getByKey requires backend.keyParam`);
        errors++;
      }
    }

    // every required-without-default param that is neither key nor filter is suspicious
    // (allowed, but warn) — kept as info only, not an error.
  }

  if (errors > 0) {
    console.error(`\n${errors} problem(s) found in ${files.length} skill file(s).`);
    process.exit(1);
  }

  console.log(`OK: ${files.length} skill file(s) valid, ${seenIds.size} unique id(s).`);
}

main();
