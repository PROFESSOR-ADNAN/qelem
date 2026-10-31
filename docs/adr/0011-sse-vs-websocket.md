# ADR 0011: Server-Sent Events (SSE) vs WebSockets for Live Badges and Feed Alerts

## Status
Accepted

## Context
Qelem needs real-time indicators for unread notification count badge updates and new posts arriving at the top of the feed ("N new posts" pill). The application does not require bidirectional user-to-server messaging over the stream (all user mutations are standard REST API calls).

## Decision
1. Implement Server-Sent Events (SSE) via `GET /api/v1/stream`.
2. Connect clients using standard `EventSource` with session authentication cookies.
3. API instances subscribe to Redis Pub/Sub channels `stream:user:{userId}` and forward events to connected SSE client responses.
4. Keep-alive heartbeat: send an empty SSE comment (`: ping\n\n`) every 20 seconds to prevent carrier NAT timeouts.
5. Limit to 3 concurrent SSE connections per authenticated user and 3,000 connections per API node.
6. Fallback: If SSE disconnects or fails, the frontend falls back to periodic ETag polling on `/api/v1/notifications/unread-count` every 60 seconds.

## Alternatives
- *WebSockets (Socket.io / ws)*: Rejected because WebSockets require bidirectional protocol upgrades, custom load balancer sticky sessions, complex proxy buffering, and higher memory overhead without adding value for unidirectional alert streaming.

## Consequences
- Built-in automatic browser reconnection with standard HTTP/2 and Nginx multiplexing.
- Simple Nginx configuration: `proxy_buffering off; proxy_read_timeout 120s; proxy_http_version 1.1`.
- Clean fallback for flaky 2G/3G mobile networks.
