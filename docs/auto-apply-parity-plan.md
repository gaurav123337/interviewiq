# Auto-apply parity plan: InterviewIQ vs. hark-style agents

Date: 2026-11-03 · Status: PROPOSAL (no code yet) · Owner: auto-apply subsystem

---

## 0. Fact-check: what hark.com actually is

Hark (by Brett Adcock) is **not** a purpose-built job auto-apply tool. It is a
general **"computer-use" agent**: for every request it spins up a dedicated
remote VM with its own browser, file system and terminal, and its model emits
raw cursor/keyboard inputs aimed at screen coordinates, observing the screen
between steps (unlike us: DOM selectors, per-site rules). Its job-search hook is
generic "Projects"; the LinkedIn example in its launch post is the *recruiting
side*, not candidate applications. Pricing is $0 / $20/mo / $100/mo with usage
caps.

Verified sources: hark.com, TechCrunch (2026-10-06 launch coverage), Quartz,
TechRepublic, and the Wavect independent review. Note their published
benchmarks run on Hark's own internal harness (vendor-reported), the reviewer
judges demonstrations as guidance rather than guarantees of repeatable success,
and prompt-injection risk grows when an agent drives logged-in accounts.

The relevant lesson is architectural, not product scope: a coordinate-driven
agent generalizes to ANY website without per-site rules — which is exactly what
our current engine cannot do — but it is probabilistic, slower, and riskier, and
its "no hallucination" reputation is perception, not a system guarantee.

## 1. Where InterviewIQ already stands

We are much closer than the perception gap suggests. Existing capability
(`scripts/auto-apply-jobs.js` + `apply-engine-lib.js` + `job-sites-db.js`):

