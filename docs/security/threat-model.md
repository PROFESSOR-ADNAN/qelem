# STRIDE Threat Model: Qelem

This document defines the formal STRIDE threat analysis for the Qelem platform, covering potential threat vectors, likelihood, impact, and engineering mitigations implemented in code and infrastructure.

---

## 1. System Context & Trust Boundaries

```
[ Public Internet: Browser Client / Mobile PWA ]
                      │
                      ▼ (HTTPS / TLS 1.3)
      [ Boundary 1: Cloudflare WAF / CDN / Nginx ]
                      │
                      ▼ (Reverse Proxy / HTTP/2)
      [ Boundary 2: Express API Clusters (Node.js) ]
         │                   │                   │
         ▼                   ▼                   ▼
[ MongoDB Replica Set ]  [ Valkey (Redis) ]  [ S3 Object Storage ]
                             ▲                   ▲
                             │                   │
                     [ Boundary 3: Background Worker Pool ]
```

---

## 2. STRIDE Matrix & Mitigation Analysis

### 2.1 Spoofing (Identity & Authenticity)

| Threat | Description | Impact | Mitigation Implemented |
|---|---|---|---|
| **S1: Credential Stuffing & Brute Force** | Adversary attempts automated credential guessing on `/api/v1/auth/login`. | High (Account takeover) | **Mitigation:** Redis-backed sliding window rate limiter (5 failed attempts per 15 min per IP/username). Argon2id key derivation with high memory cost ($64\text{ MB}$, 3 iterations, 4 parallelism). Uniform error response for unknown user and incorrect password. |
| **S2: Session Hijacking via Stolen Token** | Adversary intercepts refresh token or bearer access token. | High | **Mitigation:** Refresh token stored in `httpOnly`, `secure`, `sameSite: strict` cookie. Access token short-lived (15 min). Token rotation on refresh: reuse of an old refresh token invalidates the entire token family. Blacklist in Redis. |
| **S3: Email Forgery / Unverified Posting** | Adversary creates accounts with someone else's email to publish spam. | Medium | **Mitigation:** `requireEmailVerified` middleware blocks post, comment, and report creation until email link is verified with signed cryptographic token. |

---

### 2.2 Tampering (Data Integrity)

| Threat | Description | Impact | Mitigation Implemented |
|---|---|---|---|
| **T1: Keyset Cursor Tampering** | Adversary alters pagination cursor to probe private posts, bypass blocks, or manipulate feed order. | High | **Mitigation:** Keyset cursors are encrypted/signed with HMAC-SHA256 (`@qelem/shared/cursors`). Payload includes `createdAt`, `id`, `filterHash`, and expiration timestamp. Signature mismatch or expiration immediately returns HTTP 400 Bad Request. |
| **T2: Post Counter Manipulation** | Adversary spams like/unlike requests to corrupt counter totals. | Medium | **Mitigation:** Likes and bookmarks use natural unique compound keys `(userId, targetId)` with unique index in MongoDB. Redis counters use idempotent set operations (`HINCRBY`) and 5-second absolute `$set` flushes. Reconciliation worker synchronizes counts against real documents nightly. |
| **T3: Image Pixel Bomb / Decompression Bomb** | Adversary uploads a 100,000 x 100,000 pixel image disguised in small file to exhaust worker memory. | High (Worker OOM / DoS) | **Mitigation:** Direct-to-storage presigned upload enforces strict `content-length-range` (max 5 MB). Sharp processing worker limits input pixels to 24,000,000 (`limitInputPixels: 24_000_000`). Images exceeding dimensions are rejected before decoding. |
| **T4: SVG Stored XSS & Polyglots** | Adversary uploads SVG containing `<script>` or GIF/HTML polyglots to execute script in viewer's browser. | Critical (Stored XSS) | **Mitigation:** Worker validates file magic bytes against binary allowlist (`image/jpeg`, `image/png`, `image/webp`). SVGs are completely prohibited. Sharp completely decodes pixel buffer and re-encodes to pure WebP, destroying any polyglot shell. Processed media is hosted on separate domain (`media.example.com`) with `Content-Security-Policy: sandbox; default-src 'none'`. |

---

### 2.3 Repudiation (Auditability)

