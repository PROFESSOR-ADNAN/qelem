# ADR 0016: Soft Delete, 30-Day Purge Timing, and Account Deletion Semantics

## Status
Accepted

## Context
User deletion requests and post deletions must balance user privacy (right to be forgotten), moderation retention (investigating abusive content), and social graph integrity (preventing broken comment reply threads and counter corruption).

## Decision
1. **Post Soft Deletion**:
   - Setting `state: 'deleted'` and `deletedAt: new Date()` instantly hides the post from all public read paths via database and cache filtering.
   - Associated likes, comments, and notifications become invisible at read time.
   - Redis cached JSON is purged immediately.
   - A background purge worker permanently drops the document and attached media files from S3/R2 after 30 days (coinciding with the abuse investigation window).
2. **Account Deletion (30-Day Grace Period)**:
   - When a user requests account deletion, their status transitions to `state: 'pending_deletion'`.
   - The user is immediately logged out, active refresh tokens revoked, and their profile and posts hidden from public view.
   - The user has a 30-day grace window to log in and cancel the deletion request.
   - After 30 days, the purge worker permanently removes:
     - All user posts and linked media variants (issuing CDN cache purges).
     - Follow relationships and unread notifications.
     - User likes and bookmarks (triggering the normal counter decrement worker).
   - Comments with child replies are anonymized to `author: "Deleted User"` and `text: "[Comment deleted by user]"` to preserve thread context for other students. Comments without replies are hard-deleted.
   - The email is added to a one-way hashed suppression record to prevent re-registration spam.

## Consequences
- Protects student accounts from accidental deletions.
- Meets international privacy standards while preventing thread fragmentation in technical discussions.
