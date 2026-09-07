"use strict";

/**
 * Build the A2A Agent Card from the loaded skill registry.
 *
 * The Agent Card is what Microsoft Copilot Studio (or any A2A client) reads to
 * discover the agent and its skills. Every skill's `id`, `name`, `description`,
 * `tags`, `examples` and `outputModes` come straight from its YAML manifest, so
 * editing a description or adding a skill is a pure-config change that is
 * reflected on the card automatically.
 */

const { getSkills } = require("./registry");

const PROTOCOL_VERSION = process.env.A2A_PROTOCOL_VERSION || "0.3.0";

/** Map one loaded skill manifest to an A2A AgentSkill. */
function toAgentSkill(skill) {
  const agentSkill = {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    tags: skill.tags || [],
  };
  if (skill.examples && skill.examples.length) agentSkill.examples = skill.examples;
  if (skill.inputModes && skill.inputModes.length) agentSkill.inputModes = skill.inputModes;
  if (skill.outputModes && skill.outputModes.length) agentSkill.outputModes = skill.outputModes;
  return agentSkill;
}

/**
 * Build the full AgentCard object.
 *
 * @param {Object} [opts]
 * @param {string} [opts.url]     public base URL the card advertises
 * @param {string} [opts.version] agent version string
 * @returns {import('@a2a-js/sdk').AgentCard}
 */
function buildAgentCard(opts = {}) {
  const url =
    opts.url || process.env.A2A_SERVER_URL || "http://localhost:4004";
  const version = opts.version || process.env.A2A_AGENT_VERSION || "0.1.0";

  return {
    name: process.env.A2A_AGENT_NAME || "SAP Backend Agent",
    description:
      "Read-only agent over SAP S/4HANA OData services (sales, procurement, " +
      "finance, master data), reached through a BTP destination and Cloud " +
      "Connector. Each skill maps deterministically to one backend OData call.",
    url,
    provider: {
      organization: process.env.A2A_PROVIDER_ORG || "MyOrg",
      url: process.env.A2A_PROVIDER_URL || "https://example.com",
    },
    version,
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["text", "data"],
    defaultOutputModes: ["text", "application/json"],
    skills: getSkills().map(toAgentSkill),
  };
}

module.exports = { buildAgentCard, toAgentSkill, PROTOCOL_VERSION };
