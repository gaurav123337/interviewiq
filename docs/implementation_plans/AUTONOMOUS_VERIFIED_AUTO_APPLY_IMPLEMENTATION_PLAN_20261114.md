# Autonomous Verified Auto-Apply Implementation Plan

**Timestamp:** **2026-11-14T03:46:55Z (UTC) | 14-11-2026 09:16:55 (IST)**

## Context and Target

Implement the approved job-first autonomous pipeline: one-time verified profile/answers and site logins, followed by discovery, explainable JD matching, leased per-job execution and timestamped outcomes. New/ambiguous/changed questions ask once with scoped reuse; no model output alone authorizes factual answers or submission success.

The current web Run-now path is a singleton legacy Telegram listener plus long sequential website cycles. Real diagnosis found listeners in the old Desktop checkout (`7f9b4f5e`), not the released PR178 workspace. Its own browser profile exists; latest readable per-job report is from October22. Existing sessions are not being moved, read or cleared. Installed processes have not been restarted.

Baseline for isolated `feat/autonomous-verified-apply`: released main merge `2cafd6ee41cc9395208a7d5ffde1415917de5312` (PR178). Other worktrees' generated artifacts remain untouched.

## Approved Implementation Phases

1. **Verified setup and answer bank:** own profile facts with user provenance, scope, confirmation/expiry/revision; exact approved resume; deterministic question meaning/option/context resolution; batched question inbox; corrections/revocations invalidate plans. Existing unverified legacy answer memory is not automatically trusted.
2. **Targeted backend tasks:** own runs/tasks selected by binding, atomic claims/leases/fencing, immutable job snapshots, owner/job dedupe, submission reservations before clicking, uncertain attempts never automatically replay. Own RLS and strict browser/native capabilities, no project service key on a customer machine.
3. **Paired worker and adapters:** stable binding-local sessions, independent outbound polling and exact task state; factual live-form plans; reuse existing supported ATS adapters; LinkedIn hard review-only clamp; safe login-only commands; expired/challenged sessions pause without guesses or bypass.
4. **Discovery and JD matching:** existing permitted feeds/ATS collection plus private sources, pagination/canonical URLs/freshness/dedupe; hard preferences then deterministic confirmed-skill relevance; optional bounded AI never overrides facts. Unknown discovered sites remain collection/review-only.
5. **App workflow:** one-time setup, answer bank/action-needed inbox, target agent/readiness, Run my pipeline, per-task reasons/progress, Sign in/Check session, safe cancel. Telegram is notifications only, not prerequisite control transport.
6. **Full vertical verification:** actual local worker/browser synthetic portals, reused answers on equivalent jobs, changed contexts require confirmation, no guessed answers, multiple-user/binding fencing, crash/uncertain submit, cancellation/expiry, and full type/unit/Deno/SQL/browser gates.

## Contracts and Ownership

- Browser: `my_apply_pipeline_action(p_action,p_args)` derives `auth.uid()`; selected binding IDs are routing metadata with ownership checks, never authoritative owner IDs.
- Agent: existing Edge `apply-agent` `pipeline.action` operation derives binding identity from hashed credentials; separate pipeline allowlist and transactional dispatch.
- Facts: `{ value, source: 'user', confirmedAt, scope?, validUntil? }`, profile revision plus exact approved resume text.
- Questions preserve canonical meaning, exact control/options/context, scope/key and profile revision. Country authorization/sponsorship and salary/currency meanings never mix. Demographic answers require explicit user choice; legal attestations are application-bound human steps.
- Durable run/task IDs, lease version/nonce, profile/settings/answer revisions; submitted state only follows reserved attempt with observed evidence. Old activity remains unchanged.
- Pure script decisions remain `scripts/*-lib.js` plus declarations/Vitest; Edge shared boundaries use colocated Deno tests; real browser driver proof uses separate synthetic local fixtures.

## Safety / Success Criteria

