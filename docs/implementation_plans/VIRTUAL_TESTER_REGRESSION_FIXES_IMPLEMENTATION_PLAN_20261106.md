# Virtual Tester Application Regression Fixes

**Timestamp:** **2026-11-06T11:26:52Z (UTC) | 06-11-2026 16:56:52 (IST)**

## Overview

Fix the four confirmed application bugs found by the virtual tester while preserving all existing uncommitted tester work. Local implementation and verification only; no commit, push, deployment, real payment, or backend write.

## Current State

- `#/learn` reverses to the skill-detail view instead of the explorer, and a missing skill leaves detail loading indefinitely.
- Upgrade initially reads the missing `auto_apply` fallback price and crashes before remote pricing loads.
- The mobile coach toggle overlaps Send.
- Mobile More reuses a desktop-filtered menu, hiding Planner and other desktop-primary destinations.

## Implementation

1. Make the explorer canonical for `#/learn`; let missing/failed skill-detail loads reach the existing recovery state.
2. Resolve prices safely beside the existing entitlement catalog. Keep the four plan cards unchanged and use the existing backend add-on default of 199 major currency units, with validated remote overrides.
3. Separate the mobile coach panel from its toggle and keep the panel within the viewport.
4. Deduplicate mobile More destinations against actual mobile tabs while preserving visibility/feature/admin gates and desktop behavior.
5. Add focused regressions and reuse the currently failing browser journeys; retain genuine failures and historical reports.

## Verification

- Focused pricing, routing, detail recovery, and navigation tests.
- Typechecks, tester policy checks, production build, and applicable existing unit tests.
- Targeted desktop/mobile browser checks, then the full browser suite using one worker.
- Inspect screenshots for the mobile layout correction. Simulate all payment/AI/backend operations; no real provider traffic.
- Record environmental test blockers separately from application behavior.

## Success Criteria

All four confirmed regressions are fixed without changing public URLs, product prices, authentication authority, or test safety policies. Actual test results, remaining gaps, and local-only publication status are documented.

## Completion Summary

Implemented all four fixes locally:

- `#/learn` is canonical to the explorer; detail loading now reaches the existing recovery state when no slug exists or loading fails.
- Upgrade pricing uses a tested per-product resolver. The add-on keeps the existing backend default of 199 major currency units and remains outside the four subscription/grant plans.
- The coach panel is viewport-bounded and clears its floating toggle; accessibility state now links the toggle and panel.
- Mobile More includes desktop-only destinations, removes duplicates, scrolls on short screens, and retains Jobs/Drill feature gates.

## Verification

- Current-model review found one custom-navigation feature-gating edge case; it was fixed and its rebuilt mobile browser regression passed.
- Focused unit tests: 31 passed (pricing plus skill recovery).
- Focused four-regression browser run: 18/18 passed across desktop/mobile.
- Full browser run: 95 passed, 1 mobile-only scenario skipped in desktop, and one desktop resume reload timeout. That exact resume scenario passed when rerun alone and passed in mobile.
- The five failures from the resource-saturated full Vitest run passed alone: 14/14 tests. The full run had 1,602 passing tests before local worker/startup timeouts.
- Production audit, RAG evaluation, typecheck, production build, E2E safety/type checks, Actionlint, and 85 Deno tests passed locally.
- GitHub CI remains the final clean-run publication gate.

No real payment/provider or production backend operation was executed. Publication was separately authorized after these checks.
