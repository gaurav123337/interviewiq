# Phase 4 — Consolidated Enhancement Plan

> **Status:** Approved 2026-09-22. This is the authoritative Phase 4 plan. It **supersedes** two
> earlier working drafts (the 2026-09-10 "Phase 4 Enhancements" draft and the 2026-09-13
> "Auto-Discovery Ingestion Engine" draft), which were never committed and are now stale.
>
> **This doc is a plan, not an implementation.** Nothing here is built until it is requested. Each
> item below is shipped on its own under the standing cadence — **plan → owner-approve → build (all 5
> gates green) → adversarial review → PR → merge → memory** — **one item at a time**.
>
> **Owner scope decisions (2026-09-22):** build the **full** Auto-Discovery Ingestion Engine;
> **include** the Takedown system this phase; keep everything in **one consolidated doc** (this file).

---

## 1. Context — why this phase exists

Four owner-reported enhancements, reconciled and grounded against the *current* codebase
(React 19.3 / TypeScript 7 / Vite 8 era; Phases 1–3 shipped):

1. **Scraper is invisible in the admin dashboard.** The GitHub Actions cron writes no run report, and
   the browser "Run now" history lives only in `localStorage`. An admin cannot see which sites ran,
   what was added, or what failed.
2. **Question bank lacks metadata and filters.** No "added on" date is shown, and questions cannot be
   filtered by live/draft status or by skill (React / Java / …).
3. **The scraper cannot find its own sources.** Every source is hand-curated; there is no way to
   auto-discover skill-based question/resource sources from the internet.
4. **JS-heavy job boards are unreachable.** The current ATS-API + RSS feed cannot render
   JavaScript-driven boards; a headless browser (Playwright) is needed for better job scraping.

Intended outcome: an admin can see and filter every scrape/cron run; the question bank carries dates,
skills, and status filters; the scraper can propose its own skill-based sources (behind a human
approval gate) with attribution and a takedown path; and a Playwright pipeline widens job coverage.

---

## 2. Grounding — what already exists (verified against the code)

| Area | Real asset | Fact that shapes the plan |
|---|---|---|
| Q-bank schema | `supabase/admin.sql` → `published_questions` | Has `created_at` ✓ and `published boolean`. **No `skills`, no `status`** column. |
| Q-bank provenance | `supabase/content-sourcing.sql` | Already adds `source_id`, `source_url`, `meta jsonb` — attribution storage is ready. |
| Q-bank client type | `src/services/remoteConfig.ts` → `PublishedQuestion` / `publishedFor()` | Type carries `updatedAt` but **not** `createdAt`; `publishedFor()` maps to `QA{q,a,kp}` and drops the timestamp. |
| Q-bank CRUD | `src/services/admin/questions.ts` → `createQuestion` | Does **not** accept `skills` yet. `question_audit` table exists (reuse for the takedown audit trail). |
| Scraper core | `scripts/scrape-lib.js` | Pure `extractItems` / `normalizeItem` / `buildUpsertSql` (`insert … on conflict (question) do nothing`). Large existing test suite. The reuse spine for discovery. |
| Scraper cron | `scripts/scrape-sources.js` | Loads `scraper_sources` (dashboard-first, `content/sources.json` fallback), has a `runSql()` helper, upserts drafts — **writes no run report**. |
| Scraper browser | `src/services/scraper.ts` → `runScraperNow()` | Already returns `RunResult{sourceId,url,extracted,inserted,error}` per source — **never persists it**. Uses a `schedule_override`-missing graceful fallback in `listScraperSources()`. |
| Run-report template | `supabase/jobs-fetch-reports.sql` → `jobs_fetch_reports` | The exact shape to mirror for `scraper_runs` (`ran_at`, `per_source jsonb`, `errors`, RLS admin-read, prune-trigger keeping the last N). |
| Jobs pipeline | `src/services/jobs/feed.ts` | Jobs come from the `jobs-fetch` Edge Function → `jobs` table. `FEED_SOURCES = ["greenhouse","ashby","lever","remoteok","rss"]`, read via **exact** `.eq("source", …)`; `JobFilters.source` also compares exactly. |
| Admin UI | `src/components/admin/*` | `ScraperSection`, `QuestionsSection`, `ReviewInbox`, `ContentCuration`, `ResourcesSection`, `config/JobFeedCard` all exist. |
| Discovery inputs | `src/data/skillCatalog.ts`, `src/data/codingBank/aiGenerated.ts`, `docs/resource-safety-guard.md` | All present — the full-engine assumptions hold. |
| Docs | `docs/` | This file did not exist before; the two draft plans were never committed. |

