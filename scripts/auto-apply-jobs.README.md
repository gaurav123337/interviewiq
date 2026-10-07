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
