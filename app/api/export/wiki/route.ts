/**
 * GET /api/export/wiki
 *
 * Exports the entire wiki knowledge base for offline use / council packets.
 *
 * Query params:
 *   format=md   (default) — single concatenated Markdown document
 *   format=zip  — ZIP archive of all individual wiki .md files
 *
 * No new dependencies: ZIP is built with Node.js built-in zlib (DEFLATE).
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import zlib from "zlib";
import { promisify } from "util";

export const runtime = "nodejs";

const WIKI_PATH = process.env.WIKI_PATH ?? "./wiki";
const deflateRaw = promisify(zlib.deflateRaw);

// ─── Collect wiki pages ───────────────────────────────────────────────────

interface WikiFile {
  relPath: string; // relative to WIKI_PATH, e.g. "topics/budget.md"
  content: string; // raw file content
  title: string;
  category: string;
}

function collectWikiFiles(): WikiFile[] {
  const files: WikiFile[] = [];

  function walk(dir: string, base: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.join(base, entry.name);
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.name.endsWith(".md")) {
        const raw = fs.readFileSync(full, "utf-8");
        let title = path.basename(entry.name, ".md");
        let category = "wiki";
        try {
          const parsed = matter(raw);
          if (parsed.data.title) title = String(parsed.data.title);
          if (parsed.data.category) category = String(parsed.data.category);
        } catch {
          // malformed frontmatter — use filename
        }
        files.push({ relPath: rel, content: raw, title, category });
      }
    }
  }

  walk(WIKI_PATH, "");
  return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

// ─── Markdown export ──────────────────────────────────────────────────────

function buildMarkdownExport(files: WikiFile[]): string {
  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "long",
    timeStyle: "short",
  });

  const lines: string[] = [
    "# CivicSecondBrain — Full Wiki Export",
    "",
    `> Generated: ${now} CT`,
    `> Total pages: ${files.length}`,
    "",
    "---",
    "",
  ];

  // Group by category
  const groups = new Map<string, WikiFile[]>();
  for (const f of files) {
    const group = groups.get(f.category) ?? [];
    group.push(f);
    groups.set(f.category, group);
  }

  const ORDER = ["topic", "decision", "recommendation", "query", "wiki"];
  const sorted = [
    ...ORDER.filter((c) => groups.has(c)).map((c) => [c, groups.get(c)!] as const),
    ...[...groups.entries()].filter(([c]) => !ORDER.includes(c)),
  ];

  for (const [category, categoryFiles] of sorted) {
    lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}s`);
    lines.push("");
    for (const f of categoryFiles) {
      lines.push(`### ${f.title}`);
      lines.push(`*Source: \`${f.relPath}\`*`);
      lines.push("");
      // Strip frontmatter before appending
      try {
        lines.push(matter(f.content).content.trim());
      } catch {
        lines.push(f.content.trim());
      }
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ─── ZIP export (no external deps) ───────────────────────────────────────
//
// Implements a minimal ZIP file using the PKZIP spec:
//   - Each file: local file header + compressed data
//   - Central directory at the end
//   - End-of-central-directory record
//
// Uses DEFLATE (via Node zlib.deflateRaw) for compression.

function u16le(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}
function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

// CRC-32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function buildZip(files: WikiFile[]): Promise<Buffer> {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  const dosDate = (() => {
    const d = new Date();
    return (
      (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) << 16 |
      ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1))
    );
  })();

  for (const f of files) {
    const name = Buffer.from(f.relPath, "utf-8");
    const uncompressed = Buffer.from(f.content, "utf-8");
    const compressed = await deflateRaw(uncompressed);
    const crc = crc32(uncompressed);

    // Local file header (signature 0x04034b50)
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      u16le(20),           // version needed: 2.0
      u16le(0x800),        // flags: UTF-8
      u16le(8),            // compression: DEFLATE
      u32le(dosDate),      // mod date/time
      u32le(crc),
      u32le(compressed.length),
      u32le(uncompressed.length),
      u16le(name.length),
      u16le(0),            // extra field length
      name,
      compressed,
    ]);
    localHeaders.push(local);

    // Central directory header (signature 0x02014b50)
    const central = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
      u16le(20),           // version made by
      u16le(20),           // version needed
      u16le(0x800),        // flags: UTF-8
      u16le(8),            // compression: DEFLATE
      u32le(dosDate),
      u32le(crc),
      u32le(compressed.length),
      u32le(uncompressed.length),
      u16le(name.length),
      u16le(0),            // extra field length
      u16le(0),            // file comment length
      u16le(0),            // disk number start
      u16le(0),            // internal attrs
      u32le(0),            // external attrs
      u32le(offset),       // relative offset of local header
      name,
    ]);
    centralHeaders.push(central);
    offset += local.length;
  }

  const cdOffset = offset;
  const cdSize = centralHeaders.reduce((s, b) => s + b.length, 0);

  // End of central directory (signature 0x06054b50)
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]), // signature
    u16le(0), u16le(0),   // disk numbers
    u16le(files.length),  // entries on disk
    u16le(files.length),  // total entries
    u32le(cdSize),
    u32le(cdOffset),
    u16le(0),             // comment length
  ]);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

// ─── Route handler ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "md";

  const files = collectWikiFiles();

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Wiki is empty — run an ingestion first." },
      { status: 404 }
    );
  }

  if (format === "zip") {
    const zip = await buildZip(files);
    const filename = `civic-wiki-${new Date().toISOString().split("T")[0]}.zip`;
    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: concatenated markdown
  const markdown = buildMarkdownExport(files);
  const filename = `civic-wiki-${new Date().toISOString().split("T")[0]}.md`;
  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
