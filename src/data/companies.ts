import type { Company } from "../types";

export const GENERAL_COMPANY: Company = {
  id: "general", name: "General / Any company", icon: "🌐",
  tagline: "Broad, balanced questions for any technical interview.",
  hq: "Everywhere", difficulty: 3,
  stack: ["General engineering practice"],
  values: ["Fundamentals", "Communication", "Problem solving"],
  style: "A well-rounded mix of technical, behavioral, and design questions.",
  sample: []
};

export const COMPANIES: Company[] = [
  {
    id: "google", name: "Google", icon: "🔍",
    tagline: "Search, Android, Cloud, AI",
    hq: "Mountain View, CA", difficulty: 4,
    stack: ["Go", "Java", "Python", "C++", "Kubernetes", "Spanner", "Bigtable", "TensorFlow"],
    values: ["Focus on the user", "Think 10x", "Data-driven decisions", "Move fast without breaking things"],
    style: "Structured rounds: coding, system design, product sense, and 'Googleyness'. Expect follow-ups that dig one level deeper every time.",
    sample: [
      { q: "How would you design a system that serves trending searches with sub-second latency?",
        a: "Two problems: compute trends and serve them fast. Trend computation consumes a stream of search events, aggregates counts in sliding time windows (count-min sketch for memory efficiency), and ranks the deltas. Serving is a read-heavy cache: trending lists are small, recomputed every few minutes, cached at the edge (CDN) and in-memory, so requests never hit the database. Personalization can layer on top with user context. The tradeoffs are freshness vs cost and the risk of echo chambers from regional popularity.",
        kp: ["streaming event aggregation", "sliding time windows", "count-min sketch", "cache trending lists at edge", "freshness vs cost tradeoff", "personalization layer"] },
      { q: "Design a rate limiter for Google's public APIs.",
        a: "Scale and distribution are the defining constraints: enforce limits across many front-end servers with a shared, fast store (like Redis or a distributed counter), using a token bucket or sliding window per API key. Decisions: limits per key, per user, per endpoint, with burst allowances. Return 429 with Retry-After, and make the limiter itself horizontally scalable and never the bottleneck — degrade gracefully if the counter store is down. Log quota usage for abuse detection and quota analytics.",
        kp: ["distributed shared counter store", "token bucket sliding window", "per key per endpoint limits", "429 with retry-after", "graceful degradation", "abuse detection telemetry"] },
      { q: "Walk me through how you'd improve the quality of a search engine's results.",
        a: "Define quality metrics first: relevance (NDCG on judged queries), user signals (click-through, dwell time, abandonment), and freshness. Build an evaluation set of hand-judged queries and a feedback loop from user behavior. Then improve in layers: query understanding (spelling, synonyms, intent classification), ranking features (relevance, authority, freshness, personalization), and serving (result diversity, snippets). Every change ships behind an experiment with guardrails, because search is a system where offline gains don't always translate online.",
        kp: ["judged evaluation set", "relevance metrics NDCG", "user behavior signals", "query understanding layers", "experimentation with guardrails", "offline vs online validation"] },
      { q: "Tell me about a time you had to choose between shipping fast and shipping right.",
        a: "The strong answer follows STAR: a specific situation, what you actually did, the measured outcome. Google interviewers want to hear you reason about tradeoffs explicitly — how you defined 'right' (correctness, security, scalability), what the cost of delay was, and how you de-risked the fast path (feature flags, canary, follow-up fix). They also probe your judgment: when the tradeoff is genuinely false, say so. End with the lesson and how it changed your future decisions.",
        kp: ["specific STAR example", "explicit tradeoff reasoning", "defined right and cost of delay", "de-risked fast path", "measured outcome", "lesson applied forward"] }
    ]
  },
  {
    id: "meta", name: "Meta", icon: "📘",
    tagline: "Social platforms, AI, VR",
    hq: "Menlo Park, CA", difficulty: 4,
    stack: ["React", "Hack/PHP", "Python", "C++", "GraphQL", "Cassandra", "TAO", "PyTorch"],
    values: ["Move fast", "Focus on long-term impact", "Be direct", "Be bold"],
    style: "Coding rounds on a shared editor with follow-ups, plus behavioral rounds asking for specific past examples. Direct, fast-paced, outcome-focused.",
    sample: [
      { q: "Design a News Feed that serves a billion users.",
        a: "The core is fan-out: on write (push stories to followers' caches at write time) vs on read (pull/merge at request time) — most large systems use a hybrid: fan-out on write for regular users, on read for celebrities with millions of followers. Ranking combines recency, affinity, and content signals, computed in a scoring service. The feed is cached per-user with pagination cursors; heavy read traffic is absorbed by cache tiers. Consistency: eventual is fine — a story appearing slightly late beats the cost of synchronous fan-out.",
        kp: ["fan-out on write vs read", "hybrid for high-follower users", "ranking signals recency affinity", "per-user cached feed", "pagination cursors", "eventual consistency tradeoff"] },
      { q: "How would you build a real-time presence and typing indicator for a chat app?",
        a: "Presence: each client maintains a WebSocket; the server tracks per-user connection state and publishes presence changes to subscribed friends, with heartbeat timeouts for staleness. Typing indicators: throttled events (typing, stopped) broadcast to the conversation's participants, not stored — they're ephemeral. Scale concerns: a presence service holding connection state must be sharded by user, and fan-out to large groups needs efficient pub/sub. Handle disconnects gracefully — 'online' is a lie the moment a client is silent, so define staleness honestly.",
        kp: ["websocket connection state", "heartbeat and staleness", "throttled typing events", "pub sub fan-out", "shard presence by user", "ephemeral not stored"] },
      { q: "How do you reduce the latency of a mobile app's cold start?",
        a: "Measure the phases first: process start, framework init, first frame, first content. Attacks: defer non-critical initialization (analytics, SDKs) off the critical path, lazy-load modules, keep the first screen's data local or prefetched, minimize the binary size and JIT work, and render a meaningful placeholder instantly. On Android: avoid heavy work in Application.onCreate. On iOS: watch view controller init and first layout. Track cold start as a metric with a budget, and use profiles, not guesses, to find the real cost.",
        kp: ["measure cold start phases", "defer non-critical init", "lazy load modules", "prefetch first screen data", "minimize binary and jit work", "cold start as budgeted metric"] },
      { q: "Tell me about a time you moved fast and broke something. What did you do?",
        a: "Meta explicitly wants speed with ownership — the interview is about how you handled the aftermath, not the mistake itself. A strong answer: a specific incident, how you detected it, how you contained it (rollback, feature flag), how you communicated, and the systemic fix that made it unrepeatable. Emphasize owning the outcome end-to-end rather than blaming process, and what you changed in your own workflow. Avoid choosing an example that shows reckless disregard for users.",
        kp: ["specific real incident", "fast detection and containment", "ownership not blame", "systemic fix", "communication", "changed behavior going forward"] }
    ]
  },
  {
    id: "amazon", name: "Amazon", icon: "📦",
    tagline: "E-commerce, AWS, logistics",
    hq: "Seattle, WA", difficulty: 4,
    stack: ["Java", "AWS", "DynamoDB", "Lambda", "S3", "Kafka"],
    values: ["Customer obsession", "Ownership", "Bias for action", "Frugality", "Deliver results", "Have backbone"],
    style: "Leadership Principles behavioral rounds with 'tell me about a time' questions, plus system design and coding. Expect 'why Amazon?' and deep dives into your past projects.",
    sample: [
      { q: "Tell me about a time you had to make a decision with incomplete information.",
        a: "This is a Leadership Principles question (Bias for action + Are right a lot). Structure: the decision and why it couldn't wait, what you did to gather information fast (experiments, talking to customers, prototypes), the decision itself with your reasoning, and the outcome — including how you monitored and corrected course. Amazon wants evidence you can move with 70% of the information and adjust, not analysis paralysis. Quantify the outcome where you can.",
        kp: ["decision with time pressure", "gathered information fast", "explicit reasoning", "acted with partial data", "monitored and corrected", "measured outcome"] },
      { q: "Design a system that tells customers when their package will arrive.",
        a: "Split it: order → fulfillment center → carrier → doorstep. The ETA model consumes events from each stage (scan, sort, pickup, delivery attempt) and predicts remaining time using historical carrier performance, distance, and anomalies (weather, holidays). Serving: the promise shown to customers must be conservative — under-promising beats missing. Architecture: event stream for tracking, a prediction service, a cache for the customer-facing promise, and a feedback loop comparing predicted vs actual to improve the model. Handle the failure mode: when tracking data is missing, degrade to a windowed estimate, not a confident lie.",
        kp: ["event stream of shipment stages", "prediction model historical performance", "conservative promises", "feedback loop predicted vs actual", "graceful degradation on missing data", "customer-facing cache"] },
      { q: "How would you design a shopping cart service that never loses a customer's items?",
        a: "Durability and availability over everything: cart state is written synchronously to a replicated store (DynamoDB-style) before the user gets confirmation; reads can hit cache. Concurrency: versioned updates so two tabs don't silently overwrite each other — last-write-wins only for low-stakes fields, merge or prompt for conflicts. Cart must survive login/logout, device switches, and abandoned sessions (persist with TTL and restore on return). Idempotency for add/remove operations so retries are safe, and instrumentation to catch the silent data loss that availability-focused designs hide.",
        kp: ["durable replicated writes", "versioned conflict handling", "survives login and devices", "abandoned cart restore", "idempotent mutations", "instrumentation for data loss"] },
      { q: "Tell me about a time you disagreed with a decision made by your team or manager.",
        a: "Amazon's 'Have backbone; disagree and commit' wants: you had a real disagreement, you voiced it constructively with data, you escalated appropriately if needed, and then — if the decision went the other way — you committed fully and executed. The test is whether you can both push back and execute. Show respect for the decision-maker, evidence for your position, and no lingering resentment in your delivery. End with the outcome, whether your view won or not.",
        kp: ["real disagreement with evidence", "voiced constructively", "appropriate escalation", "disagree and commit", "executed fully", "reflection on outcome"] }
    ]
  },
  {
    id: "microsoft", name: "Microsoft", icon: "🪟",
    tagline: "Windows, Azure, Office, AI",
    hq: "Redmond, WA", difficulty: 3,
    stack: ["C#", "TypeScript", ".NET", "Azure", "SQL Server", "VS Code", "OpenAI partnership"],
    values: ["Growth mindset", "Customer obsession", "Diverse and inclusive", "One Microsoft"],
    style: "Structured rounds with coding, system design, and STAR behavioral questions. Values collaboration and learning; 'tell me about a time you learned something hard' is a classic.",
    sample: [
      { q: "How would you design a cloud storage service like OneDrive (file sync)?",
        a: "Core pieces: object storage for file content, a metadata service for the file tree and versions, and a sync client that uploads/downloads with delta sync and conflict resolution. The sync protocol is the heart: change detection, chunked uploads with resume, server-side change log so clients catch up efficiently, and conflict policies (both versions kept, renamed). Add sharing with permissions, offline access with a local cache, and encryption at rest and in transit. Failure handling: partial uploads, interrupted syncs, and reconciliation when client and server disagree.",
        kp: ["object storage plus metadata service", "delta sync and chunked resume", "change log for catch-up", "conflict resolution policy", "offline local cache", "reconciliation on disagreement"] },
      { q: "Explain the CAP theorem and how Azure Cosmos DB handles it.",
        a: "CAP: under a network partition you choose consistency or availability. Cosmos DB's value is making the choice tunable per request — consistency levels from strong to eventual (bounded staleness, session, consistent prefix, eventual) with corresponding latency and availability tradeoffs, all on a multi-region, multi-master replicated store. You can have a strong-consistency path for money operations and eventual for the feed, in one service. The interview point: know that 'tunable consistency' means you must understand your application's real consistency needs and pick deliberately.",
        kp: ["partition forces consistency vs availability", "tunable consistency levels", "bounded staleness session consistent prefix", "multi-region multi-master", "strong for money eventual for feed", "deliberate consistency choices"] },
      { q: "Tell me about a time you learned a new technology quickly to get the job done.",
        a: "Microsoft's growth mindset is the theme. Pick a real example with stakes: the technology, why it mattered, your learning method (structured course, building something real, pairing with an expert), how you applied it, and the outcome. They want to see how you learn, not that you knew it already: show deliberate practice, comfort being a beginner, and turning learning into shipped results. A good answer includes what you'd do differently next time.",
        kp: ["real stakes and why it mattered", "deliberate learning method", "applied to real work", "measured outcome", "comfort being a beginner", "reflection on learning process"] },
      { q: "Design an AI assistant integration for a productivity product.",
        a: "Architecture: a gateway that takes user prompts with product context, calls the LLM with retrieval augmentation (index the user's documents/data so answers are grounded), and streams responses. The hard parts: grounding and accuracy (retrieval quality, citations, hallucination guards), cost and latency control (prompt caching, model tiering, rate limits), privacy (data stays in tenant, no training on customer data), and safety (prompt injection defenses when the assistant reads user documents). Add observability: cost per request, quality sampling, and feedback collection.",
        kp: ["gateway with product context", "retrieval augmented generation", "grounding and citations", "prompt injection defense", "cost latency control and caching", "tenant privacy guarantees"] }
    ]
  },
  {
    id: "apple", name: "Apple", icon: "🍎",
    tagline: "Hardware, software, services",
    hq: "Cupertino, CA", difficulty: 4,
    stack: ["Swift", "Objective-C", "C/C++", "Metal", "WebKit", "Privacy technologies"],
    values: ["Design excellence", "Privacy by design", "Simplicity", "Craft and attention to detail"],
    style: "Deep technical rounds, craft-focused. Expect questions about your actual projects with relentless follow-ups, plus design sensibility and privacy awareness.",
    sample: [
      { q: "How do you keep a scrolling list buttery smooth at 60fps?",
        a: "The main thread must never do heavy work: offload image decode, avoid layout in scroll callbacks, reuse cells, and keep cell construction cheap. On iOS specifically: prefetch (UICollectionView prefetching), draw once and cache, avoid shadow/opacity animations that force offscreen rendering, and profile with Instruments (Core Animation, Time Profiler) to find the actual cost. Set a frame drop budget and verify with real-device testing, because simulators lie. The craft answer shows you know the profile is where the truth is.",
        kp: ["main thread stays free", "offload image decode", "cell reuse and cheap construction", "prefetch and cached drawing", "profile with instruments", "verify on real devices"] },
      { q: "Explain how you'd design a feature with privacy as a first-class requirement.",
        a: "Start from Apple's stance: data minimization — collect the least data, process on-device where possible, and never use user data for purposes they didn't consent to. Design: on-device processing (e.g., on-device ML or local analytics) before any server involvement, differential privacy or aggregation for telemetry, end-to-end encryption for user content, and clear, honest consent flows with easy revocation. Engineering: make privacy the default path (no telemetry without explicit opt-in, app transport security on), and design the data model so nothing unnecessary is stored in the first place.",
        kp: ["data minimization", "on-device processing first", "end-to-end encryption", "honest consent and revocation", "privacy as default not opt-out", "differential privacy telemetry"] },
      { q: "Design a system that syncs a user's photos across devices.",
        a: "The library is the source of truth, synchronized via a change log: each device applies remote changes and uploads its own with conflict resolution (usually both versions kept with metadata merging). Photos need efficient transfer: full-res originals with optimized device-sized versions, incremental uploads with checksums, and background sync that respects battery and data budgets. Deduplication and content hashing avoid double uploads; the server stores versions and manages device preferences. Add: end-to-end encryption, since photo privacy is non-negotiable, and recovery — the library must survive device loss.",
        kp: ["library as source of truth", "change log sync protocol", "conflict resolution", "optimized and full-res versions", "incremental checksummed uploads", "end-to-end encryption"] },
      { q: "Describe a project where you obsessed over the details. What did you do?",
        a: "Apple's culture wants evidence of craft: pick something where the difference between good and excellent was visible to users — a micro-interaction, a performance edge, a pixel-perfect layout, an error state designed with care. Show your process: how you noticed the weakness, the iterations (with users or critique), the tradeoffs you rejected, and the final result. Quantify where possible (a 30% faster startup, a crash rate to zero) and connect the detail to the product experience.",
        kp: ["detail users could see", "process of iteration", "tradeoffs considered and rejected", "measured improvement", "connected to user experience", "craft mindset"] }
    ]
  },
  {
    id: "netflix", name: "Netflix", icon: "🎬",
    tagline: "Streaming, content, culture",
    hq: "Los Gatos, CA", difficulty: 4,
    stack: ["Java", "Node.js", "React", "GraphQL", "AWS", "Cassandra", "Spinnaker", "Chaos engineering"],
    values: ["Judgment", "Impact", "Curiosity", "Courage", "Freedom and responsibility", "The Keeper Test"],
    style: "High-performance culture. Interviews probe judgment and impact; expect 'what would you do differently?' and culture-fit rounds about freedom and responsibility.",
    sample: [
      { q: "Design a video streaming service that must never buffer.",
        a: "Never buffering is impossible, so design the experience: adaptive bitrate (ABR) — encode multiple qualities per second, and the player switches quality based on measured bandwidth and buffer health, prioritizing playback continuity over resolution. Content is served from a CDN with caches near users; the most popular content is pre-seeded. The control plane (catalog, recommendations) is separate from the data plane (video bytes). Degradation is by design: lower quality gracefully rather than a frozen frame, and track buffer health as a first-class metric.",
        kp: ["adaptive bitrate streaming", "quality ladder encodings", "player buffer management", "CDN with edge caching", "control plane data plane separation", "buffer health metrics"] },
      { q: "How would you design a global content delivery network?",
        a: "Layers: origin storage, a hierarchy of caches (regional → edge), and DNS-based routing that sends users to the nearest healthy cache. The interesting problems: cache admission and eviction (what gets cached where — popularity drives this), warm vs cold starts (pre-position popular content before traffic arrives), and failure handling (cache misses escalate to origin; origin must survive stampedes — use request coalescing and capacity headroom). Measure: hit ratio by tier, latency by region, and cost per delivered byte. The economics matter as much as the architecture.",
        kp: ["cache hierarchy regional to edge", "dns routing to nearest cache", "popularity-driven placement", "request coalescing on misses", "hit ratio and latency metrics", "cost per byte economics"] },
      { q: "Explain chaos engineering and how you'd introduce it to a team.",
        a: "Chaos engineering is confidence through controlled failure: form a steady-state hypothesis (the system keeps serving under this failure), design an experiment with a small blast radius, run it in production or staging, observe, and learn. Start boring: kill a node, fail a dependency, add latency to a service. Prerequisites: observability (you can't learn from chaos you can't see), a blameless culture, and rollback plans. Netflix runs automated chaos (Chaos Monkey) because their architecture must survive instance loss as a design requirement, not an accident.",
        kp: ["steady-state hypothesis", "small blast radius first", "observability prerequisite", "blameless learning", "automated chaos at scale", "survivable by design"] },
      { q: "Tell me about a time you had a big impact on a product or system.",
        a: "Netflix's Impact value wants scale and ownership: pick something with measurable, significant outcomes — a performance win, a cost reduction, a feature that moved a business metric. Quantify aggressively (X% faster, $Y saved, Z% conversion) and be honest about your specific contribution vs the team's. Show judgment: how you chose this problem over others, how you drove it to completion through ambiguity, and what you'd do differently. The Keeper Test subtext: they're evaluating whether you're the kind of engineer they'd fight to keep.",
        kp: ["measurable significant outcome", "your specific contribution", "judgment in choosing problem", "drove through ambiguity", "quantified impact", "honest reflection"] }
    ]
  },
  {
    id: "stripe", name: "Stripe", icon: "💳",
    tagline: "Payments infrastructure",
    hq: "San Francisco / Dublin", difficulty: 5,
    stack: ["Ruby", "Go", "Scala", "React", "TypeScript", "PostgreSQL", "Kafka", "ML"],
    values: ["Users first", "Global optimization", "Sweat the details", "Build to last", "Play long-term games"],
    style: "Among the hardest: deep API design taste, distributed systems, and 'write an API' questions. Expect sharp follow-ups on edge cases and failure modes.",
    sample: [
      { q: "Design an idempotency layer for a payments API.",
        a: "The API must be retry-safe: clients send an Idempotency-Key header, the server stores the request hash and response keyed by that key with a TTL, and retries return the original result instead of double-charging. Storage: a dedicated table with the key as primary key and a unique constraint; concurrent first-time requests need atomic insert-or-return (or a lock) so two racing retries can't both execute. Scrub the stored data for compliance (keys expire, responses truncated). Also handle: key reuse across different requests is an error, and key collisions are a correctness bug that costs money.",
        kp: ["idempotency key from client", "store request hash and response", "atomic insert to prevent races", "retry returns original result", "ttl and data scrubbing", "key reuse is an error"] },
      { q: "Walk me through what happens when a customer pays with Stripe.",
        a: "The payment journey: the client creates a PaymentIntent, Stripe returns a client secret, the customer authorizes (card details via Stripe.js/Element or a redirect for wallets), and Stripe confirms with the network. The money moves through: authorization → capture (or automatic capture) → settlement, with the balance updated via a ledger — double-entry, append-only, reconciled against network reports. Webhooks notify the merchant asynchronously (idempotent, signed). Failure paths: decline (3DS challenges, retry logic), timeouts (reconciliation catches ambiguity), and refunds as separate flows with their own lifecycle.",
        kp: ["payment intent lifecycle", "authorization capture settlement", "append-only double-entry ledger", "signed idempotent webhooks", "decline and 3ds handling", "reconciliation for ambiguous outcomes"] },
      { q: "Design a dashboard API that reports revenue metrics in real time.",
        a: "The hard part is what 'real time' means for money: reporting must be correct, so the pipeline is: ledger events → stream → aggregation service → serving API, with a reconciliation pass that corrects the real-time numbers against the settled truth. Design for correctness over immediacy: show provisional numbers clearly labeled, and let final numbers replace them. Serving: pre-aggregated rollups (daily, monthly, per merchant) in a fast store with cache; the API paginates and filters server-side. Guard the join: metrics must be consistent across endpoints (same definitions everywhere) or the dashboard loses trust.",
        kp: ["ledger events to aggregation pipeline", "reconciliation against settled truth", "provisional vs final labeling", "pre-aggregated rollups", "consistent metric definitions", "server-side filtering pagination"] },
      { q: "Tell me about a time you sweat the details on something customers noticed.",
        a: "Stripe's 'sweat the details' values the last 5%: pick an example where the polish was visible — an error message that turned a support ticket into a self-serve fix, a latency improvement users felt, an API design that made integration painless. Show the iteration: how you found the weakness, the alternatives you considered, and why you chose the one you did. Include a tradeoff you made deliberately. The subtext: Stripe believes details compound into trust, and they're hiring for that instinct.",
        kp: ["visible customer-facing detail", "iteration process", "alternatives considered", "deliberate tradeoff", "measured result", "details compound into trust"] }
    ]
  },
  {
    id: "airbnb", name: "Airbnb", icon: "🏠",
    tagline: "Travel marketplace",
    hq: "San Francisco, CA", difficulty: 3,
    stack: ["Ruby on Rails", "React", "TypeScript", "GraphQL", "Kafka", "MySQL", "ML"],
    values: ["Champion the mission", "Be a host", "Embrace the adventure", "Simplify", "Every frame matters"],
    style: "Product-sense heavy: design questions that start from user needs. Mission-driven behavioral rounds. Expect 'design a feature' questions with a UX-first lens.",
    sample: [
      { q: "Design a search and discovery feature for a travel marketplace.",
        a: "Start from the user: filtering by location, dates, price, and amenity preferences, ranked by relevance (location match, reviews, price value, popularity). Architecture: search index (Elasticsearch) with filters and ranking, backed by a pipeline that indexes listings with fresh availability and pricing. The product layer: map-first vs list view, search suggestions, and saved searches. Ranking is the product: what makes a great match — and the answer should include experimentation (A/B tests) and learning from booking outcomes, not clicks.",
        kp: ["user-first requirements", "search index with filters", "relevance ranking signals", "availability and pricing freshness", "map and list views", "optimize for bookings not clicks"] },
      { q: "How would you handle duplicate or spam listings at scale?",
        a: "Layered detection: rules at ingest (blocked patterns, velocity checks, known-bad signals), ML classification on listing content and images (duplicate detection via embeddings, spam patterns), and human review for the ambiguous tail with a trust and safety workflow. The harder, product-level work: identity verification at signup, reputation signals (reviews, host history), and making the cost of abuse high (payments friction). Track abuse metrics and iterate — spammers adapt, so detection is a treadmill, not a project.",
        kp: ["rules at ingest", "ml duplicate and spam detection", "embeddings for similarity", "human review for tail", "identity and reputation signals", "abuse as ongoing treadmill"] },
      { q: "Design a reviews system that users trust.",
        a: "Trust is the product: both sides review (guest and host) with private feedback to reduce retaliation, reviews are locked in (can't be edited after a window, or only with transparency) to prevent pressure, and content moderation catches abusive or fake reviews. The system: review creation flow with structured categories plus free text, a moderation pipeline (automated + human), and scoring that resists gaming (recency weighting, outlier handling). Show the marketplace lens: reviews are the information that makes strangers transact, so integrity beats volume.",
        kp: ["two-sided reviews", "anti-retaliation design", "locked reviews with transparency", "moderation pipeline", "gaming resistance in scoring", "integrity over volume"] },
      { q: "Tell me about a time you championed the user in a product decision.",
        a: "Airbnb's mission value wants the user's voice in your decision-making: a real example where you pushed for the user experience against pressure (deadline, cost, or opinion), how you made the case (research, data, prototypes), and the outcome. Show empathy as an engineering skill: how you understood the user's context and translated it into a technical or product decision. End with what the company or users gained.",
        kp: ["real user-centered decision", "made case with evidence", "understood user context", "pushed back constructively", "outcome for users", "empathy as engineering skill"] }
    ]
  },
  {
    id: "uber", name: "Uber", icon: "🚗",
    tagline: "Mobility and delivery",
    hq: "San Francisco, CA", difficulty: 4,
    stack: ["Go", "Java", "Python", "React Native", "Kafka", "MySQL", "Postgres", "Machine learning"],
    values: ["Customer obsession", "We before me", "Act like an owner", "Always hustle"],
    style: "System design heavy — 'design Uber' is a classic. Real-time, geo-distributed systems with availability demands. Behavioral rounds probe ownership and hustle.",
    sample: [
      { q: "Design the dispatch system that matches riders and drivers.",
        a: "The constraints: real-time (sub-second matching), geo-distributed, and availability-critical. Architecture: drivers stream GPS to a location service (geohashed or spatial index); a dispatch service matches supply to demand optimizing a global objective (ETAs, utilization, fairness) with a batch-and-solve approach — rebalance every few seconds rather than greedily. ETA estimation needs a live map/route service. Degradation: when location data lags, match on last-known with confidence checks; when dispatch is overloaded, fall back to simpler matching rather than failing. Measure the whole thing on dispatch latency and utilization, not just match rate.",
        kp: ["driver location stream", "geohash spatial indexing", "batch matching optimization", "live eta and routing", "graceful degradation on stale data", "dispatch latency metrics"] },
      { q: "How would you estimate ETAs accurately across a city?",
        a: "Layered estimation: real-time traffic (probe data from trips aggregated per road segment) blended with historical patterns (time of day, day of week) and static map data, with a fallback when live data is missing. The model: segment-level travel time prediction feeding a routing engine. The product layer: ETA must be honest and calibrated — a consistently wrong ETA erodes trust faster than a slower but accurate one. Monitor predicted vs actual systematically, and re-train on drift (new roads, weather, events).",
        kp: ["real-time traffic probes", "historical pattern blending", "segment travel time model", "honest calibrated promises", "predicted vs actual monitoring", "retrain on drift"] },
      { q: "Design a system that handles surge pricing during a rainstorm.",
        a: "Surge exists to balance supply and demand: when demand outpaces supply (rain, events, rush hour), prices rise to attract more drivers and allocate scarce supply to the highest-willingness riders. The system: real-time demand/supply imbalance detection per geo region, a pricing engine that adjusts multipliers with constraints (fairness caps, transparency), and instant propagation to riders before they book. The engineering: geo aggregation of supply/demand, low-latency pricing reads, and careful experimentation — surge affects behavior of both sides, so it's validated with controlled tests, and the incentives must be communicated honestly to users.",
        kp: ["supply demand imbalance detection", "geo-region aggregation", "pricing engine with fairness caps", "low-latency pricing propagation", "dual-sided behavior effects", "honest user communication"] },
      { q: "Tell me about a time you went above and beyond to solve a problem.",
        a: "Uber's hustle value: pick a real example where the problem was underspecified or urgent and you owned it end-to-end — took it beyond your scope, rallied the help you needed, and delivered. Show the specifics: what made it hard, the obstacles, what you did when things went wrong, and the measured result. Avoid humble-bragging about overwork; emphasize ownership and impact instead. They want to see the 'act like an owner' instinct in action.",
        kp: ["real underspecified problem", "owned it end-to-end", "rallied resources", "overcame obstacles", "measured result", "owner mindset"] }
    ]
  },
  {
    id: "spotify", name: "Spotify", icon: "🎵",
    tagline: "Music streaming",
    hq: "Stockholm / New York", difficulty: 3,
    stack: ["Java", "Kotlin", "Python", "React", "Kafka", "Cassandra", "BigQuery", "ML"],
    values: ["Innovation", "Collaboration", "Passion", "Sincerity"],
    style: "Squad-based culture — expect collaboration and autonomy questions. Product metrics and experimentation feature heavily, especially for data and backend roles.",
    sample: [
      { q: "Design a music recommendation system.",
        a: "The layers: candidate generation (collaborative filtering on listening behavior, content-based on audio features/embeddings, editorial and context playlists), then ranking (a model over features: user history, freshness, genre fit, context — morning vs workout). The feedback loop is the product: skips, repeats, and saves tell you what worked. Cold start: new users get curated/contextual picks; new tracks get audio-feature-based similarity. Evaluation: offline metrics (precision@k, NDCG) plus A/B tests on engagement and retention — because the real objective is long-term engagement, not clicks.",
        kp: ["collaborative and content-based candidates", "audio features and embeddings", "ranking with context features", "feedback loop skips saves", "cold start strategies", "offline metrics plus experiments"] },
      { q: "How do you measure the health of a feature like Discover Weekly?",
        a: "Start from the objective: does it drive long-term engagement and retention? Metrics: adoption (who uses it), engagement (listens, saves, session length), and the critical ones — retention lift for users who engage with it, and diversity of discovery (are users finding music they'd never find otherwise?). Guardrails: churn, skip rate, and diversity collapse. The analysis: cohort comparisons and A/B tests, watching not just the metric but the behavior beneath it — a feature can look great in aggregate and fail for specific segments.",
        kp: ["adoption engagement retention", "retention lift cohorts", "discovery diversity metric", "guardrail metrics", "segment-level analysis", "behavior beneath the metric"] },
      { q: "Design a system for streaming audio with seamless playback.",
        a: "The player pipeline: audio is encoded in multiple bitrates and chunked; the player downloads ahead (buffer) while playing, switching quality based on network conditions (adaptive bitrate). Seamlessness = predicting the next song (gapless playback, crossfade) and prefetching it during the current one. Offline: full-song downloads with smart caching (cache the tracks you'll likely play next). Server side: CDN with edge caches, session management, and rights-aware delivery (what you can play depends on licensing per region). The product metrics: playback failures, rebuffer rate, and time-to-first-play.",
        kp: ["adaptive bitrate chunked audio", "prefetch and buffering", "gapless and crossfade", "smart offline caching", "cdn and regional licensing", "playback failure metrics"] },
      { q: "Tell me about a time you collaborated across teams to ship something.",
        a: "Spotify's squad/guild model makes collaboration the interview theme: a real example where you worked across team boundaries (design, data, another squad), how you aligned goals and handled disagreement, and your specific contribution to the outcome. Show the mechanics: communication rituals, shared ownership, giving and receiving feedback. End with the result and what made the collaboration work — and be honest about what was hard.",
        kp: ["real cross-team example", "aligned goals across boundaries", "handled disagreement", "specific contribution", "communication mechanics", "honest about difficulty"] }
    ]
  },
  {
    id: "cloudflare", name: "Cloudflare", icon: "☁️",
    tagline: "CDN, security, edge",
    hq: "San Francisco / London", difficulty: 4,
    stack: ["Go", "Rust", "TypeScript", "Workers", "ClickHouse", "Kubernetes"],
    values: ["Trust", "Curiosity", "Scrappy", "Transparency"],
    style: "Technical depth on distributed systems at the edge. Expect questions about performance, scale, and failure — they literally run a global network.",
    sample: [
      { q: "How would you serve a request from the edge with sub-millisecond overhead?",
        a: "The edge is a proxy: DNS routes the user to the nearest PoP, TLS terminates there, and the request hits a highly optimized HTTP stack. The principles: keep the hot path in memory (no disk, no network hops), minimize allocations and copies, use connection reuse and HTTP/3, and avoid per-request lock contention. Where compute is needed, run it at the edge (Workers-style) so the user never leaves the PoP. Measure everything in overhead terms: the proxy's added latency must be a small, predictable constant, verified at scale with real traffic distributions.",
        kp: ["terminate at nearest PoP", "in-memory hot path", "minimize allocations and copies", "connection reuse http3", "edge compute avoids round trips", "measure overhead as budget"] },
      { q: "Design a WAF (Web Application Firewall) rule engine that runs at the edge.",
        a: "The constraint: evaluate rules against every request at the edge in microseconds. Architecture: compile rules (OWASP CRS + custom) into an efficient matching structure — optimized regex sets, bloom filters for cheap rejection, and early-exit evaluation — running in the request path in C/Rust/Wasm. The control plane: rule deployment must be global and fast (rule updates propagate to all PoPs in seconds) and atomic, because a bad rule is a global outage. Observability: match rates per rule, false positive detection (blocking legit traffic), and analytics so operators tune rules with data.",
        kp: ["compile rules to efficient matchers", "bloom filters and early exit", "run in request path", "fast atomic global rule deployment", "false positive monitoring", "operator analytics"] },
      { q: "How do you build and debug systems when every request can hit any of hundreds of edge locations?",
        a: "Key insight: edge systems are many identical replicas, so determinism and reproducibility matter more than in a central service. Build for it: identical binaries/configs everywhere (config diffs are the failure mode), request tracing that works across PoPs (every edge hop carries trace context), centralized logs/metrics with local sampling, and canary rollouts that ramp percentage of PoPs. Debugging: reproduce against the exact config (record and replay), use controlled chaos (kill a PoP, see what breaks), and lean on the fleet's statistics — a bug in 1 of 300 locations is a config skew or a hardware anomaly, not a code bug.",
        kp: ["identical replicas everywhere", "cross-pop trace context", "config skew as failure mode", "canary pop rollouts", "record replay reproduction", "fleet statistics debugging"] },
      { q: "Tell me about a time you made a system measurably faster.",
        a: "Cloudflare's 'scrappy' value wants evidence and numbers: pick a real optimization — latency, throughput, resource cost — with a before/after measured on real workloads. Show your method: profiling to find the actual bottleneck (not the guessed one), the change, the verification, and the guardrails that kept it fast (benchmarks, budgets). Include the tradeoffs you considered. A strong answer shows the discipline: measure → change → re-measure, and knowing when the optimization wasn't worth it.",
        kp: ["real measured optimization", "profiling found actual bottleneck", "before after on real workloads", "guardrails kept it fast", "considered tradeoffs", "measure change re-measure discipline"] }
    ]
  },
  {
    id: "datadog", name: "Datadog", icon: "📈",
    tagline: "Observability SaaS",
    hq: "New York, NY", difficulty: 3,
    stack: ["Go", "Python", "Java", "React", "Kafka", "ClickHouse", "Elasticsearch", "AWS"],
    values: ["Care about customers", "Wear the customer's shoes", "Be scrappy", "Own your outcomes"],
    style: "Practical systems questions: ingestion pipelines, time-series storage, debugging stories. Expect 'walk me through how you debugged something hard'.",
    sample: [
      { q: "Design a metrics ingestion pipeline that handles millions of time series.",
        a: "Agents on customer hosts collect and batch metrics, sending them to ingest gateways that validate and route to storage. The storage engine is the crux: time-series data is append-heavy with high cardinality, so design for compression (delta-of-delta timestamps, XOR values — the Gorilla approach), downsampling/rollups for long retention, and sharding by series. Query path: serve recent data from hot storage, rollups for older data. The whole pipeline must absorb bursts (agents retry with backoff, gateways shed load gracefully) and never lose the customer's data silently — drop metrics loudly.",
        kp: ["agent batching and retry", "ingest gateways with backpressure", "compression delta of delta", "downsampling and rollups", "shard by series", "loud not silent drops"] },
      { q: "How do you build a dashboard that stays fast while querying terabytes?",
        a: "The query path must never scan everything: pre-aggregate (rollups at multiple resolutions — 1s/1m/1h), push filters down to storage, and cache aggressively (same query twice → serve cache; dashboard refresh → serve cache while refreshing in background). Architect dashboards as a set of small, parallelizable queries with time bounds, and degrade gracefully: if the full-resolution query is too expensive, fall back to rollups, then to cached data — a slow dashboard is a useless dashboard. Add query cost limits and per-dashboard budgets so one team can't tax the cluster.",
        kp: ["pre-aggregated rollups", "pushdown filters", "cache with background refresh", "parallel small queries", "graceful resolution fallback", "query budgets"] },
      { q: "Walk me through the hardest production debugging you've done.",
        a: "Datadog hires people who've felt real production pain: pick a genuinely hard incident — intermittent, distributed, or mysterious — and walk through it like a story with a method: the symptom, the hypotheses you formed and eliminated, the evidence that cracked it (logs, traces, reproductions), the root cause, and the fix. End with the systemic improvement that made it unrepeatable (monitoring, tests, architectural change). The interviewer is evaluating your debugging discipline and honesty — include a wrong turn you took.",
        kp: ["hard real incident", "systematic hypothesis elimination", "evidence that cracked it", "root cause and fix", "systemic prevention", "honest about wrong turns"] },
      { q: "Tell me about a time you turned customer feedback into an engineering decision.",
        a: "Datadog's customer-obsession value: a real example where customer pain shaped what you built — how you heard it (support, usage data, direct conversations), how you validated it was real and general (not one loud customer), how you prioritized it, and the outcome. Show judgment in saying no to some requests, and show the loop closing: how you knew it worked (adoption, support tickets down, retention).",
        kp: ["real customer pain", "validated real and general", "prioritized with judgment", "shipped and measured", "said no to some requests", "closed the loop"] }
    ]
  }
];

export function companyById(id: string | null | undefined): Company {
  return COMPANIES.find(c => c.id === id) || GENERAL_COMPANY;
}