- Equivalent valid confirmed questions fill without asking again; unknown/ambiguous/incompatible/expired questions pause affected tasks and batch once.
- No JD-derived candidate skills, fabricated experience, guessed eligibility, or inferred sensitive answers.
- Off/cancel/revoke work after expiry; tasks recheck identity/access/revisions/budgets before submission.
- No duplicate submission on retry or after uncertain receipt; cloud/report/Telegram failures cannot replay the browser click.
- New sites cannot become auto-submit capable merely through discovery or match score.
- Existing owner profile continuity is explicit legacy-only; customer bindings never inherit another user's cookies.
- App distinguishes waiting, unsupported, failed, unverified, observed submitted and user-marked applied; worker exit/tab opening is not evidence.

## Rollout Boundaries

This is local implementation and synthetic proof. No new PR/push/deployment, production migration, persistent task installation/restart, actual portal sign-in, Telegram send or real job submission is performed without separate approval. Paired-machine execution requires an online machine; hosted browser infrastructure is not silently introduced. Human CAPTCHA/OTP/new attestations and unsupported portals remain explicit stops.

## Verification Ledger

The entries below are the original implementation-start ledger, retained for context. Current closure results follow under the dated update.

- Approved plan recorded; isolated branch created from released main.
- Read-only diagnosis of installed owner processes and directory/report metadata completed; no private profile/cookie values inspected.
- Lockfile dependencies installed with lifecycle scripts disabled.
- Backend, pure answer/matching and UI/worker implementation underway. No completion or live behavior claimed yet.

## Update — Verification Closure, 2026-11-14

**Timestamp:** **2026-11-14T08:00:42Z (UTC) | 14-11-2026 13:30:42 (IST)**

Continue the existing uncommitted implementation on `feat/autonomous-verified-apply`; preserve all prior work and other linked checkouts. The latest pre-handoff frontend report records 126 passes and one intentional skip, but the ledger has no consolidated final backend/worker proof.

- Run full Node22 type/build/unit/RAG, cached Deno, disposable PostgreSQL contract/concurrency, synthetic worker and isolated frontend gates.
- Reconcile the approved acceptance criteria against the existing code; fix demonstrated gaps with regression tests, without expanding portal scope.
- Exercise the combined real SQL → paired Node worker → synthetic Chromium → explicit answer confirmation → persisted submission flow.
- Retain command outputs and failures, then record final implemented/local-verified status separately from deployed/live-verified status.
- Use a new network-isolated database container and fixture-owned browser state. No existing runner restart, production access, cookie transfer, Telegram send or actual application is authorized by this closure.

### Focused repair scope

Static integration review identified concrete closure gaps: portal commands lose their target after worker restart; the human-review command has no implementation; unconfirmed optional form defaults are not checked before submit; supported resume/CV labels are rejected by redundant narrower upload checks; and SQL reservation rejects confirmed live-question currency/country context absent from the job snapshot. The repair reuses existing resolver/adapter/queue boundaries, adds server-derived command targets and task-linked confirmed context checks, and preserves fail-closed submission behavior. Paused/crashed command recovery and safe continuation during human login are covered with regression fixtures rather than new portal support. Additional resolver/SQL checks cover a fresh confirmed answer replacing an expired fact and equivalent known-question wording batching without widening unknown questions or attestations.

### Retained baseline (not final verification)

The first closure gates ran while patches overlapped and heavy local test load competed. Their evidence is retained outside this checkout in the continuing session's workspace.

| Gate | Baseline result |
| --- | --- |
| Node22 full/build typecheck, innerHTML, script syntax, Vite build | Passed |
| Deno shared/agent/notification tests and agent/notification entrypoint checks | 135 passed; both entrypoint checks passed; cached-only, network denied |
| Full Vitest | Incomplete at the 900-second harness limit; 588 completed passes and two 2500ms performance-budget failures; no final suite summary |
| Disposable SQL replay/ownership/answer/lease/safety/concurrent-cap tests | Passed; database `apply_pipeline_test_1794643683153` retained |
| Combined SQL-backed worker | Failed: zero fixture posts versus three expected; database `apply_worker_sql_1794643702821` and stderr retained |
| Synthetic worker `--mode all` | Reuse passed; in-place task reached submitted but Windows `EBUSY` profile cleanup aborted the suite; seven later modes not reached |
| Isolated frontend matrix | 126 passed, one intentional skip; six containment self-checks passed |

