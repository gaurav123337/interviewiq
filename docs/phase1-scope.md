# Phase 1 — Scope & Build Plan (items 7–10)

**Plan:** [`docs/gap-analysis-and-implementation-plan.md`](gap-analysis-and-implementation-plan.md) · **Date:** 2026-08-30
**Baseline:** branch `gap-plan-and-phase0-fixes` @ `22312b0` (Phase 0 landed) · 983 tests green · `tsc --noEmit` clean

Phase 1 turns the honest-but-empty surfaces Phase 0 exposed into **real capability**:
the headline resume-vs-JD scan, real article ingestion, a seeded/queryable RAG
corpus, and the server-side embeddings path that makes grounding work for the
no-key majority.

Every `file:line` and design claim below was produced by a per-item scout, then
handed to an independent skeptic agent tasked to **refute** it against real
source. All four items came back **SOLID**; the medium/low corrections the
skeptics found are folded into the plans below (not left in an appendix). Three
of the highest-stakes claims were additionally hand-verified against source
before publishing this doc.

---

## Recommended build order

The dependency DAG is shallow — only one hard edge (`9 → 10`, `8 → 10`) — so the
order is driven by *risk* and *user-visible value*, not by a long critical path.

```
  7  ──────────────────────────────►  (independent, ships value day 1)
  10 ──►  9  ──►  8
          └──────►  (8 can start in parallel with 9; merges after)
```

| Order | Item | Why here | Effort |
|-------|------|----------|--------|
| **1** | **7 — Resume-vs-JD scan** | Fully unblocked by Phase 0's exec-aware `resume.ts`. Pure composition of already-tested pieces (`resumeToProfile` + `analyzeJd` + `matchJob` + `MatchFeedCard`). Zero infra risk, immediate headline value. | ~5d |
| **2** | **10 — Server-side embeddings** | The enabling infra. Clones the proven `chatForModule → cloudChat` ladder Phase 0 landed. Establishes the *single* embedding space that 9 and 8's indexing both require. Lowest infra risk. | ~3d |
| **3** | **9 — Seed & fix RAG corpus** | Depends on 10 (writes+reads must share one embedding space). Seeds a starter corpus and re-embeds the existing mixed-space chunks through the now-canonical path — flips the armed "no match" prompts into real citations. | ~6.5d |
| **4** | **8 — Article ingestion + targeting** | Ingestion hardening (safeFetch) + interview targeting can start *in parallel* with 9, but its RAG value lands only once articles embed into the fixed single space. Sequence its corpus merge after 9. | ~4.5d |

