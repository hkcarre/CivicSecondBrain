# CivicSecondBrain — Wiki Schema & Governing Document

> **City:** Schertz, Texas | **Owner:** City Council Members & Staff
> **AI Engine:** Anthropic Claude | **Last Updated:** 2026-06-03
>
> This file governs the entire wiki/ layer. Every session and every
> automated job MUST read this file first. It defines structure,
> conventions, navigation files, and the three executable operations.

---

## 1. VAULT OVERVIEW

**Purpose:** CivicSecondBrain is a persistent, AI-maintained knowledge base
for the City of Schertz, TX. It transforms raw city documents into a
structured wiki that council members can query via natural language, and
that the AI continuously analyzes for recommendations.

**Primary data source:** https://www.schertz.com/27/Government

**Document corpus includes:**
- City Council meeting agendas and minutes (Laserfiche)
- Annual budgets, financial reports, and debt obligations
- City Code and Ordinances (MuniCode)
- City Charter (2024 version)
- Strategic Plan 2024–2025
- State of the City reports
- Advisory board agendas and minutes (14 boards)
- Public notices and open records

**Data flow:**
```
schertz.com documents
    → Scraper (Lambda) detects new/changed documents
    → INGEST operation (Claude) processes and writes wiki pages
    → QUERY operation answers council questions with citations
    → LINT operation (nightly) generates recommendations
    → Dashboard surfaces health alerts and briefings
```

---

## 2. WIKI FOLDER MAP

| Path | What it covers | Primary sources | Update cadence |
|---|---|---|---|
| `wiki/topics/budget.md` | Revenue, expenditures, debt, CIP, pension | Budget PDFs, financial reports | After each budget document |
| `wiki/topics/ordinances.md` | Ordinance index, amendments, effective dates | MuniCode, council minutes | After each council meeting |
| `wiki/topics/infrastructure.md` | Roads, utilities, parks, facilities, CIP | Budget, meeting minutes, strategic plan | After CIP/budget updates |
| `wiki/topics/public-safety.md` | Police, fire, municipal court stats | Meeting minutes, reports | After meeting minutes |
| `wiki/topics/development.md` | Zoning, permits, EDC, P&Z decisions | P&Z agendas, EDC minutes | After board meetings |
| `wiki/topics/governance.md` | Charter, bylaws, board rosters, elections | Charter PDF, city website | On change |
| `wiki/topics/strategic-plan.md` | Goals, KPIs, progress tracking | Strategic Plan 2024-25 | Quarterly |
| `wiki/decisions/YYYY-MM-DD.md` | Per-meeting votes, motions, outcomes | Council meeting minutes | After each council meeting |
| `wiki/people/council-members.md` | Council roster, roles, vote history | Website, meeting minutes | On change |
| `wiki/people/boards.md` | 14 advisory boards — members, meeting frequency | Website, agendas | Quarterly |
| `wiki/recommendations/` | AI-generated improvement analyses | Full wiki state | Nightly LINT |
| `wiki/queries/` | Filed Q&A answers saved for reuse | Generated during QUERY | On demand |
| `wiki/index.md` | Content catalog — LLM navigation layer | Generated | After every operation |
| `wiki/log.md` | Append-only operation history | Generated | After every operation |

---

## 3. NAVIGATION FILES

### wiki/index.md

**Purpose:** Content catalog. Read first on every QUERY to find relevant pages.

**Format:**
```
# CivicSecondBrain Wiki Index
> Last updated: YYYY-MM-DD | Pages: N | Sources ingested: N

## Topics
| Page | Summary | Last Updated | Sources |
|---|---|---|---|

## Decisions
| Page | Summary | Last Updated | Sources |

## People & Boards
...

## Recommendations
...

## Queries Filed
...
```

