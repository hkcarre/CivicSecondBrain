import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  loadManifest,
  saveManifest,
  docId,
  fileChecksum,
  needsIngestion,
  markIngested,
  type ManifestEntry,
} from "../lib/manifest";

let tmpDir: string;
const origManifestPath = process.env.MANIFEST_PATH;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-test-"));
  process.env.MANIFEST_PATH = path.join(tmpDir, "manifest.json");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (origManifestPath !== undefined) {
    process.env.MANIFEST_PATH = origManifestPath;
  } else {
    delete process.env.MANIFEST_PATH;
  }
});

describe("loadManifest / saveManifest", () => {
  it("returns empty object when file does not exist", () => {
    const manifest = loadManifest();
    expect(manifest).toEqual({});
  });

  it("round-trips data correctly", () => {
    const data = {
      abc123: {
        id: "abc123",
        title: "Test Doc",
        type: "budget" as const,
        date: "2024-01-01",
        sourceUrl: "https://example.com/doc.pdf",
        ingestedAt: "2024-01-02T00:00:00Z",
        checksum: "deadbeef",
      },
    };
    saveManifest(data);
    const loaded = loadManifest();
    expect(loaded).toEqual(data);
  });
});

describe("docId", () => {
  it("produces a 12-char hex string", () => {
    const id = docId("https://example.com/doc.pdf");
    expect(id).toMatch(/^[a-f0-9]{12}$/);
  });

  it("is deterministic", () => {
    const url = "https://example.com/test";
    expect(docId(url)).toBe(docId(url));
  });

  it("differs for different URLs", () => {
    expect(docId("https://example.com/a")).not.toBe(
      docId("https://example.com/b")
    );
  });
});

describe("fileChecksum", () => {
  it("returns an md5 hex string", () => {
    const file = path.join(tmpDir, "test.txt");
    fs.writeFileSync(file, "hello world", "utf-8");
    const cs = fileChecksum(file);
    expect(cs).toMatch(/^[a-f0-9]{32}$/);
  });

  it("returns different checksums for different content", () => {
    const f1 = path.join(tmpDir, "a.txt");
    const f2 = path.join(tmpDir, "b.txt");
    fs.writeFileSync(f1, "content A", "utf-8");
    fs.writeFileSync(f2, "content B", "utf-8");
    expect(fileChecksum(f1)).not.toBe(fileChecksum(f2));
  });
});

describe("needsIngestion", () => {
  it("returns true when document not in manifest", () => {
    const manifest = loadManifest();
    expect(needsIngestion(manifest, "https://example.com/doc.pdf")).toBe(true);
  });

  it("returns false when already ingested and no localPath provided", () => {
    const url = "https://example.com/doc.pdf";
    const id = docId(url);
    const manifest = {
      [id]: {
        id,
        title: "Doc",
        type: "budget" as const,
        date: "2024-01-01",
        sourceUrl: url,
        ingestedAt: "2024-01-02T00:00:00Z",
      },
    };
    expect(needsIngestion(manifest, url)).toBe(false);
  });

  it("returns false when checksum matches", () => {
    const url = "https://example.com/doc.pdf";
    const id = docId(url);
    const file = path.join(tmpDir, "doc.pdf");
    fs.writeFileSync(file, "same content", "utf-8");
    const cs = fileChecksum(file);
    const manifest = {
      [id]: {
        id,
        title: "Doc",
        type: "budget" as const,
        date: "2024-01-01",
        sourceUrl: url,
        ingestedAt: "2024-01-02T00:00:00Z",
        checksum: cs,
      },
    };
    expect(needsIngestion(manifest, url, file)).toBe(false);
  });

  it("returns true when checksum differs (file changed)", () => {
    const url = "https://example.com/doc.pdf";
    const id = docId(url);
    const file = path.join(tmpDir, "doc.pdf");
    fs.writeFileSync(file, "new content", "utf-8");
    const manifest = {
      [id]: {
        id,
        title: "Doc",
        type: "budget" as const,
        date: "2024-01-01",
        sourceUrl: url,
        ingestedAt: "2024-01-02T00:00:00Z",
        checksum: "old-checksum-that-differs",
      },
    };
    expect(needsIngestion(manifest, url, file)).toBe(true);
  });
});

describe("markIngested", () => {
  it("sets ingestedAt and checksum on the manifest entry", () => {
    const url = "https://example.com/doc.pdf";
    const id = docId(url);
    const file = path.join(tmpDir, "doc.pdf");
    fs.writeFileSync(file, "content", "utf-8");
    const cs = fileChecksum(file);

    const manifest: Record<string, ManifestEntry> = {};
    markIngested(
      manifest,
      id,
      {
        id,
        title: "Doc",
        type: "budget",
        date: "2024-01-01",
        sourceUrl: url,
      },
      file
    );

    expect(manifest[id].ingestedAt).toBeTruthy();
    expect(manifest[id].checksum).toBe(cs);
  });
});
