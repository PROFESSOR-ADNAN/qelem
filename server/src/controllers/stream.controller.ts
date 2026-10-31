import { Request, Response } from 'express';
import { redisSub, redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

const activeUserConnections = new Map<string, number>();

export async function handleSSEStream(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required for live stream' });
    return;
  }

  // Connection cap: max 3 connections per user
  const currentCount = activeUserConnections.get(userId) || 0;
  if (currentCount >= 3) {
    res.status(429).json({ error: 'Maximum live stream connections exceeded for account' });
    return;
  }
  activeUserConnections.set(userId, currentCount + 1);

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial unread count
  const unreadCount = await redis.get(`unread:${userId}`);
  res.write(`event: unread\ndata: ${JSON.stringify({ count: parseInt(unreadCount || '0', 10) })}\n\n`);

  const userChannel = `stream:user:${userId}`;
  let lastFeedNewSent = 0;

  const messageHandler = (channel: string, message: string) => {
    if (channel !== userChannel) return;

    try {
      const parsed = JSON.parse(message);

      // Throttle feed.new alerts to at most once per 10 seconds
      if (parsed.type === 'feed.new') {
        const now = Date.now();
        if (now - lastFeedNewSent < 10000) return;
        lastFeedNewSent = now;
      }

      res.write(`event: ${parsed.type}\ndata: ${message}\n\n`);
    } catch (err) {
      logger.error({ msg: 'Failed to serialize SSE message', error: err });
    }
  };

  await redisSub.subscribe(userChannel);
  redisSub.on('message', messageHandler);

  // Heartbeat ping every 20 seconds
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 20000);

  // Cleanup on connection close
  req.on('close', async () => {
    clearInterval(pingInterval);
    redisSub.removeListener('message', messageHandler);

    const updated = (activeUserConnections.get(userId) || 1) - 1;
    if (updated <= 0) {
      activeUserConnections.delete(userId);
      await redisSub.unsubscribe(userChannel).catch(() => {});
    } else {
      activeUserConnections.set(userId, updated);
    }
  });
}
