# The CAP Theorem

The CAP theorem states that a distributed data store can guarantee at most two of three properties at once: Consistency, Availability, and Partition tolerance. Consistency here means every read sees the most recent write; availability means every request gets a non-error response; partition tolerance means the system keeps working when the network drops messages between nodes.

## Why you don't really choose two of three

In any real distributed system, network partitions happen — cables fail, packets drop. So partition tolerance is not optional; you must have it. That means the real choice is what to do *during* a partition: sacrifice consistency (keep serving, risk stale or conflicting data) or sacrifice availability (refuse requests until the partition heals). Systems are therefore usefully described as CP or AP.

A CP system, such as a strongly consistent database using consensus, would rather return an error than serve stale data. An AP system, such as a Dynamo-style store, would rather stay available and reconcile conflicting writes afterward.

## PACELC

CAP only describes behavior during a partition. PACELC extends it: if there is a Partition, choose between Availability and Consistency; Else (normal operation), choose between Latency and Consistency. This captures a truth CAP omits — even with a healthy network, stronger consistency costs latency, because a write must reach more replicas before it is acknowledged.

## Practical takeaway

There is no globally "correct" point on this spectrum. A payments ledger leans toward consistency; a social feed or shopping cart often leans toward availability and low latency, accepting eventual consistency and resolving conflicts with techniques like last-write-wins or CRDTs.
