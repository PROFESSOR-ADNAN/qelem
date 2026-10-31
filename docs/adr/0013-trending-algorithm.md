# ADR 0013: Trending Score Formula, Snapshot Versioning, and Explore Feed Pagination

## Status
Accepted

## Context
Computing trending feeds dynamically on every request across 2 million posts using complex engagement formulas causes severe database CPU spikes. Furthermore, if a user paginates through an explore feed while the ranking shifts, items drift between pages, causing duplicates and missed posts.

## Decision
1. **Trending Decay Score Formula**:
   Calculated for posts published in the last 48 hours:
   $$\text{Score} = \frac{\text{likes} + (2 \times \text{comments}) + (0.5 \times \text{bookmarks})}{(\text{ageHours} + 2)^{1.5}}$$
2. **Author Diversity Guard**:
   At most 2 posts per author are allowed in the top 50 trending posts to prevent a single prolific user or bot from monopolizing the community explore page.
3. **Snapshot Versioning & Pointer Swap**:
   - Every 5 minutes, a BullMQ `trending` worker computes the top trending list and writes it to Redis as a versioned list: `trending:global:{timestamp}`.
   - The worker atomically updates a pointer key `trending:global:latest` -> `{timestamp}`.
   - Explore feed cursors carry the snapshot version `ts`. When the user requests the next page, the query reads from the exact snapshot version they started browsing, guaranteeing zero skipped or duplicated posts during pagination.
   - Older snapshot versions expire after 30 minutes (`EXPIRE 1800`).
4. **Fallback**:
   If the Redis snapshot is missing or flushed, fallback to a MongoDB indexed query on `(publishedAt desc, _id desc)` with `X-Feed-Degraded: true`.

## Consequences
- Constant O(1) response times for explore feed requests.
- Stable, drift-free pagination for browsing users.
