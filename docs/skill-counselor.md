# 🧭 Skill Counselor — implementation plan

*Status: proposed (not started). Companion docs: `enrichment-plan.md`, `phase2-platform-integrations.md`.*

## 1. What it is

A **dedicated menu** that acts as a skill counselor:

- **Pick a target** ("I want to become a front-end developer") → it lists the **skills you need, in order**, each with **learning resources** (docs, interactive tutorials, courses, books, videos).
- **User-added resources** — save your favorite links/blogs per skill — shown with a clear badge (**⭐ Saved by you**) vs. the app's own suggestions (**🔍 App suggested**).
- **Level-up mode** — "I'm targeting a higher role" → it shows **what's new at the next level** (mid → senior → staff → principal → CTO) and what to learn to close the gap from your current profile, feeding straight into the existing weekly **Planner** roadmap.

Use cases (from the request):
1. "I want to learn front-end" → full skill list + resources.
2. "I want to reach senior/staff/CTO" → the *delta* between my current level and the target, with resources.
3. "Here's my favorite blog/link" → add it next to the app's suggestions, clearly distinguished.

## 2. Research grounding (what we're modeling)

- **roadmap.sh** is the canonical model: role-based roadmaps **split by seniority level** (junior → senior → staff), each node = a skill, with resources attached. We mirror that structure (field → level band → skills) but ship a **curated static catalog** instead of scraping roadmap.sh.
- **Seniority levels**: roadmap.sh's *Levels of Seniority* guide — junior = execute, mid = own a feature, senior = own a system, staff = own an initiative/architecture, principal/CTO = org-level direction. Skills map to bands accordingly.
- **Staff-plus** (staffeng.com, *Staff Engineer: Leadership Beyond the Management Track*): the jump from senior is not more code — it's **architecture, influence, writing, org leverage**. The catalog must include non-technical skills (mentoring, estimation, system design, stakeholder communication) at lead+ bands or the level-up path will be wrong.
- **Resource taxonomy** (proven by MDN / The Odin Project / freeCodeCamp): docs (MDN, JavaScript.info), interactive (freeCodeCamp, Exercism, The Odin Project), courses (Frontend Masters, Coursera), books (DDIA, Staff Engineer), talks/videos (YouTube, conference). 2–4 canonical, free-first resources per skill; paid ones flagged.
- **Honest limits**: we never scrape or hot-link third-party content; the catalog is a **curated list of canonical links bundled in the app** (offline-first PWA — links open in a new tab). User-added links are the user's own data, stored locally + synced to their account.

## 3. Data model

### 3.1 Skill catalog (new `src/data/skillPath.ts`, bundled)

```ts
interface SkillNode {
  id: string;            // stable id, e.g. "fe-html-semantics"
  name: string;          // "Semantic HTML & accessibility"
  cluster: string;       // "Core", "Styling", "JavaScript", "Frameworks", "Leadership"…
  band: LevelId;         // junior | mid | senior | staff | principal | cto — first band this skill appears at
  difficulty: 1 | 2 | 3; // 1 = learn first, 3 = mastery/advanced
  why: string;           // one line: why this matters at this level
  prereqs?: string[];    // skill ids that should come before
  resources: Resource[];
}

interface Resource {
  title: string;
  kind: "docs" | "interactive" | "course" | "book" | "video" | "article";
  url: string;
  free: boolean;
  note?: string;         // e.g. "official reference", "free chapter"
}
```

Shape per field (reuse existing `FIELDS` ids: frontend, backend, fullstack, devops, data, security, mobile, product):

```
skillPath: Record<FieldId, SkillNode[]>
```

- **P0 ships frontend + backend fully**; other fields get core bands (junior–senior) first, staff+ later. Rationale: the catalog is content-heavy; better 2 deep fields than 8 shallow ones.
- **Level-up deltas** are derived, not stored: `skillsAtLevel(field, band)` = nodes with `band <= X`; the *delta* for targeting `Y > X` = `skillsAtLevel(Y) − skillsAtLevel(X)`.
- Reuse `LEVELS` from `src/data/levels.ts` (junior, mid, senior, staff, principal, cto, ceo) and the field skill labels from `src/data/fields*.ts` where they map (the catalog *expands* them with order, bands, and resources).

### 3.2 User resources (local + synced)

```ts
interface SavedResource {
  url: string;           // unique key
  title: string;
  note?: string;
  skillId?: string;      // attach to a catalog skill, or "general"
  addedAt: number;
}
```

- New storage key `iq.skillCounselor`:
  ```ts
  { progress: Record<skillId, "learning" | "done">, saved: SavedResource[] }
  ```
- Sync via the existing `mergeFor` mechanism in `src/services/sync.ts` (add a merge branch; last-write-wins per field, union for `saved`).

## 4. Engine (pure, offline, unit-testable) — `src/services/skillCounselor.ts`

```ts
buildSkillPath(field: FieldId, targetBand: LevelId): SkillNode[]   // ordered: band asc, difficulty asc, prereqs first (topological)
gapAnalysis(profile: CareerProfile | null, field: FieldId, targetBand: LevelId): {
  currentBand: LevelId;                 // from profileLevel(profile.years) + headline domain
  delta: SkillNode[];                   // skills at targetBand you don't already cover (label-match vs profile.skills)
  next: SkillNode[];                    // the immediate next band's skills (if current < target)
}
planForTarget(field, targetBand, profile): string[]               // plain-text "learn this next" list (mirrors digest style)
```

