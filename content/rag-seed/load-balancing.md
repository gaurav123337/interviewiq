# Load Balancing

A load balancer spreads incoming requests across a pool of servers so that no single machine is overwhelmed, and so the system keeps working when an individual server fails. It is the front door to almost every horizontally scaled service.

## Layer 4 versus Layer 7

A Layer 4 balancer routes on TCP/UDP information — source and destination IP and port — without inspecting the payload. It is fast and protocol-agnostic. A Layer 7 balancer understands the application protocol (usually HTTP), so it can route on the URL path, headers, or cookies, terminate TLS, and rewrite requests. Layer 7 is more flexible; Layer 4 is cheaper per request.

## Balancing algorithms

Round-robin sends each request to the next server in order. Least-connections favors the server with the fewest active requests, which is better when request durations vary widely. Weighted variants give bigger machines a larger share. Consistent hashing routes a given key to the same server, which preserves cache locality and session affinity.

## Health checks and failover

A balancer continuously probes its backends with health checks and removes any that stop responding, then re-adds them when they recover. This is what turns a pool of unreliable servers into a reliable service.

## Sticky sessions

Sticky sessions (session affinity) pin a client to one server so in-memory session state stays reachable. It is convenient but couples the client to a specific machine, which hurts even load distribution and complicates failover. Externalizing session state to a shared store instead — a database or Redis — keeps every server stateless, which is the more scalable design.