**Total: ~19 engineer-days.** Items 7 and (8's ingestion half) can run concurrently
with the 10→9 spine, compressing wall-clock.

> **Critical sequencing constraint (from cross-cutting analysis):** Item 10 flips
> the no-key population from `checked:false` → `checked:true`. That *arms* the
> CoachChat "💡 add this topic to the KB" button and the once-a-day
> `notifyKnowledgeGap()` for every no-key user. Against an empty corpus those fire
> truthful-but-useless "not in KB" everywhere. **10 must land before 9 seeds**, and
> the empty-embedding `checked:false` guard in `retrieveContext` must stay intact.

---

## Item 7 — Resume-vs-JD scan  ·  verdict SOLID · ~5d

**The gap:** the #1 headline capability the owner named — "paste a JD, scan my
resume against it" — does not exist. `analyzeJd` ([src/services/jd.ts:84](../src/services/jd.ts)) is
**never imported** in the Jobs portal.

**Why it's small:** Phase 0's `resumeToProfile()` now produces a correct
exec-aware `CareerProfile` (name-strip, title-split, seniority-based years). So
item 7 does **zero resume parsing** — it shrinks to a *JD → synthetic JobPosting
adapter* feeding the already-tested `matchJob()`, rendered through the existing
`MatchFeedCard` verdict vocabulary.

**Existing pieces reused (verified):**
- `analyzeJd` → `{fieldId, levelId, companyId, keywords}` ([jd.ts:84-94](../src/services/jd.ts))
- `matchJob(profile, job) → JobMatch` ([jobs/match.ts:87-166](../src/services/jobs/match.ts))
- `MatchFeedCard` verdict rendering + `VERDICT_META` ([jobs/MatchFeedCard.tsx](../src/components/jobs/MatchFeedCard.tsx), [match.ts:17-23](../src/services/jobs/match.ts))
- `atsCoverage` keyword coverage ([applyKit/ats.ts:12-23](../src/services/applyKit/ats.ts))
- `GapPlanModal` / `gapPlan.ts` for the "what to close" plan

**Build plan:**
1. Add a `JdScan` type + `STORAGE_KEYS.jdScans` ([types.ts](../src/types.ts), [storage.ts](../src/services/storage.ts)).
2. New `src/services/jobs/jdScan.ts`: `scanResumeAgainstJd(jdText, now)` — runs
   `analyzeJd`, builds a synthetic `JobPosting` (via `mapLevel` + `normalizeResume`
   to mine `job.skills` as **atomic labels in the same vocabulary the profile
   uses**, so `matchJob` compares like-for-like). The scan is *profile-independent*
   and persisted by a deterministic `scan:<contentHash>` id; the verdict is
   recomputed live by `matchScan(profile, scan)` so adding a missing skill
   re-scores it, exactly like the live feed.
3. New `src/components/jobs/JdScanCard.tsx` — a paste-JD box + the verdict card.
4. Wire into `Jobs.tsx`.

**Corrections folded in (from the skeptic pass):**
- **[MED] `mapLevel` was inverted.** `LEVEL_ORDER` ([match.ts:11](../src/services/jobs/match.ts)) is
  `{junior:0, mid:1, senior:2, lead:3, principal:4}` — it has **no** staff/cto/ceo.
  A naive map sends `ceo/cto → lead(3)`, *below* `staff → principal(4)`, which is
  backwards. **Fix:** map `ceo/cto/principal/staff` **all → `principal`** (the
  ceiling) so exec/senior-IC JDs never score as mid-level roles.
- **[MED] The level-fit test was backwards.** `levelFit` ([match.ts:73-80](../src/services/jobs/match.ts))
  fires its below-seniority blocker only when the role is **≥2 rungs below** the
  candidate. So "Staff JD vs junior profile" yields *"great target, no blocker"*
  (role is above), **not** a blocker. The test must assert a below-seniority
  blocker for the *inverse* (senior/principal candidate vs a junior-targeted JD).
- **[LOW] Scan persistence must round-trip.** A `JdScan` must persist its synthetic
  `JobPosting` (or deterministically reconstruct its id as `scan:${scan.id}`) so
  re-opening a saved scan re-renders the same verdict.
- **[LOW] `mergeScans` de-dupes on `updatedAt`,** not `createdAt` (re-scanning the
  same JD should replace, not duplicate).

**Pro-gating:** inherits Phase 0's fail-closed lock — `MatchFeedCard` already
renders "🔒 Match verdict" for locked users. Item 7 **reuses** that lock path; it
does not expose verdicts free. *(See open decision D3.)*

**Tests:** dedicated `src/__tests__/jdScan.test.ts` (15 tests) — `mapLevel` over
all seven `LevelId` values, title extraction/strip/fallback, remote detection, the
corrected level-fit direction, matched/missing split, live recompute, null-profile
path, deterministic id, and persistence (dedup / newest-first / delete / cap-at-20).
No RAG/embedding dependency.

---

## Item 8 — Real article ingestion + interview targeting  ·  verdict SOLID · ~4.5d

**The gap:** the "Paste URL" path is a **stub** — with no pasted text it sends the
**bare URL string** to the LLM as the article body ([Articles.tsx:994-999](../src/components/Articles.tsx)).
Summaries are also not interview-targeted.

**Existing pieces (verified):**
- `safeFetch` + `readBodyText` — SSRF-guarded, https-only, private/loopback/metadata
  ranges blocked, DNS re-resolved per redirect hop, body-size cap ([_shared/safeFetch.ts](../supabase/functions/_shared/safeFetch.ts)).
  **Gold-standard precedent:** `import-job` uses it for user-directed fetches.
- `content-scrape` uses **raw `fetch()` with `redirect:follow`** ([content-scrape/index.ts:66](../supabase/functions/content-scrape/index.ts))
  — the SSRF hole — but has a good `extractArticle` ([:156-252](../supabase/functions/content-scrape/index.ts)).
- `cleanTextToQuestions` — validated Q&A extraction ([cleaner.ts:26-52](../src/services/cleaner.ts)),
  currently wired only in `ImportSection.tsx:89`.
- `NormalizedArticle` ([articleNormalizer.ts:25-38](../src/services/articleNormalizer.ts)) — no interview field yet.

**Build plan:**
1. New **`article-fetch` edge function** — SSRF-guarded (mirror `import-job`),
   using `safeFetch` + `readBodyText`. Route the URL path through it instead of
   handing a bare URL to the LLM.
2. Promote `extractArticle` → **`_shared/articleExtract.ts`** so both `content-scrape`
   and the new function share one hardened extractor, and switch `content-scrape`
   off raw `fetch` onto `safeFetch` (closes the live SSRF — see risks).
3. Extend `NormalizedArticle` with optional `interviewQuestions` /
   `mustKnowConcepts`; populate via `cleanTextToQuestions`.

**Corrections folded in:**
- **[MED] Admin backfill is currently blocked.** `normalizeAndUpdateContent`
  short-circuits already-normalized items ([articleNormalizer.ts:358-362](../src/services/articleNormalizer.ts))
  and `batchNormalizeContent` null-filters them ([:452](../src/services/articleNormalizer.ts)).
  To backfill `interviewQuestions` onto existing articles, **relax the idempotency
  guard to re-run when `interview_questions` is missing** (or add a dedicated
  backfill query keyed on the missing field).
- **[LOW] `cleanTextToQuestions` has no module option** ([cleaner.ts:26-33](../src/services/cleaner.ts))
  — add one so targeting can request the interview-question module explicitly.

**Security constraint (binding):** any user-supplied URL fetch **must** route
through `safeFetch`, never the raw `fetch()` content-scrape uses today.

**Tests:** `safeFetch.test.ts` must-block corpus stays green; new tests for the
article-fetch function and the targeting field.

---

## Item 9 — Seed & fix the RAG corpus  ·  verdict SOLID · ~6.5d

**The gap:** the automated indexer is **broken**, and there is no starter corpus —
so a clean install grounds on nothing.

**Confirmed defects (hand-verified against source):**
- content-index **inserts columns that don't exist**: `content` ([index.ts:142](../supabase/functions/content-index/index.ts))
  and `indexed` ([:144](../supabase/functions/content-index/index.ts), [:180](../supabase/functions/content-index/index.ts))
  on `pdf_documents` → **PGRST204** at runtime.
- It pushes a **bigint `docId`** into `content_items.rag_document_id` ([:186](../supabase/functions/content-index/index.ts)),
  which the schema types as **UUID** → type mismatch.
- It **swallows all errors** ([:172](../supabase/functions/content-index/index.ts), [:190-192](../supabase/functions/content-index/index.ts))
  → the indexer reports success while indexing nothing.
- `match_pdf_chunks` ([admin.sql:234-245](../supabase/admin.sql)) has **no provider/model
  filter** → cross-provider vectors get compared under one cosine threshold
  (see the corruption risk below).

**Build plan:**
1. Rewrite content-index to insert only real columns and surface errors.
2. Add **provider/model stamping** to `pdf_chunks` + a **filtered** `match_pdf_chunks`
   RPC so only same-space vectors are ever compared.
3. Add `pdf_documents.content_item_id` FK (or the simpler column-type change — see
   D5) and thread it through `pdfDocs.ts` / `rag.ts`.
4. Ship a starter corpus + `scripts/seed-rag.mjs`.

**Corrections folded in:**
- **[MED] The link-model change has readers the plan missed.** Switching to
  `pdf_documents.content_item_id` and deprecating `content_items.rag_document_id`
  breaks existing readers: [contentCuration.ts:47](../src/services/contentCuration.ts),
  [:171](../src/services/contentCuration.ts), and the curation badge in
  `ContentCuration.tsx` (~:602/610/615). **Either** update those readers **or** take
  the smaller change: make `rag_document_id` a **bigint** to match `pdf_documents.id`
  (see decision D5).
- **[MED] `CREATE OR REPLACE FUNCTION` cannot change an argument list.** Adding a
  provider/model filter changes `match_pdf_chunks`'s signature, so the migration
  must `DROP FUNCTION match_pdf_chunks(vector(1536), integer)` **first**, then
  recreate (precedent: [rag.sql:11](../supabase/rag.sql)).
- **[LOW] `embed()`'s no-key throw is at [embeddings.ts:100](../src/services/embeddings.ts)** (not :107-108,
  which is the `!res.ok` path).

