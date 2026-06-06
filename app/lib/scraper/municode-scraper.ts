/**
 * MuniCode Ordinance Scraper
 *
 * Scrapes city ordinance code from library.municode.com using their
 * public Content Delivery API.
 *
 * API surface (reverse-engineered from the MuniCode Angular SPA):
 *
 *   Table of Contents:
 *     GET https://library.municode.com/api/content/{state}/{slug}
 *     Returns: { id, name, codesId, children: [...] }
 *
 *   Chapter content (HTML):
 *     GET https://library.municode.com/media/Latest/{codesId}/html/{nodeId}.htm
 *     Returns: HTML page with ordinance section text
 *
 * Both endpoints are public (no auth required for viewing).
 *
 * Configuration:
 *   MUNICODE_URL   — full URL e.g. https://library.municode.com/tx/schertz
 *   SCHERTZ_MUNICODE_URL — backward-compat alias
 *
 * If MUNICODE_URL is not set, the scraper returns an empty array (skipped
 * gracefully so the main ingest pipeline continues with other sources).
 */

import axios from "axios";
import * as cheerio from "cheerio";
import type { DiscoveredDocument } from "./schertz-scraper";

// ─── Config ───────────────────────────────────────────────────────────────

const MUNICODE_URL =
  process.env.MUNICODE_URL ??
  process.env.SCHERTZ_MUNICODE_URL ??
  "";

const BASE_API = "https://library.municode.com";
const MAX_SECTIONS = 200; // cap to avoid runaway crawls

const HEADERS = {
  "User-Agent": "CivicSecondBrain/1.0 (City Council Research Tool)",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// ─── Types ────────────────────────────────────────────────────────────────

interface MuniTocNode {
  id: string;
  name: string;
  codesId?: number;
  children?: MuniTocNode[];
  /** Nodes with typeId=1 are leaf sections with actual text content */
  typeId?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Parse the city slug and state from a MuniCode URL.
 * e.g. "https://library.municode.com/tx/schertz" → { state: "tx", slug: "schertz" }
 */
export function parseMunicodeUrl(url: string): { state: string; slug: string } | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) return null;
    return { state: parts[0], slug: parts[1] };
  } catch {
    return null;
  }
}

/**
 * Fetch the MuniCode table of contents for a city.
 */
export async function fetchMunicodeToc(state: string, slug: string): Promise<MuniTocNode | null> {
  try {
    const res = await axios.get<MuniTocNode>(
      `${BASE_API}/api/content/${state}/${slug}`,
      { headers: HEADERS, timeout: 15_000 }
    );
    return res.data;
  } catch (err) {
    console.warn(`[municode] Failed to fetch TOC for ${state}/${slug}:`, (err as Error).message);
    return null;
  }
}

/**
 * Recursively collect all leaf section nodes from the TOC tree.
 * A leaf is a node with typeId === 1 (section with actual text).
 */
export function collectSections(node: MuniTocNode, codesId?: number): Array<{ id: string; name: string; codesId: number }> {
  const sections: Array<{ id: string; name: string; codesId: number }> = [];
  const resolvedCodesId = node.codesId ?? codesId;

  // typeId === 1 → leaf section with content
  if (node.typeId === 1 && resolvedCodesId) {
    sections.push({ id: node.id, name: node.name, codesId: resolvedCodesId });
  }

  for (const child of node.children ?? []) {
    sections.push(...collectSections(child, resolvedCodesId));
  }

  return sections;
}

/**
 * Fetch a single section's HTML content and strip to plain text.
 */
export async function fetchSectionText(codesId: number, nodeId: string): Promise<string> {
  const url = `${BASE_API}/media/Latest/${codesId}/html/${nodeId}.htm`;
  const res = await axios.get<string>(url, {
    headers: { ...HEADERS, Accept: "text/html" },
    timeout: 10_000,
  });
  const $ = cheerio.load(res.data);
  // Remove navigation, headers, and other chrome
  $("nav, header, footer, script, style, .breadcrumb, #header, #footer").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

// ─── Main scraper entry point ─────────────────────────────────────────────

/**
 * Discover MuniCode ordinance sections and return them as DiscoveredDocument
 * objects that the main ingest pipeline can process.
 *
 * Returns an empty array (gracefully) if MUNICODE_URL is not configured.
 */
export async function discoverMunicodeDocs(): Promise<DiscoveredDocument[]> {
  if (!MUNICODE_URL) {
    console.log("[municode] MUNICODE_URL not set — skipping MuniCode scrape.");
    return [];
  }

  const parsed = parseMunicodeUrl(MUNICODE_URL);
  if (!parsed) {
    console.warn(`[municode] Could not parse MUNICODE_URL: ${MUNICODE_URL}`);
    return [];
  }

  const { state, slug } = parsed;
  console.log(`[municode] Fetching TOC for ${state}/${slug}...`);

  const toc = await fetchMunicodeToc(state, slug);
  if (!toc) return [];

  const codesId = toc.codesId;
  if (!codesId) {
    console.warn("[municode] TOC response missing codesId — cannot build section URLs.");
    return [];
  }

  const sections = collectSections(toc, codesId).slice(0, MAX_SECTIONS);
  console.log(`[municode] Found ${sections.length} sections (capped at ${MAX_SECTIONS}).`);

  const docs: DiscoveredDocument[] = sections.map((s) => ({
    title: s.name,
    url: `${BASE_API}/media/Latest/${s.codesId}/html/${s.id}.htm`,
    type: "ordinance" as const,
    date: new Date().toISOString().split("T")[0], // MuniCode doesn't expose dates per section
  }));

  return docs;
}
