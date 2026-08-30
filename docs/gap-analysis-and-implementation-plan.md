# InterviewIQ — Gap Analysis & Implementation Plan

_Prepared 2026-08-30. Based on a full read of `src/` (~200 modules, ~58k LOC), `supabase/` (30+ edge functions, 40+ SQL files), the `docs/` planning set, and a full `vitest` run. Five parallel subsystem audits fed this synthesis; every finding below is cited to `file:line` and the highest-severity items were re-verified against the source._

---

## 1. Executive summary

InterviewIQ is a **large, genuinely mature product** — not a prototype. The core practice loop (onboard → tailored interview → scored feedback → history) is clean, offline-capable, and well-tested; billing is end-to-end server-side; the admin surface is extensive; the job-feed aggregator, incremental RAG indexer, and offline coach engine are all real and thoughtfully built.

The gaps are therefore **not "missing code" — they are integration, correctness, and truth-in-advertising gaps.** Six themes recur across every subsystem:

| # | Cross-cutting theme | Why it matters |
|---|---|---|
| **A** | **Empty shell on fresh install.** RAG corpus, jobs feed, and articles are all empty by default — no seed data anywhere. Every AI/content/jobs feature needs an admin to manually run a pipeline against a configured backend. | The three headline features look dead on a clean deploy. |
| **B** | **Silent degradation.** Features that look finished quietly do nothing and mislead: RAG returns empty while the UI labels answers "vector-grounded"; the URL summarizer feeds the LLM a bare URL; the System-Design tutor throws for cloud users; dead buttons; a fake leaderboard. No user-visible error fires. | Erodes trust precisely where the product should shine. |
| **C** | **Architectural fragmentation.** 5 parallel planning systems, 4 state layers (one fully dead), 2 entitlement files, 3 resource systems, 2 gap-analysis engines, divergent client/server model routing. | Same vocabulary, no shared data → features can't compound. |
| **D** | **The three user-named headline features are the weakest.** Resume-vs-JD scan, article-to-interview-summary, and system-design RAG are exactly the pillars with the biggest gaps. | The product's story and its reality have diverged most where it's pitched hardest. |
| **E** | **Correctness bugs hidden by tests.** A real-money Razorpay webhook bug is masked by a test that reproduces the same mistake; RAG defects are invisible because tests mock the whole pipeline; 20 tests are actually red but the build never runs them. | Green CI ≠ correct. False confidence. |
| **F** | **Not launch-hardened.** Pro gating is bypassable from devtools, forgeable license keys ship enabled, `proUrl` is empty, README describes a different (smaller, backend-less) app. | Monetization and onboarding are leaky. |

**The through-line:** the app's *foundation* is strong, but its *newer verticals* were built breadth-first and never wired into a shared data model or gated by tests that exercise real paths. The plan below fixes correctness first (Phase 0), makes the three headline features actually deliver (Phase 1), connects the silos (Phase 2), then hardens and de-duplicates the platform (Phase 3).

---

## 2. Evidence & method

- **Test reality:** `vitest run` → **20 failing / 956 passing (976 total), 7 of 80 files red.** Failures are drift, not logic rot: `ScraperSchedule` changed from `number[]` to `{days,hour,minute}` but the tests still assert the array; `tutorChat`'s error text changed ("No API key" → "Sign in to use AI…") without a test update. **The build never catches this:** `npm run build` runs `tsc -p tsconfig.build.json` (which *excludes* tests) + `check-no-innerhtml` + `vite build` — it does **not** run `vitest`. So the suite is red while CI can stay green.
- **Config reality:** `src/config.ts:35-38` ships a live Supabase URL + publishable key and `payment.provider: "razorpay"`, so the cloud paths are active in this deployment — but `README.md:7,22` still claims "No backend; everything runs in the browser and works without an internet connection."
- **Verified in source (not just reported):** the Razorpay base64/hex webhook mismatch (`payment.ts:200`), the silent RAG ungrounding (`rag.ts:270-276`), and the URL-summarizer stub (`Articles.tsx:994-999`).

---

## 3. Gap register (by pillar)

Severity: **P0** = correctness / launch blocker · **P1** = core promised value missing · **P2** = coherence / integration · **P3** = debt / polish.

### 3.1 Payments & platform core

