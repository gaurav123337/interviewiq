# REST versus GraphQL

REST and GraphQL are two styles for building web APIs. REST models the world as resources, each with a URL, manipulated with HTTP verbs. GraphQL exposes a single endpoint and a typed schema, and lets the client ask for exactly the fields it wants in one query.

## Over-fetching and under-fetching

REST endpoints return a fixed shape. A screen that needs only a user's name still downloads the whole user object (over-fetching), and a screen that needs a user plus their recent posts often makes several round trips (under-fetching). GraphQL reduces over-fetching by letting the client specify precisely which fields it needs, and reduces under-fetching by resolving related data in a single request.

## Where REST wins

REST wins on caching and simplicity. Because each resource has a stable URL and GET requests are cacheable by the entire HTTP stack — browsers, CDNs, and proxies — REST is a strong fit for long-lived public APIs and content that changes slowly. GraphQL queries are typically POSTs to one endpoint, so they bypass that free HTTP caching and need application-level caching instead.

## Where GraphQL wins

GraphQL shines when many different clients, especially mobile apps on slow networks, need different slices of a rich, interconnected data graph. The typed schema also gives strong tooling, introspection, and a clear contract between front end and back end.

## The trade-off

GraphQL's flexibility moves complexity to the server: a single query can trigger many expensive resolvers, so it needs query-cost limits, depth limits, and careful batching (for example with DataLoader) to avoid the N+1 problem. REST keeps the server simple but pushes coordination of multiple calls to the client. Neither is universally better; the choice follows the clients and the data.