- **Skill matching** reuses the existing label-tokenizer (`matchSkill` semantics in `services/jobs.ts`) so "typescript" in the profile covers "TypeScript fundamentals" in the catalog — the same matching the job matcher uses.
- `currentBand` reuse `profileLevel(profile.years)` + the headline domain check, so a CTO profile targeting "frontend" is treated as principal+.
- The plan text/order feeds the **existing Planner**: `prioritize()` in `services/roadmap.ts` already allocates phases/weeks — Skill Counselor emits a `Goal`-shaped payload the Planner can consume ("Start this as a roadmap →").

## 5. UI — new `src/components/SkillCounselor.tsx` + nav entry

- **Nav**: add 🧭 **Skill Counselor** to the primary nav (next to 🧭 Roadmap) or the More menu. Dedicated view, not a modal.
- **Top bar**: target picker — field chips (Frontend, Backend, Full-Stack, …) + level chips (Junior → CTO). Defaults: field from profile/headline, level = "target one above current".
- **Path list**: grouped by level band with a small progress ring per skill (`✓ done` / `● learning` / `○ next`), difficulty dots, and the one-line `why`.
- **Skill sheet** (expandable per skill):
  - "🔍 App suggested" resource list — grouped by kind with icons (📄 docs / 🖥️ interactive / 🎓 course / 📚 book / 🎬 video).
  - "⭐ Saved by you" section underneath — add-link form (URL + title + note), each row removable; a saved row with the *same* URL as a suggestion shows both, clearly separated.
  - Progress toggle ("Mark as learning / done").
- **Level-up card**: when target > current band, a highlighted strip at top — "To reach **Staff**, add: *Architecture & influence · System design · Org-wide writing*" with a **"Start roadmap →"** button that hands the plan to the Planner.
- **Badge distinction is a hard requirement**: `source: "app"` vs `source: "user"` is rendered with different badges and a filter toggle ("Show saved only").

## 6. Integration + reuse checklist

| Need | Existing piece |
|---|---|
| Fields/levels | `src/data/fields*.ts`, `src/data/levels.ts` |
| Skill label matching | tokenizer in `src/services/jobs.ts` |
| Years → band | `profileLevel()` in `src/services/jobs.ts` |
| Weekly plan builder | `prioritize`/`buildRoadmap` in `src/services/roadmap.ts` |
| Storage keys + sync | `src/services/storage.ts`, `mergeFor` in `src/services/sync.ts` |
| UI primitives | `Chip`, `Modal`, `btn*`, card classes in `src/components/ui.tsx` |
| Nav | `src/components/App.tsx` view registry |
| Pro gating | `getTier`/`isPaywallEnabled` in `src/services/entitlements.ts` |

## 7. Pro gating (proposal — confirm)

- **Free**: browse any field's path + resources; save up to **5** links; level-up card shows the *next* band's delta.
- **Pro**: unlimited saved links, full staff/principal/CTO deltas + the one-line reasons for each resource pick, and "Start roadmap" planning.
- Aligned with existing gating (full reasons are Pro in Jobs; the feed itself is free).

## 8. Phases

- **P0 — Catalog + view**: `skillPath` data (frontend + backend, all bands), `SkillCounselor.tsx`, nav entry, target picker, path list with bands + why. Tests: catalog shape (every node has resources, unique ids, no dangling prereqs), view smoke.
- **P1 — Engine + gap**: `gapAnalysis`, progress persistence (`iq.skillCounselor`), mark learning/done. Tests: ordering (topological), delta computation, profile-skill matching.
- **P2 — Resources + saved links**: resource sheets, add/remove saved links, app-vs-user badges + filter, sync branch. Tests: storage round-trip, dedupe by URL, merge behavior.
- **P3 — Level-up + Planner**: level-up delta card, "Start roadmap →" hand-off, staff+ non-technical skills, optional AI (API-key) generation of a personalized study plan. Tests: roadmap hand-off shape, level-up delta correctness.

## 9. Testing + deploy

- Vitest for the engine (`skillCounselor.test.ts`) + catalog sanity; **no server mirror needed** (nothing email/server-side depends on it — unlike the digest, this is fully client-side; if we later email a study plan, mirror it in `_shared/` like `recommendationsDigest.ts`).
- Existing `npm run typecheck` + `npm test` + `npm run build` gate; deploy is the existing workflow (Pages + edge functions unchanged).
- Live verification in the preview (like past features): pick a target, confirm ordering/deltas, add a saved link, confirm badges, reload for persistence.

## 10. Open questions for you

1. **Scope of the catalog** — start with **frontend + backend only** (deep, correct) or all 8 fields thin? (Recommend: 2 deep first.)
2. **India-market resources?** Add an optional "🇮🇳 India" resource set (Naukri-style LPA references, Indian startup system-design content)? Recommend yes for the India digest synergy.
3. **Pro gating** — agree with the free/pro split above, or keep the whole counselor free as a growth feature (like import/apply)?
4. **AI generation** — with an API key, generate personalized resource lists per gap (Pro), or keep 100% curated/offline?
