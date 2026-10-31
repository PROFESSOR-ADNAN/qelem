# ADR 0007: Cold-Start Timeline Rebuild, Single-Flight Stampede Control, and Degraded Read Path

## Status
Accepted

## Context
Redis may be completely flushed, restarted, or an inactive user may return after their 30-day timeline TTL expired. If 1,500 concurrent users request their home feeds immediately after a cache loss, the system must not collapse MongoDB under an avalanche of uncoordinated fan-out rebuild queries (thundering herd / cache stampede).

## Decision
1. **Cold-Start Rebuild**:
   - If `feed:{userId}` is missing, acquire an ephemeral Redis lock `lock:feed_rebuild:{userId}` with a 5-second TTL.
   - Read the user's followed accounts (capped at 500 newest followed).
   - Fetch the latest published posts for those authors from `author:{authorId}:recent` (falling back to indexed MongoDB query for cache misses).
   - Perform an in-memory k-way merge of the newest 600 items.
   - Populate `feed:{userId}` via `ZADD`, store metadata in `feedmeta:{userId}`, and rebuild `following_hf:{userId}`.
2. **Single-Flight & Stampede Defense**:
   - Concurrent incoming requests for the same user wait up to 300ms for the rebuild lock to release.
   - If the lock is held or if global active rebuilds exceed `GLOBAL_REBUILD_CONCURRENCY = 20`, immediately execute the **Degraded Read Path**.
3. **Degraded Read Path**:
   - Execute a single indexed, bounded MongoDB query (`$in: followeeIds`, `state: 'published'`, limit 20, newest first).
   - Asynchronously enqueue a background rebuild job (`rebuild` BullMQ queue with rate limiting).
   - Return HTTP 200 with the 20 items and a response header `X-Feed-Degraded: true`.

## Consequences
- Guaranteed zero MongoDB crash even if Redis is wiped under maximum peak traffic.
- User experience is preserved with sub-second response times even during extreme recovery states.