**Depends on 10** — a seeded corpus is only queryable by the no-key majority, and
only self-consistent, if writes and reads share **one** embedding space. The "fix"
half is literally re-embedding the existing mixed-space chunks through the
canonical shared-key path (item 10).

**Tests:** `rag-eval.test.ts` golden set stays green; new tests for the corrected
insert, the provider/model filter, and seed idempotency.

---

## Item 10 — Server-side embeddings path (shared-key)  ·  verdict SOLID · ~3d

**The gap:** `embed()` is client-only and key-gated — `if (!s.key) throw` at
[embeddings.ts:100](../src/services/embeddings.ts). So a signed-in no-key user's query embedding throws →
`retrieveContext` returns `checked:false` → **no grounding for the majority**.

**Why it's low-risk:** it mirrors the exact `chatForModule → cloudChat` ladder
Phase 0 already landed, and reuses the admin-key resolution `ai-chat` already does
([ai-chat/index.ts:126-147](../supabase/functions/ai-chat/index.ts)).

**Build plan:**
1. New **`supabase/functions/embed/index.ts`** mirroring `ai-chat` (resolves the
   admin-configured provider key server-side; key never reaches the client).
2. New **`_shared/embedProvider.ts`** — the single provider/model/dimension
   resolver shared by the query proxy and the content-index write path (this, not
   the proxy's return payload, is what keeps index-time and query-time vectors in
   the same space).
