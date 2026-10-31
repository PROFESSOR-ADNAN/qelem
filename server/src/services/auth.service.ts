import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { User, IUser } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { AppError } from '../middleware/error.js';
import { UserRole } from '@qelem/shared';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SECONDS = 15 * 60; // 15 minutes

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 1
    });
  }

  static async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  static generateAccessToken(user: IUser): string {
    return jwt.sign(
      {
        sub: user._id.toString(),
        username: user.username,
        role: user.role,
        isVerified: user.isEmailVerified
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  static async checkLockout(identifier: string): Promise<void> {
    const key = `lockout:${identifier.toLowerCase()}`;
    const attempts = await redis.get(key);
    if (attempts && parseInt(attempts, 10) >= MAX_LOGIN_ATTEMPTS) {
      throw new AppError(
        429,
        'Account temporarily locked due to multiple failed login attempts. Please try again in 15 minutes.',
        'https://qelem.et/errors/account-locked'
      );
    }
  }

  static async recordFailedAttempt(identifier: string): Promise<void> {
    const key = `lockout:${identifier.toLowerCase()}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, LOCKOUT_WINDOW_SECONDS);
    }
  }

  static async clearLockout(identifier: string): Promise<void> {
    await redis.del(`lockout:${identifier.toLowerCase()}`);
  }

  static async createSession(user: IUser, userAgent?: string, ipAddress?: string): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.generateAccessToken(user);
    const rawRefreshToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const familyId = randomBytes(16).toString('hex');

    await RefreshToken.create({
      userId: user._id,
      tokenHash,
      familyId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgent,
      ipAddress
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  static async rotateSession(rawToken: string, userAgent?: string, ipAddress?: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = this.hashToken(rawToken);
    const storedToken = await RefreshToken.findOne({ tokenHash });

    if (!storedToken) {
      throw new AppError(401, 'Invalid refresh session');
    }

    // Reuse detection: if already revoked, revoke the whole family
    if (storedToken.isRevoked) {
      await RefreshToken.updateMany({ familyId: storedToken.familyId }, { $set: { isRevoked: true } });
      throw new AppError(401, 'Revoked session token reused. All sessions terminated for security.', 'https://qelem.et/errors/session-revoked');
    }

    // Check expiration
    if (storedToken.expiresAt.getTime() < Date.now()) {
      storedToken.isRevoked = true;
      await storedToken.save();
      throw new AppError(401, 'Refresh session expired. Please log in again.');
    }

    // Mark current token as revoked
    storedToken.isRevoked = true;
    await storedToken.save();

    // Fetch user
    const user = await User.findById(storedToken.userId);
    if (!user || user.state !== 'active') {
      throw new AppError(401, 'User account is inactive or not found');
    }

    // Issue new token in the same family
    const newRawRefreshToken = randomBytes(32).toString('hex');
    const newTokenHash = this.hashToken(newRawRefreshToken);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: newTokenHash,
      familyId: storedToken.familyId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgent,
      ipAddress
    });

    const accessToken = this.generateAccessToken(user);
    return { accessToken, refreshToken: newRawRefreshToken };
  }

  static async revokeSession(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await RefreshToken.updateOne({ tokenHash }, { $set: { isRevoked: true } });
  }

  static async revokeAllUserSessions(userId: Types.ObjectId | string): Promise<void> {
    await RefreshToken.updateMany({ userId }, { $set: { isRevoked: true } });
  }
}
