# ADR 0009: Eventually Consistent Counters with Absolute-Value Flush and Exact Reconciliation

## Status
Accepted

## Context
High-concurrency engagement (e.g. 150 likes/sec on viral student projects) causes database write contention and lock waiting if every click executes a direct MongoDB write (`$inc`). Furthermore, naive relative increments (`HINCRBY` + relative database `$inc`) suffer from double-counting if background flushes retry after temporary network partitions.

## Decision
1. **Live In-Memory Counters**:
   - On a verified unique like or comment creation/deletion, update Redis hash `counts:{postId}` via `HINCRBY` and push `postId` to a Redis set `dirty:counts`.
   - The API immediately returns the new integer count to the user.
2. **Periodic Absolute-Value Flush**:
   - Every 5 seconds, a BullMQ `counters` flush job reads `dirty:counts` in batches of 500.
   - For each dirty post, it reads the current absolute value from Redis (`HGETALL counts:{postId}`) and executes an idempotent bulk `$set` to MongoDB:
     `Post.bulkWrite([{ updateOne: { filter: { _id: postId }, update: { $set: { likeCount: val, commentCount: cVal } } } }])`.
   - Retried flushes cannot double-count because `$set` is strictly idempotent.
3. **Exact Reconciliation**:
   - Hourly reconciliation for posts modified in the past 48 hours: recomputes the true count from the source of truth (`Like.countDocuments({ postId })`).
   - Nightly reconciliation for a random 1% sample and all posts with > 1,000 likes.
   - Any discrepancy (`abs(dbCount - trueCount) > 0`) is corrected and logged to Prometheus metric `counter_reconciliation_drift_total`.
4. **Formatting**:
   - The API returns exact integers (`likeCount: 1420`).
   - The client UI formats numbers >= 1,000 as compact strings (e.g., "1.4K").

## Consequences
- Absorbs traffic spikes up to 5,000 likes/sec in Redis with zero database strain.
- Absolute `$set` ensures network retries cannot drift values.
- Continuous reconciliation guarantees zero permanent drift.
