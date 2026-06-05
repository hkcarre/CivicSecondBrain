#!/usr/bin/env tsx
/**
 * ingest-seed.ts
 *
 * SEED INGESTION SCRIPT — Run once to bootstrap the CivicSecondBrain
 * wiki from the Schertz, TX government document corpus.
 *
 * Usage:
 *   npm run ingest:seed
 *   npm run ingest:seed -- --dry-run        # discover only, no download
 *   npm run ingest:seed -- --board council  # specific board only
 *   npm run ingest:seed -- --type budget    # specific doc type only
 *   npm run ingest:seed -- --limit 5        # process first N docs
 *
 * What it does:
 *   1. Scrapes schertz.com/27/Government to discover all documents
 *   2. Downloads PDFs and HTML files to raw-sources/
 *   3. Runs Claude INGEST on each document
 *   4. Writes/updates wiki pages
 *   5. Produces a manifest file: raw-sources/manifest.json
 */

// Env is loaded by tsx --env-file=.env.local (see package.json scripts)
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  discoverDocuments,
  downloadDocument,
  toCivicDocument,
  type DiscoveredDocument,
} from "../app/lib/scraper/schertz-scraper";
import { ingestDocument } from "../app/lib/claude/ingest-engine";
import { appendToLog } from "../app/lib/wiki/writer";
import type { CivicDocument } from "../app/types";

// ─── Parse CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const idx = args.indexOf("--limit");
  return idx >= 0 ? parseInt(args[idx + 1]) : Infinity;
})();
const BOARD_FILTER = (() => {
  const idx = args.indexOf("--board");
  return idx >= 0 ? args[idx + 1] : null;
})();
const TYPE_FILTER = (() => {
  const idx = args.indexOf("--type");
  return idx >= 0 ? args[idx + 1] : null;
})();

const MANIFEST_PATH = "./raw-sources/manifest.json";
const RAW_SOURCES_PATH = process.env.RAW_SOURCES_PATH ?? "./raw-sources";

// ─── Prioritized seed document list ───────────────────────────────────────
//
// Verified Schertz DocumentCenter URLs (confirmed from live site 2026-06-03).
// Sources: https://www.schertz.com/27/Government and /251/Budget-Finance
//
const PRIORITY_SEED_URLS: Array<{
  title: string;
  url: string;
  type: CivicDocument["type"];
  board?: CivicDocument["board"];
}> = [
  // City Charter — foundational governance document
  {
    title: "City Charter 2024",
    url: "https://www.schertz.com/DocumentCenter/View/13333/City-of-Schertz-City-Charter-2024",
    type: "charter",
  },
  // Strategic Plan
  {
    title: "Strategic Plan 2024-2025",
    url: "https://www.schertz.com/DocumentCenter/View/12694/City-of-Schertz-Strategic-Plan-2024-25",
    type: "strategic-plan",
  },
  // 2026 Master Calendar
  {
    title: "2026 Master Calendar",
    url: "https://www.schertz.com/DocumentCenter/View/13925/2026-City-of-Schertz-Master-Calendar",
    type: "agenda",
  },
  // FY2025-26 Adopted Budget (most recent)
  {
    title: "Adopted Budget FY2025-26",
    url: "https://www.schertz.com/DocumentCenter/View/13847",
    type: "budget",
  },
  // FY2024-25 Adopted Budget
  {
    title: "Adopted Budget FY2024-25",
    url: "https://www.schertz.com/DocumentCenter/View/13068",
    type: "budget",
  },
  // FY2023-24 Adopted Budget (for 3-year trend analysis)
  {
    title: "Adopted Budget FY2023-24",
    url: "https://www.schertz.com/DocumentCenter/View/9601",
    type: "budget",
  },
  // FY2022-23 Adopted Budget
  {
    title: "Adopted Budget FY2022-23",
    url: "https://www.schertz.com/DocumentCenter/View/8193",
    type: "budget",
  },
  // Capital Improvement Program
  {
    title: "Capital Improvement Program FY2025-26",
    url: "https://www.schertz.com/DocumentCenter/View/13860",
    type: "budget",
  },
  // Tax Rates
  {
    title: "Schertz Tax Rates",
    url: "https://www.schertz.com/DocumentCenter/View/8468/Schertz-Tax-Rates",
    type: "financial-report",
  },
];

// ─── Load or create manifest ───────────────────────────────────────────────

function loadManifest(): Record<string, CivicDocument> {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  }
  return {};
}

