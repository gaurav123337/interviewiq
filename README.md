# InterviewIQ — AI Interview Coach (PWA)

> 🔗 **Live demo:** https://gaurav123337.github.io/interviewiq/

Prepare for technical interviews from **junior developer to CTO and CEO**. Pick a level, a field, and a company — InterviewIQ composes a tailored mock interview with company-fit questions, technical depth, model answers, and scored feedback — then layers on a job feed, résumé/JD matching, study roadmaps, article summaries, and a RAG-grounded system-design tutor.

Built as an **offline-first Progressive Web App** with **React 19 + TypeScript + Tailwind CSS 4 + Vite 6**.

## Architecture at a glance

The **core interview practice loop runs entirely in the browser** and works offline: the question bank, session engine, scoring, results, history and drills are all local (`localStorage` is the source of truth).

Everything else is **backed by Supabase** (Postgres + Auth + Edge Functions). The connected features below require a backend and, for most, a signed-in account:

- **Cloud sync** — sessions, streaks and drill progress across devices
- **Server-verified Pro** — freemium entitlements, grant codes, and payments (the paywall ships **on**)
- **Generative AI** — feedback, hints and the system-design tutor, either with your own API key **or** proxied through the server for signed-in users
- **System-design tutor (RAG)** — retrieval-grounded AI chat over a curated content corpus
- **Job portal** — a synced job feed, résumé/JD match scoring, apply-kit generation, and application tracking
- **Study roadmaps & article summaries** — planner generation and article ingestion/summarization
- **Teams (B2B)** — seat-based Pro
- **Admin** — billing, content curation and moderation dashboards

Without a backend the app still installs and runs as the offline interview coach; the connected features are simply gated or hidden.

## Features

**Core (offline, no account needed)**

- **7 levels** — Junior → Mid → Senior → Staff → Principal → CTO → CEO
- **8 fields** — Frontend, Backend, Full-Stack, DevOps/Cloud, Data/ML, Mobile, QA, Security
- **12 companies + General** — Google, Meta, Amazon, Microsoft, Apple, Netflix, Stripe, Airbnb, Uber, Spotify, Cloudflare, Datadog — each with its own stack, culture values, interview style, difficulty rating, and tailored questions
- **~270 curated questions** with model answers and key points (field questions + behavioral, system design, CTO, and CEO pools)
- **Session engine** — composes a balanced session (company fit + technical + system design + behavioral) with difficulty ramping; "Journey" mode ramps from junior up to your level
- **Offline scoring & feedback** — scores each answer against the model answer's key points (1–5, grade A–F, what went well / what to cover)
- **Results dashboard** — SVG radar chart per category, study-topic suggestions, per-question review, export to Markdown / print / share
- **Question Bank** — browse every question with solutions, searchable, filterable by field and level, with a "practice this question" button
- **History** — sessions saved automatically, review (read-only replay) or delete
- **Spaced-repetition drills** — SRS deck built from the bank
- **Voice answers** — dictate with the Web Speech API where supported
- **PWA** — installable; the service worker precaches the app shell and caches hashed assets at runtime

**Connected (require the Supabase backend / an account)**

- **Cloud sync** — cross-device backup and merge (optional; see below)
- **Pro (freemium)** — free tier is metered (sessions/month, AI calls/day); Pro lifts the limits. Pro is an **account property**, server-verified — never a device flag
- **Generative AI** — bring any OpenAI-compatible key (OpenAI, OpenRouter, Groq, Ollama…) which stays in your browser, **or** sign in and use the server-proxied AI without a key
- **System-design tutor** — RAG chat that cites retrieved sources and honestly marks answers as grounded vs. from the model's own knowledge
- **Job portal** — synced feed, résumé/JD match scoring, gap plans, apply-kit drafting, and application status tracking
- **Roadmaps & articles** — generate a study plan; summarize an article for interview prep
- **Teams & Admin** — team seats; owner/admin dashboards for billing, content and security

## Run it (local, core app)

```bash
npm install
npm run dev        # http://127.0.0.1:8137
```

This gives you the full offline interview coach. Connected features stay gated until you point the app at a backend (next section).

Production build and preview:

```bash
npm run build      # type-checks the app, runs the security check, bundles to dist/
npm run preview    # http://127.0.0.1:8138
```

