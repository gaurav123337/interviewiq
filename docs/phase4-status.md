# Phase 4 — Implementation Status (updated)

> **Updated 2026-09-25.** Companion to the authoritative plan
> [`docs/phase4-enhancements-plan.md`](phase4-enhancements-plan.md) (approved 2026-09-22) and the
> running log [`docs/phase4-progress.md`](phase4-progress.md). This doc answers one question:
> **what is implemented, what is not, and where reality deviated from the plan.**
>
> One-line summary: **all plan items (A, B, C, D1–D5) are implemented, merged, migrated, and
> live-verified.** Everything below the plan line was owner-driven follow-up. A small set of
> open items remains — none blocks the shipped features.

---

## 1. TL;DR — plan items

| Plan item | Scope | PR(s) | Status | Live verification |
|---|---|---|---|---|
| **A** — Q-bank metadata & filters | `skills` column, Added-on chip, skill + Draft/Live filters | #66 | ✅ **Done** | `content-sourcing.sql` applied 2026-09-23; filters live in bank + admin |
| **B** — Scraper run reports + cron job log | `scraper_runs` table, run-log + cron-log admin cards | #67 | ✅ **Done** | `scraper-runs.sql` applied 2026-09-23; first cron report same day (exposed 2 pre-existing bugs, fixed #71) |
| **C** — Playwright job scraping | `jobs` source `playwright`, targets data, daily workflow | #68 | ✅ **Done** (2 of 4 targets disabled — see §2 Item C) | 34 jobs ingested live (YC 14, WWR 20) on 2026-09-23 |
| **D1** — Pure discovery engines | `discover-lib.js`, `crawl-lib.js` (zero I/O) | #69 | ✅ **Done** | unit tests only (as planned) |
| **D3** — Takedown engine | suppressions + audit + soft-delete + admin UI | #72 | ✅ **Done** | `discovery.sql` applied 2026-09-23 |
| **D2** — Discovery orchestrator + storage | `crawl-sources.js`, `discovery_seeds`, `discovered_resources` | #75 | ✅ **Done** | `discovery.sql` re-applied 2026-09-24 (see correction below); live round: 15 pages, 28 drafts, 114 resources, 0 errors |
| **D4** — Admin discovery UI + credits | Discover-from-URL, approval queues, credits surfaces | #76 | ✅ **Done** | `discovery-public-read.sql` applied 2026-09-24; approved-only public view verified |
| **D5** — Skill-gap auto-discovery | `discover-skills.js`, `discover-weekly.yml` | #77 (+fix #78) | ✅ **Done** | first run queued 17 pending seeds; re-dispatch verified |

Plan sub-order recommendation (D1 → D3 → D2 → D4 → D5) was followed exactly.

---

## 2. Per-item detail — what shipped vs the plan

### Item A — Question-bank metadata & filters ✅
Everything planned shipped: the `skills jsonb` migration, the **Added-on date** end-to-end
(`created_at` → `addedAt` → "Added <date>" chips in public Bank + admin), the **skill filter**
(admin comma-separated input on publish; public-bank chips from `field.skills` ∪ row tags with
q/a/kp text fallback), and the **Draft/Live status filter**.

Deviations / post-plan extensions (owner-driven, all merged):
- **#82** made the public-bank skill chips **multi-select** (legacy single-string arg kept for
  `drill.ts`); added review-first triage and a skills backfill.
- **#84** (2026-09-25, owner-reported via screenshots) extended skill filtering to the **admin**
  surfaces — the plan had only specified the public bank. Added `adminSkillChips` +
  `FilterChip` shared UI + backfilled 91 rows live.
- **#85** (owner decision) changed multi-select from **AND to OR** (`matchesAnySkill`) after AND
  zeroed out cross-tag selections; includes an empty-selection guard (`[].some()` is false).
- **#86** (owner-reported) made the **Review Inbox** skill chips work on the untagged backlog: the
  triage worker now derives tags per draft (`draftSkills`: explicit tags win, else
  `deriveSkills(question+answer)`), so chips + filter are live without DB writes.
