import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fork, ChildProcess } from 'node:child_process';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info({ msg: 'Bootstrapping Qelem API Server...' });

  await connectDB();
  await connectRedis();

  let workerProcess: ChildProcess | null = null;

  // Auto-spawn inline background worker pool if enabled (enables single-service free hosting on Render)
  if (process.env.RUN_INLINE_WORKER !== 'false') {
    const workerPath = path.resolve(process.cwd(), 'worker/dist/index.js');
    if (fs.existsSync(workerPath)) {
      logger.info({ msg: 'Spawning inline BullMQ worker pool...' });
      workerProcess = fork(workerPath, [], { env: process.env });

      workerProcess.on('error', (err) => {
        logger.error({ msg: 'Inline worker error', error: err.message });
      });

      workerProcess.on('exit', (code) => {
        logger.warn({ msg: `Inline worker exited with code ${code}` });
      });
    }
  }

  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info({
      msg: `Qelem API running on port ${env.PORT}`,
      env: env.NODE_ENV,
      url: env.API_BASE_URL
    });
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info({ msg: `Received ${signal}. Initiating graceful shutdown...` });

    if (workerProcess) {
      logger.info({ msg: 'Stopping inline worker process...' });
      workerProcess.kill('SIGTERM');
    }

    server.close(async () => {
      logger.info({ msg: 'HTTP server closed. Terminating database connections...' });
      await disconnectRedis();
      await disconnectDB();
      logger.info({ msg: 'Graceful shutdown complete. Exiting process.' });
      process.exit(0);
    });

    // Force exit after 10 seconds if hanging
    setTimeout(() => {
      logger.error({ msg: 'Forced shutdown after timeout' });
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ msg: 'Failed to bootstrap server', error: err });
  process.exit(1);
});
