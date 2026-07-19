/**
 * PDF, HTML, DOCX, and XLSX text extraction for civic documents.
 * Extracts clean text from downloaded files before sending to Claude.
 */

import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import * as cheerio from "cheerio";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export interface ParsedDocument {
  text: string;
  pageCount?: number;
  title?: string;
  metadata?: Record<string, string>;
  /** True when the file format is not supported and was intentionally skipped. */
  skipped?: boolean;
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
    case ".docx":
    case ".doc":
      return parseDocx(localPath);
    case ".xlsx":
    case ".xls":
      return parseXlsx(localPath);
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
  // pdf-parse v2 class API; getInfo().info is the same PDF info dictionary
  // v1 exposed as data.info.
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const raw = await parser.getText();
    const info = await parser.getInfo();

    const text = cleanText(raw.text).slice(0, MAX_TEXT_CHARS);
    const pageCount = info.total;
    const title = info.info?.Title as string | undefined;
    const metadata = {
      author: (info.info?.Author as string) ?? "",
      creator: (info.info?.Creator as string) ?? "",
      creationDate: (info.info?.CreationDate as string) ?? "",
    };

    return { text, pageCount, title, metadata };
  } finally {
    await parser.destroy();
  }
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

// ─── DOCX parser (mammoth) ─────────────────────────────────────────────────

async function parseDocx(filePath: string): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = cleanText(result.value).slice(0, MAX_TEXT_CHARS);
  return { text, title: path.basename(filePath) };
}

// ─── XLSX / XLS parser (SheetJS) ──────────────────────────────────────────

async function parseXlsx(filePath: string): Promise<ParsedDocument> {
  const workbook = XLSX.readFile(filePath);
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
    });
    parts.push(`=== ${sheetName} ===`);
    for (const row of rows) {
      parts.push((row as string[]).join("\t"));
    }
  }

  const text = cleanText(parts.join("\n")).slice(0, MAX_TEXT_CHARS);
  return { text, title: path.basename(filePath) };
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
