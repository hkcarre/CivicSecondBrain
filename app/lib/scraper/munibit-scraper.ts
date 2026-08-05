/**
 * Munibit CMS Government Document Scraper (Von Ormy, TX and future cities
 * on this platform).
 *
 * Munibit renders document lists two different ways, confirmed by manual
 * inspection of vonormytx.gov's raw HTML (not the JS-executed DOM):
 *
 *  - File/document module pages (e.g. City Finances): fully server-rendered.
 *    Every document is a `<div class="fileDiv">` with `data-fn` (filename),
 *    `data-url` (the /api/blob/viewBlob download link), and `data-rid`
 *    already present in the HTML response — no JS execution needed.
 *  - "Resources" module pages (confirmed: Agendas & Minutes, Ordinances):
 *    the document list is populated by client-side JS after load; nothing
 *    is present in the static HTML. Not scrapable with axios+cheerio — out
 *    of scope for now (would need a headless browser or the reverse-
 *    engineered AJAX call keyed on the section's data-rid).
 *
 * MUNIBIT_URL — site root, e.g. https://vonormytx.gov. If unset, this
 * scraper returns an empty array (skipped gracefully), same convention as
 * municode-scraper.ts and laserfiche-scraper.ts.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import type { DiscoveredDocument } from "./schertz-scraper";
import type { DocumentType, BoardName } from "@/types";

const MUNIBIT_URL = process.env.MUNIBIT_URL ?? "";

const HEADERS = {
  "User-Agent": "Strata Civic Solutions/1.0 (City Council Research Tool)",
  Accept: "text/html",
};

// Page slugs confirmed (by manual inspection) to render their document list
// server-side via the fileDiv module, rather than via client-side JS.
// Every other nav page was checked and found to have zero fileDiv elements.
const MUNIBIT_PAGES: Array<{ slug: string; type: DocumentType; board?: BoardName }> = [
  { slug: "cityfinances", type: "budget" },
  { slug: "meetingschedule", type: "agenda" },
  { slug: "zoning", type: "public-notice" },
  { slug: "municipalcourt", type: "public-notice" },
  { slug: "citybuildings", type: "public-notice" },
];

export async function discoverMunibitDocs(): Promise<DiscoveredDocument[]> {
  if (!MUNIBIT_URL) {
    console.log("[munibit] MUNIBIT_URL not set — skipping Munibit scrape.");
    return [];
  }

  const results: DiscoveredDocument[] = [];
  const seen = new Set<string>();

  for (const page of MUNIBIT_PAGES) {
    try {
      const { data: html } = await axios.get(`${MUNIBIT_URL}/${page.slug}`, {
        headers: HEADERS,
        timeout: 15000,
      });
      const $ = cheerio.load(html);

      $("div.fileDiv").each((_i, el) => {
        const $el = $(el);
        const filename = $el.attr("data-fn")?.trim();
        const url = $el.attr("data-url");
        if (!filename || !url) return;

        const fullUrl = url.startsWith("http") ? url : `${MUNIBIT_URL}${url}`;
        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        results.push({
          title: filename.replace(/\.(pdf|docx?|xlsx?)$/i, ""),
          url: fullUrl,
          type: inferDocType(filename) ?? page.type,
          board: page.board,
          date: extractYearFromTitle(filename),
          refererUrl: `${MUNIBIT_URL}/${page.slug}`,
        });
      });
    } catch (err) {
      console.warn(`    Munibit/${page.slug}: ${(err as Error).message}`);
    }
  }
  return results;
}

function inferDocType(title: string): DocumentType | undefined {
  const t = title.toLowerCase();
  if (t.includes("budget")) return "budget";
  if (t.includes("audit") || t.includes("financial statement")) return "financial-report";
  if (t.includes("ordinance")) return "ordinance";
  if (t.includes("resolution")) return "resolution";
  if (t.includes("tax rate") || t.includes("notice")) return "public-notice";
  if (t.includes("minutes")) return "meeting-minutes";
  if (t.includes("agenda")) return "agenda";
  return undefined;
}

function extractYearFromTitle(title: string): string {
  const match = title.match(/20\d{2}/);
  return match ? `${match[0]}-01-01` : new Date().toISOString().split("T")[0];
}
