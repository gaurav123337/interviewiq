# Message Queues

A message queue decouples a producer of work from its consumer. Instead of calling a service directly and waiting, a producer writes a message to the queue and moves on; a consumer reads and processes it later. This buys asynchrony, buffering against load spikes, and resilience when a downstream service is briefly down.

## Delivery guarantees

At-most-once delivery may drop messages but never repeats them. At-least-once delivery never loses a message but may deliver it more than once, so consumers must be idempotent — processing the same message twice must have the same effect as processing it once, often enforced with a deduplication key. Exactly-once is the hardest and is usually approximated by at-least-once delivery plus idempotent consumers.

## Queues versus logs

A traditional queue (such as RabbitMQ or SQS) removes a message once it is acknowledged; work is distributed across competing consumers. A log-based system (such as Apache Kafka) keeps messages in an ordered, append-only log that consumers read at their own offset. The log lets many independent consumers replay history and reprocess events, which a delete-on-ack queue cannot.

## Backpressure and dead letters

When producers outpace consumers, the queue grows. Backpressure mechanisms slow or reject producers before memory is exhausted. Messages that repeatedly fail processing are routed to a dead-letter queue for inspection instead of blocking the main queue forever. Together these keep a temporary slowdown from becoming a cascading failure.
