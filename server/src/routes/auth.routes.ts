import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { optionalAuth } from '../middleware/auth.js';

export const authRouter = Router();

// Rate limited register: 5 per hour per IP
authRouter.post(
  '/register',
  rateLimit({ windowSeconds: 3600, maxRequests: 5, prefix: 'reg' }),
  AuthController.register
);

// Rate limited login: 10 per 15 min per IP
authRouter.post(
  '/login',
  rateLimit({ windowSeconds: 900, maxRequests: 10, prefix: 'login' }),
  AuthController.login
);

authRouter.post('/refresh', AuthController.refresh);
authRouter.post('/logout', AuthController.logout);
authRouter.post('/verify-email', AuthController.verifyEmail);
authRouter.post(
  '/resend-verification',
  optionalAuth,
  rateLimit({ windowSeconds: 60, maxRequests: 3, prefix: 'resend-verif' }),
  AuthController.resendVerification
);
authRouter.post('/forgot-password', AuthController.requestPasswordReset);
authRouter.post('/reset-password', AuthController.confirmPasswordReset);
