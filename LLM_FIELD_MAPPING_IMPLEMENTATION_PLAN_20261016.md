# LLM Field Mapping (apply-agent Tier 2) Implementation Plan

**Timestamp:** **2026-10-16T10:58:00Z (UTC) | 16-10-2026 16:28:00 (IST)**

## Overview

Copes with the "cannot cope with changing website features" gap: when the
regex classifier (`classifyQuestion`) hits a form label it has never seen
("Preferred interview location", renamed CTC questions, reworded boards),
the engine now asks the SAME AI provider that judges JDs to map that field
to a profile fact — **verbatim copy only, never invented** — and caches the
mapped answer for a week, so the AI cost is once per *novel label*, not
once per form/application.

## Current State Analysis

- Pure logic in `scripts/apply-engine-lib.js` (+ hand-written
  `.d.ts`), pinned by `src/__tests__/applyEngine.test.ts` — per repo doctrine.
- `fillApplicationForm` (driver, [scripts/auto-apply-jobs.js](scripts/auto-apply-jobs.js)) already:
  extracted meta per control, planned answers (`planFormAnswers`), reused
  stored answers keyed by normalized label. Unknown labels that stayed
  empty were a permanent needs-review tax on the review queue.
- Provider plumbing exists in `scripts/apply-kit-node.js`
  (`loadAi`, `chatOnce` with transient retry).

## Implementation Phases (delivered in this change)

1. **Pure lib** — `aiFieldPrompt` / `parseFieldMapping` /
   `mappedValuePlausibleForProfile` / `applyFieldMapping` / `mappedAnswerFor`
   / `weekKeyForMap` in [scripts/apply-engine-lib.js](scripts/apply-engine-lib.js)
   with `.d.ts` types. Guards: verbatim fact containment, canned-answer
   verification, only `kind === unknown && !answer` slots ever filled,
   `unanswerable` stays blank (required+empty fails closed as before).
2. **Provider shim** — `mapUnknownFields` in
   [scripts/apply-kit-node.js](scripts/apply-kit-node.js): one provider call
   per form, fail-open to the untouched plan; returns the
   newly-mapped `{label → answer}` cache to persist.
3. **Driver wiring** — `fillApplicationForm(page, { ..., ai })`: cache
   pre-warm (no call on repeat labels), the map call, and
   `storeMappedAnswers(host, cache)` writing week-stamped
   `` `${label} · ${weekKey}` `` entries into the existing local answer
   cache. `ai` threaded into both ATS-filling call sites and the
   LinkedIn multi-step belt via `ctx.ai`.
4. **Tests** — six new cases pinning prompt-assembly, defensive parse,
   containment verifier, plan-fill narrowing and the stable week key.

## Technical Considerations

- **Never ranks above owner-confirmed answers:** the cache is consulted
  only where `planFormAnswers` drafted nothing; kinds that must never be
  reused (coverLetter/longText/unknown/workAuth/certificate) can't get in
  because mapping only targets kind `unknown`, and its outputs are stored
  under natural labels + the week key, never overwriting `form_answers`
  keys.
- **Fail-open everywhere:** no AI provider, empty prompt (nothing
  unknown-and-empty), provider error or unparseable reply → plan
  untouched → behavior identical to before the change.
- **Cost:** one judge-style call (~300 max_tokens) per *novel* label per
  host per week; zero per click.
- **Requires a configured AI provider** (Admin → AI provider). Without
  one the engine behaves exactly as before Tier 2.

## Success Criteria (verified)

- `node --check` passes on all three scripts.
- `npx vitest run src/__tests__/applyEngine.test.ts` → 146/146 (was 140).
- `npm run typecheck` exit 0.

## Next Steps

- Tier 1 (semantic locators) + Tier 3 (self-healing submit/apply
  selector fallback) + Tier 4 (earned auto-submit trust) per the
  roadmap discussion; Tier 2 composes with all of them.
- Non-function test for the driver's cache pre-warm path is not
  possible in CI (Playwright); the week-stamp format and the pure helpers
  it composes are pinned here instead.
