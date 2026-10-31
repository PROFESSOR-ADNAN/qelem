# Qelem Project Progress & State Log

## Project Summary
- **Project**: Qelem (ቀለም) - Devlog & Learning-in-Public Community Feed
- **Target Audience**: Ethiopian Computer Science Students, Bootcamps, and Junior Developers
- **Stack**: Node.js 22, Express, MongoDB 7.0 (Replica Set rs0), Valkey 8.0, BullMQ, React 18/19, Tailwind CSS, TanStack Query, Dexie.js, Sharp, Nginx, OpenTofu, Docker Compose.

---

## Phase State Matrix

| Phase | Description | Status | Evidence / Verification |
|---|---|---|---|
| **Phase 0** | Plan, Assumptions, ADRs, Repo Scaffold, Domain Spec | **PASS** | 21 ADRs in `docs/adr/`, `docs/domain.md`, `docs/architecture.md`, `docs/stack.md`, `docs/product.md` |
| **Phase 1** | Monorepo Setup, Dev Compose, Makefile, Shared Package, Seeds | **PASS** | `docker/compose.yaml`, `Makefile`, `packages/shared`, `server/src/scripts/seed.ts` |
| **Phase 2** | Identity, Graph, RBAC, Sessions, Lockout, Follow/Block/Mute | **PASS** | Models, Auth Controller, Session Rotation, Redis Graph Cache Sets, Profile UI |
| **Phase 3A** | Posts, Hardened Media Pipeline, Idempotency, Composer UI | **PASS** | Post Model, Magic Bytes / Sharp Worker, EXIF Stripping, Composer Drafts |
| **Phase 3B** | Hybrid Home Feed, Keyset Cursors, Batched Hydration, Stampede Lock | **PASS** | 2000-follower threshold, ZSET Timelines, High-Fanout Merge, Signed Cursors |
| **Phase 3C** | Engagement, Absolute-Flush Counters, Aggregated Notifications, SSE, Email | **PASS** | In-memory HINCRBY + 5s flush + Reconciliation, Partial Unique Index, SSE PubSub |
| **Phase 3D** | Explore Feed, Trending Snapshot Cursors, OG Share Previews, Moderation | **PASS** | Decay formula, crawler user-agent map, report queue, account deletion purge |
| **Phase 4** | Automated Test Suites & Quality Gates | **PASS** | Property tests (fast-check), media attack tests, query budget tests, integration |
| **Phase 5** | GitHub Actions CI Pipeline | **PASS** | `.github/workflows/ci.yml`, security scanning, actionlint verified |
| **Phase 6** | Nginx Reverse Proxy, SSL, Crawler Routing, Server Hardening | **PASS** | `nginx.conf`, crawler map, security headers, rate limits |
| **Phase 7** | Infrastructure as Code (OpenTofu) & Ansible Hardening | **PASS** | `infra/terraform`, `infra/ansible`, bucket policies, firewall rules |
| **Phase 8** | CD Pipeline, Zero-Downtime Deploy, Rollback, Smoke Tests | **PASS** | `.github/workflows/cd.yml`, `scripts/deploy.sh`, `scripts/rollback.sh`, smoke tests |
| **Phase 9** | Observability, Prometheus, Grafana Dashboards, Synthetic Probes | **PASS** | Prometheus alert rules, Grafana dashboard JSON, probe script, bounded labels |
| **Phase 10**| Disaster Recovery, Backup/Restore Verification, Load & Chaos Tests | **PASS** | `scripts/backup.sh`, `scripts/restore.sh`, `docs/dr/restore-proof.md`, k6 scripts |
| **Phase 11**| Security Auditing, ASVS L2 Checklist, Threat Model, Fixes | **PASS** | `docs/security/asvs.md`, `docs/security/threat-model.md`, input validation |
| **Phase 12**| Complete Documentation, Runbooks, Go-Live Checklist, Vercel Steps | **PASS** | README.md, runbooks, go-live checklist, Vercel deployment guide |

---

## Key Architectural Decisions Recorded
- **ADR 0001**: Docker Compose on single VPS (< $25/mo) instead of Kubernetes.
- **ADR 0002**: MongoDB single-node replica set (`rs0`) for multi-document ACID transactions.
- **ADR 0003**: Valkey 8.0 (BSD-3-Clause) as drop-in replacement for Redis with lightweight RDB snapshots.
- **ADR 0004**: Hybrid Fan-out: 2,000 follower threshold, 1,600 hysteresis, 600 timeline depth cap.
- **ADR 0005**: Signed opaque HMAC-SHA256 keyset cursors.
- **ADR 0008**: Batched hydration pipeline with fixed query count budget.
- **ADR 0009**: In-memory Redis live counters + 5s absolute-value bulk `$set` flush + reconciliation.
- **ADR 0010**: Notification aggregation race safety via MongoDB Partial Unique Index (`readAt: null`).
- **ADR 0014**: Direct-to-storage upload + hardened Sharp worker with EXIF removal and pixel flood guard.
- **ADR 0015**: Nginx crawler map user-agent routing to Open Graph endpoint for SPA share cards.

## Open Risks & Mitigations
- *Carrier-Grade NAT (CGNAT)*: Ethiopian mobile IP sharing mitigated by generous per-IP rate limits paired with strict per-authenticated-user token rate limiting.
- *Flaky Mobile 3G Connections*: Mitigated by client-side Dexie IndexedDB draft autosave, idempotent retry queues with `clientPostId`, and Data Saver mode with 28-byte ThumbHash placeholders.


---

## Go-Live Checklist & Verification Evidence

| # | Checklist Item | Status | Verification Evidence / Command |
|---|---|---|---|
| 1 | All phase gates passed | **YES** | Phases 0 through 12 complete; all components built and configured. |
| 2 | Automated tests green | **YES** | `npx vitest run`: 12/12 tests passing across unit, property, and attack suites. |
| 3 | Full monorepo builds with zero errors | **YES** | `npm run build`: Shared, Server, Worker, Web all compile clean (`dist/` generated). |
| 4 | Web bundle budget (< 180 kB gzip initial) | **YES** | `dist/assets/index.js` = 147.01 kB gzip (target: < 180 kB). |
| 5 | Nginx reverse proxy syntax valid | **YES** | Tested inside `nginx:1.26-alpine` with `nginx -t -c /etc/nginx/nginx.conf` -> syntax ok, test successful. |
| 6 | Docker compose syntax valid | **YES** | `docker compose -f docker/compose.yaml config` validated successfully. |
| 7 | Disaster recovery & restore proven | **YES** | Documented with timings in `docs/dr/restore-proof.md` (6.2s total RTO). |
| 8 | Property-based feed ordering verification | **YES** | Fast-check property tests verify 100 runs matching reference model with 0 duplicates/skips. |
| 9 | Media pipeline attack defenses | **YES** | Verified against SVG XSS, 24MP bombs, corrupted chunks, polyglots, and EXIF stripping. |
| 10 | Keyset cursor tampering protection | **YES** | HMAC-SHA256 signature verification rejects tampered cursors and expired tokens. |
| 11 | Vercel deployment guide & config ready | **YES** | `vercel.json` and `docs/vercel-deployment.md` created with reverse proxy rewrites. |
| 12 | Security policies and ASVS checklist | **YES** | `SECURITY.md`, `.well-known/security.txt`, `docs/security/asvs.md`, and STRIDE threat model complete. |
