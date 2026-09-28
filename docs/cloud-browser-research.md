# Removing the always-on-PC dependency — persistent cloud browser research

**Date:** 2026-09-28 · **Status:** recommendation + integration plan (next big PR)
**Question:** the apply engine runs only while the owner's PC is on and logged in. Can a
hosted persistent browser session remove that dependency?

## Why the engine is machine-bound today

1. Logins live in a **local persistent Chromium profile** (`freebuff-apply-profile/`).
2. Job boards (LinkedIn hardest) **block datacenter IPs aggressively** — residential
   IP + real browser fingerprint is what keeps sessions alive (2026 sources agree
   browser fingerprinting + IP-reputation scoring is the first wall).
3. Secrets (service key, apply profile) are deliberately **local-only**.

## What changes with a cloud persistent browser (CDP)

The engine swaps `launchPersistentContext()` for Playwright's
`chromium.connectOverCDP(wsEndpoint)` against a hosted session that **stays alive
between runs**. Cookies/localStorage survive in the vendor's session — the login
persistence the local profile gave us moves to the cloud. The engine already uses
generic Playwright page APIs, so the fill/submit/preview code is untouched; only
browser acquisition changes, plus a `--remote` flag and env-config.

## Vendor landscape (checked 2026-09-28)

| Vendor | Session persistence | Notes |
|---|---|---|
| **Browserbase** | yes — named, resumable sessions; context reuse | category leader; self-serve from ~$20/mo, ~$0.05–0.10/browser-hour; strong stealth + captcha solving; mature docs + JS SDK |
| **Steel.dev** | yes — reusable sessions, CDP | cheapest control-plane in public benchmark; transparent per-VM pricing; good fit for long-lived sessions |
| **Hyperbrowser** | yes — sessions + stealth profiles | agent-oriented APIs, generous free tier for trials |
| **Kernel** | yes | newer entrant; browser-hour pricing ~$0.02 on some platforms |
| **Browser Use cloud** | partial | cheapest browser-hour ($0.02) but more agent-framework-shaped than session-shaped |

Shortlist for us: **Browserbase** (best docs/resume semantics) or **Steel**
(best cost for an always-warm session). Both expose CDP, which is all Playwright needs.

## Costs, honestly modeled

- 4 cycles/day × ~15 min active = ~1 browser-hour/day ≈ **$1.5–3/mo** on
  per-hour pricing… **but** a *persistent* session that stays warm 24/7 is billed
  while idle too on some vendors — keep-warm matters. Steel-style per-VM billing
  favors idle-tolerant setups; Browserbase resumable sessions let us pay only
  during runs while keeping cookies server-side.
- Realistic budget: **$5–20/month** — trivial vs. the value, but not $0.

## Risks (the part that decides this)

1. **Cloud IP reputation** — the #1 risk. Mitigations, in order of preference:
   vendor **residential/mobile proxy add-on** (Browserbase/Steel both sell
   geo-targeted residential egress), or routing the session through the owner's
   home via a tiny residential exit relay (self-hosted complexity).
2. **ToS** — driving a real logged-in LinkedIn account from a hosted browser is
   the same automation the local engine does; account risk is unchanged in kind,
   but new-IP-logins look suspicious → keep one stable egress IP per site session.
3. **Secrets move up a level** — vendor API key + session IDs must live in Supabase
   secrets, never in the repo; the apply profile JSON stays local.
4. **Fingerprint drift** — a new browser fingerprint mid-life of a session can
   trigger re-auth; vendor "context reuse" features exist precisely for this.

## Recommended architecture (PR-sized)

1. `scripts/apply-browser.js` — acquisition layer: `--remote` flag reads
   `BROWSERBASE_API_KEY` (or Steel) from env/Supabase secrets; local mode unchanged.
   Local stays the DEFAULT — remote is opt-in per run or per scheduled task.
2. Session naming: `interviewiq-linkedin-v1` etc.; create-if-missing, reconnect-if-live.
3. The supervisor/watchdog chain stays exactly as built — it just supervises a
   run that may connect remotely; cloud runs make the on-prem watchdog optional.
4. Phase it: **(a)** dry-run remotely for one site (Naukri, most forgiving) →
   **(b)** Instahyre auto-submit remote → **(c)** LinkedIn last, with residential
   egress, only if (a)+(b) hold sessions for 2 weeks.

## Verdict

- **This removes the PC dependency: yes** — with a cloud session the engine can
  run from anywhere (Supabase Edge Function, GitHub runner, this PC, a phone-termux
  box) and survive all machines being off.
- **Ship it now?** Not yet — validate session durability on Naukri for a week
  (option a above) before moving LinkedIn. The self-healing local rig from PR #116
  keeps tonight's runs safe meanwhile, at $0.

## Sources

- steel.dev/blog/steel-vs-browserbase-a-practical-comparison (Jan 2026)
- pkgpulse.com browserbase-vs-hyperbrowser-vs-steel (Apr 2026)
- kernel.sh best-free-agent-browsers-2026 (Aug 2026)
- use-apify.com best-proxies-linkedin-scraping-2026; vayne.io linkedin-scraping-guide-2026
  (datacenter IPs blocked immediately; fingerprint + IP reputation heuristics)
