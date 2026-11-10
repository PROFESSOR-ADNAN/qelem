import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.js';
import { AuthService } from '../services/auth.service.js';
import {
  RegisterSchema,
  LoginSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  VerifyEmailSchema
} from '@qelem/shared';
import { AppError } from '../middleware/error.js';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { EmailService } from '../services/email.service.js';
import { logger } from '../utils/logger.js';

const REFRESH_COOKIE_NAME = 'qelem_refresh_token';
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const getCookieOptions = () => {
  const sameSite: 'none' | 'lax' | 'strict' =
    env.COOKIE_SAME_SITE || (env.NODE_ENV === 'production' ? 'none' : 'lax');
  const secure = env.NODE_ENV === 'production' || sameSite === 'none';
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/'
  };
};

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = RegisterSchema.parse(req.body);

      // Check if username or email already exists
      const existing = await User.findOne({
        $or: [
          { usernameLower: input.username.toLowerCase() },
          { emailLower: input.email.toLowerCase() }
        ]
      });

      if (existing) {
        if (existing.usernameLower === input.username.toLowerCase()) {
          throw new AppError(409, 'Username is already taken');
        }
        throw new AppError(409, 'Email address is already registered');
      }

      const passwordHash = await AuthService.hashPassword(input.password);
      const emailVerificationToken = randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const user = await User.create({
        username: input.username,
        usernameLower: input.username.toLowerCase(),
        displayName: input.displayName,
        email: input.email,
        emailLower: input.email.toLowerCase(),
        passwordHash,
        cohortId: input.cohortId || null,
        emailVerificationToken,
        emailVerificationExpires,
        isEmailVerified: false
      });

      // Dispatch verification email in background without blocking signup response
      EmailService.sendVerificationEmail(user.email, user.displayName, emailVerificationToken).catch(
        (err) => logger.error({ msg: 'Background email verification dispatch error', error: err.message })
      );

      const { accessToken, refreshToken } = await AuthService.createSession(
        user,
        req.headers['user-agent'],
        req.ip
      );

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions());

      res.status(201).json({
        user: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          cohortId: user.cohortId,
          isEmailVerified: user.isEmailVerified
        },
        accessToken,
        refreshToken
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = LoginSchema.parse(req.body);
      const identifier = input.login.trim().toLowerCase();

      // Check account lockout
      await AuthService.checkLockout(identifier);

      // Uniform error message for both non-existent user and wrong password
      const invalidCredsError = new AppError(
        401,
        'Invalid email/username or password',
        'https://qelem.et/errors/invalid-credentials'
      );

      const user = await User.findOne({
        $or: [
          { emailLower: identifier },
          { usernameLower: identifier }
        ]
      }).select('+passwordHash +totpSecret');

      if (!user) {
        await AuthService.recordFailedAttempt(identifier);
        throw invalidCredsError;
      }

      if (user.state === 'suspended') {
        throw new AppError(403, 'Your account has been suspended by a moderator');
      }

      const isValidPassword = await AuthService.verifyPassword(user.passwordHash, input.password);
      if (!isValidPassword) {
        await AuthService.recordFailedAttempt(identifier);
        throw invalidCredsError;
      }

      // Successful credentials - clear failed lockout counter
      await AuthService.clearLockout(identifier);

      const { accessToken, refreshToken } = await AuthService.createSession(
        user,
        req.headers['user-agent'],
        req.ip
      );

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions());

      res.status(200).json({
        user: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          cohortId: user.cohortId,
          isEmailVerified: user.isEmailVerified,
          mfaEnabled: user.mfaEnabled
        },
        accessToken,
        refreshToken
      });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      if (!rawToken) {
        throw new AppError(401, 'Refresh token cookie is missing');
      }

      const { accessToken, refreshToken: newRefreshToken } = await AuthService.rotateSession(
        rawToken,
        req.headers['user-agent'],
        req.ip
      );

      res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, getCookieOptions());

      res.status(200).json({ accessToken, refreshToken: newRefreshToken });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      if (rawToken) {
        await AuthService.revokeSession(rawToken);
      }

      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth'
      });

      res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = VerifyEmailSchema.parse(req.body);

      const user = await User.findOne({
        emailVerificationToken: input.token,
        emailVerificationExpires: { $gt: new Date() }
      }).select('+emailVerificationToken +emailVerificationExpires');

      if (!user) {
        throw new AppError(400, 'Verification token is invalid or has expired');
      }

      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      res.status(200).json({ message: 'Email address verified successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = req.body?.email;
      const userId = req.user?.id;

      let user: any = null;
      if (userId) {
        user = await User.findById(userId);
      } else if (email) {
        user = await User.findOne({ emailLower: String(email).trim().toLowerCase() });
      }

      if (!user) {
        throw new AppError(404, 'User account not found');
      }

      if (user.isEmailVerified) {
        res.status(200).json({ message: 'Email address is already verified' });
        return;
      }

      const newToken = randomBytes(32).toString('hex');
      user.emailVerificationToken = newToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();

      EmailService.sendVerificationEmail(user.email, user.displayName, newToken).catch(
        (err) => logger.error({ msg: 'Background email verification dispatch error', error: err.message })
      );

      res.status(200).json({ message: 'Verification email resent successfully. Please check your inbox.' });
    } catch (err) {
      next(err);
    }
  }

  static async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = PasswordResetRequestSchema.parse(req.body);
      const user = await User.findOne({ emailLower: input.email.toLowerCase() });

      if (user) {
        user.passwordResetToken = randomBytes(32).toString('hex');
        user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await user.save();
        // Transactional email dispatch will be handled by email worker
      }

      // Always return 200 to prevent email enumeration
      res.status(200).json({
        message: 'If an account exists with that email, a password reset link has been dispatched.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async confirmPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = PasswordResetConfirmSchema.parse(req.body);

      const user = await User.findOne({
        passwordResetToken: input.token,
        passwordResetExpires: { $gt: new Date() }
      }).select('+passwordResetToken +passwordResetExpires');

      if (!user) {
        throw new AppError(400, 'Password reset token is invalid or has expired');
      }

      user.passwordHash = await AuthService.hashPassword(input.newPassword);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      // Revoke all existing sessions for security
      await AuthService.revokeAllUserSessions(user._id);

      res.status(200).json({ message: 'Password has been reset successfully. Please log in.' });
    } catch (err) {
      next(err);
    }
  }
}
