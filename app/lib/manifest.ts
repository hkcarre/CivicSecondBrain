/**
 * manifest.ts — shared manifest read/write helpers
 *
 * Provides checksum-based dedup: if a document URL has already been ingested
 * AND its file checksum hasn't changed, re-ingestion is skipped.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { CivicDocument } from "@/types";

const MANIFEST_PATH =
  process.env.MANIFEST_PATH ?? "./raw-sources/manifest.json";

export type ManifestEntry = CivicDocument & {
  ingestedAt?: string;
  checksum?: string;
};

export type Manifest = Record<string, ManifestEntry>;

// ─── Load & save ──────────────────────────────────────────────────────────

export function loadManifest(): Manifest {
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as Manifest;
    } catch {
      return {};
    }
  }
  return {};
}

export function saveManifest(manifest: Manifest): void {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
}

// ─── ID generation ────────────────────────────────────────────────────────

export function docId(url: string): string {
  return crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
}

// ─── Checksum helpers ─────────────────────────────────────────────────────

export function fileChecksum(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(buf).digest("hex");
}

/**
 * Returns true when the document needs (re-)ingestion.
 * Skips if already ingested AND file checksum unchanged.
 */
export function needsIngestion(
  manifest: Manifest,
  url: string,
  localPath?: string
): boolean {
  const id = docId(url);
  const entry = manifest[id];

  if (!entry?.ingestedAt) return true; // never ingested

  if (localPath && fs.existsSync(localPath) && entry.checksum) {
    const current = fileChecksum(localPath);
    return current !== entry.checksum; // re-ingest only if file changed
  }

  return false; // ingested, no file to compare → skip
}

export function markIngested(
  manifest: Manifest,
  id: string,
  doc: ManifestEntry,
  localPath?: string
): void {
  const checksum =
    localPath && fs.existsSync(localPath) ? fileChecksum(localPath) : undefined;

  manifest[id] = {
    ...doc,
    ingestedAt: new Date().toISOString(),
    ...(checksum ? { checksum } : {}),
  };
}
