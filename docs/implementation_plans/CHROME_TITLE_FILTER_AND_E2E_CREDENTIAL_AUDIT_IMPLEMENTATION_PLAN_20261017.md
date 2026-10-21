# Chrome-Title Filter + E2E Credential Audit — Implementation Plan

**Timestamp:** **2026-10-17T14:05:00.000Z (UTC) | 17-10-2026 19:35:00 (IST)**

## Overview

Recommendation round after PR #169 merged and deployed: verify the live
deployment, restart the engine onto the fixed code, complete the
end-to-end-credential story (login by the engine), and stop the skip-history
pollution at its root.

## Findings + changes

1. **Deployment verified** — PR #169 merged; "Deploy to GitHub Pages"
   succeeded (2026-10-17T03:25Z). Production app carries the trust latch,
   heal readback, reuse stats and trust chips.

2. **Engine restarted onto fixed code** — the stale `--listen` (08:25) and
   `--sessions` (08:50) processes were stopped; Listener/Relay/Sessions
   scheduled tasks re-run; every engine process now post-dates the
   `trySubmit ctx.ai` fix (09:03 mtime).

3. **E2E login (credential retention) — rails already complete, zero
   bindings** — `site_credentials.sql` (#138) ships the full loop:
   owner stores a login in-app ([CredentialsPanel](../../../src/components/jobs/CredentialsPanel.tsx),
   mounted in AutoApplyCard) → `admin_put_credential` →
   `admin_bind_credential` → `engine_credential_for_site` (service-role RPC,
   verified live) → [job-sites-db.js](../../../scripts/job-sites-db.js)
   `credentialForSite` → driver **auto-login at `ensureLoggedIn`** when a
   session dies (kind `password` only; oauth/otp stay human — Google blocks
   typed automation by design), then re-persists the session +
   sidecar (#162/#165) so "no re-login ever again" holds from the second
   successful login onward. Live query: 0 credentials bound — the owner must
   do the one-time in-app entry (secrets are theirs to type; none invented).
   Playwright itself resolves from the owner-machine fallback install with
   chromium-1243 provisioned — no package install needed.

4. **Nav-chrome title filter (the audit root cause)** — pure lib exports
   `CHROME_TITLE_RE` + `isChromeTitle` (WHOLE-LINE matching: the audit junk
   "Apply now" / "Register" / "Sign in for My Jobs" drop; real postings like
   "Apply as a DevOps Engineer" survive; a pinned class-order fix keeps
   id-bearing hrefs from being scored nav when their label is blank).
   Wired into [collectJobs](../../../scripts/auto-apply-jobs.js) at both
   layers: the in-page evaluate filters chrome first lines, and the
   node-side adjudicated filter drops `__navCandidate` chrome titles (the
   fail-open path on unknown boards) while explicit id-bearing collectors
   stay unconditional. Pinned in `applyEngine.test.ts` (173/173 pass).

5. **Instahyre URL — my earlier finding corrected** — the "dead URL" came
   from MY typo'd probe (`/search_jobs/`, underscore — a genuine 404, and the
   dead page in the pilot's debug dump). The REGISTERED jobs URL
   `/search-jobs/?search=react` returns 200 guest-facing; the engine has been
   collecting from it all week (51 recorded rows). Registry unchanged.

## Verification

- `npx vitest run src/__tests__/applyEngine.test.ts` 173/173;
  full-gate run pending push (pre-push hook re-runs everything).
- Live SQL probes: `engine_credential_for_site` exists; zero credential
  bindings; registered instahyre URL HTTP 200 vs 404 for the underscore variant.

## Next steps

- Owner one-time: store + bind credentials per site in the app
  (Credentials panel → AutoApplyCard) — then the engine performs all
  re-logins silently.
- `Michael Page`-style brand chrome still passes (no brand list — a real
  title could collide); the collection-drift log line catches it when a
  scrapes-only run still occurs.
