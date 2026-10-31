import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import promClient from 'prom-client';
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

// Initialize Prometheus Default Metrics
promClient.collectDefaultMetrics({ prefix: 'qelem_' });

export const app = express();

// Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', env.MEDIA_CDN_URL],
        connectSrc: ["'self'", env.API_BASE_URL, env.MEDIA_CDN_URL, env.S3_ENDPOINT || ''],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// CORS configuration
app.use(
  cors({
    origin: [env.WEB_BASE_URL, 'http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
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

// Liveness & Readiness endpoints
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', promClient.register.contentType);
  res.send(await promClient.register.metrics());
});

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

// Centralized RFC 9457 error handler
app.use(errorHandler);
