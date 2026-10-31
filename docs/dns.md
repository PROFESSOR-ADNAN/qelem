# Qelem DNS, TLS, and CDN Configuration

## 1. Domain Architecture
Configured via placeholder variable `BASE_DOMAIN = "qelem.et"` (or `example.com` in staging).
- `qelem.et` / `www.qelem.et`: Apex redirect to `app.qelem.et` (or direct app hosting).
- `app.qelem.et`: Web PWA single-page application and Express REST API (`/api/v1/`).
- `media.qelem.et`: Public image asset CDN endpoint (Cloudflare Edge -> Origin: Object Storage `media/` bucket prefix).

## 2. Recommended DNS Records

| Record Type | Hostname | Value / Target | Purpose & Proxied |
|---|---|---|---|
| A | `app.qelem.et` | `<VPS_IPV4_ADDRESS>` | Origin server (Proxied through Cloudflare) |
| AAAA | `app.qelem.et` | `<VPS_IPV6_ADDRESS>` | IPv6 origin access (Proxied through Cloudflare) |
| CNAME | `media.qelem.et` | `<S3_BUCKET_OR_R2_CNAME>` | Cloudflare R2 / S3 bucket CDN (Proxied) |
| CAA | `@` | `0 issue "letsencrypt.org"` | Lock SSL certificate issuance to Let's Encrypt |
| MX | `@` | `feedback-smtp.provider.net` | Email routing |
| TXT | `@` | `v=spf1 include:senders.provider.net ~all` | Sender Policy Framework (SPF) |
| TXT | `provider._domainkey`| `k=rsa; p=<DKIM_PUBLIC_KEY>` | DKIM Signature verification |
| TXT | `_dmarc` | `v=DMARC1; p=reject; rua=mailto:dmarc@qelem.et; pct=100` | DMARC Enforcement (100% reject policy) |

## 3. Cloudflare Edge Rules & Cache Configuration
1. **Edge Cache on `media.qelem.et`**:
   - Cache Level: Cache Everything.
   - Edge Cache TTL: 1 Year (`max-age=31536000, immutable`).
   - Browser Cache TTL: 1 Year.
2. **Dynamic API Bypass on `app.qelem.et/api/v1/*`**:
   - Cache Level: Bypass.
   - Do Not Cache authenticated responses or SSE `/stream`.
3. **Public Exploration Cache on `app.qelem.et/api/v1/feed/explore`**:
   - Cache Level: Standard.
   - Edge Cache TTL: 60 seconds (with `Vary: Accept-Encoding, Accept`).
4. **WAF & Security**:
   - Managed OWASP Ruleset enabled (Block on Anomaly Score > 25).
   - Rate limit `/api/v1/auth/login`: max 10 requests / 15 min per IP.
