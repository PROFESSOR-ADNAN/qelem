# ADR 0001: Docker Compose on Single VPS vs Kubernetes

## Status
Accepted

## Context
Qelem is designed as a learning-in-public devlog community for Ethiopian CS students with a target of 20,000 registered users, 1,500 peak concurrent users, and an operational budget capped at USD $25/month. A managed Kubernetes cluster (EKS, GKE, or multi-node k8s) incurs minimum baseline costs of $70-$120/month solely for the control plane and multi-node overhead, exceeding our budget by >300%.

## Decision
Deploy Qelem on a single high-performance VPS (2-4 vCPU, 4-8 GB RAM, e.g., Hetzner Cloud CX32/CPX31 or equivalent costing ~$7-$15/month) using Docker Compose with systemd management and an external volume for persistence.
The service architecture runs:
- 2 replicas of `api` (stateless Express, load-balanced by local Nginx)
- 1 `worker` pool (BullMQ queue workers)
- 1 `scheduler` instance (repeatable job dispatcher)
- 1 MongoDB single-node replica set container
- 1 Valkey/Redis container
- 1 Nginx reverse proxy with Cloudflare upstream

## Alternatives
1. *Managed Kubernetes (GKE/EKS/DigitalOcean K8s)*: Rejected due to $25/month budget ceiling, operational complexity for a solo engineer, and unnecessary distributed overlay networking.
2. *Serverless (AWS Lambda / Vercel Functions)*: Serverless is problematic for high-frequency Redis sorted set operations, background BullMQ fan-out workers, and persistent SSE connections (`/api/v1/stream`), causing connection exhaustion and high costs.

## Consequences
- Positive: Predictable monthly cost (< $20/month total), near-zero network latency between API, Redis, and MongoDB (local Docker bridge), trivial deployment and rollback via Docker Compose.
- Negative: Single point of failure for the host server (mitigated by automated off-site S3 backups, systemd restart policies, and infrastructure-as-code OpenTofu scripts capable of spinning up a replacement VPS in < 15 minutes).
