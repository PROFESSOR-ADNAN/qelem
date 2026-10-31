# Runbook: Counter Reconciliation Drift

## Symptoms
- Alert: `CounterReconciliationDrift` firing in Alertmanager.
- Discrepancy observed between post `likeCount` and true count in `likes` collection.

## Diagnosis
1. Inspect Prometheus counter drift metric:
   `curl -s http://localhost:5000/metrics | grep qelem_counter_reconciliation_drift_total`
2. Inspect worker logs for reconciliation job output:
   `docker compose -f docker/compose.prod.yaml logs --tail=100 worker | grep reconciliation`

## Remediation Steps
1. Trigger an immediate full reconciliation audit:
   `docker compose -f docker/compose.prod.yaml exec worker node -e 'import("./dist/processors/counter.processor.js").then(m => m.processCounterReconciliationJob({ data: { fullAudit: true } }))'`
2. Verify that `Post.likeCount` and `Like.countDocuments` reconcile to equal values.

## Verification
- Assert that `counter_reconciliation_drift_total` stops incrementing.
