# Auto-Apply: what blocks FULL automation, and where we stand vs the market

**Date: 2026-10-23** · **Status:** analysis only, no code changed · **Scope:** `scripts/auto-apply-jobs.js`, `scripts/apply-engine-lib.js`, `scripts/apply-browser.js`, `scripts/engine-lifecycle.js`, `supabase/apply-governance.sql`, `supabase/site-credentials.sql`

This asks one question: **what still needs a human between "engine wakes up" and
"application received by employer"?** It also maps that honestly against the
commercial auto-apply market.

Short answer: the pipeline is already automatic end-to-end for four boards. The
remaining human touches are concentrated in three places — **session renewal**,
**CAPTCHA**, and **ATS coverage** — and the largest *quality* gap (as opposed to
automation gap) is that we cannot see replies on the boards we auto-submit to.

---

## 1. What is already fully automatic (verified in code)

| Capability | Where | Note |
|---|---|---|
| Wake → discover → collect → judge → tailor → fill → submit → report | `runWatch` → `runAll` → `runSingle` | 6h loop, boot network guard |
| Auto-submit | `SITE_RULES`: naukri, instahyre, greenhouse, ashby | `autoSubmit: true` |
| Earned auto-submit | `autoSubmitTrustPatch` | verified clean submits promote a site; `AUTO_SUBMIT_NEVER_HOSTS` blocks LinkedIn forever |
| Review-gated | linkedin, indeed, lever, workatastartup, wellfound, builtin, generic | unattended ⇒ skipped + queued, never hangs |
| Board discovery + probation | `--discover`, `engine_activate_probation_sites` | 7d wait, max 3/sweep, DM'd |
| Self-healing collection | learned rules → widening → AI heal (verbatim-verified) → persist | drift counter only advances when all fail |
| API-first collection | `atsApiCollectPlan` (greenhouse/lever) | skips the listing page entirely |
| JD tailoring | `buildKit` + template fallback | AI failure never blocks a run |
| Fail-closed answers | `planFormAnswers` → `unfilledRequired` | honest needs-review, never a guessed eligibility answer |
| Answer memory + LLM field mapping | `normalizeFieldKey` / `mapUnknownFields` | job-specific kinds deliberately not reusable |
| Budget / quiet hours / kill switch | `budgetGate` (20/day, 80/week), `isQuietHours`, `engine-lifecycle.js` | Off kills processes, not just cycles |
| Session durability | `persistSessionCookies`, sidecar re-inject | survives session-only cookies + hard browser death |
| Stored-credential auto-login | `credentialForSite` | `kind: "password"` only |
| Outcome learning | `--outcomes` → judge prior; dead-board suspension (10 apps / 0 views) | |
| Remote control | `--listen` Telegram loop, review queue in UI | ✓ / ✕ / 🚫 resolve, field preview |
| Cloud/residential | relay CDP on :9222 (`docs/apply-relay.md`) | $0/month, residential egress |

That is more automation than most paid products ship. The gaps below are what
remains.

---

## 2. Blockers, ranked by impact on unattended operation

### P0-1 — Session renewal is the single biggest stop
`ensureLoggedIn` can only re-authenticate without a human when the bound
credential is `kind === "password"`. Anything Google-OAuth-bound (the default
for most LinkedIn/Instahyre/Naukri users) or OTP-bound expires and the site is
skipped for the whole cycle. A CAPTCHA on the login page logs
`auto-login did not land on a signed-in state — falling back to the human flow`,
which unattended runs cannot satisfy.

Consequence: throughput silently drops to whatever sessions happen to be alive.
The digest reports uptime, not "3 of 6 boards were logged out all week".

Fix (in order of value):
1. **TOTP support.** Store a TOTP seed per credential (kind `totp`) and generate
   the 6-digit code locally with RFC-6238 (30s window, ±1 step). No human, no
   network, deterministic. This alone unblocks every board whose 2FA is an
   authenticator app.
2. **Per-site session expiry forecast.** Record `lastVerifiedAt` + cookie
   `expires` per site and DM *before* the cycle that will fail, not after.
3. Accept that OAuth + SMS-OTP stays human; surface it as a first-class
   "needs you" state instead of a skip.

### P0-2 — No mid-form CAPTCHA handling
`grep -i captcha` over the engine returns one log string. A reCAPTCHA /
Turnstile / hCaptcha on the *apply* form currently falls through to
`detectSubmissionSuccess` failing ⇒ `needsReview` (best case) or `error` (worst),
with no signal telling the owner that a challenge — not a form bug — is the
cause.

Fix: pre-submit detect `iframe[src*="recaptcha"]`, `.g-recaptcha`,
`[class*="turnstile"]`, `[class*="hcaptcha"]`; on hit, record
`needsReview` with reason `challenge: <kind>`, keep the tab open in relay mode,
and DM a deep link. **Do not** integrate a solver service: Turnstile scores
browser signals, residency and session context, so solvers fail unpredictably —
and per `docs/apply-relay.md` the whole point of the relay is to look like a
real browser, which a solver token undermines.

### P0-3 — Zero coverage of the enterprise ATSs
Auto-submit reaches four boards. **Workday, iCIMS, Taleo, SmartRecruiters,
SuccessFactors, Recruitee** have no pack at all — they fall to `generic`,
`autoSubmit: false`, i.e. review-gate at best. These host the majority of
corporate applications, and "we support Workday" is table stakes in this market.

