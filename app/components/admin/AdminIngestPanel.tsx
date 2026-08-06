"use client";

import { useState, useRef, useCallback } from "react";
import type { FormEvent, DragEvent } from "react";
import { RefreshCw, Play, FileSearch, CheckCircle, Loader2, FileText, Upload, X, ClipboardList, Hash } from "lucide-react";
import { clsx } from "clsx";

const DOCUMENT_TYPE_OPTIONS = [
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
] as const;

const BOARD_OPTIONS = [
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
  // "keep-schertz-beautiful" intentionally omitted from this UI list — it's
  // a legacy alias kept in the BOARD_NAMES validation union (app/types) only
  // so old Schertz manifests still parse; a new document ingested on any
  // deployment should always use the generic "keep-city-beautiful".
  "keep-city-beautiful",
  "sslgc",
  "housing-authority",
  "tirz",
] as const;

interface AdminIngestPanelProps {
  stats: {
    pagesTotal: number;
    lastIngest: string | null;
    lastLint: string | null;
  };
  logSummary: string;
  schedule?: {
    nextIngest: string;
    nextLint: string;
    ingestCron: string;
    lintCron: string;
  };
}

interface ManualIngestFormState {
  url: string;
  title: string;
  type: string;
  board: string;
  date: string;
}

interface UploadFormState {
  file: File | null;
  title: string;
  type: string;
  board: string;
  date: string;
}

interface BriefingFormState {
  agendaUrl: string;
  meetingDate: string;
  board: string;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".html", ".htm", ".txt", ".docx", ".doc", ".xlsx", ".xls"];

export interface ManualIngestPayload {
  url: string;
  title?: string;
  type?: string;
  board?: string;
  date?: string;
}

export function buildManualIngestPayload(
  form: ManualIngestFormState
): ManualIngestPayload {
  const payload: ManualIngestPayload = {
    url: form.url.trim(),
  };
  const title = form.title.trim();
  const type = form.type.trim();
  const board = form.board.trim();
  const date = form.date.trim();

  if (title) payload.title = title;
  if (type) payload.type = type;
  if (board) payload.board = board;
  if (date) payload.date = date;

  return payload;
}