3. Add **`embedWithMeta()` → `{vectors, model, provider}`** for callers that need
   the stamp — **without changing `embed()`'s `number[][]` contract**.

**CRITICAL constraint (binding, verified):** `embed()` **must keep throwing** on
failure. A *second* caller — `indexer.reindexDocument()` ([indexer.ts:43-63](../src/services/indexer.ts)) —
stores whatever `embed()` returns; if `embed()` returned `[]` on failure it would
**permanently corrupt the KB** with empty vectors. "Honest empty" lives in
`retrieveContext`'s catch (→ `checked:false`), **never** in `embed()`.

**Corrections folded in:**
- **[MED] There is no way to configure a separate embeddings provider.** The
  documented provider base is **OpenRouter**, which has **no `/embeddings`
  endpoint**. `saveAiProviderConfig` ([aiProvider.ts:70-84](../src/services/aiProvider.ts)) is hardcoded to
  `key='provider'`, and `ConfigSection.tsx` only edits `key='provider'`. So the
  proxy cannot work by "reusing `key='provider'`" unless that provider happens to
  serve `/embeddings`. **This is the blocker in decision D1.**
- **[LOW] RLS citation:** the admin-only RLS on `ai_provider_config` is at
  [ai-provider.sql:18-27](../supabase/ai-provider.sql) (not :9-16, which is the table definition).
- **[LOW] Reframe of the item-9 hand-off:** item 10 unblocks no-key **query
  grounding**; the shared `embedProvider.ts` (not the proxy's returned
  `{model,provider}`) is what keeps index/query spaces aligned for 9's stamping.
  The returned metadata is a consistency check, not the stamp source.

**Considerations the skeptic surfaced (not blockers):**
- `embeddings.test.ts`'s "throws without a key" test passes today only because
  `cloud.ts` defaults `user=null`. The new no-key+signed-in case **must add a
  `../services/cloud` mock** (the `aiChat.test.ts:9-13` pattern) and **keep the
  terminal throw** so the indexer's empty-vector safety holds.
- A non-1536-dim model **fails silently today**: `searchPdfChunks` ([pdfDocs.ts:105-112](../src/services/pdfDocs.ts))
  swallows the dimension error and returns `[]`, so `retrieveContext` would emit a
  misleading `checked:true` with zero hits. The embed function's **1536-dim guard**
  is the right place to catch this.
- No server-side rate-limit on the proxy — this **matches** existing behavior
  (`cloudChat` also skips quota checks), so it's consistent, not a new regression.
  Still worth a deliberate decision (D2).
- CORS needs no change and real JWT verification is a drop-in: `_shared/cors.ts`
  already allows POST/OPTIONS and `callerFrom()` ([auth.ts:26-35](../supabase/functions/_shared/auth.ts)) already
  does real `getUser()` verification — so verify the caller properly rather than
  mirroring `ai-chat`'s weak token check.

**Tests:** `embeddings.test.ts` (BYOK unchanged; no-key+signed-in → POST
`/functions/v1/embed`; no-key+guest → still throws); Deno `_shared/embedProvider.test.ts`
(provider ladder, model resolution, 1536 guard); `indexer.test.ts` unchanged
(confirms the contract held).

---

## Cross-cutting

### How Phase 0 reshaped these items
- **RAG honesty fix** (grounded-only citations; `checked:false` on empty/error;
  CoachChat gates on `checked && !grounded`) → Phase 1 builds real grounding onto
  an **already-honest** surface. But the surface is *honest-because-empty*; item 10
  flipping `checked:false → true` arms the add-to-KB prompts for everyone, so **10
  must precede 9**.
- **`resume.ts` exec-aware extractors** → item 7 does **zero** parsing; the
  seniority signal `matchJob` scores on is now correct.