| Sev | Gap | Evidence | Impact |
|-----|-----|----------|--------|
| **P0** | **Razorpay webhook signature encoded as base64, but Razorpay sends hex.** The primary grant path (subscription renewals, refund automation) would reject every live webhook. Masked because the unit test also generates base64 (a `hmacHex` helper sits unused right beside it). | `supabase/functions/_shared/payment.ts:200` (`btoa(...)` vs hex header at `:191`); `payments.test.ts:73` uses `hmacBase64`. Synchronous modal purchase via `pay-verify` uses hex correctly, so one-time buys still work. | Recurring revenue & refunds silently broken with live Razorpay. **Verify against Razorpay's current webhook spec, then fix encoding.** |
| **P0** | **Pro gating is trivially bypassable + forgeable keys enabled.** `getTier()` reads `localStorage["iq.tier"]`; server reconciliation only runs when signed in, so a guest sets `iq.tier="pro"` and stays Pro. `CONFIG.features.testLicensing:true` keeps the forgeable `IQPRO-XXXX` path live (its own comment says flip off before launch). | `entitlements.ts:48-55`, `Interview.tsx:21`, `entitlement.ts:99`, `config.ts:31`, `license.ts:21-27`. | Paywall is honor-system. |
| **P2** | **Redux Toolkit store is 100% dead code (~550 lines).** Mounted at `main.tsx:32` but there is no `useSelector`/`useDispatch` anywhere in `src/`. `adminSlice` even duplicates billing state React Query already owns; slice initializers eagerly hit storage at import. | `store/index.ts`, `jobsSlice.ts`, `adminSlice.ts`; only `react-redux` reference is the provider import `main.tsx:3`. | Dead weight; misleads every reader about "how state works." |
| **P2** | **Most user progress silently never syncs.** `SYNC_POLICIES` covers only 14 keys; everything else defaults to `"local"`. Device-local (no warning): `roadmapProg`, `skills`, `goal`, `codingTrack`, `career`, `resume`, all `sysDesign*`, `counselorPlan/Progress`. Also `tier`/`licenseKey` are LWW-synced yet `entitlement.ts` treats the server as authoritative → two mechanisms racing on one key. | `sync.ts:84-103`, `sync.ts:90-91` vs `entitlement.ts`. | Users lose roadmap/coding/system-design progress across devices. |
| **P3** | **i18n is a facade.** Switcher advertises 10 languages; only `en`+`hi` resources load (`hi` partial: 272/383 lines); other 8 fall back to English. Only 8 of 42 components call `useTranslation`; all question-bank content is hardcoded English. | `LanguageSwitcher.tsx:4-15`, `i18n/index.ts:13-16`. | Multilingual support is chrome-only and overstated. |
| **P3** | **README-vs-reality drift + storage-seam violations.** README claims no backend/offline while the app ships Supabase+Razorpay+RAG+admin; setup says "run `schema.sql`" (16 lines) when ~20 SQL files are needed. Unregistered localStorage keys (`iq.menuVisibility`, `iq.learnSlug`, `scraper_run_history`) bypass the sync/notify seam `storage.ts` claims to own. | `README.md:7,22,62-77,100-107`; `remoteConfig.ts:145`, `SkillExplorer.tsx:113`, `ScraperSection.tsx:31`. | Onboarding a new dev/operator is misleading. |

### 3.2 Resume · JD · Jobs portal

| Sev | Gap | Evidence | Impact |
|-----|-----|----------|--------|
| **P1** | **No "paste a JD, scan my resume against it" feature.** The capability you described first does not exist in the portal. `analyzeJd` exists but is wired only to interview setup/roadmap. Matching is resume-profile-vs-*feed-job* heuristic (token overlap), no embeddings/AI. | `jd.ts:84` never imported by `components/Jobs.tsx` or `services/jobs/*`; `services/jobs/match.ts:87`. | The headline resume feature is absent. |
| **P1** | **Portal is empty without Supabase + a signed-in manual refresh.** No seed/mock jobs; `refreshJobs()` hardcodes the project URL and throws "Sign in to refresh the job feed"; cron is a manual pg_cron SQL file the operator must hand-edit. | `services/jobs/feed.ts`, `jobs.test.ts:247`, `jobs-fetch-cron.sql`, `Jobs.tsx:505`. | First run / offline = blank feed → empty rankings & salary bands. |
| **P2** | **Resume-scan results dead-end.** The per-job gap plan reads roadmap topics but writes nothing back and even tells the user to self-track. Missing skills never create roadmap milestones, drills, or sessions. | `gapPlan.ts:44`, `GapPlanModal.tsx:56-59`. | Insight with no action; breaks the resume→prep loop. |
| **P2** | **Resume parsing degrades silently on real formats.** Skills come from a ~60-keyword substring dict; `preprocessResumeText` skips section-reflow when `>5` existing lines; experience extraction depends on pipe-delimited + date-range regex — so 2-column/graphic/table PDFs drop skills & roles with no error. No direct `resumeParser.ts` test. | `resumeParser.ts:163,568`; test gap (no test imports the parser directly). | Under-extraction on common resumes, invisibly. |
| **P3** | **Persistence asymmetry + "Kanban" mismatch.** Apply *statuses* sync (`user_sync` merge), but generated apply *kits* and *gap plans* are `"local"` only. There is no Kanban board — just per-card status dropdowns + a summary strip. | `sync.ts:87`, `applyKit/persistence.ts`, `MatchFeedCard.tsx:150`. | Tailored drafts don't follow the user; UX doesn't match the mental model. |

