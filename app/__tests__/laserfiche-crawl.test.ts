/**
 * laserfiche-crawl.test.ts
 *
 * Tests for the Laserfiche WebLink crawl core (createSession → crawlFolder →
 * discoverLaserficheDocs) — previously uncovered (lines 80–244). The existing
 * laserfiche-scraper.test.ts covers only the exported name/date helpers.
 *
 * axios is mocked at the module level; axios.create returns a stub client
 * whose post() serves fabricated FolderListingService responses keyed by
 * folderId. This pins:
 *  - document discovery with download-URL construction and folder defaults
 *  - pagination across PAGE_SIZE boundaries
 *  - subfolder recursion and the MAX_DEPTH cap
 *  - failed/short listings ending a folder gracefully
 *  - extension filtering (GIS/image exports skipped)
 *  - classification of extensionless entries via the API's explicit
 *    type field (1=folder, 2=document)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("axios");

import axios from "axios";

interface StubEntry {
  entryId: number;
  name: string;
  type: number;
  isEdoc: boolean;
  extension: string;
  data: (string | number | null)[];
}

// folderId → array of pages (each page = entries array + totalEntries)
let folderData: Record<number, Array<{ results: (StubEntry | null)[]; totalEntries: number; failed?: boolean }>>;
let postCalls: Array<{ folderId: number; start: number }>;

function makeStubClient() {
  return {
    get: vi.fn().mockResolvedValue({ headers: {} }), // session handshake: no redirects
    post: vi.fn().mockImplementation((_url: string, body: { folderId: number; start: number }) => {
      postCalls.push({ folderId: body.folderId, start: body.start });
      const pages = folderData[body.folderId] ?? [
        { results: [], totalEntries: 0 },
      ];
      const pageIndex = Math.floor(body.start / 100);
      const page = pages[Math.min(pageIndex, pages.length - 1)];
      return Promise.resolve({
        data: {
          data: {
            results: page.results,
            totalEntries: page.totalEntries,
            failed: page.failed ?? false,
            errMsg: null,
          },
        },
      });
    }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
}

function doc(entryId: number, name: string, extension = "pdf", isEdoc = true, type = 2): StubEntry {
  return { entryId, name, type, isEdoc, extension, data: [] };
}

function folder(entryId: number, name: string): StubEntry {
  return { entryId, name, type: 1, isEdoc: false, extension: "", data: [] };
}

async function importScraper() {
  vi.resetModules();
  return import("@/lib/scraper/laserfiche-scraper");
}

beforeEach(() => {
  vi.clearAllMocks();
  folderData = {};
  postCalls = [];
  vi.mocked(axios.create).mockReturnValue(makeStubClient() as never);
});

describe("discoverLaserficheDocs — document discovery", () => {
  it("discovers PDF documents with the download URL and the civic folder's defaults", async () => {
    // 54081 = City Council (type agenda, board city-council)
    folderData[54081] = [
      { results: [doc(9001, "Council Packet 2026-06-02")], totalEntries: 1 },
    ];
    const { discoverLaserficheDocs } = await importScraper();
    const docs = await discoverLaserficheDocs();

    const packet = docs.find((d) => d.title === "Council Packet 2026-06-02");
    expect(packet).toBeDefined();
    expect(packet!.url).toContain("ElectronicFile.aspx?id=9001");
    expect(packet!.board).toBe("city-council");
    expect(packet!.date).toBe("2026-06-02"); // from the name
  });

  it("skips non-text formats (images, GIS exports)", async () => {
    folderData[54081] = [
      {
        results: [
          doc(1, "Site plan scan", "tif", false),
          doc(2, "Council Minutes 2026-05-06", "pdf", true),
        ],
        totalEntries: 2,
      },
    ];
    const { discoverLaserficheDocs } = await importScraper();
    const docs = await discoverLaserficheDocs();

    expect(docs.some((d) => d.title.includes("Site plan"))).toBe(false);
    expect(docs.some((d) => d.title.includes("Council Minutes"))).toBe(true);
  });

  it("captures an extensionless document when the API marks it type=2 (document)", async () => {
    // Laserfiche marks e-docs without a filename extension routinely; the
    // API's explicit type field (1=folder, 2=document) is authoritative.
    folderData[54081] = [
      { results: [doc(77, "Special Meeting Notice", "", false, 2)], totalEntries: 1 },
    ];
    const { discoverLaserficheDocs } = await importScraper();
    const docs = await discoverLaserficheDocs();

    expect(docs.some((d) => d.title === "Special Meeting Notice")).toBe(true);
  });
});

describe("discoverLaserficheDocs — pagination and recursion", () => {
  it("paginates through folders larger than one page", async () => {
    const pageOne = Array.from({ length: 100 }, (_, i) => doc(1000 + i, `Doc ${i} 2026-01-01`));
    const pageTwo = [doc(2000, "Final Doc 2026-02-02")];
    folderData[54081] = [
      { results: pageOne, totalEntries: 101 },
      { results: pageTwo, totalEntries: 101 },
    ];
    const { discoverLaserficheDocs } = await importScraper();
    const docs = await discoverLaserficheDocs();

    expect(docs.filter((d) => d.url.includes("id=1") || d.url.includes("id=2")).length).toBeGreaterThanOrEqual(101);
    const councilCalls = postCalls.filter((c) => c.folderId === 54081);
    expect(councilCalls.map((c) => c.start)).toEqual([0, 100]);
  });

  it("recurses into subfolders and inherits the parent's defaults", async () => {
    folderData[55961] = [
      { results: [folder(400, "FY2026 Reports")], totalEntries: 1 },
    ];
    folderData[400] = [
      { results: [doc(401, "Quarterly Report Q1 2026")], totalEntries: 1 },
    ];
    const { discoverLaserficheDocs } = await importScraper();
    const docs = await discoverLaserficheDocs();

    const report = docs.find((d) => d.title.includes("Quarterly Report"));
    expect(report).toBeDefined();
    expect(report!.type).toBe("financial-report"); // Finance Information default
  });

  it("stops recursion at MAX_DEPTH instead of following folder chains forever", async () => {
    // Folder 42792 contains a folder that contains itself — an infinite chain
    // without the depth cap.
    folderData[42792] = [{ results: [folder(500, "Loop")], totalEntries: 1 }];
    folderData[500] = [{ results: [folder(500, "Loop")], totalEntries: 1 }];
    const { discoverLaserficheDocs } = await importScraper();

    await expect(discoverLaserficheDocs()).resolves.toBeDefined();
    // depth 0 (root civic folder) + depths 1..4 for the loop = bounded calls
    const loopCalls = postCalls.filter((c) => c.folderId === 500);
    expect(loopCalls.length).toBeLessThanOrEqual(5);
  });

  it("ends a folder gracefully when the service reports failed=true", async () => {
    folderData[25656] = [{ results: [], totalEntries: 0, failed: true }];
    folderData[54081] = [
      { results: [doc(3, "Council Agenda 2026-03-03")], totalEntries: 1 },
    ];
    const { discoverLaserficheDocs } = await importScraper();
    const docs = await discoverLaserficheDocs();

    // The failed folder contributes nothing; the healthy folder still crawls
    expect(docs.some((d) => d.title.includes("Council Agenda"))).toBe(true);
  });
});