**Maintenance rules:**
- Add a row for every new wiki page.
- Update `last_updated` and `sources` count when a page changes significantly.
- Never remove rows. Mark deprecated: `(deprecated YYYY-MM-DD)`
- Keep summaries to ~80 chars — scan-readable at a glance.

---

### wiki/log.md

**Purpose:** Chronological, append-only record of all operations.

**Entry heading format:**
```
## [YYYY-MM-DD] OPERATION | Label
```
Where OPERATION is one of: `BOOTSTRAP`, `INGEST`, `INGEST-BATCH`, `QUERY`, `LINT`, `RECOMMEND`

**Never use `##` headings inside a log entry body.**

**Grep patterns:**
- All entries:  `grep "^## [" wiki/log.md`
- All ingests:  `grep "INGEST" wiki/log.md`
- Last 10:      `grep "^## [" wiki/log.md | tail -10`

---

## 4. FRONTMATTER CONVENTIONS

Every wiki page requires:
```yaml
---
title: [Page Title]
type: wiki
category: [topic | decision | person | recommendation | query]
sources: [list of document filenames this was derived from]
last_updated: YYYY-MM-DD
---
```

- Internal links: `[[wiki/path/to/page]]`
- Source citations: `[SOURCE: filename, p.N]` inline after every factual claim
- Date format: ISO 8601 (YYYY-MM-DD) everywhere
- Dollar amounts: always include fiscal year — e.g., `$4.2M (FY2024)`
- Every page must appear in `wiki/index.md`
- Every operation must be logged in `wiki/log.md`

---

## 5. THREE CORE OPERATIONS

### OPERATION: INGEST

**Trigger:** New document detected by scraper, or manual admin upload.

**Procedure:**
1. Read source document(s) in full
2. Extract: decisions, dollar amounts, dates, ordinance numbers, named entities, vote records
3. Identify all wiki pages to update (check `wiki/index.md` first)
4. For council meetings: always create `wiki/decisions/YYYY-MM-DD.md`
5. Update topic pages with new facts, citing source inline
6. Never delete existing wiki content — only append or annotate
7. Update `wiki/index.md` (new rows, updated dates)
8. Append to `wiki/log.md`

**Log format:**
```
## [YYYY-MM-DD] INGEST | [document filename]
**Source:** [full path or URL]
**Document type:** [meeting minutes | budget | ordinance | report | charter | agenda]
**Pages updated:** [comma-separated list]
**Pages created:** [comma-separated list, or "none"]
**Key facts added:** [2–3 sentence summary]
**Ordinances referenced:** [list or "none"]
**Dollar amounts found:** [list or "none"]
**Votes recorded:** [count or "none"]
```

---

### OPERATION: QUERY

**Trigger:** Council member asks a question in the chat interface.

**Procedure:**
1. Read `wiki/index.md` — identify relevant pages
2. Read those pages in full
3. Synthesize answer with mandatory citations: `[SOURCE: filename, p.N]`
4. If no source supports a claim, say so explicitly — never speculate
5. Offer to file valuable answers back into `wiki/queries/`

**Claude system prompt for QUERY:**
```
You are CivicSecondBrain, an AI assistant for the Schertz, TX City Council.
You have access to a curated wiki of city documents updated through [DATE].
Rules:
- Every factual claim MUST include [SOURCE: filename, p.N]
- Never speculate beyond the documents
- If a question cannot be answered from available documents, say exactly
  what is missing and suggest which document to INGEST
- Mark all AI analysis: "AI ANALYSIS — Requires Council Review"
- Financial figures always include fiscal year context: "$4.2M (FY2024)"
- Texas Open Meetings Act: never surface executive session content
```

**Log format:**
```
## [YYYY-MM-DD] QUERY | [truncated question ≤50 chars]
**Question:** [full question]
**Wiki pages read:** [list]
**Filed:** [path, or "not filed"]
**Gap noted:** [any missing coverage, or "none"]
```

---

### OPERATION: LINT (Recommendation Engine)

