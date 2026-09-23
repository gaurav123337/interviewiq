# Phase 4 — Progress & Session Memory

> Running record for the Phase 4 consolidated plan (`docs/phase4-enhancements-plan.md`).
> Cadence per item: plan → owner-approve → build (5 gates) → PR → merge → owner SQL step.
> Baselines move with each merged item — the table below is authoritative.

## Status snapshot (2026-09-23)

| Item | Scope | PR | State | Owner action after merge |
|---|---|---|---|---|
| A — Q-bank metadata & filters | `skills` column, Added chip, skill/status filters | #66 | **Merged + migrated + deployed** | done (`content-sourcing.sql` applied 2026-09-23) |
| B — Scraper run reports + GH Actions cron log | `scraper_runs`, run-log & cron-log cards | #67 | **Merged + migrated + deployed** | done (`scraper-runs.sql` applied 2026-09-23) |
| C — Playwright job scraping | `jobs` source `playwright`, targets data, daily workflow | #68 | **Merged + verified live** (34 jobs; YC 14, WWR 20) | none |
| D1 — Pure discovery engines | `discover-lib.js`, `crawl-lib.js` (zero I/O) | #69 | **Merged** | none |
| D3 — Takedown engine (standalone) | soft-delete + suppressions + audit + admin UI | #72 | **PR open, 5 gates green** | run `supabase/discovery.sql` |
| — hotfix: oversize upsert + ai-clean scope | batch-poisoning fix, cron AI-clean now works | #71 | **PR open, 5 gates green** | none |
| D2 — Discovery orchestrator + storage | `crawl-sources.js`, `discovery_seeds`/`discovered_resources` | — | not started | — |
| D4 — Admin discovery UI + credits | Discover-from-URL card, approval queue, credits pages | — | not started | — |
| D5 — Skill-gap auto-discovery + weekly workflow | `discover-skills.js`, `discover-weekly.yml` | — | not started | — |

Test baselines: Item A 1298 → B 1311 → C 1327 → D1 1345 → #71 1349 → D3 1361 (all with the 5-gate cadence: typecheck → build → vitest → eval:rag 41 → deno 72).

## Key decisions & facts (carry into D2/D4/D5)

- **Two report tables, cleanly split.** `scraper_runs` = question scraper + discovery crawler (D2 reports here, trigger `'cron'`). `jobs_fetch_reports` = jobs pipelines (`jobs-fetch` Edge Function + `scrape-jobs-playwright.mjs`). Both write via the management API (service role bypasses RLS); `scraper_runs` also has an admin INSERT policy so browser "Run now" reports survive RLS.
- **First live cron report (2026-09-23) exposed two pre-existing bugs** — both fixed in #71:
  1. One 28KB scraped question poisons the whole multi-row upsert (btree index-entry cap 8191 bytes). `MAX_QUESTION_CHARS=2000` + `partitionOversizeQuestions()` in `scrape-lib.js`; the cron marks the owning source's error in `per_source`.
  2. `ai-clean.js` `cleanOne()` referenced `aiKey/aiBase/aiModel` declared inside `main()` → `ReferenceError` per item; AI cleaning had never run in CI. Config hoisted to module scope.
- **Playwright selectors are verified live (2026-09-23)** but drift fast: YC cards are now `a[href^='/jobs/']` (title `h3 span`, company `p.font-semibold`); WWR is `a.listing-link--unlocked` + `.new-listing__header__title__text` / `.new-listing__company-name`. himalayas + remoteok targets are **disabled** — Cloudflare challenges block headless CI, and both boards are already covered by the existing feed (`rss:himalayas`, `remoteok:remoteok`). The Playwright workflow has **no `continue-on-error`**; the script exits 1 only when *every* target fails, and the `jobs_fetch_reports` row is written on every path.
- **`extractJob`'s `q` contract is a SYNC element view** (`{ textContent, getAttribute }`). Playwright handles are async — the scraper adapts them via `resolveViews()`. A regression test pins this; don't "simplify" it back to raw handles.
- **Takedown engine (D3) design facts:**
  - `question_hash = md5(lower(trim(question_text)))` — Postgres-side md5; JS-side `questionHash()` in `takedown-lib.js` matches it (RFC 1321 vector in tests).
  - `buildUpsertSql(rows, suppressions?)` — empty suppressions → byte-identical SQL to pre-D3. The cron applies `takedown_suppressions` best-effort.
  - Soft takedown = one insert into `takedowns` + one status update; the DB trigger maintains suppressions and `taken_down_at`. `publishedFor()` excludes `status='taken_down'` everywhere QA flows. Pre-migration fallback: unpublish only.
  - **RAG needs no propagation:** the corpus comes from static `content/rag-seed/*.md` (`gen-rag-corpus.mjs`), not scraped questions. Do not touch `embed()`/`embedQuery()` or the `"text-embedding-3-small"` literal in `rag-eval.test.ts`.
- **Migrations applied on the live project so far:** `content-sourcing.sql` (A), `scraper-runs.sql` (B, incl. admin-insert policy), `jobs.meta jsonb` (C). D3's `discovery.sql` is pending PR #72 merge.
- **Process hygiene that bit us:** `&&`-chains with pipes mask gate exit codes — verify each gate's `$?` (or `echo GATE=$?`) before declaring green. `import.meta.url` in vitest is not file-scheme here; browser-typed tests can't import `node:fs` (use `resolveJsonModule` JSON imports). Fake Supabase clients should be *returned* by the mocked `getSupabaseClient`, and model "column missing" as a single failing update, not a permanently dead table.
- **Recommended D sub-order** (per plan): D1 → D3 → D2 → D4 → D5. Next: D2 turns the pure engines (D1) into `crawl-sources.js` behind the approval gate, reporting into `scraper_runs.per_source`.
