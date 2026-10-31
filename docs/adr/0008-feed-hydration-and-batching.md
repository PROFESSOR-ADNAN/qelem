# ADR 0008: Feed Hydration, Batching, and Fixed-Query Budget

## Status
Accepted

## Context
Rendering a page of 20 posts naively results in N+1 database queries: 20 queries for authors, 20 for viewer like statuses, 20 for bookmark statuses, 20 for media assets, and 20 for engagement counts. This will exhaust connection pools and violate our sub-200ms latency SLO.

## Decision
Enforce a batched hydration pipeline with an invariant query count independent of the page size (max 5 database/cache operations per page):
1. **Post Fetching**:
   - Check `post:{postId}` cached JSON in Redis (pipeline `MGET`).
   - For cache misses, perform exactly ONE MongoDB `$in` query: `Post.find({ _id: { $in: missingIds } }).lean()`.
2. **Author Profile Hydration**:
   - Check `user:{authorId}` in Redis.
   - For cache misses, perform exactly ONE MongoDB `$in` query: `User.find({ _id: { $in: authorIds } }).select('username displayName avatarMediaId cohortId').lean()`.
3. **Viewer Relationship State**:
   - For the authenticated viewer, perform ONE query on `Like.find({ userId, postId: { $in: postIds } })` and ONE on `Bookmark.find({ userId, postId: { $in: postIds } })` (or Redis sets if warm).
4. **Read-Time Filtering & Refill**:
   - Filter out posts that are soft-deleted (`state !== 'published'`), authors that are suspended, authors blocked in either direction, and muted authors.
   - If filtering yields fewer than `limit` items, perform at most 3 bounded refill rounds using the signed cursor.
   - Compute `nextCursor` from the last *examined* entry in the timeline to prevent ever skipping unexamined items.

## Consequences
- Bounded database operations (O(1) database queries per feed request).
- Automated test verifies that fetching 5, 20, or 50 posts executes the exact same number of database roundtrips.
