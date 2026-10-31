# ADR 0005: Signed Opaque Keyset Cursors

## Status
Accepted

## Context
Traditional offset pagination (`skip(N).limit(M)`) degrades to O(N) database scans, skips or duplicates items when new records are inserted during scrolling, and exposes predictable integer offsets susceptible to scraping. Furthermore, unverified client cursors allow query parameter manipulation and cursor forgery.

## Decision
All paginated endpoints accept an opaque base64url cursor `?cursor=&limit=` and return `{ items, nextCursor }`.
The cursor payload is a serialized JSON structure signed with HMAC-SHA256:
```json
{
  "v": 1,
  "kind": "home" | "explore" | "profile" | "tag" | "comments" | "notifications",
  "score": 1730419200000,
  "id": "67243c...",
  "ts": 1730420000000
}
```
1. `score` represents the primary ordering metric (e.g. `publishedAt` ms or `trendingScore`).
2. `id` represents the unique tie-breaker (MongoDB `_id` or `postId`).
3. The server signs `base64url(JSON)` with `HMAC-SHA256(CURREN_SECRET)`.
4. The cursor expires after 24 hours. If HMAC verification fails or version is unsupported, the server returns HTTP 400 Bad Request with RFC 9457 Problem Details.
5. Key rotation supports one previous secret during overlap periods.

## Consequences
- Guaranteed stable pagination without missed or duplicated items.
- Zero database collection scans during deep paging.
- Protects internal indexing details from external scrapers.
