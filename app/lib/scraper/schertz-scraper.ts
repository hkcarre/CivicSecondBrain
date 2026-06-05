/**
 * Schertz, TX Government Document Scraper
 *
 * Document sources:
 *  1. CivicPlus DocumentCenter — deep folder crawl via Document_AjaxBinding API
 *  2. Budget & Finance sub-pages — /250, /249, /247, /248
 *  3. Public Notices — /2125 and CivicAlerts.aspx
 *  4. Laserfiche WebLink archive — meeting agendas, minutes, ordinances, resolutions
 *
 * NOTE: The /273 AgendaCenter CID-based URLs (?CID=1..17) do NOT serve documents.
 * Board agendas and minutes live entirely in Laserfiche (source 4).
 */

import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { CivicDocument, DocumentType, BoardName } from "@/types";
import { discoverLaserficheDocs } from "./laserfiche-scraper";

const BASE_URL = "https://www.schertz.com";
const RAW_SOURCES_PATH = process.env.RAW_SOURCES_PATH ?? "./raw-sources";
const SKIP_DOC_IDS = new Set(["8101"]); // City Building Map — not a civic document

// ─── Discovered document manifest ─────────────────────────────────────────

export interface DiscoveredDocument {
  title: string;
  url: string;
  type: DocumentType;
  board?: BoardName;
  date?: string;
  checksum?: string;
  sourceModifiedAt?: string; // Last-Modified or ETag from the server
}

// ─── Main scraper entry point ──────────────────────────────────────────────

export async function discoverDocuments(): Promise<DiscoveredDocument[]> {
  const discovered: DiscoveredDocument[] = [];

  console.log("🔍 Scraping Schertz government documents...");

  // 1. Deep crawl of CivicPlus DocumentCenter via internal JSON API
  try {
    const dcDocs = await scrapeDocumentCenter();
    discovered.push(...dcDocs);
    console.log(`  ✓ DocumentCenter: ${dcDocs.length} documents found`);
  } catch (err) {
    console.warn(`  ⚠ DocumentCenter: ${(err as Error).message}`);
  }

  // 2. Budget & Finance sub-pages not covered by DocumentCenter
  try {
    const financeDocs = await scrapeFinanceSubpages();
    discovered.push(...financeDocs);
    console.log(`  ✓ Finance sub-pages: ${financeDocs.length} documents found`);
  } catch (err) {
    console.warn(`  ⚠ Finance sub-pages: ${(err as Error).message}`);
  }

  // 3. Public Notices
  try {
    const notices = await scrapePublicNotices();
    discovered.push(...notices);
    console.log(`  ✓ Public Notices: ${notices.length} found`);
  } catch (err) {
    console.warn(`  ⚠ Public Notices: ${(err as Error).message}`);
  }

  // 4. Laserfiche WebLink — board agendas, minutes, ordinances, resolutions
  try {
    console.log("  Crawling Laserfiche public records archive...");
    const lfDocs = await discoverLaserficheDocs();
    discovered.push(...lfDocs);
    console.log(`  ✓ Laserfiche: ${lfDocs.length} documents found`);
    if (lfDocs.length === 0) {
      console.warn("  ⚠ Laserfiche returned 0 docs — session handshake may have failed. Check network connectivity to laserfiche.schertzweb.com");
    }
  } catch (err) {
    console.error(`  ✗ Laserfiche FAILED: ${(err as Error).message}`);
    console.error("    This accounts for ~6,800 missing documents. Check Railway outbound network access.");
  }

  console.log(`\n📋 Total documents discovered: ${discovered.length}`);
  return discovered;
}

// ─── CivicPlus DocumentCenter scraper ────────────────────────────────────
//
// Two internal APIs (discovered by network inspection):
//   Folder tree:  POST /admin/DocumentCenter/Home/_AjaxLoadingReact?type=0
//   Document list: POST /Admin/DocumentCenter/Home/Document_AjaxBinding?renderMode=0&loadSource=7
//
// Civic-relevant root folder IDs (from the type=0 response for root folder 1):
//   Boards & Commissions: 34   City Council: 206   City Secretary: 41
//   Budget & Finance: 36       Government: 98      Public Information: 65
//   Engineering: 117           Planning: 142       Police: 49
//   Fire: 44                   EMS: 42             Parks & Recreation: 27

