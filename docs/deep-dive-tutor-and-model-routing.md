# Deep Dive System Design Tutor + Per-Module AI Model Routing

*Status: proposed (not started). Companion docs: `skill-counselor.md`, `coding-gap-plan.md`, `enrichment-plan.md`.*

---

## 1. Problem Statement

Two capabilities are missing:

1. **System design deep dives lack depth.** The existing `src/data/deepDive.ts` has a single `SYSTEM_DESIGN` entry with 5 concepts, 5 points, 5 traps, and 2 Q&A pairs. Real system design interviews require **architecture case studies** (URL shortener, chat system, news feed), **component trade-off analysis** (CAP theorem, consistency models, sharding strategies), **diagram-level reasoning** (data flow, failure modes), and **follow-up deep dives** (why Kafka over RabbitMQ? what happens at 10x scale?). The current offline content can't support this depth, and the AI tutor (`src/services/tutor.ts`) treats all topics the same — there's no topic-specific tutoring strategy.

2. **All AI features use one model.** The entire app funnels through a single `chat()` call in `src/ai.ts` with one key/base/model. But different features have different needs:
   - **Explanations** (tutor): a model good at clear, structured prose (Claude, GPT-4o)
   - **RAG-grounded answers**: a model good at following strict grounding instructions
   - **Code review / coding playground**: a model good at code (Codestral, DeepSeek Coder)
   - **Embeddings**: already separated (`embeddingsModel` in remote config)
   - **Interview feedback**: a model good at concise, specific evaluation

   Users should be able to wire a specific model to a specific module. If they don't, it falls back to the global default from Settings.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  UI Components                   │
│  Roadmap · CoachChat · Playground · Settings     │
└────────┬──────────────┬────────────────┬────────┘
         │              │                │
         ▼              ▼                ▼
┌──────────────┐ ┌────────────┐  ┌──────────────┐
│  Module AI   │ │  Module AI │  │  Module AI   │
│  (tutor)     │ │  (feedback)│  │  (code)      │
└──────┬───────┘ └─────┬──────┘  └──────┬───────┘
       │               │                │
       ▼               ▼                ▼
┌─────────────────────────────────────────────────┐
│            Module AI Registry                    │
│  resolveModel(moduleId) → { key, base, model }  │
│  Falls back to global AISettings if not set      │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│            chat() + chatForModule()              │
│         src/ai.ts (single fetch entry)          │
└─────────────────────────────────────────────────┘
```

---

## 3. Per-Module AI Model Routing

### 3.1 Data model

```ts
// src/services/moduleModels.ts

/** Module identifiers for per-model routing. */
export type ModuleId =
  | "tutor"          // Roadmap topic explanations + follow-up chat
  | "coach"          // Interview question coaching (CoachChat)
  | "feedback"       // Post-answer generative feedback
  | "hint"           // One-shot hints
  | "code"           // Code playground assistance
  | "embeddings";    // RAG embedding generation (already in remote config)

/** Per-module model override — stored in localStorage. */
export interface ModuleModelOverride {
  key: string;       // API key (same provider or different)
  base: string;      // Base URL
  model: string;     // Model name
}

/** The full module-model config: per-module overrides + a global default. */
export interface ModuleModelConfig {
  /** Global fallback (mirrors the existing AISettings). */
  default: { key: string; base: string; model: string };
  /** Per-module overrides. Absent = use default. */
  overrides: Partial<Record<ModuleId, ModuleModelOverride>>;
}
```

### 3.2 Storage

New storage key in `src/services/storage.ts`:

```ts
moduleModels: "iq.moduleModels"   // ModuleModelConfig
```

### 3.3 Resolution logic

```ts
// src/services/moduleModels.ts

import { STORAGE_KEYS, storageGet, storageSet } from "./storage";
import { getSettings, type AISettings } from "../ai";

const MODULE_KEY = STORAGE_KEYS.moduleModels;

/** Read the stored module-model config. */
export function getModuleModelConfig(): ModuleModelConfig {
  return storageGet<ModuleModelConfig>(MODULE_KEY, {
    default: getSettings(),
    overrides: {}
  });
}

/** Save the module-model config. */
export function saveModuleModelConfig(cfg: ModuleModelConfig): void {
  storageSet(MODULE_KEY, cfg);
}

/**
 * Resolve the effective AI settings for a given module.
 * Priority: module override → global default → hardcoded fallback.
 */
