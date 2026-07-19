/**
 * app/lib/briefing/helpers.ts
 *
 * Pure helpers for the meeting-briefing generator: input validation,
 * AI JSON extraction, slug/label utilities, and packet composition.
 * Kept side-effect-free so they are trivially unit-testable.
 */

import type { AgendaItem } from "@/types";

/** Cost guard: never brief more than this many agenda items per packet. */
export const MAX_BRIEFING_ITEMS = 25;

/** Cost guard: cap the agenda text sent to the extraction call (~30k tokens). */
export const MAX_AGENDA_CHARS = 120_000;

/** Per-item wiki context budget (~10k chars) passed to buildWikiContext. */
export const ITEM_CONTEXT_TOKENS = 2_500;

// ─── Errors ───────────────────────────────────────────────────────────────

export class BriefingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BriefingValidationError";
  }
}

export class BriefingGenerationError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "BriefingGenerationError";
    this.statusCode = statusCode;
  }
}

// ─── Input validation ─────────────────────────────────────────────────────

export interface BriefingInput {
  agendaUrl: string;
  meetingDate?: string;
  board?: string;
}

export function parseBriefingInput(body: unknown): BriefingInput {
  if (!isRecord(body)) {
    throw new BriefingValidationError("Request body must be a JSON object.");
  }

  if (typeof body.agendaUrl !== "string" || body.agendaUrl.trim() === "") {
    throw new BriefingValidationError("agendaUrl is required.");
  }

  const agendaUrl = normalizeHttpUrl(body.agendaUrl);
  const meetingDate = parseOptionalIsoDate(body.meetingDate);
  const board = parseOptionalBoardSlug(body.board);

  return {
    agendaUrl,
    ...(meetingDate ? { meetingDate } : {}),
    ...(board ? { board } : {}),
  };
}

function normalizeHttpUrl(value: string): string {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new BriefingValidationError("agendaUrl must use http or https.");
    }
    return parsed.toString();
  } catch (err) {
    if (err instanceof BriefingValidationError) throw err;
    throw new BriefingValidationError("agendaUrl must be a valid URL.");
  }
}

function parseOptionalIsoDate(value: unknown): string | undefined {
  const trimmed = optionalTrimmedString(value, "meetingDate");
  if (!trimmed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new BriefingValidationError(
      "meetingDate must be an ISO date in YYYY-MM-DD format."
    );
  }
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== trimmed
  ) {
    throw new BriefingValidationError("meetingDate must be a valid ISO date.");
  }
  return trimmed;
}

function parseOptionalBoardSlug(value: unknown): string | undefined {
  const trimmed = optionalTrimmedString(value, "board");
  if (!trimmed) return undefined;
  const slug = slugify(trimmed);
  if (!slug) {
    throw new BriefingValidationError("board must contain letters or digits.");
  }
  return slug;
}

function optionalTrimmedString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new BriefingValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ─── AI response parsing ──────────────────────────────────────────────────

/**
 * Pull the JSON payload out of an AI completion. Mirrors the lint route's
 * pattern: prefer a ```json fenced block, fall back to the outermost braces.
 */
export function extractJsonBlock(text: string): string {
  const jsonMatch =
    text.match(/```json\n?([\s\S]+?)\n?```/) ?? text.match(/\{[\s\S]+\}/);

  if (!jsonMatch) {
    throw new BriefingGenerationError(
      "AI returned no parseable JSON for the agenda item list.",
      502
    );
  }

  return jsonMatch[jsonMatch.length - 1];
}

export interface AgendaExtraction {
  meetingDate?: string;
  board?: string;
  items: AgendaItem[];
}

/** Parse + normalize the agenda-extraction AI response into typed items. */
export function parseAgendaExtraction(text: string): AgendaExtraction {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonBlock(text));
  } catch (err) {
    if (err instanceof BriefingGenerationError) throw err;
    throw new BriefingGenerationError(
      "AI returned malformed JSON for the agenda item list.",
      502
    );
  }

  if (!isRecord(parsed)) {
    throw new BriefingGenerationError(
      "AI agenda extraction did not return a JSON object.",
      502
    );
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items: AgendaItem[] = rawItems
    .filter(isRecord)
    .map((item, i) => ({
      number:
        typeof item.number === "string" || typeof item.number === "number"
          ? String(item.number).trim() || String(i + 1)
          : String(i + 1),
      title: typeof item.title === "string" ? item.title.trim() : "",
      summary: typeof item.summary === "string" ? item.summary.trim() : "",
    }))
    .filter((item) => item.title.length > 0);

  const meetingDate =
    typeof parsed.meetingDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(parsed.meetingDate)
      ? parsed.meetingDate
      : undefined;

  const board =
    typeof parsed.board === "string" && parsed.board.trim()
      ? parsed.board.trim()
      : undefined;

  return {
    ...(meetingDate ? { meetingDate } : {}),
    ...(board ? { board } : {}),
    items,
  };
}

// ─── Slugs and labels ─────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** "city-council" → "City Council" */
export function boardLabel(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Packet composition ───────────────────────────────────────────────────

export interface PacketOptions {
  meetingDate: string;
  boardSlug: string;
  agendaUrl: string;
  items: AgendaItem[];
  /** Per-item brief markdown, index-aligned with `items`. */
  briefs: string[];
  /** Total items found before the MAX_BRIEFING_ITEMS cap. */
  totalItems: number;
}

/** Compose the full packet markdown body (frontmatter is added by the writer). */
export function composeBriefingPacket(opts: PacketOptions): string {
  const truncated = opts.totalItems > opts.items.length;

  const lines: string[] = [
    `# Meeting Briefing Packet — ${boardLabel(opts.boardSlug)} — ${opts.meetingDate}`,
    "",
    "## AI ANALYSIS — Requires Council Review",
    "",
    `**Agenda source:** ${opts.agendaUrl}`,
    `**Agenda items briefed:** ${opts.items.length}${
      truncated
        ? ` of ${opts.totalItems} — capped at ${MAX_BRIEFING_ITEMS} items for cost control; remaining items were not briefed`
        : ""
    }`,
    "",
  ];

  opts.items.forEach((item, i) => {
    lines.push("---", "", `## Item ${item.number}: ${item.title}`, "");
    if (item.summary) {
      lines.push(`> ${item.summary}`, "");
    }
    lines.push((opts.briefs[i] ?? "").trim() || "_No brief generated._", "");
  });

  return lines.join("\n").trimEnd() + "\n";
}