const DC_CIVIC_FOLDERS: Array<{ id: number; name: string; type: DocumentType; board?: BoardName }> = [
  { id: 36,  name: "Budget & Finance",       type: "budget" },
  { id: 34,  name: "Boards & Commissions",   type: "agenda" },
  { id: 206, name: "City Council",           type: "agenda",          board: "city-council" },
  { id: 41,  name: "City Secretary",         type: "public-notice" },
  { id: 98,  name: "Government",             type: "charter" },
  { id: 65,  name: "Public Information",     type: "public-notice" },
  { id: 142, name: "Planning",               type: "agenda",          board: "planning-zoning" },
  { id: 27,  name: "Parks & Recreation",     type: "agenda",          board: "parks-recreation" },
  { id: 44,  name: "Fire",                   type: "financial-report" },
  { id: 42,  name: "EMS",                    type: "financial-report" },
  { id: 49,  name: "Police",                 type: "financial-report" },
];

const ALLOWED_FILE_TYPES = new Set(["pdf", "doc", "docx", "txt", "xlsx"]);

interface DcFolder { Text: string; Value: string; LoadOnDemand: boolean; ParentID: string }
interface DcDocument { ID: number; DisplayName: string; FileType: string; URL: string; LastModifiedDateString: string }

async function dcFolderTree(folderId: number): Promise<DcFolder[]> {
  const { data } = await axios.post<{ Data: DcFolder[] }>(
    `${BASE_URL}/admin/DocumentCenter/Home/_AjaxLoadingReact?type=0`,
    { value: String(folderId), expandTree: false, loadSource: 7, selectedFolder: folderId },
    { headers: { "Content-Type": "application/json", "Referer": `${BASE_URL}/DocumentCenter` }, timeout: 15000 }
  );
  return data.Data ?? [];
}

async function dcDocuments(folderId: number, page = 1): Promise<{ docs: DcDocument[]; total: number }> {
  const { data } = await axios.post<{ Documents: DcDocument[]; TotalCount: number }>(
    `${BASE_URL}/Admin/DocumentCenter/Home/Document_AjaxBinding?renderMode=0&loadSource=7`,
    { folderId, getDocuments: 1, imageRepo: false, renderMode: 0, loadSource: 7,
      requestingModuleID: 75, searchString: "", pageNumber: page, rowsPerPage: 100,
      sortColumn: "DisplayName", sortOrder: 0 },
    { headers: { "Content-Type": "application/json", "Referer": `${BASE_URL}/DocumentCenter` }, timeout: 15000 }
  );
  return { docs: data.Documents ?? [], total: data.TotalCount ?? 0 };
}

async function crawlDcFolder(
  folderId: number,
  folderName: string,
  defaultType: DocumentType,
  defaultBoard: BoardName | undefined,
  depth: number,
  results: DiscoveredDocument[]
): Promise<void> {
  if (depth > 4) return;

  // Get subfolders
  const subfolders = await dcFolderTree(folderId);
  for (const sub of subfolders) {
    await crawlDcFolder(
      parseInt(sub.Value),
      sub.Text,
      defaultType,
      defaultBoard,
      depth + 1,
      results
    );
  }

  // Get documents with pagination
  let page = 1;
  let fetched = 0;
  let total = Infinity;

  while (fetched < total) {
    const { docs, total: t } = await dcDocuments(folderId, page);
    total = t;
    for (const doc of docs) {
      const ext = (doc.FileType ?? "").toLowerCase();
      if (!ALLOWED_FILE_TYPES.has(ext)) continue;
      const docId = String(doc.ID);
      if (SKIP_DOC_IDS.has(docId)) continue;

      const url = doc.URL.startsWith("http") ? doc.URL : `${BASE_URL}${doc.URL}`;
      const type = inferDocType(doc.DisplayName, folderName) ?? defaultType;
      const date = extractDateFromString(doc.LastModifiedDateString) ?? extractYearFromTitle(doc.DisplayName);

      results.push({ title: doc.DisplayName, url, type, board: defaultBoard, date });
    }
    fetched += docs.length;
    if (docs.length < 100) break;
    page++;
  }
}

