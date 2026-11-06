# Frontend Deployment Sync Implementation Plan

**Timestamp:** **2026-11-06T06:52:16Z (UTC) | 06-11-2026 12:22:16 (IST)**

## Overview

Keep the `interviewiq` GitHub repository as the source of truth and publish one tested frontend build to the existing GitHub Pages and Wasmer sites. Preserve the repository name, application code, GitHub Pages path, and Supabase backend.

## Current State

- GitHub Pages serves the root of `gh-pages` at https://gaurav123337.github.io/interviewiq/.
- `app.yaml` pins `gaurav123337/jobassist` (`da_KwGIWtMUZQko`), with the public alias https://job-assist.wasmer.app/.
- The workflow instead overrides the Wasmer name with `interviewiq` and masks deployment failures.
- An ordinary frontend push can also deploy Supabase functions when its credential gate passes.

## Implementation Phases

1. **Configuration:** align the Wasmer command with the pinned app; fail visibly on missing credentials or deployment errors; require a default-off manual `deploy_supabase` input before backend deployment.
2. **Documentation:** correct deployment instructions and stale app-name comments without changing Pages settings or the Wasmer package name.
3. **Validation and release:** validate workflow syntax and guards, run the existing checks, review the diff, and push a normal fast-forward release to `main`.
4. **Acceptance:** monitor both frontend deployments, confirm Supabase is skipped, and compare the public sites' generated build assets.

## Technical Considerations

- Reuse the existing pinned Actions, Wasmer CLI, build gates, and `dist/` packaging. No application dependency, UI, schema, or API changes.
- A push to `main` triggers one build and two frontend publications. Deployments are sequential, not atomic: a failed Wasmer step can leave Pages updated first, and the run must report that failure.
- Wasmer credentials remain in the existing GitHub Actions secret. No credential values are written or retrieved.
- Backend functions now require explicit manual opt-in; this release does not deploy them or run migrations.
- Both sites use the same frontend source, but browser-local state is origin-scoped and is not copied between domains by deployment.

## Success Criteria

- `main` contains the deployment-only correction; `interviewiq` and its Pages URL are unchanged.
- Existing CI checks pass; both frontend deployments succeed for the same commit.
- Wasmer resolves the pinned `jobassist` app and does not target the separate `interviewiq` app.
- The Supabase step is skipped on this release.
- Public HTML/assets at both sites match the released build; unverified runtime behavior is explicitly reported.

## Next Steps

Implement the approved configuration changes, validate, commit, and push. If credentials or platform checks block deployment, report the blocker without claiming both sites are synchronized.

## Completion Summary

- Corrected the Wasmer target to `jobassist`; preserved the repository, Pages URL, package name, and application code.
- Made Wasmer credential/deployment failures blocking and backend deployment an explicit manual opt-in.
- Added a post-deployment CI check comparing each public site's HTML, service worker, and referenced bundles with the built artifact using SHA-256. It allows bounded Pages/CDN propagation before failing on drift.
- Corrected deployment documentation.

### Verification

- Actionlint 1.7.12, Bash syntax, and isolated deployment-guard cases passed (missing token, successful deployment, rejected deployment).
- Production dependency audit: 0 vulnerabilities. The all-dependencies install audit separately reported 2 moderate and 3 high development-dependency findings; no dependency changes were made.
- Local typecheck, production build, 41 RAG checks, and 85 Deno tests passed.
- Local Node 25 is outside some dependencies' declared engine ranges. An isolated Node 22 download failed with `ECONNRESET`; CI retains its existing Node 22 setup and full hard gates.
- Local DNS could not resolve either public hostname; public artifact verification will run from CI. Rendered-browser behavior has not been verified.
- Full frontend test suite on local Node 25 is not green: the run reported failures in existing `reviewInbox-perf.test.ts` timing checks (6.25s / 5.57s versus 2.5s limits) and three `app.flow.test.tsx` scenarios. The slow run was stopped after these failures, without a final suite summary. Neither tests nor application code were changed; the existing Node 22 CI suite remains a hard pre-deployment gate.
- Production publication and public artifact verification: pending the release workflow.
