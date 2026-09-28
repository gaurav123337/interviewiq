# Residential-exit relay — the $0 "cloud" session

**Date:** 2026-09-28 · **Status:** LIVE and validated end-to-end (PR #119)

## What it is

A **dedicated persistent Chromium** running on the owner's machine with CDP on
loopback (`http://127.0.0.1:9222`). The apply engine's **☁️ Cloud mode**
connects to it over CDP: the browser session (job-board logins) lives in the
relay browser, not in the engine process — so apply runs can happen from any
machine that can reach this one, **while all traffic still egresses from the
owner's residential IP**. That was the open risk in `cloud-browser-research.md`
(cloud-IP blocking on LinkedIn) — this eliminates it at $0/month.

## Why a dedicated profile

`freebuff-apply-relay-profile/` is deliberately separate from the local
engine's `freebuff-apply-profile/`: a profile dir is single-consumer, and the
relay must never fight the local engine for a profile lock. Sign in to job
boards ONCE in the relay window (it opens headed on the desktop); the relay
session persists for weeks like the local one always has.

## Ops

| Thing | Value |
|---|---|
| Start (idempotent) | `node scripts/start-apply-relay.js` (or the `.cmd` shim) |
| Self-heal task | `FreebuffApplyRelay` — user-level, every 5 min, no admin |
| CDP endpoint (this PC) | `http://127.0.0.1:9222` |
| CDP endpoint (tailnet) | `http://100.67.11.18:9222` (also `tcp://desktop-3mu554f.taila7dd5d.ts.net:9222`) |
| Zombie guard | the starter kills stale processes bound to :9222 before spawning |
| Logs | none by design (stdio ignored); health = `curl http://127.0.0.1:9222/json/version` |

## Switching the engine to relay-cloud mode

UI → Auto-apply card → **☁️ Cloud session** → paste the endpoint (loopback for
runs on this PC, tailnet IP for runs elsewhere) → Save. Or SQL:
`update apply_config set mode='cloud', cloud_endpoint='http://100.67.11.18:9222'`.
Back to local the same way with `mode='local'`.

## Validation record (2026-09-28)

1. relay up → idempotent re-run = no-op
2. engine cloud-mode dry-run THROUGH the relay (loopback): `✓ Instahyre: session active`,
   collected 2 real postings, correct skill-gate rejections (java/microservices,
   python) — headed relay + residential IP sailed past the bot-check that blocked
   a headless stand-in browser in the #118 test
3. engine disconnected → relay survived (disconnect-not-kill holds)
4. killed the relay → `FreebuffApplyRelay` task restored it (self-heal proven)
5. Tailscale re-login (the morning reboot had logged it out; OmniRoute funnel
   also recovered) → `tailscale serve --bg --tcp 9222 tcp://127.0.0.1:9222`
   → relay reachable at the tailnet IP (`/json/version` 200)
6. Known issue (tracked): a cloud run against the tailnet IP wedged past the
   5-min shell timeout (page.goto watchdog gap for CONNECT-remoted pages);
   config restored to local. Local-mode watchdogs don't apply to remote
   sessions — needs the per-job watchdog to close remote pages too before
   cloud mode is trusted on scheduled runs.

## Security notes

- CDP binds to **loopback only**; the tailnet exposure is private (tailnet
  members only, not a funnel/public URL). CDP has no auth — never expose it
  via `tailscale funnel` (public).
- The relay is a real logged-in browser on a real desktop session: lock the
  PC when away; the apply rig only needs the session alive, not unlocked,
  except when a login re-auth is required.
