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
import fs from "fs";
import crypto from "crypto";

const MANIFEST_PATH = "./raw-sources/manifest.json";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const limit: number = body.limit ?? 10;

  try {
    // Load manifest
    const manifest = fs.existsSync(MANIFEST_PATH)
      ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"))
      : {};

    // Discover new documents
    const discovered = await discoverDocuments();
    const pending = discovered.filter((d) => {
      const id = crypto.createHash("md5").update(d.url).digest("hex").slice(0, 12);
      return !manifest[id]?.ingestedAt;
    });

    if (pending.length === 0) {
      return NextResponse.json({ message: "No pending documents to ingest." });
    }

    let processed = 0;
    let succeeded = 0;

    for (const doc of pending.slice(0, limit)) {
      processed++;
      const id = crypto.createHash("md5").update(doc.url).digest("hex").slice(0, 12);

      const localPath = await downloadDocument(doc);
      if (!localPath) continue;

      const civicDoc = toCivicDocument(doc, localPath, id);

      try {
        await ingestDocument(civicDoc);
        civicDoc.ingestedAt = new Date().toISOString();
        manifest[id] = civicDoc;
        fs.mkdirSync("./raw-sources", { recursive: true });
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        succeeded++;
      } catch (err) {
        console.error(`Ingest failed for ${doc.title}:`, err);
      }
    }

    return NextResponse.json({
      message: `Ingested ${succeeded}/${processed} documents.`,
      processed,
      succeeded,
    });
  } catch (err) {
    return NextResponse.json(
      { message: `Error: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
