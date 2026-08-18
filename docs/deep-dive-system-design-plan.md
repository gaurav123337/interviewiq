# System Design Deep-Dives + Per-Module AI Models — Implementation Plan

> Goal: (1) AI-generate interview-grade **deep-dive study content for system design
> topics** and give users a clear path to land on each topic with the **AI tutor**
> enabled. (2) Let the owner wire a **different AI model per module** (some models
> explain better, some are better at RAG) while **defaulting to the configured
> provider** when a module has no override.

---

## Part 1 — System Design Deep-Dives (concept making + landing path)

### 1.1 Content shape — reuse the existing `DeepDive` model

`src/data/deepDive.ts` already defines the perfect shape for interview study content:

```ts
interface DeepDive {
  concepts: { name: string; blurb: string }[];   // mental-model building blocks
  points: string[];                               // what to mention in an interview
  traps: string[];                                // common mistakes
  qa: { q: string; a: string }[];                 // interview Q&A
  related: string[];                              // adjacent topics
}
```

**No new schema needed.** The AI generator authors to exactly this shape (validated by
the existing `validateProblem`-style gate, mirroring `docs/question-bank-expansion.md §4`).
The only addition is a **topic catalog** so the generator knows *what* to author.

### 1.2 Topic catalog — `src/data/systemDesignTopics.ts`

A curated, offline list of ~25 system-design topics (facts — no AI authorship), each with
a slug, title, and one-line blurb. Examples:

| Slug | Title |
|---|---|
| load-balancing | Load Balancing (L4/L7, algorithms, sticky sessions) |
| consistent-hashing | Consistent Hashing & Sharding |
| caching | Caching Layers (CDN, edge, in-memory, write policies) |
| database-indexing | Database Indexing & Query Planning |
| message-queues | Message Queues & Event-Driven Design |
| rate-limiting | Rate Limiting (token bucket, leaky bucket, distributed) |
| consensus | Distributed Consensus (Raft, Paxos, ZooKeeper) |
| replication | Replication & Failover (leader/follower, quorum) |
| observability | Observability (metrics, logs, traces, SLIs/SLOs) |

Each entry carries the canonical name used to compute the existing
`getDeepDive(topic)` normalization, so the deep-dive resolver works for both
curated and AI-authored topics with one lookup path.

### 1.3 Generation pipeline — a new workflow, following the problem-bank pattern

Model it on `.github/workflows/ai-problems.yml` + `scripts/ai-draft-problems.js`
(they already have the right machinery: strict-JSON parsing, corrective retry,
schema gate, PR flow, provider config via `scripts/ai-config.js`):

- **New script** `scripts/ai-draft-deepdives.js` (+ `ai-deepdive-lib.js` for pure,
  testable prompt/parse/gate functions — mirroring `ai-draft-lib.js`).
- **Flow per run** (`workflow_dispatch`, inputs: `topics` (comma-separated or "all"),
  `count`):
  1. Load the topic catalog; skip topics already in the emitted file.
  2. For each topic: prompt the AI to author a `DeepDive` in **strict JSON** with
     `concepts` (5–7), `points` (4–6), `traps` (3–4), `qa` (3–4 interview Q&A), `related`.
  3. **Gate** (no unverified content ships): schema validation (exact `DeepDive`
     shape, non-empty fields, `qa.a` length ≥ 40 chars), then a **quality gate**
     — a second AI pass rates the draft 1–10 on interview value; drafts < 7 are
     rejected or retried once with the low-score feedback (same corrective-retry
     loop the problem bank uses).
  4. Write survivors to `src/data/systemDesignDeepDives.ts` (AUTO-GENERATED header,
     same convention as `src/data/codingBank/aiGenerated.ts`), commit to a branch,
     open/update a review PR. **Owner merge is the publish gate.**
- **Provider + model**: resolved via `loadAiProviderConfig()` (Part 2 makes it
  module-aware — the deep-dive module gets its own model if wired).
- **Self-heal for free**: reuse the hardened fetch — 30s mirror cap, 2-min chat cap,
  429/5xx backoff (all shipped in the problem-bank work).

### 1.4 Landing path — "Deep Dive" surface with the AI tutor enabled

The app already renders deep-dives in `LearnModal` (Roadmap.tsx). Add a dedicated
**System Design Deep Dive** section so users land on topics deliberately:

- **Entry point**: a new nav destination (`Practice` dropdown or its own tab) —
  "🏗️ System Design Deep Dive". Non-authed guests see the curated topic catalog +
  offline content; signed-in users get the full experience.
- **Topic browser**: cards grouped by domain (Scaling & Load, Data & Storage,
  Distributed Systems, Reliability & Observability). Each card shows the blurb +
  "📖 Deep dive" and "🤖 AI tutor" buttons.
