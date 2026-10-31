# ADR 0010: Race-Safe Notification Aggregation Using MongoDB Partial Unique Indexes

## Status
Accepted

## Context
When a post receives 50 likes in 2 minutes, creating 50 separate notifications overwhelms the user and floods the database. Instead, notifications must aggregate into human-readable digests: "Sara and 5 others liked your post". However, concurrent likes from multiple users arriving simultaneously can cause race conditions if aggregation is performed without database-enforced concurrency locks.

## Decision
1. Group notifications by a deterministic `groupKey`: `${type}:${targetType}:${targetId}` (e.g., `like:post:67243c...`).
2. Add a **MongoDB Partial Unique Index** on the `notifications` collection:
   `createIndex({ userId: 1, groupKey: 1 }, { unique: true, partialFilterExpression: { readAt: null } })`.
3. When an event arrives:
   - Attempt an `findOneAndUpdate` where `userId`, `groupKey`, and `readAt: null`:
     - Append the new `actorId` (keeping up to the 3 most recent).
     - Increment `actorCount` by 1.
     - Update `updatedAt` to `Date.now()`.
   - If no document exists, perform an `insertOne`.
   - In the event of a concurrent race where two workers try to `insertOne` simultaneously, MongoDB's partial unique index rejects the second insert with a duplicate key error (`E11000`). The worker catches this error and transparently retries as an `findOneAndUpdate`.
4. Marking a notification as `readAt: Date.now()` removes it from the partial unique index filter window. A subsequent like after the notification has been marked read safely starts a fresh, new notification group.
5. In-app toggling defense: The `likes` collection tracks `notified: boolean`. An author is only notified on the initial like; toggling like on/off does not send duplicate notifications.

## Consequences
- Guaranteed zero duplicate notification groups even under heavy parallel load.
- No distributed Redis locks required for notification aggregation.