export function AdminIngestPanel({ stats, logSummary, schedule }: AdminIngestPanelProps) {
  const [status, setStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [result, setResult] = useState<string | null>(null);
  const [failureCount, setFailureCount] = useState<number>(0);
  const [failedDocuments, setFailedDocuments] = useState<string[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [singleDocTab, setSingleDocTab] = useState<"url" | "upload">("url");
  const [manualForm, setManualForm] = useState<ManualIngestFormState>({
    url: "",
    title: "",
    type: "",
    board: "",
    date: "",
  });
  const [uploadForm, setUploadForm] = useState<UploadFormState>({
    file: null,
    title: "",
    type: "",
    board: "",
    date: "",
  });
  const [briefingForm, setBriefingForm] = useState<BriefingFormState>({
    agendaUrl: "",
    meetingDate: "",
    board: "",
  });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;
    setUploadForm((f) => ({ ...f, file: dropped }));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setUploadForm((f) => ({ ...f, file: selected }));
  };

  const run = async (action: "ingest" | "lint" | "scrape-check" | "ingest/facts") => {
    setStatus("running");
    setActiveAction(action);
    setResult(null);
    setFailureCount(0);
    setFailedDocuments([]);

    try {
      const res = await fetch(`/api/${action}`, { method: "POST" });
      const data = await res.json();
      setStatus("done");
      setResult(data.message ?? "Complete.");
      if (data.failed != null && data.failed > 0) {
        setFailureCount(data.failed);
        setFailedDocuments(data.failedDocuments ?? []);
      }
    } catch {
      setStatus("error");
      setResult("Error — check server logs.");
    }
  };

  const ingestManualDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("running");
    setActiveAction("manual-ingest");
    setResult(null);
    setFailureCount(0);
    setFailedDocuments([]);

    try {
      const res = await fetch("/api/ingest/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildManualIngestPayload(manualForm)),
      });
      const data = await res.json();
      setStatus(res.ok ? "done" : "error");
      setResult(data.message ?? (res.ok ? "Complete." : "Error — check server logs."));
    } catch {
      setStatus("error");
      setResult("Error — check server logs.");
    }
  };

  const ingestUploadedFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uploadForm.file) return;
    setStatus("running");
    setActiveAction("upload-ingest");
    setResult(null);
    setFailureCount(0);
    setFailedDocuments([]);

    try {
      const fd = new FormData();
      fd.append("file", uploadForm.file);
      if (uploadForm.title.trim()) fd.append("title", uploadForm.title.trim());
      if (uploadForm.type) fd.append("type", uploadForm.type);
      if (uploadForm.board) fd.append("board", uploadForm.board);
      if (uploadForm.date) fd.append("date", uploadForm.date);

      const res = await fetch("/api/ingest/upload", { method: "POST", body: fd });
      const data = await res.json();
      setStatus(res.ok ? "done" : "error");
      setResult(data.message ?? (res.ok ? "Complete." : "Error — check server logs."));
      if (res.ok) {
        setUploadForm({ file: null, title: "", type: "", board: "", date: "" });
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      setStatus("error");
      setResult("Error — check server logs.");
    }
  };

  const generateBriefing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("running");
    setActiveAction("briefing");
    setResult(null);
    setFailureCount(0);
    setFailedDocuments([]);

    try {
      const payload: Record<string, string> = { agendaUrl: briefingForm.agendaUrl.trim() };
      if (briefingForm.meetingDate) payload.meetingDate = briefingForm.meetingDate;
      if (briefingForm.board) payload.board = briefingForm.board;

      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setStatus(res.ok ? "done" : "error");
      setResult(
        res.ok && data.path
          ? `${data.message ?? "Briefing generated."} Saved to wiki/${data.path}`
          : data.message ?? (res.ok ? "Complete." : "Error — check server logs.")
      );
    } catch {
      setStatus("error");
      setResult("Error — check server logs.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Knowledge Base</h2>
        <div className="space-y-2 text-sm">
          <Row label="Wiki pages" value={stats.pagesTotal} />
          <Row
            label="Last ingest"
            value={stats.lastIngest ?? "Never"}
          />
          <Row
            label="Last lint"
            value={stats.lastLint ?? "Never"}
          />
        </div>
      </div>

      {/* Schedule */}
      {schedule && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Schedule</h2>
          <div className="space-y-2 text-sm">
            <Row label="Next ingest" value={schedule.nextIngest} />
            <Row label="Next lint"   value={schedule.nextLint} />
            <div className="pt-1 text-xs text-gray-400 dark:text-gray-500 font-mono space-y-0.5">
              <p>Ingest: <span className="text-gray-500">{schedule.ingestCron}</span></p>
              <p>Lint: <span className="text-gray-500">{schedule.lintCron}</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Actions</h2>
        <div className="space-y-2">
          <ActionButton
            icon={RefreshCw}
            label="Check for new documents"
            description="Scrape city website, no ingest"
            active={activeAction === "scrape-check" && status === "running"}
            onClick={() => run("scrape-check")}
            disabled={status === "running"}
          />
          <ActionButton
            icon={Play}
            label="Run ingestion"
            description="Process pending documents"
            active={activeAction === "ingest" && status === "running"}
            onClick={() => run("ingest")}
            disabled={status === "running"}
            primary
          />
          <ActionButton
            icon={FileSearch}
            label="Run wiki LINT"
            description="Health check + recommendations"
            active={activeAction === "lint" && status === "running"}
            onClick={() => run("lint")}
            disabled={status === "running"}
          />
          <ActionButton
            icon={Hash}
            label="Extract numeric facts"
            description="Vision-extract budget/financial-report tables into the facts table"
            active={activeAction === "ingest/facts" && status === "running"}
            onClick={() => run("ingest/facts")}
            disabled={status === "running"}
          />
        </div>

        <div className="mt-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Single Document</h3>

          {/* Tabs */}
          <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 mb-3">
            <button
              type="button"
              onClick={() => setSingleDocTab("url")}
              className={clsx(
                "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                singleDocTab === "url"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              By URL
            </button>
            <button
              type="button"
              onClick={() => setSingleDocTab("upload")}
              className={clsx(
                "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                singleDocTab === "upload"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Upload File
            </button>
          </div>

          {/* By URL tab */}
          {singleDocTab === "url" && (
            <form onSubmit={ingestManualDocument} className="space-y-3">
              <input
                type="url"
                required
                value={manualForm.url}
                onChange={(event) =>
                  setManualForm((form) => ({ ...form, url: event.target.value }))
                }
                placeholder="https://example.gov/document.pdf"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-city-navy focus:outline-none"
              />
              <input
                type="text"
                value={manualForm.title}
                onChange={(event) =>
                  setManualForm((form) => ({ ...form, title: event.target.value }))
                }
                placeholder="Optional title"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-city-navy focus:outline-none"
              />
              <MetadataFields
                type={manualForm.type}
                board={manualForm.board}
                date={manualForm.date}
                onType={(v) => setManualForm((f) => ({ ...f, type: v }))}
                onBoard={(v) => setManualForm((f) => ({ ...f, board: v }))}
                onDate={(v) => setManualForm((f) => ({ ...f, date: v }))}
              />
              <div className="flex gap-2">
                <div className="flex-1" />
                <button
                  type="submit"
                  disabled={status === "running" || !manualForm.url.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-city-navy px-3 py-2 text-sm font-medium text-white hover:bg-city-navy-light disabled:opacity-50"
                >
                  {activeAction === "manual-ingest" && status === "running" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <FileText size={15} />
                  )}
                  Ingest Document
                </button>
              </div>
            </form>
          )}

          {/* Upload File tab */}
          {singleDocTab === "upload" && (
            <form onSubmit={ingestUploadedFile} className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(",")}
                className="hidden"
                onChange={handleFileChange}
              />

              {!uploadForm.file ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  className={clsx(
                    "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors",
                    dragOver
                      ? "border-city-navy bg-blue-50"
                      : "border-gray-200 hover:border-city-navy/50 hover:bg-gray-50"
                  )}
                >
                  <Upload size={22} className={clsx("transition-colors", dragOver ? "text-city-navy" : "text-gray-400")} />
                  <p className="text-sm font-medium text-gray-700">Drag &amp; drop a file here</p>
                  <p className="text-xs text-gray-400">or click to browse</p>
                  <p className="text-xs text-gray-300">{ACCEPTED_EXTENSIONS.join(", ")}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <FileText size={15} className="flex-shrink-0 text-city-navy" />
                  <span className="min-w-0 flex-1 text-sm text-gray-800 truncate">
                    {uploadForm.file.name}
                    <span className="ml-1.5 text-xs text-gray-400">
                      — {(uploadForm.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadForm((f) => ({ ...f, file: null }));
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600"
                    aria-label="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <input
                type="text"
                value={uploadForm.title}
                onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Optional title (defaults to filename)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-city-navy focus:outline-none"
              />
              <MetadataFields
                type={uploadForm.type}
                board={uploadForm.board}
                date={uploadForm.date}
                onType={(v) => setUploadForm((f) => ({ ...f, type: v }))}
                onBoard={(v) => setUploadForm((f) => ({ ...f, board: v }))}
                onDate={(v) => setUploadForm((f) => ({ ...f, date: v }))}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={status === "running" || !uploadForm.file}
                  className="inline-flex items-center gap-2 rounded-lg bg-city-navy px-3 py-2 text-sm font-medium text-white hover:bg-city-navy-light disabled:opacity-50"
                >
                  {activeAction === "upload-ingest" && status === "running" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Upload size={15} />
                  )}
                  Upload &amp; Ingest
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Briefing Packet */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Briefing Packet</h3>
          <p className="text-xs text-gray-400 mb-3">
            Generate a pre-meeting briefing from a published agenda URL — each item
            cross-referenced against the wiki.
          </p>
          <form onSubmit={generateBriefing} className="space-y-3">
            <input
              type="url"
              required
              value={briefingForm.agendaUrl}
              onChange={(event) =>
                setBriefingForm((form) => ({ ...form, agendaUrl: event.target.value }))
              }
              placeholder="https://example.gov/agenda.pdf"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-city-navy focus:outline-none"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="date"
                value={briefingForm.meetingDate}
                onChange={(event) =>
                  setBriefingForm((form) => ({ ...form, meetingDate: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-city-navy focus:outline-none"
              />
              <select
                value={briefingForm.board}
                onChange={(event) =>
                  setBriefingForm((form) => ({ ...form, board: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-city-navy focus:outline-none"
              >
                <option value="">Infer board</option>
                {BOARD_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={status === "running" || !briefingForm.agendaUrl.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-city-navy px-3 py-2 text-sm font-medium text-white hover:bg-city-navy-light disabled:opacity-50"
              >
                {activeAction === "briefing" && status === "running" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ClipboardList size={15} />
                )}
                Generate Briefing
              </button>
            </div>
          </form>
        </div>

        {/* Result */}
        {result && (
          <div
            className={clsx(
              "mt-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2",
              status === "done"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            )}
          >
            <CheckCircle size={12} />
            {result}
          </div>
        )}

        {/* Failure details */}
        {failureCount > 0 && (
          <div className="mt-2 text-xs px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <p className="font-semibold text-amber-800 mb-1">
              {failureCount} document{failureCount > 1 ? "s" : ""} failed — see wiki/log.md for details
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-700">
              {failedDocuments.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Exports */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Export</h2>
        <div className="space-y-2">
          <ExportLink
            href="/api/export/recommendations?format=md"
            label="Recommendations (.md)"
            description="All current AI recommendations as markdown"
          />
          <ExportLink
            href="/api/export/recommendations?format=pdf"
            label="Recommendations (print PDF)"
            description="Opens print-ready HTML for Save as PDF"
            newTab
          />
          <ExportLink
            href="/api/export/wiki?format=md"
            label="Full wiki (.md)"
            description="All wiki pages concatenated as one document"
          />
          <ExportLink
            href="/api/export/wiki?format=zip"
            label="Full wiki (.zip)"
            description="All individual wiki markdown files as a ZIP"
          />
          <ExportLink
            href="/api/export/chat-log?format=jsonl"
            label="Chat audit log (.jsonl)"
            description="This month's chat Q&A audit log for public-records requests"
          />
          <ExportLink
            href="/api/export/chat-log?format=csv"
            label="Chat audit log (.csv)"
            description="This month's chat Q&A audit log as a spreadsheet-friendly CSV"
          />
        </div>
      </div>

      {/* Log preview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Recent Log</h2>
        <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-48">
          {logSummary || "No log entries yet."}
        </pre>
      </div>
    </div>
  );
}

function MetadataFields({
  type,
  board,
  date,
  onType,
  onBoard,
  onDate,
}: {
  type: string;
  board: string;
  date: string;
  onType: (v: string) => void;
  onBoard: (v: string) => void;
  onDate: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={type}
          onChange={(e) => onType(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-city-navy focus:outline-none"
        >
          <option value="">Infer type</option>
          {DOCUMENT_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={board}
          onChange={(e) => onBoard(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-city-navy focus:outline-none"
        >
          <option value="">No board</option>
          {BOARD_OPTIONS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => onDate(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-city-navy focus:outline-none"
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

function ExportLink({
  href,
  label,
  description,
  newTab = false,
}: {
  href: string;
  label: string;
  description: string;
  newTab?: boolean;
}) {
  return (
    <a
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200
                 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200
                 hover:border-city-navy/40 hover:bg-gray-50 dark:hover:bg-gray-600
                 transition-all group"
    >
      <FileText size={15} className="flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-city-navy dark:group-hover:text-city-maroon" />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{description}</p>
      </div>
    </a>
  );
}

function ActionButton({
  icon: Icon,
  label,
  description,
  active,
  onClick,
  disabled,
  primary = false,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
        primary
          ? "bg-city-navy text-white border-city-navy hover:bg-city-navy-light disabled:opacity-50"
          : "bg-white text-gray-700 border-gray-200 hover:border-city-navy/40 hover:bg-gray-50 disabled:opacity-50"
      )}
    >
      {active ? (
        <Loader2 size={15} className="animate-spin flex-shrink-0" />
      ) : (
        <Icon size={15} className="flex-shrink-0" />
      )}
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className={clsx("text-xs", primary ? "text-white/70" : "text-gray-400")}>
          {description}
        </p>
      </div>
    </button>
  );
}
