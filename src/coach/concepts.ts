/* Concept-aware language layer for the offline coach + the session grader.
   Pure functions, no imports (kept dependency-free so the scoring engine can
   use them without cycles).

   Why this exists: keyword matching fails on synonyms — "I'll use a router"
   never matches a key point like "URL as the source of truth" even though a
   human sees the same idea. This module maps interview vocabulary onto
   concept families ("router", "navigation", "deep-link", "url" → routing),
   so matching is concept-aware instead of literal. */

/* ------------------------------------------------------------------ */
/* Tokenization + light stemming                                       */
/* ------------------------------------------------------------------ */

const STOP = new Set(
  ("a an the and or but if of to in on at for with from by as is are was were be been being it its this that these those do does did done has have had i you he she we they them their your my our his her not no can could will would should may might must shall than then so such there here what which who whom when where why how all any both each few more most other some only own same very just about into over under up out off above below again once also too keep let make made using use used want would go get got put take takes going things thing way ways one two new good bad much many come comes going s t re ve").split(" ")
);

/** Lowercases, strips punctuation, filters stopwords, keeps short stems.
    Splits on whitespace only — hyphenated compounds ("event-loop", "big-o")
    stay whole so the normalized phrase vocabulary can match them. */
export function tokenize(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));
}

/** Light suffix stemming so "caching"/"cached"/"cache" collapse together. */
export function stem(w: string): string {
  return w.length > 6 && w.endsWith("ing") ? w.slice(0, -3)
    : w.length > 5 && w.endsWith("ed") ? w.slice(0, -2)
    : w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y"
    : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1)
    : w;
}

