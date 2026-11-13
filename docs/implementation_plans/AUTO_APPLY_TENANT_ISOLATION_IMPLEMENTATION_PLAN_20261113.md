# Auto-Apply Tenant Isolation Implementation Plan

**Timestamp:** **2026-11-13T05:30:13Z (UTC) | 13-11-2026 11:00:13 (IST)**

## Overview

Convert the paid auto-apply Control Center from a single-owner/admin subsystem into a user-isolated workflow backed by a revocable paired local agent. The project service-role key must remain server-side, purchaser data must be partitioned by `user_id`, and global board administration must remain an explicit administrator capability.

## Current State

- Auto-apply entitlement unlocks the entire Control Center, including global admin panels.
- Several authenticated `SECURITY DEFINER` readers return global owner data without an in-body authorization check.
- Core application results, reviews, variants, answer memory, learning, and outcomes have no tenant key.
- The local engine reads a project service-role key from local settings and has no application-user identity.
- Board catalog, user session state, credentials, engine lifecycle, and run controls are mixed together.

## Implementation Phases

### 1. Containment and hardening

- Separate entitlement from administrator capability in the Jobs UI.
- Hide global/admin panels from non-admin purchasers until scoped replacements exist.
- Add explicit body guards and narrow grants to sensitive definer RPCs.
- Reduce cross-user admin support views to summary-only information.

### 2. User-owned core schema

- Add owner keys, RLS, owner-leading uniqueness, and scoped RPCs for results, reviews, variants, answer memory, strikes, exemplars, outcomes, and notifications.
- Backfill legacy rows only to an explicitly supplied, email-verified owner.
- Consolidate current terminal RPC contracts and fix adjacent result/governance/review definition drift.
- Preserve a temporary legacy-owner compatibility path until paired-agent verification passes.

### 3. Paired customer agent

- Add one-time pairing codes and revocable token-hash bindings.
- Add an allowlisted `apply-agent` Edge API that resolves ownership from the binding token and rechecks entitlement.
- Add a local pairing CLI and binding-scoped state root.
- Route paired engine data access through the Edge API; never distribute the project service-role key.
- Keep binding metadata out of candidate profile data and AI prompts.

### 4. Scoped purchaser experience

- Add pairing/list/revoke UI.
- Re-enable only the signed-in user’s reports, review queue/history, variants, learning, and Telegram flows.
- Keep global registry, credentials, parser rules, cloud endpoint, and global lifecycle controls admin-only in this delivery.

### 5. Live rollout

- Inspect live schema, ACLs, row counts, and verified legacy owner.
- Apply the additive migration and deploy affected functions only after a separate final confirmation.
- Pair the owner agent, run two-user isolation probes, then apply the contract phase.

## Technical Considerations

- Browser-facing RPCs derive ownership from `auth.uid()` and never accept a caller-selected user UUID.
- Paired-agent calls derive ownership from a hashed, revocable binding token.
- Existing rows remain readable during expansion; unsafe legacy overloads are removed only after smoke testing.
- The global `job_sites` catalog stays global in this slice; user-specific board/session/credential state is deferred.
- SQL is manually applied in this repository, so migrations must be idempotent, ordered, and independently verifiable.

## Success Criteria

- An entitled user cannot read or mutate another user’s auto-apply rows.
- Anonymous/free users cannot execute sensitive RPCs.
- Purchasers never mount global admin panels.
- Pairing codes are short-lived and single-use; stored agent tokens are hashed and revocable.
- Paired mode contains no project service-role key and has no arbitrary RPC proxy.
- Existing owner data is preserved through an explicit verified backfill.
- Unit, type, build, Deno, and isolated browser gates pass.

## Next Steps

1. Contain the current frontend and harden RPC definitions.
2. Add and test the ownership migration.
3. Implement paired-agent API/CLI and scoped core actions.
4. Re-enable purchaser panels incrementally.
5. Verify locally, then pause for live-rollout confirmation.

## Completion Summary

**Local implementation and approved production backend expansion completed and verified. Frontend publication and contract cutover remain separate.**

- Added expand/contract migrations, explicit verified-owner backfill, own-row RLS and owner-leading uniqueness, strict self/agent action dispatch, summary-only admin support, and legacy RPC revocation.
- Added paired-agent Edge API, single-use code exchange, hashed revocable bindings, durable rate limits, external credential CLI, and binding-scoped runtime paths/child propagation.
- Integrated engine core transport in paired and verified legacy modes; global registry/session/credential/lifecycle mutations remain unavailable to customers. Legacy process sweeps exclude paired workers.
- Integrated own-core UI and pairing controls, six result states, private Telegram digest/test routing, and late entitlement response protection on account switching.
- Added explicit inspection/apply migration runner and local PostgreSQL fixtures/assertions.
- Simplified Windows token onboarding: `setup-supabase-token.cmd` opens a hidden-input local prompt; `supabase-token.ps1` uses Windows-account DPAPI encryption, private directory ACLs, atomic encrypted-file replacement, and credential-free status/read-only inspection modes. Synthetic self-test passes encryption, decryption, replacement, and ACL checks; no real credential read, token save, or network request was performed by that test. Credential stays outside the repository and is never accepted in chat.

