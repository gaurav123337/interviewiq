# Schema Coverage Test Failure Fix Implementation Plan

**Timestamp:** **2026-10-28T04:14:19Z (UTC) | 28-10-2026 09:44:19 (IST)**

## Overview

Fix schema-coverage assertions whose assumptions treated all SQL-editor SQL files as setup-live-managed and whose former idempotence condition incorrectly described every SQL file as rerunnable. Keep the production setup batch scoped to the actual activation flow.

## Current State Analysis

- `scripts/setup-live.js` applies a bounded list of feature SQL files, with bootstrap SQL and cron scheduling handled in separate phases.
- The schema coverage test was ignored by `.gitignore`, so its local failures could not be corrected in CI. Its old assertions treated every standalone SQL file as part of setup-live and applied its rerun rule outside the automated schema batch.
- The test should protect actual setup-managed files, their idempotence and dependency ordering without requiring standalone/manual SQL files to be in the live setup batch.

## Implementation Phases

1. Restrict setup wiring and idempotence checks to the bootstrap, schema batch, and cron files that setup scripts actually manage.
2. Retain coverage that the schema batch contains existing, unique, non-cron files and preserves dependency order.
3. Run the focused schema coverage test, then the repository's pre-push gates.
4. Push the validated changes to `main` and verify the remote branch ref.

## Technical Considerations

- Do not add unrelated SQL-editor features to `setup-live.js` merely to satisfy an overbroad test; doing so could apply schema changes and RLS policies unexpectedly.
- SQL operations outside the automated setup flow remain manually managed.
- The regression test is now included in Git so CI runs the corrected coverage assertions.

## Success Criteria

- Focused schema coverage test passes.
- Typecheck, security gate, production build and full test suite pass before push.
- `origin/main` matches the intended pushed commit.

## Completion Summary

- Corrected schema coverage to validate only setup-managed SQL operations and removed its accidental `.gitignore` exclusion; the focused test passes.
- Corrected `setup-live.js` comments to describe its actual bounded scope.
- Focused schema coverage: 5/5 passed; full Vitest suite: 1,763/1,763 passed; typecheck, production build, no-innerHTML gate, and setup-live syntax check passed.
- Git commit and push are the final steps.
