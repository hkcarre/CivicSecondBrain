# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup

Copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. The `WIKI_PATH` and `RAW_SOURCES_PATH` vars default to `./wiki` and `./raw-sources` for local dev — no AWS credentials needed at POC stage.

## Commands

```bash
npm run dev              # Start Next.js dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint via Next.js

npm run ingest:seed      # Full bootstrap ingestion from schertz.com
npm run ingest:seed -- --dry-run      # Discover documents without downloading
npm run ingest:seed -- --board council --limit 5   # Filtered ingestion for testing
npm run ingest:doc       # Ingest a single document by URL
npm run lint:wiki        # Wiki health check + generate recommendations
npm run scrape:check     # Check for new documents without ingesting
```

TypeScript scripts run via `tsx` with env loaded from `.env.local` through `scripts/load-env.cjs`.

## Architecture

This project implements the **Karpathy LLM Wiki Pattern**: raw documents → LLM extraction → persistent wiki → LLM-answered queries.

### Three layers

1. **`raw-sources/`** — immutable downloaded city documents (PDFs, HTML). `manifest.json` tracks what has been ingested.
2. **`wiki/`** — LLM-generated markdown knowledge base. `SCHEMA.md` is the governing document for its structure and conventions. Every write operation must update `wiki/index.md` (content catalog) and append to `wiki/log.md` (operation history).
3. **`app/`** — Next.js App Router frontend + API routes.

### Three core operations (all call the Anthropic Claude API)

- **INGEST** (`app/lib/claude/ingest-engine.ts`, `app/api/ingest/route.ts`): Parses a document, calls Claude to extract structured knowledge (`ExtractedKnowledge`), writes/updates wiki pages.
- **QUERY** (`app/api/chat/route.ts`): Reads `wiki/index.md`, keyword-selects relevant pages, streams a Claude response with mandatory inline citations. Page selection is keyword-based (not vector search) — acceptable at POC scale, intended to be replaced with OpenSearch k-NN.
- **LINT** (`app/api/lint/route.ts`): Reads full wiki state, checks structural health, generates `wiki/recommendations/` pages.

### Key app lib paths

- `app/lib/claude/client.ts` — Anthropic SDK client + model constants + system prompts (`QUERY_SYSTEM_PROMPT`, `INGEST_SYSTEM_PROMPT`)
- `app/lib/wiki/reader.ts` — Reads wiki pages and index
- `app/lib/wiki/writer.ts` — Writes wiki pages; all wiki mutations go through here
- `app/lib/scraper/schertz-scraper.ts` — Cheerio-based scraper for schertz.com
- `app/lib/parser/pdf-parser.ts` — `pdf-parse` wrapper; chunks long documents

### Wiki conventions (enforced by `wiki/SCHEMA.md`)

- Every wiki page has YAML frontmatter with `title`, `type`, `category`, `sources`, `last_updated`
- Factual claims must include `[SOURCE: filename, p.N]` inline
- Financial figures always carry fiscal year: `$4.2M (FY2024)` (Schertz FY = Oct 1 – Sep 30)
- Decisions pages live at `wiki/decisions/YYYY-MM-DD-[body].md`
- AI recommendations are labeled "AI ANALYSIS — Requires Council Review"
- Texas Open Meetings Act: never surface executive session content

### Infrastructure

`infrastructure/` contains an AWS CDK stack (not yet deployed for POC). Production target: Amplify/ECS, S3 for `raw-sources/` and `wiki/`, OpenSearch for semantic search, EventBridge + Lambda for nightly LINT.
