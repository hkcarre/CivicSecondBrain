/**
 * Laserfiche WebLink scraper for Schertz, TX public records.
 *
 * Discovered via network inspection of the Angular SPA at:
 *   https://laserfiche.schertzweb.com/WebLink/Browse.aspx?id=25548&dbid=1&repo=SCHERTZ
 *
 * API: POST /WebLink/FolderListingService.aspx/GetFolderListing2
 *   Body: { repoName, folderId, getNewListing, start, end, sortColumn, sortAscending }
 *   Response: { data: { results: [{ entryId, name, type, isEdoc, extension, ... }] } }
 *   type=1 → folder, type=2 → document (isEdoc=true for electronic files)
 *
 * Download: GET /WebLink/ElectronicFile.aspx?id={entryId}&dbid=1&repo=SCHERTZ
 */

import axios from "axios";
import type { AxiosInstance } from "axios";
import type { DocumentType, BoardName } from "@/types";
import type { DiscoveredDocument } from "./schertz-scraper";
import { envWithDeprecatedFallback } from "@/lib/env";

// Laserfiche WebLink base URL — the host that serves /WebLink/Browse.aspx.
// Canonical env var: LASERFICHE_URL (e.g. https://laserfiche.schertzweb.com).
// SCHERTZ_LASERFICHE_URL is a deprecated alias — still honored, logs a
// one-time warning. Defaults to the Schertz instance.
const BASE_URL =
  envWithDeprecatedFallback("LASERFICHE_URL", "SCHERTZ_LASERFICHE_URL") ??
  "https://laserfiche.schertzweb.com";
const REPO = "SCHERTZ";
const DBID = 1;
const ROOT_FOLDER_ID = 25548;
const PAGE_SIZE = 100;
const MAX_DEPTH = 4;

// ─── Civic-relevant root folders ─────────────────────────────────────────
// Only crawl folders that contain documents useful for civic knowledge.
// Skipped: GIS maps, library periodicals, engineering, environmental health.

const CIVIC_FOLDERS: Array<{
  id: number;
  name: string;
  type: DocumentType;
  board?: BoardName;
}> = [
  { id: 54081,  name: "City Council",                          type: "agenda",          board: "city-council" },
  { id: 519554, name: "City Boards and Commissions",           type: "agenda" },
  { id: 55961,  name: "Finance Information",                   type: "financial-report" },
  { id: 105463, name: "Resolutions",                           type: "resolution" },
  { id: 25656,  name: "Ordinances",                            type: "ordinance" },
  { id: 120778, name: "Public Hearing and Public Notices",     type: "public-notice" },
  { id: 42792,  name: "Public Publications",                   type: "financial-report" },
  { id: 339015, name: "Election Information",                  type: "public-notice" },
  { id: 269532, name: "Charter Review Commission",             type: "charter" },
  { id: 154717, name: "Schertz Housing Authority",             type: "agenda" },
  { id: 173425, name: "Parks and Recreation Foundation",       type: "agenda",          board: "parks-recreation" },
];

// ─── Types ────────────────────────────────────────────────────────────────

interface LfEntry {
  entryId: number;
  name: string;
  type: number;       // 1=folder, 2=document
  isEdoc: boolean;
  extension: string;
  data: (string | number | null)[];
}

interface LfFolderResponse {
  data: {
    results: (LfEntry | null)[];
    totalEntries: number;
    failed: boolean;
    errMsg: string | null;
  };
}

// ─── Session management ───────────────────────────────────────────────────

async function createSession(): Promise<AxiosInstance> {
  const jar: Record<string, string> = {};

  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
    maxRedirects: 0, // handle manually so we can collect cookies at each hop
    headers: {
      "User-Agent": "CivicSecondBrain/1.0 (City Council Research Tool)",
      "x-lf-suppress-login-redirect": "1",
    },
    validateStatus: (s) => s < 500,
  });

  client.interceptors.request.use((config) => {
    const cookieStr = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookieStr) config.headers["Cookie"] = cookieStr;
    return config;
  });

  client.interceptors.response.use((response) => {
    for (const c of (response.headers["set-cookie"] ?? [])) {
      const match = c.match(/^([^=]+)=([^;]*)/);
      if (match) jar[match[1]] = match[2];
    }
    return response;
  });

  const resolve = (url: string) =>
    url.startsWith("http") ? url : `${BASE_URL}${url}`;

  // Step 1: GET Browse.aspx → 302 → CookieCheck (sets WebLinkSession)
  const r1 = await client.get(
    `/WebLink/Browse.aspx?id=${ROOT_FOLDER_ID}&dbid=${DBID}&repo=${REPO}`
  );

  // Step 2: GET CookieCheck → 302 → Browse.aspx?cr=1 (sets AcceptsCookies=1)
  const loc1 = r1.headers["location"] as string | undefined;
  if (loc1) {
    const r2 = await client.get(resolve(loc1));

    // Step 3: GET Browse.aspx?cr=1 → 200 (sets MachineTag — required for API calls)
    const loc2 = r2.headers["location"] as string | undefined;
    if (loc2) {
      await client.get(resolve(loc2));
    }
  }

  return client;
}

// ─── Folder listing ───────────────────────────────────────────────────────

