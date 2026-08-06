/**
 * GET /api/admin/review
 * Lists everything currently pending human review before it can reach
 * chat/citizens (queued ingest content, queued LINT recommendations).
 * See app/lib/wiki/pending-review.ts for why this queue exists.
 */

import { NextResponse } from "next/server";
import { listPendingReviews } from "@/lib/wiki/pending-review";
import { verifyReviewAccess } from "@/lib/auth";

export async function GET(req: Request) {
  if (!(await verifyReviewAccess(req))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const items = listPendingReviews();
  return NextResponse.json({ items });
}
