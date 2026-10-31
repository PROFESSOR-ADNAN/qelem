import {
  countersQueue,
  trendingQueue,
  cleanupQueue,
  emailQueue
} from '../../../server/src/services/queue.service.js';
import { connectRedis, disconnectRedis } from '../../../server/src/config/redis.js';
import { logger } from '../../../server/src/utils/logger.js';

async function bootstrap() {
  logger.info({ msg: 'Bootstrapping Qelem Scheduler...' });
  await connectRedis();

  // 1. Counter flush every 5 seconds
  await countersQueue.add(
    'flush',
    {},
    {
      repeat: { every: 5000 },
      jobId: 'repeatable:counter-flush'
    }
  );

  // 2. Refresh Trending Snapshot every 5 minutes
  await trendingQueue.add(
    'refresh-trending',
    {},
    {
      repeat: { every: 300000 },
      jobId: 'repeatable:trending-refresh'
    }
  );

  // 3. Counter Hourly Reconciliation
  await countersQueue.add(
    'hourly-reconciliation',
    { fullAudit: false },
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'repeatable:counter-reconcile'
    }
  );

  logger.info({ msg: 'Scheduler registered all repeatable cron intervals successfully.' });

  const gracefulShutdown = async (signal: string) => {
    logger.info({ msg: `Received ${signal}. Shutting down scheduler...` });
    await disconnectRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ msg: 'Failed to start scheduler', error: err });
  process.exit(1);
});
