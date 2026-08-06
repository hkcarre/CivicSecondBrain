/**
 * chat-route.test.ts
 *
 * Tests for POST /api/chat — the streaming Q&A endpoint. Previously at 15%
 * branch coverage; the uncovered branches are exactly the operationally
 * interesting ones:
 *
 *  - rate-limit wiring (429 with Retry-After before any AI call)
 *  - empty-wiki fallback context vs. populated context
 *  - full stream → QUERY log + audit log with complete answer
 *  - mid-stream provider error → "[Error: …]" marker + PARTIAL audit log
 *  - client cancel → partial audit log, and the double-log guard
 *  - malformed body → 500 JSON (outer catch), never an unhandled crash
 *
 * Mocks: AI provider (async generator), wiki reader/select, writer, chat-log.
 * The rate limiter runs for REAL (module state isolated via vi.resetModules
 * + dynamic import, per repo convention).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAppendChatTurn = vi.fn();
const mockAppendToLog = vi.fn();

vi.mock("@/lib/chat-log", () => ({
  appendChatTurn: (...args: unknown[]) => mockAppendChatTurn(...args),
}));

vi.mock("@/lib/wiki/writer", () => ({
  appendToLog: (...args: unknown[]) => mockAppendToLog(...args),
}));

vi.mock("@/lib/wiki/reader", () => ({
  readWikiIndex: vi.fn(() => [
    {
      path: "topics/budget.md",
      summary: "Annual budget",
      lastUpdated: "2026-01-01",
      sourceCount: 1,
      category: "topic",
    },
  ]),
  readRelevantPages: vi.fn(() => [
    { title: "Budget", content: "The budget is $42M.", path: "topics/budget.md" },
  ]),
  buildWikiContext: vi.fn(() => "## Budget\nThe budget is $42M."),
}));

vi.mock("@/lib/wiki/select", () => ({
  selectRelevantPages: vi.fn(() => ["topics/budget.md"]),
}));

// Numeric facts are a separately-configured layer (Supabase) — unmocked by
// default, getCurrentCityId() throws "SUPABASE_URL ... must be set" (no
// such env var in this test process), which buildStructuredFactsBlock()
// catches and treats as "no structured facts available" (see the "no
// numeric facts configured" test below, which exercises this real path).
// Individual tests override these mocks to exercise the populated case.
vi.mock("@/lib/db/cities", () => ({
  getCurrentCityId: vi.fn(() => {
    throw new Error("[db] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }),
}));
vi.mock("@/lib/db/queries/metrics", () => ({
  getAllMetricSeries: vi.fn(() => []),
  selectRelevantMetrics: vi.fn(() => []),
}));

// Provider stream is swappable per test
let streamImpl: () => AsyncGenerator<string>;
vi.mock("@/lib/ai/provider", () => ({
  getAIProvider: () => ({
    stream: () => streamImpl(),
    complete: vi.fn(),
    model: "test-model",
  }),
}));

async function importRoute() {
  vi.resetModules();
  return import("@/api/chat/route");
}

function makeChat(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readAll(res: Response): Promise<string> {
  return await res.text();
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CHAT_RATE_LIMIT_RPM;
  streamImpl = async function* () {
    yield "The budget ";
    yield "is $42M.";
  };
});

describe("POST /api/chat — happy path", () => {
  it("streams the answer and writes both the QUERY log and the audit log", async () => {
    const { POST } = await importRoute();
    const res = await POST(makeChat({ messages: [{ role: "user", content: "What is the budget?" }] }));

    expect(res.status).toBe(200);
    expect(await readAll(res)).toBe("The budget is $42M.");

    // QUERY operations log
    expect(mockAppendToLog).toHaveBeenCalledOnce();
    expect(mockAppendToLog.mock.calls[0][0]).toContain("What is the budget?");

    // Audit log with the COMPLETE answer and the pages used
    expect(mockAppendChatTurn).toHaveBeenCalledOnce();
    const turn = mockAppendChatTurn.mock.calls[0][0];
    expect(turn.question).toBe("What is the budget?");
    expect(turn.answer).toBe("The budget is $42M.");
    expect(turn.pagesUsed).toEqual(["topics/budget.md"]);
    expect(turn.provider).toContain("test-model");
  });
});

describe("POST /api/chat — rate limiting", () => {
  it("returns 429 with Retry-After once the per-IP limit is exhausted, before any AI call", async () => {
    process.env.CHAT_RATE_LIMIT_RPM = "1";
    let aiCalls = 0;
    streamImpl = async function* () {
      aiCalls++;
      yield "ok";
    };
    const { POST } = await importRoute();
    const headers = { "x-forwarded-for": "203.0.113.9" };

    const first = await POST(makeChat({ messages: [{ role: "user", content: "q1" }] }, headers));
    expect(first.status).toBe(200);
    await readAll(first);

    const second = await POST(makeChat({ messages: [{ role: "user", content: "q2" }] }, headers));
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
    const body = await second.json();
    expect(body.error).toMatch(/too many requests/i);
    expect(aiCalls).toBe(1); // the 429 never reached the provider
  });
});

describe("POST /api/chat — empty wiki fallback", () => {
  it("tells the model no pages are ingested when the wiki is empty", async () => {
    const { readRelevantPages, buildWikiContext } = await import("@/lib/wiki/reader");
    vi.mocked(readRelevantPages).mockReturnValue([]);
    vi.mocked(buildWikiContext).mockReturnValue("");

    let capturedSystem = "";
    streamImpl = async function* () {
      yield "no data";
    };
    // Re-mock provider to capture the system prompt
    const { POST } = await importRoute();
    const providerMod = await import("@/lib/ai/provider");
    vi.spyOn(providerMod, "getAIProvider").mockReturnValue({
      stream: (opts: { system: string }) => {
        capturedSystem = opts.system;
        return streamImpl();
      },
      complete: vi.fn(),
      model: "test-model",
    } as never);

    const res = await POST(makeChat({ messages: [{ role: "user", content: "anything" }] }));
    await readAll(res);

    expect(capturedSystem).toContain("No wiki pages have been ingested");
    // Gap is recorded in the QUERY log
    expect(mockAppendToLog.mock.calls[0][0]).toContain("No wiki pages ingested");
  });
});

describe("POST /api/chat — stream error handling", () => {
  it("appends an [Error: …] marker and audit-logs the PARTIAL answer", async () => {
    streamImpl = async function* () {
      yield "partial ";
      throw new Error("provider exploded");
    };
    const { POST } = await importRoute();
    const res = await POST(makeChat({ messages: [{ role: "user", content: "q" }] }));

    const text = await readAll(res);
    expect(text).toContain("partial ");
    expect(text).toContain("[Error: provider exploded]");

    // Audit logged exactly once, with what the user actually saw
    expect(mockAppendChatTurn).toHaveBeenCalledOnce();
    expect(mockAppendChatTurn.mock.calls[0][0].answer).toBe("partial ");
  });

  it("audit-logs the partial answer exactly once when the client disconnects", async () => {
    let releaseSecondChunk!: () => void;
    const gate = new Promise<void>((r) => (releaseSecondChunk = r));
    streamImpl = async function* () {
      yield "first chunk ";
      await gate;
      yield "never delivered";
    };
    const { POST } = await importRoute();
    const res = await POST(makeChat({ messages: [{ role: "user", content: "q" }] }));

    const reader = res.body!.getReader();
    await reader.read(); // receive the first chunk
    await reader.cancel(); // client disconnects
    releaseSecondChunk();
    await new Promise((r) => setTimeout(r, 20)); // let the generator settle

    expect(mockAppendChatTurn).toHaveBeenCalledTimes(1);
    expect(mockAppendChatTurn.mock.calls[0][0].answer).toBe("first chunk ");
  });
});

describe("POST /api/chat — malformed requests", () => {
  it("returns 500 JSON (not a crash) when the body is not valid JSON", async () => {
    const { POST } = await importRoute();
    const res = await POST(makeChat("this is not json"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("returns 500 JSON when messages is missing", async () => {
    const { POST } = await importRoute();
    const res = await POST(makeChat({}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });
});

describe("POST /api/chat — structured facts (numeric metrics table)", () => {
  it("includes a STRUCTURED FACTS block with real figures and citations when relevant metrics exist", async () => {
    const { getCurrentCityId } = await import("@/lib/db/cities");
    const { getAllMetricSeries, selectRelevantMetrics } = await import(
      "@/lib/db/queries/metrics"
    );
    vi.mocked(getCurrentCityId).mockResolvedValue("city-123");
    const series = [
      {
        metricId: "property-tax-rate-per-100",
        metricName: "Property Tax Rate",
        unit: "usd",
        valueType: "actual" as const,
        periodCount: 1,
        latestPeriod: "FY2026",
        points: [
          {
            period: "FY2026",
            value: 0.12,
            unit: "usd",
            valueType: "actual" as const,
            confidence: 0.95,
            sourceCitation: "FY2026 Audit, p.4",
          },
        ],
      },
    ];
    vi.mocked(getAllMetricSeries).mockResolvedValue(series);
    vi.mocked(selectRelevantMetrics).mockReturnValue(series);

    let capturedSystem = "";
    const { POST } = await importRoute();
    const providerMod = await import("@/lib/ai/provider");
    vi.spyOn(providerMod, "getAIProvider").mockReturnValue({
      stream: (opts: { system: string }) => {
        capturedSystem = opts.system;
        return streamImpl();
      },
      complete: vi.fn(),
      model: "test-model",
    } as never);

    const res = await POST(
      makeChat({ messages: [{ role: "user", content: "What is the property tax rate?" }] })
    );
    await readAll(res);

    expect(capturedSystem).toContain("STRUCTURED FACTS");
    expect(capturedSystem).toContain("Property Tax Rate");
    expect(capturedSystem).toContain("0.12");
    expect(capturedSystem).toContain("[SOURCE: FY2026 Audit, p.4]");
    // Chat can't render a chart itself — the model should be told to point
    // chart/trend questions at the dashboard, which plots this same data.
    expect(capturedSystem).toContain("dashboard");
  });

  it("omits the STRUCTURED FACTS block when numeric facts aren't configured for this deployment", async () => {
    // Default mock from the top of this file: getCurrentCityId() throws,
    // exercising the real fail-gracefully path (see buildStructuredFactsBlock
    // in app/api/chat/route.ts) rather than a contrived empty-array case.
    let capturedSystem = "";
    const { POST } = await importRoute();
    const providerMod = await import("@/lib/ai/provider");
    vi.spyOn(providerMod, "getAIProvider").mockReturnValue({
      stream: (opts: { system: string }) => {
        capturedSystem = opts.system;
        return streamImpl();
      },
      complete: vi.fn(),
      model: "test-model",
    } as never);

    const res = await POST(makeChat({ messages: [{ role: "user", content: "anything" }] }));
    await readAll(res);

    expect(capturedSystem).not.toContain("STRUCTURED FACTS");
  });
});
