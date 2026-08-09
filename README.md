# InterviewIQ — AI Interview Coach (PWA)

> 🔗 **Live demo:** https://gaurav123337.github.io/interviewiq/

Prepare for technical interviews from **junior developer to CTO and CEO**. Pick a level, a field, and a company — InterviewIQ composes a tailored mock interview with company-fit questions, technical depth, model answers, and scored feedback.

Built as an **offline-first Progressive Web App** with **React 19 + TypeScript + Tailwind CSS 4 + Vite**. No backend; everything runs in the browser and works without an internet connection.

## Features

- **7 levels** — Junior → Mid → Senior → Staff → Principal → CTO → CEO
- **8 fields** — Frontend, Backend, Full-Stack, DevOps/Cloud, Data/ML, Mobile, QA, Security
- **12 companies + General** — Google, Meta, Amazon, Microsoft, Apple, Netflix, Stripe, Airbnb, Uber, Spotify, Cloudflare, Datadog — each with its own stack, culture values, interview style, difficulty rating, and tailored questions
- **~270 curated questions** with model answers and key points (167 field questions + behavioral, system design, CTO, and CEO pools)
- **Session engine** — composes a balanced session (company fit + technical + system design + behavioral) with difficulty ramping; "Journey" mode ramps from junior up to your level
- **Scoring & feedback** — offline engine scores each answer against the model answer's key points (1–5, grade A–F, what went well / what to cover)
- **Optional generative AI** — add any OpenAI-compatible API key (OpenAI, OpenRouter, Groq, Ollama…) in Settings for real AI feedback and hints. Key stays in your browser only.
- **Results dashboard** — SVG radar chart per category, study-topic suggestions, per-question review, export to Markdown / print / share
- **Question Bank** — browse every question with solutions, searchable, filterable by field and level, with a "practice this question" button
- **History** — sessions saved automatically, review (read-only replay) or delete
- **Voice answers** — dictate with the Web Speech API where supported
- **PWA** — installable, works fully offline (service worker caches the shell; hashed assets are cached at runtime)

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:8137
```

Production build and preview:

```bash
npm run build      # typechecks + bundles to dist/
npm run preview    # http://127.0.0.1:8138
```

## Deploy

The repo ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that runs the test suite, builds, and publishes to **GitHub Pages** on every push to `main`. To enable it: repo Settings → Pages → Source → **GitHub Actions**.

For other static hosts, `vite.config.ts` already uses a relative base (`./`), so the built `dist/` folder works from any subpath (Netlify, Vercel, Cloudflare Pages, S3…).

## Tests

```bash
npm test           # vitest: engine/data integrity + full UI flow (jsdom)
```

- `src/__tests__/smoke.test.ts` — validates the question bank (fields × levels, answers + key points, pools) and session composition/scoring.
- `src/__tests__/app.flow.test.tsx` — mounts the real React app and walks onboarding → interview → feedback → results → history → bank → settings.

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
  engine/              domain layer: compose, scoring, feedback, aggregate, bank, relevance, random
  services/            application layer: storage, session use-cases, planner, progress,
                       drill (SRS), entitlements, license, notifications, cloud sync, jd, report
  ai.ts                optional OpenAI-compatible chat integration
  util.ts              generic helpers
  data/                levels, 8 field question banks, companies, pools
  components/          App shell, Onboarding, Interview, Results, Bank, History, Settings, Planner, Drill, ui kit
  __tests__/           smoke, features, growth, notifications, sync + full-flow integration
scripts/
  gen-icons.js         zero-dependency PNG icon generator (node scripts/gen-icons.js)
```

## Cloud sync (optional — cross-device backup)

The app is local-first: everything runs offline in your browser. If you want your sessions, streaks and drill progress to follow you across devices, enable the optional Supabase sync.

### Automatic setup (recommended)

1. Create a **personal access token** at supabase.com/dashboard/account/tokens.
2. Find your **org id** in the dashboard URL (`supabase.com/dashboard/org/<ORG_ID>/...`).
3. Run the bootstrap script — it creates the project, runs `supabase/schema.sql`, sets the auth redirect allow-list, and prints the exact `config.ts` block:

```bash
SUPABASE_ACCESS_TOKEN=sb_secret_... SUPABASE_ORG_ID=<org-id> node scripts/setup-supabase.js
```

4. **OAuth providers** (two manual steps — there is no API for them): create a GitHub **OAuth App** (github.com/settings/developers) and a Google **OAuth client (Web)** (console.cloud.google.com). In both, set the authorization callback URL the script prints (`https://<ref>.supabase.co/auth/v1/callback`), then paste each Client ID + Secret into Dashboard → **Authentication → Providers → GitHub / Google** and enable them.

### Manual setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the **SQL editor**.
3. Dashboard → **Authentication → URL Configuration** → add `https://gaurav123337.github.io/interviewiq/**` to the redirect allow-list.
4. Copy the **Project URL** + **anon public key** (Settings → API) into `src/config.ts`:

```ts
export const CONFIG = {
  // …
  supabase: { url: "https://YOURPROJECT.supabase.co", anonKey: "eyJ…" }
};
```

5. Restart the app → **Settings → ☁️ Cloud sync** → create an account or sign in.

How it works: local `localStorage` stays the source of truth while offline; the engine syncs through a single storage seam (`services/storage.ts` → `services/sync.ts`). Sessions and drill SRS **merge** across devices; scalars (settings, onboarding) are last-write-wins; your API key, usage metering and notification preferences never leave the device. Email + password auth works out of the box; OAuth buttons appear automatically once a provider is enabled.

## Privacy

## How scoring works (offline mode)

Each question's model answer is tagged with short **key points**. Your answer is tokenized and checked against those key points (stopwords removed). Score = coverage × length heuristic, mapped to 1–5, with per-level coaching tips added to the feedback.

## Privacy

Everything is stored in your browser's `localStorage` (onboarding choices, settings, history). Your API key is only used to call the endpoint you configure — nothing is uploaded otherwise.