export function resolveModuleModel(moduleId: ModuleId): AISettings {
  const cfg = getModuleModelConfig();
  const override = cfg.overrides[moduleId];
  if (override && override.key) {
    return {
      key: override.key,
      base: override.base || "https://api.openai.com/v1",
      model: override.model || cfg.default.model || "gpt-4o-mini"
    };
  }
  return cfg.default.key ? cfg.default : getSettings();
}

/** Clear a specific module override (revert to default). */
export function clearModuleModel(moduleId: ModuleId): void {
  const cfg = getModuleModelConfig();
  delete cfg.overrides[moduleId];
  saveModuleModelConfig(cfg);
}

/** Set a specific module override. */
export function setModuleModel(moduleId: ModuleId, override: ModuleModelOverride): void {
  const cfg = getModuleModelConfig();
  cfg.overrides[moduleId] = override;
  saveModuleModelConfig(cfg);
}

/** List which modules have overrides (for the Settings UI). */
export function listModuleOverrides(): { moduleId: ModuleId; model: string; base: string }[] {
  const cfg = getModuleModelConfig();
  return (Object.entries(cfg.overrides) as [ModuleId, ModuleModelOverride][])
    .filter(([, v]) => !!v.key)
    .map(([id, v]) => ({ moduleId: id, model: v.model, base: v.base }));
}
```

### 3.4 Updated `src/ai.ts`

Add a module-aware chat entry point alongside the existing `chat()`:

```ts
// Add to src/ai.ts

import { resolveModuleModel, type ModuleId } from "./services/moduleModels";

/**
 * Module-aware chat — resolves the AI settings for the given module,
 * then makes the same OpenAI-compatible request.
 * Falls back to the global settings when no module override exists.
 */
export async function chatForModule(
  moduleId: ModuleId,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}
): Promise<string> {
  const s = resolveModuleModel(moduleId);
  // ... same fetch logic as chat(), but using the resolved settings
}
```

The existing `chat()` function stays unchanged for backward compatibility. New code calls `chatForModule(moduleId, ...)`, and callers migrate one at a time.

### 3.5 Module → model recommendations

A reference table so users understand what each module needs:

```ts
export const MODULE_RECOMMENDATIONS: Record<ModuleId, { label: string; why: string; suggested?: string }> = {
  tutor:       { label: "Tutor / Explanations", why: "Needs clear, structured prose and patient explanations.", suggested: "claude-3.5-sonnet" },
  coach:       { label: "Interview Coach", why: "Needs concise, specific feedback with good judgment.", suggested: "gpt-4o" },
  feedback:    { label: "Post-Answer Feedback", why: "Needs brief, actionable evaluation.", suggested: "gpt-4o-mini" },
  hint:        { label: "Hints", why: "Needs one short, targeted hint.", suggested: "gpt-4o-mini" },
  code:        { label: "Code Assistant", why: "Needs strong code generation and explanation.", suggested: "codestral-latest" },
  embeddings:  { label: "Embeddings", why: "Must return 1536-dim vectors for pgvector.", suggested: "text-embedding-3-small" }
};
```

### 3.6 Settings UI

A new section in `src/components/Settings.tsx` — "AI Models per Feature":

```
┌──────────────────────────────────────────────┐
│ 🧩 AI Models per Feature                     │
│                                              │
│ Each feature can use a different model.      │
│ Leave empty to use the global default.       │
│                                              │
│ Tutor / Explanations  [claude-3.5-sonnet]  ✕ │
│ Interview Coach       [Use default]          │
│ Post-Answer Feedback  [Use default]          │
│ Hints                 [Use default]          │
│ Code Assistant        [codestral-latest]   ✕ │
│ Embeddings            [text-embedding-3-small]│
│                                              │
│ 💡 Tip: Use a strong model for tutoring and  │
│    a fast model for hints to save costs.     │
└──────────────────────────────────────────────┘
```

Each row: a dropdown of common models, a "Custom" option that opens key/base/model fields, and a ✕ to clear (revert to default). The existing global AI settings (key/base/model in Settings) become the "Global Default" section above this.

---

## 4. Deep Dive System Design — Content + AI Tutor

### 4.1 Expand `src/data/deepDive.ts` — System Design case studies

The current `SYSTEM_DESIGN` entry gets an `architectures` field:

```ts
export interface DeepDiveArchitecture {
  name: string;
  blurb: string;
  components: string[];           // "Load Balancer → API Gateway → Service → DB"
  tradeoffs: string[];            // ["Sync vs async for writes", "Push vs pull fan-out"]
  scaleNotes: string;             // "Handles ~10k RPS with 3 app replicas + 2 read replicas"
  failureModes: string[];         // ["DB down → read replicas serve stale", "LB down → DNS failover"]
  followUpQa: DeepDiveQa[];       // deeper follow-up Q&A pairs
}

