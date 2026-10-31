# Security Policy

## Reporting a Vulnerability

We take the security and privacy of our users seriously. If you discover a security vulnerability in Qelem, please follow responsible disclosure guidelines.

### Reporting Process

- **Email:** Send details to [security@example.com](mailto:security@example.com) (or through GitHub Private Vulnerability Reporting).
- **Encryption:** Use PGP key available at `https://qelem.example.com/.well-known/pgp-key.txt`.
- **Response Timeline:** We acknowledge receipt within 24 hours and aim to provide a remediation timeline within 72 hours.
- **Bounty & Attribution:** Valid reports are credited on our security hall of fame.

### Scope

In scope:
- Remote code execution, SQL/NoSQL injection, stored/reflected XSS.
- Authentication bypass, privilege escalation, broken access control (IDOR).
- Media pipeline bypass (e.g. polyglots, EXIF leak, malicious format handling).
- Keyset cursor forgery or cryptographic signature bypass.

Out of scope:
- Automated vulnerability scanner reports without reproducible proof-of-concept.
- Denial of Service attacks targeting high bandwidth without architectural exploit.
- Social engineering against Qelem maintainers.

### Security Guarantees & Features

- **Passwords:** Hashed with Argon2id ($64\text{ MB}$, 3 passes, 4 lanes).
- **Cursors:** HMAC-SHA256 signed, time-limited, opaque keyset cursors.
- **Media Pipeline:** Raw uploads isolated in private storage; binary magic-byte inspection; Sharp re-encoding to WebP; EXIF/GPS metadata stripping; 24MP dimension caps.
- **Feeds:** Hybrid fan-out with Redis Valkey timeline buffers and MongoDB durable storage.
- **Zero Third-Party Trackers:** No tracking scripts, analytics cookies, or external CDN scripts.
