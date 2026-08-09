/* Curated interview deep-dives for roadmap topics.
   Offline-first: every topic label resolves to structured study material —
   concepts, key points to mention, common traps, interview Q&A and related
   topics — without any network call. This is the "selling point" of the
   Learn panel: real, interview-focused content for every topic.
   The same content also feeds Drill mode automatically (deepDiveCards). */

import type { LevelId } from "../types";

export interface DeepDiveConcept {
  name: string;
  blurb: string;
}

export interface DeepDiveQa {
  q: string;
  a: string;
}

export interface DeepDive {
  concepts: DeepDiveConcept[];
  points: string[];
  traps: string[];
  qa: DeepDiveQa[];
  related: string[];
}

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

/* ------------------------------------------------------------------ */
/* Authored deep-dives (core topics that appear across roadmaps)        */
/* ------------------------------------------------------------------ */

const LANGUAGE_BASICS: DeepDive = {
  concepts: [
    { name: "Types, values & coercion", blurb: "Primitive vs reference types, dynamic vs static typing, and the implicit coercion traps that surprise people." },
    { name: "Control flow & functions", blurb: "Conditionals, loops, early returns, and first-class functions — the building blocks of readable logic." },
    { name: "Scope, hoisting & closures", blurb: "Block vs function scope, the order names resolve, and how closures capture state — the mental model behind most gotchas." },
    { name: "Error handling", blurb: "Exceptions vs error values, failing loudly with context, and never swallowing errors." },
    { name: "Idioms & tooling", blurb: "Language conventions, linters, formatters, package managers, and the ecosystem you work in daily." }
  ],
  points: [
    "Open with a definition: 'I'd start with the type system and how the language models values and memory.'",
    "Show awareness of typed vs untyped languages and when each helps.",
    "Give a small, code-shaped example: a function, a loop, an error path.",
    "Mention the tooling you actually use (linter, formatter, package manager, debugger).",
    "Reason about trade-offs instead of reciting syntax."
  ],
  traps: [
    "Assuming strict equality or forgetting coercion rules.",
    "Not understanding hoisting/scope, then getting confused by closures.",
    "Ignoring error paths — answers fall apart on edge cases.",
    "Reciting syntax instead of explaining when and why to use it."
  ],
  qa: [
    { q: "How do you decide between typed and untyped code?", a: "Strong answer: static types catch whole classes of bugs and make refactoring safe at scale, at the cost of ceremony and a slower loop. For a small script or prototype, untyped is faster; for a codebase that will live and grow, typed wins. I'd mention that type systems are a spectrum — inference, unions, generics — and that the real win is the confidence to change code." },
    { q: "Walk me through how you'd refactor a messy 200-line function.", a: "1) Read it and list what it actually does. 2) Extract one behavior per small function with clear names. 3) Return early and flatten nesting. 4) Cover the behavior with tests first if it's important. 5) Keep the diff reviewable. The key point: refactor in small steps with tests, not a big-bang rewrite." }
  ],
  related: ["JavaScript / TypeScript", "data structures", "debugging", "code review"]
};

const TESTING_FUNDAMENTALS: DeepDive = {
  concepts: [
    { name: "Unit vs integration vs E2E", blurb: "What each level catches, how much it costs, and how fast it runs — the testing pyramid in practice." },
    { name: "Good assertions", blurb: "Assert behavior, not implementation; one behavior per test; test the contract users rely on." },
    { name: "Test doubles", blurb: "Mocks, stubs and fakes — when each fits, and why mocking your own internals is a smell." },
    { name: "Coverage vs confidence", blurb: "Coverage is a proxy, not a goal; meaningful cases beat high percentages." },
    { name: "Regression protection", blurb: "Every fixed bug gets a test that would have caught it, so it can't come back." }
  ],
  points: [
    "Name the testing pyramid and justify your proportions (many units, fewer E2E).",
    "Say it plainly: 'I test behavior, not implementation details.'",
    "Show you know when NOT to mock — mock boundaries, not your own code's internals.",
    "Mention testing failure paths, not just the happy path.",
    "Tie testing to confidence: 'Tests let me refactor without fear.'"
  ],
  traps: [
    "Testing implementation details — every refactor breaks the tests.",
    "Mocking everything — tests pass but prove nothing.",
    "Chasing 100% coverage instead of meaningful cases.",
    "Flaky, slow E2E suites that the team stops trusting."
  ],
  qa: [
    { q: "What's the difference between unit, integration and end-to-end tests, and when would you use each?", a: "Units test one function/component in isolation — fast, cheap, great for logic. Integration tests verify that pieces work together (DB, API, modules) and catch contract mismatches. E2E tests drive the real user flow through the real stack — slowest and flakiest, so you keep the count low and focused on critical journeys. I'd pick by cost and confidence: most tests at the unit level, a solid integration layer, a few E2E for the money paths." },
    { q: "A bug keeps coming back. How do you prevent it?", a: "1) Write a failing test that reproduces the exact case. 2) Fix the root cause, not the symptom. 3) Confirm the test passes and the bug is gone. 4) If it recurs in different forms, ask what makes this class of bug possible and address it at the design level — better types, validation, or invariants." }
  ],
  related: ["debugging", "code review", "JavaScript / TypeScript", "language basics"]
};

