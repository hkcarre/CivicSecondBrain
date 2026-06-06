# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup

Copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. The `WIKI_PATH` and `RAW_SOURCES_PATH` vars default to `./wiki` and `./raw-sources` for local dev.

`INGEST_SECRET` protects the `/api/ingest` and `/api/lint` POST routes. Callers must include `Authorization: Bearer <secret>` in the request. If `INGEST_SECRET` is not set, the routes are open (dev-mode convenience; always set this in production).

## Commands

```bash
npm run dev              # Start Next.js dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint

npm test                 # Run all tests (Vitest)
npm run test:watch       # Watch mode
npx vitest run app/__tests__/wiki-reader.test.ts  # Run a single test file

npm run ingest:seed                        # Full ingestion — parallel scrape of all sources
npm run ingest:seed -- --type budget       # Priority seed list only (skips live scrape)
npm run ingest:seed -- --limit 5           # Cap at 5 documents
npm run ingest:seed -- --concurrency 5     # 5 parallel ingest workers (default 3)
npm run ingest:doc -- --url <url>          # Ingest a single document by URL
npm run lint:wiki                          # Wiki health check + generate recommendations
npm run scrape:check                       # Check for new documents without ingesting
```

`--type`, `--limit`, and `--board` flags skip the live scrape and use only the hardcoded priority seed list in `ingest-seed.ts`. The full live scrape (all sources, ~8k docs) only runs when no flags are set.

TypeScript scripts run via `tsx` with env loaded from `.env.local` through `scripts/load-env.cjs`.

## Architecture

**Karpathy LLM Wiki Pattern**: raw documents → LLM extraction → persistent wiki → LLM-answered queries.

### Three layers

1. **`raw-sources/`** — downloaded city documents (PDFs, HTML). `manifest.json` is the permanent record of what has been ingested — including `sourceModifiedAt` (Last-Modified/ETag from server) for change detection. Raw files are deleted immediately after a successful ingest to save disk.
2. **`wiki/`** — LLM-generated markdown knowledge base. Only `SCHEMA.md` and `index.md` are committed to the repo (seed files). All generated content (`topics/`, `decisions/`, `recommendations/`, `log.md`) lives on the Railway volume and is gitignored.
3. **`app/`** — Next.js 16 App Router frontend + API routes.

### Three core operations (all call the Anthropic Claude API)

- **INGEST** (`app/lib/claude/ingest-engine.ts`, `scripts/ingest-seed.ts`): Downloads a document, parses it (skipping files >25MB or non-PDF formats), calls Claude to extract `ExtractedKnowledge`, writes/updates wiki pages, saves manifest entry.
- **QUERY** (`app/api/chat/route.ts`): Reads `wiki/index.md`, keyword-selects relevant pages via `selectRelevantPages()`, streams a Claude response. Page selection is keyword-based — intended to be replaced with OpenSearch k-NN at scale.
- **LINT** (`app/api/lint/route.ts`, `scripts/lint-wiki.ts`): Reads topic wiki pages, sends to Claude for analysis, writes `wiki/recommendations/` pages. The script version reads only 8 fixed topic pages to bound memory; the API route version reads the full wiki.

### Key paths

- `app/lib/claude/client.ts` — Anthropic SDK singleton + model constants + system prompts
- `app/lib/wiki/reader.ts` — `readWikiPage()` (with auto-repair for YAML parse errors), `readWikiIndex()`, `buildWikiContext()`
- `app/lib/wiki/writer.ts` — All wiki mutations. Always quotes `title` and `last_updated` in YAML frontmatter to avoid colon parsing issues.
- `app/lib/scraper/schertz-scraper.ts` — Parallel discovery via `Promise.allSettled()` across DocumentCenter, Laserfiche, Finance sub-pages, and Public Notices
- `app/lib/scraper/laserfiche-scraper.ts` — Laserfiche WebLink scraper using `FolderListingService.aspx` cookie-authenticated JSON API
- `app/lib/parser/pdf-parser.ts` — `pdf-parse` wrapper. Skips PDFs over `MAX_FILE_SIZE_MB` (env var, default 25MB); returns a `skipped: true` stub for xlsx/docx.
- `app/lib/manifest.ts` — Shared manifest helpers: `loadManifest`, `saveManifest`, `needsIngestion`, `markIngested`, `fileChecksum`

### Ingest pipeline detail

`ingest-seed.ts` runs a parallel worker pool (default concurrency 3). Workers share a Promise-chain mutex for manifest writes to prevent race conditions. After successful ingest, the local file is deleted and `ingestedAt` + `sourceModifiedAt` are saved to the manifest. On re-runs, docs are skipped unless `sourceModifiedAt` changed.

### Wiki conventions (enforced by `wiki/SCHEMA.md`)

- YAML frontmatter: `title` (always quoted), `type`, `category`, `sources`, `last_updated` (always quoted)
- Inline citations: `[SOURCE: filename, p.N]`
- Financial figures carry fiscal year: `$4.2M (FY2024)` — Schertz FY = Oct 1–Sep 30
- Decisions pages: `wiki/decisions/YYYY-MM-DD-[board].md`
- AI recommendations labeled "AI ANALYSIS — Requires Council Review"

### Tests

Tests live in `app/__tests__/`. All use Vitest with `vi.resetModules()` + dynamic imports to isolate `WIKI_PATH`/`MANIFEST_PATH` env vars (module-level constants must be re-imported after setting the env var). See existing tests for the pattern.

### Deployment (Railway)

- Dockerfile: 3-stage build (deps/builder/runner). `CMD` runs `init-data.sh` (copies wiki seed files to volume if missing) then `npm start`.
- `railway.toml`: no `startCommand` override — Dockerfile CMD takes effect. Healthcheck at `/api/health` (120s timeout).
- Volume mounted at `/data`. `WIKI_PATH=/data/wiki`, `RAW_SOURCES_PATH=/data/raw-sources`.
- `MAX_FILE_SIZE_MB` env var controls the PDF size skip threshold (default 25).
- Branch protection on `main` requires PRs. Bypass: `gh api -X DELETE repos/xozai/CivicSecondBrain/branches/main/protection/enforce_admins` before merge, re-enable after.
