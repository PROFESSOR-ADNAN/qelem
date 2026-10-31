# ADR 0020: Observability Stack Sized to Low-Cost VPS

## Status
Accepted

## Context
Full enterprise observability suites (Datadog, Elastic, Tempo, heavyweight OpenTelemetry collectors) demand gigabytes of memory and CPU cycles that exceed our entire VPS capacity. We need comprehensive monitoring, structured logging, real-time metrics, and alerting that consume < 15% of host resources.

## Decision
1. **Metrics**:
   - Prometheus server with compact scraping intervals (15s) and 14-day retention.
   - Node Exporter, cAdvisor, and custom Express Prometheus metrics middleware via `prom-client`.
   - **Strict Metric Label Guard**: Absolutely zero unbounded labels (e.g. no `userId`, `postId`, `tag`, `email`). Labels are restricted strictly to route templates (`/api/v1/posts/:id`), HTTP status codes, and feed paths (`warm`, `rebuild`, `degraded`).
2. **Logs**:
   - Application logs structured as single-line JSON via `pino` with correlation `reqId`.
   - Automatic redaction of passwords, tokens, post bodies, comment text, and email addresses.
   - Grafana Alloy gathers local container logs and forwards them to Grafana Loki with 14-day retention.
3. **Dashboards & Alerts**:
   - Grafana with dashboards-as-code for feed health, fan-out queues, media pipelines, and SLO tracking.
   - Alertmanager sending alerts to Slack/Discord/Email for SLO burn rates, fan-out backlog, counter drift, and backup failures.
4. **Synthetic Probes**:
   - Dedicated synthetic probe script simulating user activity every 60 seconds (post -> fan-out -> verify feed appearance -> like -> verify notification).

## Consequences
- Total observability footprint under 500 MB RAM and < 5% CPU utilization.
- Actionable runbooks linked to every triggered alert.
