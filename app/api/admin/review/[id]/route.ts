/**
 * POST /api/admin/review/[id]
 * Body: { action: "approve" | "reject" }
 *
 * Approves or rejects one pending-review item. Approving replays its
 * queued writes through the same writer.ts functions the ingest/LINT
 * pipelines used to call directly (see pending-review.ts) — this is the
 * only place that content actually goes live.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { approveReview, rejectReview } from "@/lib/wiki/pending-review";
import { verifyReviewAccess } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyReviewAccess(req))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: unknown }).action;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { message: 'Body must include "action": "approve" or "reject".' },
      { status: 400 }
    );
  }

  const ok =
    action === "approve" ? approveReview(id) : rejectReview(id);

  if (!ok) {
    return NextResponse.json(
      { message: "No pending review item with that id (already handled?)." },
      { status: 404 }
    );
  }

  if (action === "approve") {
    // Newly-live content should show up without waiting out the ISR window.
    try {
      revalidatePath("/dashboard");
      revalidatePath("/wiki");
    } catch {
      // Non-fatal — the pages' own revalidate interval covers this anyway.
    }
  }

  return NextResponse.json({ message: `Review item ${action}d.`, id, action });
}