### Verification

- Full Vitest prior Node 24 run: **137 files / 1,923 tests passed** before final hardening/auth edits. Final targeted check: **70 tests passed**, TypeScript passed, and production build passed. Node 22 full rerun passed **1,911 assertions in 137 files** but exited 1 because `applyKitPhase5.test.ts` hit a forks-worker startup timeout; this is not a clean gate. The missed file passed on focused rerun; the complete Node 22 serial rerun subsequently passed **138 files / 1,932 tests / 0 failures / 0 unhandled errors**.
- RAG regression: **41 tests passed**.
- PostgreSQL: all additive migrations executed/replayed; two-user RLS/action isolation, same-key coexistence, event dedupe, gift paid-access preservation, single-use redemption/exchange, and revocation/rate-limit assertions passed.
- Static tenant-security checks: **8 passed**; paired engine coverage: **21 passed**.
- Isolated Node **22.23.5** and Deno **2.9.6** installed outside the repository with lifecycle scripts disabled; system Node unchanged.
- Browser baseline: **96 passed / 1 intentional desktop skip**. Added complimentary/pairing suite: **12 passed** across desktop/mobile after correcting explicit public-bootstrap and own-profile fixture contracts. Final combined full-suite rerun: **108 passed / 1 intentional desktop skip / 0 failures / 0 flaky results**.
- Deno: **94 shared-code tests + 6 paired-handler authorization tests passed**; `deno check` passes for the paired and notification handlers.
- Rollout review fixes: expansion hardens every installed legacy host-history overload; credential validation/action execution now share a locked binding transaction; contract requires explicit scoped read/write + two-user smoke confirmation, not ordinary catalog usage. PostgreSQL revoke/dispatch assertions and contract replay pass locally.
- Production Wasmer origin added to explicit CORS allowlist and pinned by tests; native agent requests remain browser-origin prohibited.
- No real third-party job submission or Telegram message was sent.
- Live backend expansion applied transactionally to `ndrusywvceojsoirhkhl` after explicit final approval. Owner `5f6bce44-1cc7-45d0-9429-f37e09cdf745` was verified through the confirmed auth email. Preserved all core rows: 1,911 decisions, 114 reviews, 25 answers, 3 strikes, 82 exemplars, 0 variants/outcomes. Every core row is owner-assigned with no null ownership.
- Deployed only `apply-agent` (ACTIVE v2) and `send-notify-test` (ACTIVE v7). Native CLI stderr progress interrupted the first wrapper; migration success was reconciled read-only before resuming function-only deployment. Both final deployments succeeded and anonymous calls return 401.
- Live ACL/RLS verified: old global decision/review/variant/host-history/policy readers and audit helper are not executable by anon or ordinary authenticated roles; own-core RPC remains authenticated-only; agent dispatcher remains service-only. Engine is still `off`, grants/bindings remain 0, billing audit count remains 5.
- Created and decrypted-verified a DPAPI snapshot of selected application/billing data plus schema metadata before rollout at `%LOCALAPPDATA%/InterviewIQ/management/snapshot-f8c8905210e44eef9b32e26b00559f67/pre-rollout.dpapi`; ciphertext SHA-256 `1b5e9527176d4e8edc68d10ffab6483c877a8af2145f170f498329f883b9fe29`. This is not a full database backup; Supabase reports no managed backups/PITR.
- Authenticated live owner pairing/scoped read-write and two-account Edge probes have not run; no plan granted, message sent, real job submitted, or contract applied.
- No commit, push, PR, or frontend release performed. `dist/` is tracked in this checkout and was regenerated by the normal build; no generated assets were hand-edited.

### Remaining limits / deviations

- Paired customer mode is template-only, with discovery/watch/listen/session automation explicitly unavailable. Per-user remote lifecycle and credential-vault UI remain deferred.
- Original governance/employer-cap logic and historical SQL override cleanup need a follow-up; this delivery does not claim employer-specific enforcement is repaired.
- Expanded legacy private-data RPCs are service-only; contract revokes the obsolete APIs after the verified paired owner has used the new path. Older historical SQL must not be reapplied afterward.
- Frontend publication is authorized and being prepared on `feat/auto-apply-tenant-isolation`. Release review added account-bound entitlement/admin capability, late-redemption guards, and reactive add-on unlock. Focused identity/entitlement tests and 12 final desktop account/pairing journeys pass; remote CI must verify the final published commit before merge. Generated `dist/` and CLI caches are excluded from the source commit.
- Live owner pairing/scoped read-write and two-user Edge probes remain required before a separately approved contract cutover. Credentials are saved DPAPI-encrypted outside the repo; no token was placed in chat or source.