const DATA_STRUCTURES: DeepDive = {
  concepts: [
    { name: "Arrays & hash maps", blurb: "The workhorses: O(1) lookup with the right keying, ordered iteration, and their memory costs." },
    { name: "Stacks, queues & linked lists", blurb: "Ordering semantics — LIFO, FIFO — and the real-world problems they model (undo, tasks, buffers)." },
    { name: "Trees & graphs", blurb: "Traversals (DFS/BFS), heaps for priority, and path-finding — when to reach for each." },
    { name: "Time vs space", blurb: "Big-O reasoning and the constant trade-off between speed and memory." },
    { name: "Choosing the right structure", blurb: "Start from the operations you need — insert, look up, order — and pick the structure that fits." }
  ],
  points: [
    "Always state time AND space complexity before coding.",
    "Tie the structure choice to the operations the problem actually needs.",
    "Know one real-world use per structure (map → cache, queue → rate limiting).",
    "Verbalize the path: brute force → better → best, with the trade-off at each step.",
    "Ask clarifying questions about constraints before jumping in."
  ],
  traps: [
    "Jumping to code before analyzing the problem.",
    "Confusing O(log n) structures with O(1) claims.",
    "Ignoring space complexity entirely.",
    "Choosing a fancy structure when an array or map is the right answer."
  ],
  qa: [
    { q: "How would you design the data structure for a social feed?", a: "A feed is ordered, timestamped, append-heavy and read-often. I'd use a list-like structure for ordering plus an index for lookups — in practice: a time-ordered log, hash maps keyed by user for 'who follows whom' and read cursors, and a cache in front of the hot reads. I'd mention the write path (fan-out on publish) and that the right answer depends on read:write ratio and whether consistency needs to be real-time." },
    { q: "Explain Big-O with a real example of O(n²) vs O(n log n).", a: "Big-O describes how runtime or memory grows with input size. A naive nested loop over an array is O(n²) — doubling the input quadruples the work. Sorting then scanning, or using a hash map to trade space for time, often gets you to O(n log n) or O(n). I'd give a concrete example: finding duplicates in a list — nested loops O(n²) vs a hash set O(n)." }
  ],
  related: ["language basics", "system design", "debugging", "JavaScript / TypeScript"]
};

const DEBUGGING: DeepDive = {
  concepts: [
    { name: "Reproduce first", blurb: "A bug you can't reproduce deterministically, you can't fix confidently." },
    { name: "Read the error", blurb: "Stack traces, logs and the exact failing input carry most of the answer." },
    { name: "Bisect & isolate", blurb: "Binary-search the change or input that broke it — git bisect, comments, halves." },
    { name: "Hypothesize, don't guess", blurb: "One experiment at a time, each testing a single hypothesis." },
    { name: "Regression protection", blurb: "A bug isn't fixed until a test proves it can't come back." }
  ],
  points: [
    "Open with: 'First I reproduce it deterministically, then I read the error carefully.'",
    "Name your toolkit: debugger, structured logs, profiler, git bisect.",
    "Show you fix root causes, not symptoms.",
    "Finish with: 'Then I add a regression test so it can't come back.'"
  ],
  traps: [
    "Fixing the symptom and shipping.",
    "Adding log lines everywhere without a hypothesis.",
    "Blaming the environment before checking your own change.",
    "Shipping 'should be fixed' without reproducing the original case."
  ],
  qa: [
    { q: "Tell me about a difficult bug you debugged.", a: "A strong answer uses the structure: the symptom, how I reproduced it, how I isolated the cause (bisect/hypothesis), the root cause, the fix, and the regression test I added. Bonus points for naming the lesson — e.g. 'after that I never trust implicit timezone conversion.'" },
    { q: "How do you approach a performance problem in production?", a: "Measure first. Use profiling and tracing to find the actual bottleneck rather than guessing. Form a hypothesis, make one change, re-measure. Compare before/after on real traffic or a load test. Then prevent regressions with a performance budget or alert." }
  ],
  related: ["testing fundamentals", "code review", "SRE & observability", "language basics"]
};

