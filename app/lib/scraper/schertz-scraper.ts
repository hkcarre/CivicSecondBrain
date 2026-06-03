/**
 * Schertz, TX Government Document Scraper
 *
 * Crawls https://www.schertz.com/27/Government to discover
 * and download all available city documents for ingestion.
 *
 * Document sources:
 *  - AgendaCenter (Laserfiche) — meeting agendas & minutes
 *  - Budget & Finance PDFs
 *  - MuniCode — ordinances (HTML)
 *  - City Charter PDF
 *  - Strategic Plan PDF
 *  - State of the City reports
 *  - Board/Commission agendas (14 boards)
 */

import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { CivicDocument, DocumentType, BoardName } from "@/types";

const BASE_URL = "https://www.schertz.com";
const GOV_URL = `${BASE_URL}/27/Government`;
const RAW_SOURCES_PATH = process.env.RAW_SOURCES_PATH ?? "./raw-sources";

// ─── Known document source URLs for Schertz ───────────────────────────────

export const SCHERTZ_SOURCES = {
  // /273 is the confirmed live Agendas & Minutes page
  agendaCenter: `${BASE_URL}/273/Agendas-Minutes`,
  // /251 confirmed live Budget & Finance page
  budgetFinance: `${BASE_URL}/251/Budget-Finance`,
  municode: "https://library.municode.com/tx/schertz",
  publicNotices: `${BASE_URL}/CivicAlerts.aspx`,
};

// ─── Board URL mappings ────────────────────────────────────────────────────

// Schertz uses a single /273 page for all board agendas with a category filter.
// The numeric IDs in the URL are the CategoryID query param values.
export const BOARD_AGENDA_URLS: Record<BoardName, string> = {
  "city-council":           `${BASE_URL}/273/Agendas-Minutes?CID=1`,
  "planning-zoning":        `${BASE_URL}/273/Agendas-Minutes?CID=4`,
  "board-of-adjustment":    `${BASE_URL}/273/Agendas-Minutes?CID=5`,
  "parks-recreation":       `${BASE_URL}/273/Agendas-Minutes?CID=6`,
  "historical-preservation":`${BASE_URL}/273/Agendas-Minutes?CID=7`,
  edc:                      `${BASE_URL}/273/Agendas-Minutes?CID=8`,
  tsac:                     `${BASE_URL}/273/Agendas-Minutes?CID=9`,
  "library-advisory":       `${BASE_URL}/273/Agendas-Minutes?CID=10`,
  "animal-services":        `${BASE_URL}/273/Agendas-Minutes?CID=11`,
  "senior-center":          `${BASE_URL}/273/Agendas-Minutes?CID=12`,
  "investment-advisory":    `${BASE_URL}/273/Agendas-Minutes?CID=13`,
  "keep-schertz-beautiful": `${BASE_URL}/273/Agendas-Minutes?CID=14`,
  sslgc:                    `${BASE_URL}/273/Agendas-Minutes?CID=15`,
  "housing-authority":      `${BASE_URL}/273/Agendas-Minutes?CID=16`,
  tirz:                     `${BASE_URL}/273/Agendas-Minutes?CID=17`,
};

// ─── Discovered document manifest ─────────────────────────────────────────

export interface DiscoveredDocument {
  title: string;
  url: string;
  type: DocumentType;
  board?: BoardName;
  date?: string;
  checksum?: string;
}

// ─── Main scraper entry point ──────────────────────────────────────────────

export async function discoverDocuments(): Promise<DiscoveredDocument[]> {
  const discovered: DiscoveredDocument[] = [];

  console.log("🔍 Scraping Schertz government documents...");

  // 1. Discover from AgendaCenter (meeting minutes + agendas)
  for (const [board, url] of Object.entries(BOARD_AGENDA_URLS)) {
    try {
      const docs = await scrapeAgendaCenter(url, board as BoardName);
      discovered.push(...docs);
      console.log(`  ✓ ${board}: ${docs.length} documents found`);
    } catch (err) {
      console.warn(`  ⚠ ${board}: scrape failed — ${(err as Error).message}`);
    }
  }

  // 2. Discover budget/finance documents
  try {
    const budgetDocs = await scrapeBudgetDocs();
    discovered.push(...budgetDocs);
    console.log(`  ✓ Budget/Finance: ${budgetDocs.length} documents found`);
  } catch (err) {
    console.warn(`  ⚠ Budget/Finance: ${(err as Error).message}`);
  }

  // 3. Discover public notices
  try {
    const notices = await scrapePublicNotices();
    discovered.push(...notices);
    console.log(`  ✓ Public Notices: ${notices.length} found`);
  } catch (err) {
    console.warn(`  ⚠ Public Notices: ${(err as Error).message}`);
  }

  console.log(`\n📋 Total documents discovered: ${discovered.length}`);
  return discovered;
}

