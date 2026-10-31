# Vercel Deployment Guide for Qelem

This guide provides end-to-end instructions for deploying the **Qelem Web Frontend** to Vercel while connecting to your production backend API.

---

## 1. Architecture Overview

Qelem is a hybrid architecture designed for speed, low data usage, and high availability:
- **Web Frontend (React PWA + Vite + Tailwind + Dexie):** Deployed to Vercel's global Edge CDN network for instant loading, sub-150KB bundle delivery, and offline service worker caching.
- **Backend API & Background Workers (Express + Valkey + MongoDB + BullMQ):** Deployed to a dedicated VPS via Docker Compose (or managed container platform such as Railway/Render/Fly.io) to support persistent WebSockets/SSE connections, heavy Sharp image transformations, and Valkey memory timelines.
- **Reverse Proxy / Rewrites:** Vercel rewrites `/api/*` requests directly to your backend API, preventing CORS issues in the browser.

```
┌─────────────────────────────────┐
│     Client (Browser / PWA)      │
└──────────────┬──────────────────┘
               │
      HTTPS    │
               ▼
┌─────────────────────────────────┐
│       Vercel Global Edge        │
│  - Static Assets (147 kB JS)    │
│  - Service Worker (sw.js)       │
│  - SPA Routing (HTML5 pushState)│
└──────────────┬──────────────────┘
               │  /api/* (Reverse Proxy Rewrite)
               ▼
┌─────────────────────────────────┐
│       Backend Infrastructure    │
│  - Express 5 API Clusters       │
│  - Valkey / Redis 8.0 In-Memory │
│  - MongoDB Replica Set          │
│  - BullMQ Background Workers    │
└─────────────────────────────────┘
```

---

## 2. Prerequisites

1. A **Vercel Account** ([vercel.com](https://vercel.com)).
2. A **GitHub Account** with this repository pushed (see Section 8 for repository push steps).
3. A deployed backend instance (e.g. your VPS IP or domain `api.yourdomain.com`).
4. Installed Vercel CLI (optional for CLI deployment):
   ```bash
   npm i -g vercel
   ```

---

## 3. Option A: Deploy via Vercel Web Dashboard (Recommended)

### Step 1: Import the GitHub Repository
1. Log in to [vercel.com](https://vercel.com) and click **"Add New..."** > **"Project"**.
2. Select your GitHub repository: `PROFESSOR-ADNAN/qelem`.
3. In the **Configure Project** screen:
   - **Project Name:** `qelem` (or your preferred name).
   - **Framework Preset:** `Vite` (or `Other`).
   - **Root Directory:** `./` (Leave as root directory because this is an npm workspaces monorepo).

### Step 2: Build & Output Settings
Expand the **Build and Output Settings** section:
- **Build Command:** Toggle **Override** and enter:
  ```bash
  npm run build --workspace=packages/shared && npm run build --workspace=web
  ```
- **Output Directory:** Toggle **Override** and enter:
  ```bash
  web/dist
  ```
- **Install Command:** Toggle **Override** and enter:
  ```bash
  npm install
  ```

### Step 3: Configure Environment Variables
Expand **Environment Variables** and add:

| Key | Example Value | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | Base API URL (relative to root domain for Vercel rewrites) |
| `API_BACKEND_HOST` | `api.yourdomain.com` | Target host used by `vercel.json` rewrites |
| `VITE_APP_NAME` | `Qelem` | Web application display title |
| `VITE_DEFAULT_LOCALE` | `en` | Default UI language (`en` or `am`) |

### Step 4: Deploy
Click **"Deploy"**. Vercel will:
1. Install root monorepo dependencies.
2. Compile `@qelem/shared` TypeScript definitions.
3. Build `@qelem/web` via Vite and generate service worker precache bundles.
4. Deploy the static assets to Vercel's global CDN in seconds.

---

## 4. Option B: Deploy via Vercel CLI

You can also deploy directly from your local terminal:

```bash
# 1. Log in to your Vercel account
vercel login

# 2. Link your local project
vercel link

# 3. Pull development environment variables
vercel env pull .env.vercel

# 4. Deploy preview build
vercel

# 5. Deploy directly to production
vercel --prod
```

When prompted by the CLI:
- Set root directory to `./`.
- Accept settings defined in `vercel.json`.

---

## 5. Verification & Health Checks

Once deployed, verify that the following routes function correctly on your Vercel domain (`https://qelem.vercel.app`):

### 1. Single Page Application Routing
- Navigate to `/login`, `/register`, `/explore`, `/compose`.
- Refresh the browser on a deep link like `https://qelem.vercel.app/explore`.
- **Expected:** The page loads smoothly without 404 errors (handled by the rewrite rule in `vercel.json`).

### 2. Service Worker & PWA Offline Support
- Open Chrome DevTools > **Application** > **Service Workers**.
- Verify `sw.js` is active and running.
- In **Cache Storage**, verify Workbox precache assets are stored.
- Check "Offline" mode in the Network tab and reload: the cached devlog feed and navigation bar should render seamlessly.

### 3. API Proxy Rewrites
- In DevTools Network tab, inspect requests to `/api/v1/posts/explore`.
- Verify the request succeeds with status `200 OK` and returns JSON.

---

## 6. Real-Time Streaming (SSE) Note

Qelem features live unread notification counters and feed updates over Server-Sent Events (`/api/v1/stream`).

- **Vercel Serverless Function Limits:** Vercel Hobby tier has a maximum function execution duration of 15 seconds (60 seconds on Pro). Long-lived SSE connections will be terminated after this timeout.
- **Recommended Setup:** The rewrite in `vercel.json` proxies `/api/v1/stream` directly to your persistent VPS backend Nginx/Express process, which holds long-lived connections with 20s heartbeat pings without timeout limits.
- **CORS Setup (Alternative):** If you prefer connecting the client directly to the backend domain for SSE, configure `VITE_SSE_URL=https://api.yourdomain.com/api/v1/stream` in your Vercel environment variables.

---

## 7. Custom Domain & DNS Setup

To point your custom domain (e.g. `qelem.et` or `qelem.com`) to Vercel:
1. In Vercel Project Settings, navigate to **Domains**.
2. Enter your domain name and click **Add**.
3. In your DNS provider (Cloudflare, Ethio Telecom DNS, or Namecheap):
   - Add a `CNAME` record: `www` pointing to `cname.vercel-dns.com`.
   - Add an `A` record: `@` pointing to `76.76.21.21`.
4. Vercel automatically provisions and renews a free Let's Encrypt TLS certificate.
