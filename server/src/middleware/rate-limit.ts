import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { AppError } from './error.js';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  prefix: string;
}

export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!env.RATE_LIMIT_ENABLED || env.NODE_ENV === 'test') {
      return next();
    }

    const clientIp = (req.headers['cf-connecting-ip'] as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.ip ||
      '127.0.0.1';

    const identifier = options.keyGenerator ? options.keyGenerator(req) : clientIp;
    const now = Math.floor(Date.now() / 1000);
    const windowKey = Math.floor(now / options.windowSeconds);
    const redisKey = `rl:${options.prefix}:${identifier}:${windowKey}`;

    try {
      const current = await redis.incr(redisKey);
      if (current === 1) {
        await redis.expire(redisKey, options.windowSeconds + 2);
      }

      const remaining = Math.max(0, options.maxRequests - current);
      const resetTime = (windowKey + 1) * options.windowSeconds;

      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      if (current > options.maxRequests) {
        res.setHeader('Retry-After', resetTime - now);
        return next(new AppError(429, 'Rate limit exceeded. Please wait before retrying.', 'https://qelem.et/errors/rate-limit-exceeded'));
      }

      next();
    } catch {
      // In case of Redis degradation, fail-open for standard operations
      next();
    }
  };
}