export interface DeepDive {
  concepts: DeepDiveConcept[];
  points: string[];
  traps: string[];
  qa: DeepDiveQa[];
  related: string[];
  /** NEW — architecture case studies for system design topics. */
  architectures?: DeepDiveArchitecture[];
}
```

New authored case studies for system design:

```ts
const SYSTEM_DESIGN: DeepDive = {
  // ... existing concepts, points, traps, qa ...
  architectures: [
    {
      name: "URL Shortener (like bit.ly)",
      blurb: "A write-light, read-heavy service — the classic system design starter.",
      components: [
        "Client → Load Balancer → API Service → ID Generator → Key-Value Store",
        "Read path: Client → LB → API → Cache (Redis) → DB (fallback)"
      ],
      tradeoffs: [
        "Counter-based IDs (sequential, predictable) vs hash-based IDs (random, collision risk)",
        "301 redirect (cached, faster) vs 302 redirect (trackable, analytics)",
        "Single DB vs sharded — sharding adds complexity but handles write growth",
        "Cache-everything vs cache-hot-URLs — memory cost vs hit rate"
      ],
      scaleNotes: "100M URLs/day write → ~1.2K writes/sec (easy single DB). 10B reads/day → ~115K reads/sec → cache + read replicas.",
      failureModes: [
        "ID generator exhaustion → use wider ID space or switch to hash",
        "Cache stampede on viral URL → cache-aside with TTL jitter",
        "DB write failure → queue writes, serve stale from cache temporarily"
      ],
      followUpQa: [
        { q: "How would you add analytics (click tracking)?", a: "Async write path: after the redirect, fire an event to Kafka/SQS. Analytics service consumes, writes to an analytics DB (columnar, e.g. ClickHouse or BigQuery). Don't block the redirect on analytics — eventual consistency is fine for counts." },
        { q: "How do you prevent abuse (spam URL generation)?", a: "Rate limiting per API key/IP (token bucket in Redis). CAPTCHA for anonymous users. URL allowlist/blocklist (check against a known-bad domain list before creating). Quotas per tier." }
      ]
    },
    {
      name: "Chat System (like WhatsApp / Slack)",
      blurb: "Real-time bidirectional messaging with presence, delivery guarantees, and group support.",
      components: [
        "Client ← WebSocket → Gateway Service → Message Router → Message Store (DB)",
        "Presence Service ← Heartbeat → Client (tracks online/offline/last-seen)",
        "Push Notification Service ← Event → APNs / FCM (for offline recipients)"
      ],
      tradeoffs: [
        "WebSocket (stateful, low-latency) vs long-polling (simpler, higher latency)",
        "Fan-out on write (pre-compute timelines, fast reads) vs fan-out on read (light writes, slow reads for large groups)",
        "Exactly-once delivery (complex, slow) vs at-least-once + idempotent consumers (practical)",
        "Single chat DB vs partitioned by conversation ID"
      ],
      scaleNotes: "WhatsApp: ~100B messages/day. Each message = 1 write + N reads (group size). Gateway handles 1M concurrent WebSocket connections per server (epoll).",
      failureModes: [
        "WebSocket disconnect → reconnect with sequence number, replay missed messages",
        "Message store down → queue at gateway, drain on recovery",
        "Push notification failure → retry with exponential backoff, fallback to SMS"
      ],
      followUpQa: [
        { q: "How do you handle message ordering?", a: "Use a monotonically increasing sequence number per conversation (assigned by the server, not the client). Clients buffer out-of-order messages and present in order. For distributed systems, use a logical clock (Lamport timestamp) or partition-by-conversation so ordering is per-partition." },
        { q: "How do you implement end-to-end encryption?", a: "Signal Protocol (Double Ratchet + X3DH key agreement). Each device generates a key pair; the server stores public keys only. Messages are encrypted client-side with the recipient's public key. The server relays ciphertext — it can't read message content. Group encryption uses sender keys." }
      ]
    },
    {
      name: "News Feed / Social Feed (like Twitter / Instagram)",
      blurb: "The push-vs-pull trade-off — the defining architecture decision.",
      components: [
        "Write path: Client → Post Service → Fan-out Service → Timeline Cache (per-user)",
        "Read path: Client → Feed Service → Timeline Cache (Redis sorted sets by timestamp)",
        "Pull fallback: Feed Service → Post Storage (for users with >N followers)"
      ],
      tradeoffs: [
        "Fan-out on publish (push): fast reads, heavy writes — OK for most users, expensive for celebrities",
        "Fan-out on read (pull): light writes, slow reads — OK for celebrities, slow for everyone else",
        "Hybrid (Twitter's actual approach): push for normal users, pull for celebrities",
        "Timeline cache size: store full timeline vs store post IDs + hydrate on read"
      ],
      scaleNotes: "Twitter: ~500M tweets/day, ~350B timeline reads/day. Celebrity tweet = 50M followers × fan-out = impossible to push → must pull for high-follower accounts.",
      failureModes: [
        "Fan-out delay → user sees stale feed → accept eventual consistency (up to 30s delay is normal)",
        "Celebrity tweet storm → fan-out queue backs up → prioritize, serve from pull path",
        "Cache eviction on cold users → pull path activates, slightly slower first load"
      ],
      followUpQa: [
        { q: "How do you handle the celebrity problem (fan-out to millions)?", a: "Don't fan-out for accounts with >N followers (threshold tuned per system — Twitter uses ~500 followers). Instead, on read: merge the user's pre-computed timeline (from normal-user pushes) with real-time pulls for celebrity accounts they follow. The merge is a k-way merge on timestamp, bounded by timeline page size." },
        { q: "How do you implement 'recent' vs 'relevant' ranking?", a: "Two layers: a candidate generation layer (the timeline cache gives recent posts) and a ranking layer (ML model scores each candidate by predicted engagement). The ranking model uses features: user's historical engagement with the author, post type affinity, recency decay, and virality signals. A/B test the ranking function." }
      ]
    }
  ]
};
```

### 4.2 New `src/services/systemDesignTutor.ts`

A topic-specific AI tutor strategy for system design topics:

```ts
/* System Design deep-dive tutor — topic-specific tutoring strategy.
   Unlike the generic tutor (tutor.ts), this module:
   1. Detects when the topic is a system design case study
   2. Uses a specialized system prompt with diagram reasoning
   3. Supports "draw me an architecture" and "compare approaches" intents
   4. Grounds in the curated architecture data from deepDive.ts
   5. Uses the tutor module's AI model (per-module routing) */

