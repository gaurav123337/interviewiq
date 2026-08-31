# Consistent Hashing

Consistent hashing is a technique for distributing keys across a changing set of servers so that adding or removing a server moves as few keys as possible. It is the backbone of distributed caches, sharded databases, and partitioned message systems.

## The problem with modulo hashing

The naive way to shard is `server = hash(key) % N`, where N is the number of servers. It spreads keys evenly, but the moment N changes — a server is added or dies — almost every key maps to a different server. For a cache, that is catastrophic: nearly the entire cache misses at once, and the backing store is hit by a stampede.

## The hash ring

Consistent hashing places both servers and keys on a circular hash space, the "ring." A key is owned by the first server encountered moving clockwise from the key's position. When a server is removed, only the keys it owned move — to the next server on the ring. When a server is added, it takes over only the slice of keys between it and its predecessor. On average, adding or removing one of N servers relocates just 1/N of the keys.

## Virtual nodes

A single position per server leads to uneven load, because the gaps between servers on the ring vary. The fix is virtual nodes: each physical server is hashed to many points on the ring. This smooths out the distribution and lets you weight larger servers by giving them more virtual nodes. It also makes rebalancing after a failure spread the load across many servers instead of dumping it all on one neighbor.