// ─── AgendaCenter scraper ──────────────────────────────────────────────────
// Schertz AgendaCenter at /273 renders agenda rows with DocumentCenter PDF links.
// Each row has: date text + links to Agenda PDF and/or Minutes PDF.

async function scrapeAgendaCenter(
  url: string,
  board: BoardName
): Promise<DiscoveredDocument[]> {
  const { data: html } = await axios.get(url, { timeout: 15000 });
  const $ = cheerio.load(html);
  const docs: DiscoveredDocument[] = [];
  const label = boardLabel(board);

  // Schertz CivicPlus AgendaCenter: rows are <li> or <tr> elements containing
  // a date and PDF links. Collect ALL DocumentCenter PDF links on the page.
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const text = $(el).text().trim();

    // Only follow DocumentCenter PDF links
    if (!href.includes("/DocumentCenter/") && !href.includes("ViewFile")) return;
    if (!text) return;
    // Skip known non-document IDs
    const SKIP_IDS = ["8101"];
    if (SKIP_IDS.some((id) => href.includes(`/View/${id}`))) return;

    const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Classify as agenda or minutes based on link text
    const lowerText = text.toLowerCase();
    const isMinutes = lowerText.includes("minute") || lowerText.includes("minutes");
    const isAgenda = lowerText.includes("agenda") || !isMinutes;

    // Extract date from surrounding context (parent row)
    const parentText = $(el).closest("li, tr, div").text();
    const dateMatch = parentText.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}/i)
      ?? parentText.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
    const date = dateMatch ? parseDate(dateMatch[0]) : new Date().toISOString().split("T")[0];

    docs.push({
      title: `${label} ${isMinutes ? "Minutes" : "Agenda"} — ${date}`,
      url: fullUrl,
      type: isMinutes ? "meeting-minutes" : "agenda",
      board,
      date,
    });
  });

  return docs;
}

// ─── Budget document scraper ───────────────────────────────────────────────

async function scrapeBudgetDocs(): Promise<DiscoveredDocument[]> {
  const { data: html } = await axios.get(SCHERTZ_SOURCES.budgetFinance, {
    timeout: 15000,
  });
  const $ = cheerio.load(html);
  const docs: DiscoveredDocument[] = [];

  // Only follow DocumentCenter links that look like real budget/finance documents.
  // Exclude maps, forms, and other non-financial pages.
  const SKIP_KEYWORDS = ["map", "form", "contact", "directory", "photo", "image", "building"];
  // Known non-document IDs to skip (e.g., 8101 = building map)
  const SKIP_IDS = ["8101"];

  $('a[href*="DocumentCenter/View"]').each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const title = $(el).text().trim();
    if (!title || !href) return;

    // Skip obviously non-financial documents
    if (SKIP_KEYWORDS.some((kw) => title.toLowerCase().includes(kw))) return;
    // Skip known non-document IDs
    if (SKIP_IDS.some((id) => href.includes(`/View/${id}`))) return;
    // Must have a meaningful title (not just a number or icon)
    if (title.length < 5) return;

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const type = inferDocType(title);
    const date = extractYearFromTitle(title);

    docs.push({ title, url, type, date });
  });

  return docs;
}

// ─── Public notices scraper ────────────────────────────────────────────────

async function scrapePublicNotices(): Promise<DiscoveredDocument[]> {
  // Schertz public notices are at /CivicAlerts.aspx (no AID filter needed)
  const { data: html } = await axios.get(SCHERTZ_SOURCES.publicNotices, {
    timeout: 15000,
  });
  const $ = cheerio.load(html);
  const docs: DiscoveredDocument[] = [];
  const today = new Date().toISOString().split("T")[0];

  // CivicPlus alert pages use .liveEditTab or table rows with alert titles
  $(".liveEditTab a, .alertItem a, table.listingTable tr td a").each((_i, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr("href") ?? "";
    if (!title || !href || title.length < 5) return;

    docs.push({
      title: `Public Notice: ${title}`,
      url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      type: "public-notice",
      date: today,
    });
  });

  return docs;
}

// ─── Download a document to raw-sources/ ──────────────────────────────────