- **Editorial push** (2026-09-25, owner-approved live writes): 233 answered drafts published with
  derived tags, 6 duplicates deleted. **Bank: 36 → 269 published; tag coverage 24/36 → 203/269
  (75%)** after a second 91-row backfill. Tag vocabulary validated against `FIELDS`/`LevelId`
  (the #82 mis-field lesson).

### Item B — Scraper run reports + cron job log ✅
`scraper_runs` table (mirror of `jobs_fetch_reports`, prune to 50, admin-insert policy),
`recordScraperRun()` / `listScraperRuns(filter)` with server-side filters, the
**🕷️ Scraper run log** card (filter bar + accordion rows + paging), and the
**⏰ Cron job log (GitHub Actions)** card with run↔report pairing (±30 min) and "Open in GitHub".

Deviations:
- The cron-log job-type select covers more workflows than planned: `crawl-weekly.yml` (#79) and
  `revalidate-weekly.yml` (#80) registered in `ghActions.WORKFLOWS` too.
- The first live cron report immediately exposed two **pre-existing** bugs (28 KB question poisoned
  the multi-row upsert; `ai-clean.js` `cleanOne()` `ReferenceError`) — both fixed in hotfix #71,
  plus #73 (missing `yellow()` helper crashed the nightly after extraction) and #74 (oversize drops
  are notices, not errors — nightly exits 0 again).

### Item C — Playwright job scraping ✅ (with 2 disabled targets)
Workflow, `content/job-playwright-targets.json` (targets are data), `scrape-jobs-playwright.mjs`
(source `"playwright"`, host in `external_id`/`meta`, reports into `jobs_fetch_reports`), and the
`FEED_SOURCES` addition — all as planned. Live-verified 2026-09-23.

Deviations:
- **himalayas + remoteok targets are disabled** — Cloudflare challenges block headless CI, and both
  boards were already covered by the existing feed (`rss:himalayas`, `remoteok:remoteok`).
- The planned `continue-on-error` on the scrape step was **not** used: the workflow has no
  continue-on-error; the script exits 1 only when *every* target fails, and the
  `jobs_fetch_reports` row is written on every path.
- Selector drift is a known maintenance item: YC/WWR selectors were verified live 2026-09-23 but
  drift fast (see §5).

### Item D — Auto-Discovery + Takedown ✅ (all five sub-items)
- **D1** pure engines, including the pluggable `createFetcher({fetchImpl})` seam (Playwright
  rendering deliberately not wired — plan §7).
- **D2** orchestrator: crawls **approved** seeds only (approval gate = crawl trigger), BFS within
  Budget, robots-checked, routes yield to Q&A drafts / problem candidates / resources, reports into
  `scraper_runs` (trigger `'cron'`).
- **D3** takedown: `question_hash = md5(lower(trim(question_text)))` matched JS-side; suppressions
  applied pre-insert in `buildUpsertSql` (empty suppressions → byte-identical SQL); DB trigger
  maintains `taken_down_at`; every public read filters `status='taken_down'`.
- **D4** admin UI: Discover-from-URL (classify preview via the crawler's own classifier), seed +
  resource approval queues, credits (`meta.attribution` → "via owner/repo ↗" chips, public
  `#/sources` page, Counselor "Community discovered" strip). Approved resources surface through a
  read-only public view over `status='approved'`.
- **D5** skill-gap discovery: deterministic keyless proposals (GitHub repo-search + HN Algolia),
  gap rule = fewer than 2 approved resources per skill, deduped against **all** known seed URLs,
  budget-capped 20/run, queued as `pending`.

Deviations / corrections worth remembering:
- **Migration correction (2026-09-24):** an earlier note claimed D2's tables were already live —
  a live catalog query proved only D3's tables existed. `discovery.sql` was re-run (idempotent).
  Lesson: **verify migrations with an information_schema query, never from session memory.**
- **GitHub search pages are JS-rendered** — the crawler sees nav chrome, not results. The first live
  round's 114 resource rows were all adjudicated rejected. Rule: approve `html` seeds on **content
  pages** (topics, blogs, repos), not search-result pages. A keyless GitHub-REST search path remains
  a **future improvement** (§5).
- **Cron/scraper no longer auto-publish** — the ReviewInbox is the only publish path (owner policy
  during the live rounds).
- **RAG needed no takedown propagation** — the corpus comes from static `content/rag-seed/*.md`, not
  scraped questions (the plan's RAG re-seed point is a no-op until that changes).
- Follow-on hardening beyond the plan: **#81** draft-quality pipeline (`noiseReason` hard-noise drop,
  `looksTruncated` review-first, `deriveSkills` canonical tags, oversize partitioning), **#83**
  draft-pile audit + 5 topic shelves (System Design, Design Patterns, SOLID, TDD, FP), and
  2026-09-25's 4 more shelves (Machine Learning with a `regression testing` guard, Data Structures,
  Microservices, Concurrency) plus the **CSS `less` alias fix** (it was matching the English word
  "less").

---

## 3. SQL migrations — all applied ✅

| Migration | Applied | Verified |
|---|---|---|
| `content-sourcing.sql` (A: `skills` column) | 2026-09-23 | via live reads |
| `scraper-runs.sql` (B, incl. admin-insert policy) | 2026-09-23 | via live cron report |
| `jobs.meta jsonb` (C) | 2026-09-23 | via Playwright upserts |
| `discovery.sql` (D3+D2: takedown + discovery tables) | re-applied 2026-09-24 | `information_schema` catalog check |
| `discovery-public-read.sql` (D4 public view) | 2026-09-24 | approved-visible / pending-hidden verified |

---

## 4. Post-plan additions (not in the original plan)

| Addition | PR | Purpose |
|---|---|---|
| Hotfixes: oversize upsert partitioning, ai-clean scope fix, `yellow()` helper, oversize-notices | #71, #73, #74 | make the nightly cron actually run green |
| `crawl-weekly.yml` dispatch workflow | #79 | the crawler's CI execution lever (schedule intentionally omitted) |
| L5 resource re-validation cron + admin Discovery smoke test | #80 | `resource-safety-guard` §3 — unreachable resources auto-quarantine to `pending` |
| Draft-quality filter + derived skill tags | #81 | kill noise before insert; canonical 🛠 tags everywhere |
| Multi-select skill filter, triage, backfill, editorial pass | #82 | bank usability; mis-field correction |
| Draft-pile audit + topic shelves | #83 | classify 527 drafts; delete 58; raise tag coverage |
| Admin skill filters + FilterChip extraction + live tag backfill | #84 | skill filtering on admin Question Bank + Review Inbox; coverage 42% → 75% |
| Skill chips AND → OR | #85 | owner decision after AND zeroed cross-tag sets |
| Review Inbox derived skill chips | #86 | chips/filter work on the untagged backlog |
| Editorial push (live data op) | — | bank 36 → 269 published; 6 dupes deleted; pile 469 → 230 |

---

## 5. Not yet implemented / open items

**Owner actions (blockers outside the repo):**
1. **AI-clean key is rejected (`AI HTTP 401`)** — the nightly's AI-clean step can't run until a
   valid key is pasted in Admin → Secrets → AI pipeline. This is the single biggest lever: it
   unblocks auto-answering the 227 answerless drafts below.
2. **Key rotation** (service-role key + agentrouter key) — owner-deferred "later", tracked
   separately (plan §7).

**Feature work not yet built (candidates for a Phase 5 / follow-up phase):**
3. **Keyless GitHub REST search path for discovery** — GitHub *search-result pages* are JS-rendered,
   so search-page seeds yield nav chrome instead of results. The REST API path (or the D1 fetcher
   seam) would fix the discovery blind spot properly.
4. **L5 content-marker drift** — scaffolded (`storedMarker`), pending the resource-safety-guard's
   L3 server-side fetch.
5. **Playwright rendering inside the discovery crawl** — the fetcher seam (D1) is built ready but
   deliberately not wired (plan §7, still out of scope).
6. **Playwright target selector drift** — YC/WWR selectors verified live 2026-09-23 only; treat
   silent zero-yield as drift. himalayas/remoteok stay disabled unless Cloudflare is bypassed.
7. **`pdfjs-dist 6.2.108 → 6.3.289`** — no Dependabot PR yet (plan §7).

**Data still in the backlog (by design, not missing code):**
8. **227 answerless drafts** — good titles, no answers; blocked on item 1 (AI-clean key). The
   audit→publish pass can be re-run once they're cleaned.
9. **5 truncated-but-answered review-first drafts** (#1386, 1398, 1399, 1400, 1409) — held behind
   the human gate; the classifier fires on terse titles but content is fine. Publish or prune
   manually.
10. **64 published rows intentionally untagged** — `deriveSkills` had no confident signal; the
    filter's text fallback still matches them.
11. **`discovery:6/7` live round queue** — fully drained (3 republished with corrections, rest
    deleted/adjudicated) as of #82/#83.

---

## 6. Out-of-scope confirmations (unchanged from the plan)

- ToS / anti-bot-protected sites (GeeksforGeeks, InterviewBit) — not scraped.
- No weakening of the human review / approval gate — nothing auto-publishes; the Review Inbox is
  the only publish path.
- RAG corpus untouched by takedown (static seed files) — `embed()`/`embedQuery()` still throw on
  failure; the `"text-embedding-3-small"` literal in `rag-eval.test.ts:209` unchanged.

---

## 7. Current gate baselines (moved with each merge, as the cadence requires)

| Gate | Baseline at plan approval (2026-09-22) | Now (2026-09-25, post-#86) |
|---|---|---|
| vitest | 1292 | **1452** (+160) |
| eval:rag | 41 | 41 |
| deno | 72 passed / 0 failed | 72 passed / 0 failed |

`reviewInbox-perf.test.ts` and `app.flow.test.tsx` remain load-flaky under parallel load — re-run in
isolation before calling a failure a regression.

---

_Last updated 2026-09-25 after PRs #84–#86 (admin skill filters, OR semantics, derived inbox chips)
and the editorial/backfill data operations. For the blow-by-blow record see
[`docs/phase4-progress.md`](phase4-progress.md)._
