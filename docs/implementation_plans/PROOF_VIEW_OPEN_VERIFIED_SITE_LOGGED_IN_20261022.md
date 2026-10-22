# 👁 Proof view — open a verified site LOGGED IN from the app

> **2026-10-22 (owner ask): "Here it says verified for user session. But I don't
> see visible proof in the related website. So once it is verified I want a
> website link which opens website with logged in from app."**

## The gap

The per-site strip's green **"✓ session verified"** chip is a probe verdict the
engine stamps into `job_sites.session_state` (`--sessions` headless probes over
`freebuff-apply-profile/`). That profile shares no cookies with the owner's
normal browser — so the claim was literally unprovable from the app. A plain
URL link can never be logged in. The only honest proof is a window the ENGINE
opens over its own saved session.

## What was built

Same bridge as 🔑 sign-in (`login_requests` → Telegram listener → spawned
window), with a second `kind`:

| Piece | File | Change |
|---|---|---|
| Request RPC (kind-aware overload) | `supabase/login-requests.sql` | `admin_request_login(p_host, p_kind)`; `login_requests.kind` (`'signin'` default `'view'`); `engine_pending_login_request()` widened to return `kind` (drop + recreate — return-type change, #163 precedent) |
| Lifecycle | `supabase/signin-lifecycle.sql` | `closed` reported by proof runs; `engine_report_login_status` stamps `closed_at` for it |
| Driver | `scripts/auto-apply-jobs.js` | `--view-only` mode (`runViewOnly`): clone profile → headed window over saved session → wait for owner close → fold refreshed cookies back, delete clone. Listener's `pollLoginRequests` short-circuits `kind='view'` BEFORE the stale-process sweep (the sweep would kill the window we are opening), reports opened → closed/failed, no lock file (watcher may run — the view holds only the clone) |
| Sweep protection | `scripts/engine-lifecycle.js` | `--view-only` node runs join `--login-only` in the protected pid class |
| Service | `src/services/jobSites.ts` | `requestSiteLogin(host, kind)`; `LoginLifecycle` + `"closed"` |
| UI | `src/components/jobs/JobSitesPanel.tsx` | `👁 open site` button on every `verified` chip; `VIEW_STATUS_TEXT` map (requested / opened NOW / closed = success / crashed / failed), 2h poll window, honest "waiting — engine Off" wording |

## Safety invariants

- The view runs on the SIGN-IN CLONE (`freebuff-apply-signin-profile`), never on
  the real profile — a watcher cycle may legitimately hold it while the window
  is open (partly why there is no `signin-active.lock`).
- Same early-guards as sign-ins protect the clone across its whole lifecycle:
  live-owner marker (`owner-alive.json`, written by the clone fn) covers the
  clone/launch phase, chrome-on-clone probes cover the window, and the
  `--view-only`/`--login-only` node-run class is excluded from every sweep.
- Nothing is typed, submitted, or judged in a proof window — it is read-only
  seating. Cookies refreshed while browsing still fold back (same hygiene as
  sign-ins) via `mergeSigninProfileBack`.
- Degradation: until the SQL overload is applied, the 👁 click errors with the
  PostgREST message (honest tip-off, never a silent no-op); if the engine is
  Off the row says WAITING instead of "~30s".

## Owner steps to go live

1. Deploy the web app (merge → deploy.yml).
2. Apply `supabase/login-requests.sql` + `supabase/signin-lifecycle.sql` in the
   Supabase SQL editor (both idempotent).
3. Restart the desktop listener (`node scripts/auto-apply-jobs.js --listen` or
   let the watchdog respawn it) so it picks up the `kind` column and view path.
4. Try: Job sites registry → any green "✓ session verified" row →
   **👁 open site** → a maximized window opens showing the signed-in page.
