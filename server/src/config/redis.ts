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

export async function connectRedis(): Promise<void> {
  await Promise.all([redis.connect(), redisPub.connect(), redisSub.connect()]);
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all([redis.quit(), redisPub.quit(), redisSub.quit()]);
}
