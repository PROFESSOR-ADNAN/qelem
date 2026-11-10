import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const isUpstash = env.REDIS_URL.includes('upstash.io');
const isTls = env.REDIS_URL.startsWith('rediss://') || isUpstash;

const baseOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: !isUpstash,
  lazyConnect: true,
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  }
};

export const redis = new Redis(env.REDIS_URL, baseOptions);

redis.on('connect', () => {
  logger.info({ msg: 'Redis/Valkey connected' });
});

redis.on('error', (err) => {
  logger.error({ msg: 'Redis error', error: err.message });
});

// Create a dedicated publisher and subscriber connection for Pub/Sub and SSE
export const redisPub = new Redis(env.REDIS_URL, { ...baseOptions });
export const redisSub = new Redis(env.REDIS_URL, { ...baseOptions });

async function safeConnect(client: Redis): Promise<void> {
  if (client.status === 'ready' || client.status === 'connect') {
    return;
  }
  if (client.status === 'wait') {
    try {
      await client.connect();
    } catch (err: any) {
      if (err?.message?.includes('already connecting/connected')) {
        return;
      }
      throw err;
    }
    return;
  }
  if (client.status === 'connecting') {
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        client.removeListener('ready', onReady);
        client.removeListener('connect', onReady);
        client.removeListener('error', onError);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      client.once('ready', onReady);
      client.once('connect', onReady);
      client.once('error', onError);
    });
  }
}

export async function connectRedis(): Promise<void> {
  await Promise.all([safeConnect(redis), safeConnect(redisPub), safeConnect(redisSub)]);
}

export async function disconnectRedis(): Promise<void> {
  const safeQuit = async (client: Redis) => {
    if (client.status === 'end') return;
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  };
  await Promise.all([safeQuit(redis), safeQuit(redisPub), safeQuit(redisSub)]);
}
