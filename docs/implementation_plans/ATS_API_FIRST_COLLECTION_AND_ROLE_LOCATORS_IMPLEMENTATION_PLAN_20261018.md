# ATS API-First Collection + Role-Based Heal Locators — Implementation Plan

**Timestamp:** **2026-10-18T08:15:00.000Z (UTC) | 18-10-2026 13:45:00 (IST)**

## Overview

Closing out the 2026-10-17 research round (Stagehand/Playwright web-first
locators, AIHawk failure modes, Greenhouse/Lever public posting APIs,
LinkedIn automation policy). The highest-value mapping onto the engine:
collect from the ATS's own keyless JSON API when it answers, and resolve
AI-healed controls with role-based Playwright locators first.

## Changes

1. **API-first collect (greenhouse/lever)** — pure layer in
   [apply-engine-lib.js](../../../scripts/apply-engine-lib.js):
   `atsApiCollectPlan(url)` derives `boards-api.greenhouse.io/v1/boards/<b>/jobs`
   / `api.lever.co/v0/postings/<b>?mode=json` endpoints from registered board
   URLs; `parseGreenhouseJobs`/`parseLeverPostings` map the live payloads to
   collect rows; `ageStampFromTimestamp` renders API timestamps as the card
   stamps the existing freshness/max-age pipeline already parses; 
   `fetchAtsApiJobs` fetch+parses, never throws. Driver
   ([auto-apply-jobs.js](../../../scripts/auto-apply-jobs.js)): at the top of
   `collectJobs`, the API path returns rows via the SHARED
   `finalizeCollected` harness (extracted from the scrape tail so both
   paths can't drift) — no listing-page navigation at all; the scrape only
   runs when the API is empty/failing (fail-open, logged).

2. **Role-based heal locators** — `healLocator` → `healLocatorsForSpec`
   resolves `page.getByRole(role, { name, exact })` FIRST (visible+enabled
   shoulders preserved via `.and()`), with the legacy CSS+hasText locator as
   second for controls whose accessible name diverges from innerText.
   Verified heal flow unchanged (re-scan, confidence ≥ 0.8, behavioral proof).

3. **Docs + policy** — engine README gains the API-first section and the
   platform-policy note: LinkedIn's User Agreement prohibits bots/automation
   (documented enforcement = account restriction), which is why LinkedIn
   stays a review gate and `AUTO_SUBMIT_NEVER_HOSTS` blocks trust-patch
   auto-submit for it; public ATS APIs are the compliant channel for scale.

## Verification (all captured, exit 0)

- Live API probes: greenhouse `/v1/boards/lyft/jobs` HTTP 200 → 183 rows
  with real `updated_at` stamps and company "Lyft"; lever
  `/v0/postings/fampay?mode=json` HTTP 200 → 17 rows. (Earlier lever token
  guesses that 404'd are simply dormant boards — the parser handles the
  `{"ok":false,"error":"Document not found"}` shape as an honest fallback.)
- `node --check` on driver + lib: OK.
- `npx vitest run src/__tests__/applyEngine.test.ts`: **181/181** (8 new pins:
  endpoint derivation incl. garbage-segment guards, stamp dialect round-trip
  through `parsePostedAge`/`isFreshPosted`, greenhouse/lever payload shapes,
  hostile-payload safety).
- `.d.ts` updated for all five new exports.

## Next steps

- When `jobs-fetch` next registers live greenhouse/lever `job_sites` rows
  (pending → 7-day probation → auto-activation), their `--all` cycles collect
  API-first automatically — no registry or rules change needed.
- Stagehand v3 was evaluated and NOT adopted: the AI-heal triple (bounded
  dump → one-call pick → re-scan verification → behavioral proof) already
  gives the same resilience without a new dependency or model tier; role
  locators align the remaining surface with Playwright web-first doctrine.
