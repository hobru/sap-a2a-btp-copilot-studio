"use strict";

/**
 * Natural-language intent resolution for plain-text A2A messages.
 *
 * Copilot Studio (and most A2A callers that front an LLM) send the user's
 * request as a plain `text` part, NOT as a structured skill+params DataPart.
 * This module turns such free text into a `{ skillId, params }` invocation that
 * the deterministic executor can run.
 *
 * Two strategies, tried in order:
 *   (A) parseDeterministic  — default, dependency-free. Scores every registered
 *       skill against the text (phrase/keyword/tag/example overlap + list-vs-get
 *       intent) and regex-extracts identifiers into the chosen skill's params.
 *   (B) parseWithAzure      — optional. If AZURE_OPENAI_ENDPOINT + _API_KEY +
 *       _DEPLOYMENT_NAME are set, ask Azure OpenAI (JSON mode) for {skill,params}.
 *       Any failure silently falls back to (A). No SAP Gen-AI-Hub is used.
 *
 * Values emitted here are RAW / UNPADDED. `params.js` downstream enforces
 * required/default, coerces types, left-pads, and caps — so this module only
 * needs to produce best-effort raw hints.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "from", "to", "of", "in", "on",
  "by", "me", "my", "please", "show", "get", "give", "list", "find", "return",
  "retrieve", "display", "all", "any", "is", "are", "what", "which", "that",
  "this", "number", "no", "id", "sap", "s4hana", "s", "4hana", "backend",
  "system", "data", "record", "records", "each", "their", "its", "value",
  "values", "detail", "details", "status", "date", "dates", "total", "net",
]);

/** Lowercase + collapse punctuation to single spaces for matching. */
function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9./%-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split into whole-word tokens, dropping stopwords and 1-char noise. */
function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/** Build all adjacent 2- and 3-word phrases from a normalized string. */
function phrasesOf(text) {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length - 1; i++) {
    out.push(words[i] + " " + words[i + 1]);
    if (i < words.length - 2) {
      out.push(words[i] + " " + words[i + 1] + " " + words[i + 2]);
    }
  }
  return out;
}

/**
 * Pre-compute the searchable "profile" of a skill: a set of unigrams and a set
 * of multi-word phrases drawn from id, name, domain, tags and examples.
 */
function skillProfile(skill) {
  const unigrams = new Set();
  const phrases = new Set();

  const addWords = (s) => tokenize(s).forEach((w) => unigrams.add(w));
  const addPhrases = (s) => phrasesOf(s).forEach((p) => phrases.add(p));

  addWords(skill.id.replace(/-/g, " "));
  addWords(skill.name || "");
  addWords(skill.domain || "");
  addPhrases(skill.id.replace(/-/g, " "));
  addPhrases(skill.name || "");

  for (const tag of skill.tags || []) {
    const t = String(tag).replace(/-/g, " ");
    addWords(t);
    if (t.includes(" ")) phrases.add(normalizeText(t));
  }
  for (const ex of skill.examples || []) {
    addWords(ex);
    addPhrases(ex);
  }

  return { unigrams, phrases };
}

const LIST_CUE_RE =
  /\b(list|show|display|all|recent|latest|top|first|last|overview|several|multiple|open)\b/;
const COUNT_PLURAL_RE = /\b\d{1,3}\s+[a-z]+s\b/; // "5 sales orders"
const GET_CUE_RE = /\b(status|detail|details|state|info|information|about|for)\b/;

/**
 * Score how well a skill matches the text.
 *  - phrase hit: +3 (2-word) / +4 (3-word)   (strong, disambiguating signal)
 *  - unigram hit: +1 each, capped at +4       (avoid example-heavy skills winning)
 *  - operation intent bias: +2                 (list vs getByKey)
 */
