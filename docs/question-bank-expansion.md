# InterviewIQ — Question-Bank Expansion Plan (AI-only content team)

> Context: the app has **no human content team** — content is produced by the existing
> **self-improving pipeline** (weekly scraper → drafts → admin review → publish) plus
> optional **AI cleaning**. This plan grows the question bank from that same machinery,
> using only the low-risk sources researched (GitHub raw · Hacker News API · LeetCode
> mirrors · GfG polite scraping · TeamBlind manual). Every item still lands as a **draft
> in the Admin review inbox** — the owner stays the final gate, but the volume work is
> zero-human.

---

## 0. What already exists (build on this, don't reinvent)

| Piece | Where | Notes |
|---|---|---|
| Weekly scraper | `.github/workflows/scrape-weekly.yml` → `scripts/scrape-sources.js` | Daily cron; `scraper_config.schedule` decides the day; sources live in `scraper_sources` (Admin-editable), fallback `content/sources.json` |
| Extractors | `scripts/scrape-lib.js` | `json` / `markdown` (`N. ### Q`, `#### Topic`, `?`-line fallback) / `html` — pure, unit-testable |
| Draft inbox | `published_questions` (`published=false`) | Admin → Question bank → review & publish; `ON CONFLICT (question)` dedupe |
| AI cleaning contract | `src/services/cleaner.ts` | OpenAI-compatible, strict-JSON output, reject-on-unparsable — the pattern to reuse server-side |
| Coding bank + self-tests | `src/data/codingBank/*` + `src/__tests__/algorithms.test.ts` | Every problem ships a `reference`; the bank self-test proves prompt+tests are consistent before publish |
| Legal guardrails | `docs/phase2-platform-integrations.md` | robots.txt, rate limits, no login-gated access, no automation of third-party flows |

**Constraint that shapes everything:** no humans → every new source must either (a) produce
review-ready drafts automatically, or (b) be AI-cleaned into review-ready drafts. The admin
review stays one-click (publish), never writing.

---

## 1. P1 — GitHub raw (zero restriction) → biggest win, smallest effort

The repo already consumes `raw.githubusercontent.com` markdown (sudheerj banks, backend
questions, data-science theory). Extend the same source list — **zero new machinery**:

| New source | URL (raw) | Field / use | Why |
|---|---|---|---|
| System Design Primer | `donnemartin/system-design-primer` → `README.md` | system-design | Kills the *"no system-design depth"* con |
| Tech Interview Handbook | `yangshun/tech-interview-handbook` → `README.md` | frontend/backend/general | Curated "grind 75"-style content |
| LeetCode Patterns | `SeanPrashad/leetcode-patterns` → `README.md` | coding metadata | Pattern → problem mapping feeds roadmap + coding bank |
| LeetCode company-wise | `hxu296/leetcode-company-wise-problems-2022` → `README.md` | company tags | Company-tagged problem lists — directly feeds `codingCompanies.ts` |
| Awesome interview resources | `DopplerHQ/awesome-interview-questions` | general | Breadth filler |

**New extractor (`company-list`)** — one addition to `scrape-lib.js`: the company-wise/patterns
READMEs are `### Company` / `#### Pattern` headings followed by `- [N. Title](url) Difficulty`
lines (no `?`, so the existing markdown extractor skips them). New pure function
`extractCompanyList(md, source)` → `{ question: title, company, difficulty, url }`, unit-tested
against a fixture. Item shape extends `normalizeItem` with optional `company`/`difficulty`/`url`.

**Data model:** add `source_id text` + `source_url text` + `meta jsonb` (company, difficulty,
pattern) to `published_questions` (defaults safe; existing rows fine). Keeps provenance and
lets the AI cleaner do its job with context.

*DoD: sources added to `content/sources.json` + dashboard, extractor unit-tested, one manual
workflow run lands ~100+ drafts.*

---

## 2. P2 — Hacker News official API (zero restriction) → trends + fresh questions

HN's public **Algolia API** (`https://hn.algolia.com/api/v1/search?query=…&tags=story`)
needs no key. This is also the **trends engine** opportunity — real, current signal instead of
only the GitHub release sweep in `trends-refresh`.

**New source type `hackernews`** in `scrape-lib.js`:
- Query set (configurable): `"interview questions"`, `"system design interview"`,
  `"behavioral interview"`, `"Ask HN: interview"` — `tags=story&hitsPerPage=50`.
- Extract stories whose titles are questions or thread-worthy → draft question
  `{ question: title, answer: "", meta: { url, hnId, points, comments, author } }`.
- **Politeness:** one API call per query, once per run, cached by `hnId` in `meta`;
  `hn.algolia.com` rate-limits generously but the script must honor 429 with backoff.
- **Deduping:** HN story titles collide with curated drafts — the existing
  `ON CONFLICT (question)` handles it; the AI cleaner (P3) merges threads with >5 comments
  into richer answers.

**Trends wiring (stretch, same phase):** the scraper already runs daily — a `trends_hn`
table (title, url, points, comments, first_seen) lets `Admin → Trends` show *"what engineers
are discussing this week"* without new infrastructure. Optional; do only after P2 core ships.

*DoD: `hackernews` extractor + tests, source enabled, run lands drafts with source URLs.*

---

## 3. P3 — AI cleaning pipeline (the "AI tutor replaces the content team" step)