/** Significant tokens: stemmed, stopword-free, meaningful length. */
export function sigTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of tokenize(text)) {
    const s = stem(w);
    if (s.length > 3 && !/^\d+$/.test(s)) out.add(s);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Concept families                                                    */
/* ------------------------------------------------------------------ */

/* Multi-word phrases are normalized to single tokens before family matching. */
const PHRASES: [string, string][] = [
  ["deep linking", "deep-link"], ["deep link", "deep-link"],
  ["big o", "big-o"], ["time complexity", "time-complexity"], ["space complexity", "space-complexity"],
  ["call stack", "call-stack"], ["task queue", "task-queue"], ["event loop", "event-loop"], ["async await", "async-await"],
  ["state management", "state-management"], ["global state", "global-state"], ["lifting state", "lifting-state"],
  ["virtual dom", "virtual-dom"], ["re render", "re-render"], ["dependency array", "dependency-array"],
  ["screen reader", "screen-reader"], ["keyboard navigation", "keyboard-navigation"],
  ["semantic html", "semantic-html"], ["focus management", "focus-management"], ["reduced motion", "reduced-motion"],
  ["responsive design", "responsive-design"], ["mobile first", "mobile-first"], ["fluid layout", "fluid-layout"],
  ["type system", "type-system"], ["static typing", "static-typing"], ["type inference", "type-inference"], ["union types", "union-types"],
  ["lexical scope", "lexical-scope"], ["lexical scoping", "lexical-scope"],
  ["pure function", "pure-function"], ["pure functions", "pure-function"],
  ["design pattern", "design-pattern"], ["design patterns", "design-pattern"],
  ["strategy pattern", "strategy-pattern"], ["observer pattern", "observer-pattern"],
  ["status code", "status-code"], ["status codes", "status-code"],
  ["real time", "real-time"], ["server sent events", "sse"],
  ["memory leak", "memory-leak"], ["memory leaks", "memory-leak"], ["garbage collection", "garbage-collection"],
  ["race condition", "race-condition"], ["race conditions", "race-condition"],
  ["linked list", "linked-list"], ["linked lists", "linked-list"],
  ["hash map", "hash-map"], ["hash maps", "hash-map"], ["hash table", "hash-table"], ["hash tables", "hash-table"],
  ["binary search", "binary-search"], ["sliding window", "sliding-window"], ["brute force", "brute-force"],
  ["divide and conquer", "divide-and-conquer"], ["dynamic programming", "dynamic-programming"],
  ["two pointers", "two-pointers"], ["two pointer", "two-pointers"],
  ["feature flag", "feature-flag"], ["feature flags", "feature-flag"],
  ["load balancer", "load-balancer"], ["load balancing", "load-balancing"],
  ["message queue", "message-queue"], ["message queues", "message-queue"],
  ["event driven", "event-driven"], ["event stream", "event-stream"],
  ["eventual consistency", "eventual-consistency"], ["strong consistency", "strong-consistency"],
  ["high availability", "high-availability"],
  ["unit test", "unit-test"], ["unit tests", "unit-test"],
  ["integration test", "integration-test"], ["integration tests", "integration-test"],
  ["test coverage", "test-coverage"], ["circuit breaker", "circuit-breaker"], ["graceful degradation", "graceful-degradation"],
  ["code splitting", "code-splitting"], ["lazy loading", "lazy-loading"], ["tree shaking", "tree-shaking"],
  ["data model", "data-model"], ["data modeling", "data-model"], ["foreign key", "foreign-key"], ["primary key", "primary-key"],
  ["search engine", "search-engine"], ["full text search", "full-text-search"],
  ["machine learning", "machine-learning"], ["cross functional", "cross-functional"],
  ["micro services", "microservices"], ["micro service", "microservices"],
  ["high level", "high-level"], ["low level", "low-level"],
  ["authentication", "authentication"], ["single page", "single-page"],
  ["short term", "short-term"], ["long term", "long-term"]
];

const PHRASE_MAP = Object.fromEntries(PHRASES);
const PHRASE_RE = new RegExp(
  "\\b(" + PHRASES.map(p => p[0]).sort((a, b) => b.length - a.length).join("|") + ")\\b", "g"
);

function normalize(text: string): string {
  return String(text || "").toLowerCase().replace(PHRASE_RE, m => PHRASE_MAP[m] ?? m);
}

/* canonical concept → vocabulary. A token belongs to a family when it appears
   in the family list (post-normalization). */
const FAMILIES: Record<string, string[]> = {
  routing: ["routing", "router", "routes", "route", "navigation", "navigate", "navigating", "deep-link", "url", "uri", "deep linking"],
  caching: ["caching", "cache", "cached", "memoize", "memoization", "memoized", "invalidation", "invalidate", "ttl", "expiry"],
  complexity: ["complexity", "big-o", "asymptotic", "time-complexity", "space-complexity", "runtime"],
  closure: ["closure", "closures", "lexical scope", "lexical-scope", "scope chain", "scoping"],
  hoisting: ["hoisting", "hoisted", "hoist"],
  eventloop: ["event-loop", "call-stack", "task-queue", "microtask", "microtasks", "macrotask", "macrotasks", "async", "async-await", "promise", "promises", "await", "callback", "callbacks"],
  state: ["state", "stateful", "state-management", "store", "stores", "redux", "zustand", "context", "global-state", "lifting-state", "stateful"],
  component: ["component", "components", "props", "render", "renders", "rendering", "re-render", "re-renders", "virtual-dom", "vdom", "jsx", "mount", "unmount", "lifecycle", "effect", "effects", "dependency-array", "cleanup"],
  security: ["security", "authentication", "authorization", "auth", "jwt", "oauth", "xss", "csrf", "injection", "sanitize", "sanitization", "encryption", "encrypt"],
  database: ["database", "databases", "db", "sql", "nosql", "index", "indexes", "indexing", "query", "queries", "transaction", "transactions", "schema", "schemas", "normalization", "denormalization", "denormalize", "shard", "sharding", "replica", "replicas", "replication", "foreign-key", "primary-key", "relational"],
  scaling: ["scaling", "scale", "scalability", "throughput", "latency", "horizontal", "vertical", "load", "capacity"],
  availability: ["availability", "uptime", "failover", "redundancy", "high-availability", "redundant"],
  consistency: ["consistency", "consistent", "eventual-consistency", "strong-consistency", "acid", "cap theorem"],
  messaging: ["messaging", "message-queue", "message-queues", "queue", "queues", "kafka", "rabbitmq", "pub-sub", "pubsub", "message broker", "event-driven", "event-stream", "streaming", "backpressure"],
  testing: ["testing", "test", "tests", "unit-test", "unit-tests", "integration-test", "integration-tests", "e2e", "tdd", "mock", "mocks", "stub", "stubs", "test-coverage", "regression", "regressions", "assertion", "assertions"],
  observability: ["observability", "monitoring", "metrics", "logging", "logs", "tracing", "trace", "traces", "alerting", "alerts", "dashboards", "telemetry"],
  resilience: ["resilience", "error handling", "errors", "exception", "exceptions", "retry", "retries", "backoff", "circuit-breaker", "fallback", "fallbacks", "graceful-degradation", "idempotency", "idempotent", "timeout", "timeouts"],
  splitting: ["code-splitting", "lazy-loading", "lazy-load", "split", "splitting", "splitter", "bundle", "bundles", "bundling", "tree-shaking", "chunk", "chunks"],
  accessibility: ["accessibility", "a11y", "aria", "screen-reader", "keyboard-navigation", "semantic-html", "contrast", "focus-management", "reduced-motion", "landmark", "landmarks"],
  responsive: ["responsive", "responsive-design", "mobile-first", "breakpoint", "breakpoints", "fluid-layout", "adaptive"],
  typing: ["typing", "types", "type-system", "typescript", "static-typing", "generics", "type-inference", "union-types", "structural typing"],
  immutability: ["immutability", "immutable", "mutation", "mutations", "mutating", "pure-function", "pure-functions", "side effect", "side effects"],
  performance: ["performance", "profiling", "profiler", "bottleneck", "bottlenecks", "optimization", "optimize", "optimizing", "benchmark", "benchmarks", "web vitals", "lcp", "inp", "cls"],
  patterns: ["patterns", "design-pattern", "design-patterns", "factory", "singleton", "strategy-pattern", "observer-pattern", "adapter", "decorator", "composition", "inheritance", "interface"],
  api: ["api", "apis", "rest", "http", "endpoint", "endpoints", "webhook", "webhooks", "graphql", "status-code", "status-codes", "idempotency", "pagination", "versioning", "crud"],
  realtime: ["real-time", "websocket", "websockets", "sse", "realtime"],
  storage: ["storage", "localstorage", "sessionstorage", "cookies", "indexeddb", "persistence", "persist", "persisting", "durable"],
  memory: ["memory", "memory-leak", "memory-leaks", "garbage-collection", "garbage collector", "allocation", "heap"],
  concurrency: ["concurrency", "concurrent", "parallel", "parallelism", "race-condition", "race-conditions", "deadlock", "deadlocks", "locking", "lock", "locks", "mutex", "semaphore", "thread", "threads", "multithreading", "multi-threading"],
  structures: ["array", "arrays", "hash-map", "hash-maps", "hash-table", "hash-tables", "dictionary", "linked-list", "linked-lists", "stack", "tree", "trees", "graph", "graphs", "binary-search", "sorting", "sort", "traversal", "dfs", "bfs", "recursion", "recursive", "heap", "heaps", "queue", "queues", "data structures", "data-structure"],
  algorithms: ["algorithm", "algorithms", "brute-force", "two-pointers", "sliding-window", "divide-and-conquer", "dynamic-programming", "greedy", "backtracking", "big-o", "complexity"],
  leadership: ["leadership", "lead", "leading", "mentor", "mentoring", "vision", "roadmap", "roadmaps", "hiring", "influence", "stakeholder", "stakeholders", "alignment"],
  communication: ["communication", "communicate", "communicating", "presenting", "presentation", "feedback", "collaboration", "cross-functional", "listening"],
  agile: ["agile", "scrum", "kanban", "sprint", "sprints", "standup", "retrospective", "velocity", "estimation", "estimating", "backlog"],
  devops: ["devops", "ci", "cd", "pipeline", "pipelines", "deployment", "deploy", "deploying", "release", "releases", "rollback", "canary", "feature-flag", "feature-flags", "docker", "kubernetes", "k8s", "container", "containers", "orchestration", "infrastructure"],
  cloud: ["cloud", "aws", "azure", "gcp", "serverless", "lambda", "load-balancer", "load-balancing", "cdn", "edge", "instance", "instances"],
  modeling: ["modeling", "data-model", "data-modeling", "entity", "entities", "relations", "relationship", "relationships", "foreign-key", "primary-key"],
  search: ["search", "search-engine", "ranking", "relevance", "full-text-search", "tokenizer", "inverted index"],
  ml: ["machine-learning", "ml", "model training", "training data", "inference", "embeddings", "vector", "vectors", "llm", "llms", "rag", "prompt", "prompts", "fine-tuning"],
  async: ["async", "await", "callback", "callbacks", "event-loop", "microtask", "microtasks", "promise", "promises", "non-blocking", "nonblocking"]
};

/** Family → synonyms index, and the full synonym → family reverse index. */
const TO_FAMILY: Record<string, string> = {};
function rebuildIndex(): void {
  for (const k of Object.keys(TO_FAMILY)) delete TO_FAMILY[k];
  for (const [fam, words] of Object.entries(FAMILIES)) {
    for (const w of words) TO_FAMILY[w] = fam;
  }
}
rebuildIndex();

/** Concept families present in a text (synonym-aware). */
export function conceptSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of tokenize(normalize(text))) {
    const fam = TO_FAMILY[w];
    if (fam) out.add(fam);
  }
  return out;
}

