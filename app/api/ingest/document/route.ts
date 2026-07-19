/**
 * POST /api/ingest/document
 *
 * Ingests one user-provided document URL into the wiki without running the
 * full city document discovery scrape.
 */

import { NextResponse } from "next/server";
import { verifyIngestAccess } from "@/lib/auth";
import {
  ingestManualDocument,
  ManualIngestUnsupportedError,
  ManualIngestValidationError,
  parseManualIngestInput,
} from "@/lib/ingest/manual-ingest";

export const maxDuration = 300;

export async function POST(req: Request): Promise<NextResponse> {
  if (!(await verifyIngestAccess(req))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const input = parseManualIngestInput(body);
    const result = await ingestManualDocument(input);

    if (!result.success) {
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ManualIngestValidationError) {
      return NextResponse.json({ success: false, message: err.message }, { status: 400 });
    }

    if (err instanceof ManualIngestUnsupportedError) {
      return NextResponse.json(err.result, { status: 422 });
    }

    return NextResponse.json(
      { success: false, message: `Error: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
