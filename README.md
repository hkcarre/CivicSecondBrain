# CivicSecondBrain 🏛️
### AI-Powered City Council Knowledge Base — Schertz, TX

A persistent, AI-maintained knowledge base that gives City Council members
instant, cited answers about their city and proactive improvement recommendations.
Built on the [Karpathy LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

---

## What It Does

| Feature | Description |
|---|---|
| **Chat Q&A** | Ask anything about the city in plain English — get cited answers from real city documents |
| **Persistent Wiki** | Claude builds and maintains a structured wiki from every ingested document |
| **Smart Ingestion** | Deep crawl of schertz.com DocumentCenter and Laserfiche (~8,000 documents) |
| **Proactive Recommendations** | AI analysis surfaces budget trends, strategic plan gaps, and improvement opportunities |
| **City Health Dashboard** | At-a-glance view of civic KPIs and pending AI alerts |
| **Wiki Browser** | Browse all ingested wiki pages at `/wiki`, grouped by category |
| **Run Analysis Button** | Trigger a fresh lint/recommendation cycle from the Admin panel |

---

## Screenshots

**Chat Q&A** — ask anything about the city, get cited answers from real documents

![Chat Q&A](public/screenshots/chat.png)

**City Health Dashboard** — AI recommendations and wiki health at a glance

![City Health Dashboard](public/screenshots/dashboard.png)

**Wiki Browser** — browse all ingested pages by category

![Wiki Browser](public/screenshots/wiki.png)

**Admin Panel** — manage document ingestion

![Admin Panel](public/screenshots/admin.png)

---

## Architecture (Karpathy LLM Wiki Pattern)

```
Raw Sources (PDFs, HTML)
    → INGEST (Claude builds wiki pages)
    → QUERY  (Claude answers from wiki, with citations)
    → LINT   (Claude analyzes wiki, generates recommendations)
```

Three layers:
1. **`raw-sources/`** — immutable downloaded documents; `manifest.json` tracks what has been ingested
2. **`wiki/`** — LLM-generated, persistent markdown knowledge base
3. **`app/`** — Next.js chat interface + API routes + dashboard

---

## Quick Start

### Prerequisites
- Node.js 20+
- Anthropic API key

### Setup

```bash
git clone https://github.com/xozai/CivicSecondBrain
cd CivicSecondBrain

npm install

cp .env.example .env.local
# Set ANTHROPIC_API_KEY in .env.local

# Bootstrap the wiki with priority documents (fast)
npm run ingest:seed -- --limit 10

# Or bootstrap with all ~8,000 documents (takes 30-60 min)
npm run ingest:seed

# Generate AI recommendations
npm run lint:wiki

# Launch the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run unit tests (Vitest, 31 tests) |
| `npm run ingest:seed` | Full parallel ingestion from all sources (~8,000 documents, 3 workers) |
| `npm run ingest:seed -- --dry-run` | Discover documents without downloading |
| `npm run ingest:seed -- --type budget` | Ingest only budget documents (skips scraping) |
| `npm run ingest:seed -- --type budget --limit 2` | Budget docs, max 2 (instant, no scraping) |
| `npm run ingest:seed -- --concurrency 5` | Use 5 parallel ingest workers (default 3) |
| `npm run ingest:doc -- --url <url>` | Ingest a single document by URL |
| `npm run lint:wiki` | Analyze wiki, generate AI recommendations for dashboard |
| `npm run scrape:check` | Check for new documents without ingesting |

> **Note:** When `--type`, `--limit`, or `--board` flags are used, the full live scrape is skipped and only the curated priority seed list is used. This makes targeted runs near-instant. Full scraping only runs with no flags.
>
> **Parallelism:** Discovery runs all 4 scrapers concurrently (~3-4× faster). Ingest uses a configurable worker pool (`--concurrency N`, default 3). Tune to Railway memory: 512MB → 2 workers, 1GB → 3, 2GB → 5.
>
> **File size limit:** PDFs larger than `MAX_FILE_SIZE_MB` (default 25MB) are skipped before download. Set this env var in Railway to allow larger files: 1GB RAM → `50`, 2GB RAM → `100`.

---

## Data Sources

Ingestion pulls from three sources automatically:

### 1. CivicPlus DocumentCenter (`schertz.com/DocumentCenter`)
Deep crawl via the internal `Document_AjaxBinding` JSON API. Covers:
- Budget & Finance (budgets, CIP, fee schedules, tax rates)
- Boards & Commissions, City Council, City Secretary
- Government, Public Information
- Planning, Parks & Recreation, Fire, EMS, Police

### 2. Laserfiche WebLink (`laserfiche.schertzweb.com`)
Recursive crawl of the public records archive via `FolderListingService.aspx`. Covers:
- City Council agendas & minutes (769+ documents)
- City Boards and Commissions agendas & minutes
- Finance Information, Resolutions, Ordinances
- Public Hearing and Public Notices, Public Publications
- Election Information, Charter Review Commission

### 3. Budget & Finance sub-pages
Direct scrape of `/250` (Financial Transparency), `/249` (Debt Obligations), `/247` (City Pension), `/248` (TMRS), and `/2125` (Public Notices).

> **Note:** Board agendas are sourced exclusively from Laserfiche. The `/273/Agendas-Minutes` CivicPlus page links to Laserfiche and does not serve documents directly.

---

## Wiki Structure

```
wiki/                            ← Only seed files are committed to the repo
├── SCHEMA.md                    ← Governing document for wiki conventions (committed)
└── index.md                     ← Empty catalog template (committed, seed for first boot)
```

All generated content lives on the Railway persistent volume (`/data/wiki`) and is rebuilt by `ingest:seed` and `lint:wiki`. It is gitignored and never committed:

```
/data/wiki/                      ← Railway volume (not in repo)
├── log.md                       ← Append-only operation history
├── topics/                      ← Policy areas built from ingested documents
├── decisions/                   ← Per-meeting votes (YYYY-MM-DD-[board].md)
├── recommendations/             ← AI-generated analysis (requires council review)
└── queries/                     ← Saved Q&A answers
```

All wiki pages use YAML frontmatter (`title`, `type`, `category`, `sources`, `last_updated`) and inline `[SOURCE: filename, p.N]` citations. Financial figures always carry fiscal year context (`$4.2M FY2024`). Schertz fiscal year runs Oct 1 – Sep 30.

---

## App Routes

| Route | Description |
|---|---|
| `/` | Chat Q&A interface with suggested questions |
| `/wiki` | Browse all wiki pages by category |
| `/dashboard` | City health dashboard — KPIs and AI recommendations |
| `/admin` | Document ingestion management |
| `GET /api/health` | Health check — returns env vars, wiki state, and errors |
| `POST /api/chat` | Streaming chat endpoint (plain text delta stream) |
| `POST /api/ingest` | Trigger document ingestion |
| `POST /api/lint` | Trigger wiki health check and recommendation generation |

---

## Cloud Deployment (Railway)

The app is deployed on [Railway](https://railway.app) using Docker.

### Quick Deploy

```bash
# Install Railway CLI
brew install railway

# Link to your project
railway login && railway init

# Set environment variables in Railway dashboard:
#   ANTHROPIC_API_KEY, WIKI_PATH=/data/wiki, RAW_SOURCES_PATH=/data/raw-sources

# Railway auto-deploys on every push to main
```

### Architecture

| Component | Setup |
|---|---|
| App hosting | Railway (Dockerfile, persistent `/data` volume) |
| Wiki storage | Railway volume at `/data/wiki` |
| Raw sources | Railway volume at `/data/raw-sources` |
| Nightly lint | Railway cron service: `npm run lint:wiki` at `0 2 * * *` |
| Weekly ingest | Railway cron service: `npm run ingest:seed` at `0 3 * * 0` |
| Healthcheck | `GET /api/health` with 120s timeout |

### First Boot

On first deploy, Railway mounts an empty volume at `/data`. The container auto-initializes `wiki/SCHEMA.md` and `wiki/index.md` on startup. Then seed the wiki from the Railway shell:

```bash
railway run npm run ingest:seed -- --limit 10   # quick start
railway run npm run lint:wiki                    # generate recommendations
```

### Disk & Memory Management

- **PDFs >25MB** are skipped before download via HTTP HEAD (prevents disk full errors on large budget books)
- **Downloaded files are deleted** immediately after successful ingest — `/data/raw-sources/` stays near-empty; the manifest is the only persistent state
- **Change detection** — on re-runs, already-ingested docs are skipped unless the server's `Last-Modified` or `ETag` header has changed
- **Memory** — ingest runs with `--max-old-space-size=768`. If OOM errors occur, increase Railway memory to 1GB and batch:

```bash
npm run ingest:seed -- --limit 1   # one doc at a time
```

### Diagnosing Issues

Hit `/api/health` to see the current state without digging into logs:

```json
{
  "status": "ok",
  "env": { "ANTHROPIC_API_KEY": true, "WIKI_PATH": "/data/wiki" },
  "wiki": { "indexExists": true, "topicCount": 8 },
  "errors": []
}
```

If `status` is `"degraded"`, the `errors` array will list the specific problem (missing API key, empty wiki, etc.).

---

## Reliability

### Chat streaming
The chat UI shows a typing indicator until the first token arrives, a blinking cursor while streaming, and only reveals the "Save to wiki" button after the stream fully completes. Actual error messages from the API are surfaced in-line instead of a generic fallback.

### YAML auto-repair
Wiki pages written before the title-quoting fix may have unquoted colons in their YAML frontmatter. The reader auto-detects and repairs these on first read, writing the corrected file back to disk — no manual intervention needed.

### Change detection
On periodic ingest runs, already-ingested documents are skipped unless the server's `Last-Modified` or `ETag` header has changed since last ingest, ensuring only new and updated documents are processed.

---

## CI/CD

GitHub Actions runs on every push to `main` and every PR:
- `npm test` — 46 Vitest unit tests
- `npm run build` — validates the Next.js build

Railway's **"Wait for CI"** setting ensures deploys only happen after tests pass.

Add `ANTHROPIC_API_KEY` as a GitHub Actions secret (repo Settings → Secrets → Actions) so the build step has it available.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components)
- **AI:** Anthropic Claude (`@anthropic-ai/sdk`) — Sonnet for query/lint/ingest
- **Scraping:** Axios + Cheerio + custom CivicPlus DocumentCenter and Laserfiche API clients
- **PDF Parsing:** pdf-parse (PDFs up to 25MB; xlsx/docx skipped)
- **Styling:** Tailwind CSS
- **Testing:** Vitest (31 unit tests — wiki reader/writer, pdf-parser)
- **Deployment:** Docker on Railway with persistent volume
- **CI:** GitHub Actions
- **Language:** TypeScript

---

## License

Copyright (c) 2024 Jose Leos. All rights reserved.

This software is proprietary and confidential. Unauthorized use, copying,
distribution, or modification is strictly prohibited. See [LICENSE](LICENSE) for details.