---

## 3. Reconciliation decisions (resolving overlaps between the two drafts)

- **Two report tables, cleanly split.** `scraper_runs` (new) records the **question-bank scraper**
  (`scrape-sources.js`) **and** the discovery crawler (`crawl-sources.js`). `jobs_fetch_reports`
  (existing) records the **jobs pipeline** (`jobs-fetch` + the new Playwright script). The Playwright
  job script therefore writes `jobs_fetch_reports`, **not** `scraper_runs` (this corrects the
  2026-09-10 draft, which conflated them).
- **One GitHub-Actions cron-log card unifies pipeline health** across `scrape-weekly.yml`,
  `jobs-playwright.yml`, `discover-weekly.yml`, and `ai-problems.yml` — regardless of which report
  table each workflow writes.
- **`FEED_SOURCES` matches exactly**, so the Playwright pipeline uses a single source value
  **`"playwright"`** (the host lives in `external_id` / `meta`), **not** `playwright:<host>` — a
  colon-suffixed value would be invisible both to `loadJobsFromCloud()` and to the source filter.
  (This corrects the draft's "add `playwright:<host>`".)
- **The `skills` column on `published_questions` serves two features** — Enh 2 (skill filter) and
  Enh 3 (discovery skill-routing). It is added once in **Item A** and consumed by **Item D**, which
  makes A a hard prerequisite for D.
- **Graceful pre-migration degradation is the shipping-safety contract.** Every new read tolerates a
  missing table/column by returning empty, mirroring `scraper.ts`'s existing `schedule_override`
  fallback. This lets code merge before its Supabase migration has been run, and keeps the app from
  crashing in the interim (it is in a testing phase).

---

## 4. Shippable items — recommended build order

Each item is its own plan → approve → build → review → PR → merge → memory cycle. Order rationale:
quick user-facing value first (A), then visibility into the scraper before we expand it (B), then the
isolated new pipeline (C), then the large multi-PR engine last (D). **A is a hard prerequisite for D**
(the `skills` column feeds discovery routing).

### Item A — Question-bank metadata & filters (Enh 2) · smallest, low risk, high value

- **A-migration:** `alter table published_questions add column if not exists skills jsonb not null
  default '[]'::jsonb` (idempotent; same style as `content-sourcing.sql`). `created_at` already
  exists → no migration needed for the date.
- **2a — Added-on date.** Carry `created_at` through `PublishedQuestion` (add `addedAt: number | null`),
  the `getPublishedQuestions()` select, and `publishedFor()` (keep it `QA`-assignable — attach
  `addedAt` alongside `q/a/kp`); add `addedAt?` to `engine/bank.ts` `BankItem`. Render an
  "Added &lt;date&gt;" chip in the Public Bank and Admin → Questions rows (static core-bank items
  show none).
- **2b — Skill filter.** `createQuestion` accepts `skills`; admin gets a comma-separated skills input;
  the public bank shows skill chips derived from `field.skills` ∪ each published question's `skills`,
  with a q/a/kp text-match fallback for the static bank.
- **2c — Status filter.** Admin → Questions gains an **All / 🔴 Draft / 🟢 Live** control beside the
  existing field/level filters (client-only; the `published` boolean already exists).
- **Tests:** `publishedFor` / `bank` plumbing carries `addedAt`; skill-match and status-filter
  predicates.
- **Representative files:** `supabase/content-sourcing.sql` (or an `admin.sql` alter),
  `src/services/remoteConfig.ts`, `src/services/admin/state.ts`, `src/services/admin/questions.ts`,
  `src/engine/bank.ts`, `src/components/admin/QuestionsSection.tsx`, the public bank component.

### Item B — Scraper run reports + cron job log (Enh 1) · admin visibility

- **B-migration:** `supabase/scraper-runs.sql` — a `scraper_runs` table **mirroring
  `jobs_fetch_reports`**: `id`, `ran_at`, `trigger ('cron' | 'manual')`,
  `status ('ok' | 'partial' | 'failed')`, `per_source jsonb`, `inserted int`, `errors int`; RLS
  admin-read + cron/service-write; prune trigger keeping the last ~50; indexes on `ran_at desc`,
  `trigger`, `status`.
- **B1 — run log.** `scrape-sources.js` writes one `scraper_runs` row after its upsert (reuse
  `runSql`). `runScraperNow()` in `scraper.ts` persists a `trigger:'manual'` row. Add
  `recordScraperRun()` + `listScraperRuns(filter)` to `scraper.ts` — filters map to Supabase clauses
  (`status`, `trigger`, `from`/`to`, and a text `q` ILIKE on source URL) and tolerate a missing table
  by returning empty. `ScraperSection` gains a **"🕷️ Scraper run log"**: a filter bar (status chips /
  trigger select / date range / URL search / Clear), accordion rows (collapsed = status dot +
  timestamp + trigger + totals; expanded = per-source table + raw JSON), a result count, and a
  "Load more" pager (10/page). Filters re-query the server.
- **B2 — cron job log.** New `src/services/ghActions.ts` with
  `listWorkflowRuns(workflow, filter, limit)` — GitHub REST `/actions/workflows/<id>/runs` (public
  repo, no token; native `status` / `conclusion` / `created` filters; graceful 403 → message + link).
  `ScraperSection` gains a **"⏰ Cron job log (GitHub Actions)"** card: status/job-type/date filters,
  collapsible rows (run metadata + best-effort step list + the **paired `scraper_runs` row** within
  ±30 min), and an "Open in GitHub" link. The job-type select covers `scrape-weekly.yml` and, once
  Item C / D-5 land, `jobs-playwright.yml` / `discover-weekly.yml`.
- **Tests:** filter→clause mapping + fake-client reads (`scraper-svc.test.ts`); GitHub URL building +
  run→row pairing with mocked `fetch`.

### Item C — Playwright job scraping (Enh 4) · isolated new pipeline

- **Workflow** `.github/workflows/jobs-playwright.yml`: daily + `workflow_dispatch`; installs Playwright
  + Chromium; runs only when `SUPABASE_ACCESS_TOKEN` is set (the same check-secrets guard as
  `scrape-weekly.yml`), `continue-on-error` on the scrape step.
- **Data** `content/job-playwright-targets.json`: curated JS-heavy **public** boards (e.g. Himalayas,
  YC "Work at a Startup", a RemoteOK HTML fallback, select company career pages) with per-target CSS
  selectors, UA, delays, and per-run caps. Anti-bot / ToS-protected sites are excluded. Targets are
  data — adding one needs no code change.
- **Script** `scripts/scrape-jobs-playwright.mjs`: extract title / company / location / URL /
  description → dedupe by `external_id` → upsert `jobs` with source **`"playwright"`** (host kept in
  `external_id` / `meta`) via `runSql` → write a `jobs_fetch_reports` row (per-target detail). Optional
  AI-normalize when the clean key is configured.
- **Feed** `src/services/jobs/feed.ts`: add `"playwright"` to `FEED_SOURCES` (single value → exact
  match works in both the round-robin query and the source filter). Jobs then flow through the existing
  dedupe / rank / match logic unchanged.
- **Tests:** target/URL + selector-extraction mapping with fixtures; feed round-robin includes the new
  source.

### Item D — Auto-Discovery Ingestion Engine + Takedown (Enh 3, FULL) · large, multi-PR

Split into five independently-shippable sub-items (each its own PR under the cadence). The sub-order
lets the two zero-I/O pure-logic PRs and the standalone takedown engine land before the crawler goes
live.

- **D1 — pure engines (zero I/O).** `scripts/discover-lib.js` (`classifySeed(url)` →
  github-topic / repo / html / json / sitemap; `planDiscovery`) + `scripts/crawl-lib.js`
  (`normalizeUrl`, `extractLinks`, `detectType`, a `Budget { maxDepth: 2, maxPages: 25/seed,
  maxTotal: 100 }`, a minimal `robotsAllowed`, and a **pluggable `createFetcher({fetchImpl})` seam** so
  Playwright rendering can slot in later). Vitest-only; mirrors the `scrape-lib.js` style.
- **D2 — orchestrator + storage + attribution.** `scripts/crawl-sources.js` (classify → BFS within
  budget → `extractItems()` → route: Q&A → `buildUpsertSql` → `published_questions` drafts → AI-clean →
  Review inbox; problem titles → `ai-draft-problems.js`; resource links → `discovered_resources`).
  `supabase/discovery.sql` adds `discovery_seeds` and `discovered_resources` (admin RLS). Attribution
  is captured for free from GitHub/HTML payloads into `meta.attribution`; **no-license repos are
  flagged and never auto-enter rotation** (a human approves). The crawler reports into
  `scraper_runs.per_source` (from Item B).
- **D3 — Takedown engine (standalone; also protects existing content).** `discovery.sql` adds
  `takedown_suppressions` + `takedowns` (audit) tables and, on `published_questions`,
  `status default 'active'` + `taken_down_at` + `takedown_reason`. `buildUpsertSql` gains an optional
  **suppression exclusion** (question-hash `NOT IN` suppressions) — backward-compatible. Removal is
  two-step: soft-delete (every read path filters `status != 'taken_down'`, mirroring the existing
  `published` pattern) → explicit hard purge. Propagation reaches **every** consumption point:
  `published_questions`, the RAG corpus (`gen-rag-corpus.mjs` / `seed-rag.mjs` re-seed —
  **`embed()` / `embedQuery()` keep throwing on failure**, and the `"text-embedding-3-small"` literal
  at `rag-eval.test.ts:209` is **not** touched), coding problems (`scripts/takedown.js` regenerates
  `aiGenerated.ts` excluding attributed problems → PR), discovered resources, client caches
  (content-version bump), and the credits page (recompute). An admin takedown UI (per-question /
  per-source / per-resource, reason capture, confirm) reuses the `question_audit` pattern.
- **D4 — admin discovery UI + credits/attribution display.** A "Discover from URL" card (classify
  preview → pending seed), a discovery approval queue (approved seeds join the scrape rotation;
  approved resources surface only after the **`resource-safety-guard`** passes — reuse
  `docs/resource-safety-guard.md`), and credit rendering (Review inbox "via &lt;repo&gt;" + license
  badge; Public Bank "Source ↗"; Skill Counselor "Community discovered"; a footer "Sources & credits"
  page).
- **D5 — skill-gap auto-discovery + weekly workflow.** `scripts/discover-skills.js` reads skill names
  from `skillCatalog.ts` → keyless GitHub repo-search + HN Algolia; gap-driven (only skills with fewer
  than N approved sources) → writes `discovery_seeds` rows with `origin:'skill-auto'` and
  `status:'pending'` (nothing crawls until approved). `.github/workflows/discover-weekly.yml` runs it
  budget-capped and approve-gated (optional `GITHUB_TOKEN` to raise rate limits).

**Recommended D sub-order:** D1 → D3 → D2 → D4 → D5. D1 (pure logic) and D3 (takedown) carry the least
risk and D3 hardens existing content before any crawler goes live; D2 turns discovery on behind the
approval gate; D4 exposes it to admins and surfaces credits; D5 automates seed generation last.

---

## 5. SQL migrations (all idempotent; run on Supabase before the matching code merges)

| Item | Migration file | Contents |
|---|---|---|
| A | `published_questions` alter | `skills jsonb not null default '[]'::jsonb` |
| B | `supabase/scraper-runs.sql` | `scraper_runs` (mirror of `jobs_fetch_reports`) |
| C | — | reuse the existing `jobs_fetch_reports` |
| D | `supabase/discovery.sql` | `discovery_seeds`, `discovered_resources`, `takedown_suppressions`, `takedowns`; `published_questions` `status` / `taken_down_at` / `takedown_reason` |

Every migration is written so that shipping the code before running it degrades gracefully (empty
reads, no crash), per §3.

---

## 6. Cross-cutting constraints (apply to every item at build time)

- **5 gates, sequential (build BEFORE vitest):** `npm run typecheck` → `npm run build` →
  `npx vitest run` → `npm run eval:rag` → `deno test supabase/functions/_shared/ --allow-all`.
  Baselines: **vitest 1292 / rag 41 / deno 72**. `reviewInbox-perf.test.ts` and `app.flow.test.tsx`
  are load-flaky — re-run them in isolation before treating a failure as a regression.
- **Security.** Any **client-side** fetch of a **user-supplied** URL (the "Discover from URL" card,
  "Run discovery now") routes through **`safeFetch`**, never raw `fetch()`. Server-side crawl scripts
  apply robots + budget + politeness instead. `embed()` / `embedQuery()` must keep throwing on failure.
  Do not change the `"text-embedding-3-small"` literal at `rag-eval.test.ts:209`.
- **Ship hygiene.** Stage files **by path** — never `git add .` (junk to keep out: `supabase/.temp/*`,
  `sql-payload.json`, `.freebuffruns.json`, `deno.lock`, `Claude-plan.txt`). Verify HEAD / ancestry
  before branching each item (a concurrent AI tool shares this working directory).
  `git push --no-verify` is the documented escape when the slow pre-push build hangs and the gates are
  already green. Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`;
  PR descriptions end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **The app must not crash** (testing phase) — every new read degrades gracefully pre-migration.

---

## 7. Explicitly out of scope (this phase)

- Playwright *rendering inside the discovery crawl* — the fetcher seam (D1) is built ready, but is not
  wired to a browser this phase.
- ToS / anti-bot-protected sites (e.g. GeeksforGeeks, InterviewBit).
- Any weakening of the human review / approval gate.
- Rotating the exposed service-role + agentrouter keys (owner-deferred "later"; tracked separately).
- pdfjs-dist `6.2.108 → 6.3.289` (a separate dependency item; no Dependabot PR yet).

---

## 8. Per-item verification (when each is built)

- **Item A:** create a published question with skills via the admin UI; confirm the "Added" chip and
  skill chips render in the public bank, the status filter toggles Draft/Live, and `publishedFor` tests
  carry `addedAt`. All 5 gates green.
- **Item B:** run `scrape-sources.js` (or "Run now") against a test source; confirm a `scraper_runs`
  row appears and renders in the run log with working filters and paging; confirm the cron-log card
  lists `scrape-weekly.yml` runs and pairs the nearest `scraper_runs` row; 403 path degrades to a
  message. All 5 gates green.
- **Item C:** dispatch `jobs-playwright.yml` manually; confirm `jobs` rows with source `"playwright"`
  appear, a `jobs_fetch_reports` row is written, and the feed surfaces them through the existing
  dedupe/rank. All 5 gates green.
- **Item D (per sub-item):** D1 — lib unit tests only. D3 — take down a question and confirm it
  disappears from every consumption path (bank, RAG, coding problems, resources, credits) and is
  audited. D2/D4/D5 — a discovered seed stays `pending` until approved, then crawls within budget,
  drafts land in the Review inbox with attribution, and credits render. All 5 gates green each.

---

_Last updated 2026-09-22. Build nothing from this doc until the specific item is requested._
