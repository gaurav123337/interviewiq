# Virtual tester coverage inventory

This inventory describes implemented scenarios, not a claim that all tests pass. See [the implementation verification record](virtual-tester-results.md), the latest generated `test-results/summary.md`, and [known regressions](known-regressions.md). The latest generated report may represent only a focused subset; retained full-run reports are listed in the verification record.

## Browser suites

| File | Scenario groups |
| --- | --- |
| `e2e/routes.spec.ts` | 24 route/empty/access-control checks; excludes stateful interview/results/detail views reached in journeys |
| `e2e/interview.spec.ts` | Completed interview/history/review/bank, early exit, JD tailoring |
| `e2e/account-jobs.spec.ts` | Settings/theme, simulated sign-in/sync/sign-out, auth error, pro/admin restrictions, admin overview, synthetic resume/job filters |
| `e2e/auto-apply.spec.ts` | Add-on/Platinum/complimentary own-core access, pairing/revocation, free access restriction, A/B/A history isolation, gift redemption without checkout |
| `e2e/learning.spec.ts` | Planner/roadmap setup, drill recall persistence, local function execution, system-design completion, skill detail → practice |
| `e2e/integrations.spec.ts` | No-result tutor, synthetic AI success/error, synthetic team creation |
| `e2e/billing-content.spec.ts` | Synthetic payment success/cancel/error with external provider requests blocked, approved article filtering |
| `e2e/reliability.spec.ts` | Local export/reset, language persistence/back-forward |
| `e2e/offline.spec.ts` | Warmed service-worker offline practice/legal reload |
| `e2e/live.spec.ts` | Explicit anonymous public landing/onboarding smoke, backend traffic blocked |
| `e2e/failure-probe.spec.ts` | Self-test-only manufactured broken asset; excluded from normal runs |

Normal local matrix: **54 scenarios × desktop/mobile viewport + 1 offline scenario = 109 executions** (the desktop execution of the mobile-only navigation contract is intentionally skipped). Latest tenant/gift verification: **108 passed / 1 intentional skip / 0 failures / 0 flaky results**. Live smoke and the deliberate failure probe run separately. Mobile means Chromium device emulation, not an actual Android device or WebKit/iOS.

## Explicit gaps

- Real cloud authentication, RLS, multi-user writes/conflicts and deployed Edge Functions require an isolated backend, which is not configured.
- Real OAuth/MFA, email/recovery delivery, charges/refunds/subscriptions, OCR downloads, compiler APIs, job submissions, and the desktop runner are not executed.
- Checkout callbacks pass through an explicit synthetic provider fixture; real payment settlement and provider behavior are not verified.
- Resources, sources, counselor and progress have route/empty-state checks; not every CRUD, moderation, learning branch or chart is exercised.
- Jobs cover resume/profile/filtering, not every apply-kit variant, interview round, tracker transition or recommendation.
- Admin and team flows cover representative permissions/navigation/creation with fixtures, not every admin section or member lifecycle.
- AI no-result/error handling is tested with explicit contracts; this does not establish factual model quality.
- Offline coverage is limited to explicitly warmed routes; cold deep links and full upgrade-cache lifecycle need additional cases.
- Automated screenshots are captured for evidence. Broad pixel-diff baselines, accessibility audits, and human visual acceptance are not claimed.

Keep these gaps visible when interpreting a green subset. New routes or new critical flows need explicit scenarios and this inventory updated alongside them.
