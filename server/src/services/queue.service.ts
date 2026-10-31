import { Queue } from 'bullmq';
import { redis } from '../config/redis.js';

const defaultJobOptions = {
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 }
};

export const fanoutQueue = new Queue('fanout', { connection: redis, defaultJobOptions });
export const mediaQueue = new Queue('media', { connection: redis, defaultJobOptions });
export const countersQueue = new Queue('counters', { connection: redis, defaultJobOptions });
export const notificationsQueue = new Queue('notifications', { connection: redis, defaultJobOptions });
export const emailQueue = new Queue('email', { connection: redis, defaultJobOptions });
export const trendingQueue = new Queue('trending', { connection: redis, defaultJobOptions });
export const cleanupQueue = new Queue('cleanup', { connection: redis, defaultJobOptions });
export const reconciliationQueue = new Queue('reconciliation', { connection: redis, defaultJobOptions });
export const rebuildQueue = new Queue('rebuild', { connection: redis, defaultJobOptions });
