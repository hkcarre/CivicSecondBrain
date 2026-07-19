/**
 * GET /api/export/chat-log
 *
 * Exports the chat Q&A audit log for public-records requests
 * (Texas Public Information Act compliance — issue #146).
 *
 * Query params:
 *   month=YYYY-MM   (default: current month) — which monthly log to export
 *   format=jsonl    (default) — raw JSONL file, served verbatim
 *   format=csv      — CSV with RFC 4180 escaping (quotes/newlines in Q&A text)
 *
 * Auth: intentionally public — this is the public-records (TPIA) export.
 * Entries never contain client IPs or user identifiers (see ChatLogEntry
 * in @/lib/chat-log), so the monthly files are safe to publish as-is.
 * Unlike /api/export/wiki, no admin session or INGEST_SECRET is required.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  chatLogToCsv,
  isValidMonth,
  readChatLogMonth,
  readChatLogMonthRaw,
} from "@/lib/chat-log";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month =
    searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const format = searchParams.get("format") ?? "jsonl";

  if (!isValidMonth(month)) {
    return NextResponse.json(
      { error: "Invalid month — expected YYYY-MM (e.g. 2026-07)." },
      { status: 400 }
    );
  }

  if (format !== "jsonl" && format !== "csv") {
    return NextResponse.json(
      { error: "Invalid format — expected 'jsonl' or 'csv'." },
      { status: 400 }
    );
  }

  if (format === "csv") {
    const entries = readChatLogMonth(month);
    if (entries.length === 0) {
      return NextResponse.json(
        { error: `No chat log entries for ${month}.` },
        { status: 404 }
      );
    }
    return new Response(chatLogToCsv(entries), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="civic-chat-log-${month}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: raw JSONL served verbatim for maximum audit fidelity
  const raw = readChatLogMonthRaw(month);
  if (raw === null || raw.trim() === "") {
    return NextResponse.json(
      { error: `No chat log entries for ${month}.` },
      { status: 404 }
    );
  }
  return new Response(raw, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Content-Disposition": `attachment; filename="civic-chat-log-${month}.jsonl"`,
      "Cache-Control": "no-store",
    },
  });
}
