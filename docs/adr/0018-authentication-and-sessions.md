# ADR 0018: Authentication Foundation: Argon2id, Short-Lived JWTs, and Rotating Refresh Tokens

## Status
Accepted

## Context
User credentials require state-of-the-art cryptographic hashing resistant to GPU-accelerated dictionary attacks. Stateless JWTs offer low-latency verification without database lookups, but long-lived JWTs cannot be revoked immediately if a device is stolen or an account is suspended.

## Decision
1. **Password Hashing**:
   - Utilize `argon2id` (RFC 9106) with memory cost 64 MB (`m=65536`), time cost `t=3`, and parallelism `p=1` (or bcrypt cost factor 12 if memory constraints dictate).
   - Stored in Mongoose `User` schema with `{ select: false }` to prevent accidental inclusion in query results or JSON serializers.
   - Authentication errors return identical RFC 9457 messages for "invalid email" and "invalid password" to prevent user enumeration.
2. **Access & Refresh Tokens**:
   - Access Token: Short-lived (15 minutes) signed JWT containing `{ sub: userId, role: role }`.
   - Refresh Token: High-entropy cryptographically secure random token (32 bytes hex), stored as a SHA256 hash in the `refreshTokens` collection with an associated `familyId`.
   - Stored on the client in an `httpOnly`, `Secure`, `SameSite=Strict` cookie path-restricted to `/api/v1/auth`.
3. **Automatic Reuse Detection & Revocation**:
   - Every refresh request rotates the token: the old token is marked revoked and a new refresh token is issued in the same family.
   - If an already-revoked refresh token is presented (indicating theft or token replay), the entire token family is immediately revoked, forcing all associated devices to log in again.
4. **Staff Multi-Factor Authentication (MFA)**:
   - TOTP MFA (RFC 6238) is mandatory for accounts with role `moderator` or `admin`.

## Consequences
- Protection against credential theft, replay attacks, and offline password cracking.
- Instant suspension and revocation across all active user sessions within 5 seconds.
