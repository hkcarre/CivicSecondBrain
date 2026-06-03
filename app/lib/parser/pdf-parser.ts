/**
 * PDF and HTML text extraction for civic documents.
 * Extracts clean text from downloaded files before sending to Claude.
 */

import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import * as cheerio from "cheerio";

export interface ParsedDocument {
  text: string;
  pageCount?: number;
  title?: string;
  metadata?: Record<string, string>;
}

// ─── Main parse entry point ────────────────────────────────────────────────

export async function parseDocument(
  localPath: string
): Promise<ParsedDocument> {
  const ext = path.extname(localPath).toLowerCase();

  switch (ext) {
    case ".pdf":
      return parsePdf(localPath);
    case ".html":
    case ".htm":
      return parseHtml(localPath);
    case ".txt":
      return parseTxt(localPath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

// ─── PDF parser ────────────────────────────────────────────────────────────

async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  return {
    text: cleanText(data.text),
    pageCount: data.numpages,
    title: data.info?.Title,
    metadata: {
      author: data.info?.Author ?? "",
      creator: data.info?.Creator ?? "",
      creationDate: data.info?.CreationDate ?? "",
    },
  };
}

// ─── HTML parser (for MuniCode ordinances, public notices) ────────────────

async function parseHtml(filePath: string): Promise<ParsedDocument> {
  const raw = fs.readFileSync(filePath, "utf-8");
  const $ = cheerio.load(raw);

  // Remove nav, footer, sidebar noise
  $("nav, footer, header, script, style, .sidebar, #sidebar, .nav").remove();

  // Extract meaningful content
  const title =
    $("h1").first().text().trim() || $("title").text().trim();
  const text = $("body").text();

  return {
    text: cleanText(text),
    title,
  };
}

// ─── Plain text ────────────────────────────────────────────────────────────

async function parseTxt(filePath: string): Promise<ParsedDocument> {
  const text = fs.readFileSync(filePath, "utf-8");
  return { text: cleanText(text) };
}

// ─── Text cleaning ─────────────────────────────────────────────────────────

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")      // collapse excessive blank lines
    .replace(/[ \t]{2,}/g, " ")       // collapse multiple spaces
    .replace(/^\s+|\s+$/gm, "")       // trim line edges
    .trim();
}

// ─── Chunk large documents for Claude's context window ────────────────────

export function chunkDocument(
  text: string,
  maxTokensPerChunk = 80000
): string[] {
  // Rough estimate: 1 token ≈ 4 characters
  const maxChars = maxTokensPerChunk * 4;

  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    // Try to break at a paragraph boundary
    const lastParagraph = text.lastIndexOf("\n\n", end);
    if (lastParagraph > start + maxChars * 0.7) {
      end = lastParagraph;
    }

    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks;
}
