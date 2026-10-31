# Qelem Product Requirements & User Story Matrix

## 1. Product Summary
Qelem (ቀለም) is a devlog and learning-in-public community web application designed specifically for Ethiopian computer science students, bootcamp participants, and junior developers. The system emphasizes text-first, 3G data-saving devlog sharing with optional code snippets and optimized screenshots.

## 2. User Persona Profiles
- **CS Student / Junior Developer (Primary)**: Posts daily devlogs ("what I built today", "what algorithm I mastered"), asks for feedback, tags cohort departments (e.g. AAU CS, AASTU SE), tracks peers.
- **Tech Mentor / Community Lead**: Follows cohorts, curates technical discussions, bookmarks exceptional devlogs, and highlights student achievements.
- **Moderator / Admin**: Enforces community safety guidelines, reviews reported devlogs, removes spam, and manages university/bootcamp cohort listings.

## 3. User Stories & Acceptance Criteria Matrix

| ID | User Story | Acceptance Criteria | Automated Test Mapping |
|---|---|---|---|
| US-01 | As a visitor, I want to register with email, username, and password | Unique lowercase username (`[a-z0-9_]`, 3-20 chars); Argon2id hash; email verification token generated | `tests/integration/auth.test.ts` |
| US-02 | As a student, I want to choose my university or bootcamp cohort | Can select from admin-managed cohort list; displays badge on profile and posts | `tests/integration/users.test.ts` |
| US-03 | As a user, I want to log in securely | Returns short-lived JWT access token (15m) + httpOnly refresh cookie; account locks after 5 failed attempts | `tests/integration/auth.test.ts` |
| US-04 | As a user, I want to rotate my session seamlessly | Refresh token rotates on every call; reuse of old token immediately revokes family | `tests/integration/auth.test.ts` |
| US-05 | As a user, I want to post a devlog with code | Text up to 2,000 chars; code block up to 3,000 chars with syntax highlighting; max 5 tags; max 5 mentions | `tests/integration/posts.test.ts` |
| US-06 | As a mobile user, I want idempotent post submission | Re-submitting with identical `clientPostId` on dropped network returns existing post without duplicate insert | `tests/integration/idempotency.test.ts` |
| US-07 | As a user, I want to attach up to 4 images | Presigned upload directly to S3; MIME validated; variants generated; EXIF removed | `tests/integration/media.test.ts` |
| US-08 | As a user, I want privacy when uploading mobile photos | Strips all EXIF, GPS location coordinates, and camera serial numbers before publishing | `tests/media-attacks/exif-strip.test.ts` |
| US-09 | As a user, I want to edit my post within 30 minutes | Editing updates text and code; shows `editedAt` indicator; media cannot be changed; invalidates post cache | `tests/integration/posts.test.ts` |
| US-10 | As a user, I want to soft-delete my post | Sets `deletedAt`; instantly hidden from public feeds and author profile; permanently purged in 30 days | `tests/integration/posts.test.ts` |
| US-11 | As a student, I want to follow my classmates | Idempotent follow/unfollow; increments counts; updates timeline fan-out graph | `tests/integration/graph.test.ts` |
| US-12 | As a user, I want to view my home feed | Chronological order (newest first); shows posts from followed authors; sub-200ms p95 latency | `tests/property/feed-reference.test.ts` |
| US-13 | As a user, I want to scroll without duplicate or skipped posts | Keyset cursors ensure zero duplicates and zero skipped posts during active scrolling | `tests/property/cursor-pagination.test.ts` |
| US-14 | As a follower of a viral mentor (>2000 followers), I want to see their posts | High-fanout posts are merged dynamically into home feed at read time | `tests/integration/hybrid-fanout.test.ts` |
| US-15 | As a user, I want to like a post | Idempotent like toggle; Redis live counter update; asynchronous reconciliation | `tests/integration/engagement.test.ts` |
| US-16 | As an author, I want aggregated like notifications | 50 likes in 10 minutes produces one aggregated notification ("Sara and 49 others liked your post") | `tests/integration/notifications.test.ts` |
| US-17 | As a user, I want to comment on devlogs | Top-level comments and 1-level nested replies; mentions parsed; plain text only | `tests/integration/comments.test.ts` |
| US-18 | As a user, I want to bookmark posts for later study | Idempotent bookmark; private bookmark list cursor-paginated | `tests/integration/engagement.test.ts` |
| US-19 | As a user, I want live notification badges | SSE connection sends real-time unread counter update; reconnects automatically | `tests/integration/stream.test.ts` |
| US-20 | As a user on slow 3G, I want Data Saver mode | Image variants load as low-byte placeholders (ThumbHash) until tapped | `web/src/pages/Feed.test.tsx` |
| US-21 | As an Amharic speaker, I want the UI in Amharic | Ethiopic font; full English/Amharic toggle; dates formatted in `Africa/Addis_Ababa` | `web/src/i18n/i18n.test.ts` |
| US-22 | As an offline user, I want drafts saved locally | IndexedDB (Dexie) preserves post drafts and queues submissions for automatic reconnect | `web/src/offline/queue.test.ts` |
| US-23 | As a user, I want to browse trending devlogs | Explore feed ranked by engagement decay formula; author diversity guard limits top 50 posts | `tests/integration/explore.test.ts` |
| US-24 | As a user, I want to filter explore by cohort or tag | Explore query accepts `?cohort=&tag=`; uses indexed database queries | `tests/integration/explore.test.ts` |
| US-25 | As a student sharing on Telegram, I want a rich preview card | Social crawlers receive minimal HTML page with Open Graph title, description, and image | `tests/integration/share-preview.test.ts` |
| US-26 | As a harassed user, I want to block an abusive account | Block removes bidirectional follows, hides posts, and prevents comments and mentions | `tests/integration/graph.test.ts` |
| US-27 | As a user, I want to mute noisy accounts | Muting hides content for muter only; muted account is not notified | `tests/integration/graph.test.ts` |
| US-28 | As a user, I want to report inappropriate content | Submit report with categorical reason; moderators review in admin queue | `tests/integration/reports.test.ts` |
| US-29 | As a moderator, I want to hide violating posts | Hiding post takes effect instantly at read time across all feeds | `tests/integration/moderation.test.ts` |
| US-30 | As an admin, I want to suspend malicious accounts | Suspended user is logged out, sessions revoked, and all posts hidden | `tests/integration/moderation.test.ts` |
| US-31 | As a user, I want to export my data | Background job compiles JSON/ZIP archive of profile, posts, comments, likes | `tests/integration/account.test.ts` |
| US-32 | As a user, I want to delete my account | 30-day grace period; purges personal data, comments anonymized if replies exist | `tests/integration/account.test.ts` |
| US-33 | As an SRE, I want zero data loss if Redis crashes | System switches to degraded MongoDB query; rebuilds cache lazily | `tests/chaos/redis-wipe.test.ts` |
| US-34 | As an SRE, I want counter drift self-healing | Hourly and nightly reconciliation jobs detect and correct drift to 0 | `tests/integration/counters.test.ts` |
| US-35 | As an admin, I want email quotas strictly guarded | Email worker throttles digest emails if daily provider free-tier quota is reached | `tests/unit/email-quota.test.ts` |
| US-36 | As a recipient, I want one-click email unsubscribe | Unsubscribe link with signed token updates preferences immediately | `tests/integration/email.test.ts` |
| US-37 | As an SRE, I want bounded Prometheus metrics | Metric labels never contain unbounded identifiers (user IDs, post IDs, tags) | `tests/unit/metrics.test.ts` |
| US-38 | As a security engineer, I want no stored XSS | HTML tags and script injections in bios, posts, and code are sanitized and rendered as text | `tests/security/xss.test.ts` |
| US-39 | As a user, I want "N new posts" pill | Real-time pill announces new posts without jumping the reader's scroll position | `web/src/pages/Feed.test.tsx` |
| US-40 | As an admin, I want TOTP MFA protection | Moderators and admins must configure TOTP MFA before accessing administrative routes | `tests/integration/auth.test.ts` |

## 4. Out-of-Scope (Explicit Non-Features for MVP)
- Private / protected accounts (all MVP accounts and posts are public).
- Direct messaging (DMs) - planned for standalone chat service.
- Video and audio uploads (text, code, and images only).
- Reposts and Quote Posts.
- Native mobile apps (PWA serves all mobile devices).
- Full-text fuzzy search engine (prefix search on usernames and tags is MVP).
- Ethiopian calendar conversion toggle (Addis Ababa timezone UTC+3 is MVP).
