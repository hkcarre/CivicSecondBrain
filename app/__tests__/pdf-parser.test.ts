import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { chunkDocument, parseDocument } from "../lib/parser/pdf-parser";

const FIXTURES = path.join(__dirname, "fixtures");

// ─── parseDocument — DOCX ──────────────────────────────────────────────────

describe("parseDocument — .docx", () => {
  it("returns non-empty text from a valid DOCX file", async () => {
    const result = await parseDocument(path.join(FIXTURES, "test.docx"));
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("extracts expected paragraph text from DOCX", async () => {
    const result = await parseDocument(path.join(FIXTURES, "test.docx"));
    expect(result.text).toContain("Hello from DOCX fixture.");
    expect(result.text).toContain("Second paragraph with more text.");
  });

  it("sets title to the file basename for DOCX", async () => {
    const result = await parseDocument(path.join(FIXTURES, "test.docx"));
    expect(result.title).toBe("test.docx");
  });

  it("handles .doc extension (dispatches to parseDocx)", async () => {
    const fakePath = path.join(FIXTURES, "test.docx").replace(/\.docx$/, ".doc");
    fs.copyFileSync(path.join(FIXTURES, "test.docx"), fakePath);
    try {
      const result = await parseDocument(fakePath);
      expect(result.text).toContain("Hello from DOCX fixture.");
    } finally {
      fs.unlinkSync(fakePath);
    }
  });

  it("does NOT return skipped=true for .docx (now has a real parser)", async () => {
    const result = await parseDocument(path.join(FIXTURES, "test.docx"));
    expect(result.skipped).toBeFalsy();
  });
});

// ─── parseDocument — XLSX ──────────────────────────────────────────────────

describe("parseDocument — .xlsx", () => {
  it("returns non-empty text from a valid XLSX file", async () => {
    const result = await parseDocument(path.join(FIXTURES, "test.xlsx"));
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("includes sheet name headers in extracted text", async () => {
    const result = await parseDocument(path.join(FIXTURES, "test.xlsx"));
    expect(result.text).toContain("=== Budget ===");
    expect(result.text).toContain("=== Notes ===");
  });

  it("includes cell data from all sheets", async () => {
    const result = await parseDocument(path.join(FIXTURES, "test.xlsx"));
    expect(result.text).toContain("Department");
    expect(result.text).toContain("Police");
    expect(result.text).toContain("City council approved measure A");
  });

  it("sets title to the file basename for XLSX", async () => {
    const result = await parseDocument(path.join(FIXTURES, "test.xlsx"));
    expect(result.title).toBe("test.xlsx");
  });

  it("handles .xls extension via the same parseXlsx path", async () => {
    const fakePath = path.join(FIXTURES, "test.xlsx").replace(/\.xlsx$/, ".xls");
    fs.copyFileSync(path.join(FIXTURES, "test.xlsx"), fakePath);
    try {
      const result = await parseDocument(fakePath);
      expect(result.text).toContain("Department");
    } finally {
      fs.unlinkSync(fakePath);
    }
  });

  it("does NOT return skipped=true for .xlsx (now has a real parser)", async () => {
    const result = await parseDocument(path.join(FIXTURES, "test.xlsx"));
    expect(result.skipped).toBeFalsy();
  });
});

// ─── parseDocument — other formats ────────────────────────────────────────

describe("parseDocument — other formats", () => {
  const tmpDir = os.tmpdir();
  const makeFile = (name: string, content = "dummy") => {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, content);
    return p;
  };

  it("does NOT set skipped for .txt files", async () => {
    const filePath = makeFile("test.txt", "hello world");
    const result = await parseDocument(filePath);
    expect(result.skipped).toBeFalsy();
    expect(result.text).toContain("hello world");
  });

  it("throws for unsupported extensions", async () => {
    const filePath = makeFile("test.pptx");
    await expect(parseDocument(filePath)).rejects.toThrow("Unsupported file type");
  });
});

// ─── chunkDocument ─────────────────────────────────────────────────────────

describe("chunkDocument", () => {
  it("returns single chunk when text fits within limit", () => {
    const text = "Hello world.\n\nThis is a short document.";
    const chunks = chunkDocument(text, 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("splits text that exceeds maxTokensPerChunk", () => {
    const text = "A".repeat(100) + "\n\n" + "B".repeat(100);
    const chunks = chunkDocument(text, 25); // 25 tokens = 100 chars per chunk
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("prefers paragraph boundaries when splitting", () => {
    const para1 = "X".repeat(70);
    const para2 = "Y".repeat(30);
    const para3 = "Z".repeat(100);
    const text = `${para1}\n\n${para2}\n\n${para3}`;
    const chunks = chunkDocument(text, 25);
    chunks.forEach((chunk) => {
      expect(chunk).toBe(chunk.trim());
    });
  });

  it("handles empty string", () => {
    const chunks = chunkDocument("", 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("");
  });

  it("handles text with no paragraph breaks", () => {
    const text = "word ".repeat(200).trim();
    const chunks = chunkDocument(text, 10);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const rejoined = chunks.join("");
    expect(rejoined.replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });
});
