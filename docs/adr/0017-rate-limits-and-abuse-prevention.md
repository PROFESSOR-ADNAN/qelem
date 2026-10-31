# ADR 0017: Multi-Tiered Rate Limiting, New-Account Restrictions, and Anti-Spam Architecture

## Status
Accepted

## Context
In Ethiopia, mobile internet traffic frequently traverses Carrier-Grade NAT (CGNAT) where thousands of mobile subscribers share a small pool of public IP addresses (e.g. Ethio Telecom mobile gateways). Aggressive per-IP rate limits block legitimate students sharing campus or mobile cellular subnets. Conversely, bots and spammers must be throttled before consuming computational or storage resources.

## Decision
1. **Two-Tiered Rate Limiting (IP + Authenticated Identity)**:
   - Global IP limits are intentionally generous to accommodate CGNAT: 1,200 requests / 15 min per IP.
   - Strict authenticated limits are tied to `req.user.id`:
     - Login: 10 attempts / 15 min per IP; 5 attempts / 15 min per targeted account username/email (lockout).
     - Register: 5 accounts / hr per IP.
     - Post Creation: 30 posts / day (6 / hr).
     - Comments: 10 / min.
     - Likes: 120 / min.
     - Follows: 60 / hr (200 / day).
     - Media Uploads: 40 / day (8 / min).
2. **New-Account Sandbox (< 7 Days or Unverified)**:
   - Unverified accounts cannot post, comment, upload media, or follow > 20 users.
   - Accounts < 7 days old are restricted to 10 posts / day, 20 follows / day, and maximum 2 links per post.
3. **Duplicate & Burst Spam Defense**:
   - Duplicate post rule: SHA256 content hash of `(authorId + normalizedText + codeBody)` checked against past 24 hours. Duplicate submissions return HTTP 409 Conflict.
   - Accounts exceeding 3x normal like/follow rates are flagged with `auditLogs` and auto-throttled to cooling-off queues.

## Consequences
- Legitimate Ethiopian students on shared campus WiFi / 4G CGNAT are never falsely rate-limited.
- Prevents coordinated bot registration and duplicate post spam.
