// ─── Document Types ────────────────────────────────────────────────────────

export type DocumentType =
  | "meeting-minutes"
  | "agenda"
  | "budget"
  | "ordinance"
  | "charter"
  | "strategic-plan"
  | "financial-report"
  | "public-notice"
  | "open-records"
  | "state-of-city"
  | "board-minutes"
  | "resolution";

export type BoardName =
  | "city-council"
  | "planning-zoning"
  | "board-of-adjustment"
  | "parks-recreation"
  | "historical-preservation"
  | "edc"
  | "tsac"
  | "library-advisory"
  | "animal-services"
  | "senior-center"
  | "investment-advisory"
  | "keep-schertz-beautiful"
  | "sslgc"
  | "housing-authority"
  | "tirz";

export interface CivicDocument {
  id: string;
  title: string;
  type: DocumentType;
  board?: BoardName;
  date: string; // ISO 8601
  fiscalYear?: string; // e.g., "FY2024"
  sourceUrl: string;
  localPath?: string;
  checksum?: string;        // MD5 of file content at ingest time
  sourceModifiedAt?: string; // Last-Modified or ETag from server at discovery time
  ingestedAt?: string;
}

// ─── Wiki Types ────────────────────────────────────────────────────────────

export type WikiCategory =
  | "topic"
  | "decision"
  | "person"
  | "recommendation"
  | "query";

export type RecommendationSeverity = "high" | "medium" | "low";

export interface WikiPage {
  title: string;
  type: "wiki";
  category: WikiCategory;
  sources: string[];
  lastUpdated: string;
  content: string;
  path: string;
}

export interface WikiIndex {
  city: string;
  lastUpdated: string;
  pageCount: number;
  sourcesIngested: number;
  pages: WikiIndexEntry[];
}

export interface WikiIndexEntry {
  path: string;
  summary: string;
  lastUpdated: string;
  sourceCount: number;
  category: WikiCategory;
}

// ─── Chat Types ────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: string;
  filed?: boolean;
}

export interface Citation {
  source: string;
  page?: number;
  excerpt?: string;
  url?: string;
}

// ─── Ingestion Types ───────────────────────────────────────────────────────

export interface IngestJob {
  id: string;
  document: CivicDocument;
  status: "pending" | "processing" | "complete" | "error";
  startedAt?: string;
  completedAt?: string;
  pagesUpdated?: string[];
  pagesCreated?: string[];
  error?: string;
}

export interface IngestResult {
  success: boolean;
  document: CivicDocument;
  pagesUpdated: string[];
  pagesCreated: string[];
  keyFacts: string;
  ordinancesReferenced: string[];
  dollarAmounts: string[];
  votesRecorded: number;
  /** True when the document was skipped because its format is not supported. */
  skipped?: boolean;
}

// ─── Recommendation Types ──────────────────────────────────────────────────

export interface Recommendation {
  id: string;
  title: string;
  severity: RecommendationSeverity;
  finding: string;
  evidence: string[];
  comparableCities?: string[];
  suggestedAction: string;
  discussionQuestions: string[];
  sourcesAnalyzed: string[];
  generatedAt: string;
  path: string;
}

// ─── Lint / Health Types ───────────────────────────────────────────────────

export interface WikiHealthReport {
  runAt: string;
  pagesAnalyzed: number;
  stalePages: string[];
  contradictions: ContradictionFlag[];
  missingDecisions: string[];
  boardGaps: string[];
  recommendations: Recommendation[];
  topActions: string[];
}

export interface ContradictionFlag {
  pageA: string;
  pageB: string;
  description: string;
}

// ─── User / Auth Types ─────────────────────────────────────────────────────

export type UserRole = "council-member" | "city-staff" | "admin" | "public";

export interface CivicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string; // e.g., "Mayor", "Council Member Place 2"
}
