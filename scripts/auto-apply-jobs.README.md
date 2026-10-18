# Auto-Apply Engine (local Playwright)

Searches a jobs-list URL (LinkedIn, Naukri recommended, Instahyre, or any board),
generates a **JD-tailored resume + cover letter** per posting (your admin-configured
AI provider — the same one the app uses), fills the application form with **honest
answers from your profile**, and submits — with per-site rules:

| Site | Submit behavior |
|---|---|
| Instahyre, Naukri | **Auto-submit** (your choice) |
| Greenhouse, Ashby boards | **Auto-submit** (first-class ATS boards — pinned success text + fail-closed required-field pre-check) |
| LinkedIn | **Review gate** — form filled, you eyeball + click Submit |
| Unknown boards | Review gate (never auto-submit an unknown ATS) |

**First-class ATS boards:** the `jobs-fetch` pipeline registers every live
Greenhouse/Ashby board it fetches (lyft, airbnb, linear, notion…) as a
`job_sites` row (`source: ats`, path-qualified host like
`boards.greenhouse.io/lyft`). The engine then applies directly on the
employer's own ATS — the best possible channel. Embedded forms (Greenhouse
renders its application form inside an iframe) are extracted and submitted
in the right frame.

**API-first collection (greenhouse/lever):** Greenhouse and Lever publish
the same postings over PUBLIC, keyless JSON endpoints
(`boards-api.greenhouse.io/v1/boards/<board>/jobs`,
`api.lever.co/v0/postings/<board>?mode=json`). When the API answers, the
collector never opens the listing page at all — no anti-bot wall to trip,
a REAL posted timestamp instead of a parsed card stamp, and the company
name from the board itself. Rows enter the same harness (freshness-first
order, per-board max age, `--max` slice) via stamps derived from the API
timestamps; only an API failure or empty payload falls back to the DOM
scrape (`⚠ … falling back to the page scrape` in the run log). Parsers:
`atsApiCollectPlan` / `parseGreenhouseJobs` / `parseLeverPostings` /
`ageStampFromTimestamp` in [apply-engine-lib.js](apply-engine-lib.js).
Both providers return `updated_at`/`createdAt`-level timestamps, which is
also why API-collected freshness ordering is exact rather than a parse of
"3 hours ago" prose.

**Platform-policy note (LinkedIn):** LinkedIn's User Agreement prohibits
using bots or unauthorized automation on their service and documents
enforcement via account restriction — that is why the LinkedIn entry is a
REVIEW GATE (`autoSubmit: false`, `AUTO_SUBMIT_NEVER_HOSTS` blocks any
probation-trust auto-submit for it) and why its runs stay on your own
machine/IP with a real persistent profile, never CI. Other boards that
publish public posting APIs (Greenhouse/Lever) are the compliant channel
for scale: the employer is literally offering the data.

**Probation auto-activation:** pending sites no longer wait forever for a
manual approval. At every `--all` cycle the engine runs the probation sweep
(`engine_activate_probation_sites`): a pending site with a jobs_url that has
waited **7 days** activates automatically — oldest first, **max 3 per
sweep**, each activation DM'd to you. Approve early or Reject in the UI
(Job Match → Auto-apply → Job sites) any time; `rules.probation.skip: true`
opts a site out.

**Freshness beats fit at the margin:** the collector parses each job card's
posted-age stamp ("3 hours ago", "30+ Days Ago", "Just posted") and orders
**<24h postings first** (freshest of the fresh first) before the `--max`
budget slices — a full budget spends its slots on postings recruiters are
still reading.

**Board match signals as a free pre-filter:** each board's OWN match signal
skips the gate stack (LOW-only, fail-open — missing signal never rejects):
Instahyre's High/Med/Low card badge, LinkedIn's "your profile matches N%"/
"Top Applicant" DETAIL-page signal (their match lives on the job page, not
the cards), and Naukri's explicit match badge (deliberately narrow — its
cards carry "20-30% hike"-style promo percent that must never read as a
match). Parsers: `instaMatchFromCardText` / `linkedinMatchFromDetailText` /
`naukriMatchFromCardText` → `boardMatchSkip`.

**Owner control (no code change):** the site's registry row carries
`rules.boardMatch` — set **true** (🎯 match: on in the Job-sites panel) to
opt ANY board into the pre-filter (its cards get the generic Instahyre-style
badge reader), **false** (🎯 match: off) to turn the skip off even for a
builtin site, or clear it (🎯 match: default) to restore builtin behavior.
Applied live: the engine reads the row's rules every run — no restart, no
re-deploy. Writes go through `admin_set_site_rules` (whitelisted keys only,
SQL applied manually per the repo convention).