import { chatForModule } from "../ai";
import type { CareerGoal } from "../types";
import { fieldById, levelById } from "../data";
import { getDeepDive, type DeepDiveArchitecture } from "../data/deepDive";
import { withGrounding, type Citation } from "./rag";

/** Detect if a topic label maps to a system design case study. */
export function isSystemDesignTopic(label: string): boolean {
  const dd = getDeepDive(label);
  return !!(dd as any).architectures?.length ||
    /system design|distributed|scale|architecture/i.test(label);
}

/** Get architecture case studies for a topic, if any. */
export function getArchitectures(label: string): DeepDiveArchitecture[] {
  const dd = getDeepDive(label);
  return (dd as any).architectures ?? [];
}

/** System-design-specific system prompt. */
function systemDesignPrompt(
  topic: string,
  levelName: string,
  fieldName: string,
  architectures: DeepDiveArchitecture[]
): string {
  const archBlock = architectures.length
    ? `\n\nKnown architectures for this topic:\n` + architectures.map(a =>
      `${a.name}: ${a.blurb}\n  Components: ${a.components.join(" → ")}\n  Tradeoffs: ${a.tradeoffs.join("; ")}\n  Scale: ${a.scaleNotes}\n  Failures: ${a.failureModes.join("; ")}`
    ).join("\n\n")
    : "";

  return (
    `You are a senior systems architect teaching system design for a ${levelName} ${fieldName} interview. ` +
    `Topic: "${topic}".\n\n` +
    `Teaching strategy for system design:\n` +
    `1. Always start with requirements: functional + non-functional + scale estimates.\n` +
    `2. Build up the architecture step by step: start simple, add components only when needed.\n` +
    `3. For every design decision, name the trade-off explicitly (cost vs latency, consistency vs availability).\n` +
    `4. Walk through failure modes: what breaks, how the system handles it.\n` +
    `5. Mention real-world scale numbers when possible.\n` +
    `6. Use plain ASCII diagrams when explaining component relationships.\n\n` +
    `At ${levelName} level, expect the candidate to: ${levelSystemExpectations(levelName)}\n\n` +
    `Tie everything back to how they'd explain it in a 45-minute whiteboard interview.${archBlock}`
  );
}

