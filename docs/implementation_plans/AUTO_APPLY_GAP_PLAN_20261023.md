# Auto-Apply: gap-closure plan (2026-10-23)

This plan covers the three highest-impact gaps from the gap analysis. Each entry lists:
- **What** changes are needed
- **Where** (file path, function/API)
- **How** minimal the change can be
- **Acceptance criteria** (what "done" looks like)
- **Risk** — why it's safe or what could go wrong

Items 1–3 are all contained on existing seams. No new subsystems are created.

---

## Item 1 — TOTP credential support (unblocks every OAuth+2FA account)

### Why
`ensureLoggedIn` can only re-auth with stored `password`-kind credentials. OAuth-bound accounts (LinkedIn default, Instahyre default, Naukri) expire and the site is silently skipped for the whole cycle. Adding TOTP lets the engine generate the 6-digit code locally, no human needed, deterministic 30s window.

### Files
| File | Change |
|---|---|
| `supabase/site-credentials.sql` | Add `kind` values: `'totp'`. Optional `totp_seed` column (base32, nullable) — stored encrypted at rest. Keep `username`/`secret_prefix` as-is; `secret` holds the base32 seed. |
| `scripts/apply-engine-lib.js` | Add `totp(codeWindowSeconds?)` function. Use `speakeasy` if already a dependency, otherwise a minimal RFC-6238 impl (30s step, ±1 window):<br>`Math.floor((Date.now() / 1000) / step) % 10**6`<br>Exported as `totp(seed, step)` → string zero-padded to 6 digits. |
| `scripts/auto-apply-jobs.js` | In `ensureLoggedIn`, before the stored-credential password path, check `cred?.kind === "totp"` and inject the generated code into the password field the same way the password path does. If `totp` generation fails, fall through to the human flow (no regression). |

### Acceptance criteria
- Running `node scripts/auto-apply-jobs.js --url "https://www.instahyre.com/candidate/opportunities/?matching=true" --max 3` on a site whose credential is `kind: "totp"` logs `✓ auto-login with the stored credential succeeded` and the site is collected/submitted in that run.
- The same run on a site whose credential is `kind: "password"` continues to work exactly as before.
- The same run on a site with no credential (OAuth flow) still logs the human-flow fallback — unchanged.

### Risk
- TOTP window is ±1 step (window of 1 min). If the user opens the app ±30s after the cycle starts, the code may already have rotated. Mitigation: the engine waits for a stable logged-in state (≥3s), so a single rotation is absorbed. A full minute misalignment would need the user to re-trigger, which is the same contract as any manual login.
- No external API calls; purely local HMAC-SHA1. No new surface area.

---

## Item 2 — Per-site session expiry forecast (prevents silent drop-out)

### Why
The digest reports engine uptime but never says "3 of 6 boards were logged out all week." If the engine could record when a session was last verified + each site's cookie `expires`, the owner would see a forecast like "Instahyre expires in 2d — re-login soon" instead of discovering the skip after the cycle finishes.

### Files
| File | Change |
|---|---|
| `supabase/site-credentials.sql` | Add `last_verified_at timestamptz` column (nullable, defaults to null). Updated by `persistSessionCookies` every time the engine confirms a live session. |
| `scripts/apply-engine-lib.js` | In `ensureLoggedIn`, after the session-cookie validation block that currently logs `✓ ${rules.label}: session active`, also record `UPDATE public.site_credentials SET last_verified_at = now() WHERE label = $1 AND bound_sites @> $2` (or the equivalent Supabase RPC). If the credential has no `last_verified_at`, the first run after deployment silently back-fills on the first successful verify. |
| `scripts/auto-apply-jobs.js` | Add a line to the weekly digest (the `engine uptime (7d)` section, already present at line ~3164) that emits per-site expiry: `Instahyre: expires in 2d (last verified 2026-10-20)`. This reuses the existing `uptimeLine` template and only adds a line when `last_verified_at` is set and `expires - now > 0`. |
| `scripts/job-sites-db.js` | If the RPC `credentialForSite` already returns cookie metadata, add `last_verified_at` to its output. If not, add a lightweight `SELECT last_verified_at FROM public.site_credentials WHERE label = $1` helper. |

### Acceptance criteria
- After the first TOTP or password auto-login, the `site_credentials` row for that host has a non-null `last_verified_at`.
- The weekly digest (run `--digest` or the watcher cycle) lists per-site expiry, e.g. `Instahyre: expires in 2d`.
- If a credential has no `last_verified_at`, the expiry line is omitted (no error, no stale date).

