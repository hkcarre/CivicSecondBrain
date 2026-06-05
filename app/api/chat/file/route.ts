/**
 * POST /api/chat/file
 *
 * Saves a Q&A exchange to wiki/queries/ so it can be reused.
 * Called when a user clicks "File this answer" in the chat UI.
 */

import { NextResponse } from "next/server";
import { writeQueryPage } from "@/lib/wiki/writer";
import { updateWikiIndex } from "@/lib/wiki/writer";
import type { ChatMessage } from "@/types";

export async function POST(req: Request) {
  try {
    const { message }: { message: ChatMessage } = await req.json();

    if (!message?.content || message.role !== "assistant") {
      return NextResponse.json(
        { error: "Invalid message — must be an assistant message with content." },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const { path: queryPath, title } = writeQueryPage(message, today);

    // Register in wiki index
    updateWikiIndex([
      {
        path: queryPath,
        summary: title.slice(0, 80),
        date: today,
        sourceCount: 0,
        category: "query",
      },
    ]);

    return NextResponse.json({ success: true, path: queryPath });
  } catch (err) {
    console.error("File answer error:", err);
    return NextResponse.json(
      { error: `Failed to file answer: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
