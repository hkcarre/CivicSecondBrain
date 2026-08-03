#!/usr/bin/env tsx
/**
 * ingest-facts.ts
 *
 * SINGLE DOCUMENT NUMERIC EXTRACTION — Download a document and run the
 * vision-based facts pass on it, writing results to Supabase.
 *
 * Deliberately separate from ingest-doc.ts (the narrative INGEST pass) —
 * this is a standalone, opt-in way to test/run numeric extraction on one
 * document at a time before it's wired into the main ingest pipeline.
 *
 * Usage:
 *   npm run ingest:facts -- --url https://www.schertz.com/DocumentCenter/View/13847
 *   npm run ingest:facts -- --url <url> --type budget --title "FY2025 Budget"
 */

import crypto from "crypto";
import { downloadDocument, toCivicDocument } from "../app/lib/scraper/schertz-scraper";
import { extractAndWriteFacts } from "../app/lib/claude/vision-extraction";
import { getCurrentCityId } from "../app/lib/db/cities";
import type { DocumentType } from "../app/types";

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const url = getArg("--url");
const typeArg = getArg("--type") as DocumentType | undefined;
const titleArg = getArg("--title");

if (!url) {
  console.error('Usage: npm run ingest:facts -- --url <url> [--type budget] [--title "My Doc"]');
  process.exit(1);
}

function docId(u: string): string {
  return crypto.createHash("md5").update(u).digest("hex").slice(0, 12);
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  CivicSecondBrain — Numeric Facts Extraction (vision pass)");
  console.log("═══════════════════════════════════════════════════\n");
  console.log(`  URL:   ${url}`);
  console.log(`  Type:  ${typeArg ?? "auto-detect"}\n`);

  const cityId = await getCurrentCityId();
  const today = new Date().toISOString().split("T")[0];

  const discovered = {
    title: titleArg ?? url!.split("/").pop() ?? "Unknown Document",
    url: url!,
    type: typeArg ?? ("financial-report" as DocumentType),
    date: today,
  };

  console.log("⬇  Downloading...");
  const localPath = await downloadDocument(discovered);
  if (!localPath) {
    console.error("✗ Download failed.");
    process.exit(1);
  }

  const civicDoc = toCivicDocument(discovered, localPath, docId(url!));

  console.log("👁  Extracting numeric facts via vision pass...");
  const outcome = await extractAndWriteFacts(civicDoc, cityId);

  console.log("\n═══════════════════════════════════════════════════");
  if (outcome.skipped) {
    console.log(`  SKIPPED — ${outcome.skipped}`);
  } else {
    console.log("  EXTRACTION COMPLETE");
    console.log(`  Facts found:   ${outcome.facts.length}`);
    console.log(`  Facts written: ${outcome.writeResult?.written ?? 0}`);
    console.log(`  Flagged for review: ${outcome.writeResult?.flagged ?? 0}`);
    console.log(`  Duplicates collapsed: ${outcome.writeResult?.duplicatesCollapsed ?? 0}`);
    for (const f of outcome.facts) {
      console.log(
        `    - ${f.metric_name} (${f.metric_id}): ${f.value} ${f.unit} [${f.period}, ${f.value_type}] confidence=${f.confidence}${f.confidence < 0.75 ? " ⚠ FLAGGED" : ""}`
      );
    }
  }
  console.log("");
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err.message);
  process.exit(1);
});
