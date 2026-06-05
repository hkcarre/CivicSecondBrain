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

// Cap: skip PDFs larger than MAX_FILE_SIZE_MB (default 25 MB).
// Set the env var to allow larger files when more memory is available.
const MAX_PDF_BYTES = parseInt(process.env.MAX_FILE_SIZE_MB ?? "25") * 1024 * 1024;

// Cap extracted text at ~400k chars (~100k tokens) before chunking.
// Prevents runaway memory on massive documents.
const MAX_TEXT_CHARS = 400_000;

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
    case ".xlsx":
    case ".xls":
    case ".docx":
    case ".doc":
      // Return a stub — these formats need a separate parser.
      // Returning empty text lets the ingest skip gracefully rather than crash.
      return { text: "", pageCount: 0, title: path.basename(localPath) };
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

// ─── PDF parser ────────────────────────────────────────────────────────────

async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const stat = fs.statSync(filePath);

  if (stat.size > MAX_PDF_BYTES) {
    console.warn(
      `  ⚠ Skipping oversized PDF (${Math.round(stat.size / 1024 / 1024)}MB): ${path.basename(filePath)}`
    );
    return { text: "", pageCount: 0, title: path.basename(filePath) };
  }

  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  // Release the buffer reference immediately so GC can reclaim it
  const text = cleanText(data.text).slice(0, MAX_TEXT_CHARS);
  const pageCount = data.numpages;
  const title = data.info?.Title as string | undefined;
  const metadata = {
    author: (data.info?.Author as string) ?? "",
    creator: (data.info?.Creator as string) ?? "",
    creationDate: (data.info?.CreationDate as string) ?? "",
  };

  return { text, pageCount, title, metadata };
}

// ─── HTML parser (for MuniCode ordinances, public notices) ────────────────

async function parseHtml(filePath: string): Promise<ParsedDocument> {
  const raw = fs.readFileSync(filePath, "utf-8");
  const $ = cheerio.load(raw);

  // Remove nav, footer, sidebar noise
  $("nav, footer, header, script, style, .sidebar, #sidebar, .nav").remove();

  const title =
    $("h1").first().text().trim() || $("title").text().trim();
  const text = cleanText($("body").text()).slice(0, MAX_TEXT_CHARS);

  return { text, title };
}

// ─── Plain text ────────────────────────────────────────────────────────────

async function parseTxt(filePath: string): Promise<ParsedDocument> {
  const text = fs.readFileSync(filePath, "utf-8");
  return { text: cleanText(text).slice(0, MAX_TEXT_CHARS) };
}

// ─── Text cleaning ─────────────────────────────────────────────────────────

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^\s+|\s+$/gm, "")
    .trim();
}

// ─── Chunk large documents for Claude's context window ────────────────────

export function chunkDocument(
  text: string,
  maxTokensPerChunk = 60000   // reduced from 80k to ease per-call memory
): string[] {
  const maxChars = maxTokensPerChunk * 4;

  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    const lastParagraph = text.lastIndexOf("\n\n", end);
    if (lastParagraph > start + maxChars * 0.7) {
      end = lastParagraph;
    }

    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks;
}
