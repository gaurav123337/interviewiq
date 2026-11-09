# InterviewIQ virtual tester

## What it does (and does not prove)

The virtual tester drives the real production-mode React frontend in Chromium through visible controls. It creates fresh browser contexts, performs repeatable user journeys, and records assertions, screenshots, accessibility snapshots, traces, console messages, and blocked network calls.

**A passing run is evidence for the scenarios in that run, not a guarantee that the entire application and every external service always work.** The report distinguishes:

- **Browser behavior:** real local state, rendering, navigation, and JavaScript execution.
- **Simulated integration:** real frontend and Supabase SDK with explicit stateful network fixtures. This does not verify SQL, RLS, deployed Edge Functions, provider uptime, or real payment processing.
- **Live read-only smoke:** anonymous checks on the two approved public frontend origins. Cloud APIs are deliberately blocked; this is not an authenticated production integration check.
- **Blocked/unverified:** real cloud authentication/RLS/sync, OAuth/MFA, external AI, emails, payment settlement, actual job submission, browser extensions, and the desktop auto-apply engine require separately approved environments.

## Run locally

Use **Node 22** (`.nvmrc`). Do not change your global Node installation merely to run tests; a Node version manager or isolated runtime also works.

```bash
npm ci --ignore-scripts
node node_modules/@playwright/test/cli.js install chromium
npm run test:virtual
```

| Command | Purpose |
| --- | --- |
| `npm run test:virtual` | Full application typecheck, E2E type/safety checks, isolated builds, browser suite |
| `npm run test:e2e` | Build isolated frontends and run browser suite |
| `npm run test:e2e:repeat` | Run each browser scenario twice to catch state leakage |
| `npm run test:e2e:prepare` | Prepare isolated builds only |
| `npm run test:e2e:browser -- --project=desktop` | Run against previously prepared builds |
| `npm run test:e2e:check` | E2E TypeScript check plus pure containment-policy tests |
| `npm run test:e2e:selftest` | After preparing builds, deliberately break a bundle and verify failure evidence in a separate probe report |
| `npm run test:e2e:ui` | Interactive Playwright runner |
| `npm run test:e2e:report` | Open the HTML report |
| `npm run test:e2e:live` | Explicit read-only checks of Pages and Wasmer |

Normal commands exit nonzero on failure. CI retries once but still fails on flaky tests. Default local concurrency is one worker to avoid saturating a desktop; CI uses two. `--workers` and `--grep` are Playwright options, not a reason to exclude regressions from release checks.

The existing audit, RAG, Vitest, Deno, build, and offline suites remain separate hard CI gates. `test:virtual` does not replace them. For existing Vitest offline tests, build `dist/` first.

## Test environments and safety

- `.virtual-tester/fixture/`: production-mode build using `https://virtual-tester.invalid` and a synthetic publishable key. This reserved domain cannot be mistaken for a production Supabase project.
- `.virtual-tester/offline/`: cloud-disabled build for service-worker tests.
- The local servers bind only to `127.0.0.1` on ports 8140 and 8141; port 8149 is a deny-by-default proxy.
- Fixture requests are fulfilled in memory. Unknown API contracts fail the run instead of becoming generic successful responses.
- Production APIs, arbitrary hosts, external navigations, WebSockets, payment endpoints, email services, and runner RPCs are blocked before they can be used. Popups inherit context guards.
- The remote checkout script is replaced with a synthetic provider UI. Success/cancel actions invoke fixture callbacks; no payment provider is contacted.
- The proxy permits only the exact local static servers and denies CONNECT and WebSockets. It contains worker/service-worker network traffic that browser routing does not intercept.
- Fixture/live contexts block service workers. The PWA project allows them only on the cloud-disabled local build.
- Live smoke allows only static GET/HEAD requests on `https://gaurav123337.github.io/interviewiq/` and `https://job-assist.wasmer.app/`. It has no write-capable mode or arbitrary target URL input.
- No real accounts, credentials, resumes, authentication state, or production data are used. Do not point synthetic tests at a real account or add privileged keys to `VITE_*` variables.

### Configuration rules

`src/services/cloudConfig.ts` honors `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` together. When neither is specified, existing production defaults remain. Both explicitly empty disables cloud. An incomplete pair, unsafe URL, or privileged key throws instead of silently selecting production.