**Per-board max job age:** registry `rules.maxAgeDays` (⏱ chip next to the
🎯 chip — cycle any → 7d → 14d → 30d → any). Postings older than the cap
are dropped at COLLECT time, before they consume the `--max` budget or an
AI judge call (`maxAgeDaysOf` + `olderThanMaxAge` in the lib, strict on a
known age, ≥ cap). Unlike the feed's age filter, postings with an
UNKNOWN age are always collected — a missing stamp must never reject.
Restore "any age" by clearing the chip (NULL removes the key).

**Board self-healing (no human edits):** when a board redesigns its list,
the collector recovers by itself, in order: (1) learned + healed selectors
read back from the site's registry rules lead the collect pass; (2) a
widening retry adds the generic superset hints; (3) ONE AI list heal —
the model names a representative posting anchor, the name is verified
verbatim against a live re-scan, and the matching links must still pass
the normal posting-vs-nav adjudicator before they count; (4) success
persists the derived href pattern so later runs lead with it. Only if
every path fails does the drift counter advance, and the digest line then
honestly means "self-heal ran and could not recover" — not "you fix it".
(Select-write path: `engine_set_job_site_rules` — no SQL change needed.)

**Fail-closed:** any *required* question the engine can't answer confidently
(work authorization, certificates, unseen essays…) leaves the form open and
marks the job **needs-review** in the report. A wrong submission is worse than
a skipped one.

## Login (one-time per site)

The engine runs a **headed Chromium with a persistent profile**
(`freebuff-apply-profile/`, gitignored). The first time a site isn't logged in,
the window pauses on the login page — sign in manually with **whatever the site
offers** (Google OAuth, email+OTP, captcha — all fine, because *you* do it).
The session persists for weeks; no passwords are stored or typed by the script.

```bash
# one-time per site (opens the window; log in; done)
node scripts/auto-apply-jobs.js --url "https://www.linkedin.com/jobs/" --login-only

# apply run (auto-logs-in if the session is still valid)
node scripts/auto-apply-jobs.js \
  --url "https://www.instahyre.com/candidate/opportunities/?matching=true" \
  --max 10

# rehearsal: fill everything, submit nothing
node scripts/auto-apply-jobs.js --url "..." --max 5 --dry-run
```

## Your profile

Copy `content/apply-profile.example.json` → `./apply-profile.json` and fill it
in. Every answer the engine types comes from this file — it never invents facts
(years, notice period, salary, locations, links…). Fields left empty are left
blank; required-and-empty ⇒ needs-review.

## AI tailoring

The engine reads the **admin-configured AI provider** (Admin → Secrets → AI
pipeline, via `scripts/ai-config.js`) and rewrites the template resume +
cover letter per JD — same prompts and fallback contract as the app's
Resume Kit (`src/services/applyKit/ai.ts`): any AI failure falls back to the
deterministic template, never blocks a run.

## Reports

Every run writes `freebuff-apply-reports/run-<timestamp>.json` + `.md`
(submitted / needs-review / skipped / errors, with per-job detail). A run with
zero submits and zero reviews prints a **SUSPICIOUS RUN** banner (selector or
login drift — same spirit as the scraper's alarm).

**Judge-call savings:** whenever the board-match pre-filter (🎯 / owner-set
`rules.boardMatch`) skips a LOW posting, the run stamps one saved AI judge
call per board (`judgeSaves` in the report). `reportLine` shows the per-run
amount after its DONE line, and the daily summary (--status / the watcher)
adds a `🛡 N AI judge calls saved — <board> n · <board> n` line totalling
today's runs — the pre-filter's token payoff, measured per board, per day.

## Learning from employers (--outcomes)

The engine already learns from **you** (review verdicts → judge exemplars).
It also learns from **employers**: `--outcomes` reads each board's own
application tracker (LinkedIn "My Jobs → Applied", Naukri "My applications",
Work at a Startup; ATS boards have no candidate tracker and are skipped
honestly) and records, per application, whether it was **VIEWED** and/or got
a **RESPONSE** (reply / interview / rejected / offer). The weekly digest then
reports views + responses **per board and per fit band**, and the 90-day
response rates per band are fed into the AI judge as a prior — fit bands
that never convert stop spending your applications. The digest task runs the
scrape before the digest (`scripts/digest-task.cmd`), so Monday's report
always carries the employer-behavior section. New SQL needed:
`supabase/apply-outcomes.sql`.

## Requirements

- `npm i -D playwright` then `npx playwright install chromium` (local only — CI never runs this)
- `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` env vars only when you want AI tailoring
- Works best on your own machine/IP; keep `--max` modest (boards rate-limit)

## Not included (deliberately)

- No stored credentials, no credential typing, no captcha solving
- No CI execution — logged-in job-board automation from datacenter IPs burns accounts