function levelSystemExpectations(level: string): string {
  switch (level.toLowerCase()) {
    case "junior": return "know what a load balancer, cache, and database do; explain basic client-server flow";
    case "mid": return "design a simple end-to-end system; identify 2-3 trade-offs; estimate basic throughput";
    case "senior": return "design a distributed system with caching, async processing, and failure handling; discuss CAP theorem trade-offs concretely";
    case "staff": return "design for millions of users; discuss data partitioning, replication strategies, and operational concerns (monitoring, rollback, incident response)";
    case "principal":
    case "cto":
    case "ceo": return "make org-wide architectural decisions; discuss build-vs-buy, vendor lock-in, technical debt, and long-term platform evolution";
    default: return "demonstrate solid systems thinking with concrete trade-offs";
  }
}

/** Explain a system design topic with architecture-aware grounding. */
export async function explainSystemDesign(
  topic: string,
  goal: CareerGoal
): Promise<string> {
  const field = fieldById(goal.fieldId);
  const lvl = levelById(goal.targetLevel);
  const architectures = getArchitectures(topic);

  const sys = systemDesignPrompt(topic, lvl.name, field?.name ?? "", architectures);

  const usr =
    `Teach the system design topic "${topic}" for a ${lvl.name} ${field?.name ?? ""} interview.\n` +
    `Include:\n` +
    `1) What the system does and why it's a classic interview topic.\n` +
    `2) A step-by-step architecture walkthrough (start simple, add complexity).\n` +
    `3) The 3 most important trade-offs and why you'd choose one side.\n` +
    `4) Common failure modes and how to handle them.\n` +
    `5) A 2-minute whiteboard explanation skeleton.\n` +
    (architectures.length
      ? `\nUse the known architecture data above as reference — expand on the components and tradeoffs.`
      : `\nIf this is a known pattern (URL shortener, chat, feed, etc.), include a concrete architecture walkthrough.`);

  const { sys: sysGrounded } = await withGrounding(sys, topic, {
    field: goal.fieldId,
    level: goal.targetLevel
  });

  return chatForModule("tutor", [
    { role: "system", content: sysGrounded },
    { role: "user", content: usr }
  ], { maxTokens: 800 });
}