Tests build into ignored `.virtual-tester/` directories; they do **not** overwrite production `dist/`. Some old `dist` files are already tracked despite `.gitignore`; do not stage generated build differences.

## Coverage matrix

A route inventory check is deliberately shallow and never represented as exhaustive feature coverage. `test-results/summary.md` contains actual results for the current run.

| Area | Automated scope | Important limitation |
| --- | --- | --- |
| Landing/onboarding | Hero CTA, level/field/company selection, JD tailoring | Marketing accuracy is not assessed |
| Interview/results/history | Eight answers, feedback, score breakdown, saved history/reload/review, early exit | Scoring correctness remains covered by unit tests |
| Question bank | Search empty/recovery behavior, interview-practice path | Not every question is exhaustively answered |
| Roadmap/planner | Setup/skills/self-assessment → generated daily plan | Live resource quality and deadlines are not certified |
| Drill/progress | Deck, answer reveal, recall rating and persisted review | Long-term scheduling correctness remains unit-tested |
| Skills | Explorer search → skill detail → focused practice; fresh `#/learn` regression | Direct-route regression is kept failing if present |
| Coding | Edit a local JavaScript function; pass visible/hidden sample tests | External compiler languages and every problem are not covered |
| System design | Search, case drawer, mark done, persisted progress | Diagrams are captured, not automatically reviewed for design quality |
| Accounts/settings | Preferences/theme/reload, simulated auth/error/sync, free/pro/admin boundaries | Real auth, RLS and cloud conflict resolution need a sandbox |
| Resume/jobs | Synthetic resume parsing, profile saving, search filters | Never submit a real application or start the local runner |
| Tutor | Empty KB explanation; simulated cloud reply and provider failure | No claim about real model correctness or availability |
| Teams | Synthetic create-team transaction and visible result | Real multi-user permissions/notifications need a sandbox |
| Billing | Synthetic success/cancel/error scenarios and provider double implemented | Currently blocked by the upgrade modal regression; no settlement/callback pass is claimed |
| Articles/resources | Inventory empty state and synthetic article UI/filtering | Real ingestion/indexing/resource moderation not certified |
| Legal/sources/counselor | Route/access/empty-state inventory | Not comprehensive legal or career advice verification |
| PWA | Warmed practice/legal routes, service worker, offline reload | No claim that arbitrary cold lazy routes work offline |
| Public deployments | Landing and local onboarding with backend blocked | Public static/frontend reachability only |

All routed views in `src/components/App.tsx` are represented by inventory or journey scenarios. Stateful interview/results and skill-detail views are reached by interaction rather than injected completed state. Update the matrix and scenarios when introducing a new route.

## Reports and triage

- `playwright-report/index.html`: detailed run, steps, screenshots and traces.
- `test-results/results.json`, `junit.xml`: machine-readable output.
- `test-results/summary.md`, `summary.json`: commit/mode/time, pass/fail/flake/skip counts and coverage limitations.
- Each completed scenario attaches screenshot/accessibility evidence; failures retain trace and screenshot automatically. Capturing screenshots does not imply that a human or visual reviewer inspected every image.
- Network evidence contains endpoint paths and synthetic calls, not request bodies or authorization headers.

First determine whether a failure is **app behavior**, **a missing fixture contract**, **a stale locator**, or **the test environment**. Never mark a bug as passed by removing assertions, skipping it, accepting all API calls, or changing app state from the test. Known regressions remain failing release gates until fixed with authorization.

## CI (takes effect only after publication)

`virtual-tester.yml` runs on pull requests and manual dispatch with read-only GitHub permissions and no production secrets. Reports have seven-day retention. It never uses `pull_request_target`.

`deploy.yml` retains every existing gate and adds isolated browser tests before either frontend deployment. After publication and the existing artifact-hash check, anonymous browser smoke runs against both public sites. A post-deployment failure reports a bad release but does not silently roll back production.

No recurring schedule is enabled. Use GitHub Actions notifications for failures; configure external alerts or a recurrence separately if desired.

## Adding true backend integration later

Use a dedicated disposable Supabase project/local stack, not the existing staging settings (which historically shared production). Verify the exact project identity, disable provider/cron side effects, provision synthetic users/roles, and clean up only recorded test-owned IDs. Service-role keys belong only in trusted provisioning, never the browser. Auth redirects and Edge CORS must explicitly include the test origin. Missing configuration must produce a blocked result, not fixture-backed claims of backend verification.
