# Qelem Routine Maintenance, Capacity & Cost Calendar

## 1. Monthly Cost Breakdown (< $25/month Budget Target)

| Service / Resource | Provider | Tier / Configuration | Monthly Cost |
|---|---|---|---|
| VPS Server (Host) | Hetzner Cloud / OVH / Netcup | CX32 (4 vCPU, 8 GB RAM, 80 GB SSD, 20 TB traffic) | ~$14.00 |
| Edge CDN & WAF | Cloudflare | Free Tier (unlimited bandwidth, DDoS protection) | $0.00 |
| Object Storage | Cloudflare R2 | Free Tier: 10 GB storage, 0 egress cost, 1M Class A ops | $0.00 |
| Transactional Email | Resend / Brevo | Free Tier: 3,000 emails/month (100/day) | $0.00 |
| Domain Registration | .et registrar / Cloudflare | Standard registrar annual amortized | ~$2.50 |
| Backup Off-Site Storage| Backblaze B2 / R2 | 20 GB encrypted snapshots | ~$0.20 |
| **TOTAL** | | | **~$16.70 / month** |

*Budget Surplus: ~$8.30 / month remaining for scaling reserves.*

## 2. Maintenance Schedule & Routine Operations

| Cadence | Operational Task | Verification Command / Procedure |
|---|---|---|
| Weekly | Review fan-out queue lag & dead letter jobs | BullMQ dashboard / `make queue-stats` |
| Weekly | Review dependency vulnerability alerts | `npm audit` / Dependabot security alerts |
| Monthly | Automated test restore of MongoDB backup | `make test-restore` into isolated scratch container |
| Monthly | Review Redis memory & timeline usage | `redis-cli info memory` (assert < 768 MB) |
| Monthly | Review media storage growth and R2 quota | Check bytes in `media/` prefix; forecast exhaustion date |
| Quarterly | Review fan-out threshold (2,000) against user follower distribution | Run power-law analysis script |
| Semi-Annual | Rotate HMAC cursor signing secrets and JWT keys | Follow key rotation procedure with 24-hour overlap |
| Annual | Review Node.js, MongoDB, and Ubuntu LTS support lifecycles | Check official EOL dates |