/** Continue a system-design-specific tutor conversation. */
export async function systemDesignChat(
  topic: string,
  goal: CareerGoal,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<{ text: string; citations: Citation[]; grounded: boolean; checked: boolean }> {
  const field = fieldById(goal.fieldId);
  const lvl = levelById(goal.targetLevel);
  const architectures = getArchitectures(topic);

  const sys = systemDesignPrompt(topic, lvl.name, field?.name ?? "", architectures);

  const lastUser = [...history].reverse().find(m => m.role === "user")?.content ?? "";

  const { sys: sysGrounded, citations, grounded, checked } = await withGrounding(sys, lastUser || topic, {
    field: goal.fieldId,
    level: goal.targetLevel
  });

  const msgs = [
    { role: "system" as const, content: sysGrounded },
    ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
  ];

  const text = await chatForModule("tutor", msgs, { maxTokens: 600 });
  return { text, citations, grounded, checked };
}
```

### 4.3 Wire into the Roadmap Learn modal

In `src/components/Roadmap.tsx`, the `onExplain` and `onAsk` handlers detect system design topics and route to the specialized tutor:

```ts
// In Roadmap.tsx — modify onExplain and onAsk

import { isSystemDesignTopic, explainSystemDesign, systemDesignChat } from "../services/systemDesignTutor";

const onExplain = async () => {
  if (!learn || !goal) return;
  setAiLoading(true);
  try {
    let reply: string;
    if (isSystemDesignTopic(learn.label)) {
      reply = await explainSystemDesign(learn.label, goal);
    } else {
      reply = await explainTopic(learn.label, goal);
    }
    setAi(reply);
    appendChat(learn.id, { role: "assistant", content: reply });
  } catch (e) {
    toast("✗ " + ((e as Error).message || "AI unavailable"));
    setAi(null);
  } finally { setAiLoading(false); }
};

const onAsk = async (t: RoadmapTopic, text: string) => {
  if (!goal) return;
  const history = chat.get(t.id) ?? [];
  const userMsg: TutorMsg = { role: "user", content: text };
  appendChat(t.id, userMsg);
  setChatBusy(true);
  try {
    let reply;
    if (isSystemDesignTopic(t.label)) {
      reply = await systemDesignChat(t.label, goal, [...history, userMsg]);
    } else {
      reply = await tutorChat(t.label, goal, [...history, userMsg]);
    }
    appendChat(t.id, {
      role: "assistant",
      content: reply.text,
      citations: reply.citations,
      grounded: reply.grounded,
      checked: reply.checked
    });
  } catch (e) {
    toast("✗ " + ((e as Error).message || "AI unavailable"));
  } finally { setChatBusy(false); }
};
```

### 4.4 New architecture UI in the Learn modal

The `LearnModal` component in `Roadmap.tsx` gains an architecture section:

```tsx
{/* Architecture case studies (system design topics only) */}
{dd.architectures && dd.architectures.length > 0 && (
  <div className="mb-4">
    <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-acc3">
      🏗️ Architecture Case Studies
    </div>
    <div className="space-y-3">
      {dd.architectures.map(arch => (
        <details key={arch.name} className="group rounded-xl border border-line/15 bg-wht/5">
          <summary className="cursor-pointer px-4 py-3 text-[13.5px] font-bold text-acctxt">
            {arch.name}
          </summary>
          <div className="border-t border-line/10 px-4 py-3 space-y-3">
            <p className="text-[13px] text-ink leading-relaxed">{arch.blurb}</p>

            {/* Components */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Components</div>
              {arch.components.map((c, i) => (
                <div key={i} className="mt-1 font-mono text-[12px] text-fnt bg-deep/50 rounded-lg px-3 py-2">
                  {c}
                </div>
              ))}
            </div>

            {/* Trade-offs */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-warn">⚖️ Trade-offs</div>
              <ul className="mt-1 space-y-1">
                {arch.tradeoffs.map((t, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px]">
                    <span className="flex-none text-warn">•</span><span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Scale */}
            <div className="rounded-lg border border-acc1/25 bg-acc1/10 px-3 py-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-acc3">📐 Scale Notes</div>
              <p className="mt-1 text-[12.5px] text-ink">{arch.scaleNotes}</p>
            </div>

            {/* Failure Modes */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-bad">💥 Failure Modes</div>
              <ul className="mt-1 space-y-1">
                {arch.failureModes.map((f, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px]">
                    <span className="flex-none text-bad">•</span><span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Follow-up Q&A */}
            {arch.followUpQa.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-acc3">🎯 Follow-up Questions</div>
                <div className="mt-1 space-y-2">
                  {arch.followUpQa.map((qa, i) => (
                    <details key={i} className="group rounded-lg border border-line/15 bg-deep/50">
                      <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-bold text-acctxt">
                        Q{i + 1}. {qa.q}
                      </summary>
                      <div className="border-t border-line/10 px-3 py-2 text-[12px] leading-relaxed text-mut">
                        {qa.a}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  </div>
)}
```

---

## 5. Remote Config Extension

Add module model overrides to the admin-pushed remote config:

```ts
// In src/services/remoteConfig.ts — extend RemoteConfig

export interface RemoteConfig {
  // ... existing fields ...
  ai: {
    enabled?: boolean;
    model?: string;
    embeddingsModel?: string;
    maxTokens?: number;
    temperature?: number;
    /** NEW — admin-pushed per-module model defaults (user overrides take precedence). */
    moduleDefaults?: Partial<Record<ModuleId, { model?: string; base?: string }>>;
  };
}
```

Resolution priority chain:
1. **User override** (localStorage `iq.moduleModels`)
2. **Admin-pushed module default** (remote config `ai.moduleDefaults[moduleId]`)
3. **Global user default** (localStorage `iq.apiModel` / `iq.apiKey`)
4. **Hardcoded fallback** (`gpt-4o-mini`)

---

## 6. Additional System Design Content

### 6.1 Expand the concept families in `src/coach/concepts.ts`

Add new concept families for system design:

```ts
// Add to FAMILIES in concepts.ts
"architecture": ["architecture", "architectural", "system design", "high-level design", "component diagram", "data flow"],
"cap-theorem": ["cap theorem", "consistency", "availability", "partition tolerance", "pacelc"],
"sharding": ["sharding", "shard", "partitioning", "partition", "hash ring", "consistent hashing", "range partitioning"],
"replication": ["replication", "replica", "leader", "follower", "master", "slave", "quorum", "raft", "paxos"],
"message-queue": ["kafka", "rabbitmq", "sqs", "pub-sub", "event-driven", "event sourcing", "cqrs"],
"load-balancing": ["load balancer", "load balancing", "round robin", "least connections", "consistent hashing", "cdn"],
"circuit-breaker": ["circuit breaker", "bulkhead", "timeout", "retry", "backoff", "fallback", "graceful degradation"],
"microservices": ["microservices", "service mesh", "api gateway", "service discovery", "sidecar", "istio"],
"containerization": ["docker", "kubernetes", "k8s", "container", "orchestration", "pod", "deployment"],
"observability": ["tracing", "distributed tracing", "jaeger", "zipkin", "open telemetry", "otel", "prometheus", "grafana"],
```

### 6.2 New `src/data/systemDesignBank.ts` — curated case studies

A dedicated file for system design case studies that feeds both the deep dive content and the drill mode:

```ts
export interface SystemDesignCase {
  id: string;
  name: string;
  difficulty: 1 | 2 | 3;
  /** The 45-minute whiteboard flow. */
  steps: {
    phase: string;          // "Requirements" | "High-level" | "Deep dive" | "Scaling" | "Failure modes"
    talkingPoints: string[];
    timeMinutes: number;
  }[];
  /** Common follow-up questions interviewers ask. */
  followUps: { q: string; a: string; depth: "quick" | "deep" }[];
  /** Key numbers to memorize. */
  numbers: { label: string; value: string }[];
  relatedTopics: string[];
}

export const SYSTEM_DESIGN_BANK: SystemDesignCase[] = [
  {
    id: "url-shortener",
    name: "Design a URL Shortener",
    difficulty: 1,
    steps: [
      { phase: "Requirements", talkingPoints: ["Create short URLs from long URLs", "Redirect short → long", "Custom aliases (optional)", "Expiry (optional)", "Analytics (click count, geography)"], timeMinutes: 5 },
      { phase: "Scale estimates", talkingPoints: ["100M URLs/day written → ~1.2K writes/s", "10B redirects/day → ~115K reads/s", "Read:write ratio = 100:1", "Each URL ~500 bytes → 50GB/year storage"], timeMinutes: 5 },
      { phase: "High-level", talkingPoints: ["API Service → ID Generator → Key-Value Store", "Cache layer (Redis) for hot URLs", "301 (permanent, cached) vs 302 (trackable)"], timeMinutes: 10 },
      { phase: "Deep dive", talkingPoints: ["ID generation: counter vs hash vs Snowflake", "DB choice: KV store (DynamoDB) vs relational (Postgres)", "Cache strategy: LRU with TTL", "Collision handling for hash-based IDs"], timeMinutes: 15 },
      { phase: "Scaling", talkingPoints: ["Shard by URL hash (consistent hashing)", "Read replicas for read-heavy workload", "CDN for static redirect responses", "Rate limiting (token bucket in Redis)"], timeMinutes: 5 },
      { phase: "Failure modes", talkingPoints: ["ID generator down → standby with wider ID space", "DB slow → serve from cache, queue writes", "Cache stampede → TTL jitter + singleflight"], timeMinutes: 5 }
    ],
    followUps: [
      { q: "How do you handle analytics without slowing down redirects?", a: "Fire-and-forget event to Kafka after redirect. Analytics consumer writes to a columnar store (ClickHouse). Redirect latency is unaffected.", depth: "quick" },
      { q: "What if a URL goes viral?", a: "Cache hit rate stays high (hot URLs in Redis). If cache misses spike, the read path hits DB replicas. Write path is unaffected (1 write per URL regardless of traffic).", depth: "quick" },
      { q: "How do you prevent abuse?", a: "Rate limiting per API key/IP. CAPTCHA for anonymous. URL allowlist/blocklist. Quotas per tier. Honeypot URLs for bot detection.", depth: "deep" }
    ],
    numbers: [
      { label: "Write throughput", value: "~1.2K/s (100M/day)" },
      { label: "Read throughput", value: "~115K/s (10B/day)" },
      { label: "Storage per year", value: "~50GB (100M × 500B)" },
      { label: "Cache hit target", value: ">95% (80/20 rule)" }
    ],
    relatedTopics: ["databases & caching", "apis & services", "distributed systems"]
  },
  // ... additional cases: chat-system, news-feed, rate-limiter, notification-system, search-autocomplete
];
```

---

## 7. Phased Delivery

| Phase | What ships | Verifies |
|-------|-----------|----------|
| **P0 — Per-module model routing** | `src/services/moduleModels.ts`, `chatForModule()` in `ai.ts`, storage key, resolution logic | Unit tests for resolution priority chain (override → remote config → global → fallback) |
| **P1 — Module model settings UI** | New section in `Settings.tsx`, module override CRUD, "Clear to default" per row | Visual: override one module, verify the resolved model in console; clear and verify fallback |
| **P2 — System design content** | Expanded `SYSTEM_DESIGN` in `deepDive.ts` with `architectures` field, `systemDesignBank.ts` | All case studies render correctly in the Learn modal; drill cards generate from case study Q&A |
| **P3 — System design tutor** | `src/services/systemDesignTutor.ts`, routing in `Roadmap.tsx` | E2E: open a system design topic → "Explain it to me" → get architecture-aware response with components, tradeoffs, failure modes |
| **P4 — Architecture UI** | Architecture section in `LearnModal`, ASCII component diagrams, trade-off cards | Visual: architecture cards render with all sub-sections; follow-up Q&A expands correctly |
| **P5 — Remote config module defaults** | Admin-pushed `ai.moduleDefaults` in remote config, priority chain integration | Admin sets a module default → user without override sees it; user with override keeps theirs |
| **P6 — Concept family expansion** | New families in `concepts.ts` for system design vocabulary | Retrieval tests: "sharding" matches "consistent hashing", "CAP theorem" matches "availability" |

---

## 8. Testing Strategy

### Unit tests

```ts
// src/__tests__/module-models.test.ts
describe("resolveModuleModel", () => {
  it("returns module override when set", () => { /* ... */ });
  it("falls back to global default when no override", () => { /* ... */ });
  it("falls back to hardcoded when no global", () => { /* ... */ });
  it("clearModuleModel reverts to default", () => { /* ... */ });
  it("setModuleModel persists correctly", () => { /* ... */ });
});

// src/__tests__/system-design-tutor.test.ts
describe("isSystemDesignTopic", () => {
  it("detects 'URL Shortener' as system design", () => { /* ... */ });
  it("detects 'distributed systems' topics", () => { /* ... */ });
  it("does not flag 'JavaScript basics'", () => { /* ... */ });
});

describe("getArchitectures", () => {
  it("returns architectures for known case studies", () => { /* ... */ });
  it("returns empty for generic topics", () => { /* ... */ });
});
```

### Integration tests

- Verify `chatForModule("tutor", ...)` uses the resolved model from localStorage
- Verify the Learn modal renders architecture sections for system design topics
- Verify the Settings UI persists and clears module overrides

### Existing gates

- `npm run typecheck` — no new type errors
- `npm test` — all existing tests pass
- `npm run build` — production build succeeds

---

## 9. Migration / Backward Compatibility

- The existing `chat()` function in `src/ai.ts` is **not removed** — it continues to work for all callers that haven't migrated. `chatForModule()` is additive.
- The existing global AI settings (Settings → API Key / Base / Model) become the "Global Default" section. No change in behavior for users who don't touch the new per-module section.
- The `SYSTEM_DESIGN` entry in `deepDive.ts` gains an optional `architectures` field — existing code that reads `concepts`, `points`, `traps`, `qa`, `related` is unaffected.
- Storage key `iq.moduleModels` is new — no conflict with existing keys.

---

## 10. Open Questions

1. **Model cost visibility** — should the Settings UI show estimated cost per model per module? (e.g., "Claude Sonnet: ~$0.003/explanation") — helpful for users choosing between models, but requires pricing data that changes.
2. **Auto-detection of best model** — should the app auto-test a user's configured key against `/models` and suggest the best model per module based on what's available? (e.g., if they have a Mistral key, suggest Codestral for code)
3. **System design diagram rendering** — ASCII diagrams in the tutor response are good for text, but should we add optional Mermaid diagram rendering in the Learn modal? (Adds a dependency but makes architectures much clearer)
4. **Scope of system design bank** — start with 5 classic cases (URL shortener, chat, news feed, rate limiter, notification system) or go to 15+ immediately? Recommend 5 for P2, expand based on user demand.
5. **Streaming responses** — the current `chat()` waits for the full response. For the tutor (which produces 600-800 token responses), streaming would improve perceived latency. Worth adding in P3? (Requires SSE support in the fetch logic)
6. **Per-module rate limiting** — if a user sets a strong (expensive) model for tutor and a cheap one for hints, should we apply different rate limits? Currently all modules share the same `aiCallsLeft()` counter.