async function getFolderListing(
  client: AxiosInstance,
  folderId: number,
  start = 0,
  end = PAGE_SIZE
): Promise<LfFolderResponse["data"] | null> {
  try {
    const response = await client.post<LfFolderResponse>(
      "/WebLink/FolderListingService.aspx/GetFolderListing2",
      { repoName: REPO, folderId, getNewListing: start === 0, start, end, sortColumn: "", sortAscending: true },
      {
        headers: {
          "Content-Type": "application/json",
          "Referer": `${BASE_URL}/WebLink/Browse.aspx?id=${ROOT_FOLDER_ID}&dbid=${DBID}&repo=${REPO}&cr=1`,
        },
      }
    );

    if (response.data?.data?.failed) return null;
    return response.data?.data ?? null;
  } catch {
    return null;
  }
}

// ─── Recursive folder crawler ─────────────────────────────────────────────

async function crawlFolder(
  client: AxiosInstance,
  folderId: number,
  folderName: string,
  defaultType: DocumentType,
  defaultBoard: BoardName | undefined,
  depth: number,
  results: DiscoveredDocument[]
): Promise<void> {
  if (depth > MAX_DEPTH) return;

  let start = 0;
  let totalEntries = Infinity;

  while (start < totalEntries) {
    const listing = await getFolderListing(client, folderId, start, start + PAGE_SIZE);
    if (!listing) break;

    totalEntries = listing.totalEntries;

    for (const entry of listing.results) {
      if (!entry) continue;

      const ext = (entry.extension ?? "").toLowerCase();
      // The API's explicit type field is authoritative when present
      // (1 = folder, 2 = document). The old isEdoc/extension heuristic
      // misclassified extensionless documents as folders — recursing into
      // them and silently dropping them from discovery (#261). The
      // heuristic remains only as a fallback for unrecognized type values.
      const isFolder =
        entry.type === 1 ||
        (entry.type !== 2 &&
          !entry.isEdoc &&
          !["pdf", "doc", "docx", "txt"].includes(ext));

      if (isFolder) {
        // Folder — recurse
        await crawlFolder(
          client,
          entry.entryId,
          entry.name,
          defaultType,
          defaultBoard,
          depth + 1,
          results
        );
      } else {
        // Document — skip non-text formats (images, GIS exports, etc.)
        if (ext && !["pdf", "doc", "docx", "txt", ""].includes(ext)) continue;

        const downloadUrl = `${BASE_URL}/WebLink/ElectronicFile.aspx?id=${entry.entryId}&dbid=${DBID}&repo=${REPO}`;
        const date = extractDateFromName(entry.name) ?? extractDateFromData(entry.data);
        const type = inferTypeFromName(entry.name, folderName) ?? defaultType;
        const board = inferBoardFromName(folderName) ?? defaultBoard;

        results.push({
          title: `${entry.name}`,
          url: downloadUrl,
          type,
          board,
          date,
        });
      }
    }

    start += PAGE_SIZE;
    if (listing.results.filter(Boolean).length < PAGE_SIZE) break;
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────

export async function discoverLaserficheDocs(): Promise<DiscoveredDocument[]> {
  const client = await createSession();
  const results: DiscoveredDocument[] = [];

  for (const folder of CIVIC_FOLDERS) {
    try {
      await crawlFolder(
        client,
        folder.id,
        folder.name,
        folder.type,
        folder.board,
        0,
        results
      );
      console.log(`  ✓ Laserfiche / ${folder.name}: ${results.length} docs so far`);
    } catch (err) {
      console.warn(`  ⚠ Laserfiche / ${folder.name}: ${(err as Error).message}`);
    }
  }

  return results;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

export function extractDateFromName(name: string): string | undefined {
  // "2024-01-10", "01/10/2024", "January 10 2024", "01-10-2024"
  const iso = name.match(/\b(20\d{2})[.\-\/](0[1-9]|1[0-2])[.\-\/](0[1-9]|[12]\d|3[01])\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const mdy = name.match(/\b(0?[1-9]|1[0-2])[.\-\/](0?[1-9]|[12]\d|3[01])[.\-\/](20\d{2})\b/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`;

  const year = name.match(/\b(20\d{2})\b/);
  if (year) return `${year[1]}-01-01`;

  return undefined;
}

export function extractDateFromData(data: (string | number | null)[]): string {
  // data[11] = CreationDate, data[12] = LastModified
  const raw = (data[11] ?? data[12]) as string | null;
  if (!raw) return new Date().toISOString().split("T")[0];
  try {
    return new Date(raw).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export function inferTypeFromName(name: string, folderName: string): DocumentType | undefined {
  const t = `${name} ${folderName}`.toLowerCase();
  if (t.includes("minute")) return "meeting-minutes";
  if (t.includes("agenda")) return "agenda";
  if (t.includes("ordinance")) return "ordinance";
  if (t.includes("resolution")) return "resolution";
  if (t.includes("budget") || t.includes("financial") || t.includes("audit")) return "financial-report";
  if (t.includes("charter")) return "charter";
  if (t.includes("notice") || t.includes("hearing")) return "public-notice";
  if (t.includes("strategic") || t.includes("plan")) return "strategic-plan";
  return undefined;
}

export function inferBoardFromName(folderName: string): BoardName | undefined {
  const n = folderName.toLowerCase();
  if (n.includes("city council") || n.includes("council")) return "city-council";
  if (n.includes("planning") || n.includes("zoning")) return "planning-zoning";
  if (n.includes("parks") || n.includes("recreation")) return "parks-recreation";
  if (n.includes("edc") || n.includes("economic")) return "edc";
  if (n.includes("housing authority")) return "housing-authority";
  if (n.includes("library")) return "library-advisory";
  if (n.includes("tirz")) return "tirz";
  return undefined;
}