const COMMUNICATION: DeepDive = {
  concepts: [
    { name: "Know your audience", blurb: "Exec summary for leadership, detail for engineers — depth follows the listener." },
    { name: "Structured delivery", blurb: "Context → decision → impact, or STAR for stories. Structure beats spontaneity." },
    { name: "Active listening", blurb: "Clarify before answering; restate to confirm; ask questions that sharpen the ask." },
    { name: "Writing that scales", blurb: "Docs, updates and async communication that don't force follow-up meetings." },
    { name: "Giving & receiving feedback", blurb: "Specific, timely, behavioral — and open when it's aimed at you." }
  ],
  points: [
    "'I adapt depth to the audience — one paragraph for execs, detail for engineers.'",
    "Use a one-paragraph structure for every story: context, what I did, the result.",
    "'I ask clarifying questions rather than assuming.'",
    "'I write decisions down with the reasoning, so context survives the meeting.'"
  ],
  traps: [
    "Dumping detail on an exec audience.",
    "Ambiguous updates that generate follow-up emails.",
    "Interrupting, or answering before the question is finished.",
    "Avoiding hard feedback to keep things pleasant."
  ],
  qa: [
    { q: "How do you explain a technical decision to a non-technical stakeholder?", a: "Lead with the outcome and the business impact, not the mechanism. One-line context, the options considered, the recommendation, and what it costs or buys. Offer the technical depth separately for anyone who wants it. Check understanding with a question rather than assuming it landed." },
    { q: "Tell me about a time you disagreed with a teammate and how you handled it.", a: "Structure: the disagreement (technical, not personal), how I listened to their position and argued from data or a quick experiment, how we reached a decision (and who owned it), and the outcome. Emphasize that the relationship survived because the disagreement was about the problem, not the person." }
  ],
  related: ["cross-team collaboration", "code review", "executive communication", "risk management"]
};

const JS_TS: DeepDive = {
  concepts: [
    { name: "Event loop & async", blurb: "Call stack, task queue, microtasks — the model behind promises and async/await." },
    { name: "Scoping & closures", blurb: "Lexical scope, closures, and why 'var vs let vs const' actually matters." },
    { name: "Prototypes & this", blurb: "Property lookup chains, and how context binding works (and breaks)." },
    { name: "Types & inference", blurb: "TypeScript's structural typing, unions, generics — and the costs of the type system." },
    { name: "Modules & tooling", blurb: "ESM vs CJS, bundlers, tree-shaking, and the build pipeline." }
  ],
  points: [
    "Explain the event loop in one breath: call stack → task queue → microtasks.",
    "'TypeScript gives me the confidence to refactor at scale.'",
    "Show GC awareness: closures and listeners that leak memory.",
    "Reason about why code breaks, not just how to write it."
  ],
  traps: [
    "== vs === coercion confusion.",
    "'this' surprises — when arrow functions save you and when they don't.",
    "Blocking the main thread with heavy synchronous work.",
    "Type gymnastics or 'any' everywhere — either extreme loses the point."
  ],
  qa: [
    { q: "Explain how JavaScript handles asynchronous code.", a: "JS is single-threaded, so async work doesn't block. The event loop runs the call stack; when an async operation (timer, network, promise) finishes, its callback goes to the task queue or the microtask queue, and the loop drains microtasks before the next task. Promises and async/await are syntax over this — await pauses the function, not the thread. I'd mention ordering: microtasks (promises) run before tasks (timers)." },
    { q: "What problem does TypeScript solve, and what are its costs?", a: "It adds static types on top of JS: catch whole bug classes at compile time, get editor navigation/refactor safety, and make interfaces explicit across a team. Costs: build step, learning curve, type ceremony on quick code, and occasionally fighting the type system. The trade-off is worth it for codebases that live and grow; I'd keep types pragmatic — infer where possible, model the edges well." }
  ],
  related: ["React · Vue · Angular", "language basics", "Web performance", "data structures"]
};

