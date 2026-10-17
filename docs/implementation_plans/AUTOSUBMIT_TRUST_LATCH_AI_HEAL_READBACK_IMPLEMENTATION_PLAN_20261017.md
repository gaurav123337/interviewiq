# Auto-Submit Trust Latch + AI Heal Readback — Implementation Plan

**Timestamp:** **2026-10-17T12:35:00.000Z (UTC) | 17-10-2026 18:05:00 (IST)**

## Overview

Tiers 3–4 of the auto-apply hardening plan ([Claude-plan.txt](../../Claude-plan.txt)):
introduce an easing-on-evidence **auto-submit trust latch** per job site (recomputed
per run from server-side `apply_results` history — no stored trust flag), and make the
**AI heal flow verifiable** (button readback + answer recording) instead of
fire-and-forget. All pure decision logic lives in `scripts/apply-engine-lib.js`
(pinned by vitest); the Playwright driver only executes what the pure layer decided.

## Current State Analysis

- `scripts/apply-engine-lib.js` already classifies apply outcomes, holds site
  trust tiers, and exports `parseHealReply` / `healLocatorTypesFor` for the
  existing Tier-2 review→heal round-trip.
- `scripts/auto-apply-jobs.js` (Playwright driver, local-only, uncovered by
  design) had heal applied as best-effort with no readback, and submit trust
  driven by a static per-site rule.
- Answer memory exists: `public.form_answers` + `engine_get/put_form_answer`
  (see [review-queue-form-memory.sql](../../supabase/review-queue-form-memory.sql)).

## Implementation Phases

1. **Tier 3 — heal readback (done).** Kit shim `aiHealButton` in
   `scripts/apply-kit-node.js` replays the label back to the model; the driver
   records heal answers into `form_answers` via `engine_put_form_answer`; a
   selftest (`APPLY_SELFTEST`) pins the wiring.
2. **Tier 4 — pure trust latch (done).** `autoSubmitTrustVerdict(rows)` in the
   pure lib: requires ≥`requiredRuns` healthy rows, tolerates ≤`maxWeakRuns`
   weak rows (modeled-unknown), blocks outright on any unverified submit; plus
   a platform-prohibition blocklist (LinkedIn never auto-submits regardless of
   trust). Driver reads recent `apply_results` via
   `engine_list_apply_results(host, n)` and latches per host for the run.
3. **SQL wiring (done, applied live).** `engine_list_apply_results_for_host(p_host, p_limit)` RPC in [apply-config-and-results.sql](../../supabase/apply-config-and-results.sql): returns the host's recent `apply_results` rows (result + detail timestamps cap 200); service-role only (revoked from anon/public, re-created idempotently). There is deliberately **no persisted trust flag**: the latch is recomputed from server evidence at the start of every run, so an owner run with `--no-trust`-style explicit registry rules always wins and trust can silently snap back. While applying, the live `admin_list_apply_results` was found ahead of the file (it selects `posted_age_h int` + `feedback text`, added by later PRs) — the file was reconciled to the live row type instead of dropping, so the UI panel keeps its columns.

## Technical Considerations

- Driver rules must merge the latch verdict with the site's own trust tier;
  the blocklist wins over everything (fail closed).
- `tsconfig.build.json` excludes tests → run `npm run typecheck`, not just build.
- New latch RPC is additive; existing consumers degrade to an honest skip when
  it is not applied yet.

## Success Criteria

- `npm run typecheck` clean (includes tests, catches `.d.ts` drift).
- `npx vitest run src/__tests__/applyEngine.test.ts` — latch + heal pinned.
- `node --check` on every touched script.
- Driver never auto-submits a blocklisted platform or an untrusted site.

## Completion Summary

- All three gates passed: typecheck ✓, 222/222 tests ✓, syntax ✓.
- One real bug surfaced by the gates: the `.d.ts` interface said
  `respondedName` while the implementation exposes `respondentName` — types
  corrected to match the implementation (test assertions kept aligned with the
  designed semantics: one weak row tolerated, two block, unverified blocks).
- Applied live via the linked CLI (`npx supabase db query --linked --file …`,
  the path this repo used for #98 Platinum when the Management token isn't
  configured): Executed green; catalog-verified — RPC exists and is revoked
  from anon/public, `feedback`/`posted_age_h` columns intact.

## Next Steps

- No pilot host flip is needed — trust is evidence-computed per run, not stored.
  Live preflight (2026-10-17): all five active hosts show only skipped/review
  rows in their recent windows, so auto-submit currently stays at the review
  gate everywhere (correct fail-closed behavior); the attached command starts
  accumulating `submitted` evidence the moment the owner runs it.