**Trigger:** Nightly at 2:00 AM CT via AWS EventBridge.

**Procedure:**
1. Read full wiki state (`wiki/index.md` + all pages)
2. Check structural health:
   - **Stale pages** — `last_updated` >30 days for active topics
   - **Contradictions** — conflicting facts between pages
   - **Missing decisions** — meeting dates in log with no decisions page
   - **Board gaps** — boards with no agenda ingested in 60+ days
3. Generate civic recommendations:
   - Budget trends (multi-year analysis)
   - Strategic plan goal tracking vs. actuals
   - Ordinance compliance and gap patterns
   - Benchmarks vs. comparable TX cities where data allows
4. Write to `wiki/recommendations/YYYY-MM-DD-[topic].md`
5. Update `wiki/index.md` and `wiki/log.md`

**Recommendation page format:**
```markdown
---
title: [Topic] Recommendation — YYYY-MM-DD
type: wiki
category: recommendation
severity: [high | medium | low]
sources: [pages analyzed]
last_updated: YYYY-MM-DD
---

## AI ANALYSIS — Requires Council Review

**Finding:** [1–2 sentence summary]
**Evidence:** [bullet list of supporting facts with citations]
**Comparable cities:** [Cibolo, New Braunfels, etc. — if data available]
**Suggested action:** [specific, actionable recommendation]
**Council discussion questions:**
- [Question 1]
- [Question 2]
- [Question 3]
```

**Log format:**
```
## [YYYY-MM-DD] LINT | full
**Pages analyzed:** N
**Issues found:** N high | M medium | K low
**Stale pages:** [count and names]
**Contradictions:** [count]
**Recommendations generated:** [list of new recommendation files]
**Unprocessed source gaps:** [documents detected but not yet ingested]
**Top 3 recommended actions:**
  1. [action]
  2. [action]
  3. [action]
```

---

## 6. SCHERTZ-SPECIFIC ENTITY CONVENTIONS

**Fiscal year:** City of Schertz FY runs October 1 – September 30.
Tag all budget figures: `$X (FY2024)` = Oct 2023 – Sep 2024.

**Council structure:**
- Mayor + 6 Council Members (Places 1–6)
- City Manager (appointed, non-voting)
- City Attorney and City Secretary (staff roles)

**14 Advisory Boards to track:**
1. Planning & Zoning Commission (P&Z)
2. Board of Adjustment
3. Parks & Recreation Advisory Board
4. Historical Preservation Committee
5. Economic Development Corporation (EDC) — 4B
6. Transportation Safety Advisory Commission (TSAC)
7. Library Advisory Board
8. Animal Services Advisory Committee
9. Senior Center Advisory Board
10. Investment Advisory Board
11. Keep Schertz Beautiful Committee
12. Schertz Seguin Local Government Corporation (SSLGC)
13. Schertz Housing Authority
14. Tax Increment Reinvestment Zone (TIRZ) Board

**Document naming conventions in wiki:**
- Meeting minutes: `decisions/YYYY-MM-DD-[body].md`
  e.g., `decisions/2026-02-11-city-council.md`
- Budget documents: `topics/budget.md` (single running page, updated each cycle)
- Ordinances: tracked in `topics/ordinances.md` with index by number and date

---

## 7. OPERATING PRINCIPLES

1. `wiki/` is the AI synthesis layer. Raw documents in `raw-sources/` are read-only.
2. Never delete or overwrite source documents.
3. Every fact must be traceable to a source document.
4. Financial claims require fiscal year context.
5. Vote records require council member names and vote direction (yes/no/abstain).
6. AI recommendations are always clearly labeled and never presented as council decisions.
7. Sensitive content (personnel, litigation, executive session): summarize themes only.
8. Always read `wiki/index.md` before querying raw sources.
9. Always append to `wiki/log.md` after any operation.
10. Texas Open Meetings Act governs what is public — never surface executive session content.