- **`chatForModule → cloudChat` ladder** → item 10 mirrors it exactly (a proven,
  tested pattern for a new endpoint, not a new design).
- **Pro gating fail-closed** → item 7's verdict inherits the lock unchanged.
- **983-test + tsc gate** (CI + pre-push) → every item keeps the suite green and
  adds tests for new paths; embed()-signature or chunker-size changes ripple into
  `embeddings.test.ts` / `indexer.test.ts` / `rag-eval.test.ts`.

### Shared infrastructure (build once, used by many)
| Artifact | Shared by |
|----------|-----------|
| SSRF-guarded fetch (`safeFetch`/`readBodyText`) | 8, 10 |
| Shared-key embed proxy (`embed` fn / `embedProvider.ts`) | 10 → 9, 8, (7 optional) |
| Provider/model/dimension stamping on `pdf_chunks` | 9, 10, 8 |
| Canonical chunker (converge client 2400/240 vs server 800/200) | 9, 8, 10 |
| Match/verdict vocabulary (`VERDICT_META`, `jdMining`) | 7 |
| Module-routing ladder (`chatForModule`/`cloudChat`) | 10, 8 |
| RAG health analytics (`rag_event` → admin tab) | 9, 10 |

### Top risks
1. **Cross-provider embedding-space corruption — LIVE in code today.** `pdf_chunks`
   mixes vectors from the BYOK-admin indexer and the server-OpenAI content-index,
   while queries are embedded by yet another provider — all compared under one 0.45
   cosine threshold in one `vector(1536)` column. Cosine across different spaces is
   meaningless. *Mitigate:* item 10 (one canonical path) + model/provider stamping
   + a full re-embed in item 9.
2. **SSRF** in content-scrape (raw `fetch` + `redirect:follow`, no guard). Item 8
   must adopt `safeFetch`; item 10's proxy must only ever call the fixed provider
   host.
3. **Honesty regression** from flipping `checked:false → true` before the corpus is
   seeded (10→9 ordering + keep the empty-embedding guard).
4. **The test gate** — signature/chunker changes ripple across the embedding suites;
   budget test churn per item.
5. **Cost/latency/rate-limits** of seeding + the one-time re-embed on a single
   shared key — must batch (embed() takes arrays), be idempotent, be budgeted.
6. **1536-dim contract** — a shared-key model that isn't 1536-dim silently breaks
   inserts and search; guard on the write path.

---

## Open decisions (product-owner sign-off before implementation)

These genuinely change what gets built — none should be guessed:

- **D1 — Embeddings provider (BLOCKER for item 10).** OpenRouter (the documented
  provider) has no `/embeddings` endpoint. Options: **(a)** add a dedicated
  `ai_provider_config key='embeddings'` row + minimal service/UI to configure it,
  falling back to `key='provider'` when absent *(recommended — also fixes the
  content-index hardcoded-OpenAI divergence)*; **(b)** MVP: hand-seed the embeddings
  row via SQL and document it (less work, no UI). *Everything downstream of 10
  waits on this.*
- **D2 — Keyless embedding scope (item 10).** May keyless signed-in users embed
  only **queries** via the proxy (cheap: one short string), while **indexing** stays
  admin/BYOK-only? *Recommended: query-only* (indexing a corpus on the shared key is
  a real cost/abuse surface).
- **D3 — JD-scan Pro-gating (item 7).** Keep the verdict/reasons/gap-plan behind the
  existing Pro lock, or expose the scan free as an acquisition hook? *Recommended:
  inherit the existing fail-closed Pro lock.*
- **D4 — Article-fetch scope (item 8).** Is the new fetch **admin-only** (curated
  sources) or **user-facing** (any user pastes any URL)? And do we honor
  `robots.txt`? *Recommended: SSRF-guarded for both, admin-curated sources first;
  honor robots.txt for polite crawling.*
- **D5 — RAG link model (item 9).** Take the cleaner `pdf_documents.content_item_id`
  FK (requires updating the `contentCuration` readers + badge), or the smaller
  `rag_document_id` UUID→bigint column change (fewer files, keeps the current link
  direction)? *Recommended: the smaller bigint change for Phase 1; revisit the FK in
  the Phase 2 consolidation.*
- **D6 — Seed corpus content (item 9).** Author ~10–15 **original** short docs
  in-repo (system design + CS fundamentals) seeded via `scripts/seed-rag.mjs`, to
  avoid licensing questions? *Recommended: yes, original in-repo content.*

---

*Scoped by a 9-agent adversarial workflow (scout → skeptic-verify per item +
cross-cutting synthesis); all four items SOLID; corrections folded in above.*
