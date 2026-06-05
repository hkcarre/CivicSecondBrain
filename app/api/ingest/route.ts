/**
 * POST /api/ingest
 * Triggers ingestion of pending documents from the manifest.
 * Called from Admin panel or Lambda scheduler.
 */

import { NextResponse } from "next/server";
import {
  discoverDocuments,
  downloadDocument,
  toCivicDocument,
} from "@/lib/scraper/schertz-scraper";
import { ingestDocument } from "@/lib/claude/ingest-engine";
import {
  loadManifest,
  saveManifest,
  docId,
  needsIngestion,
  markIngested,
} from "@/lib/manifest";
import { appendToLog } from "@/lib/wiki/writer";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const limit: number = body.limit ?? 10;

  try {
    const manifest = loadManifest();

    // Discover new documents
    const discovered = await discoverDocuments();
    const pending = discovered.filter((d) =>
      needsIngestion(manifest, d.url)
    );

    if (pending.length === 0) {
      return NextResponse.json({ message: "No pending documents to ingest." });
    }

    let processed = 0;
    let succeeded = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const doc of pending.slice(0, limit)) {
      processed++;
      const id = docId(doc.url);

      const localPath = await downloadDocument(doc);
      if (!localPath) continue;

      // Checksum dedup: skip if file unchanged since last ingest
      if (!needsIngestion(manifest, doc.url, localPath)) {
        console.log(`↩ Skipped (checksum unchanged): ${doc.title}`);
        continue;
      }

      const civicDoc = toCivicDocument(doc, localPath, id);

      try {
        const result = await ingestDocument(civicDoc);
        if (result.skipped) {
          // Unsupported format — do not mark as ingested so we retry if a parser is added later
          console.warn(`⏭ Skipped unsupported format: ${doc.title}`);
          skipped++;
        } else {
          markIngested(manifest, id, civicDoc, localPath);
          saveManifest(manifest);
          succeeded++;
        }
      } catch (err) {
        console.error(`Ingest failed for ${doc.title}:`, err);
        failures.push(doc.title);
        const ts = new Date().toISOString();
        appendToLog(
          `## [ERROR] [${ts}] Ingest failed: ${doc.title}\n\n${(err as Error).message}`
        );
      }
    }

    return NextResponse.json({
      message: `Ingested ${succeeded}/${processed} documents (${skipped} skipped — unsupported format).`,
      processed,
      succeeded,
      skipped,
      failed: failures.length,
      failedDocuments: failures,
    });
  } catch (err) {
    return NextResponse.json(
      { message: `Error: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
