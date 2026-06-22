import {
  downloadDocument,
  toCivicDocument,
  type DiscoveredDocument,
} from "@/lib/scraper/schertz-scraper";
import { ingestDocument } from "@/lib/claude/ingest-engine";
import {
  docId,
  loadManifest,
  markIngested,
  needsIngestion,
  saveManifest,
} from "@/lib/manifest";
import type { BoardName, CivicDocument, DocumentType } from "@/types";

const DOCUMENT_TYPES: readonly DocumentType[] = [
  "meeting-minutes",
  "agenda",
  "budget",
  "ordinance",
  "charter",
  "strategic-plan",
  "financial-report",
  "public-notice",
  "open-records",
  "state-of-city",
  "board-minutes",
  "resolution",
];

const BOARD_NAMES: readonly BoardName[] = [
  "city-council",
  "planning-zoning",
  "board-of-adjustment",
  "parks-recreation",
  "historical-preservation",
  "edc",
  "tsac",
  "library-advisory",
  "animal-services",
  "senior-center",
  "investment-advisory",
  "keep-city-beautiful",
  "keep-schertz-beautiful",
  "sslgc",
  "housing-authority",
  "tirz",
];

export interface ManualIngestInput {
  url: string;
  title?: string;
  type?: DocumentType;
  board?: BoardName;
  date?: string;
}

export interface ManualIngestResult {
  success: boolean;
  message: string;
  document?: CivicDocument;
  pagesUpdated: string[];
  pagesCreated: string[];
}

export class ManualIngestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualIngestValidationError";
  }
}

export class ManualIngestUnsupportedError extends Error {
  readonly result: ManualIngestResult;

  constructor(result: ManualIngestResult) {
    super(result.message);
    this.name = "ManualIngestUnsupportedError";
    this.result = result;
  }
}

export function parseManualIngestInput(body: unknown): ManualIngestInput {
  if (!isRecord(body)) {
    throw new ManualIngestValidationError("Request body must be a JSON object.");
  }

  if (typeof body.url !== "string" || body.url.trim() === "") {
    throw new ManualIngestValidationError("url is required.");
  }

  const url = normalizeHttpUrl(body.url);
  const title = optionalTrimmedString(body.title);
  const type = parseDocumentType(body.type, title ?? url);
  const board = parseBoardName(body.board);
  const date = parseManualDate(body.date);

  return {
    url,
    ...(title ? { title } : {}),
    type,
    ...(board ? { board } : {}),
    date,
  };
}

export async function ingestManualDocument(
  input: ManualIngestInput
): Promise<ManualIngestResult> {
  const manifest = loadManifest();
  const id = docId(input.url);
  const discovered: DiscoveredDocument = {
    title: input.title ?? titleFromUrl(input.url),
    url: input.url,
    type: input.type ?? inferManualDocumentType(input.title ?? input.url),
    ...(input.board ? { board: input.board } : {}),
    date: input.date ?? todayIsoDate(),
  };

  const localPath = await downloadDocument(discovered);
  if (!localPath) {
    return {
      success: false,
      message: "Document download failed.",
      pagesUpdated: [],
      pagesCreated: [],
    };
  }

  if (!needsIngestion(manifest, input.url, localPath)) {
    const document = manifest[id];
    return {
      success: true,
      message: "Document already ingested and unchanged.",
      ...(document ? { document } : {}),
      pagesUpdated: [],
      pagesCreated: [],
    };
  }

  const civicDoc = toCivicDocument(discovered, localPath, id);
  const result = await ingestDocument(civicDoc);

  if (result.skipped) {
    throw new ManualIngestUnsupportedError({
      success: false,
      message: "Unsupported document format.",
      document: civicDoc,
      pagesUpdated: result.pagesUpdated,
      pagesCreated: result.pagesCreated,
    });
  }

  markIngested(manifest, id, civicDoc, localPath);
  saveManifest(manifest);

  return {
    success: true,
    message: "Document ingested successfully.",
    document: result.document,
    pagesUpdated: result.pagesUpdated,
    pagesCreated: result.pagesCreated,
  };
}

export function inferManualDocumentType(value: string): DocumentType {
  const text = value.toLowerCase();
  if (text.includes("budget") || text.includes("cip")) return "budget";
  if (text.includes("ordinance")) return "ordinance";
  if (text.includes("charter")) return "charter";
  if (text.includes("audit") || text.includes("financial") || text.includes("acfr")) {
    return "financial-report";
  }
  if (text.includes("strategic") || text.includes("master plan")) {
    return "strategic-plan";
  }
  if (text.includes("state of the city")) return "state-of-city";
  if (text.includes("minutes")) return "meeting-minutes";
  if (text.includes("agenda")) return "agenda";
  if (text.includes("resolution")) return "resolution";
  if (text.includes("open records")) return "open-records";
  return "public-notice";
}

function normalizeHttpUrl(value: string): string {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ManualIngestValidationError("url must use http or https.");
    }
    return parsed.toString();
  } catch (err) {
    if (err instanceof ManualIngestValidationError) throw err;
    throw new ManualIngestValidationError("url must be a valid URL.");
  }
}

function optionalTrimmedString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ManualIngestValidationError("Optional fields must be strings.");
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseDocumentType(value: unknown, inferenceValue: string): DocumentType {
  const trimmed = optionalTrimmedString(value);
  if (!trimmed) return inferManualDocumentType(inferenceValue);
  if (DOCUMENT_TYPES.includes(trimmed as DocumentType)) {
    return trimmed as DocumentType;
  }
  throw new ManualIngestValidationError("type is not supported.");
}

function parseBoardName(value: unknown): BoardName | undefined {
  const trimmed = optionalTrimmedString(value);
  if (!trimmed) return undefined;
  if (BOARD_NAMES.includes(trimmed as BoardName)) {
    return trimmed as BoardName;
  }
  throw new ManualIngestValidationError("board is not supported.");
}

function parseManualDate(value: unknown): string {
  const trimmed = optionalTrimmedString(value);
  if (!trimmed) return todayIsoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ManualIngestValidationError("date must be an ISO date in YYYY-MM-DD format.");
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new ManualIngestValidationError("date must be a valid ISO date.");
  }
  return trimmed;
}

function titleFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const lastSegment = pathname.split("/").filter(Boolean).at(-1);
  return decodeURIComponent(lastSegment ?? "Manual Document");
}

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
