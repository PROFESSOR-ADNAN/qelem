# Runbook: Redis / Valkey Down or Wiped

## Symptoms
- Alert: `DegradedPathSpike` firing (> 5% of home feed requests served via MongoDB degraded path).
- Response headers return `X-Feed-Degraded: true`.
- Real-time live SSE stream disconnects (client falls back to 60s polling).

## Diagnosis
1. Inspect Valkey container status:
   `docker compose -f docker/compose.prod.yaml ps valkey`
2. Inspect Redis memory and client connections:
   `docker compose -f docker/compose.prod.yaml exec valkey valkey-cli info memory`
3. Check error logs:
   `docker compose -f docker/compose.prod.yaml logs --tail=100 valkey`

## Remediation Steps
1. **If Valkey crashed**:
   Restart the container:
   `docker compose -f docker/compose.prod.yaml restart valkey`
2. **If memory limit exceeded**:
   Valkey is configured with `maxmemory 768mb` and `volatile-lru`. If memory is exhausted, flush ephemeral post caches:
   `docker compose -f docker/compose.prod.yaml exec valkey valkey-cli --scan --pattern "post:*" | xargs -L 100 valkey-cli del`
3. **Trigger feed rebuild**:
   Execute lazy background timeline reconstruction:
   `bash scripts/rebuild-feeds.sh`

## Verification
- Confirm home feed latency returns to < 200ms without `X-Feed-Degraded: true` header:
  `curl -i -H "Authorization: Bearer <TOKEN>" https://app.qelem.et/api/v1/feed/home`
- Confirm `DegradedPathSpike` alert resolves in Alertmanager.
