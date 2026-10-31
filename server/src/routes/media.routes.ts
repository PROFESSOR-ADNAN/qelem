import { Router, Request, Response, NextFunction } from 'express';
import { MediaService } from '../services/media.service.js';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

export const mediaRouter = Router();

// Upload url request: rate limited (8 / min, 40 / day)
mediaRouter.post(
  '/upload-url',
  requireAuth,
  requireVerifiedEmail,
  rateLimit({ windowSeconds: 60, maxRequests: 8, prefix: 'upload-req', keyGenerator: (req) => req.user!.id }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await MediaService.requestUploadUrl(req.user!.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

mediaRouter.post(
  '/confirm',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await MediaService.confirmUpload(req.user!.id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

mediaRouter.get(
  '/:id/status',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await MediaService.getStatus(req.user!.id, req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
