#!/usr/bin/env tsx
/**
 * scraper-check.ts
 *
 * CHECK FOR NEW DOCUMENTS — Discover documents without downloading or ingesting.
 * Compares against the existing manifest and reports what's new.
 *
 * Usage:
 *   npm run scrape:check
 */

import fs from "fs";
import crypto from "crypto";
import { discoverDocuments } from "../app/lib/scraper/schertz-scraper";
import type { CivicDocument } from "../app/types";

const MANIFEST_PATH = "./raw-sources/manifest.json";

function loadManifest(): Record<string, CivicDocument> {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  }
  return {};
}

function docId(url: string): string {
  return crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  CivicSecondBrain — Check for New Documents");
  console.log("═══════════════════════════════════════════════════\n");

  const manifest = loadManifest();
  const alreadyIngested = new Set(
    Object.values(manifest)
      .filter((d) => d.ingestedAt)
      .map((d) => docId(d.sourceUrl))
  );

  console.log(`📋 Currently ingested: ${alreadyIngested.size} documents\n`);
  console.log("🔍 Discovering documents from all sources...\n");

  const discovered = await discoverDocuments();

  const newDocs = discovered.filter((d) => !alreadyIngested.has(docId(d.url)));

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Total discovered:  ${discovered.length}`);
  console.log(`  Already ingested:  ${alreadyIngested.size}`);
  console.log(`  New documents:     ${newDocs.length}`);

  if (newDocs.length === 0) {
    console.log("\n✓ No new documents found. Wiki is up to date.");
  } else {
    console.log(`\n📥 ${newDocs.length} new document(s) ready to ingest:\n`);

    // Group by type
    const byType = newDocs.reduce<Record<string, typeof newDocs>>(
      (acc, d) => ({ ...acc, [d.type]: [...(acc[d.type] ?? []), d] }),
      {}
    );

    for (const [type, docs] of Object.entries(byType)) {
      console.log(`  [${type}] ${docs.length} documents`);
      docs.slice(0, 3).forEach((d) =>
        console.log(`    - ${d.title.slice(0, 70)}`)
      );
      if (docs.length > 3) console.log(`    ... and ${docs.length - 3} more`);
    }

    console.log("\n  Run the following to ingest new documents:");
    console.log("  npm run ingest:seed\n");
  }
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err.message);
  process.exit(1);
});
