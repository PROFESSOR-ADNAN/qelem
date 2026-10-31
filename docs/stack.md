# Qelem Technology Stack & Dependency Matrix

All versions confirmed active, maintained, and stable as of November 2026.

## 1. Core Runtime & Backend
- **Node.js (v22.x LTS)**: Active LTS release with native fetch, high-performance V8 engine, and cryptographic enhancements.
- **Express (v4.21.x / v5.x)**: Industry-standard minimal web framework for high-throughput REST APIs and SSE streaming.
- **Mongoose (v8.8.x)**: Official MongoDB ODM supporting typed schemas, multi-document ACID transactions, and partial unique indexes.
- **MongoDB (v7.0 / v8.0)**: Single-node replica set (`rs0`) for durable ACID document persistence and Change Streams.
- **Valkey (v8.0.x) / Redis (v7.2.x)**: High-performance in-memory data store for timelines (ZSET), counters, rate limiting, and pub/sub.
- **BullMQ (v5.29.x)**: Redis-backed distributed task queue supporting retries, dead-letter queues, parent-child flows, and worker concurrency controls.
- **Zod (v3.23.x)**: TypeScript-first schema declaration and validation with zero dependencies, shared between API and frontend.
- **Pino (v9.5.x)**: Low-overhead JSON logger with structured metadata and request correlation.
- **Argon2 / argon2id (v0.41.x)**: Memory-hard password hashing algorithm (RFC 9106) resistant to GPU cracking.

## 2. Media Processing & Storage
- **Sharp (v0.33.x)**: High-speed libvips image processing library supporting WebP conversion, EXIF stripping, and `limitInputPixels` memory guards.
- **@aws-sdk/client-s3 (v3.690.x)**: Official AWS SDK for generating presigned upload URLs and interacting with S3-compatible cloud storage (Cloudflare R2, MinIO).
- **ThumbHash / BlurHash**: Lightweight compact image placeholder representations (28-byte hashes) for instant 3G skeleton loading.

## 3. Frontend & PWA
- **React (v18.3.x / v19.x)**: Declarative UI component library.
- **Vite (v6.x)**: High-performance frontend bundler with instant HMR and optimized production tree-shaking.
- **Tailwind CSS (v3.4.x / v4.x)**: Utility-first CSS framework for ultra-compact bundle size and responsive mobile layout.
- **TanStack Query (v5.60.x)**: Async state management and infinite query caching for cursor-based feed feeds.
- **Dexie.js (v4.0.x)**: IndexedDB wrapper for client-side offline feed caching and offline composer drafts.
- **react-i18next (v15.1.x)**: Internationalization framework supporting seamless Amharic (አማርኛ) and English localization.
- **PrismJS / Shiki**: Lightweight, lazy-loaded syntax highlighting for CS code snippets.

## 4. Infrastructure, Networking & SRE
- **Nginx (v1.26.x Stable)**: High-performance reverse proxy, SSL termination, and crawler user-agent router.
- **Docker Compose (v2.30.x)**: Multi-container orchestration on single VPS host.
- **OpenTofu (v1.8.x)**: Open-source declarative infrastructure-as-code (MPL 2.0).
- **Ansible (v10.x / core 2.17.x)**: Automated server configuration management and baseline hardening.
- **Prometheus (v2.55.x)** & **Alertmanager (v0.27.x)**: Time-series metrics collection and notification routing.
- **Grafana (v11.3.x)** & **Loki (v3.2.x)**: Centralized dashboards and log aggregation.
- **Grafana Alloy (v1.5.x)**: Modern vendor-neutral telemetry collector replacing deprecated Promtail.
