# 🧭 Skill Counselor — implementation plan (v2)

*Status: proposed (not started). Companion docs: `enrichment-plan.md`, `phase2-platform-integrations.md`. Replaces v1 — v2 adds the multi-path career model, the freshness/auto-update engine, market-trend evaluation, and course-quality benchmarking.*

## 1. What it is

A **dedicated 🧭 Skill Counselor menu** that answers four questions:

1. **"I want to become X"** — a full, ordered skill path with learning resources, grouped by level.
2. **"I want to reach a higher role"** — the exact *delta* between my level and the target, handed to the Planner.
3. **"Here's my favorite link/blog"** — saved alongside the app's suggestions, clearly separated (⭐ Saved by you vs 🔍 App suggested).
4. **NEW — "Is my knowledge current?"** — a freshness check that flags skills on your profile that the market has moved past (e.g., your React knowledge is 2022-era, the market now demands Server Components).

Unlike v1, this is **not one linear path per field**. It is a **career graph**: fields → tracks → branches, with cross-field transfer edges and an IC-vs-management fork. And it is **self-refreshing**: a trend engine watches market signals, proposes catalog updates, and a quality benchmark keeps resources honest against the market.

---

## 2. The career graph — frontend is not one path

v1's fatal simplification: one `Field → skills` list. Real careers branch, and a counselor that can't show the branches is shallow. Model:

```
Field (frontend)                    Field (backend)                   …
├─ Track: UI engineer               ├─ Track: API engineer
├─ Track: Web performance           ├─ Track: Data engineer
├─ Track: Accessibility              └─ …
├─ Track: React specialist
│   ├─ Branch: React → RSC/Server
│   ├─ Branch: React → React Native/mobile
│   └─ Branch: React → Full-stack pivot (edges: backend, devops)
├─ Track: Design engineer (edges: product)
└─ Fork at senior: Staff/Principal (IC)  |  Engineering Manager (people)
```

