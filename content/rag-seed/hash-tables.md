# Hash Tables

A hash table stores key-value pairs and offers average O(1) insertion, lookup, and deletion. A hash function maps each key to a bucket index; the value lives in that bucket. The whole data structure is a bet that the hash function scatters keys evenly.

## Collisions

Two keys can hash to the same bucket — a collision. There are two dominant strategies for handling them. **Separate chaining** keeps a small list (or tree) in each bucket and appends colliding entries. **Open addressing** stores every entry directly in the array and, on a collision, probes for the next free slot — linearly, quadratically, or with a second hash (double hashing). Chaining degrades gracefully under a high load; open addressing is more cache-friendly but suffers from clustering as it fills.

## Load factor and resizing

The load factor is the ratio of stored entries to buckets. As it rises, collisions rise and operations slow toward O(n). To prevent this, the table resizes — typically doubling the bucket count — once the load factor crosses a threshold (often around 0.7). Resizing requires rehashing every existing key into the new, larger array, an O(n) operation. Because resizes are rare and each moves many cheap insertions along, the amortized cost of insertion stays O(1).

## Why lookups can degrade

The O(1) guarantee is an average, not a worst case. A poor hash function, or adversarial input crafted to collide, can push everything into one bucket and turn lookups into O(n). This is why production hash tables use well-distributed hash functions, and why some randomize their seed to resist deliberate collision attacks.
