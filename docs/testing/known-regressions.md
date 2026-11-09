# Application regressions found by the virtual tester

**Discovered:** 2026-11-06
**Resolved locally:** 2026-11-09

These regressions were observed in isolated production-mode browser tests based on commit `0267724`. No production credentials or writes were used. The fixes remain local until the approved publication completes.

## 1. Fresh `#/learn` remained on the loading state — fixed

- Fresh `#/learn` now resolves to the skill explorer rather than the detail route that requires a selected skill.
- Skill detail also leaves loading and shows its existing recovery UI when no slug exists or the roadmap request rejects.
- Verified by focused unit tests and desktop/mobile browser route/detail/practice journeys.

## 2. Upgrade modal crashed on its initial pricing render — fixed

- The separate auto-apply add-on now uses the existing backend catalog default of 199 major currency units without entering the four subscription/grant plans.
- Valid remote prices, including zero, still override their own product. Invalid product IDs and malformed prices fail safely or use their product fallback.
- Synthetic payment success, cancellation, and provider-error scenarios pass on desktop and mobile; no real payment provider was contacted.

## 3. Mobile floating-coach toggle covered Send — fixed

- The panel now sits above the toggle and is viewport-bounded with internal scrolling on short screens.
- The toggle exposes `aria-expanded`/`aria-controls` for its panel.
- Both mobile offline/no-result and simulated AI success/error interactions pass with ordinary clicks—no forced clicks or keyboard bypasses.

## 4. Planner was absent from mobile navigation — fixed

- Mobile More now excludes actual mobile tabs—not desktop tabs—while retaining desktop-primary destinations such as Planner.
- Duplicate destinations remain suppressed, feature flags/menu visibility remain enforced, and the menu scrolls within short screens.
- Verified on mobile with roadmap → Planner navigation and a custom configuration where Jobs/Drill are desktop-primary but remotely disabled.

## Verification notes

- Focused regression browser run: 18/18 passed across desktop/mobile.
- Custom mobile feature-gating regression: passed after rebuilding the isolated app.
- Full browser run: 95 passed, 1 skipped (the mobile-only scenario in desktop), and one unrelated desktop reload timeout; that exact resume scenario passed in isolation and on mobile.
- Focused pricing/missing-skill unit tests: 31 passed.
- The five failures from the resource-saturated full local Vitest run passed when rerun alone (14 tests total).

Historical failure screenshots and traces are retained in ignored `.virtual-tester/runs/` reports. GitHub CI remains the clean-run release authority.