export async function downloadDocument(
  doc: DiscoveredDocument
): Promise<string | null> {
  try {
    const dir = path.join(RAW_SOURCES_PATH, doc.type, doc.board ?? "general");
    fs.mkdirSync(dir, { recursive: true });

    const response = await axios.get(doc.url, {
      responseType: "arraybuffer",
      timeout: 60000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "CivicSecondBrain/1.0 (City Council Research Tool; contact@schertz.com)",
        "Accept": "application/pdf,*/*",
      },
    });

    // Determine extension from Content-Type (more reliable than URL for
    // CivicPlus DocumentCenter which serves PDFs at extensionless URLs)
    const contentType: string =
      (response.headers["content-type"] as string) ?? "";
    const ext = contentTypeToExt(contentType) ?? getExtension(doc.url);
    const filename = sanitizeFilename(doc.title) + ext;
    const localPath = path.join(dir, filename);

    // Skip if already downloaded with same checksum
    if (fs.existsSync(localPath)) {
      const existing = fs.readFileSync(localPath);
      const checksum = crypto.createHash("md5").update(existing).digest("hex");
      if (checksum === doc.checksum) {
        console.log(`  ↩ Skipped (unchanged): ${filename}`);
        return localPath;
      }
    }

    fs.writeFileSync(localPath, response.data);
    console.log(`  ↓ Downloaded: ${filename} (${ext}, ${Math.round(response.data.byteLength / 1024)}KB)`);
    return localPath;
  } catch (err) {
    console.warn(`  ✗ Download failed for "${doc.title}": ${(err as Error).message}`);
    return null;
  }
}

function contentTypeToExt(contentType: string): string | null {
  if (contentType.includes("application/pdf")) return ".pdf";
  if (contentType.includes("application/vnd.openxmlformats") ||
      contentType.includes("spreadsheetml")) return ".xlsx";
  if (contentType.includes("msword") ||
      contentType.includes("wordprocessingml")) return ".docx";
  if (contentType.includes("text/html")) return ".html";
  if (contentType.includes("text/plain")) return ".txt";
  return null;
}

// ─── Build a CivicDocument manifest entry ─────────────────────────────────

export function toCivicDocument(
  doc: DiscoveredDocument,
  localPath: string,
  id: string
): CivicDocument {
  return {
    id,
    title: doc.title,
    type: doc.type,
    board: doc.board,
    date: doc.date ?? new Date().toISOString().split("T")[0],
    sourceUrl: doc.url,
    localPath,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 120);
}

function getExtension(url: string): string {
  if (url.includes(".pdf")) return ".pdf";
  if (url.includes(".xlsx") || url.includes(".xls")) return ".xlsx";
  if (url.includes(".docx") || url.includes(".doc")) return ".docx";
  return ".html";
}

function inferDocType(title: string): DocumentType {
  const t = title.toLowerCase();
  if (t.includes("budget")) return "budget";
  if (t.includes("ordinance")) return "ordinance";
  if (t.includes("charter")) return "charter";
  if (t.includes("financial") || t.includes("audit")) return "financial-report";
  if (t.includes("strategic")) return "strategic-plan";
  if (t.includes("state of the city")) return "state-of-city";
  if (t.includes("minutes")) return "meeting-minutes";
  if (t.includes("agenda")) return "agenda";
  if (t.includes("notice")) return "public-notice";
  if (t.includes("resolution")) return "resolution";
  return "financial-report";
}

function extractYearFromTitle(title: string): string {
  const match = title.match(/20\d{2}/);
  return match ? `${match[0]}-01-01` : new Date().toISOString().split("T")[0];
}

function parseDate(text: string): string {
  try {
    const d = new Date(text);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return new Date().toISOString().split("T")[0];
}

function boardLabel(board: BoardName): string {
  const labels: Record<BoardName, string> = {
    "city-council": "City Council",
    "planning-zoning": "Planning & Zoning Commission",
    "board-of-adjustment": "Board of Adjustment",
    "parks-recreation": "Parks & Recreation Advisory Board",
    "historical-preservation": "Historical Preservation Committee",
    edc: "Economic Development Corporation",
    tsac: "Transportation Safety Advisory Commission",
    "library-advisory": "Library Advisory Board",
    "animal-services": "Animal Services Advisory Committee",
    "senior-center": "Senior Center Advisory Board",
    "investment-advisory": "Investment Advisory Board",
    "keep-schertz-beautiful": "Keep Schertz Beautiful Committee",
    sslgc: "Schertz Seguin Local Government Corporation",
    "housing-authority": "Schertz Housing Authority",
    tirz: "Tax Increment Reinvestment Zone Board",
  };
  return labels[board] ?? board;
}
