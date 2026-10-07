# AGENTS.md — InterviewIQ

Project-level instructions for coding agents working in this repo. Freebuff
(auto-discovers per directory, priority `knowledge.md` → `AGENTS.md` →
`CLAUDE.md`, case-insensitive) reads this file on every request, so keep it
accurate and short enough to be cheap.

## What this is

InterviewIQ — an offline-first AI interview-coach PWA. Core practice loop runs
entirely in the browser (`localStorage` is the source of truth). Connected
features (cloud sync, Pro/entitlements, AI proxies, jobs, RAG tutor, admin) are
backed by Supabase (Postgres + Auth + Edge Functions).

Stack: React 19 + TypeScript (strict) + Tailwind CSS 4 + Vite, vitest, Deno 2
edge functions, Node 22 script tooling (ESM only).

## Layout

| Path | What lives there |
| --- | --- |
| `src/` | App: components, services, data, `__tests__/` (vitest) |
| `scripts/` | Node ESM pipelines/tooling: crawlers, RAG, auto-apply engine |
| `supabase/` | SQL schema (`*.sql`) + `functions/` (Deno edge functions, `_shared/` pure TS) |
| `supabase/migrations/` | Dated migrations applied on top of the plain `.sql` files |
| `docs/` | Architecture, security, and planning notes (read before big changes) |
| `.github/workflows/` | CI gates — treat these as the definition of "verified" |

## Commands

```bash
npm run dev          # Vite dev server, http://127.0.0.1:8137
npm run typecheck    # tsc --noEmit over src/ INCLUDING tests
npm test             # vitest run (jsdom)
npm run build        # tsc (build config) + innerHTML gate + vite build
npm run eval:rag     # retrieval-regression gate (golden set)
deno test supabase/functions/_shared/   # edge shared-code tests
node --check scripts/<file>.js          # syntax check for engine scripts
npm run apply:doctor # diagnose the local auto-apply environment
```

CI (`deploy.yml`) is the reference verification order:

```
npm ci --ignore-scripts
npm audit --omit=dev --audit-level=high     # supply-chain gate, blocks deploy
npm run eval:rag                            # blocks deploy on regression
npm run typecheck                           # full type check (tests included)
npm run build                               # build BEFORE test (offline suite reads dist/)
npm test                                    # hard gate
deno test supabase/functions/_shared/
```

Husky: `pre-commit` runs the build-config type check; `pre-push` runs the full
set. After any non-trivial change, run `npm run typecheck` and `npm test`; add
`deno test` when you touched `_shared/`.

## Testing doctrine

- **Pure, testable logic** goes in `scripts/<name>-lib.js` with a hand-written
  `scripts/<name>-lib.d.ts`, pinned by vitest in `src/__tests__/<name>.test.ts`.
  Keep new decisions out of Playwright drivers so they are testable.
- **Server-shared logic** goes in `supabase/functions/_shared/*.ts`, pinned by
  colocated `*.test.ts` files run with `deno test supabase/functions/_shared/`.
- **Playwright drivers** (`scripts/auto-apply-jobs.js`, `apply-browser.js`,
  `scrape-jobs-playwright.mjs`) are local-only and intentionally uncovered in
  CI. Say so in the test-file header (existing files do) and push every
  safety-critical decision into the pure lib where it can be tested.
- vitest excludes `supabase/**` (see `vite.config.ts`) — Deno owns those tests.

## Conventions

- ESM everywhere (`"type": "module"`); no new CommonJS.
- TypeScript is strict, but `tsconfig.build.json` excludes tests — so `npm run
  build` alone will not catch test type errors. Run `npm run typecheck`.
- `npm run build` fails on `innerHTML` (gate: `scripts/check-no-innerhtml.mjs`).
  Render text/content through safe DOM APIs.
- Comments in this repo explain **why** and user-visible consequence, often
  dense, and cite the doc section that motivates a guard. Match that style
  rather than adding bare `// step 1` noise.
- Prefer editing existing files over adding new ones; match surrounding style
  (several files use CRLF).

## Supabase / SQL

- Project ref: `ndrusywvceojsoirhkhl`.
- SQL is **applied manually** — Supabase SQL editor, or `scripts/setup-live.js`
  / `scripts/setup-security.js`. There is no auto-migrate on deploy. Plain
  feature files are `supabase/*.sql`; dated ones go in `supabase/migrations/`.
- Write **idempotent** SQL (`create table if not exists`,
  `drop constraint if exists` → re-add, `create or replace function`).
- Edge functions deploy via `scripts/deploy-functions.mjs`, which needs
  `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` (CI secrets, usually absent
  locally). If they are missing, say so plainly and hand off the step — do not
  claim a migration or deploy happened.
- New consumers of an unapplied SQL object must **degrade to an honest logged
  skip**, never crash or silently no-op.
- RPCs intended for the service role should be revoked from `anon`/`public`.

## Secrets and local state (all gitignored — never commit or echo)

- `.env*`, `.claude/settings.local.json` (local permissions + a
  `Bash(SUPA_URL=… SUPA_KEY=… node …)` allow-rule holding credentials),
  `freebuff-apply-profile/`, `freebuff-apply-reports/`, `.freebuff/` (desktop
  app DB), `apply-profile.json`, `freebuff-apply-state.json`.
- `scripts/job-sites-db.js` and the root-level `local-read-query.mjs` parse
  creds out of `.claude/settings.local.json`; read-only queries go through them
  instead of hardcoding keys.
- The committed apply-profile template is `content/apply-profile.example.json`;
  the working copy is the gitignored root `apply-profile.json` (the driver's
  default `--profile`), and the signed-in browser session persists in
  `freebuff-apply-profile/`.

## Git hygiene

- Do not commit, push, or open a PR unless explicitly asked.
- Stage by path (`git add <path>`); never `git add -A`.
- `dist/` is generated (gitignored) — don't hand-edit it.
- This checkout may be shared with other agents/the user. Check `git status` and
  the current branch before consequential Git operations, and never discard,
  stash, or commit changes you did not make.

## Known pre-existing issue (don't chase)

- `deno check supabase/functions/jobs-fetch/index.ts` reports 5 errors from
  untyped `supabase-js` generics. This is a verified baseline, unrelated to
  feature work. The gate is `deno test`, not `deno check`, for these functions.

## Auto-apply engine (local-only subsystem)

- `scripts/auto-apply-jobs.js` is the Playwright driver;
  `scripts/apply-engine-lib.js` (+ `.d.ts`) holds the pure logic (site rules,
  form planning, submit gates, freshness ordering, outcome classification);
  `scripts/job-sites-db.js` is the Supabase access layer;
  `scripts/apply-kit-node.js` wraps fit judging for Node runs.
- Safety invariants: fail closed on page/account checks, never invent answers,
  never submit where the site rule forbids it, and log honest skips.
- Job-site `status` is `pending|active|disabled|dead`; `source` is
  `builtin|discovered|manual|ats`. Newly discovered boards sit in `pending`
  (probation) until the sweep activates them — see
  `supabase/job-sites-probation.sql` and `scripts/auto-apply-jobs.README.md`.
