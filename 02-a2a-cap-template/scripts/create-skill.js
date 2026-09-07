#!/usr/bin/env node
"use strict";

/**
 * create-skill.js -- scaffold a new A2A skill YAML under srv/a2a/skills/.
 *
 * Dependency-light: only js-yaml (already a project dependency) + Node's
 * built-in readline. It writes a minimal but VALID skill manifest that passes
 * `npm run validate:skills`, then you edit the file to add params / select fields.
 *
 * Usage (flags -- non-interactive):
 *   node scripts/create-skill.js \
 *     --id get-thing-details --name "Get thing details" \
 *     --description "Return details of one thing by its id." \
 *     --service GWSAMPLE_BASIC --namespace IWBEP \
 *     --entitySet ThingSet --operation getByKey
 *
 * Usage (interactive -- prompts for anything not supplied):
 *   npm run create:skill
 *
 * Ground rules baked in: READ ONLY (operation is getByKey|list only), OData V2,
 * always a $select. The generated file is a starting point -- open it and fill
 * in the real key/filter/select for your entity ($metadata is the source of truth).
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const yaml = require("js-yaml");

const skillsDir = path.join(__dirname, "..", "srv", "a2a", "skills");

// ---- tiny flag parser: --key value  |  --key=value  -------------------------
function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[a.slice(2)] = next;
        i++;
      } else {
        flags[a.slice(2)] = true; // bare boolean flag
      }
    }
  }
  return flags;
}

function toKebab(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function prompt(rl, question, def) {
  const suffix = def ? ` [${def}]` : "";
  const answer = await new Promise((resolve) =>
    rl.question(`${question}${suffix}: `, resolve)
  );
  const trimmed = String(answer).trim();
  return trimmed === "" ? def : trimmed;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const interactive = !(flags.id && flags.name && flags.description && flags.service && flags.entitySet && flags.operation);

  let rl;
  if (interactive) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("Scaffold a new READ-ONLY A2A skill. Press Enter to accept [defaults].\n");
  }

  const get = async (key, question, def) => {
    if (flags[key] !== undefined && flags[key] !== true) return String(flags[key]);
    if (!interactive) return def;
    return prompt(rl, question, def);
  };

  const rawId = await get("id", "Skill id (kebab-case)", flags.name ? toKebab(flags.name) : "my-skill");
  const id = toKebab(rawId);
  const name = await get("name", "Human-readable name", id.replace(/-/g, " "));
  let description = await get("description", "Description (>= 20 chars, what it returns + when to use)", "");
  const service = await get("service", "OData V2 service name", "MY_SERVICE");
  const namespace = await get("namespace", "Namespace segment (sap for standard, IWBEP for demo services)", "sap");
  const entitySet = await get("entitySet", "Entity set", "MyEntitySet");
  let operation = (await get("operation", "Operation (getByKey|list)", "getByKey")).trim();
  const domain = await get("domain", "Domain (informational, e.g. sales/master-data)", "master-data");

  if (rl) rl.close();

  // ---- validation / normalization ------------------------------------------
  if (operation !== "getByKey" && operation !== "list") {
    console.error(`Invalid operation "${operation}". Must be getByKey or list.`);
    process.exit(1);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    console.error(`Invalid id "${id}". Must be kebab-case (a-z, 0-9, hyphens).`);
    process.exit(1);
  }
  if (!description || description.length < 20) {
    // Pad to a valid-but-obviously-placeholder description so the file still validates.
    description = `TODO: describe what ${name} returns and when to use it (min 20 chars).`;
  }

  // ---- build the skill object ----------------------------------------------
  const skill = {
    id,
    name,
    description,
    domain,
    tags: [namespace === "IWBEP" ? service.toLowerCase() : "custom", "odata", "read"],
    examples: [`TODO: an example prompt that should trigger "${name}".`],
  };

  const backend = { service };
  if (namespace && namespace !== "sap") backend.namespace = namespace;
  backend.entitySet = entitySet;
  backend.operation = operation;

  if (operation === "getByKey") {
    skill.params = [
      { name: "myKey", type: "string", required: true, description: "TODO: the key value." },
    ];
    backend.key = [{ field: "MyKeyField", param: "myKey" }];
  } else {
    skill.params = [
      { name: "top", type: "integer", required: false, description: "Maximum number of rows to return." },
    ];
    backend.filter = [];
    backend.orderby = [{ field: "MyKeyField", direction: "asc" }];
    backend.top = { param: "top", default: 20, max: 100 };
  }

  backend.select = ["MyKeyField", "SomeField"];
  skill.backend = backend;

  // ---- serialize + write ----------------------------------------------------
  const body = yaml.dump(skill, { lineWidth: 100, noRefs: true, quotingType: '"' });
  const header =
    "# Generated by scripts/create-skill.js -- edit before use.\n" +
    "# READ ONLY. Fill in the real key/filter/select for your entity ($metadata is the source of truth).\n";
  const out = header + body;

  if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });
  const file = path.join(skillsDir, `${id}.yaml`);
  if (fs.existsSync(file)) {
    console.error(`Refusing to overwrite existing file: ${path.relative(process.cwd(), file)}`);
    process.exit(1);
  }
  fs.writeFileSync(file, out, "utf8");

  console.log(`\nCreated ${path.relative(process.cwd(), file)}`);
  console.log("Next steps:");
  console.log("  1. Edit the file: set the real key/filter fields, params and $select.");
  console.log("  2. Run: npm run validate:skills");
  console.log("  3. Run: npm run list:skills");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
