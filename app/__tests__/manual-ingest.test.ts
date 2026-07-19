/**
 * Tests for app/lib/ingest/manual-ingest.ts's pure validation and inference
 * functions: parseManualIngestInput and inferManualDocumentType.
 *
 * These are only lightly exercised today — ingest-route.test.ts covers the
 * /api/ingest/document route's URL rejection, but the type/board/date
 * validators and the type-inference heuristic (used whenever a manual
 * ingest omits `type`) have no direct coverage.
 */
import { describe, it, expect } from "vitest";
import {
  parseManualIngestInput,
  inferManualDocumentType,
  ManualIngestValidationError,
} from "@/lib/ingest/manual-ingest";

describe("parseManualIngestInput", () => {
  it("throws when the body is not an object", () => {
    expect(() => parseManualIngestInput("not an object")).toThrow(
      ManualIngestValidationError
    );
    expect(() => parseManualIngestInput(null)).toThrow(
      ManualIngestValidationError
    );
    expect(() => parseManualIngestInput([])).toThrow(
      ManualIngestValidationError
    );
  });

  it("throws when url is missing or blank", () => {
    expect(() => parseManualIngestInput({})).toThrow(/url is required/);
    expect(() => parseManualIngestInput({ url: "   " })).toThrow(
      /url is required/
    );
  });

  it("throws for a non-http(s) URL", () => {
    expect(() =>
      parseManualIngestInput({ url: "ftp://example.com/doc.pdf" })
    ).toThrow(/http or https/);
  });

  it("throws for a malformed URL", () => {
    expect(() => parseManualIngestInput({ url: "not a url" })).toThrow(
      /valid URL/
    );
  });

  it("accepts a valid https URL and normalizes it", () => {
    const input = parseManualIngestInput({ url: "https://example.com/doc.pdf" });
    expect(input.url).toBe("https://example.com/doc.pdf");
  });

  it("infers type from title when type is omitted", () => {
    const input = parseManualIngestInput({
      url: "https://example.com/doc.pdf",
      title: "FY2025 Budget Amendment",
    });
    expect(input.type).toBe("budget");
  });

  it("infers type from the URL when neither type nor title is given", () => {
    const input = parseManualIngestInput({
      url: "https://example.com/city-ordinance-24-01.pdf",
    });
    expect(input.type).toBe("ordinance");
  });

  it("accepts an explicit, supported type", () => {
    const input = parseManualIngestInput({
      url: "https://example.com/doc.pdf",
      type: "resolution",
    });
    expect(input.type).toBe("resolution");
  });

  it("throws for an unsupported type", () => {
    expect(() =>
      parseManualIngestInput({ url: "https://example.com/doc.pdf", type: "press-release" })
    ).toThrow(/type is not supported/);
  });

  it("accepts an explicit, supported board", () => {
    const input = parseManualIngestInput({
      url: "https://example.com/doc.pdf",
      board: "city-council",
    });
    expect(input.board).toBe("city-council");
  });

  it("throws for an unsupported board", () => {
    expect(() =>
      parseManualIngestInput({ url: "https://example.com/doc.pdf", board: "school-board" })
    ).toThrow(/board is not supported/);
  });

  it("omits board entirely when not provided", () => {
    const input = parseManualIngestInput({ url: "https://example.com/doc.pdf" });
    expect(input.board).toBeUndefined();
  });

  it("accepts a valid ISO date", () => {
    const input = parseManualIngestInput({
      url: "https://example.com/doc.pdf",
      date: "2024-03-15",
    });
    expect(input.date).toBe("2024-03-15");
  });

  it("throws for a non-ISO date format", () => {
    expect(() =>
      parseManualIngestInput({ url: "https://example.com/doc.pdf", date: "03/15/2024" })
    ).toThrow(/ISO date/);
  });

  it("throws for a calendar-invalid ISO-shaped date", () => {
    expect(() =>
      parseManualIngestInput({ url: "https://example.com/doc.pdf", date: "2024-02-30" })
    ).toThrow(/valid ISO date/);
  });

  it("defaults date to today when omitted", () => {
    const input = parseManualIngestInput({ url: "https://example.com/doc.pdf" });
    const today = new Date().toISOString().split("T")[0];
    expect(input.date).toBe(today);
  });

  it("throws when an optional field is not a string", () => {
    expect(() =>
      parseManualIngestInput({ url: "https://example.com/doc.pdf", title: 123 })
    ).toThrow(/must be strings/);
  });

  it("trims whitespace from title", () => {
    const input = parseManualIngestInput({
      url: "https://example.com/doc.pdf",
      title: "  Budget Report  ",
    });
    expect(input.title).toBe("Budget Report");
  });
});

describe("inferManualDocumentType", () => {
  it.each([
    ["FY2025 Budget Adoption", "budget"],
    ["Capital Improvement Program (CIP)", "budget"],
    ["Ordinance 24-15", "ordinance"],
    ["City Charter Amendment", "charter"],
    ["Annual Financial Audit", "financial-report"],
    ["ACFR 2024", "financial-report"],
    ["Strategic Plan 2030", "strategic-plan"],
    ["Parks Master Plan", "strategic-plan"],
    ["State of the City Address", "state-of-city"],
    ["City Council Minutes 2024-01-10", "meeting-minutes"],
    ["City Council Agenda", "agenda"],
    ["Resolution 24-002", "resolution"],
    ["Open Records Request Log", "open-records"],
    ["Untitled Scan", "public-notice"],
  ] as const)("infers %s as %s", (value, expected) => {
    expect(inferManualDocumentType(value)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(inferManualDocumentType("BUDGET REPORT")).toBe("budget");
  });
});
