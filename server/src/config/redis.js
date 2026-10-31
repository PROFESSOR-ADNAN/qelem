import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
    }
});
redis.on('connect', () => {
    logger.info({ msg: 'Redis/Valkey connected' });
});
redis.on('error', (err) => {
    logger.error({ msg: 'Redis error', error: err.message });
});
// Create a dedicated publisher and subscriber connection for Pub/Sub and SSE
export const redisPub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
export const redisSub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
export async function connectRedis() {
    await Promise.all([redis.connect(), redisPub.connect(), redisSub.connect()]);
}
export async function disconnectRedis() {
    await Promise.all([redis.quit(), redisPub.quit(), redisSub.quit()]);
}
