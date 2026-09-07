"use strict";

/**
 * fetch-metadata.js — STEP 1 of the generation pipeline.
 *
 * Produces the RAW pre-fetched OData catalog snapshot that gen-catalog.js reads:
 *   03-a2a-cap-catalog-agent/reference/odata-catalog.snapshot.json
 *
 * TWO modes:
 *   (default) OFFLINE — treat the inherited reference snapshot
 *     01-a2a-cap-agent/reference/odata-catalog.json as if it were freshly
 *     fetched. This is the deterministic path used in this environment where NO
 *     live SAP backend is reachable. It just copies + stamps the snapshot.
 *
 *   --live    LIVE — pull the Gateway ServiceCollection and each service's
 *     $metadata through the BTP destination (srv/backend/destination.js). This
 *     is how an operator regenerates against a CUSTOMER's own SAP system. It
 *     writes the raw catalog list + raw $metadata XML under reference/live/.
 *
 * NOTE (verify-TODO): live $metadata is XML. Converting live XML -> the
 * normalized snapshot shape that gen-catalog consumes requires an $metadata
 * parser that is out of scope for this offline-first build. In --live mode this
 * script fetches and stores the raw artifacts and prints a clear TODO; it does
 * NOT overwrite the offline snapshot. Wire an XML->snapshot normalizer here when
 * a live system is available.
 *
 * Usage (Windows PowerShell):
 *   node scripts\fetch-metadata.js
 *   node scripts\fetch-metadata.js --live
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REF_DIR = path.join(ROOT, "reference");
const SNAPSHOT_OUT = path.join(REF_DIR, "odata-catalog.snapshot.json");

// The inherited pre-fetched snapshot (2.2MB) lives in the sibling 01 project.
const INHERITED_SNAPSHOT = path.join(
  ROOT,
  "..",
  "01-a2a-cap-agent",
  "reference",
  "odata-catalog.json"
);

// Gateway catalog service that lists all deployed OData services.
const SERVICE_COLLECTION_URL =
  "/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection?$format=json";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function log(msg) {
  process.stdout.write(msg + "\n");
}

/* -------------------------------------------------------------------------- */
/* OFFLINE (default)                                                          */
/* -------------------------------------------------------------------------- */

function runOffline() {
  if (!fs.existsSync(INHERITED_SNAPSHOT)) {
    throw new Error(
      "Inherited snapshot not found at " +
        INHERITED_SNAPSHOT +
        ". Cannot run offline. Provide the snapshot or run with --live against a real system."
    );
  }
  const raw = JSON.parse(fs.readFileSync(INHERITED_SNAPSHOT, "utf8"));
  const serviceNames = Object.keys(raw);

  ensureDir(REF_DIR);
  const stamped = {
    __snapshot: true,
    source: "offline:01-a2a-cap-agent/reference/odata-catalog.json",
    fetchedAt: new Date().toISOString(),
    serviceCount: serviceNames.length,
    services: raw,
  };
  fs.writeFileSync(SNAPSHOT_OUT, JSON.stringify(stamped, null, 2), "utf8");

  log("fetch-metadata: OFFLINE mode");
  log("  input : " + INHERITED_SNAPSHOT);
  log("  output: " + SNAPSHOT_OUT);
  log("  services: " + serviceNames.length);
  log("");
  log("Next: npm run gen:catalog");
}

/* -------------------------------------------------------------------------- */
/* LIVE (--live)                                                              */
/* -------------------------------------------------------------------------- */

async function runLive() {
  // Lazy-require so offline mode never loads the Cloud SDK.
  const backend = require("../srv/backend/destination");
  const liveDir = path.join(REF_DIR, "live");
  ensureDir(liveDir);

  log("fetch-metadata: LIVE mode (destination=" + backend.DESTINATION_NAME + ")");
  log("  fetching ServiceCollection: " + SERVICE_COLLECTION_URL);

  const collection = await backend.get(SERVICE_COLLECTION_URL);
  const listPath = path.join(liveDir, "service-collection.json");
  fs.writeFileSync(listPath, JSON.stringify(collection, null, 2), "utf8");
  log("  wrote " + listPath);

  // OData V2 ServiceCollection -> d.results[].TechnicalServiceName (or ID).
  const results =
    (collection && collection.d && collection.d.results) || [];
  const names = results
    .map((r) => r.TechnicalServiceName || r.ID || r.Title)
    .filter(Boolean);
  log("  services advertised: " + names.length);

  let ok = 0;
  let failed = 0;
  for (const name of names) {
    const metaUrl = "/sap/opu/odata/sap/" + name + "/$metadata";
    try {
      const xml = await backend.get(metaUrl);
      const outFile = path.join(liveDir, name + ".metadata.xml");
      fs.writeFileSync(
        outFile,
        typeof xml === "string" ? xml : JSON.stringify(xml),
        "utf8"
      );
      ok++;
    } catch (e) {
      failed++;
      log("  ! metadata fetch failed for " + name + ": " + (e && e.message));
    }
  }
  log("  raw $metadata fetched: " + ok + " ok, " + failed + " failed -> " + liveDir);
  log("");
  log("VERIFY-TODO: live $metadata is raw XML. Implement an XML->snapshot");
  log("normalizer here to feed gen-catalog.js, then re-run gen:catalog + gen:skills.");
  log("The offline snapshot was NOT modified.");
}

/* -------------------------------------------------------------------------- */

async function main() {
  const live = process.argv.includes("--live");
  if (live) {
    await runLive();
  } else {
    runOffline();
  }
}

main().catch((e) => {
  process.stderr.write("fetch-metadata failed: " + (e && e.stack ? e.stack : e) + "\n");
  process.exit(1);
});