- **Deep-dive page** (`DeepDiveView.tsx`): renders the `DeepDive` sections
  (concepts → points → traps → Q&A accordion → related), exactly like LearnModal but
  full-page. Reuses `deepDiveCards()`-style helpers so Drill mode can ingest them too.
- **AI tutor enabled**: a persistent "Ask the AI tutor" panel on the page —
  - Seeds `CoachChat` in a new **`deepdive` mode**: system prompt = "You are a senior
    system-design interviewer teaching the topic X. Ground answers in the deep-dive
    below…" + the topic's `DeepDive` JSON as context (concepts/points/traps/qa).
  - Also runs `withGrounding()` so, once the deep-dive content is embedded into the
    RAG knowledge base, answers carry 📚 citations; before embedding, the inline
    context is the grounding source (no waiting on admin ingestion).
  - Quick-action chips per topic: "Walk me through the mental model", "Quiz me",
    "What are the traps?", "Compare with <related topic>".
- **Drill integration**: `deepDiveCards()` is topic-agnostic (keyed by normalized
  name) — add the new topics to its card set so they appear in Drill mode
  automatically.

### 1.5 Data flow summary

```
topic catalog (facts) + AI (module: deepdive) --gate--> src/data/systemDesignDeepDives.ts --PR--> main
                                                                                                  │
                                                            user opens Deep Dive tab (offline-first render)
                                                                                                  │
                                              DeepDiveView ──> Learn sections ──> Drill cards
                                                     └──> CoachChat mode=deepdive (grounded, citations)
```

---

## Part 2 — Per-Module AI Model Wiring (override with provider default)

### 2.1 Storage — extend `ai_provider_config` (no schema change)

The table is already `key text PK, value jsonb, updated_at bigint` (supabase/ai-provider.sql)
— a perfect fit. Add one row per module:

```
key = 'provider'              → { key, base, model }   // THE DEFAULT (current row)
key = 'module:deepdive'       → { key?, base?, model } // explainer-strong model
key = 'module:rag'            → { key?, base?, model } // retrieval/grounding-strong model
key = 'module:feedback'       → optional
key = 'module:hint'           → optional
key = 'module:coach'          → optional
```

Design decision: a module row is a **full override** (own key/base/model) — that lets
one module use a completely different provider. A row with only `model` set inherits
`key`+`base` from `provider` (the common case — same account, different model).
"Use default" = row absent (or empty value).

**Module registry** (single source of truth, shared by client + server):

```ts
// src/services/aiProvider.ts + scripts/ai-config.js keep the same list
export const AI_MODULES = {
  deepdive: { label: "System design deep-dives", hint: "best at explaining concepts" },
  rag:      { label: "RAG tutor & knowledge answers", hint: "best at grounded retrieval answers" },
  feedback: { label: "Interview feedback", hint: "strict, concise graders" },
  hint:     { label: "Hints", hint: "fast, cheap models" },
  coach:    { label: "AI coach chat", hint: "conversational" }
} as const;
```

### 2.2 Shared resolver (client + scripts + edge)

One resolution rule everywhere: **`module:<id>` row → `provider` row → env/local fallback**.

- **Client** (`src/services/aiProvider.ts`): add `resolveModuleModel(moduleId): Promise<{key,base,model,source}>` — reads `ai_provider_config` for `module:<id>` (via the
  admin-gated path or the new edge proxy), fills gaps from `provider`, falls back to
  the user's localStorage settings (`src/ai.ts` `getSettings()`) when not signed in.
- **Scripts** (`scripts/ai-config.js`): add `loadModuleModel(moduleId)` — same precedence
  via the Management API, so the deep-dive workflow can pick its own model while the
  cleaner keeps the default.
- **Edge** (`supabase/functions/_shared/`): a `moduleModel()` helper so functions that
  call AI server-side resolve the same way.

### 2.3 Server-side `ai-chat` edge function (the key architecture change)

Today the client `chat()` (src/ai.ts) sends the **user's own** localStorage key to the
provider. To honor "by default it uses the configured one", move app-AI calls behind a
thin server proxy:

- **New edge function** `supabase/functions/ai-chat/index.ts`:
  - POST `{ module?, messages, temperature?, maxTokens?, signal? }`.
  - Auth: signed-in user JWT (verified), **admin or any signed-in user** — the admin
    bills the provider; rate-limited per user (reuse the `limitRefresh`-style limiter).
  - Resolves `moduleModel(module)` (Part 2.2) → calls the provider → streams/returns
    the reply. **Keys never leave the server.**
  - BYOK escape hatch: a signed-in user who wants *their own* key still can — the
    function accepts an optional `userKey`/`userBase` (their localStorage settings) and
    prefers it when present. Guests keep the fully-offline curated engine (unchanged).
