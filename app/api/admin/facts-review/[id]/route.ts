/**
 * POST /api/admin/facts-review/[id]
 * Body: { action: "approve" | "reject" }
 *
 * Approves or rejects one flagged numeric fact. Mirrors
 * /api/admin/review/[id] (the wiki content review gate) — same dual-check
 * auth, same approve/reject shape — but operates on the `facts` table
 * directly via app/lib/db/facts.ts rather than the file-based pending-review
 * queue, since facts already live in Supabase with their own review_status
 * column.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { reviewFact } from "@/lib/db/facts";
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

  const ok = await reviewFact(id, action);

  if (!ok) {
    return NextResponse.json(
      { message: "No pending fact with that id (already reviewed?)." },
      { status: 404 }
    );
  }

  if (action === "approve") {
    try {
      revalidatePath("/dashboard");
    } catch {
      // Non-fatal — the dashboard's own revalidate interval covers this anyway.
    }
  }

  return NextResponse.json({ message: `Fact ${action}d.`, id, action });
}
