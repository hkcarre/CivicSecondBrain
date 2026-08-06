/**
 * Pending review queue for AI-generated wiki content.
 *
 * ingestDocument() and /api/lint previously called writer.ts directly the
 * moment Claude's extraction passed schema validation — no human ever saw
 * the content before chat could cite it or a recommendation could reach
 * the dashboard, unlike the numeric facts table (which has a real
 * confidence-threshold + RLS review gate). This queues the exact same
 * writes instead, replaying them through the same writer.ts functions only
 * once a reviewer approves the item from /admin/review.
 *
 * File-based (mirrors manifest.ts's pattern), not a database table — wiki
 * content lives on the filesystem/volume, so this queue does too.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  writeWikiPage,
  appendToWikiPage,
  writeDecisionsPage,
  writeRecommendationPage,
  updateWikiIndex,
  appendToLog,
} from "./writer";
import type { WikiPage, Recommendation } from "@/types";

const WIKI_PATH = process.env.WIKI_PATH ?? "./wiki";
const QUEUE_PATH = path.join(WIKI_PATH, "pending-review.json");

// One write this pending item will replay on approval — matches the exact
// parameters each writer.ts function already takes, so approval is a
// direct pass-through rather than new logic that could drift from what the
// live-publish path used to do.
export type PendingAction =
  | { kind: "create-page"; page: WikiPage }
  | {
      kind: "create-decisions";
      meetingDate: string;
      board: string;
      content: string;
      sources: string[];
    }
  | {
      kind: "append-page";
      pagePath: string;
      sectionHeading: string;
      content: string;
      updatedDate: string;
    }
  | { kind: "create-recommendation"; recommendation: Recommendation };

export interface IndexEntryInput {
  path: string;
  summary: string;
  date: string;
  sourceCount: number;
  category: string;
}

export interface PendingReviewItem {
  id: string;
  createdAt: string;
  /** Document title, or "LINT nightly analysis" for recommendation batches. */
  title: string;
  sourceUrl?: string;
  /** Short human-readable preview shown in the review list — not replayed anywhere. */
  preview: string;
  actions: PendingAction[];
  indexEntries: IndexEntryInput[];
  logEntry?: string;
}

type Queue = Record<string, PendingReviewItem>;

function loadQueue(): Queue {
  if (!fs.existsSync(QUEUE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, "utf-8")) as Queue;
  } catch {
    return {};
  }
}

function saveQueue(queue: Queue): void {
  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), "utf-8");
}

/** Queues a set of proposed wiki writes for review instead of applying them immediately. */
export function queueForReview(
  item: Omit<PendingReviewItem, "id" | "createdAt">
): PendingReviewItem {
  const queue = loadQueue();
  const id = crypto.randomUUID();
  const full: PendingReviewItem = {
    ...item,
    id,
    createdAt: new Date().toISOString(),
  };
  queue[id] = full;
  saveQueue(queue);
  return full;
}

export function listPendingReviews(): PendingReviewItem[] {
  return Object.values(loadQueue()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * Applies a pending item's writes to the live wiki (via the same writer.ts
 * functions the ingest/LINT pipelines used to call directly), then removes
 * it from the queue. Returns false if the item no longer exists (already
 * approved/rejected, e.g. a double-click).
 */
export function approveReview(id: string): boolean {
  const queue = loadQueue();
  const item = queue[id];
  if (!item) return false;

  for (const action of item.actions) {
    switch (action.kind) {
      case "create-page":
        writeWikiPage(action.page);
        break;
      case "create-decisions":
        writeDecisionsPage(
          action.meetingDate,
          action.board,
          action.content,
          action.sources
        );
        break;
      case "append-page":
        appendToWikiPage(
          action.pagePath,
          action.sectionHeading,
          action.content,
          action.updatedDate
        );
        break;
      case "create-recommendation":
        writeRecommendationPage(action.recommendation);
        break;
    }
  }

  if (item.indexEntries.length > 0) {
    updateWikiIndex(item.indexEntries);
  }
  if (item.logEntry) {
    appendToLog(item.logEntry);
  }

  delete queue[id];
  saveQueue(queue);
  return true;
}

/** Discards a pending item without applying any of its writes. */
export function rejectReview(id: string): boolean {
  const queue = loadQueue();
  if (!queue[id]) return false;
  delete queue[id];
  saveQueue(queue);
  return true;
}
