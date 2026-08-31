# Rate Limiting

Rate limiting caps how many requests a client may make in a window of time. It protects a service from abuse, from misbehaving clients, and from one tenant starving others, and it keeps costs and load predictable.

## Token bucket

A token bucket holds up to a fixed number of tokens and refills at a steady rate. Each request consumes a token; if the bucket is empty, the request is rejected or delayed. Because the bucket can fill up, it allows short bursts — up to the bucket size — while still bounding the long-run average rate. This burst tolerance is why the token bucket is the most widely used algorithm.

## Leaky bucket

A leaky bucket processes requests at a constant rate, queuing arrivals and "leaking" them out steadily. It smooths bursts into a uniform outflow, which is ideal when a downstream system needs a steady, predictable rate rather than occasional spikes.

## Fixed and sliding windows

A fixed-window counter simply counts requests per calendar window (say, per minute) and resets at the boundary. It is simple but allows a double burst straddling the boundary — a full quota at the end of one window and another at the start of the next. A sliding-window log or sliding-window counter weights the previous window to smooth that edge, trading a little more state for smoother enforcement.

## Distributed limits

When many servers share a limit, the counter must be centralized — commonly in Redis with atomic increment-and-expire operations — so all nodes agree. The response to a limited client should be an HTTP 429 with a `Retry-After` header, telling well-behaved clients exactly when to try again.
