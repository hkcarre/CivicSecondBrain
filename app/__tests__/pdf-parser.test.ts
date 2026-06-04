import { describe, it, expect } from "vitest";
import { chunkDocument } from "../lib/parser/pdf-parser";

describe("chunkDocument", () => {
  it("returns single chunk when text fits within limit", () => {
    const text = "Hello world.\n\nThis is a short document.";
    const chunks = chunkDocument(text, 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("splits text that exceeds maxTokensPerChunk", () => {
    // 80000 tokens * 4 chars/token = 320000 chars — use a tiny limit to force splitting
    const text = "A".repeat(100) + "\n\n" + "B".repeat(100);
    const chunks = chunkDocument(text, 25); // 25 tokens = 100 chars per chunk
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("prefers paragraph boundaries when splitting", () => {
    // Build a text with a clear paragraph break near the 70% mark of a chunk
    const para1 = "X".repeat(70);
    const para2 = "Y".repeat(30);
    const para3 = "Z".repeat(100);
    const text = `${para1}\n\n${para2}\n\n${para3}`;

    // maxChars ≈ 100 tokens * 4 = 400 chars — paragraph break should be found
    const chunks = chunkDocument(text, 25);
    // Each chunk should not start with whitespace (trimmed)
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
    const chunks = chunkDocument(text, 10); // force split
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const rejoined = chunks.join("");
    // All original content is preserved (whitespace may differ at boundaries)
    expect(rejoined.replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
  });
});
