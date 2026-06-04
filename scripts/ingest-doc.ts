#!/usr/bin/env tsx
/**
 * ingest-doc.ts
 *
 * SINGLE DOCUMENT INGEST — Download and ingest one document by URL.
 *
 * Usage:
 *   npm run ingest:doc -- --url https://www.schertz.com/DocumentCenter/View/13847
 *   npm run ingest:doc -- --url <url> --type budget --title "FY2025 Budget"
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { downloadDocument, toCivicDocument } from "../app/lib/scraper/schertz-scraper";
import { ingestDocument } from "../app/lib/claude/ingest-engine";
import { appendToLog } from "../app/lib/wiki/writer";
import type { DocumentType } from "../app/types";

// ─── Parse CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const url = getArg("--url");
const typeArg = getArg("--type") as DocumentType | undefined;
const titleArg = getArg("--title");

if (!url) {
  console.error("Usage: npm run ingest:doc -- --url <url> [--type budget] [--title \"My Doc\"]");
  process.exit(1);
}

const MANIFEST_PATH = "./raw-sources/manifest.json";
const RAW_SOURCES_PATH = process.env.RAW_SOURCES_PATH ?? "./raw-sources";

function loadManifest(): Record<string, any> {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  }
  return {};
}

function saveManifest(manifest: Record<string, any>): void {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function docId(u: string): string {
  return crypto.createHash("md5").update(u).digest("hex").slice(0, 12);
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  CivicSecondBrain — Single Document Ingest");
  console.log("═══════════════════════════════════════════════════\n");
  console.log(`  URL:   ${url}`);
  console.log(`  Type:  ${typeArg ?? "auto-detect"}`);
  console.log(`  Title: ${titleArg ?? "auto-detect"}\n`);

  const manifest = loadManifest();
  const id = docId(url!);
  const today = new Date().toISOString().split("T")[0];

  // Check if already ingested
  if (manifest[id]?.ingestedAt) {
    console.log("⚠  Document already ingested:", manifest[id].title);
    console.log("   Use ingest:seed to re-ingest or clear the manifest entry.\n");
    process.exit(0);
  }

  // Build a DiscoveredDocument
  const discovered = {
    title: titleArg ?? url!.split("/").pop() ?? "Unknown Document",
    url: url!,
    type: typeArg ?? "financial-report" as DocumentType,
    date: today,
  };

  // Download
  console.log("⬇  Downloading...");
  const localPath = await downloadDocument(discovered);
  if (!localPath) {
    console.error("✗ Download failed.");
    process.exit(1);
  }

  // Build CivicDocument
  const civicDoc = toCivicDocument(discovered, localPath, id);

  // Ingest
  console.log("🤖 Ingesting via Claude...");
  try {
    const result = await ingestDocument(civicDoc);
    civicDoc.ingestedAt = new Date().toISOString();
    manifest[id] = civicDoc;
    saveManifest(manifest);

    console.log("\n═══════════════════════════════════════════════════");
    console.log("  INGEST COMPLETE");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Pages updated: ${result.pagesUpdated.length}`);
    console.log(`  Pages created: ${result.pagesCreated.length}`);
    if (result.votesRecorded > 0) console.log(`  Votes recorded: ${result.votesRecorded}`);
    console.log("");
  } catch (err) {
    console.error("✗ Ingest failed:", (err as Error).message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err.message);
  process.exit(1);
});