Final gates must run against settled source. An interrupted suite, cleanup exception or passing pre-repair baseline is not a completed post-repair proof.

## Completion Changes

- Persisted owner/binding/task-derived command targets survive worker restart; pending questions open exact bounded headed review without worker fill/submit. Command reclaim uses a fresh nonce and stale reports fail closed.
- One stable headed browser profile permits independent portal jobs during human sign-in/review; released-before-report ordering avoids requeue/wakeup races. Only tasks deferred by that human window resume automatically; original manual questions and uncertain attempts do not.
- Optional unconfirmed controls are safely cleared or pause the task, with full live-field verification at the submit boundary. Strict shared resume/CV classification replaces inconsistent upload label checks.
- Fresh explicitly confirmed bank answers can replace expired profile facts, while current contradictions still block. Known equivalent question aliases batch using server-verified semantics and exact normalized option sets. Reused answers require a current task/question association, including explicit live currency/country context.
- Added regression unit/SQL/synthetic cases and the combined SQL-backed worker gate in virtual-tester CI. Clarified portal sign-in versus exact human question review in the app and documentation.

## Final Local Verification

**Core run:** **2026-11-14T09:05:40Z–09:35:28Z (UTC)**. Node22.23.5 and cached Deno2.9.6; application credentials removed, network denied for core/Deno. Command manifests and machine-readable reports are retained in the continuing workspace's `verification-evidence-20261114-final-02/` directory.

| Gate | Result |
| --- | --- |
| Full/build TypeScript, innerHTML gate, script syntax, production Vite build | Passed |
| Full Vitest, 148 files | 2,236 passed; one existing duplicate-detection performance assertion failed at 2,857.9ms versus the unchanged 2,800ms budget |
| Focused unchanged performance + final worker rerun | 35/35 passed: eight performance tests and 27 worker tests; duplicate detection 2,412.8ms, full triage 1,848.2ms |
| RAG evaluation included in full suite | 41/41 passed |
| All Deno shared/agent/notification tests | 136/136 passed: 105 shared, 11 agent, 20 notification |
| Agent and notification Edge entrypoint type checks | Passed |
| Disposable SQL replay and full contract/regression suite | Passed, including owner/binding fences, command recovery, answers/live context and concurrent caps |

The full Vitest invocation remains a recorded failed gate despite its unchanged focused rerun passing; no timing budget was increased and no unrelated performance code was modified. The offline UI bank self-test explicitly skipped five internal framework probes; the normal Vitest report has zero pending tests.

The first post-repair worker/SQL-worker attempt used an overly deep custom Windows TEMP root, producing 312-character resume artifact paths and no multipart POSTs. The worker left those attempts unverified. Changing only the external test harness to a short disposable temp root (252-character artifact path) restored three confirmed reuse submissions; receipt and submission guards were not relaxed. Failed logs/databases remain retained.

### Final synthetic worker and SQL proof

**2026-11-14T09:49Z–09:56Z (UTC)**, sequentially with unchanged production/fixture/migration source hashes:

- `node tests/apply-worker/process-fixture.mjs --mode all`: **13/13 passed**. Reuse, in-place application, headed login/independent continuation, bounded human review, optional defaults/radio fallback, CV uploads, dynamic controls, cancel, forbidden/unknown sites, missing profile and crash uncertainty.
- `APPLY_PIPELINE_SQL_CONTAINER=interviewiq-verify-00e8e105 node tests/apply-worker/sql-process-fixture.mjs`: **passed**, with three persisted confirmed submissions, one shared question and one explicitly confirmed reusable answer. Disposable database `apply_worker_sql_1794650057101` is retained.
- Final worker/portal/resolver/fixture/migration hash prefixes: `f68a7dab`, `6473286f`, `da1e9ec6`, `a3dc9a07`, `2bdf7d6f` respectively. This proof did not change browser safety or submission evidence rules.
- Retained continuing-workspace logs: `synthetic-verification-final/worker-1794650056894.log` and `synthetic-verification-final/worker-sql-1794650179510.log`; detailed per-mode evidence lives in gitignored `tests/apply-worker/evidence/`. The closure-owned `interviewiq-verify-00e8e105` container was stopped after verification; it and its test databases are retained, not deleted. Existing containers and runners were untouched.

