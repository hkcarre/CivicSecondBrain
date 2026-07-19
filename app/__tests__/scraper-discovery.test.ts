/**
 * scraper-discovery.test.ts
 *
 * Tests for discoverDocuments() in app/lib/scraper/schertz-scraper.ts — the
 * Promise.allSettled fan-out across DocumentCenter, Finance sub-pages,
 * Public Notices, Laserfiche, and MuniCode.
 *
 * The contract under test: ONE failing source must never take down
 * discovery — fulfilled sources' documents are still returned, and a
 * total wipeout yields an empty array rather than a throw (the nightly
 * cron treats a throw as a fatal run failure).
 *
 * axios is mocked at the module level (repo pattern from
 * schertz-scraper-download.test.ts); the Laserfiche and MuniCode scrapers
 * live in their own modules and are mocked directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("axios");

const mockLaserfiche = vi.fn();
const mockMunicode = vi.fn();

vi.mock("@/lib/scraper/laserfiche-scraper", () => ({
  discoverLaserficheDocs: mockLaserfiche,
}));
vi.mock("@/lib/scraper/municode-scraper", () => ({
  discoverMunicodeDocs: mockMunicode,
}));

import axios from "axios";

async function importScraper() {
  vi.resetModules();
  return import("@/lib/scraper/schertz-scraper");
}

beforeEach(() => {
  vi.mocked(axios.get).mockReset();
  vi.mocked(axios.post).mockReset?.();
  mockLaserfiche.mockReset();
  mockMunicode.mockReset();
});

describe("discoverDocuments — partial failure resilience", () => {
  it("returns documents from healthy sources when the HTTP scrapers all fail", async () => {
    // Every axios-backed source (DocumentCenter, Finance, Notices) fails…
    vi.mocked(axios.get).mockRejectedValue(new Error("ECONNREFUSED"));
    if (vi.mocked(axios.post)) {
      vi.mocked(axios.post).mockRejectedValue(new Error("ECONNREFUSED"));
    }
    // …but Laserfiche and MuniCode succeed
    mockLaserfiche.mockResolvedValue([
      { title: "Council Minutes 2026-06-01", url: "https://lf.example/doc/1", type: "meeting-minutes", date: "2026-06-01" },
      { title: "Council Agenda 2026-06-15", url: "https://lf.example/doc/2", type: "agenda", date: "2026-06-15" },
    ]);
    mockMunicode.mockResolvedValue([
      { title: "Ch. 18 Buildings", url: "https://municode.example/ch18", type: "ordinance", date: "2026-01-01" },
    ]);

    const { discoverDocuments } = await importScraper();
    const docs = await discoverDocuments();

    const urls = docs.map((d) => d.url);
    expect(urls).toContain("https://lf.example/doc/1");
    expect(urls).toContain("https://lf.example/doc/2");
    expect(urls).toContain("https://municode.example/ch18");
    expect(docs.length).toBe(3);
  });

  it("returns an empty array (not a throw) when every source fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("network down"));
    if (vi.mocked(axios.post)) {
      vi.mocked(axios.post).mockRejectedValue(new Error("network down"));
    }
    mockLaserfiche.mockRejectedValue(new Error("handshake failed"));
    mockMunicode.mockRejectedValue(new Error("api moved"));

    const { discoverDocuments } = await importScraper();
    await expect(discoverDocuments()).resolves.toEqual([]);
  });

  it("continues when only Laserfiche fails and keeps the other sources' docs", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("ECONNREFUSED"));
    if (vi.mocked(axios.post)) {
      vi.mocked(axios.post).mockRejectedValue(new Error("ECONNREFUSED"));
    }
    mockLaserfiche.mockRejectedValue(new Error("session handshake failed"));
    mockMunicode.mockResolvedValue([
      { title: "Ch. 90 Zoning", url: "https://municode.example/ch90", type: "ordinance", date: "2026-01-01" },
    ]);

    const { discoverDocuments } = await importScraper();
    const docs = await discoverDocuments();
    expect(docs.map((d) => d.url)).toContain("https://municode.example/ch90");
  });
});
