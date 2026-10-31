# Qelem Server & Network Hardening Guide

## 1. Network Boundary & Firewall
1. **Host Firewall (`ufw` / `nftables`)**:
   - Inbound Public: Port 80 (HTTP) and Port 443 (HTTPS) only.
   - SSH (Port 22): Blocked from public internet. Accessible strictly through Tailscale / WireGuard VPN mesh.
   - All database, Redis, queue, and monitoring ports (`27017`, `6379`, `9090`, `3100`, `5000`) are bound strictly to internal Docker bridge network (`127.0.0.1` / Docker internal subnet). None are published to the host's public IP.
2. **Cloudflare Origin Lock**:
   - Nginx validates incoming requests to port 80/443 against Cloudflare's published IP ranges.
   - Direct requests attempting to bypass Cloudflare and hit the origin IP directly are rejected with HTTP 403 Forbidden.

## 2. Linux Kernel & Host Hardening
- `sysctl` security parameters:
  - `net.ipv4.tcp_syncookies = 1` (SYN flood defense)
  - `net.ipv4.conf.all.rp_filter = 1` (Anti-spoofing)
  - `net.ipv4.conf.all.accept_redirects = 0`
  - `fs.protected_hardlinks = 1`
  - `fs.protected_symlinks = 1`
- Fail2ban / CrowdSec: Configured to inspect Nginx access logs and drop IPs with repeated authentication failures or scanning probes.
- Unattended Security Updates: Configured via `unattended-upgrades` to automatically install Debian/Ubuntu security advisories daily without rebooting.

## 3. Container Isolation
- All Dockerfiles run under a dedicated unprivileged user (`node:node` or `appuser:appuser`, UID 10001).
- Container capabilities dropped: `cap_drop: [ALL]`.
- Security options: `no-new-privileges:true`.
- Root filesystem mounted read-only (`read_only: true`) with ephemeral writes restricted to `/tmp` in tmpfs.
