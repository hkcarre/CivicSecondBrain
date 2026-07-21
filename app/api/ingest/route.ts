/**
 * POST /api/ingest
 * Triggers ingestion of pending documents from the manifest.
 * Called from Admin panel or Lambda scheduler.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
import { verifyIngestAccess } from "@/lib/auth";

export const maxDuration = 300;

// Module-level flag to prevent concurrent ingest runs.
let ingestInProgress = false;

interface IngestSummary {
  message: string;
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  failedDocuments: string[];
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!(await verifyIngestAccess(req))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (ingestInProgress) {
    return NextResponse.json(
      { message: "Ingest already in progress." },
      { status: 409 }
    );
  }
  ingestInProgress = true;

  const limit = readLimit(body);

  // Async mode (scheduled callers): acknowledge immediately and run in the
  // background. Discovery + a real batch takes longer than any edge timeout
  // (Cloudflare ~100s, Railway edge <15m) — a synchronous response cannot
  // survive it, which made the nightly workflow's failure signal meaningless
  // even when the ingest itself succeeded (#251). The mutex above still
  // serializes runs; outcomes land in wiki/log.md as usual.
  if (isAsyncRequest(body)) {
    void runIngest(limit)
      .then((s) => console.log(`[ingest:async] complete — ${s.message}`))
      .catch((err) => {
        console.error("[ingest:async] failed:", err);
        appendToLog(
          `## [ERROR] [${new Date().toISOString()}] Async ingest run failed\n\n${(err as Error).message}`
        );
      })
      .finally(() => {
        ingestInProgress = false;
      });
    return NextResponse.json(
      { message: `Ingest started in background (limit ${limit}). Progress is recorded in wiki/log.md.`, async: true },
      { status: 202 }
    );
  }

  try {
    const summary = await runIngest(limit);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { message: `Error: ${(err as Error).message}` },
      { status: 500 }
    );
  } finally {
    ingestInProgress = false;
  }
}

async function runIngest(limit: number): Promise<IngestSummary> {
  {
    const manifest = loadManifest();

    // Discover new documents
    const discovered = await discoverDocuments();

    if (discovered.length === 0) {
      return {
        message: "No pending documents to ingest.",
        processed: 0,
        succeeded: 0,
        skipped: 0,
        failed: 0,
        failedDocuments: [],
      };
    }

    let processed = 0;
    let succeeded = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const doc of discovered.slice(0, limit)) {
      const id = docId(doc.url);

      const localPath = await downloadDocument(doc);
      if (!localPath) {
        console.error(`Download failed for ${doc.title}`);
        failures.push(doc.title);
        const ts = new Date().toISOString();
        appendToLog(`## [ERROR] [${ts}] Download failed: ${doc.title}`);
        continue;
      }

      // Checksum dedup: skip if already ingested AND file unchanged since last ingest.
      // This check requires localPath and must therefore run AFTER download.
      if (!needsIngestion(manifest, doc.url, localPath)) {
        console.log(`↩ Skipped (checksum unchanged): ${doc.title}`);
        continue;
      }

      processed++;
      const civicDoc = toCivicDocument(doc, localPath, id);

      try {
        const result = await ingestDocument(civicDoc);
        if (result.skipped) {
          // Unsupported format — do not mark as ingested so we retry if a parser is added later
          console.warn(`⏭ Skipped unsupported format: ${doc.title}`);
          skipped++;
        } else {
          markIngested(manifest, id, civicDoc, localPath);
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

    // Save manifest once after all documents are processed.
    // Saving inside the loop caused a race when concurrent ingests
    // interleaved writes; the module-level mutex plus this single
    // post-loop write keeps the manifest consistent.
    saveManifest(manifest);
    try {
      revalidatePath("/dashboard");
    } catch {
      // In async mode this runs outside the request scope, where Next may
      // reject revalidation — non-fatal; the dashboard's 60s ISR covers it.
    }

    return {
      message: `Ingested ${succeeded}/${processed} documents (${skipped} skipped — unsupported format).`,
      processed,
      succeeded,
      skipped,
      failed: failures.length,
      failedDocuments: failures,
    };
  }
}

function readLimit(body: unknown): number {
  if (typeof body !== "object" || body === null || !("limit" in body)) {
    return 10;
  }

  const limit = (body as { limit?: unknown }).limit;
  return typeof limit === "number" ? limit : 10;
}

function isAsyncRequest(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { async?: unknown }).async === true
  );
}