/** Number of concept families two texts share. */
export function conceptOverlap(a: string, b: string): number {
  const ca = conceptSet(a);
  let n = 0;
  for (const c of conceptSet(b)) if (ca.has(c)) n++;
  return n;
}

/** True when `text` genuinely discusses what `kp` (a key point) is about.
    Matching is concept-aware but precision-guarded:
      · a shared significant word (stemmed) always counts;
      · a shared concept family counts only when the key point is single-
        concept, or the answer agrees on ≥2 of its concepts — so "I'll use a
        router" covers "URL as source of truth" (single-concept) but not
        "route guards for auth" (routing is incidental there).
    This is the core matcher for the grader. */
export function textMatches(text: string, kp: string): boolean {
  const ct = conceptSet(text);
  const ck = conceptSet(kp);
  if (ck.size && ct.size) {
    let shared = 0;
    for (const c of ck) if (ct.has(c)) shared++;
    if (shared > 0 && (ck.size <= 1 || shared >= 2)) return true;
  }
  const tt = sigTokens(text);
  const tk = sigTokens(kp);
  for (const t of tt) if (tk.has(t)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Coverage states                                                     */
/* ------------------------------------------------------------------ */

export interface Coverage {
  covered: string[];
  partial: string[];
  missing: string[];
  pct: number;
}

/** Per-key-point coverage of an answer.
    covered  — concept or significant-word overlap with the key point.
    partial  — no direct match, but the user is clearly discussing this
               question's domain (concept overlap with the prompt).
    missing  — nothing. */
export function analyzeCoverage(userText: string, kp: string[], prompt = ""): Coverage {
  const covered: string[] = [];
  const partial: string[] = [];
  const missing: string[] = [];
  const inDomain = conceptOverlap(prompt, userText) > 0;
  for (const k of kp ?? []) {
    if (!k) continue;
    if (textMatches(userText, k)) covered.push(k);
    else if (inDomain) partial.push(k);
    else missing.push(k);
  }
  const total = Math.max(1, (kp ?? []).length);
  return { covered, partial, missing, pct: (covered.length + 0.5 * partial.length) / total };
}

/** Cumulative coverage across a whole conversation (all user messages). */
export function cumulativeCoverage(userTexts: string[], kp: string[], prompt = ""): Coverage {
  const combined = userTexts.join(" ");
  return analyzeCoverage(combined, kp, prompt);
}

/* ------------------------------------------------------------------ */
/* Answer-structure signals (no AI needed)                             */
/* ------------------------------------------------------------------ */

/** Expected minimum answer length per level — structural expectations. */
export const EXPECTED_WORDS: Record<string, number> = {
  junior: 40, mid: 60, senior: 80, staff: 100, principal: 120, cto: 110, ceo: 80
};

export interface StructureSignals {
  words: number;
  expected: number;
  example: boolean;
  tradeoffs: boolean;
  structured: boolean;
  vocab: number;
}

const EXAMPLE_RE = /\b(for example|e\.g\.|for instance|such as|in practice|in production|say we|imagine|let'?s say|like when|take a|case study)\b|`|=>|function\s*\(/i;
const TRADEOFF_RE = /\b(trade-?offs?|pros? and cons?|downside|downsides|benefit|benefits|at the expense of|cheaper|faster but|slower but|however|but it'?s (more|less|at)|weigh)\b/i;
const STRUCTURE_RE = /\b(first|second|third|then|next|finally|lastly|step|approach|option|on the other hand|alternatively|alternate)\b/i;

/** Cheap structural reads of an answer: length vs level, example, tradeoffs,
    structure markers, and how many distinct concepts were named. */
export function structuralSignals(userText: string, levelId?: string | null): StructureSignals {
  const words = tokenize(userText).length;
  const expected = EXPECTED_WORDS[levelId ?? "mid"] ?? 60;
  return {
    words,
    expected,
    example: EXAMPLE_RE.test(userText),
    tradeoffs: TRADEOFF_RE.test(userText),
    structured: STRUCTURE_RE.test(userText),
    vocab: conceptSet(userText).size
  };
}

/* ------------------------------------------------------------------ */
/* Misconception guard                                                 */
/* ------------------------------------------------------------------ */

export interface Misconception { re: RegExp; correction: string }

/** Curated wrong-claim → correction map so debates actually get settled. */
export const MISCONCEPTIONS: Misconception[] = [
  { re: /closures? (are|is|come|comes|happen|due|about|because of).{0,40}hoist/i, correction: "Not quite — closures come from lexical scope, not hoisting. Hoisting moves declarations; a closure captures the surrounding scope so the function remembers it later. They're related language features, but the mechanism is scope, not hoisting." },
  { re: /cache invalidat\w+ is (easy|simple|trivial)|just clear the cache/i, correction: "Careful — cache invalidation is famously the hard part of caching (the two-hard-things joke exists for a reason). The robust answer names a strategy: versioned keys, TTLs, write-through vs write-behind, or event-driven invalidation — not 'just clear it'." },
  { re: /settimeout (is|guarantee|always) (a|exact|promise)|settimeout.{0,20}promise/i, correction: "setTimeout is not a promise and gives no exact-time guarantee — it queues a callback for at least N ms after the current work. Promises have their own microtask queue that drains before timers. Mixing them up is a classic trap interviewers probe." },
  { re: /== and === (are|is) (the|basically|pretty much) (same|identical)|double equals.{0,30}same/i, correction: "== and === are not the same — == coerces types before comparing (so '5' == 5 is true) while === requires the same type. In modern codebases the rule is: use === and let the linter enforce it." },
  { re: /event loop runs on (multiple|several|many|parallel) threads|js (is|uses) multi-?thread/i, correction: "JavaScript's event loop is single-threaded — one call stack. What's concurrent is the async I/O (workers, the browser's network thread) that *feeds* callbacks back to that one thread. Workers give you real parallelism, but the main thread is still one." },
  { re: /(microtasks?|promises?) (run|fire|execute|drain) (after|following) (macro)?(tasks?|timers?)/i, correction: "Order is the opposite: microtasks (promise .then / queueMicrotask) drain BEFORE the next macrotask (setTimeout). So a promise scheduled inside a timer callback still runs before the *next* timer fires." },
  { re: /first.{0,30}(shard|sharding)|just (add|spin up) (more|many) servers/i, correction: "Scale in order of complexity: read replicas and caching first, denormalization second, sharding only when the simpler levers are exhausted — sharding adds real operational complexity (resharding, hot keys, cross-shard queries)." },
  { re: /nosql is (always|just) (faster|better than sql)/i, correction: "NoSQL isn't 'faster' — it's a different consistency/query trade-off. A relational store with the right index often beats a document store for joins and range queries. The honest answer compares the access patterns, not the brand." },
  { re: /typescript types (are|get) (checked|enforced) at runtime|types are checked at runtime/i, correction: "TypeScript types are erased at compile time — there are no runtime checks. Validation still needs runtime guards (zod, io-ts, or manual checks). Saying types are checked at runtime is the exact kind of claim an interviewer will push on." },
  { re: /useeffect (runs|fires) after every render.{0,30}(no matter|regardless|always)/i, correction: "useEffect runs after render, but only when its dependency array changes (or on mount, or when deps are omitted). The trap is deps: missing a dependency causes stale closures; adding unstable ones causes re-run loops." },
  { re: /css is not a (programming|real) language|html is not a language/i, correction: "CSS is Turing-complete and HTML is a markup language — the 'not a language' take is a joke, not an interview answer. The substance: CSS is declarative, and the interesting questions are specificity, cascade, and layout." },
  { re: /rest is (always|automatically) (better|worse) than graphql|graphql is always better/i, correction: "Neither is universally better — REST wins on caching, simplicity and long-lived public APIs; GraphQL wins on client-driven shapes and reducing over-fetching. The strong answer picks by the access patterns, not the brand." },
  { re: /agile means no (planning|documentation|process)/i, correction: "Agile isn't 'no planning' — it's planning in smaller loops with feedback. The manifesto values working software and responding to change, not abandoning docs or process." },
  { re: /blockchain (is|solves) everything|blockchain is (the answer|perfect)/i, correction: "Blockchain is a distributed-consensus ledger with real costs (throughput, energy, complexity). Most problems are better solved with a normal database — the interview answer should name what blockchain actually guarantees and when it's worth it." }
];

/** Returns the first misconception correction found in the user's text. */
export function detectMisconception(text: string): string | null {
  for (const m of MISCONCEPTIONS) {
    if (m.re.test(text)) return m.correction;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Admin-editable vocabulary overrides                                 */
/* ------------------------------------------------------------------ */

/* Deep snapshot of the baked-in tables so overrides can be applied and reset
   (tests) without leaking state across runs. */
const BASE_FAMILIES: Record<string, string[]> = {};
for (const [f, words] of Object.entries(FAMILIES)) BASE_FAMILIES[f] = [...words];
const BASE_MISCONCEPTIONS: Misconception[] = MISCONCEPTIONS.slice();

/** Admin-published coach vocabulary (app_config → coach_vocab). New concept
    families extend the baked-in map; misconception entries are appended. */
export interface CoachVocabOverrides {
  families?: Record<string, string[]>;
  misconceptions?: { re: string; correction: string }[];
}

/** Applies remote vocabulary overrides — call after every remote-config sync
    and once at boot from the cached copy. Multi-word entries should be
    hyphenated or single tokens ("service-mesh", "micro-frontend"). */
export function applyCoachVocab(overrides?: CoachVocabOverrides | null): void {
  if (!overrides) return;
  for (const [fam, words] of Object.entries(overrides.families ?? {})) {
    if (!Array.isArray(words) || !words.length) continue;
    FAMILIES[fam] = [...new Set([...(FAMILIES[fam] ?? []), ...words])];
  }
  rebuildIndex();
  for (const m of overrides.misconceptions ?? []) {
    if (m && typeof m.re === "string" && m.re && m.correction) {
      try { MISCONCEPTIONS.push({ re: new RegExp(m.re, "i"), correction: m.correction }); } catch { /* bad regex — skip */ }
    }
  }
}

/** Restores the baked-in families + misconceptions (test isolation). */
export function resetCoachVocab(): void {
  for (const k of Object.keys(FAMILIES)) delete FAMILIES[k];
  for (const [f, words] of Object.entries(BASE_FAMILIES)) FAMILIES[f] = [...words];
  rebuildIndex();
  MISCONCEPTIONS.length = 0;
  MISCONCEPTIONS.push(...BASE_MISCONCEPTIONS);
}

/* ------------------------------------------------------------------ */
/* Intent classifier                                                   */
/* ------------------------------------------------------------------ */

export type CoachIntent =
  | "greeting" | "thanks" | "grade" | "hint" | "explain" | "compare"
  | "debate" | "approach" | "next" | "other";

const RE_GREETING = /^(hi|hello|hey|yo|good (morning|afternoon|evening))[.!]*$/i;
const RE_THANKS = /^(thanks|thank you|great|got it|understood|makes sense|awesome|perfect|nice)[.!]*$/i;
const RE_GRADE = /\b(grade|score|rate|mark|evaluate|assess|how (did|well) (i|did)|coverage)\b/i;
const RE_HINT = /\b(hint|stuck|clue|nudge|help me (start|begin)|i don'?t know|can'?t figure|no idea|give me a (way|start|push))\b/i;
const RE_COMPARE = /\b(compare|difference|differences|vs\.?|versus|which is better|better than|how does .{0,40} differ)\b/i;
const RE_EXPLAIN = /\b(explain|how does|how do|how would|what is|what'?s|what are|why (does|is|do|would)|walk me through|tell me about)\b/i;
const RE_DEBATE = /\b(disagree|not sure|isn'?t|wrong|debate|objection|however|but (i|what|that|my|the)|actually (i|that|my)|i think that'?s (wrong|not))\b/i;
const RE_APPROACH = /\b(i'?ll|i will|i would|i'?d|i can|i could|i plan|i'?m going|i am going|i decided|i use|i used|i chose|i prefer|i think|i did|my approach|my solution|my answer|what about|this is how|here'?s (my|how)|i have|i'?ve)\b/i;
const RE_NEXT = /\b(suggest|recommend).{0,30}(next|problem|practice)|what should i (do|practice|study|focus)|next problem|keep going|what next|continue|what'?s next\b/i;

/** Classifies what the candidate is asking for — checked in priority order
    (grade before approach, debate before explain, etc.). */
export function classifyIntent(text: string): CoachIntent {
  const t = String(text || "").trim();
  if (!t) return "other";
  if (t.split(/\s+/).length <= 4 && RE_GREETING.test(t)) return "greeting";
  if (t.split(/\s+/).length <= 5 && RE_THANKS.test(t)) return "thanks";
  if (RE_GRADE.test(t)) return "grade";
  if (RE_HINT.test(t)) return "hint";
  if (RE_COMPARE.test(t)) return "compare";
  if (RE_DEBATE.test(t)) return "debate";
  if (RE_EXPLAIN.test(t)) return "explain";
  if (RE_APPROACH.test(t)) return "approach";
  if (RE_NEXT.test(t)) return "next";
  return "other";
}
