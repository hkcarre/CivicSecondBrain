/**
 * Tests for app/lib/chat-log.ts — chat Q&A audit log (issue #146).
 *
 * Follows the repo convention: vi.resetModules() + dynamic import so the
 * module-level CHAT_LOG_PATH constant is re-evaluated after setting the
 * env var, with temp dirs via fs.mkdtempSync.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { ChatLogEntry } from "../lib/chat-log";

let tmpDir: string;
let logDir: string;

async function importChatLog() {
  vi.resetModules();
  return import("../lib/chat-log");
}

function makeEntry(overrides: Partial<ChatLogEntry> = {}): ChatLogEntry {
  return {
    timestamp: "2026-07-19T14:30:00.000Z",
    question: "What is the FY2026 budget?",
    answer: "The adopted FY2026 budget is $4.2M (FY2026).",
    pagesUsed: ["topics/budget.md", "decisions/2026-06-03-city-council.md"],
    provider: "anthropic/claude-sonnet-4-5",
    latencyMs: 1234,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-log-test-"));
  logDir = path.join(tmpDir, "chat-log");
  process.env.CHAT_LOG_PATH = logDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.CHAT_LOG_PATH;
  vi.restoreAllMocks();
});

// ─── appendChatTurn ───────────────────────────────────────────────────────

describe("appendChatTurn", () => {
  it("creates the log directory and monthly file on first write", async () => {
    const { appendChatTurn } = await importChatLog();
    expect(fs.existsSync(logDir)).toBe(false);

    await appendChatTurn(makeEntry());

    const file = path.join(logDir, "2026-07.jsonl");
    expect(fs.existsSync(file)).toBe(true);
  });

  it("writes valid JSONL that accumulates one line per turn", async () => {
    const { appendChatTurn } = await importChatLog();

    await appendChatTurn(makeEntry({ question: "Q1" }));
    await appendChatTurn(makeEntry({ question: "Q2" }));
    await appendChatTurn(makeEntry({ question: "Q3" }));

    const raw = fs.readFileSync(path.join(logDir, "2026-07.jsonl"), "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(3);

    const parsed = lines.map((l) => JSON.parse(l) as ChatLogEntry);
    expect(parsed.map((e) => e.question)).toEqual(["Q1", "Q2", "Q3"]);
    expect(parsed[0].pagesUsed).toEqual([
      "topics/budget.md",
      "decisions/2026-06-03-city-council.md",
    ]);
    expect(parsed[0].provider).toBe("anthropic/claude-sonnet-4-5");
    expect(parsed[0].latencyMs).toBe(1234);
  });

  it("rotates to a new monthly file based on the entry timestamp", async () => {
    const { appendChatTurn } = await importChatLog();

    await appendChatTurn(makeEntry({ timestamp: "2026-06-30T23:59:59.000Z" }));
    await appendChatTurn(makeEntry({ timestamp: "2026-07-01T00:00:01.000Z" }));

    expect(fs.existsSync(path.join(logDir, "2026-06.jsonl"))).toBe(true);
    expect(fs.existsSync(path.join(logDir, "2026-07.jsonl"))).toBe(true);
  });

  it("never throws when the log directory is unwritable", async () => {
    // Point CHAT_LOG_PATH below an existing FILE so mkdir fails (ENOTDIR)
    const blocker = path.join(tmpDir, "blocker");
    fs.writeFileSync(blocker, "not a directory", "utf-8");
    process.env.CHAT_LOG_PATH = path.join(blocker, "chat-log");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { appendChatTurn } = await importChatLog();

    await expect(appendChatTurn(makeEntry())).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("defaults to a sibling of WIKI_PATH when CHAT_LOG_PATH is unset", async () => {
    delete process.env.CHAT_LOG_PATH;
    const prevWikiPath = process.env.WIKI_PATH;
    process.env.WIKI_PATH = path.join(tmpDir, "wiki");
    try {
      const { appendChatTurn } = await importChatLog();
      await appendChatTurn(makeEntry());

      // Sibling of the wiki dir: <tmpDir>/chat-log
      expect(
        fs.existsSync(path.join(tmpDir, "chat-log", "2026-07.jsonl"))
      ).toBe(true);
    } finally {
      if (prevWikiPath === undefined) delete process.env.WIKI_PATH;
      else process.env.WIKI_PATH = prevWikiPath;
    }
  });
});

// ─── Readers ──────────────────────────────────────────────────────────────

describe("readChatLogMonth / listChatLogMonths", () => {
  it("round-trips entries back through the reader", async () => {
    const { appendChatTurn, readChatLogMonth } = await importChatLog();
    const entry = makeEntry({
      question: 'A "quoted" question,\nwith a newline',
      answer: "Line one\nLine two",
    });

    await appendChatTurn(entry);

    const entries = readChatLogMonth("2026-07");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(entry);
  });

  it("returns [] for a month with no log file", async () => {
    const { readChatLogMonth } = await importChatLog();
    expect(readChatLogMonth("1999-01")).toEqual([]);
  });

  it("skips malformed lines without throwing", async () => {
    const { appendChatTurn, readChatLogMonth } = await importChatLog();
    await appendChatTurn(makeEntry({ question: "good" }));
    fs.appendFileSync(
      path.join(logDir, "2026-07.jsonl"),
      "{ not valid json\n",
      "utf-8"
    );
    await appendChatTurn(makeEntry({ question: "also good" }));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const entries = readChatLogMonth("2026-07");
    expect(entries.map((e) => e.question)).toEqual(["good", "also good"]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("lists months in ascending order", async () => {
    const { appendChatTurn, listChatLogMonths } = await importChatLog();
    await appendChatTurn(makeEntry({ timestamp: "2026-07-19T00:00:00.000Z" }));
    await appendChatTurn(makeEntry({ timestamp: "2026-05-01T00:00:00.000Z" }));
    await appendChatTurn(makeEntry({ timestamp: "2026-06-15T00:00:00.000Z" }));

    expect(listChatLogMonths()).toEqual(["2026-05", "2026-06", "2026-07"]);
  });

  it("lists no months when the directory does not exist", async () => {
    const { listChatLogMonths } = await importChatLog();
    expect(listChatLogMonths()).toEqual([]);
  });
});

// ─── isValidMonth ─────────────────────────────────────────────────────────

describe("isValidMonth", () => {
  it("accepts YYYY-MM strings", async () => {
    const { isValidMonth } = await importChatLog();
    expect(isValidMonth("2026-01")).toBe(true);
    expect(isValidMonth("2026-12")).toBe(true);
  });

  it("rejects malformed months", async () => {
    const { isValidMonth } = await importChatLog();
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-00")).toBe(false);
    expect(isValidMonth("2026-1")).toBe(false);
    expect(isValidMonth("202607")).toBe(false);
    expect(isValidMonth("not-a-month")).toBe(false);
    expect(isValidMonth("../etc/passwd")).toBe(false);
  });
});

// ─── CSV export ───────────────────────────────────────────────────────────

describe("chatLogToCsv", () => {
  it("renders a header row plus one row per entry", async () => {
    const { chatLogToCsv } = await importChatLog();
    const csv = chatLogToCsv([makeEntry(), makeEntry({ question: "Q2" })]);
    const lines = csv.split("\r\n").filter((l) => l.length > 0);

    expect(lines[0]).toBe(
      "timestamp,question,answer,pages_used,provider,latency_ms"
    );
    expect(lines).toHaveLength(3);
  });

  it("escapes quotes, commas, and newlines in questions and answers", async () => {
    const { chatLogToCsv } = await importChatLog();
    const csv = chatLogToCsv([
      makeEntry({
        question: 'What did the "council" decide, exactly?',
        answer: "Two things:\n1. Tax rate\n2. Bond",
      }),
    ]);

    // Quotes doubled, whole field wrapped in quotes
    expect(csv).toContain('"What did the ""council"" decide, exactly?"');
    // Newlines preserved inside a quoted field
    expect(csv).toContain('"Two things:\n1. Tax rate\n2. Bond"');
  });

  it("joins pagesUsed with a semicolon separator", async () => {
    const { chatLogToCsv } = await importChatLog();
    const csv = chatLogToCsv([makeEntry()]);
    expect(csv).toContain(
      "topics/budget.md; decisions/2026-06-03-city-council.md"
    );
  });

  it("produces only the header for an empty entry list", async () => {
    const { chatLogToCsv } = await importChatLog();
    expect(chatLogToCsv([])).toBe(
      "timestamp,question,answer,pages_used,provider,latency_ms\r\n"
    );
  });
});
