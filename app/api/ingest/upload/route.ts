import fs from "fs";
import path from "path";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { verifyIngestAccess } from "@/lib/auth";
import { ingestDocument } from "@/lib/claude/ingest-engine";
import { appendToLog } from "@/lib/wiki/writer";
import { inferManualDocumentType } from "@/lib/ingest/manual-ingest";
import type { CivicDocument, DocumentType, BoardName } from "@/types";

export const runtime = "nodejs";

const ACCEPTED_EXTENSIONS = new Set([".pdf", ".html", ".htm", ".txt", ".docx", ".doc", ".xlsx", ".xls"]);

function docId(key: string): string {
  return crypto.createHash("md5").update(key).digest("hex").slice(0, 12);
}

function stemFromFilename(filename: string): string {
  return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, " ").trim();
}

export async function POST(req: Request) {
  if (!(await verifyIngestAccess(req))) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const maxMb = parseInt(process.env.MAX_FILE_SIZE_MB ?? "25");
  const rawSourcesPath = process.env.RAW_SOURCES_PATH ?? "./raw-sources";

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ success: false, message: "Invalid multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ success: false, message: "No file provided." }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.has(ext)) {
    return Response.json(
      { success: false, message: `Unsupported file type "${ext}". Accepted: ${[...ACCEPTED_EXTENSIONS].join(", ")}` },
      { status: 400 }
    );
  }

  const bytes = file.size;
  if (bytes > maxMb * 1024 * 1024) {
    const sizeMb = (bytes / 1024 / 1024).toFixed(1);
    return Response.json(
      { success: false, message: `File too large (${sizeMb} MB). Maximum is ${maxMb} MB.` },
      { status: 413 }
    );
  }

  // Save to disk
  fs.mkdirSync(rawSourcesPath, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const localPath = path.join(rawSourcesPath, `${Date.now()}-${safeName}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(localPath, buffer);

  // Build CivicDocument
  const rawTitle = formData.get("title");
  const rawType = formData.get("type");
  const rawBoard = formData.get("board");
  const rawDate = formData.get("date");

  const title = typeof rawTitle === "string" && rawTitle.trim()
    ? rawTitle.trim()
    : stemFromFilename(file.name);

  const type = typeof rawType === "string" && rawType.trim()
    ? rawType.trim() as DocumentType
    : inferManualDocumentType(title);

  const board = typeof rawBoard === "string" && rawBoard.trim()
    ? rawBoard.trim() as BoardName
    : undefined;

  const date = typeof rawDate === "string" && rawDate.trim()
    ? rawDate.trim()
    : new Date().toISOString().split("T")[0];

  const sourceUrl = `local://${file.name}`;
  const id = docId(sourceUrl);

  const civicDoc: CivicDocument = {
    id,
    title,
    sourceUrl,
    localPath,
    type,
    ...(board ? { board } : {}),
    date,
  };

  try {
    const result = await ingestDocument(civicDoc);

    revalidatePath("/dashboard");


    appendToLog(`## [${date}] UPLOAD | ${title}
**File:** ${file.name} (${(bytes / 1024 / 1024).toFixed(1)} MB)
**Type:** ${type}${board ? ` | **Board:** ${board}` : ""}
**Pages updated:** ${result.pagesUpdated.length} | **Created:** ${result.pagesCreated.length}`);

    return Response.json({
      success: true,
      message: `"${title}" ingested. ${result.pagesCreated.length} page(s) created, ${result.pagesUpdated.length} updated.`,
      pagesUpdated: result.pagesUpdated,
      pagesCreated: result.pagesCreated,
    });
  } catch (err) {
    return Response.json(
      { success: false, message: `Ingest failed: ${(err as Error).message}` },
      { status: 500 }
    );
  } finally {
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
}
