# Phase 0 — Completion & Feature-Tracking Report

**Branch:** `gap-plan-and-phase0-fixes` · **Date:** 2026-08-30
**Plan:** [`docs/gap-analysis-and-implementation-plan.md`](gap-analysis-and-implementation-plan.md) (Phase 0, items #1–#6)

Phase 0 = "stop-the-bleeding" launch blockers: security correctness, an honest
build gate, closing the Pro bypass, honest RAG UX, the tutor working for
signed-in users, and truthful docs. All six items are implemented and verified.

---

## Status at a glance

| # | Item | Status | Verified by |
|---|------|--------|-------------|
| 1 | Razorpay webhook HMAC → hex + timing-safe | ✅ Done | `payments.test.ts` (accepts hex, rejects base64) |
| 2 | Green suite + hard build/CI test gate | ✅ Done | full suite green; CI + pre-push wired |
| 3 | Close Pro-gating bypass (guest can't hold Pro) | ✅ Done | `billing.test.ts`, `features.test.ts`, `growth.test.ts` |
| 4 | Surface RAG grounding honestly | ✅ Done (hardened) | `withGrounding` source fix + `withGrounding.test.ts` (4 guards) |
| 5 | System-design tutor cloud fallback | ✅ Done (hardened) | 3 direct `chatForModule` ladder tests in `aiChat.test.ts` |
| 6 | Rewrite stale README | ✅ Done | cross-checked vs config/SQL/functions |

**Suite:** 81 files · **983 tests · all passing** (142s) · `tsc --noEmit` clean.

---

## What changed, per item

### #1 — Razorpay webhook signature (security)
The webhook verifier compared a **base64** HMAC against Razorpay's header, which
is actually **lowercase hex** — so it never matched (webhooks would be rejected,
and the encoding mismatch masked the lack of a constant-time compare).
- `supabase/functions/_shared/payment.ts` — compute hex digest, compare with
  `timingSafeEqualHex` (same path the checkout callback already used).
- `src/__tests__/payments.test.ts` — asserts the correct hex HMAC is accepted
  **and** a base64 HMAC of the same body is **rejected** (regression guard).

### #2 — Test suite is now a real gate
Previously CI ran `npm test || echo "⚠️ …deploy not blocked"` (non-blocking) and
never type-checked tests (the build uses `tsconfig.build.json`, which excludes
them). A red suite could ship.
- `.github/workflows/deploy.yml` — `npm test` is now **blocking**; added
  `npm run typecheck` (type-checks app **and** tests) before the build.
- `.husky/pre-push` — mirrors CI: `tsc --noEmit` (incl. tests) + `vitest run`.
- Flaky tests fixed rather than muted: `app.flow.test.tsx` (async timeout +
  cheaper queries under parallel CPU contention) and `reviewInbox-perf.test.ts`
  (self-contradictory wall-clock budgets made internally consistent).
- Stale-assertion tests aligned to already-improved behavior (turning the suite
  honestly green, not muting it). The substantive one: `resumeMatch.test.ts`
  expected composite skill labels the normalizer no longer emits, and
  `src/services/resume.ts` was made to trust its exec-aware extractors
  (name-stripping, `"CTO Frontend Engineer"` → `CTO / Frontend Engineer`
  splitting, seniority-based year estimate) over the flat normalizer's hardcoded
  3-years / raw-title, which had been corrupting the seniority signal the company
  matcher scores on. Assertion-only refreshes elsewhere: `applyKitPhase4`,
  `extracted-components`, `scraper-svc`, `tutor`, `billing`, `features`,
  `growth`, `setup`.

### #3 — Pro-gating bypass closed (defense-in-depth)
A guest could grant themselves Pro with `localStorage["iq.tier"]="pro"`.
- `src/services/entitlements.ts` — `getTier()` now fails closed to `"free"` for a
  signed-out visitor (Pro is an **account** property). A signed-in user keeps Pro
  offline (session persists; server tier already mirrored locally).
- `src/config.ts` — `features.testLicensing: false` (was `true`): forgeable
  `IQPRO-XXXX` format keys are rejected in production.
- `src/services/license.ts` — `activatePro()` already gates on `testLicensing()`,
  so the format-key path is inert; `generateProKey` is test-only (tree-shaken).
- Tests updated to assert the **secure** behavior (guest → free; stored value
  untouched for later server reconciliation).

### #4 — Honest RAG grounding
The tutor/coach could imply an answer was source-grounded when retrieval had
failed **or** when it returned only below-threshold near-misses.
- `src/services/rag.ts` — `retrieveContext()` returns `{ hits: [], checked: false }`
  on error **and** when the query embedding is empty (retrieval never actually
  ran), so callers never claim "we searched".
- `src/services/tutor.ts` — **`withGrounding()` now emits citations only for hits
  that clear the grounding threshold** (was: all hits, tagged `grounded:false`).
  This was the defect the adversarial pass caught (see below): the "📚 Grounded ·
  N sources" badge is keyed on citation *presence*, so below-threshold citations
  made the UI claim grounding — and simultaneously show the "add this topic to the
  KB" prompt — on an answer the model was told to give from general knowledge.
  Fixing the single producer makes the "Grounded" *badge* truthful for every
  consumer (CoachChat, FloatingCoach, RoadmapTutor) at once — no per-UI badge
  re-check needed.
- `src/components/CoachChat.tsx` — the one UI-level honesty concern the producer
  fix can't cover: the "💡 add this topic to the KB" button was keyed on
  `!grounded` alone, so it showed even when retrieval never ran (`checked:false`).
  Now gated on `checked && !grounded`; the citation-source label is likewise only
  set when citations actually exist.
- `src/__tests__/withGrounding.test.ts` — **new**: 4 guards (all-below-threshold →
  no citations + gap notice; mixed → only grounded cited; all-grounded → all cited;
  `checked:false` → silent).

### #5 — System-design tutor works for signed-in users
`chatForModule()` threw for users without their own API key, even when signed in.
- `src/ai.ts` — ladder: BYO key → (signed-in) cloud proxy → clear error
  `"Sign in to use AI, or add your own API key in Settings → AI."`
- `src/__tests__/aiChat.test.ts` — **new**: 3 direct `chatForModule("tutor", …)`
  tests (signed-in keyless → cloud proxy with the module id; BYOK → local endpoint,
  not the proxy; guest → throws, no fetch). The adversarial pass found the fix was
  correct but **untested** — the prior suite only exercised the sibling `chat()`,
  so a revert of this rung would have slipped through. Now covered directly.

### #6 — README rewritten to match reality
Removed the false "**No backend; everything runs in the browser**" headline and
the duplicate/empty `## Privacy` sections.
- `README.md` — documents the offline **core** vs. backend-dependent **connected**
  features; Razorpay + server-verified Pro; the RAG tutor; the job portal; that
  `schema.sql` is only cloud-sync while per-feature SQL files exist; edge-function
  deploy; `config.ts` keys (supabase + payment provider + feature flags).

---

## Adversarial verification

## Adversarial verification

Each fix was handed to an independent skeptic agent (one per item) whose only job
was to **refute** it — hunt for a bypass, a missed path, or a regression against
the *real* code, defaulting to "broken" unless it genuinely couldn't. Verdicts:

| # | Item | Verdict | Outcome |
|---|------|---------|---------|
| 1 | Razorpay webhook hex + timing-safe | **SOLID** | No holes. Ran `payments.test.ts` → 44/44; confirmed no base64 compare survives. |
| 3 | Guest can't hold Pro | **SOLID** | All 4 sub-claims verified in code. One out-of-scope caveat (see below). |
| 4 | Honest RAG grounding | **INCOMPLETE** → **fixed** | Real defect found & closed (below). |
| 5 | `chatForModule` cloud fallback | **INCOMPLETE** → **fixed** | Code correct but untested; direct tests added. |
| 6 | README matches reality | **SOLID** | Stale "no backend" claim confirmed removed; backend documented. |

Item #2's verifier agent aborted on a transient provider error (HTTP 405), not a
finding. The gate is independently confirmed: `deploy.yml` runs `npm test`
**blocking** + `npm run typecheck`, and `.husky/pre-push` mirrors both.

**What the skeptics broke, and how it was resolved:**

- **#4 (RAG) — false-grounding path.** `withGrounding()` built citations from
  *all* retrieved hits, including those below the similarity threshold
  (`grounded:false`). Because the UI keys the "📚 Grounded · N sources" badge on
  citation *presence*, an off-topic question (e.g. a system-design query against a
  frontend-only KB) surfaced 4 near-miss chunks as "Grounded" **and** showed the
  "💡 add this topic to the KB" prompt on the *same* message — self-contradictory,
  and a false grounding claim on an answer the model gave from general knowledge.
  **Fix:** `withGrounding()` now emits citations only for threshold-clearing hits
  (and feeds only those to the model as context); the empty-embedding path reports
  `checked:false`. Locked in by `withGrounding.test.ts`. Fixing the single producer
  makes CoachChat, FloatingCoach and the RoadmapTutor all honest at once.

- **#5 (tutor) — coverage gap.** The `chatForModule` ladder was correct and
  unbreakable, but *no test referenced it* — the suite only covered the sibling
  `chat()`. A revert of the signed-in cloud-fallback rung would have shipped green.
  **Fix:** 3 direct `chatForModule("tutor", …)` tests added to `aiChat.test.ts`.

- **#3 (Pro) — accepted out-of-scope caveat.** A user who *forges the Supabase
  auth-session key* in localStorage reads as "signed-in", after which a forged
  `iq.tier` would be honored **client-side only**. This is not the guest bypass
  this item closed (it now correctly treats guests as free), requires forging the
  session rather than the tier, grants **no** server resource (all server checks
  reject a forged JWT), and self-corrects on the next real `refreshEntitlement()`.
  The client tier is not a security boundary; real Pro is server-verified. Tracked,
  not a Phase 0 blocker.

---

## Not in Phase 0 (tracked for later phases)

These are called out in the implementation plan and are **intentionally out of
scope** for this branch:
- Phase 1+: feature depth (job-feed sources, résumé parsing accuracy, roadmap
  quality), broader RAG corpus, Stripe as a second provider, observability.
- Untracked working-tree files unrelated to this work were **left uncommitted**:
  `supabase/.temp/*` (Supabase CLI local state), `sql-payload.json`,
  `.freebuffruns.json`. These should be `.gitignore`d separately.
