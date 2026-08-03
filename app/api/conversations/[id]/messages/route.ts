import { NextRequest, NextResponse } from "next/server";
import { getConversationMessages } from "@/lib/db/queries/conversations";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const messages = await getConversationMessages(id);
    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }
}