function scoreSkill(skill, profile, normText) {
  let phraseScore = 0;
  for (const p of profile.phrases) {
    if (normText.includes(p)) phraseScore += p.split(" ").length >= 3 ? 4 : 3;
  }

  let uniScore = 0;
  for (const w of profile.unigrams) {
    if (new RegExp(`\\b${escapeRe(w)}\\b`).test(normText)) uniScore += 1;
  }
  if (uniScore > 4) uniScore = 4;

  let intentScore = 0;
  const op = skill.backend && skill.backend.operation;
  const mode = skill.backend && skill.backend.mode;
  const looksList = LIST_CUE_RE.test(normText) || COUNT_PLURAL_RE.test(normText);
  // Static featured skills (op = list / getByKey) and dynamic meta-skills
  // (op = dynamic, mode = list / getByKey) both get a list-vs-get intent bias.
  const isList = op === "list" || (op === "dynamic" && mode === "list");
  const isGet = op === "getByKey" || (op === "dynamic" && mode === "getByKey");
  if (isList && looksList) intentScore += 2;
  if (isGet && !looksList && GET_CUE_RE.test(normText)) intentScore += 1;

  return phraseScore + uniScore + intentScore;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ---------------------------------------------------------------------------
 * Identifier extraction (GENERIC catalog agent).
 *
 * This agent is domain-agnostic: skills are the generic meta-skills
 * (service/entitySet/domain/key/filter/top params) plus curated featured
 * getByKey/list skills. So extraction is keyed by the small set of canonical
 * catalog param names rather than any per-domain business identifier table.
 * A structured `filter` is never guessed from free text (injection-safe);
 * Copilot Studio supplies it as a structured DataPart instead.
 * ------------------------------------------------------------------------- */

/** Grab the first identifier that follows any of the given trigger words. */
function idAfter(text, triggers, { idRe = "\\d{3,}" } = {}) {
  const t = triggers.map(escapeRe).join("|");
  const re = new RegExp(`(?:${t})\\b[^0-9a-z]{0,20}?(${idRe})`, "i");
  const m = text.match(re);
  return m ? m[1] : undefined;
}

/** Extract a small page-size count ("5 sales orders", "top 10", "first 5"). */
function extractTop(text) {
  let m = text.match(/\b(\d{1,3})\s+(?:[a-z-]+\s+){0,3}?(?:orders|order|records|items|line items|entries|results|deliveries|invoices|partners|quotations|documents)\b/i);
  if (m) return parseInt(m[1], 10);
  m = text.match(/\b(?:top|first|last|latest|recent|show me|retrieve|get me|give me|only)\s+(\d{1,3})\b/i);
  if (m) return parseInt(m[1], 10);
  return undefined;
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
  oct: 10, nov: 11, dec: 12,
};

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Resolve a posting-date range from the text.
 * Handles: ISO "between 2026-01-01 and 2026-01-31", "from X to Y",
 * a month name + year ("January 2026" -> full month), or a bare year.
 */
function extractDateRange(text) {
  const isoRange = text.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:to|-|and|until|through|\.\.)\s*(\d{4}-\d{2}-\d{2})/i
  );
  if (isoRange) return { from: isoRange[1], to: isoRange[2] };

  const month = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/i
  );
  if (month) {
    const mm = MONTHS[month[1].toLowerCase()];
    const yy = parseInt(month[2], 10);
    if (mm) {
      return {
        from: `${yy}-${pad2(mm)}-01`,
        to: `${yy}-${pad2(mm)}-${pad2(lastDayOfMonth(yy, mm))}`,
      };
    }
  }

  const year = text.match(/\b(?:in|for|during|year)\s+(20\d{2})\b/i) || text.match(/\b(20\d{2})\b/);
  if (year) {
    const yy = parseInt(year[1], 10);
    return { from: `${yy}-01-01`, to: `${yy}-12-31` };
  }
  return {};
}

/** Extract an OData service technical name (e.g. API_BUSINESS_PARTNER). */
function extractService(text) {
  const m = String(text).match(/\bAPI_[A-Za-z0-9_]+\b/);
  return m ? m[0].toUpperCase() : undefined;
}

/**
 * Extract an entity set name. S/4 OData entity sets are overwhelmingly of the
 * form A_BusinessPartner / A_SalesOrder (single letter, underscore, CamelCase).
 */
function extractEntitySet(text) {
  const m = String(text).match(/\b[A-Z]_[A-Za-z0-9_]+\b/);
  return m ? m[0] : undefined;
}

const DOMAIN_WORDS = [
  "sales", "procurement", "purchasing", "finance", "logistics",
  "master data", "master-data", "catalog",
];

/** Extract a coarse domain hint from the text (used only to filter services). */
function extractDomain(text) {
  const t = normalizeText(text);
  for (const d of DOMAIN_WORDS) {
    if (t.includes(d.replace("-", " "))) return d.replace(" ", "-");
  }
  return undefined;
}

/**
 * Extract a single-field key value for getByKey. Prefer an id right after a
 * cue word; else fall back to any long standalone number or material-like code.
 * Service/entity-set tokens (API_*, A_*) are stripped first so they are never
 * mistaken for a key.
 */