| Capability the user expects | Our status |
|---|---|
| Applies across many boards | ✅ Builtin boards (LinkedIn, Naukri, Instahyre…) + discovered boards + **first-class ATS boards (Greenhouse/Ashby)**, collected API-first via public keyless endpoints |
| Tailored resume per JD | ✅ AI tailoring via the admin AI provider, same prompt contract as the Resume Kit; deterministic fallback when AI fails |
| Answers application questions honestly | ✅ All answers come from `apply-profile.json`; never invents facts; required-unanswered ⇒ **needs-review**, never submitted |
| Applies on company websites | ✅ Registered ATS boards (boards.greenhouse.io/*, Ashby) with iframe extraction, pinned success text, fail-closed pre-checks |
| Safety / anti-hallucination | ✅ Stronger than a general agent by design: submit gates, site rules, review gate for unknown boards; iframes and selectors are deterministic |
| Self-healing on board redesign | ✅ Learned/healed selectors + verified AI list heal + drifting counters |
| Learning from outcomes | ⚠️ Design exists (`--outcomes`, `supabase/apply-outcomes.sql`): views/responses per board per fit band feeding the AI judge |

So "no hallucination" is arguably our **strongest** property: the engine is
fail-closed — every typed value is a verified profile field or a human review.
A hark-style agent cannot make that claim; "Zero hallucinations" is a property
of *deterministic grounding*, which we already have.

## 2. Why we are lacking — the honest gap list

1. **No product surface**: the engine is a CLI on the user's PC. The web app
   cannot see runs, start them, or show a "I applied for you" experience. Hark
   is one button.
2. **No always-on compute**: runs happen only when the user starts them
   (except the OS crontab `digest-task.cmd`). Freshness is lost the moment the
   laptop is shut; boards' freshest postings go to faster responders.
3. **No cloud browser sessions**: `freebuff-apply-profile/` is local-only.
   Supabase Edge Functions (Deno) cannot run Playwright or hold logged-in
   cookie jars — logged-in board automation from datacenter IPs is also an
   account-risk policy line we already refuse to cross (LinkedIn ToS note in
   the README).
4. **Weak generalization beyond known shapes**: per-site rules + heal engines
   cover known card/frame/ATS layouts, but an arbitrary new company-site form
   (custom JS, modals, work-authorization widgets) falls to needs-review or
   manual work. This is where a coordinate/VLM agent generalizes where
   selector rules cannot.
5. **Tailoring is preview-less**: AI writes the resume but there is no
   per-JD human-editable diff / version history before submission, so users
   trust it less than a tool showing "here is your tailored resume — edit?".
6. **Coverage of majors**: no Indeed-ecosystem flows (rating flows differ),
   no Workday-ATS forms (Workday is the most common enterprise portal and is
   neither Greenhouse/Lever/Ashby-shaped), no per-site submit policy table in
   the UI.

## 3. Parity plan (phased)

Design principle kept throughout: **deterministic first, AI only where
deterministic fails, humans in the loop for anything unverifiable.** Every new
decision lives in `scripts/*-lib.js` (vitest-pinned) — never in the Playwright
driver, per repo doctrine.

### Phase 1 — Product-lift the existing engine (highest ROI, weeks 1–2)

Goal: turn the CLI into a feature of the web app without moving where runs
execute (still the user machine — privacy + ToS + logged-in sessions).

- New web UI `Job Match → Auto-apply → Control Center`:
  - start/stop/status of the local watcher; last run's report (submitted /
    needs-review / skipped / errors) rendered from the existing
    `freebuff-apply-reports/run-*.json` pushed to Supabase;
  - review queue for `needs-review` items (approve / edit / skip → feeds the
    exemplar learning that already exists);
  - live site-registry panel already exists (Job sites) — extend with
    probation + boardMatch + maxAgeDays controls (the chips exist).
- Local watcher script gains a `--supabase-push` mode: persist run summaries,
  per-application outcomes and judge exemplars as real rows instead of local
  JSON only; the web app subscribes (_realtime/announcements pattern the app
  already uses_).
- SQL (manual, idempotent): `supabase/apply-runs.sql` (runs, applications,
  review_queue tables + RLS owner-scoped by `user.sub`).

Deliverable: the "auto-apply button" experience users see in competitor tools,
100% on the existing fail-closed engine. Effort: mostly app-side UI + one
script integration + one SQL file.

### Phase 2 — Human-in-the-loop tailoring parity (weeks 3–4)

> Status (this branch): **gate + preview logic + store/UI loop landed** — pure lib
> `scripts/apply-kit-lib.js` (+`.d.ts`, pinned by `applyKitTailor.test.ts`):
> `tailorSubmitGate` (fail-closed: an AI-authored kit cannot auto-submit
> without `"autoTailor": true` in the apply profile or per-variant
> approval), `previewTailoredResume` (per-section LCS diff vs the master
> with JD-keyword justification read ONLY from added lines),
> `splitResumeSections` (UPPERCASE template + markdown headings),
> `appendResumeVariant` (content-deduped version history, capped).
> Driver wiring: `auto-apply-jobs.js` closes the gate per JOB via a
> `jobRules` copy — template kits never lose auto-submit.
> Still open in this phase: editing a variant before re-push (v1 is
> approve/reject only; edit lands with the applications table in Phase 1's
> review-queue rework), and autoTailor for per-posting overrides.

Goal: "tailored as per JD, and I can see/edit it" trust loop.

- Per-application **tailoring preview**: generated resume/render + cover
  letter with an editable diff (what changed vs the master template and why —
  keyword/JD justification per section).
- Version history per application (`apply_kit` artifacts already flow through
  `scripts/apply-kit-node.js` / `src/services/applyKit/ai.ts`): store
  `applications.resume_variant`. User approves before engine submits (new
  gate for LLM-authored content: approval required unless `autoTailor: true`
  in the apply profile).
- Pure logic (variant selection, diff generation) in `scripts/apply-kit-lib.js`
  + `.d.ts`, pinned by vitest.

### Phase 3 — Generalize to unknown forms: VLM fallback driver (weeks 5–8)

Goal: reduce needs-review rates on new/unknown company sites, the actual gap
vs. a coordinate agent, without losing determinism.

Strategy — **layered, not replaced**:
1. Existing per-site rules + ATS APIs stay primary (fast, cheap, auditable).
2. NEW **VLM form-filler driver** activated only when the deterministic
   driver says "cannot parse": screenshot → vision-model extracts every
   field label → maps each to an `apply-profile.json` key (exact text match
   from the profile, NEVER synthesized values) → types values one by one with
   screenshot verification after each.
3. Unchanged invariants: any field the profile cannot confidently answer keeps
   needs-review semantics; submission honors existing `AUTO_SUBMIT_NEVER_HOSTS`
   and unknown-board review gates. VLM *fills*, the **existing gates decide
   submit** — we never hand a probabilistic model the submit button.
4. Cost guard: VLM attempts limited per run/day; model output logged inline in
   the run report for audits.

Verification: golden screenshots in `src/__tests__/` for the field-extract →
profile-map decision function (pure lib, no browser needed).

### Phase 4 — Cloud execution, scoped to compliant channels (weeks 9–12)

> Status (this branch): **Workday feed landed in the verified-pipeline set** —
> the jobs-fetch edge function (the existing compliant cloud collector for
> greenhouse/ashby/lever/rss, with its registry/probation handshake and
> per-source reports) now supports provider `workday`: board value
> `tenant/site` (or `tenant.wdN/site`), ref-parsed CXS POST endpoint, host
> allowlist `*.myworkdayjobs.com`, slim honest descriptions (the list payload
> carries no full JD), prose `postedOn` → estimated `posted_at` (older, never
> fresher), posted rows land in `jobs` with `onConflict source,external_id`.
> Pure logic in `_shared/workdayFeed.ts` (pinned: `workdayFeed.test.ts`, 6
> tests; full `_shared` suite 85 passing). First default source is the
> verified-live `mastercard/CorporateCareers` board (200). Registration into
> `job_sites` stays greenhouse/ashby-only — a Workday registry row needs the
> exact wdN host the ref genuinely carries, so the LOCAL engine's
> `atsApiCollectPlan` remains the Workday apply path (already shipped in
> Phase 5).

Goal: always-on freshness without the user's PC; respect the anti-bot line.

- **Cloud-safe set**: Greenhouse/Lever/Ashby public API collectors + Workday
  public job feeds. These never open logged-in pages; nothing here trips ToS.
  Run them on a scheduler in a small worker/VM (or Supabase cron invoking a
  Deno function that reuses `apply-engine-lib` collectors via pure JS) 4×/day
  per board; results stream to `job_sites`/`jobs` tables behind the same
  probation rules. The app then shows fresh postings the moment the user is
  online.
- **Cloud browser (optional, later)**: a rented stealth-browser cloud
  (Browserbase / Steel.dev / Hyperbrowser class) with user-supplied session
  consent, only for API-less boards the user explicitly opts into, only
  auto-submit boards as defined by the site rule. Evaluate build-vs-buy
  separately — this adds cost, ban risk and a prompt-injection surface, and it
  should be gated behind explicit consent and a kill switch.
- **Never cloud-run**: LinkedIn/Naukri/Instahyre logged-in scraping from
  datacenter IPs (existing README policy), captcha solving, credential
  storage.

### Phase 5 — Workday & the majors (ongoing)

> Status (this branch): **Workday pack first slice landed** — `SITE_RULES.workday`
> (review-gated, fail-closed until rehearsed on a live tenant) + `ATS_PACKS.workday`
> (data-automation-id field hints; zero-field extraction hands off to the Tier-4
> VLM fallback), `atsApiCollectPlan` derives the CXS POST endpoint from a
> `tenant.wdN.myworkdayjobs.com/<locale>/<site>` careers URL (original casing
> preserved, null without a site segment), `parseWorkdayJobs` reuses each
> posting's own `externalPath` for detail URLs and prose `postedOn` → age
> stamps, `classifyJobLink` reads `/job/<slug>_<id>` as a posting while the
> `/job/` discriminator keeps section routes out. Pinned by
> `src/__tests__/workdayPack.test.ts`. Feed wired automatically: collectors
> already consume `atsApiCollectPlan` plans. Still open in this phase: Indeed
> flows and company-careers tokens.

Workday (TalentDox-ecosystem `myworkdayjobs.com`), Indeed, and company-careers
categories each become site-rule packs: parser + frame shapes + success text
+ submit policy, following the same playbook Greenhouse got (pin first-class
support, others review-gated). Owner `rules.*` keys reuse today's registry.

### Phase 6 — Outcome-learning flywheel (continuous)

Implement `supabase/apply-outcomes.sql` + `--outcomes` (already designed):
72-hour view tracking per board and per fit band feeding judge priors; VLM
driver attempts get the same treatment (success rate per driver decides when
it is offered).

## 4. Explicit non-goals (invariants, unchanged)

- No invented answers anywhere — a required field we cannot answer honestly
  stays a skipped, honestly-logged needs-review.
- No CI or datacenter-IP logged-in board automation; no stored/typed
  credentials; no captcha bypass.
- AI never presses Submit; site rules and gates do.

## 5. Estimate & sequencing summary

| Phase | Value | Effort | Risk |
|---|---|---|---|
| 1 Control Center | Big (product experience) | 1–2 wks | low |
| 2 Tailoring preview | Medium-high (trust) | 2 wks | low |
| 3 VLM fallback driver | High (reach) | 3–4 wks | medium — keep gates paramount |
| 4 Cloud collectors | High (freshness) | 3–4 wks | low (compliant set only) |
| 4b Cloud browser opt-in | Medium-high (reach) | 2–3 wks + vendor decision | high |
| 5 Workday/majors | High (coverage) | rolling per pack | medium |
| 6 Outcomes flywheel | Compounding | 1–2 wks + SQL | low |
