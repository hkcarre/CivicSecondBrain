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
  schedule: {
    nextIngest: string;   // human-readable
    nextLint: string;     // human-readable
    ingestCron: string;
    lintCron: string;
  };
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

  // Schedule info (mirrors railway.toml [[cron]] entries)
  const INGEST_CRON = "0 8 * * *";   // nightly 2am CT
  const LINT_CRON   = "0 9 * * 0";   // Sunday 3am CT

  function nextCronRun(cron: string): string {
    // Simple: parse hour/dow and compute next occurrence from now (UTC)
    const [, hour, , , dow] = cron.split(" ");
    const now = new Date();
    const next = new Date(now);
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(parseInt(hour));
    if (dow === "*") {
      // daily — advance to tomorrow if today's run has passed
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    } else {
      // weekly — advance to next matching day-of-week
      const targetDow = parseInt(dow); // 0=Sun
      let daysAhead = (targetDow - now.getUTCDay() + 7) % 7;
      if (daysAhead === 0 && next <= now) daysAhead = 7;
      next.setUTCDate(next.getUTCDate() + daysAhead);
    }
    return next.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });
  }

  return {
    manifest,
    wikiStats: {
      pagesTotal: index.length,
      lastIngest: ingestDates.at(-1) ?? null,
      lastLint: lintDates.at(-1) ?? null,
    },
    logSummary,
    schedule: {
      nextIngest: nextCronRun(INGEST_CRON),
      nextLint:   nextCronRun(LINT_CRON),
      ingestCron: INGEST_CRON,
      lintCron:   LINT_CRON,
    },
  };
}
