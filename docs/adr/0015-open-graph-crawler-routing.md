# ADR 0015: Open Graph Share Preview Routing for Single-Page Application (SPA)

## Status
Accepted

## Context
When Ethiopian students share their devlogs on Telegram, WhatsApp, Facebook, LinkedIn, Twitter/X, and Discord, social platforms use automated web crawlers that do not execute client-side JavaScript. A standard React SPA serves a generic `index.html` shell without per-post Open Graph (`og:title`, `og:image`, `og:description`) cards. Full Server-Side Rendering (SSR) via Next.js or Remix introduces runtime complexity, node server memory overhead, and violates our single-page React PWA design.

## Decision
1. Maintain client-side React PWA for human users.
2. In Nginx, use a `$http_user_agent` mapping table matching social crawler user-agents (TelegramBot, Twitterbot, facebookexternalhit, WhatsApp, LinkedInBot, Discordbot, Slackbot).
3. When a matching crawler requests `/p/:id` or `/u/:username`, Nginx rewrites and proxies the request to the lightweight Express endpoint `/api/v1/share/p/:id` or `/api/v1/share/u/:username`.
4. The share endpoint generates a minimal, clean HTML document (≤ 2 KB) containing:
   - Sanitized HTML-escaped title and 160-character post excerpt.
   - Author username and display name.
   - High-resolution `medium` image variant or default branded card.
   - Canonical URL pointing to the PWA post page.
   - Standard Open Graph and Twitter Card tags.
   - Response cached in Nginx/Cloudflare for 5 minutes (`Cache-Control: public, max-age=300`).
5. Standard browsers bypass this route and receive the React SPA bundle instantly.

## Consequences
- Rich, dynamic Open Graph cards in Telegram, WhatsApp, and social media without the overhead of Next.js or full server-side React hydration.
