import fs from "fs";
import path from "path";
import { readWikiIndex, readRecentLog } from "./reader";
import type { CivicDocument } from "@/types";

const MANIFEST_PATH = "./raw-sources/manifest.json";
const WIKI_PATH = process.env.WIKI_PATH ?? "./wiki";

export interface AdminData {
  manifest: CivicDocument[];
  wikiStats: {
    pagesTotal: number;
    lastIngest: string | null;
    lastLint: string | null;
  };
  logSummary: string;
}

export async function getAdminData(): Promise<AdminData> {
  // Load manifest
  let manifest: CivicDocument[] = [];
  if (fs.existsSync(MANIFEST_PATH)) {
    const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    manifest = Object.values(raw) as CivicDocument[];
  }

  // Wiki stats
  const index = readWikiIndex();
  const logRaw = fs.existsSync(path.join(WIKI_PATH, "log.md"))
    ? fs.readFileSync(path.join(WIKI_PATH, "log.md"), "utf-8")
    : "";

  const ingestDates = [...logRaw.matchAll(/^## \[(\d{4}-\d{2}-\d{2})\] INGEST/gm)].map(
    (m) => m[1]
  );
  const lintDates = [...logRaw.matchAll(/^## \[(\d{4}-\d{2}-\d{2})\] LINT/gm)].map(
    (m) => m[1]
  );

  const logSummary = readRecentLog(8);

  return {
    manifest,
    wikiStats: {
      pagesTotal: index.length,
      lastIngest: ingestDates.at(-1) ?? null,
      lastLint: lintDates.at(-1) ?? null,
    },
    logSummary,
  };
}