### 3.3 System Design · RAG · Coach · AI routing

| Sev | Gap | Evidence | Impact |
|-----|-----|----------|--------|
| **P0** | **Shared-key RAG is silently ungrounded.** Embeddings are client-only and key-gated with **no** server-proxy path (unlike chat). `retrieveContext` swallows the resulting throw and returns empty hits, while the UI still tags answers `citationsSource:"vector"`. So signed-in no-key users — the exact users the shared `ai-chat` key exists for — get ungrounded answers framed as source-backed. | `embeddings.ts:98`, `rag.ts:270-276`, `CoachChat.tsx:212`. | Invisible trust hazard on the RAG pillar. |
| **P0** | **System-Design tutor is dead for cloud users.** `explainSystemDesign`/`systemDesignChat` route through `chatForModule("tutor")`, which throws "No API key configured" with no `cloudChat` fallback — inconsistent with the coach/roadmap tutor that use `chat()`. | `systemDesignTutor.ts:128,167`, `ai.ts:62`. | A headline feature is broken for shared-key users. |
| **P0** | **RAG corpus is empty and the only automated indexer is broken.** No seed rows. `content-index` writes non-existent columns (`content`, `indexed`), forces a bigint `docId` into the UUID `rag_document_id`, and swallows every error. Only the client admin upload path (`indexer.ts`) actually populates chunks, and only if a server embeddings key is set. | `supabase/functions/content-index/index.ts:140-145,184,190` vs `admin.sql:192-200`, `content-curation.sql:59`. | Tutors ground on nothing out of the box. |
| **P1** | **Cross-provider embedding-space corruption (latent).** `embed()` uses whatever base/key the *current* client has; `pdf_chunks` carries no provider/model stamp, so query-time and index-time embeddings from different providers get cosine-compared → meaningless grounding once the corpus is populated. | `embeddings.ts`, `admin.sql` (`pdf_chunks`). | Will corrupt RAG the moment it's used at scale. |
| **P2** | **Divergent model routing + weak fallback.** Admin server-side `module:<id>` overrides only apply to `chat({module})`; `chatForModule` resolves models client-side and never hits the proxy, so server config is ignored for the tutor. `fallbackChain` only defines openai/gemini (`default:[]`), so router providers retry the same model. Quota/rate-limit checks fail-open. | `moduleModels.ts`, `fallbackChain.ts:9,15`, `aiCache.ts`. | Config surprises; no real resilience for BYOK routers. |

### 3.4 Articles & content pipeline

| Sev | Gap | Evidence | Impact |
|-----|-----|----------|--------|
| **P1** | **URL summarizer is a stub → hallucinated summaries.** The "paste a URL" path never fetches; a bare URL string is sent to the LLM as the article body. Only the paste-text path works. | `Articles.tsx:994-999`. | The article feature summarizes a page it never read. |
| **P1** | **Summaries aren't actually interview-targeted.** Output is a generic 3-level explainer; interview angles are prose buried in the `advanced` level. No discrete "likely interview questions / must-know concepts" field — even though `cleaner.ts` already extracts validated Q&A JSON for the *other* pipeline. | `articleNormalizer.ts:61,~83`; `cleaner.ts` `cleanTextToQuestions` wired only to `ImportSection.tsx:89`. | The "for interview prep" promise is only implicit. |
| **P2** | **Fragile / duplicated pipeline plumbing.** Admin scrape fallback does raw browser `fetch()` of arbitrary domains (CORS-doomed); the `content-refine` edge function is orphaned (client never calls it); refine/quality/normalize silently depend on the admin's own AI key. | `ContentCuration.tsx:344-371`, `supabase/functions/content-refine/*`. | Brittle, admin-key-coupled pipeline. |
| **P3** | **Dead `ContentProvider` abstraction (~430 lines) + zero core tests.** `getContentProvider` is referenced only inside its own module; no tests cover `normalizeUserArticle`, `refineContent`, or `contentQuality`. | `services/content/contentProvider.ts`, `content/index.ts:16`. | Load-bearing paths untested; dead code. |