const FRONTEND_FRAMEWORKS: DeepDive = {
  concepts: [
    { name: "Component model", blurb: "Props down, events up; composition and reusability over inheritance." },
    { name: "Rendering strategies", blurb: "Virtual DOM vs reactivity vs change detection — what each framework actually does." },
    { name: "State management", blurb: "Local, lifted, global — and when each level is the right one." },
    { name: "Lifecycle & effects", blurb: "Mount/update/unmount, dependency arrays, and cleanup that prevents leaks." },
    { name: "Performance", blurb: "Memoization, code splitting, avoiding wasted re-renders — measured, not guessed." }
  ],
  points: [
    "Compare frameworks on trade-offs, not loyalty.",
    "'State is the source of truth; the UI is a projection of it.'",
    "Know your effect rules: dependencies, cleanup, and why they matter.",
    "Treat SSR/rendering strategy as a real decision with costs."
  ],
  traps: [
    "Mutating state in place.",
    "Giant components with tangled prop drilling.",
    "Memoizing everything 'just in case'.",
    "Skipping effect cleanup — memory leaks and stale subscriptions."
  ],
  qa: [
    { q: "When do you lift state up vs reach for a global store?", a: "Start with local state; lift to the nearest common parent when two components need it. A global store earns its place when state is shared across many unrelated parts, needs persistence/sync, or has complex derived data — not just to avoid prop drilling. I'd name the cost: global state makes components harder to reason about in isolation, so it should earn that complexity." },
    { q: "Your page re-renders too often. How do you diagnose and fix it?", a: "Measure first — use the profiler to see which components re-render and why. Common causes: unstable props (new objects/arrays each render), missing memoization, context that updates too broadly, or state living too high. Fix by stabilizing the props, memoizing the right components, or narrowing the context. Re-measure after each change." }
  ],
  related: ["JavaScript / TypeScript", "CSS & accessibility", "Web performance", "testing fundamentals"]
};

const CSS_A11Y: DeepDive = {
  concepts: [
    { name: "Box model & layout", blurb: "Flexbox and grid, spacing systems, and the mental model behind every layout." },
    { name: "Responsive design", blurb: "Mobile-first breakpoints, fluid type, and content that adapts, not just squishes." },
    { name: "Semantic HTML", blurb: "Landmarks and native elements — the foundation of accessibility." },
    { name: "Keyboard & screen-reader UX", blurb: "Focus management, ARIA only as a gap-filler, and testing with real tools." },
    { name: "Design systems", blurb: "Tokens, theming, and consistency at scale." }
  ],
  points: [
    "'Semantic HTML first; ARIA only to fill genuine gaps.'",
    "Show you reason in flex/grid, not float hacks.",
    "'I test with a keyboard and a screen reader.'",
    "Mention prefers-reduced-motion and contrast ratios."
  ],
  traps: [
    "Div soup instead of semantic landmarks.",
    "ARIA where a native element would do.",
    "Fixed pixel layouts that break at small sizes.",
    "Decorative markup that confuses screen readers."
  ],
  qa: [
    { q: "How do you make a complex form accessible?", a: "Use native inputs with real labels associated via for/id. Group related fields with fieldset/legend. Keep a logical tab order, visible focus states, and clear error messaging linked to the field (aria-describedby). Test with a keyboard only — every step must be reachable — then a screen reader. Native semantics first; ARIA only for what HTML can't express." },
    { q: "Center a div — and explain the trade-offs of each approach.", a: "Flexbox with justify/align center — simplest, works for anything in a flex container. Grid with place-items — same idea. Margin auto — needs a width on the element. Absolute positioning + transform — works but takes the element out of flow. I'd pick flex/grid first, and mention the key trade-off: which approach affects the surrounding layout." }
  ],
  related: ["React · Vue · Angular", "Web performance", "JavaScript / TypeScript"]
};

const WEB_PERF: DeepDive = {
  concepts: [
    { name: "Core Web Vitals", blurb: "LCP, INP, CLS — what they measure and what typically moves each one." },
    { name: "Critical rendering path", blurb: "HTML → CSS → JS → first paint, and what blocks it." },
    { name: "Bundles & assets", blurb: "Code splitting, tree-shaking, and image weight — the biggest wins early." },
    { name: "Caching", blurb: "HTTP caching, service workers, and edge caching — each layer's job." },
    { name: "Measure first", blurb: "Lab vs field data, budgets, and optimizing only what's actually slow." }
  ],
  points: [
    "'I measure before and after — no optimization without data.'",
    "Name the Vitals and the usual culprits for each.",
    "'Ship less JavaScript; split by route.'",
    "Mention the caching strategy at every layer."
  ],
  traps: [
    "Optimizing without measuring.",
    "Chasing LCP while ignoring layout shift.",
    "Shipping huge images and bundles.",
    "Micro-optimizing code that isn't the bottleneck."
  ],
  qa: [
    { q: "Your LCP is 6 seconds. Walk me through your debugging process.", a: "Check field data to confirm it's real and segment by device/route. Then lab tools: Lighthouse for a breakdown, the network panel for the largest element's resources, and the performance trace for what blocks rendering. Common fixes: preload the LCP image, inline critical CSS, remove render-blocking JS, compress/convert images, or serve from the edge. Re-measure after each change." },
    { q: "How do code splitting and caching interact?", a: "Code splitting makes each route load only what it needs — smaller first paint. Caching makes repeat visits instant: hashed filenames for immutable caching, so the browser reuses unchanged chunks and only fetches what changed. The interaction: split by route + hash + long cache = fast first visit and near-instant repeat visits." }
  ],
  related: ["JavaScript / TypeScript", "CSS & accessibility", "React · Vue · Angular"]
};

