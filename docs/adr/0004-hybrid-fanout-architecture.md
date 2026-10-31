# ADR 0004: Hybrid Fan-Out-On-Write and Fan-Out-On-Read Architecture

## Status
Accepted

## Context
Social feeds face two divergent scaling problems:
1. *Pure Fan-Out-On-Write (Push)*: When a user with 20,000 followers publishes a post, writing to 20,000 Redis sorted sets simultaneously causes massive write amplification, worker queue lag, and high Redis memory pressure.
2. *Pure Fan-Out-On-Read (Pull)*: When a user follows 500 people, aggregating posts dynamically on every feed request requires complex multi-way index joins that saturate database CPU at 200 reads/sec.

## Decision
Adopt a Hybrid Fan-Out Architecture with clear mathematical thresholds and hysteresis:
1. **Threshold & Hysteresis**:
   - `FANOUT_MAX_FOLLOWERS = 2000`: Authors with < 2,000 followers use Fan-Out-On-Write.
   - When an author reaches ≥ 2,000 followers, their `fanoutMode` transitions to `high_fanout`.
   - To prevent flapping near the boundary, hysteresis is applied: an author only transitions back to `normal` if their follower count drops to ≤ 1,600 followers.
2. **Timeline Capping**:
   - Every user's home feed timeline (`feed:{userId}`) is stored as a Redis Sorted Set (`ZSET`) capped at `FEED_MAX_ENTRIES = 600`.
   - Score = `publishedAt` timestamp in milliseconds; Member = `postId`.
3. **Active Follower Optimization**:
   - Write fan-out only updates followers active within `ACTIVE_WINDOW_DAYS = 14`.
   - `active:{userId}` is kept in Redis with a 14-day TTL, touched at most once per hour upon authenticated API requests. Inactive followers do not receive write fan-out; their feeds are rebuilt on-demand upon their next login.
4. **Read-Time Merge**:
   - High-fan-out authors write only to `author:{authorId}:recent` (latest 200 posts).
   - On `GET /feed/home`, the reader fetches their timeline from `feed:{userId}` AND merges the newest posts from authors in `following_hf:{userId}` (capped at 100 high-fan-out authors) within the same time window.
5. **Backpressure & Chunks**:
   - Fan-out occurs strictly in background BullMQ workers in chunks of `FANOUT_CHUNK = 1000` followers. The publish API request returns immediately upon saving to MongoDB.

## Alternatives
- *Pure Fan-Out-On-Write*: Catastrophic write lag for viral accounts.
- *Pure Fan-Out-On-Read*: Cannot sustain 200 feed reads/second within a 4 GB RAM VPS.

## Consequences
- Positive: Predictable O(1) reads for 95% of normal followees; bounded write work for high-fan-out accounts; fits easily into VPS memory limits.
- Negative: Read path must perform an in-memory k-way merge of up to 100 sorted lists (which is lightweight in Node.js for small slices) and deduplicate entries.
