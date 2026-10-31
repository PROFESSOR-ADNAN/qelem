# Runbook: Fanout Queue Backlog & Lag

## Symptoms
- Alert: `FanoutQueueLagHigh` firing.
- New posts take longer than 5 seconds to appear in active followers' feeds.

## Diagnosis
1. Inspect BullMQ waiting job count on `fanout` queue:
   `docker compose -f docker/compose.prod.yaml exec valkey valkey-cli llen bull:fanout:wait`
2. Check if a high-fanout transition was delayed:
   Inspect author follower counts.

## Remediation Steps
1. Scale worker pool concurrency:
   Edit `docker/compose.prod.yaml` to raise worker concurrency or scale worker service:
   `docker compose -f docker/compose.prod.yaml up -d --scale worker=2`
2. Inspect worker container CPU and memory usage:
   `docker stats qelem-prod-worker`

## Verification
- Confirm `bull:fanout:wait` drains to 0.
- Synthetic probe reports fanout lag < 3 seconds.