const APIS_SERVICES: DeepDive = {
  concepts: [
    { name: "HTTP semantics", blurb: "Methods, status codes, headers, and caching — the contract between client and server." },
    { name: "Resource modeling", blurb: "Nouns, nesting, naming — design the surface like a product." },
    { name: "Idempotency & retries", blurb: "Idempotency keys that make retries safe in distributed systems." },
    { name: "Error contracts", blurb: "Consistent, machine-readable errors — a stable contract clients can rely on." },
    { name: "Versioning & evolution", blurb: "Additive, backward-compatible changes and a deprecation path." }
  ],
  points: [
    "'Design the error contract like a product surface.'",
    "'Idempotency keys make retries safe.'",
    "'Status codes carry meaning — use them consistently.'",
    "'Prefer additive, backward-compatible evolution.'"
  ],
  traps: [
    "Returning 200 for everything, errors included.",
    "Breaking clients with silent schema changes.",
    "No pagination on list endpoints.",
    "Retrying unsafe operations without idempotency."
  ],
  qa: [
    { q: "Design a REST API for creating and canceling orders.", a: "POST /orders to create (201 + location), with an Idempotency-Key so retries don't double-order. Cancel as a state transition: POST /orders/{id}/cancel, or PATCH status — I'd model it explicitly so the flow is visible. Errors as a stable shape: code + message + field. List endpoints paginated. I'd also mention webhooks/status endpoints for async fulfillment." },
    { q: "How do you evolve an API without breaking clients?", a: "Additive changes first: new fields are additive, new endpoints are safe. Never repurpose an existing field's meaning. Deprecate loudly and slowly — announce, keep serving, then remove on a schedule clients can plan for. Version when the change is breaking, but treat versioning as a last resort because it forks the surface." }
  ],
  related: ["Databases & caching", "system design", "Distributed systems", "Auth & real-time"]
};

const DATABASES_CACHING: DeepDive = {
  concepts: [
    { name: "Indexing", blurb: "How indexes speed reads and slow writes — and which queries actually need them." },
    { name: "Transactions & isolation", blurb: "ACID, isolation levels, and when relaxing them is the right call." },
    { name: "Normalization vs denormalization", blurb: "The read/write trade-off — start normalized, denormalize where reads demand it." },
    { name: "Caching layers", blurb: "In-memory, query caches, CDNs — and the hard part, invalidation." },
    { name: "Scaling reads & writes", blurb: "Replicas, sharding, and queues — in that order of complexity." }
  ],
  points: [
    "'Indexes are a read/write trade-off — here's both sides.'",
    "'Cache invalidation is the hard part; here's my strategy.'",
    "'Start normalized; denormalize where reads demand it.'",
    "'Transactions guarantee correctness where it matters.'"
  ],
  traps: [
    "Indexing every column.",
    "Caching with no invalidation plan.",
    "Sharding before simpler levers are exhausted.",
    "Ignoring isolation levels until data corrupts."
  ],
  qa: [
    { q: "A query is slow. How do you fix it?", a: "EXPLAIN it — check for a full table scan, look at the plan. Common fixes: add the right index (covering if possible), avoid functions on indexed columns, reduce rows returned (paginate, filter early), or restructure the query. Measure before and after. If it's still slow at scale, consider caching or denormalizing — but index first." },
    { q: "How would you scale a database hitting read limits?", a: "Ladder of options, cheapest first: add read replicas and route read traffic; cache hot reads (Redis/CDN) with an invalidation strategy; denormalize for the hot read patterns; only then consider sharding, which adds real complexity. I'd also check whether you can reduce reads at the app layer — fewer, bigger queries." }
  ],
  related: ["APIs & services", "system design", "Distributed systems"]
};

