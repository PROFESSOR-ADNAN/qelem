# ADR 0019: MongoDB Backup, Off-Site S3 Replication, and Disaster Recovery

## Status
Accepted

## Context
Data loss is catastrophic for an educational community platform. The system requires an automated, verified backup regime achieving Recovery Point Objective (RPO) ≤ 24 hours and Recovery Time Objective (RTO) ≤ 2 hours within our single-VPS infrastructure constraints.

## Decision
1. **Automated Nightly Snapshot**:
   - Run `mongodump --oplog --gzip --archive=/tmp/mongo-backup.gz` inside the MongoDB container.
   - Encrypt the archive with AES-256 via GPG/age.
   - Stream the encrypted snapshot to off-site object storage (`backups/mongo/YYYY-MM-DD.gz.enc`).
   - Retain 7 daily, 4 weekly, and 3 monthly snapshots.
2. **Media Storage**:
   - Public variants under `media/` are stored in durable cloud object storage with versioning and lifecycle replication. Temporary `incoming/` uploads are excluded from backups.
3. **Monthly Automated Recovery Verification**:
   - A scheduled test script spins up an isolated scratch MongoDB container, restores the latest backup, and verifies relational integrity:
     - All media references resolve to existing objects.
     - Follow counts match countDocuments.
     - Engagement counters reconcile within zero drift tolerance.
   - Timings are recorded in `docs/dr/restore-proof.md`.

## Consequences
- Guaranteed rapid recovery in the event of hardware failure or VPS provider outage.
- Proven, executable recovery scripts eliminating disaster guesswork.
