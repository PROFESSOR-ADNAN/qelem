import { Worker } from 'bullmq';
import { redis } from '../../server/src/config/redis.js';
import { connectDB, disconnectDB } from '../../server/src/config/db.js';
import { connectRedis, disconnectRedis } from '../../server/src/config/redis.js';
import { logger } from '../../server/src/utils/logger.js';
import { processFanoutJob } from './processors/fanout.processor.js';
import { processMediaJob } from './processors/media.processor.js';
import { processCounterFlushJob, processCounterReconciliationJob } from './processors/counter.processor.js';
import { processNotificationJob } from './processors/notification.processor.js';
import { processEmailJob } from './processors/email.processor.js';
import { processTrendingJob } from './processors/trending.processor.js';
import { processWeeklyDigestJob } from './processors/digest.processor.js';
import { FeedService } from '../../server/src/feed/feed.service.js';

async function bootstrap() {
  logger.info({ msg: 'Bootstrapping Qelem BullMQ Worker Pool...' });

  await connectDB();
  await connectRedis();

  // 1. Fanout Worker
  const fanoutWorker = new Worker('fanout', processFanoutJob, {
    connection: redis,
    concurrency: 5
  });

  // 2. Media Worker (Strict low concurrency of 2 to guarantee memory cap on VPS)
  const mediaWorker = new Worker('media', processMediaJob, {
    connection: redis,
    concurrency: 2
  });

  // 3. Counter Worker
  const counterWorker = new Worker(
    'counters',
    async (job) => {
      if (job.name === 'flush') {
        await processCounterFlushJob(job);
      } else if (job.name === 'hourly-reconciliation') {
        await processCounterReconciliationJob(job);
      }
    },
    { connection: redis, concurrency: 2 }
  );

  // 4. Notifications Worker
  const notificationWorker = new Worker('notifications', processNotificationJob, {
    connection: redis,
    concurrency: 5
  });

  // 5. Email Worker
  const emailWorker = new Worker('email', processEmailJob, {
    connection: redis,
    concurrency: 2
  });

  // 6. Trending Worker
  const trendingWorker = new Worker('trending', processTrendingJob, {
    connection: redis,
    concurrency: 1
  });

  // 7. Feed Rebuild Worker
  const rebuildWorker = new Worker(
    'rebuild',
    async (job) => {
      const { userId } = job.data;
      await FeedService.executeRebuild(userId);
    },
    { connection: redis, concurrency: 2 }
  );

  // 8. Weekly Digest Worker
  const digestWorker = new Worker('digest', processWeeklyDigestJob, {
    connection: redis,
    concurrency: 1
  });

  const workers = [
    fanoutWorker,
    mediaWorker,
    counterWorker,
    notificationWorker,
    emailWorker,
    trendingWorker,
    rebuildWorker,
    digestWorker
  ];

  logger.info({ msg: 'All BullMQ workers initialized and consuming queues.' });

  const gracefulShutdown = async (signal: string) => {
    logger.info({ msg: `Received ${signal}. Draining workers...` });
    await Promise.all(workers.map(w => w.close()));
    await disconnectRedis();
    await disconnectDB();
    logger.info({ msg: 'Worker shutdown complete.' });
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err: any) => {
  logger.error({
    msg: 'Failed to start worker pool',
    error: err?.message || String(err),
    stack: err?.stack
  });
  process.exit(1);
});
