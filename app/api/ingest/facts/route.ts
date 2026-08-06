/**
 * POST /api/ingest/facts
 *
 * Triggers the numeric facts pipeline (vision-extraction.ts) against
 * currently-discoverable documents, writing results to Supabase.
 *
 * This pipeline previously only existed as a local CLI script
 * (scripts/ingest-facts.ts, single-document, opt-in testing tool) — nothing
 * exposed it for a deployed city, so the `facts` table (and every chart that
 * reads from it) stayed empty regardless of how much narrative ingest had
 * run. This route gives it the same remote-trigger shape as /api/ingest.
 *
 * Deliberately a separate route/pipeline from /api/ingest, not merged into
 * it — see vision-extraction.ts's own module comment on why narrative and
 * numeric extraction must never share one LLM call.
 */

import { NextResponse } from "next/server";
import {
  discoverDocuments,
  downloadDocument,
  toCivicDocument,
} from "@/lib/scraper/schertz-scraper";
import { extractAndWriteFacts } from "@/lib/claude/vision-extraction";
import { getCurrentCityId } from "@/lib/db/cities";
import { docId } from "@/lib/manifest";
import { verifyIngestAccess } from "@/lib/auth";
import type { DocumentType } from "@/types";

export const maxDuration = 300;

// Module-level flag to prevent concurrent facts-ingest runs. Separate from
// the narrative pipeline's own flag in /api/ingest — the two pipelines are
// independent and safe to run concurrently with each other.
let factsIngestInProgress = false;

// Numeric facts live in financial documents, not agendas/minutes/ordinances.
// Filtering here (before downloading) avoids spending a Claude Vision call
// on documents that structurally won't have tables to extract.
const FACT_ELIGIBLE_TYPES = new Set<DocumentType>(["budget", "financial-report"]);

interface FactsIngestSummary {
  message: string;
  processed: number;
  factsWritten: number;
  factsFlagged: number;
  skippedNonPdf: number;
  failed: number;
  failedDocuments: string[];
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!(await verifyIngestAccess(req))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (factsIngestInProgress) {
    return NextResponse.json(
      { message: "Facts ingest already in progress." },
      { status: 409 }
    );
  }
  factsIngestInProgress = true;

  const limit = readLimit(body);

  if (isAsyncRequest(body)) {
    void runFactsIngest(limit)
      .then((s) => console.log(`[ingest:facts:async] complete — ${s.message}`))
      .catch((err) => console.error("[ingest:facts:async] failed:", err))
      .finally(() => {
        factsIngestInProgress = false;
      });
    return NextResponse.json(
      { message: `Facts ingest started in background (limit ${limit}).`, async: true },
      { status: 202 }
    );
  }

  try {
    const summary = await runFactsIngest(limit);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { message: `Error: ${(err as Error).message}` },
      { status: 500 }
    );
  } finally {
    factsIngestInProgress = false;
  }
}

async function runFactsIngest(limit: number): Promise<FactsIngestSummary> {
  const cityId = await getCurrentCityId();
  const discovered = (await discoverDocuments()).filter((d) =>
    FACT_ELIGIBLE_TYPES.has(d.type)
  );

  if (discovered.length === 0) {
    return {
      message: "No budget/financial-report documents found to process.",
      processed: 0,
      factsWritten: 0,
      factsFlagged: 0,
      skippedNonPdf: 0,
      failed: 0,
      failedDocuments: [],
    };
  }

  let processed = 0;
  let factsWritten = 0;
  let factsFlagged = 0;
  let skippedNonPdf = 0;
  const failures: string[] = [];

  for (const doc of discovered.slice(0, limit)) {
    const id = docId(doc.url);

    const localPath = await downloadDocument(doc);
    if (!localPath) {
      console.error(`Download failed for ${doc.title}`);
      failures.push(doc.title);
      continue;
    }

    processed++;
    const civicDoc = toCivicDocument(doc, localPath, id);

    try {
      const outcome = await extractAndWriteFacts(civicDoc, cityId);
      if (outcome.skipped) {
        skippedNonPdf++;
      } else {
        factsWritten += outcome.writeResult?.written ?? 0;
        factsFlagged += outcome.writeResult?.flagged ?? 0;
      }
    } catch (err) {
      console.error(`Facts extraction failed for ${doc.title}:`, err);
      failures.push(doc.title);
    }
  }

  return {
    message: `Processed ${processed} documents — ${factsWritten} facts written (${factsFlagged} flagged for review, ${skippedNonPdf} skipped as non-PDF).`,
    processed,
    factsWritten,
    factsFlagged,
    skippedNonPdf,
    failed: failures.length,
    failedDocuments: failures,
  };
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
