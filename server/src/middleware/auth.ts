import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './error.js';
import { UserRole } from '@qelem/shared';
import { redis } from '../config/redis.js';

export interface AuthUserPayload {
  id: string;
  role: UserRole;
  isVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      id?: string;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return next(new AppError(401, 'Authentication token required'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; role: UserRole; isVerified: boolean };
    
    // Check if user is suspended in Redis fast-check set
    const isSuspended = await redis.sismember('suspended:users', payload.sub);
    if (isSuspended) {
      return next(new AppError(403, 'Your account has been suspended by a moderator'));
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
      isVerified: payload.isVerified ?? false
    };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'Authentication token has expired', 'https://qelem.et/errors/token-expired'));
    }
    return next(new AppError(401, 'Invalid authentication token'));
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; role: UserRole; isVerified: boolean };
    const isSuspended = await redis.sismember('suspended:users', payload.sub);
    if (!isSuspended) {
      req.user = {
        id: payload.sub,
        role: payload.role,
        isVerified: payload.isVerified ?? false
      };
    }
  } catch {
    // Ignore invalid or expired token on optional routes
  }

  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions for this operation'));
    }

    next();
  };
}

export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required'));
  }

  if (!req.user.isVerified) {
    return next(new AppError(403, 'Please verify your email address to perform this action', 'https://qelem.et/errors/email-unverified'));
  }

  next();
}
