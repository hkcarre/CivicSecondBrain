/**
 * Tests for the pure classification/parsing helpers in
 * app/lib/scraper/laserfiche-scraper.ts.
 *
 * These had zero test coverage — a wrong date, type, or board inference
 * here silently mis-files a document (wrong folder in the wiki, wrong
 * board attribution) rather than crashing, which is exactly the kind of
 * bug that's easy to miss without tests.
 */
import { describe, it, expect } from "vitest";
import {
  extractDateFromName,
  extractDateFromData,
  inferTypeFromName,
  inferBoardFromName,
} from "@/lib/scraper/laserfiche-scraper";

describe("extractDateFromName", () => {
  it("parses an ISO-style date (YYYY-MM-DD)", () => {
    expect(extractDateFromName("Agenda 2024-01-10.pdf")).toBe("2024-01-10");
  });

  it("parses an ISO-style date with slash separators", () => {
    expect(extractDateFromName("Minutes 2024/03/22.pdf")).toBe("2024-03-22");
  });

  it("parses an MDY-style date (M/D/YYYY) and zero-pads", () => {
    expect(extractDateFromName("Notice 1/5/2024.pdf")).toBe("2024-01-05");
  });

  it("parses an MDY-style date with dash separators", () => {
    expect(extractDateFromName("Notice 01-05-2024.pdf")).toBe("2024-01-05");
  });

  it("falls back to Jan 1 of a bare year when no full date is present", () => {
    expect(extractDateFromName("2023 Annual Report.pdf")).toBe("2023-01-01");
  });

  it("prefers a full ISO date over a bare year in the same name", () => {
    expect(extractDateFromName("FY2023 Budget 2023-09-15 Final.pdf")).toBe(
      "2023-09-15"
    );
  });

  it("returns undefined when no date-like pattern is found", () => {
    expect(extractDateFromName("Ordinance No 42.pdf")).toBeUndefined();
  });

  it("rejects an out-of-range month/day in the ISO pattern", () => {
    // Month 13 doesn't match; falls through to bare-year match.
    expect(extractDateFromName("Doc 2024-13-01.pdf")).toBe("2024-01-01");
  });
});

describe("extractDateFromData", () => {
  it("uses data[11] (CreationDate) when present", () => {
    const data: (string | number | null)[] = Array(13).fill(null);
    data[11] = "2024-05-01T00:00:00Z";
    expect(extractDateFromData(data)).toBe("2024-05-01");
  });

  it("falls back to data[12] (LastModified) when data[11] is null", () => {
    const data: (string | number | null)[] = Array(13).fill(null);
    data[12] = "2024-06-15T00:00:00Z";
    expect(extractDateFromData(data)).toBe("2024-06-15");
  });

  it("falls back to today's date when both fields are null", () => {
    const data: (string | number | null)[] = Array(13).fill(null);
    const today = new Date().toISOString().split("T")[0];
    expect(extractDateFromData(data)).toBe(today);
  });

  it("falls back to today's date when the value is an unparseable date string", () => {
    const data: (string | number | null)[] = Array(13).fill(null);
    data[11] = "not a date";
    const today = new Date().toISOString().split("T")[0];
    expect(extractDateFromData(data)).toBe(today);
  });

  it("handles a data array shorter than index 11 without throwing", () => {
    const data: (string | number | null)[] = [];
    const today = new Date().toISOString().split("T")[0];
    expect(extractDateFromData(data)).toBe(today);
  });
});

describe("inferTypeFromName", () => {
  it.each([
    ["Meeting Minutes 2024-01-10.pdf", "", "meeting-minutes"],
    ["City Council Agenda.pdf", "", "agenda"],
    ["Ordinance 24-001.pdf", "", "ordinance"],
    ["Resolution 24-002.pdf", "", "resolution"],
    ["FY2024 Budget.pdf", "", "financial-report"],
    ["Annual Financial Report.pdf", "", "financial-report"],
    ["Audit Report 2024.pdf", "", "financial-report"],
    ["City Charter.pdf", "", "charter"],
    ["Public Hearing Notice.pdf", "", "public-notice"],
    ["Strategic Plan 2030.pdf", "", "strategic-plan"],
    ["Parks Master Plan.pdf", "", "strategic-plan"],
  ] as const)("classifies %s as %s", (name, folderName, expected) => {
    expect(inferTypeFromName(name, folderName)).toBe(expected);
  });

  it("falls back to the folder name when the document name has no signal", () => {
    expect(inferTypeFromName("Untitled.pdf", "Ordinances")).toBe("ordinance");
  });

  it("returns undefined when neither name nor folder has a recognizable keyword", () => {
    expect(inferTypeFromName("Scan001.pdf", "Miscellaneous")).toBeUndefined();
  });

  it("is case-insensitive", () => {
    expect(inferTypeFromName("AGENDA.PDF", "")).toBe("agenda");
  });
});

describe("inferBoardFromName", () => {
  it.each([
    ["City Council", "city-council"],
    ["Council", "city-council"],
    ["Planning and Zoning Commission", "planning-zoning"],
    ["Zoning Board of Adjustment", "planning-zoning"],
    ["Parks and Recreation Foundation", "parks-recreation"],
    ["Economic Development Corporation", "edc"],
    ["EDC Board", "edc"],
    ["Schertz Housing Authority", "housing-authority"],
    ["Library Advisory Board", "library-advisory"],
    ["TIRZ Board", "tirz"],
  ] as const)("infers %s as %s", (folderName, expected) => {
    expect(inferBoardFromName(folderName)).toBe(expected);
  });

  it("returns undefined for a folder name with no board keyword", () => {
    expect(inferBoardFromName("Finance Information")).toBeUndefined();
  });

  it("is case-insensitive", () => {
    expect(inferBoardFromName("CITY COUNCIL")).toBe("city-council");
  });
});