- **Client**: `chat(messages, { module, preferLocal })` — when signed in and no local
  key preference, call the `ai-chat` function; otherwise the existing direct path.
  `getFeedback`, `getHint`, CoachChat api-mode, and the new deep-dive tutor all pass
  `module` so they resolve the right model.

### 2.4 Admin UI — extend the AI pipeline card

Extend `AiPipelineCard` (Admin.tsx, currently one provider row) into a **provider
section + module list**:

- Existing "AI pipeline provider" = the `provider` default row (unchanged).
- Below it, one row per module in `AI_MODULES`: label + hint, current model (or
  "Using default: <provider model>"), a "Override model" input (blank = default),
  optional key/base inputs (blank = inherit), and a **🧪 Test** button per row
  (reuses `testAiProvider`).
- Save writes `module:<id>` rows (or deletes them when all blank → back to default).
- The card also shows a live "resolution preview" for each module
  ("resolves to model X via provider Y") so wiring is never guesswork.

### 2.5 Migration & compatibility

- **No schema change** (rows only). `supabase/ai-provider.sql` gets a comment update +
  seed rows for the module keys (empty values = default), idempotent.
- **Backwards compatible**: absent module rows resolve to `provider` — today's exact
  behavior. Scripts default to `provider`. Existing localStorage path untouched for
  guests/BYOK.
- `verify-secrets` / `secret-status` untouched (module rows are not credentials).

---

## Phasing

**P1 — Per-module wiring (foundation, ships first)**
1. `resolveModuleModel` in `src/services/aiProvider.ts` + `loadModuleModel` in
   `scripts/ai-config.js` + tests.
2. `ai-chat` edge function + `moduleModel` shared helper; deploy.
3. `chat(messages, { module })` client plumbing; CoachChat/feedback/hint pass their module.
4. Admin card module rows + save/test; typecheck + vitest + Deno tests; deploy.

**P2 — System-design deep-dive generation**
5. `src/data/systemDesignTopics.ts` catalog + `systemDesignDeepDives.ts` resolver glue.
6. `scripts/ai-deepdive-lib.js` (prompt/parse/gate + quality gate) + unit tests.
7. `scripts/ai-draft-deepdives.js` + `.github/workflows/deepdive-bank.yml` (manual
   dispatch; uses `module:deepdive` model). First authoring run → review PR → merge.
8. `DeepDiveView.tsx` + nav entry + Drill card wiring; AI tutor panel (mode=deepdive).

**P3 — Hardening & adoption**
9. Embed deep-dives into the RAG KB (admin "publish to knowledge base" action) so
   answers carry 📚 citations.
10. Paywall gating for AI deep-dive tutor (reuse `entitlements` quotas), events for
    the Quality center, and a "deep-dive coverage" report in Admin.

---

## Open decisions (flag before/while building)

1. **Billing model**: the `ai-chat` proxy bills the **admin's** provider key for all
   signed-in users. Confirm that's intended vs. BYOK-only for non-admins.
2. **Which modules ship first**: P1 wires all five; only `deepdive` + `rag` are
   actually consumed by new features — keep the other three wired but low-key.
3. **Generation model choice**: the deep-dive author benefits from a strong explainer
   model; once OpenRouter credits exist, `deepseek/deepseek-chat` is a good default,
   override-able per module via the new UI.
4. **Streaming**: the proxy can stream (SSE) for the tutor UX; defer if not needed.

## Files touched (map)

| Area | Files |
|---|---|
| Content | `src/data/systemDesignTopics.ts` (new), `src/data/systemDesignDeepDives.ts` (generated), `src/data/deepDive.ts` (resolver glue) |
| Generation | `scripts/ai-deepdive-lib.js`, `scripts/ai-draft-deepdives.js`, `.github/workflows/deepdive-bank.yml` |
| Landing | `src/components/DeepDiveView.tsx` (new), nav + `CoachChat.tsx` (deepdive mode), `src/services/drill.ts` |
| Models | `src/services/aiProvider.ts` (+`resolveModuleModel`), `scripts/ai-config.js` (+`loadModuleModel`), `supabase/functions/_shared/` (+`moduleModel`), `supabase/functions/ai-chat/index.ts` (new) |
| Admin | `src/components/Admin.tsx` (`AiPipelineCard` → module rows) |
| Tests | `src/__tests__/aiProvider.test.ts`, `src/__tests__/deepDive.test.ts` (extend), Deno tests for `_shared` |