async function scrapeDocumentCenter(): Promise<DiscoveredDocument[]> {
  const results: DiscoveredDocument[] = [];
  for (const folder of DC_CIVIC_FOLDERS) {
    try {
      const before = results.length;
      await crawlDcFolder(folder.id, folder.name, folder.type, folder.board, 0, results);
      console.log(`    DC/${folder.name}: ${results.length - before} docs`);
    } catch (err) {
      console.warn(`    DC/${folder.name}: ${(err as Error).message}`);
    }
  }
  return results;
}

// ─── Finance sub-page scrapers ─────────────────────────────────────────────
// These pages embed DocumentCenter links not covered by folder crawls.

const FINANCE_SUBPAGES: Array<{ url: string; type: DocumentType }> = [
  { url: `${BASE_URL}/250/Financial-Transparency`, type: "financial-report" },
  { url: `${BASE_URL}/249/Debt-Obligations`,        type: "financial-report" },
  { url: `${BASE_URL}/247/City-Pension`,            type: "financial-report" },
  { url: `${BASE_URL}/248/Texas-Municipal-Retirement-System`, type: "financial-report" },
  { url: `${BASE_URL}/251/Budget-Finance`,          type: "budget" },
  { url: `${BASE_URL}/2125/Public-Notices`,         type: "public-notice" },
];

async function scrapeFinanceSubpages(): Promise<DiscoveredDocument[]> {
  const results: DiscoveredDocument[] = [];
  const seen = new Set<string>();

  for (const { url: pageUrl, type } of FINANCE_SUBPAGES) {
    try {
      const { data: html } = await axios.get(pageUrl, { timeout: 15000 });
      const $ = cheerio.load(html);

      $('a[href*="DocumentCenter/View"]').each((_i, el) => {
        const href = $(el).attr("href") ?? "";
        const title = $(el).text().trim();
        if (!title || title.length < 4) return;

        // Extract doc ID and skip known non-civic docs
        const idMatch = href.match(/\/View\/(\d+)/);
        if (!idMatch || SKIP_DOC_IDS.has(idMatch[1])) return;

        const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        results.push({
          title,
          url: fullUrl,
          type: inferDocType(title, "") ?? type,
          date: extractYearFromTitle(title),
        });
      });
    } catch (err) {
      console.warn(`    subpage ${pageUrl}: ${(err as Error).message}`);
    }
  }
  return results;
}

// ─── Public notices scraper ────────────────────────────────────────────────

