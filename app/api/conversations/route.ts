import { NextRequest, NextResponse } from "next/server";
import { listConversations, createConversation } from "@/lib/db/queries/conversations";

export async function GET(req: NextRequest) {
  try {
    const projectIdParam = req.nextUrl.searchParams.get("projectId");
    // Distinguish "not provided" (list all) from "provided as empty/null"
    // (list unassigned) — matches listConversations' projectId?: string | null.
    const projectId =
      projectIdParam === null ? undefined : projectIdParam === "" ? null : projectIdParam;
    const conversations = await listConversations(projectId);
    return NextResponse.json({ conversations });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, projectId } = await req.json();
    const conversation = await createConversation(
      typeof title === "string" && title.trim() ? title.trim() : undefined,
      projectId ?? null
    );
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }
}
