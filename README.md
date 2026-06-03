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
| **Smart Ingestion** | Automatically discovers and processes documents from schertz.com |
| **Proactive Recommendations** | Nightly AI analysis surfaces budget trends, strategic plan gaps, and improvement opportunities |
| **City Health Dashboard** | At-a-glance view of civic KPIs and pending AI alerts |

---

## Architecture (Karpathy LLM Wiki Pattern)

```
Raw Sources (PDFs, HTML)
    → INGEST (Claude builds wiki pages)
    → QUERY  (Claude answers from wiki, with citations)
    → LINT   (Claude analyzes full wiki, generates recommendations)
```

Three layers:
1. **`raw-sources/`** — immutable downloaded documents
2. **`wiki/`** — LLM-generated, persistent markdown knowledge base
3. **`app/`** — Next.js chat interface + API + dashboard

---

## Quick Start

### Prerequisites
- Node.js 18+
- Anthropic API key (`claude-3-5-sonnet`)

### Setup

```bash
git clone https://github.com/your-org/civic-second-brain
cd civic-second-brain

npm install

cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local

# Bootstrap the wiki from Schertz documents
npm run ingest:seed

# Launch the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Scripts

| Command | Description |
|---|---|
| `npm run ingest:seed` | Full seed ingestion from schertz.com (run once to bootstrap) |
| `npm run ingest:seed -- --dry-run` | Discover documents without downloading |
| `npm run ingest:seed -- --board council` | Ingest only city council documents |
| `npm run ingest:seed -- --type budget` | Ingest only budget documents |
| `npm run ingest:seed -- --limit 5` | Process first 5 documents (for testing) |
| `npm run ingest:doc` | Ingest a single document by URL |
| `npm run lint:wiki` | Run wiki health check + generate recommendations |
| `npm run scrape:check` | Check for new documents without ingesting |
| `npm run dev` | Start development server |

---

## Wiki Structure

```
wiki/
├── SCHEMA.md              ← Governing document (read this first)
├── index.md               ← Content catalog (LLM navigation layer)
├── log.md                 ← Append-only operation history
├── topics/
│   ├── budget.md          ← Budget & Finance (multi-year trends)
│   ├── ordinances.md      ← Ordinance index & amendments
│   ├── infrastructure.md  ← Roads, utilities, parks, CIP
│   ├── public-safety.md   ← Police, fire, courts
│   ├── development.md     ← Zoning, permits, EDC
│   ├── governance.md      ← Charter, boards, elections
│   └── strategic-plan.md  ← Goals, KPIs, progress
├── decisions/
│   └── YYYY-MM-DD-[board].md  ← Per-meeting votes & decisions
├── people/
│   ├── council-members.md ← Roster, roles, vote history
│   └── boards.md          ← 14 advisory boards
├── recommendations/
│   └── YYYY-MM-DD-[topic].md  ← AI-generated recommendations
└── queries/
    └── [filed answers]    ← Saved Q&A for reuse
```

---

## Cloud Deployment (AWS)

See `infrastructure/` for AWS CDK stack.

| Component | AWS Service |
|---|---|
| App hosting | Amplify / ECS Fargate |
| Auth | Cognito (MFA) |
| Document storage | S3 (raw-sources, wiki) |
| Semantic search | OpenSearch (k-NN) |
| Scheduler | EventBridge + Lambda |
| Scraper | Lambda + Playwright |
| Monitoring | CloudWatch |

Estimated POC cost: **~$150–300/month**

---

## Data Source

All documents sourced from the City of Schertz, TX official government portal:
**https://www.schertz.com/27/Government**

Includes: City Council minutes, budgets, ordinances, City Charter,
Strategic Plan, State of the City, and 14 advisory board agendas.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **AI:** Anthropic Claude 3.5 Sonnet (`@anthropic-ai/sdk`)
- **Streaming:** Vercel AI SDK
- **Scraping:** Axios + Cheerio
- **PDF Parsing:** pdf-parse
- **Styling:** Tailwind CSS
- **Language:** TypeScript

---

## License

[MIT](LICENSE) — free to use, fork, and adapt for any city or civic purpose.