### 3.5 Roadmap · Planner · Skills · Progress

| Sev | Gap | Evidence | Impact |
|-----|-----|----------|--------|
| **P2** | **Five parallel planning systems, no shared source of truth.** Career Roadmap, Planner, Skill Counselor, Skill Roadmap Explorer, and Job Gap Plan each have their own catalog, profile, and plan/progress store. Three band ladders, two gap-analysis engines, three "study plan" concepts. | `services/roadmap/*` vs `planner.ts` vs `skillCounselor.ts`+`skillCatalog.ts` vs `skillRoadmapService.ts` vs `gapPlan.ts`. | Root architectural gap; everything below is a symptom. |
| **P2** | **Admin-authored Skill Roadmaps are browse-only — primary actions are dead.** "Add to Study Plan", "Start Practice", "Share", and every per-step "Start →" have no `onClick`. Full admin CRUD + Supabase schema exist behind a non-functional consumer UI. | `SkillDetail.tsx:111-113,161`. | A whole content type is a dead island. |
| **P2** | **Fake/derived data in Progress.** Leaderboard peers are hardcoded simulations; XP is recomputed from sessions every render (never persisted/synced); Progress shows nothing from Roadmap or Counselor progress. | `xp.ts:180-196`, `Progress.tsx:154`. | Gamification is illusory; feedback loops incomplete. |
| **P2** | **Planner has no scheduling teeth.** Plan lives in component state (lost on nav), no persistence, no reminders/calendar export; the per-day "Drill" button discards the day's topics; duplicates the Roadmap's phase engine. | `Planner.tsx:25,135`, `planner.ts:66-86`. | "Planner" doesn't plan durably. |
| **P3** | **Missing tests** for `studyPlan.ts`, `skillRoadmapService.ts`, `certificates.ts`, `drill.makeDeck`. (Roadmap generation, diagnostic, gap plan, counselor, XP are well-covered.) | test-suite scan. | Regressions invisible in these modules. |

---

## 4. Implementation plan

Four phases, ordered so that **correctness and trust land before new surface area**. Each item lists the concrete edit target. Effort is rough dev-days for one engineer.

### Phase 0 — Stop the bleeding (trust & correctness) · ~1 week

Small, high-leverage fixes. Nothing here adds features; it makes what exists honest and correct.

1. **Fix the Razorpay webhook encoding.** Confirm Razorpay's webhook signature is hex, change `payment.ts:200` to emit hex, and **fix the test to use `hmacHex`** so it can never mask this again. _(0.5d)_
2. **Green the test suite + gate the build on it.** Update the `ScraperSchedule` fixtures (`scraper-svc.test.ts`) and `tutorChat` error-text assertions (`tutor.test.ts`); fix the 3 `tsc` fixture errors in `extracted-components.test.tsx`/`scraper-svc.test.ts`. Add `vitest run` (or at least `tsc --noEmit` over tests) to CI so red never ships green. _(1d)_
3. **Close the Pro-gating bypass for launch.** Flip `CONFIG.features.testLicensing:false`; make guest sessions treat unverified `iq.tier` as `free` until server reconciliation; remove `generateProKey` from the shipped bundle. _(1d)_
4. **Surface RAG grounding honestly.** In `retrieveContext`, distinguish "not attempted" / "attempted, 0 hits" / "failed (no key)" and stop `CoachChat.tsx:212` from unconditionally tagging `"vector"`. Show a "not source-grounded" state instead of implying citations. _(1d)_
5. **Give the System-Design tutor a cloud fallback.** Route `chatForModule` through `cloudChat` when no BYOK key + signed in, mirroring `chat()`. _(0.5d)_
6. **Rewrite the README** to match reality (backend required, Razorpay, RAG, the real SQL set, config steps). _(0.5d)_

### Phase 1 — Make the three headline features real · ~3 weeks

This is where the product's story becomes true. These map 1:1 to what you described.