Workday specifically cannot be fixed with a selector list: each employer
configures sections, Candidate Home, consent screens and verification. It needs
a **schema-driven filler** (enumerate labels/aria-labels → map through the
existing `mapUnknownFields` → fill), which is a real project, not a patch.

### P1-4 — No per-employer application cap
Dedupe is per job URL (`freebuff-apply-state.json` + DB). Nothing prevents six
applications to one employer in a week — the fastest way to get a candidate
blacklisted by a recruiter, and exactly what the best-behaved competitor
(Adzuna's ApplyIQ) ships as a feature: max 2 per employer per 60 days.

Fix: `employerKey` (normalized company from the posting) + a governance query
before submit, same shape as `budgetGate`. Cheap, high value.

### P1-5 — The auto-submit channel has no outcome signal
`--outcomes` reads board trackers only; ATS boards are skipped honestly ("no
candidate tracker"). So for Greenhouse and Ashby — the boards that actually
submit without a human — we never learn whether anyone replied.

Fix: read-only IMAP/Gmail polling, match sender domain/company + role against
`apply_results`, classify screen / interview / rejection / offer, write to the
same `apply_outcomes` table the judge prior already consumes. This converts the
whole engine from "count of applications" to "count of conversations", which is
the only metric that matters.

### P1-6 — "Submitted" is a regex, not a receipt
`detectSubmissionSuccess` matches page text. Validation warnings and
"application submitted" copy in headers can false-positive, and this is the
market's single most common complaint about auto-apply tools ("it says applied,
nothing arrived").

Fix: require a second positive signal — URL change to a confirmation route, a
visible application id, or a next-cycle "you have already applied" re-check —
and store the evidence string on the row.

### P2-7 — Async review throws away the filled form
Unattended needs-review takes a screenshot and closes the tab; the owner gets a
field preview to copy into a form they must refill by hand. Every reusable
answer is already in memory, so re-filling should be one click: add a "finish in
engine profile" action next to "Open form ↗" (relay mode can already do this).

### P2-8 — Single-machine dependency
Relay mode fixes IP reputation, not availability. The digest reports 7-day
uptime %, which means we already know a sleeping laptop is a throughput ceiling.

### P2-9 — Unknown-field bucket is where review storms come from
Needs-review reasons cluster on `certificate`, `workAuth`, `longText`. A weekly
"top unanswered field labels" line in the digest would turn that from guesswork
into a backlog.

---

## 3. Market comparison

| Product | Submits without a human? | Coverage | Credentials / session | CAPTCHA / 2FA | Claimed volume |
|---|---|---|---|---|---|
| **This engine** | **Yes on 4 boards**, earned-trust elsewhere | 11 hosts + generic, GH/Ashby/Lever API collect | No typing by default; optional stored password; own profile | none | 20/day, 80/wk (self-capped) |
| Simplify Copilot | Autopilot only (paid, 20/wk) | Workday, Lever, GH, Ashby, iCIMS, Taleo | own profile | undocumented | 20/wk |
| JobCopilot | Yes (hosted) | employer career pages, 500k sites | stores profile + sensitive answers | undocumented | up to 50/day |
| LazyApply | Yes (extension) | LinkedIn, Indeed, GH, Dice, Zip | unclear | undocumented | up to 1500/day (claim) |
| LoopCV | Yes (loops) + extension | 30+ boards | extension rides your session | undocumented | ~300/mo tier |
| ApplyPass | Yes (hosted) | GH, Glassdoor, Ashby, Workable, Workday | undisclosed | "bypasses anti-bot" (claim) | 400/wk |
| AIHawk (OSS) | Yes (local) | LinkedIn Easy Apply | **stores email + password** | none | unbounded |
| ApplyIQ (Adzuna) | Yes | own DB | minimal | undocumented | **~5/wk, 2/employer/60d** |

Two things the market does that this design deliberately does not: **store
account passwords** (AIHawk, LazyApply, Scale.jobs) and **claim anti-bot
bypass** (ApplyPass). Both are the reason those tools generate ban reports. Our
fail-closed posture is a genuine differentiator — it should be marketed as one,
not hidden as a limitation.

Three things the market has that we lack outright: **Workday-class coverage**,
**inbox/reply detection** (every tracker-first product has it), and **recruiter
outreach as a second channel** (LoopCV). Of those, inbox detection is the most
valuable per unit of work because it turns existing submissions into learning
signal, and the outcome tables already exist.

What we already do better than anyone: self-healing selectors with verbatim-
verified AI heal, outcome-driven dead-board suspension, judge-call savings
accounting, process-level kill switch, per-run auditable reports, and a review
queue that feeds verdicts back into the judge. No competitor publishes any of
that.

---

## 4. Recommended order

1. TOTP credential support + per-site expiry forecast (unblocks the most volume).
2. Employer cap + challenge detection + submission receipt (three small, high-trust fixes).
3. Inbox polling → `apply_outcomes` (turns applications into conversations).
4. Workday-family schema-driven filler (the real project; scope separately).
5. Relay-backed "finish in engine profile" for queued reviews.

Steps 1–3 are contained changes to existing seams (`site-credentials.sql`,
`apply-governance.sql`, `trySubmit`, `--outcomes`) and do not require a new
subsystem.
