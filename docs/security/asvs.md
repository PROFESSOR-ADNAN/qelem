# OWASP ASVS v4.0.3 Level 2 Compliance Checklist: Qelem

This document tracks verification against the OWASP Application Security Verification Standard (ASVS) 4.0.3 Level 2 requirements applicable to Qelem.

---

## V1: Architecture, Design and Threat Modeling

| Requirement ID | Description | Qelem Implementation / Evidence | Status |
|---|---|---|---|
| 1.1.1 | Verify use of a secure software development lifecycle. | GitHub Actions CI/CD with automated unit, property, and attack tests, linting, and Dependabot. | PASS |
| 1.1.2 | Verify threat modeling for all applications and features. | STRIDE threat model documented in `docs/security/threat-model.md`. | PASS |
| 1.2.1 | Verify all components are identified and evaluated for risks. | Dependencies pinned with integrity hashes in `package-lock.json`; audited via `npm audit`. | PASS |
| 1.4.1 | Verify access control enforcement occurs at a trusted layer. | Express server middleware (`authenticate`, `requireRole`, `requireEmailVerified`) enforces auth on every API route; client-side state is untrusted. | PASS |
| 1.5.1 | Verify architecture separates untrusted data (uploads) from trusted data. | Untrusted uploads land in private S3/R2 `incoming/` prefix; worker processes with isolated Sharp container, output to `media/`. | PASS |

---

## V2: Authentication

| Requirement ID | Description | Qelem Implementation / Evidence | Status |
|---|---|---|---|
| 2.1.1 | Verify password minimum length >= 8 characters. | Enforced via Zod schema: `z.string().min(8).max(128)`. | PASS |
| 2.1.2 | Verify passwords up to at least 64 characters are permitted. | Max password length set to 128 characters. | PASS |
| 2.1.7 | Verify password input is not truncated. | Full string hashed directly by Argon2id; no truncation. | PASS |
| 2.4.1 | Verify password hash uses Argon2id or bcrypt. | `argon2id` with `memoryCost: 65536`, `timeCost: 3`, `parallelism: 4` (ADR-0003). | PASS |
| 2.5.1 | Verify anti-automation against credential stuffing / brute force. | Sliding window Redis rate limiter: 5 attempts per 15 min per IP/username, progressive lockout. | PASS |
| 2.5.6 | Verify generic error responses on login failures. | Returns identical 401 `"Invalid username or password"` on both unknown account and incorrect password. | PASS |

---

## V3: Session Management

| Requirement ID | Description | Qelem Implementation / Evidence | Status |
|---|---|---|---|
| 3.1.1 | Verify session tokens use high-entropy random generation. | JWT signed with HMAC-SHA256 (32-byte secret); refresh tokens use `crypto.randomBytes(40).toString('hex')`. | PASS |
| 3.2.1 | Verify session tokens are transmitted using secure cookies or headers. | Access token in `Authorization: Bearer`; Refresh token in `httpOnly`, `secure`, `sameSite: strict` cookie. | PASS |
| 3.3.1 | Verify logout terminates session immediately. | Refresh token family revoked in MongoDB (`isRevoked: true`), Redis token blacklist populated. | PASS |
| 3.4.1 | Verify idle and absolute session timeouts. | Access token expires in 15 minutes; refresh token family expires in 30 days with rolling extension. | PASS |

---

## V4: Access Control

| Requirement ID | Description | Qelem Implementation / Evidence | Status |
|---|---|---|---|
| 4.1.1 | Verify access decisions are enforced server-side. | Every mutation checks ownership (`post.authorId.equals(user._id)`) or administrative role. | PASS |
| 4.1.2 | Verify all requests verify authorization. | RBAC middleware (`requireRole('moderator' | 'admin')`) guards sensitive endpoints. | PASS |
| 4.1.3 | Verify IDOR protection on object access. | Direct resource lookups (`_id`) check author ownership before edit/delete mutations. | PASS |
| 4.2.1 | Verify prevent privilege escalation. | User role cannot be modified by user payload; strictly guarded in admin controller. | PASS |

---

## V5: Malicious Input Handling & Validation

| Requirement ID | Description | Qelem Implementation / Evidence | Status |
|---|---|---|---|
| 5.1.1 | Verify server-side input validation for all parameters. | Strict Zod schemas with `.strip()` reject unauthorized fields and enforce character bounds. | PASS |
| 5.1.2 | Verify allowlisting for structured fields. | Cohort IDs and code snippet languages validated against explicit allowlists (`CODE_LANGUAGES`). | PASS |
| 5.2.1 | Verify sanitized display for rich text / code blocks. | Code blocks rendered safely in DOM via React text nodes; no `dangerouslySetInnerHTML`. | PASS |
| 5.5.1 | Verify file uploads are validated before processing. | Worker validates file signature (magic bytes) against allowlist (`image/jpeg`, `image/png`, `image/webp`). | PASS |

---

## V8: Data Protection & Privacy

| Requirement ID | Description | Qelem Implementation / Evidence | Status |
|---|---|---|---|
| 8.1.1 | Verify passwords are never logged or stored in cleartext. | `passwordHash` has `select: false` on Mongoose schema; logging redaction filters out `password` and `token`. | PASS |
| 8.2.1 | Verify sensitive data is encrypted in transit. | Nginx enforces TLS 1.3/1.2; HSTS header with `max-age=63072000; includeSubDomains; preload`. | PASS |
| 8.3.1 | Verify EXIF and GPS metadata are stripped from uploaded media. | Sharp strips all metadata (`withMetadata(false)`) during variant generation. Tested in attack suite. | PASS |
| 8.4.1 | Verify users can export and delete personal data. | Full JSON export endpoint (`/api/v1/account/export`) and soft-to-hard purge deletion pipeline. | PASS |

---

## V13: API and Web Service Security

| Requirement ID | Description | Qelem Implementation / Evidence | Status |
|---|---|---|---|
| 13.1.1 | Verify API endpoints enforce rate limiting. | Redis token bucket / sliding log rate limiter; subnet grouping `/64` for IPv6 and CGNAT guard. | PASS |
| 13.1.3 | Verify standard error format (RFC 9457). | All error responses return `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`. | PASS |
| 13.2.1 | Verify pagination cursors cannot be tampered with. | HMAC-SHA256 signed opaque cursors with TTL check; rejected on invalid signature. Tested in unit tests. | PASS |

---

## V14: Configuration & Build Security

| Requirement ID | Description | Qelem Implementation / Evidence | Status |
|---|---|---|---|
| 14.1.1 | Verify production containers run as non-root user. | Dockerfiles declare `USER node` (UID 1000). Root execution prevented. | PASS |
| 14.2.1 | Verify HTTP security headers. | CSP (`default-src 'self'`), HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. | PASS |
| 14.4.1 | Verify secrets are not committed to source code. | `.env.example` contains only mock placeholders; actual secrets loaded via environment variables. | PASS |
