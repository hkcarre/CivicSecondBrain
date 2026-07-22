/**
 * lint-parse.test.ts
 *
 * Tests for parseLintResponse (#262) — truncation-tolerant parsing of the
 * LINT AI response. A response cut off by the output-token cap must yield
 * every COMPLETE recommendation object rather than crashing the route.
 */

import { describe, it, expect } from "vitest";
import { parseLintResponse } from "@/lib/claude/lint-parse";

const rec = (n: number) => ({
  title: `Rec ${n}`,
  severity: "medium",
  finding: `Finding ${n} with "quoted" text and {braces} inside`,
  evidence: [`evidence ${n}`],
  comparableCities: [],
  suggestedAction: `Action ${n}`,
  discussionQuestions: [],
  sourcesAnalyzed: ["wiki/topics/budget.md"],
});

const fullResponse = (count: number) =>
  JSON.stringify({
    recommendations: Array.from({ length: count }, (_, i) => rec(i + 1)),
    stalePages: ["topics/old.md"],
    topActions: ["do the thing"],
  });

describe("parseLintResponse — well-formed responses", () => {
  it("parses a bare JSON response", () => {
    const result = parseLintResponse(fullResponse(2));
    expect(result.recommendations).toHaveLength(2);
    expect(result.stalePages).toEqual(["topics/old.md"]);
    expect(result.truncated).toBeUndefined();
  });

  it("parses a fenced ```json response", () => {
    const result = parseLintResponse("Here you go:\n```json\n" + fullResponse(1) + "\n```");
    expect(result.recommendations).toHaveLength(1);
  });

  it("throws when there is no JSON at all", () => {
    expect(() => parseLintResponse("I cannot analyze this wiki.")).toThrow(/no parseable JSON/i);
  });
});

describe("parseLintResponse — truncated responses (#262)", () => {
  it("salvages complete recommendation objects when the array is cut off mid-object", () => {
    const full = fullResponse(4);
    // Cut in the middle of the 4th object: find its start and chop shortly after
    const cutAt = full.indexOf('"Rec 4"') + 20;
    const truncated = full.slice(0, cutAt);

    const result = parseLintResponse(truncated);
    expect(result.truncated).toBe(true);
    expect(result.recommendations).toHaveLength(3); // the three complete ones
    expect((result.recommendations[2] as { title: string }).title).toBe("Rec 3");
    expect(result.stalePages).toEqual([]);
    expect(result.topActions).toEqual([]);
  });

  it("handles braces and escaped quotes inside string fields while brace-matching", () => {
    const full = fullResponse(3); // findings contain "quoted" text and {braces}
    const truncated = full.slice(0, full.indexOf('"Rec 3"') + 5);

    const result = parseLintResponse(truncated);
    expect(result.truncated).toBe(true);
    expect(result.recommendations).toHaveLength(2);
    expect((result.recommendations[0] as { finding: string }).finding).toContain("{braces}");
  });

  it("salvages from a truncated fenced response (no closing fence)", () => {
    const full = fullResponse(2);
    const truncated = "```json\n" + full.slice(0, full.indexOf('"Rec 2"') + 3);

    const result = parseLintResponse(truncated);
    expect(result.truncated).toBe(true);
    expect(result.recommendations).toHaveLength(1);
  });

  it("throws when truncation leaves no complete object", () => {
    const full = fullResponse(1);
    const truncated = full.slice(0, full.indexOf('"Rec 1"') + 3); // inside the first object
    expect(() => parseLintResponse(truncated)).toThrow(/truncated beyond repair/i);
  });
});
