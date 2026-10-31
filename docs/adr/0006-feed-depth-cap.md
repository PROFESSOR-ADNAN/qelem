# ADR 0006: Home Feed Depth Cap (600 Entries) vs Unbounded Pagination

## Status
Accepted

## Context
Redis RAM on our low-cost VPS is strictly budgeted (< 768 MB). Allowing unbounded Redis ZSETs for home timelines would consume excessive memory (e.g. 10,000 entries × 20,000 users = gigabytes of RAM). Additionally, consumer behavior analytics prove >99.7% of feed scroll depth terminates within the most recent 200-400 posts.

## Decision
1. Cap the home feed timeline (`feed:{userId}`) at exactly `FEED_MAX_ENTRIES = 600` items via `ZREMRANGEBYRANK feed:{userId} 0 -601` on every write.
2. When a reader scrolls to the 600th item, the API returns `nextCursor: null` with `endReason: "depth_limit"` and a friendly UI message inviting them to explore author profiles or search tags for older historical devlogs.
3. Profile feeds (`/users/:username/posts`) and Tag feeds (`/tags/:tag/posts`) support unbounded historical pagination using MongoDB keyset indexing on `(authorId, state, publishedAt desc, _id desc)` and `(tags, state, publishedAt desc, _id desc)`.

## Consequences
- Redis timeline memory is strictly bounded and mathematically provable.
- Real-time home feed performance remains sub-20ms.
- Full access to older devlogs remains accessible via profile and tag archives.