### Risk
- `last_verified_at` is purely best-effort record-keeping. No submit logic depends on it. If the column migration fails on an old DB, the column defaults to NULL and the expiry line simply never appears — safe fallback.

---

## Item 3 — Per-employer application cap (prevents recruiter blacklisting)

### Why
Dedupe is per job URL only. Nothing prevents six applications to one employer in a week. ApplyIQ ships 2/employer/60d as a headline feature. A cap reduces blacklist risk and is a trust signal to the owner.

### Files
| File | Change |
|---|---|
| `supabase/apply-governance.sql` | Add columns `policy_daily_cap_per_employer int DEFAULT NULL, policy_weekly_cap_per_employer int DEFAULT NULL` to the governance row (id = 'global'). Add an `upsert` migration: `add column if not exists ...` / `set policy_daily_cap_per_employer = 2 where id = 'global' and policy_daily_cap_per_employer is null;`. |
| `scripts/apply-engine-lib.js` | Extend `budgetGate` (already accepts `probe.available`, `dailyCap`, `weeklyCap`) to also read the per-employer caps when `probe.available` is true and the caps are set. If set, the verdict is `"ok"` only when both the user caps AND the per-employer caps pass. |
| `scripts/auto-apply-jobs.js` | In `runSingle`, after `readGovernance()` and before the submit gate, include the per-employer cap check. If capped, record `needsReview` with reason `employer_cap: <reason>` and queue the review (same path as the budget cap), rather than failing the submit. |
| `scripts/job-sites-db.js` | Add optional RPC `apply_set_employer_caps(site_host text, daily int, weekly int)` if the owner wants to override per-board from the UI. For now, leave as SQL-set-only. |

### Acceptance criteria
- Setting `policy_daily_cap_per_employer = 2` and `policy_weekly_cap_per_employer = 6` in governance, then running a cycle that would submit 3 apps to the same employer in a day: the 3rd app is queued with reason `employer_cap: daily limit reached` and the report's "needs you" row has that reason.
- If the caps are NULL (not set), the per-employer check is a no-op and the existing user-level daily/weekly caps still apply exactly as before.
- The report line still shows submitted/needs_review/skipped/error counts, and the weekly digest is unaffected (it already aggregates per-board, not per-employer).

### Risk
- Per-employer cap is an *additional* gate, not a replacement. If the caps are not set (NULL), behavior is identical to today. The check runs after the user-level budget gate, so a user who exceeds their 20/daily cap still gets blocked before the employer check is even evaluated.

---

## Item 4 — Challenge detection on submit (detect CAPTCHA before it blocks)

### Why
Today a reCAPTCHA / Turnstile / hCaptcha on the apply form surfaces as either a successful submit (false positive) or a generic error. The owner never knows a challenge appeared. Detecting it pre-submit and queuing it as `needsReview` with a deep link to the posting lets the owner finish in relay mode without losing the filled form.

### Files
| File | Change |
|---|---|
| `scripts/apply-engine-lib.js` | Add `detectChallenge(page)` → returns `"recaptcha"` / `"turnstile"` / `"hcaptcha"` / `null`. Uses `page.$$( 'iframe[src*="recaptcha"]', 'iframe[src*="turnstile"]', 'iframe[src*="hcaptcha"]' )` and checks the first matching element's `src` / `class`. If no iframe found, also check `document.body.innerText` for `challenge` / `verify` / `confirm` keywords as fallback. |
| `scripts/auto-apply-jobs.js` | In the submit path, after `fillApplicationForm` succeeds and before `trySubmit`, insert: `const challenge = detectChallenge(page)`. If truthy, record `needsReview` with reason `challenge: <kind>`, take a screenshot, queue the review (same path as unfilled required), close the tab, continue. **Do not** attempt to solve the challenge. |
| `scripts/auto-apply-jobs.js` | In the review-queue UI (ReviewQueuePanel.tsx), when the reason starts with `challenge:`, render a big orange banner "⚠️ CAPTCHA / verification challenge detected — open the form to complete it" plus the "Open form ↗" button. The "Done" button simply resolves the review as done (the engine already records the fact that the human finished it). |

