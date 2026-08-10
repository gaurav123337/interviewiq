# InterviewIQ — Closing the Coding-Question Gap (vs. GreatFrontEnd-style platforms)

> Goal: turn the Code playground from a 6-problem CLI toy into a **three-mode coding
> platform** (CLI algorithms + JavaScript function implementations + browser UI
> component challenges) that stays free, offline-first, and integrates with the
> existing drill, roadmap, quality, and admin systems.

---

## 1. The gap (honest snapshot)

GreatFrontEnd's model — and the reason frontend candidates pay for it — is three
distinct problem formats judged **in the browser**:

| Format | Example questions | What the candidate does |
|---|---|---|
| **UI component coding** | Accordion, Tabs, Carousel, Star Rating, Autocomplete, Todo List, Tic-tac-toe, Progress Bar, Signup Form, Analog Clock, Holy Grail, Infinite Scroll, Drag & Drop | Build a real component in HTML/CSS/JS; judged on rendered DOM + interactions |
| **JavaScript function implementations** | `debounce`, `throttle`, `Promise.all`, `deepClone`, `EventEmitter`, `memoize`, `once`, `flatten`, `pipe`, `curry`, `LRU cache` | Implement a function with a fixed signature; judged by calling it with typed args and comparing returns (incl. async) |
| **CSS challenges** | Centering, Flexbox layouts, Responsive nav, Sticky footer, Animated states | Pure CSS; judged on computed styles |

**What we have today:** a single **CLI mode** (`solve(lines)` → stdout) judged by
Wandbox / the local JS engine — 6 classic algorithm problems (Two Sum, Valid
Parentheses, Maximum Subarray, Binary Search, Buy/Sell Stock, FizzBuzz).

**The gaps, concretely:**

1. **No function-call judging.** `debounce`, `Promise.all`, `deepClone` etc. cannot
   be expressed as stdin/stdout. The runner contract (`src/services/runner.ts`)
   only knows `solve(lines) → output lines`.
2. **No DOM/UI judging.** The single most valuable GreatFrontEnd format — build a
   component, see it render, get auto-checked — is impossible in the current
   Playground, which has no preview pane and no assertion engine.
3. **Volume: 6 problems vs. 500+.** No difficulty ladder beyond 1–3, no category
   taxonomy, no company tagging, no search.
4. **Coding is disconnected from the rest of the product.** Not in Drill mode, not
   mapped to Roadmap topics, not in the admin review pipeline (only "in code" in
   the Quality Center), not harvestable, not gated by mode (only the whole
   playground is Pro).

**Strategic read:** GreatFrontEnd owns *frontend-only*; LeetCode owns *CLI
algorithms*. Nobody combines CLI + JS-utilities + UI-component judging in one
free, offline-first, full-ladder PWA. The **UI-mode judge that runs entirely
client-side** is the differentiator — it's what makes the app a real coding
platform, not a toy.

---

## 2. Architecture: extend the judge, don't bolt on content

The current contract lives in `src/data/coding.ts` (problem spec) + `src/services/runner.ts`
(judge) + `src/components/Playground.tsx` (UI). Plan: generalize all three to a
discriminated problem kind.

```ts
type ProblemKind = "cli" | "fn" | "ui";

interface CodingProblem {
  id: string;
  title: string;
  kind: ProblemKind;          // NEW
  difficulty: 1 | 2 | 3;
  category: string;           // NEW: arrays · async · DOM · layout · …
  prompt: string;
  io?: string;                // cli only
  starters: Record<LangId, string>;
  tests: CodingTest[];        // cli: stdin/expect · fn: args/expect · ui: assertions
  hidden?: CodingTest[];
}
```

### 2a. CLI mode (existing, untouched contract)
`runTests()` in `runner.ts` — Wandbox remote for 5 languages, local JS engine offline.

### 2b. Function mode (NEW judge — `runFnTests`)
User implements a named function (signature shown in the UI). The judge:

- **JS/TS** — runs with the existing local engine (`runLocalJavaScript`), then calls
  the function with each case's args and compares with a bundled deep-equal helper
  (supports `undefined`, nested objects, `NaN`, arrays, and **await** for promises).
  Fully offline.
- **Python** — same via Wandbox: append a harness that imports the function from the
  user module, calls it per case, and prints `JSON`-normalized results for comparison.
- Type annotations for args/return live on the problem (`fn: { name, args, returns }`)
  and drive a signature banner + TS ambient types in the prelude.

Unlock list (Phase 1): `debounce`, `throttle`, `deepClone`, `Promise.all`, `Promise.race`,
`EventEmitter`, `memoize`, `once`, `flatten`, `uniq`, `chunk`, `groupBy`, `pipe`, `compose`,
`curry`, `sleep`, `mapLimit`, `binarySearch`, `LRUCache`, `range/sum`.

### 2c. UI mode (NEW judge — `runUiTests` + preview)
The Playground grows three CodeMirror panels (HTML / CSS / JS) + a live preview
pane. Judging, all client-side:

- The user's code runs inside a **sandboxed `<iframe sandbox>`** (no network, no
  parent access). The spec's `<script src>` is rewritten to inline; external deps
  are disallowed for v1 (offline-first).
