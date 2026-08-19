/* Prerequisite Knowledge Base — beginner→advanced explanations for
   system design prerequisites, contextualized to specific case studies.
   Used by the FloatingCoach and CaseDrawer when a user taps a prerequisite chip. */

export interface PrereqExplanation {
  concept: string;
  beginner: string;
  intermediate: string;
  advanced: string;
  /** How this concept applies to specific case studies */
  caseStudyContext: Record<string, string>;
}

const PREREQ_KB: Record<string, PrereqExplanation> = {
  /* ── Networking ─────────────────────────────────────── */
  "http basics": {
    concept: "HTTP Basics",
    beginner: "HTTP (HyperText Transfer Protocol) is how browsers talk to servers. You send a request (GET, POST, PUT, DELETE) and get a response with a status code (200 OK, 404 Not Found, 500 Error). Every web app uses HTTP under the hood.",
    intermediate: "HTTP/1.1 opens a new TCP connection per request (slow). HTTP/2 multiplexes multiple requests over one connection (faster). HTTP/3 uses QUIC/UDP for even lower latency. Status codes matter: 301 = permanent redirect (cached), 302 = temporary (tracks analytics).",
    advanced: "For high-throughput systems, HTTP keep-alive reduces connection overhead. Connection pooling (nginx upstream) avoids exhausting server ports. HTTP/2 server push can pre-load resources. At scale, you'll choose between REST, gRPC (binary, faster), or WebSocket (persistent connection) based on latency and throughput needs.",
    caseStudyContext: {
      "url-shortener": "HTTP basics are critical here: the shortener returns 301 (permanent redirect, browser caches it) vs 302 (temporary redirect, you track analytics). At 100M URLs/day with 10:1 read:write, you're handling 12K HTTP redirect requests per second. Each must complete in <100ms.",
      "news-feed": "The news feed API uses HTTP GET for fetching feeds, POST for creating posts. Feed endpoints are read-heavy (9:1 ratio). HTTP caching headers (ETag, Cache-Control) help clients avoid re-fetching unchanged feeds.",
    }
  },
  "websockets": {
    concept: "WebSockets",
    beginner: "WebSockets create a persistent two-way connection between browser and server. Unlike HTTP (where the browser asks and server responds), both sides can send messages anytime. This is how chat apps, live games, and real-time notifications work.",
    intermediate: "WebSockets upgrade from HTTP to a persistent TCP connection. After the initial handshake, data flows bidirectionally with minimal overhead (~2 bytes framing vs ~800 bytes for HTTP headers). They survive across network changes (Wi-Fi ↔ cellular) via reconnection logic. Server must handle millions of concurrent WS connections — each uses ~10KB memory.",
    advanced: "WebSocket servers need sticky sessions (route same client to same server) or a message broker (Kafka/Redis Pub-Sub) to fan out messages across server instances. Heartbeat pings detect dead connections. For global scale, use a WebSocket gateway (like Pusher, Ably, or self-hosted with Socket.IO + Redis Adapter). Connection limits: a single node handles ~500K-1M WS connections with proper tuning (epoll, kernel buffer sizes).",
    caseStudyContext: {
      "chat-system": "WebSockets are the backbone of WhatsApp/Slack. Each user maintains a persistent WS connection to a chat server. Messages flow: User A → WS → Chat Server → WS → User B. At 50M daily active users with 5 concurrent connections each, you need 250M concurrent WS connections across your fleet. Message ordering uses sequence numbers per conversation.",
    }
  },
  "load balancing": {
    concept: "Load Balancing",
    beginner: "A load balancer distributes incoming traffic across multiple servers so no single server gets overwhelmed. Think of it like a restaurant host directing guests to different tables. If one server goes down, the load balancer stops sending traffic to it.",
    intermediate: "Common algorithms: Round Robin (simple), Least Connections (smarter), IP Hash (sticky sessions). L4 load balancers (HAProxy, AWS NLB) work at TCP level — fast but can't inspect content. L7 load balancers (nginx, AWS ALB) work at HTTP level — can route by URL path, headers, or cookies. Health checks detect dead servers every few seconds.",
    advanced: "At scale: global load balancing uses DNS (Route 53, Cloudflare) to route users to the nearest data center. Within a data center, use L7 for HTTP routing + L4 for raw TCP. Connection draining during deployments ensures in-flight requests complete. Consistent hashing minimizes redistribution when servers are added/removed. Two-tier LB: DNS → regional L4 → per-service L7.",
    caseStudyContext: {
      "url-shortener": "Load balancer sits between CDN edge and API servers. Distributes 1.2K writes/s and 12K reads/s across multiple API instances. Health checks remove unhealthy servers. For the redirect path, L4 LB is sufficient (just routing TCP). For the create-URL path, L7 LB enables routing by HTTP method.",
      "news-feed": "Feed reads go through L7 LB to route to the correct feed service shard (based on user ID hash). Write path (post creation) goes through a separate LB to the write service. This read/write separation prevents write-heavy operations from starving read performance.",
    }
  },
  /* ── Storage & Databases ──────────────────────────────── */
  "caching": {
    concept: "Caching",
    beginner: "Caching stores frequently accessed data in fast storage (like RAM) so you don't have to fetch it from the slow database every time. Like keeping your most-used tools on your desk instead of in a closet across the building.",
    intermediate: "Cache strategies: Cache-Aside (app checks cache first, then DB), Read-Through (cache fetches from DB automatically), Write-Through (writes go to cache + DB simultaneously), Write-Behind (writes to cache first, async to DB). Cache invalidation is hard — time-based TTL, event-based, or versioned keys. Redis is the go-to in-memory cache (100K+ reads/s).",
    advanced: "Cache stampede: when a popular key expires, hundreds of requests hit the DB simultaneously. Solutions: mutex locks, probabilistic early expiration, stale-while-revalidate. Multi-tier caching: L1 (in-process, ~1ns), L2 (Redis, ~1ms), L3 (CDN, ~10ms). Cache coherence across regions requires async invalidation (Kafka events). Hot key problem: one key gets 100K+ QPS — replicate the key across multiple Redis shards.",
    caseStudyContext: {
      "url-shortener": "Redis cache holds hot URLs — 80% hit rate means only 20% of reads hit the database. At 12K reads/s, cache serves ~9.6K/s, DB handles ~2.4K/s. TTL: URLs expire after 5 years. Cache key: short_code → long_url. Eviction: LRU when Redis memory is full.",
      "news-feed": "Feed caching is critical — pre-computed feeds stored in Redis. Fan-out on write: when a user posts, push to all followers' cached feeds. Cache key: user_id → feed array. TTL: 5 minutes. Cache-aside for user profiles. Cache invalidation via Kafka events when profiles update.",
      "chat-system": "Redis caches recent messages (last 50 per conversation). After initial load, new messages arrive via WebSocket. Cache key: conversation_id → message array. TTL: 1 hour. Hot conversations (group chats with 1000+ members) need replicated cache entries.",
    }
  },
  "database design": {
    concept: "Database Design",
    beginner: "Database design is how you organize data in tables. A relational database (PostgreSQL, MySQL) stores data in rows and columns with relationships between tables. A NoSQL database (MongoDB, DynamoDB) stores flexible documents without strict relationships.",
    intermediate: "Choose relational for: ACID transactions, complex queries (JOINs), data integrity. Choose NoSQL for: horizontal scaling, flexible schema, high write throughput. Schema design matters: normalize for writes (avoid duplication), denormalize for reads (avoid JOINs). Indexes speed up reads but slow down writes.",
    advanced: "Sharding: split data across multiple DB nodes by key (user_id, region). Consistent hashing minimizes data movement. Replication: leader-follower (read replicas) or multi-leader (conflict resolution). Partitioning: range-based (by date) or hash-based (by ID). CAP theorem: you pick 2 of 3 (Consistency, Availability, Partition tolerance). For globally distributed: use CockroachDB/Spanner (strong consistency) or Cassandra (eventual consistency, high availability).",
    caseStudyContext: {
      "url-shortener": "Relational DB (Postgres) for URL mappings — ACID ensures unique short codes. Schema: (short_code VARCHAR(7) PK, long_url TEXT, created_at, expires_at). NoSQL alternative: DynamoDB for 100M+ URLs with simple key-value lookups. Sharding by short_code prefix for horizontal scaling.",
      "news-feed": "Social graph in Neo4j or adjacency list in Postgres. Feed storage in Redis (pre-computed). User data in PostgreSQL. Post content in S3 with metadata in DynamoDB. Sharding by user_id for horizontal scaling.",
    }
  },
  "hashing": {
    concept: "Hashing",
    beginner: "Hashing converts any input into a fixed-size string (like a fingerprint). The same input always produces the same output. Used for: password storage (can't reverse it), data integrity checks, and generating unique IDs.",
    intermediate: "Hash functions: MD5 (fast, collision-prone — don't use for security), SHA-256 (secure, slower), MurmurHash (fast, good for hash tables). Consistent hashing: maps both servers and keys to a ring — when a server is added/removed, only nearby keys move. Load balancing: hash(client_ip) → route to same server (sticky sessions).",
    advanced: "Hash collisions: birthday paradox means 2^32 inputs → 50% collision chance at ~77K entries. Bloom filters use multiple hash functions for probabilistic membership tests (no false negatives). Hash rings with virtual nodes (150 per physical server) ensure even distribution. Cryptographic hashing (bcrypt/scrypt) for passwords — adds salt and slow computation to resist brute force.",
    caseStudyContext: {
      "url-shortener": "Base62 encoding of auto-increment ID or MD5 hash of long URL → first 7 chars. Collision handling: if short code exists, append random suffix. Hash ring distributes URL data across DB shards. 7 chars base62 = 3.5 trillion unique codes — enough for 100M URLs/day × 5 years.",
    }
  },
  /* ── Distributed Systems ──────────────────────────────── */
  "message queues": {
    concept: "Message Queues",
    beginner: "A message queue is like a mailbox — one system drops off a message, another picks it up later. This decouples services: the sender doesn't wait for the receiver. If the receiver is down, messages pile up in the queue until it's back.",
    intermediate: "Popular queues: Kafka (append-only log, replay, high throughput), RabbitMQ (traditional queue, routing, acknowledgments), SQS (managed, serverless). Patterns: Point-to-Point (one consumer), Publish-Subscribe (many consumers). At-least-once delivery (might duplicate), at-most-once (might lose), exactly-once (hard, usually achieved via idempotency).",
    advanced: "Kafka partitioning: messages with same key go to same partition (ordering guarantee). Consumer groups: multiple consumers read from different partitions in parallel. Backpressure: when consumers fall behind, queue grows — monitor lag. Dead letter queue: messages that fail N times go here for investigation. Exactly-once: Kafka 0.11+ with idempotent producers + transactional consumers. Schema registry (Avro/Protobuf) ensures producer/consumer compatibility.",
    caseStudyContext: {
      "chat-system": "Kafka as the message backbone: each conversation is a partition. Messages append to the partition in order. Consumer groups handle fan-out to multiple recipients. Message ordering: sequence numbers per conversation. WhatsApp uses XMPP protocol over WebSocket → message queue → recipient's WebSocket.",
      "news-feed": "Kafka ingests new posts. Fan-out service reads from Kafka, pushes to each follower's pre-computed feed in Redis. Write amplification: 1 post to 1000 followers = 1000 Redis writes. Kafka retention: 7 days. Consumer lag monitoring ensures feeds stay fresh.",
    }
  },
  "social graphs": {
    concept: "Social Graphs",
    beginner: "A social graph is a map of who follows whom. Like a web of connections — you're connected to your friends, who are connected to their friends. In Twitter, your feed = posts from people you follow. In Facebook, your feed = posts from friends + friends of friends.",
    intermediate: "Storage options: Adjacency list in Postgres (follows table: follower_id, followee_id). Graph database (Neo4j) for complex traversals. Fan-out on write: pre-compute feeds. Fan-out on read: compute feeds at query time. Celebrity problem: accounts with millions of followers can't push to all followers.",
    advanced: "Hybrid approach: fan-out on write for regular users, fan-out on read for celebrities (10M+ followers). Celebrity's posts fetched at read time and merged with pre-computed feed. Graph partitioning: divide by geography or user_id range. Bidirectional edges for follow-back detection. Graph algorithms: PageRank for feed ranking, community detection for recommendations.",
    caseStudyContext: {
      "news-feed": "Social graph stored as adjacency list in Postgres. Read-heavy: 9:1 read:write ratio. Fan-out on write for users with <10K followers. Fan-out on read for celebrity accounts. Graph traversal: get followers list → fetch their recent posts → rank by time/engagement → return top 100.",
    }
  },
  "database sharding": {
    concept: "Database Sharding",
    beginner: "Sharding is splitting one big database into smaller pieces (shards) spread across multiple servers. Like splitting a phone book by first letter — A-H on server 1, I-P on server 2, Q-Z on server 3. Each server handles a subset of data.",
    intermediate: "Sharding strategies: Hash-based (hash(user_id) → shard number), Range-based (user_id 1-1M → shard 1), Directory-based (lookup table maps keys to shards). Challenges: cross-shard queries (JOINs across shards), rebalancing when adding shards, hot spots (one shard gets 80% of traffic). Shard key choice is critical — can't change later.",
    advanced: "Consistent hashing with virtual nodes: minimizes data movement when shards are added/removed. Resharding: online resharding with dual-write during migration. Cross-shard transactions: 2-phase commit (slow) or Saga pattern (compensating transactions). Shard-by-access-pattern: different sharding for reads vs writes. Vitess (MySQL sharding), CockroachDB (auto-sharding), Citus (PostgreSQL sharding).",
    caseStudyContext: {
      "url-shortener": "Shard URL table by short_code hash. At 180B rows (5 years of 100M/day), need ~100 shards at 1.8B rows each. Read path: hash(short_code) → shard → single lookup. Write path: hash(short_code) → shard → insert. Cross-shard: not needed (each URL maps to one shard).",
    }
  },
  /* ── API Design ──────────────────────────────────────── */
  "rate limiting": {
    concept: "Rate Limiting",
    beginner: "Rate limiting restricts how many requests a user can make in a time window. Like a bouncer at a club — if too many people try to enter, some get turned away. This prevents abuse and keeps the system stable.",
    intermediate: "Algorithms: Fixed Window (count per minute — easy but bursty), Sliding Window Log (timestamps in a sorted set — precise but memory-heavy), Sliding Window Counter (weighted blend — good balance), Token Bucket (tokens refill at fixed rate — smooth). Implement at API gateway (Kong, nginx) or application level. Return 429 Too Many Requests with Retry-After header.",
    advanced: "Distributed rate limiting: Redis + Lua script for atomic counter operations across multiple API servers. Per-user, per-IP, per-API-key limits. Tiered limits: free tier 100/hour, pro tier 10K/hour. Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset. Adaptive rate limiting: lower limits during high load. Circuit breaker pattern: when downstream is struggling, fail fast instead of piling on.",
    caseStudyContext: {
      "url-shortener": "Rate limit URL creation: 10 requests/minute per API key to prevent abuse. Sliding window counter in Redis. For the redirect path: no rate limit needed (reads are cheap). For abuse prevention: IP-based rate limiting on create endpoint.",
      "api-gateway": "Rate limiting is the core feature. Multiple strategies per route: fixed window for simple APIs, token bucket for bursty workloads. Distributed counters in Redis. Rate limit headers in every response. Per-client quotas tracked in database.",
    }
  },
  /* ── Real-time & Events ──────────────────────────────── */
  "event-driven architecture": {
    concept: "Event-Driven Architecture",
    beginner: "Instead of services calling each other directly, they emit events (like 'order placed') and other services react to those events. Like a newspaper — publish once, many people read it. This decouples services: the order service doesn't need to know about the inventory service.",
    intermediate: "Event sources: Kafka (durable log, replay), RabbitMQ (traditional queue), AWS EventBridge (serverless). Event patterns: Event Sourcing (store all events, rebuild state), CQRS (separate read/write models), Saga (distributed transactions via events). Idempotency: handle duplicate events gracefully (event ID + dedup table).",
    advanced: "Event schema evolution: use Avro/Protobuf with schema registry for backward compatibility. Event ordering: partition by entity ID (e.g., order_id) ensures events for same entity are processed in order. Event sourcing: store events as source of truth, derive current state by replaying. Dual-write problem: publishing event + writing DB isn't atomic — use Outbox pattern (write event to DB table, Kafka Connect reads it).",
    caseStudyContext: {
      "chat-system": "Every message is an event: {conversation_id, sender_id, content, timestamp}. Kafka topic per conversation partition. Event ordering: sequence numbers per conversation. Read receipts, typing indicators — all events. Event sourcing: replay conversation history from events.",
      "news-feed": "Post creation emits event → fan-out service pushes to followers' feeds. Profile update event → invalidate cached profile. Like/comment events → update engagement counts. Event-driven cache invalidation across the system.",
    }
  },
  "long polling": {
    concept: "Long Polling",
    beginner: "Long polling is a way to get real-time updates without WebSockets. The client sends a request, and the server holds it open until new data is available (or a timeout). Then the client immediately sends another request. It's like calling a friend and staying on the line until they have news.",
    intermediate: "How it works: Client sends GET → Server holds connection → Server sends response when data available or after timeout (30s) → Client immediately reconnects. Downside: each hold uses a server thread/connection. Better than regular polling (client asks every 5s) but worse than WebSockets (one persistent connection). Used as a fallback when WebSockets aren't available (corporate firewalls).",
    advanced: "Long polling at scale: server needs async I/O (Node.js, Go goroutines) to hold thousands of connections. Connection pooling: reuse TCP connections. Timeout management: balance between freshness (short timeout) and server load (fewer reconnections). Fallback chain: WebSocket → Long Polling → Short Polling. Server-Sent Events (SSE) is a simpler alternative for server→client only.",
    caseStudyContext: {
      "chat-system": "Long polling as fallback when WebSockets fail (corporate proxy blocks WS). Server holds connection for 30s, returns pending messages or empty response. Client reconnects immediately. Used by WhatsApp as backup transport. Less efficient than WebSockets but works everywhere.",
    }
  },
  "pub-sub": {
    concept: "Publish-Subscribe",
    beginner: "Pub-sub is a messaging pattern where publishers send messages to topics, and subscribers receive messages from topics they're interested in. Like a YouTube channel — the creator publishes a video, subscribers get notified. Publishers don't know who's listening.",
    intermediate: "Implementation: Kafka (durable, ordered, replay), Redis Pub/Sub (lightweight, no persistence), AWS SNS (managed, fan-out). Topic-based routing: messages go to topics, subscribers choose topics. Fan-out: one message → multiple subscribers. Consumer groups: multiple instances of same service share the load.",
    advanced: "Kafka topics with partitions: each partition is ordered, partitions are parallel. Consumer groups: each partition consumed by one consumer in the group. Schema evolution: Avro schemas with compatibility checks. Dead letter queues: failed messages routed for investigation. Exactly-once semantics: idempotent producers + transactional consumers. Multi-datacenter: MirrorMaker 2 replicates topics across clusters.",
    caseStudyContext: {
      "pub-sub-system": "The system itself: publishers send messages to topics, subscribers receive them. Topic partitioning for scale. Message ordering within partition. Fan-out: one message → N subscribers. Persistence: Kafka retains messages for configurable duration. Consumer groups for horizontal scaling of subscribers.",
    }
  },
  /* ── General ──────────────────────────────────────── */
  "rest api": {
    concept: "REST API",
    beginner: "REST APIs use HTTP methods (GET, POST, PUT, DELETE) to perform operations on resources. Like a URL-based interface: GET /users/123 gets user 123, POST /users creates a new user. Responses are usually JSON.",
    intermediate: "REST conventions: resource naming (/users, /orders), HTTP status codes (200 OK, 201 Created, 404 Not Found, 422 Validation Error), pagination (offset/limit or cursor-based), versioning (/v1/users). Authentication: API keys, OAuth2, JWT tokens. Rate limiting per API key.",
    advanced: "API design at scale: HATEOAS (hypermedia links in responses), field filtering (?fields=name,email), bulk operations (POST /users/batch), idempotency keys for safe retries. OpenAPI spec for documentation. API gateway (Kong, AWS API Gateway) for auth, rate limiting, request transformation. GraphQL alternative: single endpoint, flexible queries, but caching is harder.",
    caseStudyContext: {
      "url-shortener": "REST API: POST /shorten {long_url} → {short_code, short_url}. GET /:short_code → 301/302 redirect to long_url. GET /stats/:short_code → analytics. Rate limit headers in every response. JSON responses. API versioning: /v1/shorten.",
    }
  },
  "microservices": {
    concept: "Microservices",
    beginner: "Instead of one big application (monolith), you split it into small independent services. Each service does one thing well and talks to others via APIs or messages. Like a restaurant: chef, waiter, cashier — each has a role, they coordinate.",
    intermediate: "Benefits: independent deployment, technology diversity, fault isolation. Challenges: network latency, data consistency, debugging (distributed tracing). Service discovery: how services find each other (Consul, Eureka). API gateway: single entry point for clients. Inter-service communication: sync (HTTP/gRPC) or async (Kafka).",
    advanced: "Domain-Driven Design: services aligned to business domains. Saga pattern for distributed transactions (choreography vs orchestration). Circuit breaker (Hystrix/Resilience4j) prevents cascade failures. Distributed tracing (Jaeger, Zipkin) for debugging. Service mesh (Istio, Linkerd) for observability, traffic management, security. Container orchestration (Kubernetes) for deployment and scaling.",
    caseStudyContext: {
      "api-gateway": "The API gateway IS the microservices pattern: one entry point routing to many backend services. Rate limiting, authentication, request transformation, response aggregation. Each backend service handles its domain (users, orders, payments). Gateway routes by path (/users → user-service, /orders → order-service).",
    }
  },
  "consistent hashing": {
    concept: "Consistent Hashing",
    beginner: "When you add or remove servers, regular hashing (hash(key) % num_servers) moves almost every key. Consistent hashing puts servers and keys on a ring — each key maps to the nearest server clockwise. Adding a server only moves keys between two servers.",
    intermediate: "Problem with simple hash % N: adding one server moves ~all keys. Consistent hashing: both servers and keys placed on a ring (0 to 2^32). Key → walk clockwise → first server you hit. Adding server → only keys between new server and previous server move. Removing server → its keys move to next server.",
    advanced: "Virtual nodes: each physical server gets 100-200 virtual positions on the ring. This distributes load evenly (without vnodes, some servers get 2x load). Amazon Dynamo uses consistent hashing. Implementation: jump consistent hash (Google, fastest), rendezvous hashing (highest random weight). Used in: Cassandra (data placement), DynamoDB, Memcached (client-side sharding), CDNs.",
    caseStudyContext: {
      "url-shortener": "Consistent hashing distributes URL data across DB shards. Short code hash → shard. Adding a shard: only ~1/N of keys move. Used for Redis cache sharding too. Virtual nodes ensure even distribution even with few shards.",
    }
  },
};

/** Get explanation for a prerequisite concept, contextualized to a case study */
export function getPrereqExplanation(
  concept: string,
  caseStudyId?: string
): { beginner: string; intermediate: string; advanced: string; context?: string } | null {
  const key = concept.toLowerCase().trim();
  const entry = PREREQ_KB[key];
  if (!entry) return null;
  return {
    beginner: entry.beginner,
    intermediate: entry.intermediate,
    advanced: entry.advanced,
    context: caseStudyId ? entry.caseStudyContext[caseStudyId] : undefined,
  };
}

/** Get all available prerequisite concepts */
export function getAllPrereqConcepts(): string[] {
  return Object.keys(PREREQ_KB);
}

/** Check if a concept exists in the knowledge base */
export function hasPrereqKnowledge(concept: string): boolean {
  return concept.toLowerCase().trim() in PREREQ_KB;
}
