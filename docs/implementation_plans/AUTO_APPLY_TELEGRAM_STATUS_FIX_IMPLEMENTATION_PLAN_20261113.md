# Auto-Apply Telegram Status Fix Implementation Plan

**Timestamp:** **2026-11-13T17:33:13Z (UTC) | 13-11-2026 23:03:13 (IST)**

## Overview

Deliver the approved focused fix before the broader automation expansion: user-scoped Telegram binding, dated individual submitted/needs-review/error updates, and a timestamped run summary. Skipped, filtered and budget-capped outcomes stay summary-only. Preserve all site restrictions and do not activate an engine during publication.

## Current State

- Released baseline: merge `221a2f8e0813fce72b5cba3cf1b4d2b5c4ad8d3b` (PR #177), verified Pages/Wasmer deployment `43461719331`.
- New isolated worktree/branch: `fix/auto-apply-telegram-status`. Original generated `dist/` and CLI-cache modifications remain untouched.
- Current scoped `notify.get` works for paired and explicit legacy-owner engines; historical global selectors must not be restored.
- UI saves before testing and sends private weekly data to an untested destination. Saved configuration is wrongly presented as tested.
- Engine sends review pings and aggregate counts without event timestamps, validates only HTTP success, and does not await report persistence reliably.

## Implementation Phases

1. **Binding backend:** generic save/test/unbind endpoint; verified caller, canonical entitlement, bounded validation, test-before-save, revision CAS, metadata-only browser reads, stored timezone and real successful-test timestamp. Preserve old connections without inventing test history.
2. **Binding UI:** token never read back, blank replacement reuses stored token, busy/retry/disconnect, account-bound async handling, honest delivery-test terminology and BotFather/start/chat instructions.
3. **Engine status:** pure date/status formatting and bounded sender; stable event ID/occurrence time; selected per-job messages; all-six timestamped run summaries; no duplicate review ping, no unsupported paired reply guidance.
4. **Resume/report reliability:** tracked bounded persistence, same ID/time on retry, token-free local pending metadata, no historical Telegram broadcasts, no repeated submissions following delivery failure; safe stale cycle-lock recovery.
5. **Verification:** focused unit/service/component/Deno/SQL and synthetic browser checks; complete existing Node 22 release gates before PR merge. No real messages/jobs are required for these checks.
6. **Release:** source-only commit and PR, exact-head CI/merge confirmation, one targeted additive notification migration and `send-notify-test` deployment, synchronized Pages/Wasmer publication. Do not replay tenant expansion or deploy unrelated functions.

## Technical Considerations

- Reuse existing React UI/services, scoped action transport and verified JWT/hashed-binding boundaries.
- Browser APIs expose chat/token-presence/timezone/test-time/revision metadata, never the stored bot token.
- Direct Node delivery retains the existing server-readable per-user bot-token design. This is not a new encrypted vault or Edge-only secret architecture; credentials must never enter reports, logs or argv.
- Preserve original event time independently of delayed database ingestion. Use explicit IANA zone plus UTC reference.
- Telegram acceptance establishes deliverability, not recipient ownership. Users must check the intended chat.
- Telegram has no general exactly-once send key. Ambiguous delivery remains unknown and is not blindly retried.
- A failed binding change retains the previous connection; revisioned disconnect prevents delayed save resurrection.
- Deployment publishes source, not a remote update/restart of customer machines. Users update their local checkout and explicitly run the supported paired command.

## Success Criteria

- Failed Telegram tests never overwrite a working connection or transmit private job history.
- Ordinary callers cannot forge tested metadata, read another user's token, or choose an authoritative owner UUID.
- Selected per-job messages carry honest status, stable reference and event timestamp; run summaries count all six outcomes.
- No Telegram/report failure resubmits a job; persisted record retries retain the original identity/time.
- Existing connections and supported local engine modes remain compatible; paired deferred commands remain unavailable.
- Required tests pass, PR CI is verified at the reviewed SHA, and actual backend/frontend deployment is recorded separately.

## Release Boundaries

No engine launch, real job submission, schedule installation, unrelated secret rotation, backlog broadcast, campaign feature, or tenant contract cutover. Production writes and the exact merge are confirmed at their respective gates. Real Telegram testing is user-initiated against their intended destination.

## Progress / Completion

- Approved scope and notification selection recorded.
- Isolated branch created from released main; lockfile dependencies installed with lifecycle scripts disabled.
- Implementation completed in the isolated branch. Final source review confirmed the binding/user/token boundaries and fixed post-confirmation dedupe ordering, exclusive stale-lock guards, cleanup scope, per-run sender budgets and durable retry validation.
- Production dependency audit: 0 vulnerabilities. Node 22 build/type/RAG/script/security gates passed. Complete local unit run: 142 files / 2,005 tests passed before the final engine corrections; final affected engine/paired rerun: 52 tests passed. The final published commit must pass full remote CI.
- Deno: complete shared + paired + notification suite 122 passed / 0 failed; final IANA offset validation included. Notification migration replay and before/after existing-binding/warm-dispatcher assertions passed in a disposable database (`telegram_notify_test_1794592460425`).
- Final synthetic full browser matrix: 115 passed / 1 intentional skip / 1 failed (unrelated existing mobile local-function exercise, expected `3/3 passing`; actual function-shape error). All 8 new Telegram desktop/mobile journeys passed. The failed scenario passed twice on focused repetition without assertion changes; investigation and exact-commit remote browser gate remain required. Do not label the initial full matrix clean.
- One local rollout-test retry and some shell checks timed out under local resource contention; subsequent affected reruns passed. No gates were disabled or weakened.
- No new commit, PR, live migration, deployment, message, engine activation or job submission yet. Actual Telegram delivery to a user destination remains user-initiated verification.