Today scraped drafts arrive raw — the owner cleans them by hand. With no humans, add a
server-side AI cleanse between extraction and the review inbox:

- **New script `scripts/ai-clean.js`** (same shape as `scrape-sources.js`, same Management-API
  SQL runner): picks drafts with `published=false AND answer=''` (or flagged `needs_clean`),
  batches them, calls the **OpenAI-compatible endpoint** configured by a new optional secret
  (`AI_CLEAN_KEY` + base/model in `scraper_config`; absent → skip silently, pipeline still works).
- **Prompt contract** = the `cleaner.ts` pattern: strict JSON out
  `{ question, answer, keyPoints[], difficulty, company?, pattern? }`; unparsable → reject,
  leave the draft for manual review (never fabricate).
- **Rules baked into the prompt:** rewrite/paraphrase so we never store verbatim third-party
  text (LeetCode/GfG statements are copyright — titles + patterns are metadata, prompts are
  our own); answer = original, keyed to InterviewIQ scoring; difficulty 1–3; company tags only
  when the source (or the cleaner) has evidence.
- **Cost controls:** only clean items missing answer/keyPoints; cap per run (default 40);
  max tokens per item; the secret is optional so a free-tier project never breaks.
- **Coding-bank variant:** for `company-list` items, the AI also emits `{ prompt, starters?,
  hidden tests }` — but **nothing from AI ships without passing the bank self-test harness**
  (each generated problem's reference solution must pass its own visible+hidden cases). This is
  the quality gate that makes AI-authored problems trustworthy.

*DoD: `ai-clean.js` + unit tests for the JSON contract, dry-run mode, one end-to-end run
through the review inbox with zero manual edits.*

---

## 4. P4 — Coding bank growth (LeetCode-adjacent, copyright-safe)

Goal: `algorithms.ts` 20 → 60 + a pattern catalog, without copying LeetCode.

1. **Metadata from mirrors** (P1): company-wise + patterns READMEs give titles, companies,
   difficulty — **not** statements.
2. **AI drafts** (P3): for each title, AI writes an original prompt + reference solution +
   hidden tests (the same discipline the human-authored bank already uses).
3. **Gate:** bank self-test must pass; flagged failures go to the review inbox, never the bank.
4. **Taxonomy:** extend `src/data/codingMap.ts` so patterns (two-pointer, sliding window,
   DP, heap, graph, interval, bit, design) map to roadmap topics — `coding-gap-plan.md`'s
   "category → topic" wiring applies unchanged.
5. **Company tags** reuse `codingCompanies.ts`; tags flow into "grind this company's patterns".

*DoD: 60 self-tested algorithm problems; pattern filter in the Playground picker; no verbatim
third-party statement in the bank (AI paraphrase + review gate).*

---

## 5. P5 — GfG (medium) & TeamBlind (very low) — honest, optional

- **GeeksforGeeks:** medium restriction → **separate opt-in workflow** (not the daily scrape):
  a `scrape-gfg.yml` using Playwright with the research's politeness rules (random 3–7s
  delays, off-peak UTC, robots.txt respected, low concurrency), only from GitHub-mirrored or
  public article pages, extracted via the existing `html` extractor. **Defer** until P1–P3
  prove volume; GfG's marginal value over the GitHub banks is low.
- **TeamBlind:** per the research, never automate — **manual quick-add playbook**: admin pastes
  a thread (title + top replies) into the existing Question-bank composer; the AI cleaner
  (P3) formats it into a draft with keyPoints. One documented workflow, zero scraping.

*DoD (whenever built): GfG run lands drafts with source attribution; TeamBlind playbook page
in docs; both respect the platform guardrails in `phase2-platform-integrations.md`.*

---

## 6. Sequencing & effort

| Phase | Effort | Impact | Ships |
|---|---|---|---|
| **P1 GitHub raw** | S (extractor + sources) | High — 4–5 new domains, system-design gap closed | ✅ shipped (8 sources live, 158 drafts) |
| **P2 HN API** | S–M (extractor + politeness) | High — freshness + trends signal | ✅ shipped (2 HN sources live) |
| **P3 AI cleaning** | M (script + contract + gates) | **Critical** — makes "no humans" viable | ✅ shipped (`ai-clean.js` + `AI_CLEAN_KEY` in CI) |
| **P4 Coding bank 60** | M–L (AI drafts + self-tests) | High — answers the #1 con | 🚧 machinery shipped (`ai-draft-problems.js` + `ai-problems.yml` → review PR); bank grows via the workflow |
| **P5 GfG / Blind** | L / S | Low–Med | Defer / manual |

Order: **P1 → P3 → P2 → P4**, P5 when the rest is breathing. Each phase ships with unit tests
+ a manual workflow run, matching the repo's existing test/typecheck gate.

## 7. Non-negotiable guardrails

1. **No login-gated access, no session reuse, no CAPTCHA bypass** — everywhere, always.
2. **robots.txt + rate limits + off-peak** for anything beyond raw/API sources.
3. **Provenance on every draft** (`source_id`, `source_url`) — attribution is both honest and
   a review aid.
4. **No verbatim third-party statements in the bank** — AI paraphrase + review gate; titles/
   patterns/companies are facts, prompts are ours.
5. **AI is an assistant, not an author-of-record** — everything it produces is a *draft* the
   owner can one-click publish or reject, and unparsable output is never retried into the bank.
