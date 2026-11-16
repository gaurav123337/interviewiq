# Independent Live Verification Implementation Plan

**Timestamp:** **2026-11-14T14:28:47Z (UTC) | 14-11-2026 19:58:47 (IST)**

## Context

PR179's frontend was published successfully, but its post-deployment browser check encountered a transient lazy-asset503. The existing verifier covers only direct HTML references and shares a job with publishing. Retrying that failed job republishes. This change improves CI verification only, not application/backend behavior.

## Scope

- Work from main97e9b77f in isolated branch `fix/independent-live-verification`; preserve older worktrees/generated outputs.
- Generate an immutable SHA256 manifest for all files in the actual public build, including lazy chunks, with exact repository/source/run/attempt identity.
- Check public assets with bounded parallelism, request/body timeouts, readiness retries and a total deadline; restrict destinations to the two approved sites and reject redirects/unsafe paths. Recheck shell/release identity before success.
- Preserve existing prepublish tests and publish the same build to Pages/Wasmer. Move readiness/browser checks into a credential-free, read-only reusable/manual verification workflow consuming the original manifest artifact. No rebuilding or republishing in verify-only paths.
- Validate original main deployment run/attempt/SHA, successful publication, artifact ownership and current release before accepting a manual rerun. Missing old artifacts are an explicit unsupported case, not reconstructed byte proof.
- Keep optional Supabase deployment explicitly opted-in and downstream of successful verification; do not run it during this task.
- Distinguish live HTTP errors from transport errors, preserve failOnFlakyTests and network isolation, and add a read-only Jobs smoke.

## Verification

Deterministic Node tests cover complete asset enumeration, path/symlink rejection, identities, bounded retries/timeouts, redirect/hash failures and stable final shell. Workflow tests assert read-only verification permissions and no publishing/backend path. Run full type/build/unit plus browser containment and safe live smoke with evidence retained. Document rerun procedure and historical limits.

## Release boundary

Prepare a focused public PR after tests. Do not merge it or run the old monolithic deploy merely to make historical status green. No production schema, account, profile, portal, Telegram or worker changes.

## Completion and Verification — 2026-11-16

Implemented complete-build manifest/hash validation, fixed-site bounded readiness, release marker rechecks, immutable artifact provenance and independent read-only `verify-live.yml`. The publisher retains all prepublish gates; optional backend deployment remains separately opted-in and downstream. Manual verification accepts only an original successful publisher/run/attempt/SHA, never arbitrary URLs or rebuilt bytes. Historical releases without manifest archival are explicitly unsupported for original-byte verification.

- Full/build TypeScript, script syntax, raw-HTML gate, Vite build and E2E type/containment checks passed.
- 30 deterministic containment, live-transport, readiness/provenance and workflow regressions passed. They cover redirects, timeouts, stale/hash changes, lazy/nested files, symlinks/traversal, original publisher/artifact identity and no publication/backend path in manual verification.
- Official actionlint1.7.12 passed workflow syntax/expression validation. Its executable was verified against the official release SHA256; external shellcheck/pyflakes were not available and were not claimed.
- CLI integration on a temporary copy of the actual build recorded141files, including lazy CoachChat/Jobs chunks, with no network requests. This synthetic local identity is not a deployment claim.
- Full Vitest completed148files:2,236passed/one existing timing assertion failed (`triageLevel`84.7ms versus10ms). The unchanged performance file then passed8/8; timing budgets and application code were not modified. The original failed full gate remains retained.
- Initial anonymous Jobs smoke overcounted a blocked read-only SQL search POST as a mutation. Classification now treats only the exact stable search RPC as read-only while requestPolicy still denies all backend traffic; regression asserts it cannot enable network access. No execution or actual write occurred.
- Strict read-only smoke runs with retries0 showed live availability failures: one run3passed/one Wasmer transport failure; an unchanged rerun2passed/two landing/lazy-asset transport failures. Both sites' Jobs assertions have passed individually, but no all-green full live run is claimed. Transport failures remain fatal and retained. No repeated deploy, screenshot/timeout relaxation, test skip or hidden network retry was introduced.

- Initial PR CI's standalone disposable SQL job failed twice because `pg_isready` accepted PostgreSQL's temporary initialization server, which restarted before the first test query. The independent browser job's separately initialized SQL-backed worker proof passed. Both database setup gates now require two successful real `select 1` queries one second apart; workflow regression pins that behavior. No SQL or application logic changed.

Read-only review found no concrete blocker; hosted artifact transfer/provenance will still require the first actual publication with this workflow. PR full remote CI and the first manifest-proven publication remain the gates before any later merge. This implementation does not retroactively erase PR179's historical failed smoke run.
