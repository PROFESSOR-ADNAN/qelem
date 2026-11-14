import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import promClient from 'prom-client';
import mongoose from 'mongoose';
import { redis } from './config/redis.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { graphRouter } from './routes/graph.routes.js';
import { postsRouter } from './routes/posts.routes.js';
import { mediaRouter } from './routes/media.routes.js';
import { feedRouter } from './routes/feed.routes.js';
import { engagementRouter } from './routes/engagement.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { streamRouter } from './routes/stream.routes.js';
import { tagsRouter } from './routes/tags.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { shareRouter } from './routes/share.routes.js';
import { accountRouter } from './routes/account.routes.js';
import { paymentRouter } from './routes/payment.routes.js';
import { swaggerController } from './docs/swagger.js';
import { EngagementController } from './controllers/engagement.controller.js';
import { requireAuth } from './middleware/auth.js';

// Initialize Prometheus Default Metrics
promClient.collectDefaultMetrics({ prefix: 'qelem_' });

export const app = express();

// Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://validator.swagger.io', env.MEDIA_CDN_URL],
        connectSrc: ["'self'", env.API_BASE_URL, env.MEDIA_CDN_URL, env.S3_ENDPOINT || ''],
        fontSrc: ["'self'", 'https://unpkg.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Flexible CORS configuration supporting Vercel, localhost, and custom domains
const staticAllowedOrigins = [
  env.WEB_BASE_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : [])
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        staticAllowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key']
  })
);

// Strict JSON body size limit (64 KB)
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.use(cookieParser());

// Request correlation ID middleware
app.use((req, res, next) => {
  const reqId = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Comprehensive Telemetry, Liveness & Readiness endpoints
app.get(['/healthz', '/health'], async (_req, res) => {
  const startTime = Date.now();
  let mongoStatus = 'unknown';
  let mongoLatencyMs = -1;
  let redisStatus = 'unknown';
  let redisLatencyMs = -1;

  try {
    const mongoStart = Date.now();
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      mongoStatus = 'connected';
      mongoLatencyMs = Date.now() - mongoStart;
    } else {
      mongoStatus = `state_${mongoose.connection.readyState}`;
    }
  } catch (err: any) {
    mongoStatus = `error: ${err.message}`;
  }

  try {
    const redisStart = Date.now();
    await redis.ping();
    redisStatus = 'connected';
    redisLatencyMs = Date.now() - redisStart;
  } catch (err: any) {
    redisStatus = `error: ${err.message}`;
  }

  const memory = process.memoryUsage();
  const isHealthy = mongoStatus === 'connected' && redisStatus === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'qelem-api',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      mongodb: {
        status: mongoStatus,
        latencyMs: mongoLatencyMs
      },
      redis: {
        status: redisStatus,
        latencyMs: redisLatencyMs
      }
    },
    system: {
      memoryRssMb: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
      nodeVersion: process.version
    },
    totalCheckDurationMs: Date.now() - startTime
  });
});

app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', promClient.register.contentType);
  res.send(await promClient.register.metrics());
});

// Interactive Swagger OpenAPI 3.0 Documentation
app.get('/api-docs', swaggerController.getDocs);
app.get('/api-docs/openapi.json', swaggerController.getSpec);

// Mount API v1 Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/graph', graphRouter);
app.use('/api/v1/posts', postsRouter);
app.use('/api/v1/media', mediaRouter);
app.use('/api/v1/feed', feedRouter);
app.use('/api/v1/engagement', engagementRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/stream', streamRouter);
app.use('/api/v1/tags', tagsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/share', shareRouter);
app.use('/api/v1/account', accountRouter);
app.use('/api/v1/payments', paymentRouter);
app.delete('/api/v1/comments/:id', requireAuth, EngagementController.deleteComment);

// Centralized RFC 9457 error handler
app.use(errorHandler);