const SYSTEM_DESIGN: DeepDive = {
  concepts: [
    { name: "Requirements first", blurb: "Functional, non-functional, and scale estimates — before any diagram." },
    { name: "High-level architecture", blurb: "Clients, services, data stores, queues — and how they talk." },
    { name: "Data flow", blurb: "Requests, caches, async jobs, and the consistency each step needs." },
    { name: "Trade-offs", blurb: "Availability vs consistency vs cost vs speed — name yours explicitly." },
    { name: "Failure modes", blurb: "Retries, backoff, circuit breakers, fallbacks — design for what breaks." }
  ],
  points: [
    "'Let me clarify requirements and estimate scale before designing.'",
    "'Start simple: a service, a DB, a cache. Add only what's needed.'",
    "'Here's my consistency/availability trade-off, explicitly.'",
    "'What happens when each piece fails?' — walk through failure modes."
  ],
  traps: [
    "Drawing a diagram before requirements.",
    "Adding Kafka and Kubernetes to every answer for flair.",
    "Ignoring read/write ratio and data size.",
    "No monitoring, rollback, or incident story."
  ],
  qa: [
    { q: "Design a URL shortener.", a: "Requirements: create short URLs, redirect at scale, maybe analytics and expiry. Scale estimate: reads >> writes, cache heavily. Design: a service that generates unique IDs (or hashes a counter/key), stores long→short mapping in a DB, redirects with 301/302, and serves hot reads from cache. Mention collisions, DB sharding if needed, and analytics as an async job." },
    { q: "Design a social feed. How do you handle scale?", a: "Two write paths: push (fan-out on publish — fast reads, heavy writes) vs pull (compute on read — light writes, slow reads), usually a hybrid: push for active users, pull for the long tail. Cache timelines, store posts in a log, and make the read path async where freshness isn't critical. Consistency: eventual is fine for most feeds." }
  ],
  related: ["Distributed systems", "Databases & caching", "APIs & services", "large-scale systems"]
};

const DISTRIBUTED_SYSTEMS: DeepDive = {
  concepts: [
    { name: "Consistency models", blurb: "Strong vs eventual, and what your feature can actually tolerate." },
    { name: "Partitioning & replication", blurb: "Sharding, quorums, leader election — data that survives and scales." },
    { name: "Messaging & queues", blurb: "Decoupling, backpressure, at-least-once delivery and its consequences." },
    { name: "Failure handling", blurb: "Timeouts, retries, circuit breakers, idempotency — the reliability toolkit." },
    { name: "Observability", blurb: "Tracing, metrics, and logs as first-class citizens." }
  ],
  points: [
    "'Assume every network call can fail and every message can duplicate.'",
    "'Choose consistency based on what the feature can tolerate.'",
    "'Idempotent handlers make retries safe.'",
    "'You can't debug what you can't observe.'"
  ],
  traps: [
    "Assuming synchronous consistency everywhere.",
    "Retrying without backoff or idempotency.",
    "Ignoring partial failure in request flows.",
    "No tracing — black-box production incidents."
  ],
  qa: [
    { q: "Explain the CAP theorem with a concrete example.", a: "When a network partition happens, you choose between consistency (all nodes agree) and availability (every request gets a response). A bank transfer needs consistency — better to reject during a partition. A social 'like' count tolerates eventual consistency — keep serving. The point: CAP forces you to decide what matters per feature, not per system." },
    { q: "Your service is slow in production. How do you find the cause?", a: "Start from observability: dashboards for latency/error rate, then distributed traces to find which hop is slow, then logs for the specific request. Common causes: a downstream dependency, a hot key, GC, or a slow query. Fix, then add an alert so it doesn't recur silently." }
  ],
  related: ["system design", "Databases & caching", "SRE & observability", "APIs & services"]
};

const DESIGN_PATTERNS: DeepDive = {
  concepts: [
    { name: "Creational", blurb: "Factory, builder, singleton — flexible object creation without global-state abuse." },
    { name: "Structural", blurb: "Adapter, facade, decorator — composing types cleanly." },
    { name: "Behavioral", blurb: "Strategy, observer, state — delegating behavior and decoupling callers." },
    { name: "When to skip them", blurb: "Simplicity beats pattern-fitting; a pattern earns its place by solving a real problem." },
    { name: "Patterns in the wild", blurb: "Recognize them in your framework — most patterns are already there, used well." }
  ],
  points: [
    "'Name the problem a pattern solves before naming the pattern.'",
    "'Patterns are tools, not goals — I prefer the simplest correct design.'",
    "'Recognize patterns in the framework rather than forcing them in.'",
    "Discuss alternatives and trade-offs, not just the pattern."
  ],
  traps: [
    "Pattern-packing a codebase for looks.",
    "Singleton misuse as a global-state hack.",
    "Abstracting before there's a second use case.",
    "Reciting GoF definitions without application."
  ],
  qa: [
    { q: "Give an example of a pattern you used and the problem it solved.", a: "Pick one you actually used: e.g. a strategy pattern to swap payment providers without touching callers, or an observer for event handling. Structure: the problem (rigid code, or a switch that grew), why the pattern fit, what it cost (more files/indirection), and how it paid off (new provider added with zero changes to callers)." },
    { q: "When would you NOT use a design pattern?", a: "When the simple version is already clear. If there's one implementation today and no sign of a second, abstraction is speculative. Patterns add indirection and files; they pay for themselves only when the variation actually arrives. I'd rather rename a variable than add a factory." }
  ],
  related: ["code review", "language basics", "technical strategy"]
};