async function scrapePublicNotices(): Promise<DiscoveredDocument[]> {
  const { data: html } = await axios.get(`${BASE_URL}/CivicAlerts.aspx`, { timeout: 15000 });
  const $ = cheerio.load(html);
  const docs: DiscoveredDocument[] = [];
  const today = new Date().toISOString().split("T")[0];

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

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024; // 25 MB — matches pdf-parser limit

export async function downloadDocument(doc: DiscoveredDocument): Promise<string | null> {
  try {
    const dir = path.join(RAW_SOURCES_PATH, doc.type, doc.board ?? "general");
    fs.mkdirSync(dir, { recursive: true });

    const HEADERS = {
      "User-Agent": "CivicSecondBrain/1.0 (City Council Research Tool; contact@schertz.com)",
      "Accept": "application/pdf,*/*",
    };

    // HEAD request first to check Content-Length before downloading
    try {
      const head = await axios.head(doc.url, { timeout: 10000, maxRedirects: 5, headers: HEADERS });
      const contentLength = parseInt((head.headers["content-length"] as string) ?? "0", 10);
      if (contentLength > MAX_DOWNLOAD_BYTES) {
        console.warn(`  ⚠ Skipping oversized file (${Math.round(contentLength / 1024 / 1024)}MB): ${doc.title}`);
        return null;
      }
    } catch {
      // HEAD not supported by server — proceed and check size after download
    }

    const response = await axios.get(doc.url, {
      responseType: "arraybuffer",
      timeout: 60000,
      maxRedirects: 5,
      headers: HEADERS,
    });

    // Double-check size after download in case HEAD wasn't available
    if (response.data.byteLength > MAX_DOWNLOAD_BYTES) {
      console.warn(`  ⚠ Skipping oversized file (${Math.round(response.data.byteLength / 1024 / 1024)}MB): ${doc.title}`);
      return null;
    }

    const contentType: string = (response.headers["content-type"] as string) ?? "";
    const ext = contentTypeToExt(contentType) ?? getExtension(doc.url);
    const filename = sanitizeFilename(doc.title) + ext;
    const localPath = path.join(dir, filename);

    // Capture server's change signal for manifest (used to detect updates on future runs)
    const serverModified =
      (response.headers["last-modified"] as string) ??
      (response.headers["etag"] as string) ??
      "";
    doc.sourceModifiedAt = serverModified || doc.sourceModifiedAt;

    // Compute checksum of downloaded content
    const checksum = crypto.createHash("md5").update(response.data as Buffer).digest("hex");
    doc.checksum = checksum;

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
  if (contentType.includes("application/vnd.openxmlformats") || contentType.includes("spreadsheetml")) return ".xlsx";
  if (contentType.includes("msword") || contentType.includes("wordprocessingml")) return ".docx";
  if (contentType.includes("text/html")) return ".html";
  if (contentType.includes("text/plain")) return ".txt";
  return null;
}

// ─── Build a CivicDocument manifest entry ─────────────────────────────────

export function toCivicDocument(doc: DiscoveredDocument, localPath: string, id: string): CivicDocument {
  return {
    id,
    title: doc.title,
    type: doc.type,
    board: doc.board,
    date: doc.date ?? new Date().toISOString().split("T")[0],
    sourceUrl: doc.url,
    localPath,
    checksum: doc.checksum,
    sourceModifiedAt: doc.sourceModifiedAt,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9\s-]/gi, "").replace(/\s+/g, "-").toLowerCase().slice(0, 120);
}

function getExtension(url: string): string {
  if (url.includes(".pdf")) return ".pdf";
  if (url.includes(".xlsx") || url.includes(".xls")) return ".xlsx";
  if (url.includes(".docx") || url.includes(".doc")) return ".docx";
  return ".html";
}

function inferDocType(title: string, folderName: string): DocumentType | undefined {
  const t = `${title} ${folderName}`.toLowerCase();
  if (t.includes("budget") || t.includes("cip") || t.includes("capital improvement")) return "budget";
  if (t.includes("ordinance")) return "ordinance";
  if (t.includes("charter")) return "charter";
  if (t.includes("financial") || t.includes("audit") || t.includes("acfr") || t.includes("cafr")) return "financial-report";
  if (t.includes("strategic") || t.includes("master plan")) return "strategic-plan";
  if (t.includes("state of the city")) return "state-of-city";
  if (t.includes("minutes")) return "meeting-minutes";
  if (t.includes("agenda")) return "agenda";
  if (t.includes("notice") || t.includes("hearing")) return "public-notice";
  if (t.includes("resolution")) return "resolution";
  if (t.includes("tax rate") || t.includes("tax rate")) return "financial-report";
  return undefined;
}

function extractYearFromTitle(title: string): string {
  const match = title.match(/20\d{2}/);
  return match ? `${match[0]}-01-01` : new Date().toISOString().split("T")[0];
}

function extractDateFromString(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return undefined;
}
