/**
 * app/lib/chat-log.ts
 *
 * Audit log for chat Q&A turns (public-records compliance).
 *
 * Council members have public-records obligations under the Texas Public
 * Information Act. Every AI-assisted Q&A turn is appended as one JSON line
 * to a monthly JSONL file (`YYYY-MM.jsonl`) so it can be exported verbatim
 * for a records request.
 *
 * Storage location:
 *   CHAT_LOG_PATH env var, or a sibling of the wiki directory by default —
 *   locally `./chat-log`, on Railway (WIKI_PATH=/data/wiki) `/data/chat-log`,
 *   so the log lands on the persistent volume without extra configuration.
 *
 * Privacy: raw client IPs are intentionally NOT part of the entry shape.
 *
 * Writes never throw into the request path — failures are caught and logged
 * to console.error so a full disk or bad mount can't break chat.
 */

import fs from "fs";
import path from "path";

const CHAT_LOG_PATH =
  process.env.CHAT_LOG_PATH ??
  path.join(process.env.WIKI_PATH ?? "./wiki", "..", "chat-log");

export interface ChatLogEntry {
  /** ISO-8601 timestamp of when the turn completed. */
  timestamp: string;
  /** The user's question (full text). */
  question: string;
  /** The generated answer (full final text; partial if the client aborted). */
  answer: string;
  /** Wiki page paths given to the model as context, e.g. "topics/budget.md". */
  pagesUsed: string[];
  /** Provider/model string, e.g. "anthropic/claude-sonnet-4-5". */
  provider: string;
  /** Elapsed wall-clock time for the turn in milliseconds. */
  latencyMs: number;
}

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Returns true if `month` is a valid `YYYY-MM` string. */
export function isValidMonth(month: string): boolean {
  return MONTH_REGEX.test(month);
}

/** The `YYYY-MM` month key for an ISO timestamp. */
function monthOf(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 7);
}

/** Absolute-ish path of the JSONL file for a month. */
function monthFilePath(month: string): string {
  return path.join(CHAT_LOG_PATH, `${month}.jsonl`);
}

/**
 * Append one chat turn to the current month's JSONL file.
 *
 * Fire-and-forget safe: never rejects. Failures (unwritable directory,
 * full disk, etc.) are logged via console.error and swallowed so the
 * chat request path is never affected.
 */
export async function appendChatTurn(entry: ChatLogEntry): Promise<void> {
  try {
    await fs.promises.mkdir(CHAT_LOG_PATH, { recursive: true });
    const file = monthFilePath(monthOf(entry.timestamp));
    await fs.promises.appendFile(file, JSON.stringify(entry) + "\n", "utf-8");
  } catch (err) {
    console.error(
      "[chat-log] Failed to append chat turn:",
      (err as Error).message
    );
  }
}

/**
 * List the months (`YYYY-MM`, ascending) that have log files.
 * Returns [] if the log directory does not exist.
 */
export function listChatLogMonths(): string[] {
  try {
    return fs
      .readdirSync(CHAT_LOG_PATH)
      .filter((f) => f.endsWith(".jsonl") && isValidMonth(f.slice(0, -6)))
      .map((f) => f.slice(0, -6))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Raw JSONL content for a month, or null if no log file exists.
 * Served verbatim by the export route for maximum audit fidelity.
 */
export function readChatLogMonthRaw(month: string): string | null {
  if (!isValidMonth(month)) return null;
  try {
    return fs.readFileSync(monthFilePath(month), "utf-8");
  } catch {
    return null;
  }
}

/**
 * Parse a month's entries. Malformed lines are skipped (never throws).
 * Returns [] if the month has no log file.
 */
export function readChatLogMonth(month: string): ChatLogEntry[] {
  const raw = readChatLogMonthRaw(month);
  if (raw === null) return [];

  const entries: ChatLogEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as ChatLogEntry);
    } catch {
      console.error("[chat-log] Skipping malformed log line");
    }
  }
  return entries;
}

// ─── CSV export helper ────────────────────────────────────────────────────

/**
 * RFC 4180-style field escaping: wrap in double quotes when the value
 * contains a quote, comma, or newline; double any embedded quotes.
 */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Render chat log entries as CSV (header row + one row per turn). */
export function chatLogToCsv(entries: ChatLogEntry[]): string {
  const header = "timestamp,question,answer,pages_used,provider,latency_ms";
  const rows = entries.map((e) =>
    [
      csvField(e.timestamp),
      csvField(e.question),
      csvField(e.answer),
      csvField((e.pagesUsed ?? []).join("; ")),
      csvField(e.provider),
      String(e.latencyMs),
    ].join(",")
  );
  return [header, ...rows].join("\r\n") + "\r\n";
}
