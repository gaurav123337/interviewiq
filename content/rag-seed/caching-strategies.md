# Caching Strategies

Caching stores the result of expensive work close to where it is needed so the work is not repeated. The central trade-off is freshness versus cost: a cache serves stale data in exchange for speed, so every caching decision is really a decision about how stale is acceptable.

## Where caches live

Caches appear at every layer: the CPU, the operating system's page cache, an in-process memory cache, a shared cache like Redis or Memcached, a CDN at the network edge, and the browser. A request often passes through several of them, so a cache miss at one layer may still be a hit at another.

## Write policies

A write-through cache updates the cache and the backing store together, so reads after a write are always fresh, at the cost of slower writes. A write-back cache updates only the cache and flushes to the store later, which is fast but risks data loss if the cache dies before the flush. A cache-aside (lazy) pattern lets the application load into the cache on a miss and invalidate on a write; it is the most common because it keeps the cache out of the write path.

## Eviction and invalidation

Because memory is finite, caches evict entries. LRU (least recently used) evicts the entry untouched for the longest; LFU (least frequently used) evicts the least-requested. A TTL (time to live) bounds staleness by expiring entries after a fixed interval.

Cache invalidation — knowing when cached data is wrong — is famously one of the hardest problems in computing. Versioned cache keys sidestep it: instead of mutating or deleting an entry, you embed a version or content hash in the key, so a change produces a new key and old readers never see a half-updated value.