> `npm run build` type-checks with `tsconfig.build.json`, which **excludes** tests. Run `npm run typecheck` (or `npm test`) to check the suite — CI does both (see [Tests & CI](#tests--ci)).

## Backend setup (required for connected features)

The backend is Supabase: Postgres (with RLS), Auth, and Deno **Edge Functions**.

### 1. Create the project and base schema (cloud sync)

**Automatic (recommended):**

1. Create a **personal access token** at supabase.com/dashboard/account/tokens.
2. Find your **org id** in the dashboard URL (`supabase.com/dashboard/org/<ORG_ID>/...`).
3. Bootstrap — creates the project, runs `supabase/schema.sql` (the `user_sync` table + RLS for cloud sync), sets the auth redirect allow-list, and prints the exact `config.ts` block:

```bash
SUPABASE_ACCESS_TOKEN=sb_secret_... SUPABASE_ORG_ID=<org-id> node scripts/setup-supabase.js
```

**Manual:** create a project at [supabase.com](https://supabase.com), run `supabase/schema.sql` in the **SQL editor**, then add `https://<your-host>/**` to Dashboard → **Authentication → URL Configuration** redirect allow-list, and copy the **Project URL** + **anon public key** into `src/config.ts` (see [Configuration](#configuration)).

### 2. Apply the feature SQL

`schema.sql` only sets up cloud sync. Each connected feature has its own SQL under `supabase/` — run the ones for the features you want, in the SQL editor:

| Area | Files |
| --- | --- |
| Pro / billing / payments | `billing.sql`, `billing2.sql`, `billing3.sql`, `payments.sql` |
| System-design RAG | `rag.sql`, `content.sql`, `content-sourcing.sql`, `content-curation.sql`, `quality.sql`, `resources.sql` |
| Jobs | `jobs.sql`, `jobs-fetch-cron.sql`, `jobs-fetch-reports.sql`, `trends.sql`, `trends-refresh-cron.sql` |
| Roadmaps | `skill_roadmaps.sql` |
| AI cost/quotas | `ai-provider.sql`, `ai-user-quotas.sql`, `ai-cost-controls.sql` |
| Admin / security / auth | `admin.sql`, `security.sql`, `recovery-codes.sql`, `edge-secrets.sql`, `dashboard-setup.sql` |
| Digest cron jobs | `send-apply-digest-cron.sql`, `send-recommendations-digest-cron.sql`, `send-security-digest-cron.sql`, `revalidate-resources-cron.sql` |

Dated migrations under `supabase/migrations/` (e.g. tip payments, article normalizer) apply on top.

### 3. Deploy the Edge Functions

Payments, AI proxying, RAG indexing, job ingestion, digests and admin actions run as Edge Functions (`supabase/functions/`, e.g. `pay-checkout` / `pay-verify` / `pay-webhook`, `ai-chat`, `content-index` / `content-scrape`, `import-job` / `jobs-fetch`, the `send-*-digest` jobs). The deploy workflow ships them automatically (see below), or deploy manually:

```bash
npx supabase functions deploy pay-webhook --project-ref <ref> --no-verify-jwt
# …repeat per function
```

### 4. Set Edge secrets (payments, AI, email)

Payments use **Razorpay** (the active provider; dispatch lives server-side, so switching providers is an env change). Set the secrets the functions read — e.g.:

```bash
npx supabase secrets set \
  PAYMENT_PROVIDER=razorpay \
  RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=... \
  --project-ref <ref>
```

Point your Razorpay webhook at the deployed `pay-webhook` URL. (AI-proxy and email functions have their own secrets — see each function's source.)

### 5. OAuth (optional)

Create a GitHub **OAuth App** and/or a Google **OAuth client (Web)**, set the callback to `https://<ref>.supabase.co/auth/v1/callback`, and paste each Client ID + Secret into Dashboard → **Authentication → Providers**. The sign-in buttons appear automatically once a provider is enabled.

## Payments & Pro

- The **paywall ships on** (`CONFIG.features.paywall`). The free tier is metered (sessions/month, AI calls/day); Pro removes the limits.
- **Pro is server-verified.** The client only *reads* the entitlements table; Pro is granted by admin action, single-use **grant codes** (`redeem_grant`), or a **Razorpay** payment confirmed by the `pay-webhook` signature check. A signed-out visitor can never hold Pro — the client fails closed to `free` and ignores any locally-stored tier.
- The legacy `IQPRO-XXXX` format keys are **forgeable and disabled** (`CONFIG.features.testLicensing` ships `false`); they exist only for local testing of that code path.

## Tests & CI

```bash
npm test           # vitest: engine/data integrity + full UI flow (jsdom)
npm run typecheck  # tsc over the WHOLE project, including tests
npm run eval:rag   # RAG retrieval golden-set regression gate
```

CI (`.github/workflows/deploy.yml`, on push to `main`) is a hard gate: production `npm audit`, `npm run eval:rag`, `npm run typecheck` (app **and** tests), `npm run build`, the **full `npm test` suite (blocking)**, and `deno test supabase/functions/_shared/` for the edge shared code — then deploys `dist/` to **GitHub Pages** and (if `SUPABASE_ACCESS_TOKEN` is set) the Edge Functions. The `pre-push` hook mirrors these gates locally.

To enable Pages deployment: repo Settings → Pages → Source → **GitHub Actions**. `vite.config.ts` uses a relative base (`./`), so `dist/` also serves from any subpath (Netlify, Vercel, Cloudflare Pages, S3…).

## Project structure

```
index.html             Vite entry (manifest, meta, root div)
vite.config.ts         Vite + React + Tailwind + Vitest (jsdom) config
public/
  manifest.webmanifest PWA manifest
  sw.js                service worker (offline-first caching)
  icons/               generated PNG icons + SVG favicon
src/
  main.tsx             React entry; registers the service worker, inits cloud sync
  index.css            Tailwind theme (colors, keyframes, utilities)
  types.ts             shared types (Level, Field, Company, Session, Feedback…)
  store.tsx            React context + reducer; localStorage persistence
  config.ts            central app config (Supabase, payment provider, feature flags)
  engine.ts            domain layer: compose, scoring, feedback, aggregate, relevance
  ai.ts                AI integration: BYO OpenAI-compatible key OR server-proxied chat
  services/            storage/sync, entitlements + billing, jd/session, planner,
                       progress, drill (SRS), rag, jobs/applyKit/applyTrack, teams,
                       admin, events, license, cloud, notifications
  data/                levels, 8 field question banks, companies, pools
  components/          App shell, Onboarding, Interview, Results, Bank, History,
                       Settings, Planner, Drill, Jobs, CoachChat, playground, ui kit
  __tests__/           engine/data, features, growth, billing, teams, roles, sync,
                       rag-eval, perf + the full-flow integration test
supabase/
  schema.sql           cloud-sync base (user_sync + RLS)
  *.sql                per-feature schema (billing, rag, jobs, content, admin…)
  migrations/          dated migrations applied on top
  functions/           Deno Edge Functions (payments, AI, RAG, jobs, digests, admin)
scripts/
  setup-supabase.js    bootstraps the project + base schema
  gen-icons.js         zero-dependency PNG icon generator
```

## How scoring works (offline mode)

Each question's model answer is tagged with short **key points**. Your answer is tokenized and checked against those key points (stopwords removed). Score = coverage × length heuristic, mapped to 1–5, with per-level coaching tips added to the feedback. When AI feedback is enabled (your key or the server proxy), it augments this with a generative critique.

## Configuration

`src/config.ts` centralizes the knobs:

```ts
export const CONFIG = {
  payment: { provider: "razorpay" },   // UI label; real dispatch is server-side
  features: {
    paywall: true,        // enforce freemium limits (ships on)
    testLicensing: false  // legacy forgeable format keys (ships off)
  },
  supabase: {
    url: "https://YOURPROJECT.supabase.co",
    anonKey: "sb_publishable_…"        // empty = cloud/connected features off
  }
} as const;
```

## Privacy

The core app stores your data in the browser's `localStorage` (onboarding choices, settings, history, drills). Your AI API key, usage metering and notification preferences **never leave the device**.

When you opt into connected features, data leaves the browser accordingly: **cloud sync** uploads sessions/streaks/drills to your Supabase row (RLS-scoped to you; scalars are last-write-wins, sessions and SRS **merge**); **signed-in AI** sends your prompts to the server proxy (or, with your own key, directly to the endpoint you configure); **RAG** sends your question to retrieve matching corpus passages. Email + password auth works out of the box; OAuth is optional.
