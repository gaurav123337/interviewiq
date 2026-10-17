# Answer-Memory Reuse Stats + Trust Chips — Implementation Plan

**Timestamp:** **2026-10-17T13:20:00.000Z (UTC) | 17-10-2026 18:50:00 (IST)**

## Overview

Follow-ups to the Tier-3/4 work (PR #169), each turning an invisible mechanism
into owner-visible behavior, plus a supervised live pilot of the auto-apply engine.

## Changes

1. **🧠 Answer-memory reuse stats** — every field the engine FILLED straight
   from the remembered form answer now bumps a server-side counter:
   - pure lib: `planFormAnswers` marks each planned answer `fromMemory` (never
     marks profile drafts), pinned in `applyEngine.test.ts`;
   - SQL ([form-answer-reuse.sql](../../supabase/form-answer-reuse.sql),
     applied live via the linked CLI, catalog-verified): `reuse_count` +
     `last_used_at` on `form_answers`, service-only `engine_touch_form_answers`
     RPC, `admin_form_answer_stats()` for the panel;
   - driver: after each real fill, reused keys are touched (best-effort);
     [job-sites-db.js](../../../scripts/job-sites-db.js) exposes the touch;
   - UI: [ApplyResultsPanel](../../../src/components/jobs/ApplyResultsPanel.tsx)
     gains the 🧠 strip — per site "N stored · ↺M reuses".

2. **🎖 Trust chips in the Job Sites registry** — each row shows the SAME
   latch verdict the engine recomputes at its own run start:
   🏅 auto-submit earned / 🪫 review gate / 🔒 policy (linkedIn-class) —
   computed client-side from visible rows via
   `autoSubmitTrustVerdict`/`autoSubmitTrustPatch` in
   [jobSites.ts](../../../src/services/jobSites.ts) (`siteTrustState`), with
   the derivation regexes pinned against the lib contract. No rows → no chip
   (no history ≠ not trusted).

3. **Live bug fix (pilot-surfaced)** — `trySubmit`'s two Tier-3 heal branches
   referenced a bare `ai` that only exists on `ctx.ai` inside that function →
   every pinned-regex-miss submit crashed with "✗ ai is not defined"
   (observed live on the Naukri cycle, which recorded the honest error rows).
   Fixed to `ctx.ai`; takes effect on the engine's next process launch (the
   running cycle keeps its loaded module).

## Pilot findings (live engine, supervised observation)

- Engine processes are LIVE (`--listen` relay + `--all` cycle + a Naukri run),
  AI provider `allam-2-7b`; the whole agentic chain ran during observation:
  session-probe ✓ → collect (freshness-first) → skill-gate skips with named
  reasons → judge "apply" via owner-confirmed exemplar (fit 100) →
  AI-tailored kit → tier-2 field mapping cached for the week → click.
- Instahyre's registered jobs URL variants now return the board's own
  "page not found" to the signed-in account — stale URL to revisit.
- Skip-audit (7-day window, all boards): the 200 "not relevant" skips are
  navigation chrome titles ("Apply now", "Sign in for My Jobs") scraped from
  the CRAWLED boards — extraction junk, not false rejects; the skill gate's
  judge-side verdicts remain calibrated (0.6 threshold confirmed earlier).

## Verification

- typecheck 0; vitest **1729/1729**; build exit 0; no-innerhtml clean;
  `node --check` on all touched scripts; SQL applied + catalog-verified.

## Next steps

- Watch one full post-fix engine cycle for `🏅 auto-submit EARNED`.
- Fix Instahyre's stale board URL in the registry.