### Acceptance criteria
- When a posting loads a reCAPTCHA, the engine logs `⚠️ challenge: reCAPTCHA detected — form left open for manual finish` and the job lands in the review queue with that reason.
- When a posting has no challenge, the engine submits exactly as before (no regression).
- The review queue shows the CAPTCHA banner and the "Open form ↗" button navigates to the posting in a new tab (relay mode keeps the form filled).

### Risk
- The detection only covers the three major CAPTCHA types via iframe src matching; other vendors' markup falls through to the existing fallthrough path (no regression).
- The engine does **not** solve the challenge — it merely surfaces it. The owner still has to complete it, which is the correct fail-closed posture.

---

## Item 5 — "Submitted" receipt (regex → confirmed receipt)

### Why
`detectSubmissionSuccess` matches page text. Employers sometimes show "application submitted" in a header that disappears on navigation, and the market's #1 complaint is "it says applied, nothing arrived." A second positive signal (URL change, application id, "you have already applied" re-check) eliminates false positives.

### Files
| File | Change |
|---|---|
| `scripts/apply-engine-lib.js` | Add `verifySubmission(page, site)` → returns `{ auto: true/false, note }`. The function: (a) checks `detectSubmissionSuccess` as today; (b) **also** checks the current URL path for `/application/thanks`, `/apply/complete`, or a query `?submissionId=`; (c) if the posting is on an ATS with API submission (greenhouse/lever), performs a GET to the board's "my applications" endpoint using the stored API key to confirm the candidate appears — if the API confirms, that's a third independent signal. Returns `auto: true` only when **at least two** of the three signals agree. |
| `scripts/auto-apply-jobs.js` | In `trySubmit`, replace the single `detectSubmissionSuccess` check with `verifySubmission(page, site)`. If `auto: false`, record `needsReview` with reason `submission_unverified — ${note}` instead of `submitted`. |
| `scripts/job-sites-db.js` | Optional: add RPC `apply_mark_submitted(job_url, submission_id)` if the owner wants a permanent receipt stored per application. Not required for the minimal change. |

### Acceptance criteria
- On a posting where the employer shows "application submitted" banner and the URL changes to `/application/thanks`: the engine records `submitted` with note `verified by thank-you page`.
- On a posting where the text matches but the URL stays on the form: the engine records `needsReview` with note `text-match only — no thank-you page; finish manually`.
- No change in submit behavior for boards where the URL never changes (most) — the second signal is simply absent, so the engine falls through to the existing path.

### Risk
- The ATS API confirmation (greenhouse/lever) requires the board's API key, which is already stored per-credential. If the key is missing, the function skips the API signal and relies on the two local signals only — safe fallback.

---

## Summary: what's in vs. out of this plan

| In | Why |
|---|---|
| TOTP credential support | Unblocks the single biggest throughput stop; deterministic, local, no new surface |
| Per-site expiry forecast | Turns silent skips into actionable signals; reuses existing digest infrastructure |
| Per-employer cap | Reduces blacklist risk; ApplyIQ already ships this; cheap governance addition |
| Challenge detection | Stops false-positive "submitted" claims; owner finishes in relay mode |
| Submission receipt | Eliminates the #1 market complaint about auto-apply tools |

| Out of scope (deferred) |
|---|
| Workday-family schema-driven filler | Too large; each employer configures its own form. Scope as a separate project. |
| Inbox/email polling (Gmail/IMAP) | Requires OAuth keys, IMAP credentials, per-user onboarding. Not a contained seam. |
| Relay "finish in engine profile" for queued reviews | Requires CDP state sync between the relay browser and the engine profile. Can be a follow-up after items 1–3 are verified. |

---

## Next steps (owner-ready)

1. **Apply Items 1–3** in the order listed. Each is a < 200-line change to existing files, no new subsystems.
2. **Run the typecheck** (`npm run typecheck`) and the **apply engine test suite** (`npm test -- --run jobSites*` or the equivalent vitest filter) after each item to confirm no regression.
3. **Push to `main`** — CI will run the full gate (typecheck + build + vitest + deno + eval:rag). If all pass, the deploy to gh-pages updates automatically.
4. **Optional: Item 4** (challenge detection) and **Item 5** (receipt verification) can be cherry-picked after the first three are green, since they depend on the governance/sql changes already landed.

This plan covers the three gaps that block full automation on the widest number of boards, with the smallest possible code changes. The remaining gaps (Workday, inbox polling, relay finish) are documented for a later sprint.