function saveManifest(manifest: Record<string, CivicDocument>): void {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function docId(url: string): string {
  return crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  CivicSecondBrain — Schertz, TX Seed Ingestion");
  console.log("═══════════════════════════════════════════════════\n");

  if (DRY_RUN) console.log("🔍 DRY RUN — no files will be downloaded or written\n");

  const manifest = loadManifest();
  const today = new Date().toISOString().split("T")[0];

  // ── Step 1: Scrape document discovery ────────────────────────────────────
  //
  // When --type or --limit flags are used, skip the full live scrape and work
  // only from the priority seed list. This avoids scraping thousands of
  // documents from DocumentCenter/Laserfiche when the user just wants to
  // quickly ingest a handful of specific docs.
  //
  // Full scrape runs only when neither flag is set (i.e. unattended bulk ingest).

  const USE_PRIORITY_ONLY = !!(TYPE_FILTER || BOARD_FILTER || LIMIT < Infinity);

  const priorityDocs: DiscoveredDocument[] = PRIORITY_SEED_URLS.map((d) => ({
    ...d,
    date: today,
  }));

  let discovered: DiscoveredDocument[] = [];

  if (USE_PRIORITY_ONLY) {
    console.log("STEP 1 — Using priority seed list (skipping full scrape due to --type/--limit/--board flag)...\n");
  } else {
    console.log("STEP 1 — Discovering documents from all sources (full scrape)...\n");
    try {
      discovered = await discoverDocuments();
    } catch (err) {
      console.warn(
        `⚠ Auto-discovery failed: ${(err as Error).message}\n` +
          `  Falling back to priority seed list only.`
      );
    }
  }

  // Merge: priority first, then discovered, deduped by URL
  const seenUrls = new Set<string>();
  const allDocs: DiscoveredDocument[] = [];

  for (const doc of [...priorityDocs, ...discovered]) {
    if (!seenUrls.has(doc.url)) {
      seenUrls.add(doc.url);
      allDocs.push(doc);
    }
  }

  // Apply filters
  let filteredDocs = allDocs;
  if (BOARD_FILTER) {
    filteredDocs = filteredDocs.filter((d) => d.board === BOARD_FILTER);
    console.log(`  Filtered to board: ${BOARD_FILTER}`);
  }
  if (TYPE_FILTER) {
    filteredDocs = filteredDocs.filter((d) => d.type === TYPE_FILTER);
    console.log(`  Filtered to type: ${TYPE_FILTER}`);
  }

  // Skip already-ingested
  const toProcess = filteredDocs.filter((d) => {
    const id = docId(d.url);
    return !manifest[id]?.ingestedAt;
  });

  console.log(`\n📊 Discovery summary:`);
  console.log(`  Total discovered:     ${allDocs.length}`);
  console.log(`  After filters:        ${filteredDocs.length}`);
  console.log(`  Already ingested:     ${filteredDocs.length - toProcess.length}`);
  console.log(`  To process this run:  ${Math.min(toProcess.length, LIMIT)}`);

  if (DRY_RUN) {
    console.log("\n📋 Documents that would be processed:");
    toProcess.slice(0, LIMIT).forEach((d, i) => {
      console.log(`  ${i + 1}. [${d.type}] ${d.title}`);
      console.log(`     ${d.url}`);
    });
    console.log("\n✓ Dry run complete.");
    return;
  }

  // ── Step 2: Download + Ingest ─────────────────────────────────────────────

  console.log("\nSTEP 2 — Downloading and ingesting documents...\n");

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  const startTime = Date.now();

  for (const doc of toProcess) {
    if (processed >= LIMIT) break;
    processed++;

    const id = docId(doc.url);
    console.log(`\n[${processed}/${Math.min(toProcess.length, LIMIT)}] ${doc.title}`);

    // Download
    const localPath = await downloadDocument(doc);
    if (!localPath) {
      failed++;
      continue;
    }

    // Build CivicDocument
    const civicDoc = toCivicDocument(doc, localPath, id);

    // Ingest via Claude
    try {
      const result = await ingestDocument(civicDoc);
      civicDoc.ingestedAt = new Date().toISOString();
      manifest[id] = civicDoc;
      saveManifest(manifest);
      succeeded++;

      console.log(`  📝 Pages updated: ${result.pagesUpdated.length}`);
      console.log(`  📝 Pages created: ${result.pagesCreated.length}`);
      if (result.votesRecorded > 0) {
        console.log(`  🗳  Votes recorded: ${result.votesRecorded}`);
      }

      // Delete the downloaded file after successful ingest to free disk space.
      // The manifest records that it was ingested so it won't be re-processed.
      if (localPath && fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log(`  🗑  Deleted local file (ingested)`);
      }
    } catch (err) {
      console.error(`  ✗ Ingest failed: ${(err as Error).message}`);
      failed++;
      // Save to manifest as failed so we can retry
      manifest[id] = { ...civicDoc, ingestedAt: undefined };
      saveManifest(manifest);
    }

    // Pause to respect rate limits and allow GC to reclaim memory
    await sleep(2000);
    if (typeof global.gc === "function") global.gc();
  }

  // ── Step 3: Summary ───────────────────────────────────────────────────────

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  SEED INGESTION COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Documents processed: ${processed}`);
  console.log(`  Succeeded:           ${succeeded}`);
  console.log(`  Failed:              ${failed}`);
  console.log(`  Elapsed:             ${elapsed}s`);
  console.log(`  Manifest saved:      ${MANIFEST_PATH}`);
  console.log("\n  Next steps:");
  console.log("  1. Review wiki/ pages generated");
  console.log("  2. Run `npm run lint:wiki` for health check");
  console.log("  3. Run `npm run dev` to launch the chat interface");
  console.log("");

  // Log the batch operation
  appendToLog(`## [${today}] INGEST-BATCH | Schertz seed ingestion
**Sources processed:** ${processed}
**Succeeded:** ${succeeded} | **Failed:** ${failed}
**Elapsed:** ${elapsed}s
**Manifest:** ${MANIFEST_PATH}
**Top themes:** Initial bootstrap of Schertz, TX civic document corpus
**Data source:** https://www.schertz.com/27/Government`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err);
  process.exit(1);
});