const CODE_REVIEW: DeepDive = {
  concepts: [
    { name: "Review the intent", blurb: "Understand what the change is for before judging the diff." },
    { name: "Read for risk", blurb: "Correctness, security, performance, edge cases — in that order of importance." },
    { name: "Kind, specific feedback", blurb: "Suggestions over commands; explain the 'why' of a concern." },
    { name: "Self-review first", blurb: "Run the diff through your own eyes before asking anyone else." },
    { name: "Small, focused changes", blurb: "The best review is a small diff — reviewability is a feature of the author's work." }
  ],
  points: [
    "'I review for correctness and risk first, style and nits last.'",
    "'I leave reviews I'd want to receive: specific, actionable, kind.'",
    "'I self-review and run the tests before requesting a review.'",
    "'I ask questions — why here? — rather than issuing commands.'"
  ],
  traps: [
    "Nitpicking style while missing a logic bug.",
    "Blocking merges on personal preference.",
    "Approving without understanding the change.",
    "Reviewing only after the PR has grown huge."
  ],
  qa: [
    { q: "What do you look for when reviewing a pull request?", a: "First the intent: does the change do what the description says? Then correctness and risk: edge cases, error handling, security, performance. Then test coverage: is the behavior that matters covered? Finally style and naming, explicitly as nits. I leave blocking comments only for things that matter, and I explain why." },
    { q: "How do you give feedback on a teammate's code without friction?", a: "Comment on the code, not the person; frame as questions or suggestions with the 'why'; praise what's good explicitly; separate must-fix from nice-to-have. If something's unclear, assume good intent and ask. Review fast so the feedback is still relevant." }
  ],
  related: ["testing fundamentals", "communication", "debugging"]
};

const BEHAVIORAL: DeepDive = {
  concepts: [
    { name: "STAR structure", blurb: "Situation, Task, Action, Result — the skeleton of every story." },
    { name: "Quantified results", blurb: "Numbers, timeframes and scope — outcomes that land." },
    { name: "Own the outcome", blurb: "Your role explicitly, including failures and the lesson." },
    { name: "Leadership signals", blurb: "Influence without authority, mentoring, and raising the bar." },
    { name: "Story bank", blurb: "Have 4–6 rehearsed stories covering conflict, failure, leadership, impact." }
  ],
  points: [
    "'I structure every story as STAR: situation, task, action, result.'",
    "Name the outcome with numbers: scale, time saved, measurable impact.",
    "For failures: what you learned and what you changed.",
    "'Here's specifically what I did' — your role, not just the team's."
  ],
  traps: [
    "Rambling past two minutes without structure.",
    "Vague results — 'it went well' — with no metrics.",
    "Taking all the credit or none of it.",
    "Scripts that sound rehearsed."
  ],
  qa: [
    { q: "Tell me about a time you had a conflict with a teammate.", a: "STAR it: the situation (a real disagreement), the task (we needed a decision), the action (I listened, argued from data or a small experiment, and we reached a decision together — or escalated cleanly), the result (what shipped and what it taught you). The interviewer is testing whether you handle disagreement professionally, not whether you won." },
    { q: "Tell me about a time you failed and what you changed.", a: "Pick a real failure with real stakes. Structure: what I attempted, what went wrong and why (own it — no blaming), what I changed as a result (process, checks, communication), and what happened next. A good answer shows self-awareness and that the lesson stuck." }
  ],
  related: ["communication", "cross-team collaboration", "executive communication"]
};

const LEADERSHIP: DeepDive = {
  concepts: [
    { name: "Vision & direction", blurb: "Define outcomes and constraints, not just tasks." },
    { name: "Influence without authority", blurb: "Aligning peers and stakeholders through clarity and trust." },
    { name: "Trade-offs at scale", blurb: "Cost, risk, speed and quality — and making the call." },
    { name: "Org building", blurb: "Hiring bars, processes, and culture that compounds." },
    { name: "Execution & review", blurb: "Metrics, checkpoints, and course correction." }
  ],
  points: [
    "'I define the outcome, the constraints, and the review points.'",
    "'Decisions come with named trade-offs and a date to revisit.'",
    "'I measure what matters and kill what doesn't.'",
    "'I build the bar for the role, then hire and mentor to it.'"
  ],
  traps: [
    "Direction without measurable outcomes.",
    "Deciding in isolation and selling late.",
    "Optimizing process over people.",
    "Ignoring feedback loops until too late."
  ],
  qa: [
    { q: "How do you set technical direction for a team?", a: "Start from the business outcome, then translate it into technical principles and a roadmap with explicit trade-offs. Socialize early — get input before the decision, not after. Write the decision down with the alternatives considered, and define what success looks like so you can review it honestly later." },
    { q: "How do you handle a project that's behind schedule?", a: "First, understand why — scope, estimates, dependencies, or surprises. Then re-plan honestly: what's the critical path, what can be cut or deferred, and what does the stakeholder actually need by when. Communicate the new plan early with options, not just bad news, and set up a checkpoint so it doesn't slip again silently." }
  ],
  related: ["executive communication", "risk management", "technical vision", "communication"]
};