| Threat | Description | Impact | Mitigation Implemented |
|---|---|---|---|
| **R1: Denial of Moderation Action** | Moderator denies deleting post or suspending user without log trace. | Medium | **Mitigation:** Administrative and moderation actions write structured immutable `AuditLog` records in MongoDB with `actorId`, `action`, `targetType`, `targetId`, `reason`, `ipAddress`, and `timestamp`. |
| **R2: Content Deletion Repudiation** | User claims content was unlawfully deleted by platform. | Low | **Mitigation:** User deletions follow soft-delete pattern (`isDeleted: true`, `deletedAt: Date`) before asynchronous purge worker cleans up. |

---

### 2.4 Information Disclosure (Confidentiality)

| Threat | Description | Impact | Mitigation Implemented |
|---|---|---|---|
| **I1: EXIF / GPS Geolocation Leakage** | Photos taken by students contain embedded latitude/longitude EXIF tags, leaking home/campus location. | High (Privacy violation) | **Mitigation:** Worker strips all EXIF, GPS, and camera metadata during variant generation via `sharp().rotate().webp()`. Tested in automated attack suite (`tests/media-attacks/attacks.test.ts`). |
| **I2: IDOR (Insecure Direct Object Reference)** | User modifies `postId` in request to edit or delete someone else's devlog. | High | **Mitigation:** Controller queries `Post.findOne({ _id: id, authorId: req.user._id, isDeleted: false })`. 30-minute post edit window is strictly enforced server-side. |
| **I3: CDN / Proxy Cache Leakage** | Nginx or Cloudflare CDN caches authenticated endpoints (SSE stream, notifications, bookmarks). | High | **Mitigation:** Nginx configuration sets `Cache-Control: private, no-cache, no-store, must-revalidate` on all `/api/` endpoints. `Pragma: no-cache` header emitted. Only processed public media and static immutable JS/CSS bundles receive `public, max-age=31536000, immutable`. |
| **I4: Block List Bypass via Feeds** | Blocked user observes author's posts or profile. | Medium | **Mitigation:** Keyset feed generator filters out posts from blocked and blocking users at query level. SSE real-time stream checks block relationships before dispatching notifications. |

---

### 2.5 Denial of Service (Availability)

| Threat | Description | Impact | Mitigation Implemented |
|---|---|---|---|
| **D1: Fan-out Explosion on Viral Post** | Author with 50,000 followers publishes post, triggering 50,000 database writes, overloading worker queue. | High | **Mitigation:** Hybrid fan-out model (ADR-0004). Authors with $\ge 2,000$ followers skip write fan-out; their posts are merged at read time from author timeline. Write fan-out is chunked into 1,000-follower jobs with exponential backoff and job deduping. |
| **D2: Flaky Network Write Floods** | Mobile connection drop causes app to repeatedly re-send post creation requests. | Medium | **Mitigation:** Client sends UUIDv4 `idempotencyKey`. Server checks Redis cache / MongoDB natural unique index to ensure at-most-once execution within 24 hours. |
| **D3: CGNAT / Shared IP Collateral Damage** | Thousands of Ethio Telecom mobile users share a single NAT IPv4 gateway; one attacker triggers IP rate limit for all university students. | High | **Mitigation:** Rate limiter partitions by `(IP, Client-Fingerprint)` and applies dual-tier rate limiting: relaxed IP thresholds for authenticated sessions identified by user ID. IPv6 addresses are grouped into `/64` subnets. |

---

### 2.6 Elevation of Privilege (Authorization)

| Threat | Description | Impact | Mitigation Implemented |
|---|---|---|---|
| **E1: Mass Assignment to Admin Role** | User sends `{ "role": "admin" }` during registration or profile update. | Critical | **Mitigation:** Zod schemas explicitly omit `role` from user input (`.strip()`). Role assignment is exclusively handled in `admin.controller.ts` behind `requireRole(['admin'])`. |
| **E2: Unbounded Post Depth Cursors** | Adversary attempts deep keyset queries to exhaust MongoDB cursor memory or scan large collection. | Medium | **Mitigation:** Keyset cursor depth capped at 600 items for home feed (ADR-0006). Profile and tag feeds use strict indexed range queries without deep skip. |

---

## 3. Threat Verification & Test Evidence

All critical threat mitigations are validated by automated test suites in the repository:
1. **Cursor Tampering & Signature Check:** `tests/unit/cursors.test.ts` (PASS)
2. **Feed Ordering & Reference Model:** `tests/property/feed-reference.test.ts` (PASS)
3. **Pagination Keyset Integrity (0 duplicates, 0 skips):** `tests/property/cursor-pagination.test.ts` (PASS)
4. **Media Attacks (SVG XSS, Polyglot, 24MP bomb, EXIF strip):** `tests/media-attacks/attacks.test.ts` (PASS)