- **Nodes live in one flat pool** (`skillPath: Record<FieldId, SkillNode[]>`), and **paths are ordered lists of node ids** — so a skill like "System design" or "Testing" is one node shared across fields instead of duplicated content. Cross-field links (`related: ["be-fullstack-http"]`) make lateral moves explicit: *"You already know 60% of Backend — the delta is these 8 skills."*
- **IC vs management fork at senior** (grounded in staffeng.com and *Staff Engineer: Leadership Beyond the Management Track*): senior→staff/principal is **not more code** — it's architecture, influence, org leverage, writing, stakeholder communication. The management track splits at senior and shares the communication/mentoring nodes, diverging on people-management vs technical-architecture nodes.
- **Adjacent roles are first-class** (grounded in roadmap.sh's pattern of role roadmaps + separate framework roadmaps): roadmap.sh ships *role* roadmaps (frontend, backend, devops) *and* framework roadmaps (React, Angular, Vue) plus non-coding paths (DBA, Postgres, AWS) — we mirror that by letting a track be either a role or a specialization ("React specialist" is a valid target, not just "frontend").
- **Ordering stays derived, not stored**: a path = nodes with `band <= target`, ordered band-asc → difficulty-asc → prereqs first (topological). The delta for `target > current` is still set-difference — unchanged from v1, now per-track.

## 3. Research grounding (what we're modeling)

| Concern | Model | Evidence / source |
|---|---|---|
| Role paths split by level | roadmap.sh | role roadmaps with junior→senior→staff bands; open source (GitHub, MIT) — we can consume its *structure* with attribution instead of inventing from scratch |
| Staff-plus ≠ more code | staffeng.com, Will Larson | architecture, influence, org leverage, writing |
| Market-driven skill taxonomies | Lightcast (EMSI/Burning Glass) | 32–35k-skill taxonomy built from **160k+ sources incl. job postings**, **updated monthly** to reflect emerging skills — the canonical proof that job-posting deltas are the right market signal |
| Assessment-based proficiency | Coursera Skills Graph / Career Graph, Pluralsight Skill IQ | Coursera maps skills↔content↔careers from millions of labor-market points + graded assessment outcomes; Pluralsight scores 0–300 by percentile. Our version: freshness checks + in-app progress, no claims of "true" proficiency |
| Course quality from reviews | Class Central (250k+ reviews, best-of rankings), CourseReport, platform ratings | the standard external quality signal for course resources |
| Free signals we can actually use | npm registry downloads API (`api.npmjs.org`), GitHub REST API (stars/releases, 60 req/hr unauth), Google Trends, O*NET + ESCO taxonomies | all free; npm needs a token for production rate limits, GitHub fine for a cron |
| Upcoming trends | adoption S-curve + leading indicators | research comparing Google Trends vs job-market signals for trending skills; release/changelog monitoring for diff-driven updates |

**Honest limits** (unchanged from v1): never scrape third-party content; resources are canonical links bundled in the app; user links are the user's own data.

---

## 4. Freshness & auto-update engine (NEW — the big one)

### 4.1 Catalog versioning

Every node and resource carries `version` + `reviewedAt`. The catalog ships as a **versioned manifest**:

```ts
interface CatalogManifest {
  version: string;              // semver — "2.1.0"
  publishedAt: number;
  changelog: { nodeId: string; type: "added"|"updated"|"removed"|"moved"|"flagged";
               note: string; signals?: TrendSnapshot }[];
}
```

- The app bundles the current manifest (offline-first); a scheduled refresh fetches the newest one and **diffs locally** (`applyManifestDiff`) so users see exactly what changed since the version they last had — same pattern as the jobs feed.
- `iq.catalogVersion` (new storage key) records the last-seen manifest per user so "What's new in your skill paths?" notifications work.

### 4.2 Market trend signals (tiered by cost/complexity)

| Tier | Signal | Source | Notes |
|---|---|---|---|
| 1 | **Job-posting demand deltas** | **our own jobs table** (ATS + RSS + RemoteOK + user imports) | the killer source — we already fetch this. Count postings mentioning skill `s` in trailing-30d vs prior-90d, normalized. First-party, compliant, no new permissions |
| 1 | Release/changelog events | GitHub releases API for mapped repos, official changelogs (react.dev, MDN browser-compat data) | drives diff-based updates (see 4.4) |
| 2 | Package adoption | npm registry downloads API (per-package mapping) | `npm i -g`-style adoption, leading indicator |
| 2 | Repo activity | GitHub API (stars delta, release cadence for mapped repos) | 60 req/hr unauth is fine for a weekly cron |
| 3 | Search interest | Google Trends (unofficial endpoint) | optional; noisy, treat as corroborating only |
| 3 | Open taxonomies | O*NET (US gov, free), ESCO (EU, free), Lightcast Open Skills | for *emerging-skill discovery* — find skills we haven't cataloged yet |

Every skill node gets a `mappedSignals` config (e.g. `fe-react` → npm `react`, GitHub `facebook/react`), because each signal needs a concrete source mapping.

### 4.3 Trend scoring + stage classification

Per skill per window: each signal normalized to 0–100, blended with admin-tunable weights (default job 0.40 · npm 0.30 · github 0.20 · trends 0.10), producing:

- `trendScore` (0–100) and `demandRank` (position vs sibling nodes in the same track).
- **Stage on the adoption S-curve**: `nascent < 20 · emerging 20–40 · growing 40–70 · mainstream 70–90 · declining` (declining is *below the previous window's score* by a threshold, not just low — that's what makes it a *trend*).

Stage → policy:

| Stage | Auto-applied | Needs human (Admin) approval |
|---|---|---|
| emerging / growing | "📈 Trending" badge, node promoted in ordering **within its band**, resource recency flags | adding a *new* node, moving a node to a different band |
| mainstream | none (stable) | resource refresh suggestions |
| declining | "📉 Demand dropping" flag, node demoted within band, deprecation warnings | removing a node, marking deprecated |

### 4.4 The auto-update loop — honest answer on "auto"

Full-auto editing of curated content produces garbage (a bot can't judge whether "React Compiler" deserves a node). The real design is **hybrid, like roadmap.sh** (community proposals → maintainer merge), automated where safe:

1. **Detect** — a new `trends-refresh` edge function runs on a cron (weekly): pulls tier-1/2 signals, computes scores/stages, writes a `skill_signals` snapshot row. Also watches release feeds.
2. **Propose** — the engine emits **`update_proposals`** (add/update/remove/move/flag) with the signal evidence attached. Auto-applied if it's in the safe class (badges, within-band reordering, recency flags, demand-rank changes); routed to Admin for structural changes.
3. **Approve** — Admin gets a "🧭 Catalog updates" card listing proposals with reasons + signal graphs; one-click approve/reject (bulk-approve for low-risk). This is a **5-minute weekly task**, not a content rewrite.
4. **Publish** — approved proposals bump the manifest (`2.1.0`), changelog written, users get a diff notification next sync.
5. **Evaluate** — every auto-applied change is logged; a quarterly "did the trend hold?" back-test (was the stage classification right?) tunes the weights.

### 4.5 Worked example — React ships a major version (React 19)

Concrete end-to-end for the user's exact question:

1. **Detection**: `trends-refresh` sees a React release event (GitHub `facebook/react` release, react.dev changelog, MDN-bcd flag updates). React 19 (Dec 2024, for reference) introduces Server Components, Actions (`useActionState`/`useOptimistic`), the `use()` hook, ref-as-prop, React Compiler.
2. **Diff**: the release notes' feature list is matched against catalog nodes — "Server Components" exists as an advanced node → mark `updated`; "Actions" and "use()" don't exist → **add** proposals; "Class components / lifecycle" → `moved` (demoted: React 19's docs de-emphasize it); "React Compiler" → `flagged` (experimental → 1.0).
3. **Resource recency scan**: every React course/resource `reviewedAt` older than ~18 months for a fast-moving skill gets "⚠️ Verify for React 19" flags; official docs (react.dev/learn, react.dev/blog/react-19) get added as canonical.
4. **Approve/publish**: admin reviews 3 add + 2 update + 4 flag proposals → manifest `2.1.0`.
5. **User-visible effects**:
   - *Freshness check*: profile has "React" → "Your React skill reflects ≤2022. The market now expects Server Components & Actions — demand mentions grew +X% in 90d." → "Mark as learning →" with the new nodes' resources.
   - *Path reorders*: "React Actions" now appears before "Advanced patterns"; ordering within the React track reflects the new demand ranks.
   - *Resource rows*: "✅ Updated for React 19" / "⚠️ Covers React 18" badges; default sort shows React-19-current resources first.
   - *Notification*: "Your skill paths updated: 3 new skills, 2 changed" with the diff.
6. **Ongoing**: npm/react installs + job mentions of "Server Components"/"React 19" tracked → stage moves emerging → growing → mainstream → badge transitions. When React 20 ships, the loop repeats.

This is the answer to "how it keeps up with React updates": it's **release-diff-driven for structural changes, signal-driven for demand/ordering, and recency-driven for resources** — with a weekly human checkpoint that takes minutes.

---

## 5. Course quality vs market competitors (NEW)

### 5.1 Resource quality score (0–100)

```ts
qualityScore = 0.50·curator + 0.25·community + 0.25·external − recencyPenalty
```

| Component | Signals |
|---|---|
| **curator (50)** | our editorial pick + the one-line *why this one* — always shown, always human |
| **community (25)** | in-app: opens / saves / marks-done per resource, decayed; **floored** — no signal until ≥10 users touch it (so 3 friends can't game it) |
| **external (25)** | Class Central aggregate rating for courses; platform rating (Coursera/Udemy/edX) when present; GitHub stars for docs/tools; YouTube engagement for videos |
| **recency penalty** | up to −30 for resources older than a skill-specific TTL (React: ~18 mo; SQL: ~48 mo) |

Quality score is **displayed** (small "★ 4.6 · 12k reviews · updated 2025" line), default sort is `qualityScore` desc with the editor's pick pinned — so the market's best course can outrank our first guess.

### 5.2 The quarterly benchmark (how we measure against competitors)

A "🧭 Benchmark" card in Admin runs every quarter:

- For each skill, our top-3 resources vs **the market's current top resources**: Class Central's rankings for that skill, Coursera/Pluralsight public skill pages, roadmap.sh nodes.
- Output: **coverage** (does our set cover the market's top-5?) and **agreement** (% overlap) + a list of resources that fell off the market's radar → auto-generated `update_proposals` (swap/flag).
- Each resource carries `benchmarkPassedAt` — the UI shows "✅ benchmarked Q3 2026" or "⚠️ not seen in this quarter's benchmark".

### 5.3 Auto-evaluate the *user*, not just the catalog

The freshness check doubles as the "auto-evaluate me against the market" feature: for each profile skill, compare against the catalog node's current `version`/stage → "your React is 2022-era" / "React knowledge current ✓". Suggestions then come from the *delta*: the new nodes plus "learn X → +Y% match on the live job feed" (reusing the matcher's learnable-gain math from the digest work).

---

## 6. Data model (v1 + the new surfaces)

```ts
interface SkillNode {           // v1 fields, plus:
  version: number;              // bumped on every content change
  reviewedAt: number;
  trendScore?: number;          // latest blended signal
  stage?: "nascent"|"emerging"|"growing"|"mainstream"|"declining";
  demandRank?: number;          // within-band ordering from signals
  deprecation?: { reason: string; since: string };
  mappedSignals?: { npm?: string; github?: string };   // for 4.2
  related?: string[];           // cross-field node ids (career graph edges)
}

interface Resource {            // v1 fields, plus:
  qualityScore?: number;
  qualitySources?: { curator: number; community: number; external: number };
  reviewedAt: number;           // per-resource recency
  benchmarkPassedAt?: number;   // 5.2
  editionNote?: string;         // "covers React 19"
}

// server-side (Supabase tables, written by trends-refresh):
//   skill_signals     { skillId, windowStart, jobMentions, npmDownloads,
//                       githubEvents, trendScore, stage, at }
//   update_proposals  { id, type, nodeId, reason, signals, status,
//                       createdAt, decidedAt }
```

Tracks (2) live in the manifest too: `tracks: { id, fieldId, name, band, nodeIds: string[], related: string[] }`.

Storage keys: existing `iq.skillCounselor` (progress + saved links) + new `iq.catalogVersion` (last-seen manifest, for diff notifications).

## 7. Engine — `src/services/skillCounselor.ts` (+ `_shared/trends.ts`)

Client (pure, offline, tested):

```ts
buildSkillPath(field, trackId, targetBand): SkillNode[]      // ordered path
gapAnalysis(profile, field, trackId, targetBand): { currentBand, delta, next }
planForTarget(field, trackId, targetBand, profile): string[] // digest-style text
freshnessCheck(profile, catalog): { skill, status: "current"|"stale"|"missing",
                                    reason, delta: SkillNode[] }[]
resourceQuality(resource, communityStats): number            // 5.1 formula
applyManifestDiff(prev, next): CatalogChange[]               // for "What's new"
```

Server (`supabase/functions/trends-refresh/` + `_shared/trends.ts` — the trend math is **shared** so client and server classify identically, same parity pattern as `recommendationsDigest.ts`):

```ts
computeTrendScore(signals, weights): number
classifyStage(score, prevScore): Stage
emitProposals(catalog, signals, releases): UpdateProposal[]   // 4.4 step 2
```

## 8. UI

- **Nav**: 🧭 Skill Counselor (dedicated view).
- **Top bar**: field → **track** picker (the v2 addition — "Frontend → React specialist" or "Backend → Data engineer"), level chips (Junior → CTO), and a "Check my freshness" button.
- **Path list**: grouped by band, progress ring per skill, difficulty dots, one-line why, **stage badges** (📈 Trending / 📉 Demand dropping / 🆕 New).
- **Skill sheet**: 🔍 App suggested (grouped by kind, with quality + recency badges) · ⭐ Saved by you below · progress toggle · "Why this resource" note.
- **Level-up card**: target > current → delta strip + "Start roadmap →" into the Planner; the IC-vs-management fork shown at senior.
- **Freshness banner**: stale profile skills with "Mark as learning →" (section 5.3).
- **Admin**: "🧭 Catalog updates" (proposal approve/reject with signal evidence) + "🧭 Benchmark" (quarterly competitor report) + the trend-weight sliders.
- **What's new toast**: manifest diff after refresh ("Your skill paths updated: 3 new, 2 changed").

## 9. Reuse checklist (v1 + additions)

| Need | Existing piece |
|---|---|
| Fields/levels | `src/data/fields*.ts`, `src/data/levels.ts` |
| Skill matching | tokenizer in `src/services/jobs.ts` |
| Years → band | `profileLevel()` in `src/services/jobs.ts` |
| Planner hand-off | `prioritize`/`buildRoadmap` in `src/services/roadmap.ts` |
| Storage + sync | `src/services/storage.ts`, `mergeFor` in `src/services/sync.ts` |
| Job corpus for demand deltas | existing jobs tables + `jobs-fetch` (tier-1 signal, no new infra) |
| Cron + edge functions | existing deploy workflow (add `trends-refresh` to the auto-deploy list) |
| UI primitives | `src/components/ui.tsx` |
| Pro gating | `src/services/entitlements.ts` |

## 10. Phases

- **P0 — Career graph + view**: manifest v1 (frontend **tracks**: UI, React specialist, performance, accessibility, design-engineer + backend tracks), `SkillCounselor.tsx`, track picker, bands + why, "What's new" diff plumbing. Tests: catalog shape (unique ids, no dangling prereqs/related), topological ordering.
- **P1 — Engine + gap + progress**: `gapAnalysis`, `freshnessCheck` (v1, static), progress persistence, IC-vs-management fork at senior. Tests: delta correctness, freshness detection.
- **P2 — Resources + quality + saved links**: `resourceQuality` with static curator/external scores, recency badges, app-vs-user separation, sync branch. Tests: quality formula, dedupe, merge.
- **P3 — Level-up + Planner hand-off**: delta card, "Start roadmap →", staff+ non-technical nodes. Tests: hand-off shape.
- **P4 — Freshness engine (auto-update)**: `trends-refresh` edge function (job-corpus deltas first, then npm + GitHub), `skill_signals`, `update_proposals`, Admin approval UI, manifest publish + client diff. Parity test: `_shared/trends.ts` used by both. **This is the phase that answers "how it auto-updates".**
- **P5 — Benchmark**: quarterly competitor benchmark card (5.2), community quality signals going live, `benchmarkPassedAt`.
- **P6 (optional)**: Google Trends + 🇮🇳 India signals (Indian ATS boards already in the corpus; add India-specific resource sets), AI-generated personalized plans (API key, Pro).

## 11. Testing + deploy

- Vitest: trend math (normalize/blend/stage incl. the declining rule), proposal emission (React-19-style fixture), manifest diff, freshness check, quality scoring, path ordering — plus a **client/server parity test** for `_shared/trends.ts` (same pattern as the digest parity tests).
- Deno tests for `trends-refresh` fixtures; the deploy workflow gains `trends-refresh` in the auto-deploy function list (the bug we caught with `send-recommendations-digest`).
- Existing gates: `npm run typecheck`, `npm test`, `npm run build`; live preview verification per phase.

## 12. Open questions

1. **Multi-track scope** — frontend + backend get 4–5 tracks each (deep, v2's point) vs one track per field (thinner)? Recommend: deep on the 2 fields, mirroring the P0 catalog decision.
2. **Consume roadmap.sh's open-source data?** It's MIT-licensed and gives structure cross-check (their React roadmap → our React track). Recommend: yes for *validation*, keep our resources hand-curated. Requires attribution.
3. **Automation appetite** — the hybrid model (auto: badges/reordering/recency flags; human: structural changes) is the honest default. Want more pushed to fully-auto (e.g., auto-add obvious new nodes), accepting more noise?
4. **Signal tiers** — ship tier-1 only (our own job corpus, zero new infra/keys) first, or wire npm/GitHub in P4 immediately (needs an npm token secret in CI)? Recommend tier-1 first, npm/GitHub in the same phase if you're OK with a secret.
5. **India** — the corpus already includes Indian ATS boards + user imports, so India demand deltas work out of the box; want a separate 🇮🇳 trend view + India resource sets too?
6. **Benchmark cadence** — quarterly manual benchmark acceptable, or push for a semi-automated monthly (Class Central pages are fetchable, but review weighting is editorial)?
7. **Pro gating** — keep v1's proposal (free core + Pro for staff/CTO deltas & unlimited saved links) — trend badges/freshness stay free?
