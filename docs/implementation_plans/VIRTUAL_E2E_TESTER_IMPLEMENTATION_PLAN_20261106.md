# Virtual End-to-End Tester Implementation Plan

**Timestamp:** **2026-11-06T08:18:36Z (UTC) | 06-11-2026 13:48:36 (IST)**

## Overview

Add a repeatable browser-based virtual tester for InterviewIQ. Keep the existing repository, public frontend URLs, application behavior, and backend unchanged. This task is local implementation and verification only: no commit, push, deployment, paid service, real account provisioning, or recurring schedule is authorized.

## Current State

The Node 22 deployment pipeline has 1,799 Vitest tests, Deno tests, and a public artifact comparison. These are not browser E2E verification. Existing staging configuration shares production Supabase; authenticated startup can write profiles, analytics, and sync data. There is no approved isolated backend test environment.

## Implementation Phases

1. Add pinned Playwright Test, separate TypeScript configuration, ignored test artifacts, and local commands.
2. Resolve explicit Supabase environment overrides without silent production fallback. Produce isolated fixture and cloud-disabled builds outside `dist/`.
3. Add deny-by-default request/WebSocket/pop-up handling before navigation, stateful synthetic integration fixtures, and a separately contained PWA project.
4. Cover representative user journeys and all top-level views with explicit coverage depth. Treat simulated provider/role responses as simulated integration, never verified backend/RLS behavior.
5. Add readable HTML/JSON/JUnit/Markdown results, failure screenshots/traces, and coverage gaps. Test failure reporting with deliberate fixture faults.
6. Add PR/manual CI checks, pre-deployment browser gates, and anonymous post-deployment smoke checks. Preserve all existing gates; no schedule.

## Technical Considerations

- Follow AGENTS.md: strict TypeScript, ESM, pure testable helpers, focused changes, Node 22, build before tests consuming generated artifacts.
- Build output goes to `.virtual-tester/` rather than tracked `dist/`. Test credentials and reports never enter the production bundle or Git.
- Use independent browser contexts and synthetic identities. Unknown external requests fail instead of receiving generic success.
- Production smoke is anonymous/read-only and cannot trigger payments, mail, deletion, jobs, or runners. Backend requests blocked by policy are reported as unverified integrations, not provider outages.
- Fixture tests disable service workers. Offline tests use cloud-disabled builds with browser-level network containment and deliberate warming; offline coverage does not imply cold lazy-route availability.
- Actual authentication/RLS, cloud sync, provider availability, payment settlement, and job submission need a separately approved sandbox.

## Success Criteria

- Deterministic browser journeys assert observable state changes, not only page presence.
- Coverage inventory includes each top-level route and labels checks as implemented, simulated, or blocked.
- Network guards and environment validation fail closed under negative tests.
- Desktop/mobile viewport runs, warmed offline runs, and failure artifacts can be exercised repeatedly.
- Existing production build/CI behavior is preserved and E2E failures gate publication once the user authorizes publishing.
- Final report honestly separates verified, failed, skipped, blocked, and not-run checks.

## Next Steps

Implement locally on `feat/virtual-e2e-tester-20261106`, validate without accessing production data, and provide commands plus a coverage/results summary. Request separate authorization before any publish/deploy operation.

## Completion Summary

Implemented locally on `feat/virtual-e2e-tester-20261106`:

- Pinned Playwright 1.65.0, Chromium desktop/mobile-viewport projects, and separate offline/live/probe modes.
- Explicit cloud environment resolution with no silent fallback; fixture/offline builds outside `dist/`.
- Deny-by-default HTTP/WebSocket routing and a local static-only proxy, plus stateful synthetic account/AI/team/content/payment fixtures.
- 95 normal browser executions (47 desktop + 47 mobile + 1 offline), failure screenshots/traces, HTML/JSON/JUnit/Markdown reports, and coverage documentation.
- PR/manual CI and pre-/post-deployment hooks prepared locally. No schedule, commit, push, deployment, backend provisioning, or production writes.

### Verification

- Application and E2E typechecks passed; all 6 pure network-policy tests passed. Both CI files passed Actionlint.
- 17 cloud-configuration tests passed twice under a focused Node 22 Vitest configuration; the normal jsdom test setup timed out before worker initialization. 18 independent Node 22 configuration assertions also passed.
- Normal production build passed. Production audit reports 0 vulnerabilities; pre-existing development-dependency audit findings were not automatically upgraded. Generated production changes were restored; `dist/` is not part of the task diff.
- First complete browser run: 76 passed / 19 failed across 95 executions. Second complete run: 68 passed / 18 failed / 9 timed out across 95 executions. The second run included local concurrency/setup/load delays; it is not a green release gate.
- Focused single-worker reruns passed: 7 desktop scenarios and 9 mobile scenarios. They diagnose the earlier failures but do not overwrite full-run history.
- Corrected service-worker/warmed-offline scenario passed in the second full run.
- Manufactured missing-bundle self-test passed after the safety review: each invocation uses a unique report directory, rejects abnormal child termination, and requires fresh screenshot/trace evidence for the deliberate failure.
- Anonymous live smoke passed on both GitHub Pages and Wasmer. Each run blocked 58 external/backend requests and recorded no page errors; this verifies the landing/local-practice frontend only. Live static requests reject redirects rather than following unapproved destinations.
- Known application regressions are documented in `docs/testing/known-regressions.md`: fresh skill route loading, upgrade pricing crash, mobile coach Send obstruction, and missing mobile Planner navigation. They remain failing assertions.

### Deviations / limitations

- No real backend sandbox was supplied. Database/RLS/provider behavior is explicitly unverified; fixtures do not substitute for those claims.
- Payment callbacks exist as a test double but are blocked end-to-end by the application's initial upgrade-modal crash; no payment-flow pass is claimed.
- Coverage is broad and representative, not every CRUD/role/variant. See `docs/testing/coverage.md` for remaining gaps.
- The full unchanged Vitest suite attempt on this branch stalled and was stopped; no full-suite pass is claimed. CI has not run for these unpublished changes.
- Detailed measurements, saved report locations, and the next action are recorded in `docs/testing/virtual-tester-results.md`. No commit, push, deployment, or recurring automation was performed.
