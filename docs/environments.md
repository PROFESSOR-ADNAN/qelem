# Qelem Environment Matrix

| Parameter / Service | Local Dev (`dev`) | Staging (`staging`) | Production (`prod`) |
|---|---|---|---|
| Domain | `localhost:3000` / `localhost:5000` | `staging.qelem.et` | `app.qelem.et` |
| Database | Docker `mongo:7.0` (Replica set `rs0`) | Managed / VPS Docker `mongo:7.0` (`rs0`) | VPS Docker `mongo:7.0` (`rs0`) with NVMe volume |
| Cache / Queue | Docker `valkey:8.0-alpine` | Docker `valkey:8.0-alpine` | Docker `valkey:8.0-alpine` (768MB cap) |
| Object Storage | Local MinIO (`minio:RELEASE...`) | Cloudflare R2 (Staging bucket) | Cloudflare R2 (Production bucket) |
| Email Provider | Local Mailpit (`axllent/mailpit`) | Resend / Brevo (Sandbox mode) | Resend / Brevo (Live transactional + digest) |
| Reverse Proxy | Local Nginx or Vite Proxy | Nginx with self-signed or staging cert | Nginx + Let's Encrypt + Cloudflare Origin |
| Monitoring | Disabled / Opt-in local Prometheus | Prometheus + Grafana + Alloy | Prometheus + Alertmanager + Alloy + Loki |
| Seed Data | Small seed (1,000 synthetic users) | Load seed (20,000 users, 500k follows) | Admin initial setup only |
| Log Format | Pretty / Pino debug | Pino JSON structured | Pino JSON structured (redacted PII) |
| Rate Limits | Disabled / Permissive | Enforced | Enforced |
