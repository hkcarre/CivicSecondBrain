# CivicSecondBrain 🏛️
### AI-Powered City Council Knowledge Base

A persistent, AI-maintained knowledge base that gives City Council members
instant, cited answers about their city and proactive improvement recommendations.
Built on the [Karpathy LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

> **Multi-city ready.** Every city name, scraper URL, and AI prompt is driven by
> environment variables — deploy for your municipality without touching the code.

---

## What It Does

| Feature | Description |
|---|---|
| **Chat Q&A** | Ask anything about the city in plain English — get cited answers from real city documents |
| **Persistent Wiki** | AI builds and maintains a structured wiki from every ingested document |
| **Smart Ingestion** | Parallel scrape of DocumentCenter, Laserfiche, Finance sub-pages, and MuniCode (~8,000+ documents) |
| **Proactive Recommendations** | AI analysis surfaces budget trends, strategic plan gaps, and improvement opportunities |
| **City Health Dashboard** | At-a-glance view of civic KPIs and pending AI alerts |
| **Wiki Browser** | Browse all ingested wiki pages at `/wiki`, grouped by category |
| **Export** | Download recommendations or full wiki as Markdown or ZIP |
| **Multi-model AI** | Swap between Anthropic Claude, OpenAI GPT, or Google Gemini via a single env var |
| **Responsive UI** | Works on desktop, tablet, and phone — collapsible sidebar drawer on mobile |
| **Scheduled Automation** | Nightly ingest and weekly lint via Railway cron or GitHub Actions |
| **Admin Panel** | Password-protected ingestion management, export buttons, and schedule info |

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
Raw Sources (PDFs, HTML, ordinances)
    → INGEST (AI builds wiki pages)
    → QUERY  (AI answers from wiki, with citations)
    → LINT   (AI analyzes wiki, generates recommendations)
```

Three layers:
1. **`raw-sources/`** — immutable downloaded documents; `manifest.json` tracks what has been ingested
2. **`wiki/`** — AI-generated, persistent markdown knowledge base
3. **`app/`** — Next.js chat interface + API routes + dashboard

### AI Provider Abstraction

All three operations (INGEST, QUERY, LINT) go through a unified provider interface
(`app/lib/ai/provider.ts`). Set `AI_PROVIDER` to switch backends at deploy time:

| Provider | `AI_PROVIDER` | Default model |
|---|---|---|
| Anthropic Claude (default) | `anthropic` | `claude-sonnet-4-5` |
| OpenAI GPT | `openai` | `gpt-4o` |
| Google Gemini | `gemini` | `gemini-2.0-flash` |

---

## Quick Start

### Prerequisites
- Node.js 20+
- API key for your chosen AI provider (Anthropic, OpenAI, or Gemini)

### Setup

```bash
git clone https://github.com/xozai/CivicSecondBrain
cd CivicSecondBrain

npm install

cp .env.example .env.local
# Required: set at least one AI provider key
# ANTHROPIC_API_KEY=sk-ant-...   (default)
# OPENAI_API_KEY=sk-...          (if AI_PROVIDER=openai)
# GEMINI_API_KEY=...             (if AI_PROVIDER=gemini)

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
| `npm test` | Run unit tests (Vitest, 157 tests) |
| `npm run ingest:seed` | Full parallel ingestion from all sources (~8,000+ documents, 3 workers) |
| `npm run ingest:seed -- --limit 10` | Ingest first 10 documents (fast, no live scrape) |
| `npm run ingest:seed -- --type budget` | Ingest only budget documents |
| `npm run ingest:seed -- --concurrency 5` | Use 5 parallel ingest workers (default 3) |
| `npm run ingest:doc -- --url <url>` | Ingest a single document by URL |
| `npm run lint:wiki` | Analyze wiki, generate AI recommendations for dashboard |
| `npm run scrape:check` | Check for new documents without ingesting |

> **Note:** When `--type`, `--limit`, or `--board` flags are used, the full live scrape is skipped and only the curated priority seed list is used. Full scraping only runs with no flags.
>
> **Parallelism:** Discovery runs all scrapers concurrently. Ingest uses a configurable worker pool (`--concurrency N`, default 3). Tune to Railway memory: 512MB → 2 workers, 1GB → 3, 2GB → 5.
>
> **File size limit:** PDFs larger than `MAX_FILE_SIZE_MB` (default 25MB) are skipped before download. Set this env var to raise the limit on higher-memory deployments.

---

## Data Sources

Ingestion pulls from four sources automatically:

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
Direct scrape of Financial Transparency, Debt Obligations, City Pension, TMRS, and Public Notices pages.

### 4. MuniCode Ordinances (`library.municode.com`)
Crawls the city's published ordinance code via MuniCode's public Content Delivery API.
- Discovers all chapters and sections from the table of contents
- Downloads each section as HTML, parsed to plain text
- Maps to `DocumentType: "ordinance"` and ingested via the standard pipeline
- **Opt-in:** only runs when `MUNICODE_URL` is set (safe to leave blank)
- Configure via `MUNICODE_URL=https://library.municode.com/{state}/{city-slug}`

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
| `/admin` | Password-protected ingestion management and export |
| `/admin/login` | Admin login page |
| `GET /api/health` | Health check with live AI API probe |
| `POST /api/chat` | Streaming chat endpoint |
| `POST /api/ingest` | Trigger document ingestion (requires `INGEST_SECRET`) |
| `POST /api/lint` | Trigger wiki analysis (requires `INGEST_SECRET`) |
| `GET /api/wiki/search` | Full-text wiki search (`?q=query&category=topic`) |
| `GET /api/export/recommendations` | Export recommendations as `.md` or print-PDF HTML |
| `GET /api/export/wiki` | Export full wiki as `.md` or `.zip` |
| `POST /api/admin/login` | Verify admin password, set session cookie |
| `POST /api/admin/logout` | Clear admin session cookie |

---

## Security

### Admin panel
`/admin` is protected by a password-based session cookie. Set `ADMIN_PASSWORD` in your Railway environment:

```bash
# Generate a strong password
openssl rand -base64 24
```

Without `ADMIN_PASSWORD`, the admin panel is open (dev mode only — always set in production).

### API route auth
`/api/ingest` and `/api/lint` require an `Authorization: Bearer <secret>` header matching `INGEST_SECRET`. Without `INGEST_SECRET`, requests are accepted in dev mode.

```bash
# Generate a secret
openssl rand -hex 32
```

### CI security
- `ANTHROPIC_API_KEY` is **not** passed to the CI build step (build confirmed clean without it)
- A lint step fails CI if any `NEXT_PUBLIC_ANTHROPIC` reference is found (prevents accidental browser bundle exposure)

---

## Environment Variables

```bash
# ── AI Provider ────────────────────────────────────────────────────────────
AI_PROVIDER=anthropic          # anthropic | openai | gemini (default: anthropic)
AI_MODEL=                      # optional model name override

ANTHROPIC_API_KEY=sk-ant-...   # required for anthropic provider
OPENAI_API_KEY=                # required for openai provider
OPENAI_BASE_URL=               # optional: for Azure OpenAI, proxies, etc.
GEMINI_API_KEY=                # required for gemini provider

# ── City identity ──────────────────────────────────────────────────────────
NEXT_PUBLIC_CITY_NAME="Schertz"
NEXT_PUBLIC_CITY_STATE="TX"
CITY_NAME="Schertz"           # server-side (used in AI prompts)
CITY_STATE="TX"

# ── Scraper config ─────────────────────────────────────────────────────────
GOV_BASE_URL=                  # root URL of city website (default: https://www.schertz.com)
MUNICODE_URL=                  # MuniCode URL to enable ordinance scraping (opt-in)

# ── Auth ───────────────────────────────────────────────────────────────────
ADMIN_PASSWORD=                # protects /admin (unset = open in dev)
INGEST_SECRET=                 # protects /api/ingest and /api/lint (unset = open in dev)

# ── Storage paths ──────────────────────────────────────────────────────────
WIKI_PATH=/data/wiki           # default: ./wiki
RAW_SOURCES_PATH=/data/raw-sources  # default: ./raw-sources
MAX_FILE_SIZE_MB=25            # skip PDFs larger than this (default: 25)
```

---

## Multi-City Deployment

CivicSecondBrain is designed to work with any CivicPlus municipality. To deploy for a different city:

1. Set `NEXT_PUBLIC_CITY_NAME`, `NEXT_PUBLIC_CITY_STATE`, `CITY_NAME`, `CITY_STATE`
2. Set `GOV_BASE_URL` to the city's government website root (e.g. `https://www.newbraunfels.gov`)
3. Set `MUNICODE_URL` if the city publishes ordinances on MuniCode
4. Laserfiche folder IDs in `laserfiche-scraper.ts` are still Schertz-specific — update those for a different Laserfiche instance

---

## Cloud Deployment (Railway)

The app is deployed on [Railway](https://railway.app) using Docker.

### Quick Deploy

```bash
# Install Railway CLI
brew install railway

# Link to your project
railway login && railway init

# Set environment variables in Railway dashboard (see above)

# Railway auto-deploys on every push to main
```

### Architecture

| Component | Setup |
|---|---|
| App hosting | Railway (Dockerfile, persistent `/data` volume) |
| Wiki storage | Railway volume at `/data/wiki` |
| Raw sources | Railway volume at `/data/raw-sources` |
| Nightly ingest | Railway cron: `node ... scripts/ingest-seed.ts --limit 50` at `0 8 * * *` (UTC) |
| Weekly lint | Railway cron: `node ... scripts/lint-wiki.ts` at `0 9 * * 0` (UTC) |
| Healthcheck | `GET /api/health` with 120s timeout and live AI API probe |

### Scheduled Automation

Railway cron jobs are defined in `railway.toml` and run inside the container (no HTTP server dependency):

```toml
[[cron]]
schedule = "0 8 * * *"    # nightly 2am CT
command  = "node ... scripts/ingest-seed.ts --limit 50"

[[cron]]
schedule = "0 9 * * 0"    # Sunday 3am CT
command  = "node ... scripts/lint-wiki.ts"
```

A GitHub Actions fallback (`.github/workflows/scheduled.yml`) is also provided for non-Railway deployments. It calls the API endpoints on the same schedule using repository secrets `APP_URL` and `INGEST_SECRET`.

### First Boot

On first deploy, Railway mounts an empty volume at `/data`. The container auto-initializes `wiki/SCHEMA.md` and `wiki/index.md` on startup. Then seed the wiki from the Railway shell:

```bash
railway run npm run ingest:seed -- --limit 10   # quick start
railway run npm run lint:wiki                    # generate recommendations
```

### Disk & Memory Management

- **PDFs >25MB** are skipped before download via HTTP HEAD
- **Downloaded files are deleted** immediately after successful ingest — `/data/raw-sources/` stays near-empty
- **Change detection** — already-ingested docs are skipped unless `Last-Modified` or `ETag` changed
- **Memory** — ingest runs with `--max-old-space-size=768`. If OOM errors occur, increase Railway memory to 1GB

---

## Reliability

### Document parsing
- **PDF:** `pdf-parse` up to `MAX_FILE_SIZE_MB` (default 25MB)
- **DOCX / DOC:** `mammoth` for real text extraction (previously returned blank content — now fully parsed)
- **XLSX / XLS:** `SheetJS` with sheet name headers and tab-delimited cell data
- **HTML:** `cheerio` with nav/sidebar/footer removal
- **Unsupported formats** are skipped without calling the AI — no blank wiki pages

### Chat page selection (TF-IDF)
The chat endpoint uses TF-IDF cosine similarity to select the most relevant wiki pages for each query — replacing the previous hardcoded keyword map. Works across any topic without configuration, and falls back to topic pages for broad queries. Decision pages are boosted for temporal queries ("last meeting", "recent vote").

### YAML auto-repair
Wiki pages with unquoted colons or pipe characters in their YAML frontmatter are automatically repaired on first read.

### Manifest safety
- **Race condition fix:** `saveManifest()` is called once after the full ingest loop (not per-document) behind a module-level concurrency mutex — concurrent API requests return 409
- **Checksum dedup:** runs after download (not before), so `localPath` is always available for hashing

### Health check
`GET /api/health` performs a live probe of the AI provider API (not just an env-var presence check) to catch revoked or invalid keys before they cause silent failures.

---

## Export

| Format | Endpoint | Description |
|---|---|---|
| Recommendations (Markdown) | `GET /api/export/recommendations?format=md` | All current recommendations as a council-packet-ready `.md` file |
| Recommendations (Print PDF) | `GET /api/export/recommendations?format=pdf` | Print-optimized HTML — use browser Print → Save as PDF |
| Full wiki (Markdown) | `GET /api/export/wiki?format=md` | All wiki pages concatenated, grouped by category |
| Full wiki (ZIP) | `GET /api/export/wiki?format=zip` | All wiki `.md` files in a DEFLATE-compressed ZIP archive |

Export buttons are available in the Admin panel under the **Export** card.

---

## CI/CD

GitHub Actions runs on every push to `main` and every PR:
- `npm test` — 157 Vitest unit tests across 16 test files
- `npm run build` — validates the Next.js production build
- Lint check — fails if `NEXT_PUBLIC_ANTHROPIC` appears anywhere in source

`ANTHROPIC_API_KEY` is intentionally **not** passed to the build step — the build is confirmed clean without it.

Railway's **"Wait for CI"** setting ensures deploys only happen after tests pass.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components)
- **AI:** Provider-agnostic (`app/lib/ai/provider.ts`) — Anthropic Claude, OpenAI GPT, or Google Gemini
- **Scraping:** Axios + Cheerio + custom CivicPlus DocumentCenter, Laserfiche, and MuniCode API clients
- **Document Parsing:** pdf-parse (PDF), mammoth (DOCX), SheetJS (XLSX), cheerio (HTML)
- **Page Selection:** TF-IDF cosine similarity scorer (zero deps, replaces hardcoded keyword map)
- **Styling:** Tailwind CSS (dark mode, responsive)
- **Testing:** Vitest (157 unit tests — wiki, parser, scraper, AI provider, admin auth, export)
- **Auth:** HMAC-SHA256 signed session cookie (admin panel), Bearer token (API routes)
- **Deployment:** Docker on Railway with persistent volume + cron jobs
- **CI:** GitHub Actions
- **Language:** TypeScript

---

## License

Copyright (c) 2024 Jose Leos. All rights reserved.

This software is proprietary and confidential. Unauthorized use, copying,
distribution, or modification is strictly prohibited. See [LICENSE](LICENSE) for details.
