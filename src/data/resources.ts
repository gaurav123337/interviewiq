/* Curated learning resources + plain-language primers for roadmap topics.
   Offline-first: every P0 topic resolves to a primer + links without a network call.
   The integrity test (src/__tests__/resources.test.ts) guarantees every field skill,
   level focus and company stack term resolves to a SPECIFIC entry (not the fallback). */

export interface Resource {
  label: string;
  url: string;
}

export interface TopicInfo {
  primer: string;
  links: Resource[];
}

/* ---------- field skills (32) ---------- */
const SKILL_INFO: Record<string, TopicInfo> = {
  "JavaScript / TypeScript": {
    primer: "Core language mechanics (scoping, async, the event loop) plus static typing — the foundation of every modern web role.",
    links: [
      { label: "MDN JavaScript Guide", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
      { label: "TypeScript Handbook", url: "https://www.typescriptlang.org/docs/handbook/intro.html" },
      { label: "JS event loop explained", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop" }
    ]
  },
  "React · Vue · Angular": {
    primer: "Component models, rendering (virtual DOM vs reactivity), state management, and when each framework fits.",
    links: [
      { label: "React docs", url: "https://react.dev/learn" },
      { label: "Vue guide", url: "https://vuejs.org/guide/introduction.html" },
      { label: "Angular docs", url: "https://angular.dev/overview" }
    ]
  },
  "CSS & accessibility": {
    primer: "Layout systems, the box model, responsive design, and semantic, keyboard-usable markup with ARIA only as a gap-filler.",
    links: [
      { label: "MDN CSS", url: "https://developer.mozilla.org/en-US/docs/Web/CSS" },
      { label: "MDN Accessibility", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility" },
      { label: "Every Layout", url: "https://every-layout.dev/" }
    ]
  },
  "Web performance": {
    primer: "Core Web Vitals, the critical rendering path, bundle/image weight, and measuring before optimizing.",
    links: [
      { label: "web.dev performance", url: "https://web.dev/learn/performance" },
      { label: "MDN Performance", url: "https://developer.mozilla.org/en-US/docs/Web/Performance" },
      { label: "Core Web Vitals", url: "https://web.dev/articles/vitals" }
    ]
  },
  "APIs & services": {
    primer: "RESTful design, HTTP semantics, idempotency, error contracts, and versioning — the backbone of backend interviews.",
    links: [
      { label: "MDN HTTP", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP" },
      { label: "REST resource naming", url: "https://cloud.google.com/apis/design/resources" },
      { label: "Stripe API design guide", url: "https://github.com/stripe/openapi" }
    ]
  },
  "Databases & caching": {
    primer: "Indexing, transactions, normalization vs denormalization, and cache layers — know when each helps and hurts.",
    links: [
      { label: "Use the Index, Luke", url: "https://use-the-index-luke.com/" },
      { label: "PostgreSQL docs", url: "https://www.postgresql.org/docs/" },
      { label: "Redis docs", url: "https://redis.io/docs/" }
    ]
  },
  "Distributed systems": {
    primer: "Consistency, partitioning, replication and failure handling — the vocabulary of every senior+ system design round.",
    links: [
      { label: "Designing Data-Intensive Applications", url: "https://dataintensive.net/" },
      { label: "MIT 6.824 Distributed Systems", url: "https://pdos.csail.mit.edu/6.824/" },
      { label: "CAP theorem explained", url: "https://www.ibm.com/think/topics/cap-theorem" }
    ]
  },
  "Go · Java · Node · Python": {
    primer: "Strong fundamentals in at least one backend language: memory model, concurrency, tooling, and idiomatic code.",
    links: [
      { label: "Go tour", url: "https://go.dev/tour/" },
      { label: "Java tutorials", url: "https://docs.oracle.com/javase/tutorial/" },
      { label: "Node.js docs", url: "https://nodejs.org/en/learn" },
      { label: "Python tutorial", url: "https://docs.python.org/3/tutorial/" }
    ]
  },
  "Frontend + backend": {
    primer: "The full request lifecycle — UI event to database and back — plus where state, auth, and caching live on each side.",
    links: [
      { label: "MDN full-stack path", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development" },
      { label: "How the web works", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Web_and_web_standards/How_the_web_works" }
    ]
  },
  "APIs & data": {
    primer: "Designing the data contract between client and server: JSON shape, validation, pagination, and error semantics.",
    links: [
      { label: "MDN JSON", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/JSON" },
      { label: "JSON Schema", url: "https://json-schema.org/learn/getting-started-step-by-step" }
    ]
  },
  "Auth & real-time": {
    primer: "Sessions vs tokens, OAuth flows, WebSockets/SSE, and keeping client state in sync with the server.",
    links: [
      { label: "OAuth 2.0 explained", url: "https://oauth.net/2/" },
      { label: "MDN WebSockets", url: "https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API" },
      { label: "Auth0 docs", url: "https://auth0.com/docs" }
    ]
  },
  "Product thinking": {
    primer: "Connecting engineering decisions to user outcomes: tradeoffs, iteration, and communicating in product terms.",
    links: [
      { label: "Mind the Product", url: "https://www.mindtheproduct.com/" },
      { label: "First Round Review", url: "https://review.firstround.com/" }
    ]
  },
  "Kubernetes & Docker": {
    primer: "Containers and orchestration: images, pods, deployments, services, and how apps actually run at scale.",
    links: [
      { label: "Kubernetes docs", url: "https://kubernetes.io/docs/tutorials/" },
      { label: "Docker docs", url: "https://docs.docker.com/get-started/" }
    ]
  },
  "AWS · GCP · Azure": {
    primer: "Core cloud services across compute, storage and networking, plus when to pick which — and their cost models.",
    links: [
      { label: "AWS docs", url: "https://docs.aws.amazon.com/" },
      { label: "Google Cloud docs", url: "https://cloud.google.com/docs" },
      { label: "Azure docs", url: "https://learn.microsoft.com/en-us/azure/" }
    ]
  },
  "CI/CD & IaC": {
    primer: "Pipelines, automated tests at each stage, and infrastructure defined as code with Terraform or similar.",
    links: [
      { label: "GitHub Actions docs", url: "https://docs.github.com/en/actions" },
      { label: "Terraform docs", url: "https://developer.hashicorp.com/terraform/tutorials" }
    ]
  },
  "SRE & observability": {
    primer: "SLOs, error budgets, monitoring, logging and tracing — and the operational culture that keeps services healthy.",
    links: [
      { label: "Google SRE book", url: "https://sre.google/sre-book/table-of-contents/" },
      { label: "OpenTelemetry docs", url: "https://opentelemetry.io/docs/" }
    ]
  },
  "Statistics & ML": {
    primer: "Distributions, hypothesis testing, regression, bias-variance, and evaluating models honestly.",
    links: [
      { label: "Introduction to Statistical Learning", url: "https://www.statlearning.com/" },
      { label: "Google ML crash course", url: "https://developers.google.com/machine-learning/crash-course" }
    ]
  },
  "Python & SQL": {
    primer: "Idiomatic Python plus the SQL you'll be quizzed on: joins, aggregation, window functions, and query planning.",
    links: [
      { label: "Python tutorial", url: "https://docs.python.org/3/tutorial/" },
      { label: "SQLBolt", url: "https://sqlbolt.com/" },
      { label: "PostgreSQL tutorial", url: "https://www.postgresql.org/docs/current/tutorial.html" }
    ]
  },
  "Experimentation": {
    primer: "A/B testing done right: randomization, power, multiple-comparison control, and reading results without fooling yourself.",
    links: [
      { label: "Trustworthy Online Controlled Experiments", url: "https://experimentguide.com/" },
      { label: "Evan Miller: sample size", url: "https://www.evanmiller.org/ab-testing/sample-size.html" }
    ]
  },
  "ML platforms": {
    primer: "The stack that ships models: training pipelines, feature stores, serving, monitoring, and MLOps hygiene.",
    links: [
      { label: "MLflow docs", url: "https://mlflow.org/docs/" },
      { label: "Kubeflow docs", url: "https://www.kubeflow.org/docs/" }
    ]
  },
  "Swift · Kotlin": {
    primer: "Modern native language fundamentals: optionals/null-safety, concurrency, and the platform's idioms.",
    links: [
      { label: "Swift docs", url: "https://docs.swift.org/swift-book/" },
      { label: "Kotlin docs", url: "https://kotlinlang.org/docs/home.html" }
    ]
  },
  "React Native · Flutter": {
    primer: "Cross-platform architecture: the bridge/engine model, widget/component lifecycles, and native interop.",
    links: [
      { label: "React Native docs", url: "https://reactnative.dev/docs/getting-started" },
      { label: "Flutter docs", url: "https://docs.flutter.dev/" }
    ]
  },
  "Offline & sync": {
    primer: "Service workers, IndexedDB as the local source of truth, and conflict resolution when devices diverge.",
    links: [
      { label: "MDN Service Workers", url: "https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API" },
      { label: "MDN IndexedDB", url: "https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API" }
    ]
  },
  "App stores": {
    primer: "Store guidelines, review cycles, release trains, and how to ship and update mobile apps operationally.",
    links: [
      { label: "App Store guidelines", url: "https://developer.apple.com/app-store/review/guidelines/" },
      { label: "Google Play policy", url: "https://support.google.com/googleplay/android-developer/answer/9859455" }
    ]
  },
  "Test strategy": {
    primer: "The testing pyramid, what to test at each layer, and designing test suites that catch regressions without slowing delivery.",
    links: [
      { label: "Test pyramid (Martin Fowler)", url: "https://martinfowler.com/articles/practical-test-pyramid.html" },
      { label: "Google testing blog", url: "https://testing.googleblog.com/" }
    ]
  },
  "Automation frameworks": {
    primer: "End-to-end and UI automation with Playwright/Cypress-style tools, plus reliability patterns (waits, retries, isolation).",
    links: [
      { label: "Playwright docs", url: "https://playwright.dev/docs/intro" },
      { label: "Cypress docs", url: "https://docs.cypress.io/guides/overview/why-cypress" }
    ]
  },
  "CI/CD integration": {
    primer: "Wiring tests into pipelines, flake control, parallel sharding, and gating releases on quality signals.",
    links: [
      { label: "GitHub Actions docs", url: "https://docs.github.com/en/actions" },
      { label: "Continuous Integration (Fowler)", url: "https://martinfowler.com/articles/continuousIntegration.html" }
    ]
  },
  "Performance & a11y": {
    primer: "Load/soak testing, performance budgets, and automated accessibility scans wired into the pipeline.",
    links: [
      { label: "web.dev performance", url: "https://web.dev/learn/performance" },
      { label: "axe-core docs", url: "https://www.deque.com/axe/core-documentation/api-documentation/" }
    ]
  },
  "Application security": {
    primer: "The OWASP Top 10 in practice: injection, broken auth, SSRF, and building security into the SDLC.",
    links: [
      { label: "OWASP Top 10", url: "https://owasp.org/www-project-top-ten/" },
      { label: "OWASP cheat sheets", url: "https://cheatsheetseries.owasp.org/" }
    ]
  },
  "Cloud & network security": {
    primer: "IAM, network segmentation, least privilege, and the shared-responsibility model across cloud providers.",
    links: [
      { label: "AWS security docs", url: "https://docs.aws.amazon.com/security/" },
      { label: "Cloudflare Learning Center", url: "https://www.cloudflare.com/learning/" }
    ]
  },
  "Cryptography": {
    primer: "Hashing vs encryption, symmetric vs asymmetric, TLS, and the practical pitfalls (don't roll your own).",
    links: [
      { label: "OWASP crypto cheat sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html" },
      { label: "Crypto 101", url: "https://www.crypto101.io/" }
    ]
  },
  "Incident response": {
    primer: "Detection, containment, eradication and recovery — plus blameless postmortems and communication during incidents.",
    links: [
      { label: "SRE workbook: incident response", url: "https://sre.google/workbook/incident-response/" },
      { label: "Atlassian incident handbook", url: "https://www.atlassian.com/incident-management/handbook" }
    ]
  }
};

/* ---------- level focus areas ---------- */
const FOCUS_INFO: Record<string, TopicInfo> = {
  "language basics": {
    primer: "Syntax, types, control flow and idiomatic constructs of your main language — solid, correct answers at junior level.",
    links: [{ label: "MDN JavaScript", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript" }]
  },
  "data structures": {
    primer: "Arrays, hash maps, linked lists, trees, graphs, heaps — time/space complexity and when to reach for each.",
    links: [
      { label: "Visualgo", url: "https://visualgo.net/en" },
      { label: "Big-O cheat sheet", url: "https://www.bigocheatsheet.com/" }
    ]
  },
  debugging: {
    primer: "Reproduce → isolate → hypothesize → verify. Know your debugger, logs, and how to read a stack trace.",
    links: [{ label: "MDN debugging", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Tools_and_setup/What_are_browser_developer_tools" }]
  },
  "testing fundamentals": {
    primer: "Unit vs integration vs end-to-end, good assertions, and testing the behavior that matters.",
    links: [
      { label: "Jest docs", url: "https://jestjs.io/docs/getting-started" },
      { label: "Test pyramid", url: "https://martinfowler.com/articles/practical-test-pyramid.html" }
    ]
  },
  communication: {
    primer: "Structuring answers (approach → reasoning → tradeoffs), active listening, and explaining simply.",
    links: [{ label: "Google: communication", url: "https://www.thebalancemoney.com/communication-skills-2063779" }]
  },
  "design patterns": {
    primer: "The classic GoF patterns and when they help — plus the modern take (composition over inheritance).",
    links: [{ label: "Refactoring Guru", url: "https://refactoring.guru/design-patterns" }]
  },
  APIs: {
    primer: "HTTP verbs, status codes, request/response design, and idempotency — the contract between systems.",
    links: [{ label: "MDN HTTP", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP" }]
  },
  databases: {
    primer: "Relational modeling, indexes, transactions, and the ACID vs BASE tradeoff.",
    links: [{ label: "Use the Index, Luke", url: "https://use-the-index-luke.com/" }]
  },
  "moderate system design": {
    primer: "A repeatable framework: requirements → scale → components → data → tradeoffs, applied to mid-size systems.",
    links: [{ label: "System design primer", url: "https://github.com/donnemartin/system-design-primer" }]
  },
  "code review": {
    primer: "What to look for, how to give kind, actionable feedback, and how to receive it.",
    links: [{ label: "Google eng practices", url: "https://google.github.io/eng-practices/review/" }]
  },
  architecture: {
    primer: "Layering, modularity, coupling and cohesion — and making tradeoffs explicit in design documents.",
    links: [{ label: "Martin Fowler", url: "https://martinfowler.com/architecture/" }]
  },
  scalability: {
    primer: "Load, latency and throughput: caching, replication, partitioning, and finding the real bottleneck.",
    links: [{ label: "System design primer", url: "https://github.com/donnemartin/system-design-primer" }]
  },
  mentoring: {
    primer: "Diagnosing where someone struggles, giving actionable feedback, and building independence rather than dependency.",
    links: [{ label: "Radical Candor", url: "https://www.radicalcandor.com/" }]
  },
  "cross-team collaboration": {
    primer: "Aligning goals and vocabulary across teams, and bridging communication gaps productively.",
    links: [{ label: "First Round Review", url: "https://review.firstround.com/" }]
  },
  "system design": {
    primer: "End-to-end design interviews: clarifying requirements, estimating scale, sketching components, and defending tradeoffs.",
    links: [
      { label: "System design primer", url: "https://github.com/donnemartin/system-design-primer" },
      { label: "Designing Data-Intensive Applications", url: "https://dataintensive.net/" }
    ]
  },
  "large-scale systems": {
    primer: "Multi-region replication, data residency, failure domains, and the economics of global infrastructure.",
    links: [{ label: "Designing Data-Intensive Applications", url: "https://dataintensive.net/" }]
  },
  "technical strategy": {
    primer: "Choosing bets, writing them down, and aligning architecture with business goals over a multi-year horizon.",
    links: [{ label: "An Elegant Puzzle", url: "https://www.elegantpuzzle.com/" }]
  },
  standards: {
    primer: "Setting conventions teams actually follow — lightweight governance, ADRs, and automation over enforcement.",
    links: [{ label: "ADR pattern", url: "https://adr.github.io/" }]
  },
  "risk management": {
    primer: "Identifying, quantifying and mitigating technical risk — and communicating it to stakeholders honestly.",
    links: [{ label: "SRE book: risk", url: "https://sre.google/sre-book/risk-management/" }]
  },
  "org-wide architecture": {
    primer: "Architecting across teams: platform decisions, shared services, and setting direction beyond one codebase.",
    links: [{ label: "An Elegant Puzzle", url: "https://www.elegantpuzzle.com/" }]
  },
  "platform strategy": {
    primer: "Building internal platforms that make the right thing easy — golden paths, self-service, and treating teams as customers.",
    links: [{ label: "Team Topologies", url: "https://teamtopologies.com/" }]
  },
  "executive communication": {
    primer: "Translating technical topics into business outcomes, risk and cost — with metrics, not vibes.",
    links: [{ label: "First Round Review", url: "https://review.firstround.com/" }]
  },
  "hiring bar": {
    primer: "Structured interviews, rubrics and calibration — hiring judgment, not trivia.",
    links: [{ label: "Google: hiring", url: "https://www.rework.withgoogle.com/guides/hiring/" }]
  },
  "technical vision": {
    primer: "A concrete, communicable picture of the future that the org can rally behind — and that can change.",
    links: [{ label: "An Elegant Puzzle", url: "https://www.elegantpuzzle.com/" }]
  },
  "engineering org": {
    primer: "Team structure, leadership pipelines and process that scales from a few engineers to hundreds.",
    links: [{ label: "An Elegant Puzzle", url: "https://www.elegantpuzzle.com/" }]
  },
  budget: {
    primer: "Headcount, cloud and tooling spend tied to priorities — with visibility and monthly review.",
    links: [{ label: "FinOps foundation", url: "https://www.finops.org/" }]
  },
  "security & compliance": {
    primer: "Risk-tiered controls, automated scanning, and compliance mapped to what customers actually require.",
    links: [{ label: "OWASP Top 10", url: "https://owasp.org/www-project-top-ten/" }]
  },
  "hiring leaders": {
    primer: "What to look for in first execs and senior hires: complementary strengths, stage fit, and deep references.",
    links: [{ label: "First Round Review", url: "https://review.firstround.com/" }]
  },
  strategy: {
    primer: "Strategy is choices: what you'll do AND what you won't, tied to a clear vision and reviewed against reality.",
    links: [{ label: "YC library", url: "https://www.ycombinator.com/library" }]
  },
  product: {
    primer: "Product-market fit, pricing, and the product decisions that shape the engineering roadmap.",
    links: [{ label: "Lenny's Newsletter", url: "https://www.lennysnewsletter.com/" }]
  },
  market: {
    primer: "Sizing markets, understanding competition and timing, and validating with real customers.",
    links: [{ label: "YC library", url: "https://www.ycombinator.com/library" }]
  },
  fundraising: {
    primer: "The raise as story plus evidence, term-sheet literacy, and runway discipline.",
    links: [{ label: "YC: fundraising", url: "https://www.ycombinator.com/library/4A-how-to-raise-a-seed-round" }]
  },
  talent: {
    primer: "Hiring, developing and retaining people — the leverage that compounds everything else.",
    links: [{ label: "First Round Review", url: "https://review.firstround.com/" }]
  },
  metrics: {
    primer: "Picking the few metrics that drive decisions — ARR, retention, unit economics — and reviewing them weekly.",
    links: [{ label: "Lenny's Newsletter", url: "https://www.lennysnewsletter.com/" }]
  }
};

/* ---------- company stack terms not already covered by skills/focus ---------- */
const TECH_INFO: Record<string, TopicInfo> = {
  Go: {
    primer: "Goroutines, channels, the memory model, and idiomatic Go — heavily quizzed at companies running it in production.",
    links: [{ label: "Effective Go", url: "https://go.dev/doc/effective_go" }]
  },
  Java: {
    primer: "JVM fundamentals, concurrency (threads, locks, executor), collections, and garbage collection.",
    links: [{ label: "Java concurrency", url: "https://docs.oracle.com/javase/tutorial/essential/concurrency/" }]
  },
  Python: {
    primer: "Idiomatic Python, the GIL, async, and the ecosystem — know what's fast and what's not.",
    links: [{ label: "Python docs", url: "https://docs.python.org/3/" }]
  },
  C: {
    primer: "Pointers, memory management and undefined behavior — the systems language that underpins everything.",
    links: [{ label: "Learn C", url: "https://www.learn-c.org/" }]
  },
  "C++": {
    primer: "RAII, move semantics, templates and memory safety — expect deep follow-ups if listed on your target's stack.",
    links: [{ label: "cppreference", url: "https://en.cppreference.com/w/" }]
  },
  Kubernetes: {
    primer: "Pods, deployments, services, scheduling and controllers — how the control plane actually works.",
    links: [{ label: "Kubernetes docs", url: "https://kubernetes.io/docs/concepts/" }]
  },
  Spanner: {
    primer: "Google's globally distributed database: TrueTime, external consistency, and what makes it unique.",
    links: [{ label: "Spanner paper", url: "https://research.google/pubs/spanner-google-s-globally-distributed-database/" }]
  },
  Bigtable: {
    primer: "A wide-column NoSQL store — row keys, locality, and when it beats a relational database.",
    links: [{ label: "Bigtable overview", url: "https://cloud.google.com/bigtable/docs/overview" }]
  },
  TensorFlow: {
    primer: "Graphs, eager execution, training loops, and the Keras layer API.",
    links: [{ label: "TensorFlow docs", url: "https://www.tensorflow.org/learn" }]
  },
  React: {
    primer: "Rendering, hooks, reconciliation, and state management — the most-asked frontend framework in interviews.",
    links: [{ label: "React docs", url: "https://react.dev/learn" }]
  },
  GraphQL: {
    primer: "Schema, resolvers, N+1 problems, and the tradeoffs vs REST.",
    links: [{ label: "GraphQL docs", url: "https://graphql.org/learn/" }]
  },
  Cassandra: {
    primer: "A distributed wide-column store: consistent hashing, tunable consistency, and the write path.",
    links: [{ label: "Cassandra docs", url: "https://cassandra.apache.org/doc/latest/" }]
  },
  PyTorch: {
    primer: "Tensors, autograd, modules and training loops — the research-to-production ML framework.",
    links: [{ label: "PyTorch docs", url: "https://pytorch.org/tutorials/" }]
  },
  AWS: {
    primer: "EC2, S3, Lambda, DynamoDB and the mental model of AWS services — the default cloud in most interviews.",
    links: [{ label: "AWS docs", url: "https://docs.aws.amazon.com/" }]
  },
  DynamoDB: {
    primer: "Partition keys, item collections, read/write capacity and its availability-first consistency model.",
    links: [{ label: "DynamoDB docs", url: "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/" }]
  },
  Lambda: {
    primer: "Serverless functions: cold starts, concurrency, and event sources.",
    links: [{ label: "Lambda docs", url: "https://docs.aws.amazon.com/lambda/" }]
  },
  S3: {
    primer: "Object storage: keys, consistency, lifecycle and cost tiers.",
    links: [{ label: "S3 docs", url: "https://docs.aws.amazon.com/s3/" }]
  },
  Kafka: {
    primer: "The log as the core abstraction: partitions, replication, consumer groups, and exactly-once semantics.",
    links: [{ label: "Kafka docs", url: "https://kafka.apache.org/documentation/" }]
  },
  "C#": {
    primer: "The .NET language: async/await, LINQ, generics, and the CLR.",
    links: [{ label: "C# docs", url: "https://learn.microsoft.com/en-us/dotnet/csharp/" }]
  },
  TypeScript: {
    primer: "Static typing on top of JS: unions, generics, inference, and the type system's limits.",
    links: [{ label: "TypeScript handbook", url: "https://www.typescriptlang.org/docs/handbook/intro.html" }]
  },
  ".NET": {
    primer: "The runtime and framework: ASP.NET Core, dependency injection, and the GC.",
    links: [{ label: ".NET docs", url: "https://learn.microsoft.com/en-us/dotnet/" }]
  },
  Azure: {
    primer: "Core Azure services and the Microsoft cloud's identity (Entra ID) and compute model.",
    links: [{ label: "Azure docs", url: "https://learn.microsoft.com/en-us/azure/" }]
  },
  "SQL Server": {
    primer: "T-SQL, indexing, transactions and the engine's execution plans.",
    links: [{ label: "SQL Server docs", url: "https://learn.microsoft.com/en-us/sql/" }]
  },
  Swift: {
    primer: "Optionals, value semantics, concurrency (async/await), and Apple platform idioms.",
    links: [{ label: "Swift docs", url: "https://docs.swift.org/swift-book/" }]
  },
  "Objective-C": {
    primer: "The legacy Apple language: message passing, ARC, and interop with Swift.",
    links: [{ label: "Apple docs", url: "https://developer.apple.com/library/archive/documentation/Cocoa/" }]
  },
  Metal: {
    primer: "Apple's GPU API: command buffers, shaders, and high-performance rendering.",
    links: [{ label: "Metal docs", url: "https://developer.apple.com/metal/" }]
  },
  WebKit: {
    primer: "The browser engine: rendering pipeline, layout, and the JS engine boundary.",
    links: [{ label: "WebKit blog", url: "https://webkit.org/blog/" }]
  },
  "Node.js": {
    primer: "The event loop, streams, modules, and the single-threaded concurrency model.",
    links: [{ label: "Node.js docs", url: "https://nodejs.org/en/learn" }]
  },
  Ruby: {
    primer: "Metaprogramming, blocks, and the Rails ecosystem's idioms.",
    links: [{ label: "Ruby docs", url: "https://www.ruby-lang.org/en/documentation/" }]
  },
  Scala: {
    primer: "Functional + object-oriented on the JVM: immutability, pattern matching, and type classes.",
    links: [{ label: "Scala docs", url: "https://docs.scala-lang.org/" }]
  },
  PostgreSQL: {
    primer: "MVCC, indexing, transactions, and the most-asked open-source database in interviews.",
    links: [{ label: "PostgreSQL docs", url: "https://www.postgresql.org/docs/" }]
  },
  MySQL: {
    primer: "InnoDB, indexes, replication, and the classic LAMP-stack database.",
    links: [{ label: "MySQL docs", url: "https://dev.mysql.com/doc/" }]
  },
  "React Native": {
    primer: "The JS-to-native bridge, the new architecture, and mobile-specific tradeoffs.",
    links: [{ label: "React Native docs", url: "https://reactnative.dev/docs/getting-started" }]
  },
  Kotlin: {
    primer: "Null-safety, coroutines, and modern Android development.",
    links: [{ label: "Kotlin docs", url: "https://kotlinlang.org/docs/home.html" }]
  },
  BigQuery: {
    primer: "Serverless analytics: columnar storage, slot-based pricing, and SQL at petabyte scale.",
    links: [{ label: "BigQuery docs", url: "https://cloud.google.com/bigquery/docs" }]
  },
  Rust: {
    primer: "Ownership, borrowing, and fearless concurrency — expect systems-level depth.",
    links: [{ label: "Rust book", url: "https://doc.rust-lang.org/book/" }]
  },
  ClickHouse: {
    primer: "The columnar OLAP database: merge trees, partitioning, and analytical query patterns.",
    links: [{ label: "ClickHouse docs", url: "https://clickhouse.com/docs" }]
  },
  Elasticsearch: {
    primer: "The inverted index, sharding, and relevance scoring for search.",
    links: [{ label: "Elastic docs", url: "https://www.elastic.co/guide/" }]
  },
  "Machine learning": {
    primer: "Core ML concepts: model selection, evaluation, overfitting, and production concerns.",
    links: [{ label: "Google ML crash course", url: "https://developers.google.com/machine-learning/crash-course" }]
  },
  "Ruby on Rails": {
    primer: "MVC, ActiveRecord, conventions, and the productivity-first framework.",
    links: [{ label: "Rails guides", url: "https://guides.rubyonrails.org/" }]
  },
  "Hack/PHP": {
    primer: "Meta's PHP-derived language: HHVM, type checking, and the web-serving model.",
    links: [{ label: "Hack docs", url: "https://docs.hhvm.com/hack/" }]
  },
  "General engineering practice": {
    primer: "Balanced fundamentals across languages, systems and process — the default when no specific company is chosen.",
    links: [
      { label: "MDN web docs", url: "https://developer.mozilla.org/" },
      { label: "System design primer", url: "https://github.com/donnemartin/system-design-primer" }
    ]
  },
  TAO: {
    primer: "Meta's distributed graph store powering the social graph — an object/association model at massive scale.",
    links: [{ label: "TAO: Facebook's graph store", url: "https://engineering.fb.com/2021/06/09/core-infra/tao-100x-faster/" }]
  },
  "VS Code": {
    primer: "The most-used editor: extensions, language servers and the Electron architecture underneath.",
    links: [{ label: "VS Code docs", url: "https://code.visualstudio.com/docs" }]
  },
  "OpenAI partnership": {
    primer: "How LLM capabilities ship into products — the Azure OpenAI service, deployment models and cost control.",
    links: [{ label: "Azure OpenAI docs", url: "https://learn.microsoft.com/en-us/azure/ai-services/openai/" }]
  },
  "Privacy technologies": {
    primer: "Privacy engineering: data minimization, on-device processing, differential privacy and encryption.",
    links: [{ label: "Apple privacy", url: "https://www.apple.com/privacy/" }]
  },
  Spinnaker: {
    primer: "Netflix's continuous-delivery platform: pipelines, canary analysis and multi-cloud deploys.",
    links: [{ label: "Spinnaker docs", url: "https://spinnaker.io/docs/" }]
  },
  "Chaos engineering": {
    primer: "Deliberately injecting failures to find weaknesses before they find you — Chaos Monkey and Gremlin style.",
    links: [{ label: "Principles of Chaos", url: "https://principlesofchaos.org/" }]
  },
  ML: {
    primer: "Machine learning fundamentals and how models actually ship in production systems.",
    links: [{ label: "Google ML crash course", url: "https://developers.google.com/machine-learning/crash-course" }]
  },
  Postgres: {
    primer: "PostgreSQL — the open-source relational database: MVCC, indexing, transactions and replication.",
    links: [{ label: "PostgreSQL docs", url: "https://www.postgresql.org/docs/" }]
  },
  Workers: {
    primer: "Cloudflare Workers: serverless functions at the edge on V8 isolates — cold starts, limits, KV and D1.",
    links: [{ label: "Cloudflare Workers docs", url: "https://developers.cloudflare.com/workers/" }]
  },
  "C/C++": {
    primer: "Systems programming: pointers, memory management, RAII, and the tradeoffs of both languages.",
    links: [{ label: "cppreference", url: "https://en.cppreference.com/w/" }]
  }
};

/* ---------- practice pools (design / behavioral / exec) ---------- */
const POOL_INFO: Record<string, TopicInfo> = {
  sysdesign: {
    primer: "A structured approach: clarify requirements → estimate scale → sketch components → data model → tradeoffs → failure modes.",
    links: [
      { label: "System design primer", url: "https://github.com/donnemartin/system-design-primer" },
      { label: "Designing Data-Intensive Applications", url: "https://dataintensive.net/" }
    ]
  },
  behavioral: {
    primer: "STAR stories: specific situation, your action, measured result. Every story needs a real outcome and a lesson.",
    links: [
      { label: "STAR method (The Muse)", url: "https://www.themuse.com/advice/star-interview-method" },
      { label: "Amazon leadership principles", url: "https://www.amazon.jobs/en/principles" }
    ]
  },
  cto: {
    primer: "Executive lens: org building, vision, budget, security and board communication — answers land in business terms.",
    links: [{ label: "An Elegant Puzzle", url: "https://www.elegantpuzzle.com/" }]
  },
  ceo: {
    primer: "Strategy, markets, fundraising and culture — every answer ties back to outcomes, risk and the people who execute.",
    links: [{ label: "YC library", url: "https://www.ycombinator.com/library" }]
  }
};

/* ---------- resolution ---------- */
const GENERIC_INFO: TopicInfo = {
  primer: "Master the fundamentals, see how it's used in real systems, then practice answering interview questions about it.",
  links: [
    { label: "MDN Web Docs", url: "https://developer.mozilla.org/" },
    { label: "freeCodeCamp", url: "https://www.freecodecamp.org/" },
    { label: "InterviewBit", url: "https://www.interviewbit.com/" }
  ]
};

const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

/** Resolves a topic label to primer + links. Exact match first, then per-category fallbacks, then generic. */
export function getTopicInfo(topic: string, pool?: keyof typeof POOL_INFO): TopicInfo {
  const key = norm(topic);
  if (SKILL_INFO[topic] ?? SKILL_INFO[key]) return SKILL_INFO[topic] ?? SKILL_INFO[key];
  if (FOCUS_INFO[topic] ?? FOCUS_INFO[key]) return FOCUS_INFO[topic] ?? FOCUS_INFO[key];
  if (TECH_INFO[topic] ?? TECH_INFO[key]) return TECH_INFO[topic] ?? TECH_INFO[key];
  if (pool && POOL_INFO[pool]) return POOL_INFO[pool];
  /* keyword fallbacks for long topic labels that embed a known term */
  for (const term of Object.keys(TECH_INFO)) {
    if (key.includes(norm(term))) return TECH_INFO[term];
  }
  for (const term of Object.keys(SKILL_INFO)) {
    if (key.includes(norm(term))) return SKILL_INFO[term];
  }
  return GENERIC_INFO;
}

/** True when a topic resolves to a specific curated entry (not the generic fallback) — used by the integrity test. */
export function hasSpecificInfo(topic: string): boolean {
  const key = norm(topic);
  return !!(SKILL_INFO[topic] ?? SKILL_INFO[key] ?? FOCUS_INFO[topic] ?? FOCUS_INFO[key] ?? TECH_INFO[topic] ?? TECH_INFO[key]);
}
