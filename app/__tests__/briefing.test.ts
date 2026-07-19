/**
 * Tests for the meeting briefing packet generator (#147).
 *
 * Covers:
 *  - agenda-item JSON extraction (plain, fenced, malformed responses)
 *  - slug / filename generation
 *  - packet markdown composition (one section per item, truncation note)
 *  - generateBriefing writes to WIKI_PATH/briefings/ with quoted frontmatter,
 *    updates the index, appends to the log, deletes the temp agenda file
 *  - item cap at MAX_BRIEFING_ITEMS (25)
 *  - route auth (401 without secret when INGEST_SECRET set)
 *  - route URL validation (400)
 *
 * Strategy: mock the AI provider, scraper download, and document parser;
 * exercise the real wiki reader/writer against a temp WIKI_PATH.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import matter from "gray-matter";

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockComplete = vi.hoisted(() => vi.fn());
const mockDownloadDocument = vi.hoisted(() => vi.fn());
const mockParseDocument = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

vi.mock("@/lib/ai/provider", () => ({
  getAIProvider: () => ({
    complete: mockComplete,
    stream: vi.fn(),
    model: "test-model",
  }),
  resetAIProvider: vi.fn(),
}));

vi.mock("@/lib/scraper/schertz-scraper", () => ({
  downloadDocument: mockDownloadDocument,
}));

vi.mock("@/lib/parser/pdf-parser", () => ({
  parseDocument: mockParseDocument,
}));

// ─── Test setup ──────────────────────────────────────────────────────────────

let tmpWiki: string;
let tmpAgendaFile: string;
let originalApiKey: string | undefined;

const INDEX_SEED = `# CivicSecondBrain Wiki Index
> City: Schertz, TX | Last updated: 2026-01-01 | Pages: 1 | Sources ingested: 1

## Topics
| Page | Summary | Last Updated | Sources |
|---|---|---|---|
| [[topics/budget.md]] | City budget revenue expenditures debt | 2026-01-01 | 3 |

## Decisions
| Page | Summary | Last Updated | Sources |
|---|---|---|---|

## Briefings
| Page | Summary | Last Updated | Sources |
|---|---|---|---|
`;

const BUDGET_PAGE = `---
title: "Budget"
type: wiki
category: topic
sources:
  - budget-fy2026.pdf
last_updated: "2026-01-01"
---
The FY2026 general fund budget is $48.2M (FY2026). [SOURCE: budget-fy2026.pdf, p.4]
`;

function agendaItemsJson(count: number): string {
  const items = Array.from({ length: count }, (_, i) => ({
    number: String(i + 1),
    title: `Agenda item ${i + 1} about the city budget`,
    summary: `Discussion of budget item ${i + 1}.`,
  }));
  return JSON.stringify({
    meetingDate: "2026-08-04",
    board: "City Council",
    items,
  });
}

const SAMPLE_BRIEF = `### Background
The budget is $48.2M (FY2026). [SOURCE: budget-fy2026.pdf, p.4]

### Related Decisions & Ordinances
No related decisions found in the wiki.

### Budget Implications
$48.2M (FY2026). [SOURCE: budget-fy2026.pdf, p.4]

### Open Questions
- What is the fiscal impact?`;

function primeHappyPathMocks(itemCount = 2) {
  tmpAgendaFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "briefing-raw-")),
    "agenda.pdf"
  );
  fs.writeFileSync(tmpAgendaFile, "fake pdf bytes");
  mockDownloadDocument.mockResolvedValue(tmpAgendaFile);
  mockParseDocument.mockResolvedValue({
    text: "1. Call to order\n2. Budget amendment ordinance\n3. Adjournment",
    pageCount: 3,
  });
  mockComplete.mockImplementation(async ({ system }: { system: string }) => {
    if (system.includes("agenda parser")) return agendaItemsJson(itemCount);
    return SAMPLE_BRIEF;
  });
}

async function importHelpers() {
  return import("../lib/briefing/helpers");
}

async function importGenerate() {
  return import("../lib/briefing/generate");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  tmpWiki = fs.mkdtempSync(path.join(os.tmpdir(), "briefing-wiki-"));
  process.env.WIKI_PATH = tmpWiki;
  originalApiKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.INGEST_SECRET;

  fs.writeFileSync(path.join(tmpWiki, "index.md"), INDEX_SEED);
  fs.mkdirSync(path.join(tmpWiki, "topics"), { recursive: true });
  fs.writeFileSync(path.join(tmpWiki, "topics/budget.md"), BUDGET_PAGE);
});

afterEach(() => {
  fs.rmSync(tmpWiki, { recursive: true, force: true });
  if (tmpAgendaFile) {
    fs.rmSync(path.dirname(tmpAgendaFile), { recursive: true, force: true });
    tmpAgendaFile = "";
  }
  delete process.env.WIKI_PATH;
  delete process.env.INGEST_SECRET;
  if (originalApiKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  }
});

// ─── Agenda-item JSON extraction ─────────────────────────────────────────────

describe("parseAgendaExtraction", () => {
  it("parses a plain JSON response", async () => {
    const { parseAgendaExtraction } = await importHelpers();
    const result = parseAgendaExtraction(agendaItemsJson(3));

    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toEqual({
      number: "1",
      title: "Agenda item 1 about the city budget",
      summary: "Discussion of budget item 1.",
    });
    expect(result.meetingDate).toBe("2026-08-04");
    expect(result.board).toBe("City Council");
  });

  it("parses a ```json fenced response", async () => {
    const { parseAgendaExtraction } = await importHelpers();
    const fenced = "Here is the extraction:\n```json\n" + agendaItemsJson(2) + "\n```\nDone.";
    const result = parseAgendaExtraction(fenced);
    expect(result.items).toHaveLength(2);
  });

  it("throws BriefingGenerationError when the response has no JSON", async () => {
    const { parseAgendaExtraction, BriefingGenerationError } = await importHelpers();
    expect(() => parseAgendaExtraction("Sorry, I cannot help with that.")).toThrow(
      BriefingGenerationError
    );
  });

  it("throws BriefingGenerationError on malformed JSON", async () => {
    const { parseAgendaExtraction, BriefingGenerationError } = await importHelpers();
    expect(() => parseAgendaExtraction('{"items": [{"title": "x", }]}')).toThrow(
      BriefingGenerationError
    );
  });

  it("drops items without titles and defaults missing numbers", async () => {
    const { parseAgendaExtraction } = await importHelpers();
    const result = parseAgendaExtraction(
      JSON.stringify({
        items: [
          { title: "Valid item" },
          { summary: "no title" },
          { number: 7, title: "Numbered item" },
        ],
      })
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0].number).toBe("1");
    expect(result.items[1].number).toBe("7");
  });
});

// ─── Slug / filename generation ──────────────────────────────────────────────

describe("slug and filename generation", () => {
  it("slugifies board names", async () => {
    const { slugify } = await importHelpers();
    expect(slugify("Planning & Zoning Commission")).toBe("planning-zoning-commission");
    expect(slugify("City Council")).toBe("city-council");
    expect(slugify("  --Weird__Name!!  ")).toBe("weird-name");
  });

  it("writeBriefingPage builds briefings/YYYY-MM-DD-<slug>-briefing.md", async () => {
    const { writeBriefingPage } = await import("../lib/wiki/writer");
    const pagePath = writeBriefingPage(
      "2026-08-04",
      "City Council",
      "Meeting Briefing Packet — City Council — 2026-08-04",
      "Body",
      ["https://example.gov/agenda.pdf"]
    );
    expect(pagePath).toBe("briefings/2026-08-04-city-council-briefing.md");
    expect(fs.existsSync(path.join(tmpWiki, pagePath))).toBe(true);
  });
});

// ─── Packet composition ──────────────────────────────────────────────────────

describe("composeBriefingPacket", () => {
  it("renders a header and one section per agenda item", async () => {
    const { composeBriefingPacket } = await importHelpers();
    const markdown = composeBriefingPacket({
      meetingDate: "2026-08-04",
      boardSlug: "city-council",
      agendaUrl: "https://example.gov/agenda.pdf",
      items: [
        { number: "1", title: "First item", summary: "Summary one" },
        { number: "2a", title: "Second item", summary: "" },
      ],
      briefs: ["Brief one [SOURCE: a.pdf, p.1]", "Brief two"],
      totalItems: 2,
    });

    expect(markdown).toContain("# Meeting Briefing Packet — City Council — 2026-08-04");
    expect(markdown).toContain("## AI ANALYSIS — Requires Council Review");
    expect(markdown).toContain("**Agenda source:** https://example.gov/agenda.pdf");
    expect(markdown).toContain("## Item 1: First item");
    expect(markdown).toContain("## Item 2a: Second item");
    expect(markdown).toContain("Brief one [SOURCE: a.pdf, p.1]");
    expect(markdown).not.toContain("capped");
  });

  it("adds a truncation note when items were capped", async () => {
    const { composeBriefingPacket, MAX_BRIEFING_ITEMS } = await importHelpers();
    const markdown = composeBriefingPacket({
      meetingDate: "2026-08-04",
      boardSlug: "city-council",
      agendaUrl: "https://example.gov/agenda.pdf",
      items: [{ number: "1", title: "Only item", summary: "" }],
      briefs: ["Brief"],
      totalItems: 30,
    });
    expect(markdown).toContain("1 of 30");
    expect(markdown).toContain(`capped at ${MAX_BRIEFING_ITEMS}`);
  });
});

// ─── Input validation ────────────────────────────────────────────────────────

describe("parseBriefingInput", () => {
  it("accepts a valid http(s) URL with optional date and board", async () => {
    const { parseBriefingInput } = await importHelpers();
    const input = parseBriefingInput({
      agendaUrl: "https://example.gov/agenda.pdf",
      meetingDate: "2026-08-04",
      board: "City Council",
    });
    expect(input.agendaUrl).toBe("https://example.gov/agenda.pdf");
    expect(input.meetingDate).toBe("2026-08-04");
    expect(input.board).toBe("city-council");
  });

  it("rejects missing, malformed, and non-http URLs", async () => {
    const { parseBriefingInput, BriefingValidationError } = await importHelpers();
    for (const agendaUrl of [undefined, "", "not a url", "ftp://example.com/a.pdf"]) {
      expect(() => parseBriefingInput({ agendaUrl })).toThrow(BriefingValidationError);
    }
  });

  it("rejects invalid meeting dates", async () => {
    const { parseBriefingInput, BriefingValidationError } = await importHelpers();
    for (const meetingDate of ["08/04/2026", "2026-13-01", "tomorrow"]) {
      expect(() =>
        parseBriefingInput({ agendaUrl: "https://example.gov/a.pdf", meetingDate })
      ).toThrow(BriefingValidationError);
    }
  });
});

// ─── generateBriefing (end-to-end with mocked AI + download + parse) ─────────

describe("generateBriefing", () => {
  it("writes a packet to WIKI_PATH/briefings/ with quoted frontmatter", async () => {
    primeHappyPathMocks(2);
    const { generateBriefing } = await importGenerate();

    const result = await generateBriefing({
      agendaUrl: "https://example.gov/agenda.pdf",
      meetingDate: "2026-08-04",
      board: "city-council",
    });

    expect(result.path).toBe("briefings/2026-08-04-city-council-briefing.md");
    expect(result.itemCount).toBe(2);
    expect(result.truncated).toBe(false);

    const fullPath = path.join(tmpWiki, result.path);
    expect(fs.existsSync(fullPath)).toBe(true);

    const raw = fs.readFileSync(fullPath, "utf-8");
    // Frontmatter conventions: title and last_updated always quoted
    expect(raw).toMatch(/^title: ".+"$/m);
    expect(raw).toMatch(/^last_updated: "2026-08-04"$/m);
    expect(raw).toMatch(/^category: briefing$/m);

    const { data, content } = matter(raw);
    expect(data.title).toContain("City Council");
    expect(data.sources).toEqual(["https://example.gov/agenda.pdf"]);
    expect(content).toContain("## AI ANALYSIS — Requires Council Review");
    expect(content).toContain("## Item 1:");
    expect(content).toContain("## Item 2:");
    // Wiki citations carried through from the item briefs
    expect(content).toContain("[SOURCE: budget-fy2026.pdf, p.4]");
  });

  it("updates the wiki index and appends a BRIEFING log entry", async () => {
    primeHappyPathMocks(2);
    const { generateBriefing } = await importGenerate();

    const result = await generateBriefing({
      agendaUrl: "https://example.gov/agenda.pdf",
      meetingDate: "2026-08-04",
      board: "city-council",
    });

    const index = fs.readFileSync(path.join(tmpWiki, "index.md"), "utf-8");
    expect(index).toContain(`[[${result.path}]]`);
    // Row lands under the Briefings section
    expect(index.indexOf(`[[${result.path}]]`)).toBeGreaterThan(
      index.indexOf("## Briefings")
    );

    const log = fs.readFileSync(path.join(tmpWiki, "log.md"), "utf-8");
    expect(log).toContain("BRIEFING | 2026-08-04 city-council");
    expect(log).toContain(result.path);
  });

  it("deletes the downloaded agenda temp file after parsing", async () => {
    primeHappyPathMocks(1);
    const { generateBriefing } = await importGenerate();

    await generateBriefing({ agendaUrl: "https://example.gov/agenda.pdf" });

    expect(fs.existsSync(tmpAgendaFile)).toBe(false);
  });

  it("caps briefed items at 25 and notes the truncation", async () => {
    primeHappyPathMocks(30);
    const { generateBriefing } = await importGenerate();
    const { MAX_BRIEFING_ITEMS } = await importHelpers();

    const result = await generateBriefing({
      agendaUrl: "https://example.gov/agenda.pdf",
      meetingDate: "2026-08-04",
      board: "city-council",
    });

    expect(result.itemCount).toBe(MAX_BRIEFING_ITEMS);
    expect(result.totalItems).toBe(30);
    expect(result.truncated).toBe(true);
    // 1 extraction call + 25 item calls
    expect(mockComplete).toHaveBeenCalledTimes(MAX_BRIEFING_ITEMS + 1);
    expect(result.markdown).toContain(`capped at ${MAX_BRIEFING_ITEMS}`);
  });

  it("falls back to the extracted meeting date and board when not provided", async () => {
    primeHappyPathMocks(1);
    const { generateBriefing } = await importGenerate();

    const result = await generateBriefing({
      agendaUrl: "https://example.gov/agenda.pdf",
    });

    // From agendaItemsJson: meetingDate 2026-08-04, board "City Council"
    expect(result.path).toBe("briefings/2026-08-04-city-council-briefing.md");
  });

  it("throws a 502 BriefingGenerationError when the download fails", async () => {
    mockDownloadDocument.mockResolvedValue(null);
    const { generateBriefing } = await importGenerate();
    const { BriefingGenerationError } = await importHelpers();

    await expect(
      generateBriefing({ agendaUrl: "https://example.gov/missing.pdf" })
    ).rejects.toThrow(BriefingGenerationError);
    expect(mockComplete).not.toHaveBeenCalled();
  });
});

// ─── POST /api/briefing route ────────────────────────────────────────────────

function makeRequest(body: object = {}, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/briefing", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/briefing", () => {
  it("returns 401 without the secret when INGEST_SECRET is set", async () => {
    process.env.INGEST_SECRET = "test-secret";
    const { POST } = await import("@/api/briefing/route");

    const res = await POST(makeRequest({ agendaUrl: "https://example.gov/a.pdf" }));

    expect(res.status).toBe(401);
    expect(mockDownloadDocument).not.toHaveBeenCalled();
  });

  it("accepts the request with a valid bearer secret", async () => {
    process.env.INGEST_SECRET = "test-secret";
    primeHappyPathMocks(1);
    const { POST } = await import("@/api/briefing/route");

    const res = await POST(
      makeRequest(
        { agendaUrl: "https://example.gov/agenda.pdf", meetingDate: "2026-08-04" },
        { Authorization: "Bearer test-secret" }
      )
    );

    expect(res.status).toBe(200);
  });

  it("rejects empty, malformed, and non-http URLs with 400", async () => {
    const { POST } = await import("@/api/briefing/route");

    for (const agendaUrl of ["", "not a url", "ftp://example.com/a.pdf"]) {
      const res = await POST(makeRequest({ agendaUrl }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toMatch(/agendaUrl/i);
    }
    expect(mockDownloadDocument).not.toHaveBeenCalled();
  });

  it("returns the generate result and revalidates the dashboard on success", async () => {
    primeHappyPathMocks(2);
    const { POST } = await import("@/api/briefing/route");

    const res = await POST(
      makeRequest({
        agendaUrl: "https://example.gov/agenda.pdf",
        meetingDate: "2026-08-04",
        board: "city-council",
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.path).toBe("briefings/2026-08-04-city-council-briefing.md");
    expect(data.itemCount).toBe(2);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("returns a structured 502 JSON error when the agenda download fails", async () => {
    mockDownloadDocument.mockResolvedValue(null);
    const { POST } = await import("@/api/briefing/route");

    const res = await POST(makeRequest({ agendaUrl: "https://example.gov/gone.pdf" }));
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.success).toBe(false);
    expect(data.message).toMatch(/download failed/i);
  });
});