- Each test is an **assertion script** run *inside the iframe* after the app mounts:
  `{ label, check: "…JS that returns true/false…" }` — e.g. *"clicking a tab shows
  its panel"*, *"the accordion has exactly 3 sections"*, *"aria-expanded toggles"*,
  *"computed background of the active tab is #4f46e5"*.
- The harness drives interactions by dispatching real DOM events (click, input,
  keydown) and reads the rendered DOM + `getComputedStyle` — no user-visible test
  code, same "hidden judge" spirit as CLI.
- Assertions render live in a checklist beside the preview (pass/fail per check),
  and the existing pass-rate scoring / results flow applies unchanged.

Unlock list (Phase 2): Accordion, Tabs, Star Rating, Carousel, Autocomplete,
Todo List, Modal, Tooltip, Dropdown, Progress Bar, Counter, Tic-tac-toe, Signup
Form with validation, Toast, Image Carousel, Infinite-scroll stub. Plus pure-CSS:
Centering, Holy Grail, Responsive nav, Sticky footer, Card hover states.

---

## 3. Content & curriculum plan

**Target: 60 curated problems** (the "75 essential" idea, right-sized for a free
tier) in a new `src/data/codingBank/` directory, one file per category:

- `algorithms.ts` — grow 6 → 20 (arrays, strings, hashing, two-pointer, sliding
  window, stacks/queues, recursion, DP basics). Company-tagged (`companyIds`).
- `jsFunctions.ts` — 20 problems (Phase 1, listed above).
- `uiComponents.ts` — 15 problems (Phase 2, listed above).
- `cssChallenges.ts` — 10 problems (Phase 2).
- Each problem carries: prompt, **hint** (Pro-gated, like model answers elsewhere),
  **solution** with keypoints (feeds the existing scoring/`kp` pattern), difficulty,
  category, companies, related `deepDive` topic id.

**Tiering:** difficulty 1–3 stays; add a **category filter + search** to the
Playground problem picker, and a **"daily problem"** from the highest-priority
unmastered category (reuses the streak/planner scheduling).

---

## 4. Integration with existing systems (the moat)

- **Drill mode** — coding problems join the spaced-repetition deck: a missed
  problem (function/UI failed ≥2×) becomes a drill card like a missed question.
- **Miss harvesting + Quality Center** — problem attempts flow into the same
  per-question scoreboard (they're already "in code" rows); a UI problem with a
  30%-pass rate gets flagged *too hard*, a 95% one *too easy*, exactly like
  questions today.
- **Roadmap** — category → topic mapping: `async` topics surface `debounce`/
  `throttle`/`Promise.all`; `DOM` topics surface the UI component bank; roadmap
  weeks list "solve X problems in category Y" actions.
- **Admin pipeline** — the review inbox gains a **problem kind**: an admin can
  draft a CLI/function/UI problem (JSON spec + assertions), see auto-triage +
  duplicate detection against the bank, review, and publish. This is what makes
  the weekly-scraper / PDF-cleanup machinery able to feed *coding* content, not
  just Q&A.
- **Pro gating** — keep CLI free (first N/day); gate hints, solutions, and the UI
  mode's full bank behind Pro, matching the current paywall surface.

---

## 5. Phased delivery order

| Phase | Ship | Verifies |
|---|---|---|
| **P1 — Function mode** | `runFnTests` judge (JS/TS offline + Python via Wandbox), deep-equal helper, signature banner, 20 `jsFunctions.ts` problems, Playground mode tabs | unit tests for judge + helpers; all 20 problems pass their own hidden tests |
| **P2 — UI mode** | sandboxed iframe preview, HTML/CSS/JS panels, `runUiTests` assertion engine, 15 `uiComponents.ts` + 10 `cssChallenges.ts` | assertion harness tested with a correct + a broken solution per problem |
| **P3 — Growth + taxonomy** | algorithms 6 → 20, company tags, category filter/search, daily problem | bank self-tests (every problem's reference solution passes its own tests — the same trick already used for pools) |
| **P4 — Product wiring** | Drill + miss harvesting + Quality Center for coding, Roadmap category actions, admin problem publishing, Pro gating | flow tests, 2–3 new admin/quality tests |

**Not in scope (for now):** framework runners (React/Vue in the sandbox), real-time
pair judging, server-side code execution beyond Wandbox. The iframe judge is
deliberately dependency-free.

---

## 6. Why this wins

1. **The judge is the moat.** CLI-only is LeetCode's game; UI-mode judging done
   client-side in a free offline PWA is a position nobody holds.
2. **It fills the real market gap.** Frontend candidates currently must buy
   GreatFrontEnd ($) or use LeetCode's weak frontend support. We give the whole
   ladder — including the frontend formats — free.
3. **It compounds the existing engine.** Problems flow through the same
   harvest → review → publish → quality loop as Q&A, so the bank improves itself
   instead of rotting.
4. **Pro stays honest.** Function mode free, UI bank + solutions + hints gated —
   a clear upgrade path without paywalling the core.

*Suggested start: Phase 1 (function-mode judge + 20 problems). It's the smallest
change that proves the multi-mode model and is entirely offline-capable.*