7. **Resume-vs-JD scan (the missing headline).** Add a "Scan against a JD" panel in the portal that runs the resume profile against a pasted JD: reuse `analyzeJd` for keyword/skill/level extraction, score coverage (start with the existing `atsCoverage` token engine, then optionally upgrade to embeddings for semantic match), and render matched/missing skills, level fit, and blockers — the same card vocabulary as `MatchFeedCard`. Persist scans. _(5d)_
8. **Real article ingestion + interview targeting.** Add an SSRF-guarded `article-fetch` edge function (reuse the `safeFetch`/`contentScan` pattern already in the repo) so the URL path extracts real text; then extend `articleNormalizer` to emit a discrete **"likely interview questions + must-know concepts"** field by reusing `cleaner.ts`'s `cleanTextToQuestions`. _(5d)_
9. **Seed & fix the RAG corpus.** Fix `content-index`'s schema mismatch (`content`/`indexed` columns, bigint→UUID `rag_document_id`) and stop swallowing errors; ship a **starter corpus** (precomputed chunks for the core system-design + CS topics) so tutors are grounded on a clean install; stamp each chunk with its embedding provider+model and filter `match_pdf_chunks` by it to prevent cross-provider corruption. _(5d)_
10. **Add a server-side embeddings path.** Give embeddings the same shared-key proxy chat has (an `embed` edge function using the admin key), so signed-in no-key users actually get grounded RAG instead of silent empty hits. _(3d)_

### Phase 2 — Connect the silos · ~3 weeks

Turn parallel features into one compounding system.

11. **One profile, one skill graph.** Establish a single source of truth for skills/goal/profile (consolidate `SkillProfile` ↔ `CareerProfile` ↔ `iq.skills`) that all planning surfaces read. _(5d)_
12. **Wire resume-scan → prep loop.** Make gap-plan missing-skills create real Roadmap milestones / Drill decks / practice sessions (write-back), replacing the read-only dead-end and the "self-track" tip. _(3d)_
13. **Consolidate the planning surfaces.** Decide the canonical planner (recommend: Career Roadmap is the engine; Planner becomes its day-level view; Counselor's 90-day plan feeds the same store). Retire or redirect the redundant ones. _(4d)_
14. **Fix the dead Skill Roadmap UI.** Wire `SkillDetail.tsx:111-113,161` actions to practice/study-plan/share, connecting admin-authored roadmaps to the same prep loop. _(2d)_
15. **Expand sync coverage.** Add `roadmapProg`, `skills`, `goal`, `codingTrack`, `career`, `sysDesign*`, `counselorPlan`, apply-kits, and gap-plans to `SYNC_POLICIES`; resolve the `tier`/`licenseKey` LWW-vs-server race in favor of the server. _(3d)_

### Phase 3 — Harden & de-duplicate · ~2 weeks

16. **Delete dead code.** Remove the Redux store (`store/index.ts`, `jobsSlice.ts`, `adminSlice.ts`) and its provider, the orphaned `content-refine` function, and the unused `ContentProvider` module (~1,400 lines total). _(2d)_
17. **Real Progress data.** Persist XP, replace the simulated leaderboard with a Supabase-backed one (or clearly label it as a demo), and surface Roadmap/Counselor completion in Progress. _(3d)_
18. **Jobs feed out-of-the-box.** Ship a small seed feed + make the cron self-configuring (or a one-click admin "refresh now" that doesn't require hand-editing SQL). _(2d)_
19. **i18n honesty.** Either finish `hi` + add real content translation, or reduce the advertised set to what's actually supported. _(2d)_
20. **Test the load-bearing paths.** Add real (non-mocked) tests for `resumeParser` (with messy/2-column fixtures), `articleNormalizer`, `contentRefiner`, and a real RAG round-trip; add the missing `studyPlan`/`skillRoadmapService`/`certificates` suites. _(3d)_

---

## 5. Sequencing at a glance

```
Phase 0  (1 wk)  ── correctness & trust ─────────────►  ship-safe baseline
Phase 1  (3 wk)  ── 3 headline features become real ──►  the product's story is true
Phase 2  (3 wk)  ── connect silos into one loop ──────►  features compound
Phase 3  (2 wk)  ── delete dead code, harden, test ──►  maintainable & honest
```

**If only one week is available**, do Phase 0 — it removes a real-money bug, a paywall bypass, a trust hazard, and a red test suite, and makes the README honest, for ~5 dev-days.

**Biggest single lever for user-perceived value:** Phase 1 items 7–9 — they make "resume scan per JD," "summarize an article for interviews," and "system design with RAG" actually deliver, which is the gap between the product you described and the product that ships today.

---

## 6. What is already strong (don't touch)

So the plan isn't read as "the app is broken" — it isn't. Preserve: the Context-reducer practice loop and offline scoring engine; the server-side `pay-checkout`/`pay-verify` flow (HMAC, idempotency, coupons); the multi-source SSRF-guarded jobs aggregator; the incremental client RAG indexer (`indexer.ts`); the deterministic offline coach (`coach/*`); the algorithmic Career Roadmap (multi-signal, diagnostic-fed, well-tested); and the admin review-inbox/quality-scoring machinery. These are the foundation the plan builds on.