/* ------------------------------------------------------------------ */
/* Registry + resolver                                                  */
/* ------------------------------------------------------------------ */

const DEEP_DIVE: Record<string, DeepDive> = {
  "language basics": LANGUAGE_BASICS,
  "testing fundamentals": TESTING_FUNDAMENTALS,
  "data structures": DATA_STRUCTURES,
  "data structures & algorithms": DATA_STRUCTURES,
  "debugging": DEBUGGING,
  "communication": COMMUNICATION,
  "javascript / typescript": JS_TS,
  "react · vue · angular": FRONTEND_FRAMEWORKS,
  "css & accessibility": CSS_A11Y,
  "web performance": WEB_PERF,
  "apis & services": APIS_SERVICES,
  "databases & caching": DATABASES_CACHING,
  "system design": SYSTEM_DESIGN,
  "moderate system design": SYSTEM_DESIGN,
  "large-scale systems": SYSTEM_DESIGN,
  "distributed systems": DISTRIBUTED_SYSTEMS,
  "design patterns": DESIGN_PATTERNS,
  "code review": CODE_REVIEW
};

const BEHAVIORAL_RE = /tell me about a time|conflict|proud|failed|disagreed|mistake|behavioral|star story|teamwork/;
const LEADERSHIP_RE = /architecture|strategy|vision|org-?wide|platform|hiring bar|technical direction/;

/** Resolves a topic label to structured deep-dive content. Exact match first,
    then keyword groups (behavioral stories, leadership), then a synthesized
    fallback so every topic renders a complete panel. */
export function getDeepDive(label: string): DeepDive {
  const key = norm(label);
  const direct = DEEP_DIVE[key];
  if (direct) return direct;
  if (BEHAVIORAL_RE.test(key)) return BEHAVIORAL;
  if (LEADERSHIP_RE.test(key)) return LEADERSHIP;
  return synthesize(label);
}

/** Drill cards derived from the authored knowledge base (QA pairs become
    flashcards, key points become recall prompts). No filler: only authored
    entries, deduped by question text. Levels are tagged mid so they show up
    in the default "all" filter and every mid+ selection. */
export function deepDiveCards(): { q: string; a: string; kp: string[]; lvl: LevelId }[] {
  const out: { q: string; a: string; kp: string[]; lvl: LevelId }[] = [];
  const seen = new Set<string>();
  const entries = [...Object.values(DEEP_DIVE), BEHAVIORAL, LEADERSHIP];
  for (const dd of entries) {
    for (const item of dd.qa) {
      if (seen.has(item.q)) continue;
      seen.add(item.q);
      out.push({ q: item.q, a: item.a, kp: dd.points.slice(0, 3), lvl: "mid" });
    }
  }
  return out;
}

/** True when the label resolves to an authored deep-dive (not the fallback). */
export function hasDeepDive(label: string): boolean {
  return !!DEEP_DIVE[norm(label)] || BEHAVIORAL_RE.test(norm(label)) || LEADERSHIP_RE.test(norm(label));
}

/** Generic but genuinely useful structure for any unmapped topic. */
function synthesize(label: string): DeepDive {
  const t = label.charAt(0).toUpperCase() + label.slice(1);
  return {
    concepts: [
      { name: "Core fundamentals", blurb: `The essential concepts behind ${t} — know these cold before the interview.` },
      { name: "Common patterns & approaches", blurb: "The standard approaches interviewers expect, and when each one fits." },
      { name: "Trade-offs", blurb: "Every approach has costs — practice comparing options and justifying your pick." },
      { name: "Real-world application", blurb: `Be ready to tie ${t} back to a project you actually shipped.` }
    ],
    points: [
      `Open with a one-line definition of ${t} before going deeper.`,
      "Structure your answer: approach → reasoning → trade-offs → example.",
      "Name the standard tools and practices in this area and why you chose them.",
      "Quantify impact where you can — time saved, scale, reliability."
    ],
    traps: [
      "Jumping into details without defining the problem first.",
      "Using jargon without explaining it in plain terms.",
      "Claiming expertise without a concrete example to back it up.",
      "Ignoring the trade-offs of the approach you recommend."
    ],
    qa: [
      {
        q: `Walk me through how you approach ${t}.`,
        a: `A strong answer covers: what the problem actually is, the standard approaches, the trade-offs of each, what you'd choose and why — then a concrete example from your experience. Finish by inviting questions.`
      }
    ],
    related: []
  };
}
