# Virtual tester — implementation handoff

**Status: implemented locally; focused regressions pass; GitHub CI is the clean-run publication gate.**

Branch: `feat/virtual-e2e-tester-20261106`
Base commit: `026772453863f7570e8ef5b51a20233701c2ce07` plus uncommitted tester changes.

No commit, push, deployment, recurring schedule, real account provisioning, or production writes were performed for this task. CI changes take effect only after a separately authorized publication.

## What is ready

- Pinned Playwright Test 1.65.0 and Node 22 commands.
- 95 normal browser executions: 47 desktop scenarios, the same 47 with a mobile viewport, and one isolated PWA scenario.
- Real UI journeys for interviews/history, planner/roadmap, drills, skills, JavaScript exercises, accounts/settings, synthetic sync/auth/roles, resumes/jobs, articles, tutor, teams, export/reset, and navigation.
- Explicit synthetic provider contracts, a deny-by-default browser policy, and a static-only local proxy. No real payment, email, deletion, job submission, or runner activation.
- HTML/JSON/JUnit/Markdown results, failure screenshots/traces, and documented coverage gaps.
- PR/manual workflow and a blocking pre-deployment browser gate; anonymous post-deployment smoke checks on both existing public sites. No schedule.
- Backwards-compatible Supabase environment overrides: production defaults when absent, explicit empty pair disables cloud, incomplete/unsafe settings fail instead of silently falling back.

## Verification record

The runs below are separate measurements. Passing a focused rerun does not erase a failed full run.

| Check | Result |
| --- | --- |
| Application typecheck and production build | Passed |
| E2E TypeScript and 6 pure containment-policy tests | Passed |
| Cloud configuration tests | 17 passed twice with a focused Node 22 Vitest configuration; 18 independent Node assertions also passed |
| Workflow validation | Both edited/new workflows passed Actionlint |
| Production dependency audit | 0 vulnerabilities; pre-existing development dependency findings not auto-upgraded |
| First full browser run, one worker | **76 passed / 19 failed**, 95 executions; included fixture gaps later corrected |
| Second full browser run, two workers | **68 passed / 18 failed / 9 timed out**, 95 executions; included real app bugs and execution/action/load timeouts |
| Corrected PWA scenario | Passed in the second full run: service-worker activation, warmed legal/practice routes, offline reload |
| Focused desktop recheck, one worker | **7 passed**: synthetic team, full interview/history/bank, local function execution, bank/history/sources/counselor inventory |
| Focused mobile recheck, one worker | **9 passed**: auth/sync/error, admin, resume/profile, landing/practice/planner/playground/counselor inventory |
| Fresh-evidence failure self-test | Passed after review fixes: unique invocation report, intentional broken bundle rejected, screenshot and trace produced |
| Anonymous public smoke | **2 passed**: Pages and Wasmer landing → local practice; 58 external/backend requests blocked on each, no page errors recorded |
| Existing full Vitest suite on this branch | Incomplete: normal app test setup stalled; stopped without a full-suite result. Do not reuse the prior release's 1,799 passing tests as proof for these new changes. |

The repeated run was not stable with two concurrent browser workers on this desktop. The local default remains one worker; CI uses two with one retry and `failOnFlakyTests`, so instability cannot silently become a successful release. CI itself has not run for this unpublished branch.

## Application bugs the tester found

See [reproduction steps and code evidence](known-regressions.md):

1. A fresh `#/learn` opens the detail view without a selected skill and remains at **Loading roadmap…**.
2. **Go Pro** crashes during initial modal rendering because the `auto_apply` price is missing from the fallback plan catalog. Payment success/cancel/error scenarios cannot reach checkout; their callbacks are not claimed verified.
3. On mobile, the floating AI Coach toggle overlaps **Send** and intercepts the click.
4. **Planner** is missing from mobile navigation because the More menu excludes desktop-primary destinations that are not in the mobile tabs.

These are retained as failing assertions, not marked expected-failure or skipped. No application fixes were folded into the tester task. The live smoke deliberately did not exercise these potentially broader/data-changing paths.

## Saved local evidence

Reports and synthetic artifacts are ignored by Git:

- Full run 1: `.virtual-tester/runs/full-first/playwright-report/index.html`
- Full run 2: `.virtual-tester/runs/full-final/playwright-report/index.html`
- Desktop recheck: `.virtual-tester/runs/focused-single-worker-tkc6zjcs/playwright-report/index.html`
- Mobile recheck: `.virtual-tester/runs/focused-mobile-8gfribwt/playwright-report/index.html`
- Live smoke: `.virtual-tester/runs/live-final-u1q85jku/playwright-report/index.html`
- Reviewed live screenshots: `.virtual-tester/runs/live-final-u1q85jku/evidence/`
- Final self-test evidence: `.virtual-tester/probe/57c3933c-96d6-48c2-8514-8223978af37b/`

The standard `playwright-report/` and `test-results/` folders show the **most recent command only**; they may be a focused subset. Use the saved full-run reports above for complete-suite outcomes, not the latest subset's green badge.

## Run it

From this checkout with Node 22:

```bash
npm run test:virtual
npm run test:e2e:report
```

Other commands, safety details, and the distinction between browser testing and real backend integration are in [the tester guide](virtual-tester.md) and [coverage inventory](coverage.md).

## Recommended next action

Fix the four documented application regressions in a separately approved change, then rerun the complete browser suite with one worker and the existing unit/CI gates. Publish only after reviewing those results. A dedicated Supabase test environment is still required before claiming true backend/RLS/provider integration coverage.
