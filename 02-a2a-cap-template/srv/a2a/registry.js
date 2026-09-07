"use strict";

/**
 * Skill registry: loads and caches all skill manifests from srv/a2a/skills.
 *
 * This module is the single source of truth for "what skills exist". It is consumed by:
 *   - the Agent Card generator (srv/a2a/agent-card.js) to build skills[]
 *   - the executor (srv/a2a/executor.js) to resolve an incoming skill id
 *   - scripts/list-skills.js
 *
 * Loading is deterministic (sorted by id) so the Agent Card is stable across restarts.
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const SKILLS_DIR = path.join(__dirname, "skills");

let cache = null;

function loadSkills() {
  if (cache) return cache;

  const files = fs.existsSync(SKILLS_DIR)
    ? fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    : [];

  const byId = new Map();
  for (const file of files) {
    const full = path.join(SKILLS_DIR, file);
    const skill = yaml.load(fs.readFileSync(full, "utf8"));
    if (!skill || !skill.id) {
      throw new Error(`Skill file ${file} has no id`);
    }
    if (byId.has(skill.id)) {
      throw new Error(`Duplicate skill id "${skill.id}" in ${file}`);
    }
    skill.__file = file;
    byId.set(skill.id, skill);
  }

  const list = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
  cache = { list, byId };
  return cache;
}

function getSkills() {
  return loadSkills().list;
}

function getSkill(id) {
  return loadSkills().byId.get(id) || null;
}

function getSkillIds() {
  return loadSkills().list.map((s) => s.id);
}

module.exports = { getSkills, getSkill, getSkillIds, SKILLS_DIR };