### Rollout status and remaining boundaries

- **Implemented:** the approved verified job-first pipeline plus the focused closure repairs are present on `feat/autonomous-verified-apply`, uncommitted.
- **Locally verified:** core/type/build/RAG/Deno/SQL and all 13 synthetic worker modes; combined real SQL/worker/browser proof passed. The full unit gate has one retained timing failure that passes unchanged in isolation. Final frontend matrix is recorded separately below.
- **Deployed:** not deployed. No production migration, Edge/frontend publish, PR, commit or push performed in this closure.
- **Live-verified:** not claimed. No real account sign-in, Telegram send, persistent runner install/restart, cookie transfer or actual job application performed.
- Public supported ATS/in-place paths only; LinkedIn/unknown portals stay review-only. CAPTCHA/OTP, new legal/demographic questions and uncertain submit attempts remain human stops. Paired machine must remain online. Keep Windows artifact roots short; overly nested paths fail closed and are not auto-retried.

### Final frontend matrix and reproduction

**Full run:** **2026-11-14T10:00:16Z–10:29:45Z (UTC)**. E2E TypeScript and six containment self-checks passed; isolated desktop/mobile/offline matrix completed **123 passed, one intentional skip, three failed**. All ten pipeline UI scenarios passed. The failures were:

1. Mobile planner → roadmap: evidence screenshot timed out at 20 seconds after application assertions.
2. Mobile export/reset: evidence screenshot timed out at 20 seconds after application assertions.
3. Mobile roadmap inventory: local deny-proxy required-asset HTTP502 for the system-design bundle.

**Unchanged focused rerun:** **2026-11-14T10:34:55Z**, all **3/3 passed** using the same isolated build and mobile project. No application code, screenshot budget or network safety rule was changed. Preserve the failed full-run status and traces; a focused passing rerun is not a replacement full-suite green result.

Retained continuing-workspace evidence: `synthetic-verification-final/frontend-full-run-results/`, `frontend-full-run-report/`, `browser-final-browser.log`, and `browser-focused-browser-focused.log`. Current generated `test-results/` reflects only the final focused subset; use the retained full report for matrix coverage.

## Completion Summary

Local implementation and acceptance reconciliation are complete, with full source preserved on the feature branch and focused repairs verified by unit, Deno, SQL and real synthetic worker/browser execution. Full project unit/frontend gates each had retained timing/test-infrastructure failures that passed unchanged when reproduced alone. No unrelated code or test thresholds were changed to hide those failures. Release/production/live-account work remains intentionally unperformed and requires separate authorization. No commit/PR links existed at this local closure.

## Release follow-up — 2026-11-14

PR [#179](https://github.com/gaurav123337/interviewiq/pull/179) was opened after the user requested publication, live deployment and testing. Source-only commits exclude generated builds and private runtime data. A GitGuardian false positive flagged the URL credential-rejection expression beside the discovery host regex; separating the guards preserves behavior (five discovery tests passed), but the historical finding still requires authorized resolution before merge.

The first Ubuntu worker CI run exposed a Windows-only fixture assumption: absent `LOCALAPPDATA` threw after the test server started. The fixture now pins the existing browser cache before redirecting per-platform HOME/XDG/LocalAppData state to its sandbox, derives the crash ledger through the shared runtime helper, cleans setup failures, and bounds POSIX process-group teardown. A local run with `LOCALAPPDATA` and `PLAYWRIGHT_BROWSERS_PATH` unset passed three confirmed reuse submissions. Ubuntu CI remains the Linux verification gate. No production worker behavior or submission safety policy was changed by this fixture repair.

The user subsequently authorized rewriting only the unmerged PR feature commits with force-with-lease, then gated merge/deployment. The headed fixture explicitly focuses its test pages under Xvfb while retaining normal actionability checks; the local login scenario still passes both submissions. Production changes remain conditional on green exact-head CI and security checks. The old feature tip is retained in a local recovery ref; main and other history are not rewritten.
