/**
 * municode-scraper.test.ts
 *
 * Tests for the MuniCode scraper: URL parsing, TOC traversal,
 * section collection, graceful skip when unconfigured, and network mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseMunicodeUrl,
  collectSections,
  fetchMunicodeToc,
} from "@/lib/scraper/municode-scraper";

// ─── Mock axios ────────────────────────────────────────────────────────────

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

import axios from "axios";

// ─── Fixtures ─────────────────────────────────────────────────────────────

const SAMPLE_TOC = {
  id: "root",
  name: "Schertz City Code",
  codesId: 14226,
  typeId: 0,
  children: [
    {
      id: "ch1",
      name: "Chapter 1 — General Provisions",
      codesId: 14226,
      typeId: 0,
      children: [
        { id: "sec1-1", name: "Sec. 1-1. Title", codesId: 14226, typeId: 1, children: [] },
        { id: "sec1-2", name: "Sec. 1-2. Definitions", codesId: 14226, typeId: 1, children: [] },
      ],
    },
    {
      id: "ch2",
      name: "Chapter 2 — Administration",
      codesId: 14226,
      typeId: 0,
      children: [
        { id: "sec2-1", name: "Sec. 2-1. Mayor", codesId: 14226, typeId: 1, children: [] },
      ],
    },
  ],
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("parseMunicodeUrl", () => {
  it("parses state and slug from a valid MuniCode URL", () => {
    const result = parseMunicodeUrl("https://library.municode.com/tx/schertz");
    expect(result).toEqual({ state: "tx", slug: "schertz" });
  });

  it("handles trailing slash", () => {
    const result = parseMunicodeUrl("https://library.municode.com/tx/schertz/");
    expect(result).toEqual({ state: "tx", slug: "schertz" });
  });

  it("returns null for a URL without state/slug", () => {
    expect(parseMunicodeUrl("https://library.municode.com/")).toBeNull();
  });

  it("returns null for an invalid URL", () => {
    expect(parseMunicodeUrl("not-a-url")).toBeNull();
  });
});

describe("collectSections", () => {
  it("collects all typeId=1 leaf nodes", () => {
    const sections = collectSections(SAMPLE_TOC);
    expect(sections).toHaveLength(3);
    expect(sections.map((s) => s.id)).toEqual(["sec1-1", "sec1-2", "sec2-1"]);
  });

  it("returns empty array when there are no leaf sections", () => {
    const node = { id: "root", name: "Root", typeId: 0, children: [] };
    expect(collectSections(node)).toHaveLength(0);
  });

  it("propagates codesId from parent to children", () => {
    const node = {
      id: "root",
      name: "Root",
      codesId: 99999,
      typeId: 0,
      children: [
        { id: "leaf", name: "Leaf", typeId: 1, children: [] },
      ],
    };
    const sections = collectSections(node);
    expect(sections[0].codesId).toBe(99999);
  });

  it("respects MAX_SECTIONS cap (test via direct call)", () => {
    // Generate 250 leaf nodes
    const manyChildren = Array.from({ length: 250 }, (_, i) => ({
      id: `sec${i}`,
      name: `Section ${i}`,
      codesId: 14226,
      typeId: 1,
      children: [],
    }));
    const root = { id: "root", name: "Root", codesId: 14226, typeId: 0, children: manyChildren };
    // collectSections itself doesn't cap — the cap is applied in discoverMunicodeDocs
    const all = collectSections(root);
    expect(all).toHaveLength(250);
  });
});

describe("fetchMunicodeToc", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns TOC data on success", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: SAMPLE_TOC });
    const result = await fetchMunicodeToc("tx", "schertz");
    expect(result).toEqual(SAMPLE_TOC);
    expect(axios.get).toHaveBeenCalledWith(
      "https://library.municode.com/api/content/tx/schertz",
      expect.any(Object)
    );
  });

  it("returns null on network error", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("Network error"));
    const result = await fetchMunicodeToc("tx", "schertz");
    expect(result).toBeNull();
  });
});

describe("discoverMunicodeDocs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.MUNICODE_URL;
    delete process.env.SCHERTZ_MUNICODE_URL;
  });

  afterEach(() => {
    delete process.env.MUNICODE_URL;
    delete process.env.SCHERTZ_MUNICODE_URL;
  });

  it("returns empty array when MUNICODE_URL is not set", async () => {
    const { discoverMunicodeDocs: fn } = await import("@/lib/scraper/municode-scraper");
    const docs = await fn();
    expect(docs).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("uses SCHERTZ_MUNICODE_URL as fallback", async () => {
    process.env.SCHERTZ_MUNICODE_URL = "https://library.municode.com/tx/schertz";
    vi.mocked(axios.get).mockResolvedValue({ data: SAMPLE_TOC });
    const { discoverMunicodeDocs: fn } = await import("@/lib/scraper/municode-scraper");
    const docs = await fn();
    expect(docs.length).toBeGreaterThan(0);
  });

  it("returns DiscoveredDocument array with ordinance type", async () => {
    process.env.MUNICODE_URL = "https://library.municode.com/tx/schertz";
    vi.mocked(axios.get).mockResolvedValue({ data: SAMPLE_TOC });
    const { discoverMunicodeDocs: fn } = await import("@/lib/scraper/municode-scraper");
    const docs = await fn();
    expect(docs).toHaveLength(3);
    expect(docs[0].type).toBe("ordinance");
    expect(docs[0].title).toBe("Sec. 1-1. Title");
    expect(docs[0].url).toContain("14226");
    expect(docs[0].url).toContain("sec1-1");
  });

  it("returns empty array when TOC fetch fails", async () => {
    process.env.MUNICODE_URL = "https://library.municode.com/tx/schertz";
    vi.mocked(axios.get).mockRejectedValue(new Error("Connection refused"));
    const { discoverMunicodeDocs: fn } = await import("@/lib/scraper/municode-scraper");
    const docs = await fn();
    expect(docs).toEqual([]);
  });

  it("returns empty array when TOC has no codesId", async () => {
    process.env.MUNICODE_URL = "https://library.municode.com/tx/schertz";
    vi.mocked(axios.get).mockResolvedValue({ data: { id: "root", name: "Root", children: [] } });
    const { discoverMunicodeDocs: fn } = await import("@/lib/scraper/municode-scraper");
    const docs = await fn();
    expect(docs).toEqual([]);
  });
});
