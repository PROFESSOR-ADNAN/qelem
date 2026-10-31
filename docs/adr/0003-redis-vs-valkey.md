# ADR 0003: Redis vs Valkey and Cache Persistence Policy

## Status
Accepted

## Context
In March 2024, Redis Ltd. moved Redis from BSD-3-Clause to dual RSALv2 / SSPLv1 licenses (non-OSI compliant, source-available with restrictive commercial and hosted clauses). The Linux Foundation formed Valkey 7.2/8.0 as an open-source, BSD-3-Clause, backward-compatible fork backed by AWS, Google Cloud, Oracle, and the community.
Furthermore, in Qelem, MongoDB is the definitive durable source of truth: timelines, counters, unread badges, and sessions stored in Redis/Valkey are derived caches that can be reconstructed completely from MongoDB without losing posts, likes, follows, or comments.

## Decision
1. Standardize on Valkey 8.0 (or Redis 7.2-compatible wire protocol) using the official `valkey/valkey:8.0-alpine` container.
2. Configure persistence as lightweight RDB snapshots every 15 minutes (`save 900 1`) with AOF disabled (`appendonly no`).
3. Set `maxmemory 768mb` with eviction policy `volatile-lru`. Critical feed structures and counters use explicit TTLs or bounded caps.

## Alternatives
1. *Proprietary Redis 7.4+*: Rejected due to restrictive RSALv2/SSPLv1 licensing and vendor lock-in.
2. *Full AOF (Everysec)*: Rejected because disk write amplification degrades VPS I/O for temporary cache writes when all data can be rebuilt from MongoDB.
3. *Pure In-Memory (No snapshots)*: Rejected because lightweight RDB snapshots speed up container restarts without requiring full cold-start timeline recomputation on every routine deploy.

## Consequences
- Positive: 100% open source (BSD-3-Clause), wire-compatible with standard Node.js `ioredis` and `bullmq`, minimal I/O overhead on low-cost VPS.
- Negative: Crash during an active snapshot window loses recent timeline updates in cache; these are automatically repopulated via read-time degraded/rebuild paths.
