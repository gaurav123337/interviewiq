# Auto-Apply Engine (local Playwright)

Searches a jobs-list URL (LinkedIn, Naukri recommended, Instahyre, or any board),
generates a **JD-tailored resume + cover letter** per posting (your admin-configured
AI provider — the same one the app uses), fills the application form with **honest
answers from your profile**, and submits — with per-site rules:

| Site | Submit behavior |
|---|---|
| Instahyre, Naukri | **Auto-submit** (your choice) |
| LinkedIn | **Review gate** — form filled, you eyeball + click Submit |
| Unknown boards | Review gate (never auto-submit an unknown ATS) |

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
node scripts/auto-apply-jobs.mjs --url "https://www.linkedin.com/jobs/" --login-only

# apply run (auto-logs-in if the session is still valid)
node scripts/auto-apply-jobs.mjs \
  --url "https://www.instahyre.com/candidate/opportunities/?matching=true" \
  --max 10

# rehearsal: fill everything, submit nothing
node scripts/auto-apply-jobs.mjs --url "..." --max 5 --dry-run
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

## Requirements

- `npm i -D playwright` then `npx playwright install chromium` (local only — CI never runs this)
- `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` env vars only when you want AI tailoring
- Works best on your own machine/IP; keep `--max` modest (boards rate-limit)

## Not included (deliberately)

- No stored credentials, no credential typing, no captcha solving
- No CI execution — logged-in job-board automation from datacenter IPs burns accounts