function extractKey(text) {
  const stripped = String(text)
    .replace(/\bAPI_[A-Za-z0-9_]+\b/g, " ")
    .replace(/\b[A-Z]_[A-Za-z0-9_]+\b/g, " ");
  const after = idAfter(stripped, [
    "key", "number", "record", "id", "partner", "order", "product",
    "material", "supplier", "invoice", "delivery", "customer",
  ]);
  if (after) return after;
  const num = stripped.match(/\b\d{3,}\b/);
  if (num) return num[0];
  const code = stripped.match(/\b([A-Za-z]{1,4}[-_/]?\d[A-Za-z0-9._/-]*)\b/);
  return code ? code[1] : undefined;
}

/** Per-param extractor dispatch. Returns a raw (unpadded) value or undefined. */
function extractParam(name, type, text) {
  switch (name) {
    case "top":
      return extractTop(text);
    case "service":
      return extractService(text);
    case "entitySet":
      return extractEntitySet(text);
    case "domain":
      return extractDomain(text);
    case "key":
      return extractKey(text);
    case "filter":
      // Structured, injection-sensitive input — never guessed from free text.
      return undefined;
    default:
      // Unknown param name: only auto-fill obvious integers, never guess strings.
      if (type === "integer") return extractTop(text);
      return undefined;
  }
}

/**
 * (A) Deterministic parse. Returns { skillId, params } or {} if nothing scores.
 */
function parseDeterministic(text, skills) {
  const normText = normalizeText(text);
  if (!normText) return {};

  let best = null;
  let second = -Infinity;
  for (const skill of skills) {
    const score = scoreSkill(skill, skillProfile(skill), normText);
    if (!best || score > best.score) {
      second = best ? best.score : second;
      best = { skill, score };
    } else if (score > second) {
      second = score;
    }
  }

  // Require a real signal (at least one phrase hit or strong keyword overlap).
  if (!best || best.score < 3) return {};

  const skill = best.skill;
  const params = {};
  for (const p of skill.params || []) {
    const v = extractParam(p.name, p.type, text);
    if (v !== undefined) params[p.name] = v;
  }

  return { skillId: skill.id, params, score: best.score };
}

/* ---------------------------------------------------------------------------
 * (B) Optional Azure OpenAI parse.
 * ------------------------------------------------------------------------- */

function azureConfigured() {
  return Boolean(
    process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME
  );
}

function skillCatalogForPrompt(skills) {
  return skills.map((s) => ({
    id: s.id,
    description: (s.description || s.name || "").replace(/\s+/g, " ").trim(),
    params: (s.params || []).map((p) => ({
      name: p.name,
      type: p.type,
      required: Boolean(p.required),
    })),
  }));
}

async function parseWithAzure(text, skills) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-06-01";
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const system =
    "You map a user's request to exactly one SAP backend skill and its parameters. " +
    "You are given a catalog of skills as JSON. Choose the single best skill id, or null if none fit. " +
    "Extract only parameters that are explicitly present in the request; do not invent values. " +
    "Return raw, unpadded values. Respond ONLY with a JSON object of the form " +
    '{"skill": "<id-or-null>", "params": { ... }}.';

  const userPrompt =
    "Skill catalog:\n" +
    JSON.stringify(skillCatalogForPrompt(skills)) +
    "\n\nUser request:\n" +
    String(text);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const skillId = parsed.skill || parsed.skillId;
    if (!skillId || skillId === "null") return null;
    if (!skills.some((s) => s.id === skillId)) return null;
    return { skillId, params: parsed.params || {} };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve a plain-text request into a skill invocation.
 *
 * @param {string} text    concatenated text parts from the A2A message
 * @param {Array}  skills  registry skills (getSkills())
 * @returns {Promise<{ skillId?: string, params: Object }>}
 */
async function resolveIntent(text, skills) {
  if (!text || !skills || !skills.length) return { params: {} };

  if (azureConfigured()) {
    const azure = await parseWithAzure(text, skills);
    if (azure && azure.skillId) return { skillId: azure.skillId, params: azure.params || {} };
    // fall through to deterministic on any Azure miss/failure
  }

  const det = parseDeterministic(text, skills);
  if (det.skillId) return { skillId: det.skillId, params: det.params };
  return { params: {} };
}

module.exports = {
  resolveIntent,
  parseDeterministic,
  parseWithAzure,
  azureConfigured,
  // exported for tests
  extractTop,
  extractDateRange,
  scoreSkill,
  skillProfile,
  normalizeText,
};
