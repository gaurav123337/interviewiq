# InterviewIQ — Phase 2: Job platform integrations (Naukri · LinkedIn · others)

> Prepared after the apply-kit milestone. Goal: let users **see and act on jobs from the
> platforms they already use** (Naukri, LinkedIn, Indeed, etc.) — without breaking their
> accounts, breaching the platforms' terms, or exposing the product to legal risk.

---

## 0. Executive summary

- **Read side is safe**: pulling *public* job listings through legitimate interfaces
  (official APIs, RSS feeds, the ATS boards we already consume) is fine.
- **Auto-apply is NOT safe**: automating form submission on LinkedIn/Naukri violates their
  terms, risks the user's account (suspension), and crosses into "unauthorized access"
  territory under the US CFAA and India's IT Act 2000. We will **never** script submissions
  into another platform's login-gated flow.
- **The safe "apply" is a hand-off**: the app pre-matches the job, generates the tailored
  resume/cover letter, then **opens the platform's own application page** in the user's own
  browser session. The user reviews and clicks submit themselves. This is how compliant
  tools (LoopCV, Simplify's "Open in LinkedIn" pattern) stay out of trouble.
- **The integration is therefore three lanes**: (A) official/public sources for the feed,
  (B) user-directed import of a posting URL the user brings us, and (C) apply-by-deep-link
  with generated docs ready to attach.

---

## 1. Legal confirmation — what we can and cannot do

### The hard constraints (current, sourced)

| Platform | Suggest jobs (read) | Apply automatically | Basis |
|---|---|---|---|
| **LinkedIn** | Public job postings only, via user-provided URLs or official APIs — **no login-gated scraping** | ❌ Never. ToS bans bots/automation; "Easy Apply" automation gets accounts suspended | LinkedIn User Agreement (Nov 2025) & Help: *"Use bots or other unauthorized automated methods to access the Services…"*; LinkedIn has **no public job-seeker Jobs API** (the Jobs APIs are recruiter/ATS-vendor side) |
| **Naukri** | Public posting pages only, fetched at the user's direction | ❌ Never. Terms prohibit scraping/automation; India's **IT Act 2000 §43/66** penalizes unauthorized access to or extraction from a computer resource; **DPDP Act 2023** governs personal data handling | Naukri Terms; Ikigai Law / general India authority on scraping |
| **Indeed** | No public API. Public posting pages only (user-directed), or RSS where available | ❌ Never (same ToS pattern) | Indeed ToS |
| **ATS boards (Greenhouse/Ashby)** | ✅ Already live in the app via their public APIs | N/A — these ARE the official channels | Official APIs |
| **Adzuna** | ✅ Official public API (salary/Jobsworth already used) | ❌ Not supported by the API | Official API |

### The legal principles we commit to

1. **No login-gated access.** We never log into Naukri/LinkedIn on the user's behalf and
   never use their session to pull or push data. Fetching a *public* posting URL the user
   pasted, in the app's own context, is "user-directed access to public data" — the
   low-risk pattern (the CFAA concern in `hiQ v. LinkedIn` was settled/closed around
   login-gated scraping; public, non-circumventing fetches are defensible — but we still
   respect robots.txt and rate limits below).
2. **No automation of submissions.** All apply actions end in a **deep link** to the
   platform's official application page opened in the user's own browser. We never fill,
   submit, or click through forms on another platform. (Browsers' "password autofill" is
   the user's own choice; we ship nothing that scripts it.)
3. **No credential storage.** We never ask for or store platform passwords. Where a
   platform has an official OAuth, we use read-only scopes; if a platform has no official
   API (Naukri, Indeed), we have no connection at all — only user-pasted public URLs.
4. **Public data only, minimized.** We only ingest what a job *posting* shows (title,
   company, location, description, apply URL) — never profile/network/contact data.
   Personal data stays on-device by default; cloud sync only under the existing
   account/consent flow.
5. **Disclosure + consent.** First use of each lane shows a one-time explainer
   ("We open the platform's own page — you complete the application there. We never apply
   for you.") and links to each platform's terms.
6. **Polite fetching.** Respect robots.txt, cap fetch rate (e.g. ≤1 req/sec per domain),
   no retry storms, cache aggressively, and honor 403/429 by backing off.

### What this means for the product promise

- **"Suggest jobs from those platforms"** → yes: a user can add Naukri/LinkedIn/other
  postings to the match feed by pasting the job URL (or via official API/RSS sources we
  add). Those jobs get the full treatment: match %, verdict, tailored resume/letter, tracker.
- **"Apply to them"** → yes, as a **guided hand-off**: one click opens the official
  application in a new tab with the generated resume/letter ready to attach, and the app
  tracks the application locally. This is the honest, durable capability — and it never
  puts the user's account at risk.

---

## 2. Chosen architecture — three safe lanes

```
                        ┌────────────────────────────────────────────┐
   Lane A  Official      │  Adzuna API · Greenhouse · Ashby · RSS     │  → existing feed
   sources (read)        │  (all public, official)                    │
                        └────────────────────────────────────────────┘
                        ┌────────────────────────────────────────────┐
   Lane B  User import   │  Paste job URL (Naukri / LinkedIn /        │  → "imported" source tag
   (read)                │  Indeed / any) → public fetch + parse      │
                        └────────────────────────────────────────────┘
                        ┌────────────────────────────────────────────┐
   Lane C  Apply         │  "Apply on platform ↗" → opens official    │  → tracker status +
   (hand-off)            │  apply page in user's browser; docs ready  │    follow-up reminder
                        └────────────────────────────────────────────┘
```

- Every imported job flows through the **existing pipeline**: `JobPosting` type → matcher →
  match feed → resume kit → tracker. No new data model for the core loop.
- Platform identity lives in a new field on `JobPosting`: `source` already exists
  (`"greenhouse" | "ashby"`) — extend to `"imported:naukri"`, `"imported:linkedin"`,
  `"imported:other"`, plus future official sources.
- All three lanes are **client-first** (offline PWA pattern already in the app):
  Lane B fetch happens from the browser with CORS via a small Supabase Edge Function
  (the codebase already runs Edge Functions for digest/broadcast), so `robots.txt` and
  rate-limit rules live in one auditable place.

---

## 3. Product UX (what the user sees)

### 3.1 "➕ Add a job from a platform" (Lane B)
- Button next to "Refresh feed": **➕ Add job from a link**.
- Modal: paste any job URL (Naukri, LinkedIn, Indeed, company career page…) → preview
  (title, company, location, snippet, source logo) → **Add to feed**.
- Imported postings get a source chip (e.g. `naukri` / `linkedin`) and join sorting,
  filters, shortlist, kits, and the tracker like native jobs.

### 3.2 "🔗 Apply on Naukri / LinkedIn" (Lane C)
- On each job card and in the Resume & letter modal: **🔗 Apply on {platform} ↗**.
- Clicking opens the official application URL in a new tab and sets the tracker status to
  **📤 Applied (pending review)** with a follow-up reminder — the user completes the
  actual submission in their own session.
- First time: one-time explainer toast (principle 5).

### 3.3 Where official sources exist (Lane A)
- Settings/Admin "Sources" list extends: toggle Adzuna live job search (official API key),
  add RSS boards (Remotive, We Work Remotely, Y Combinator, company blogs). Each is a
  read-only ingest into the same feed.

---

## 4. Implementation milestones

### M1 — Foundation: import pipeline (Lane B core)
- **types.ts**: extend `JobPosting["source"]` union with `"imported:naukri"`,
  `"imported:linkedin"`, `"imported:indeed"`, `"imported:other"`.
- **services/importJob.ts** (new): `parsePlatformUrl(url)` → platform + id;
  `fetchJobFromUrl(url, signal)` → public fetch + normalize to `JobPosting`
  (title/company/location/description/applyUrl), with per-domain rate limiter and
  robots.txt check (cached).
- **supabase/functions/import-job/index.ts** (new Edge Function, mirrors existing
  `jobs-fetch`): server-side fetch to dodge CORS, validate robots.txt, return normalized
  posting. Admin-configurable allow/deny host list.
- **services/jobs.ts**: `addImportedJob(posting)` — persist to the local feed +
  dedupe by `applyUrl`; cloud row type gains the new source values.
- **UI**: "➕ Add job from a link" modal in `Jobs.tsx` (paste → preview → add).
- **Tests**: `importJob.test.ts` — URL parsing per platform, dedupe, robots-blocked
  fallback (graceful "this site doesn't allow fetching — open it manually").

### M2 — Apply hand-off (Lane C)
- **services/applyTrack.ts**: `markExternalApplied(jobId, platform)` — sets
  `applied` status + `appliedVia` + follow-up date; reuse existing tracker plumbing.
- **UI**: "🔗 Apply on {platform} ↗" button on feed cards + Resume & letter modal →
  `window.open(applyUrl)` + status set + first-use explainer.
- **Tests**: tracker status transitions, explainer shown once (storage flag
  `iq.externalApplyHint`).

### M3 — Official sources (Lane A)
- **Adzuna search**: Edge Function `jobs-search-adzuna` (official API, key from Admin
  config) → merge into feed; reuse existing salary/Jobsworth paths.
- **RSS ingest**: generic `parseRssFeed(url)` → `JobPosting[]`; configurable source list
  in Admin (same pattern as the existing jobs-source config in `Admin.tsx`).
- **Tests**: RSS parsing fixtures, Adzuna mapping, dedupe across sources.

### M4 — Compliance & trust layer
- robots.txt + rate-limit enforcement in both the Edge Function and client fetcher.
- Per-platform disclosure strings + links to each platform's terms (first-use).
- "Open manually" fallback UX whenever a fetch is blocked.
- Audit log entry per import/apply-handoff (reuse existing audit plumbing).

### M5 — Polish & scale
- Source filter chips ("📦 All · 🏢 ATS · 🌐 Imported · 📡 RSS").
- Duplicate collapse across platforms (same role at same company).
- Docs: user-facing "How applying works — and why we never apply for you".

---

## 5. Risk guardrails (accepted vs. avoided)

| Risk | Treatment |
|---|---|
| User's platform account suspended | **Avoided by design** — no login-gated access, no automated submission; hand-off only |
| ToS breach by the app | We ship no scraping/automation; every fetch is public + user-directed + rate-limited |
| CFAA / IT Act exposure | No circumvention (no login, no CAPTCHA bypass, no headers spoofing); robots.txt respected |
| Personal data misuse | We ingest posting data only; never credentials; on-device by default (DPDP/GDPR-conscious) |
| Platform blocks our fetches | Graceful degradation to "open manually" — the core value (match + docs) survives offline of the fetch |

---

## 6. Open questions for the product owner

1. **Priority platforms**: start with LinkedIn + Naukri import only, or also Indeed/company
   career pages in M1?
2. **Adzuna API key**: do we have (or want to get) one for Lane A, or keep ATS + RSS only?
3. **Pro-gating**: should imported-platform jobs / apply hand-off be Pro-only, or free
   (feed is currently free with a Pro upgrade path)?
4. **Regions**: Naukri is India-centric — should the default source ordering adapt to the
   profile's location (India → Naukri first)?
