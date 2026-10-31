import { Router, Request, Response, NextFunction } from 'express';
import { GraphService } from '../services/graph.service.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

export const graphRouter = Router();

// Follow: 60/hr
graphRouter.put(
  '/users/:id/follow',
  requireAuth,
  rateLimit({ windowSeconds: 3600, maxRequests: 60, prefix: 'follow', keyGenerator: (req) => req.user!.id }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await GraphService.followUser(req.user!.id, req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

graphRouter.delete(
  '/users/:id/follow',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await GraphService.unfollowUser(req.user!.id, req.params.id as string);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

graphRouter.put(
  '/users/:id/block',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await GraphService.blockUser(req.user!.id, req.params.id as string);
      res.json({ blocked: true });
    } catch (err) {
      next(err);
    }
  }
);

graphRouter.delete(
  '/users/:id/block',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await GraphService.unblockUser(req.user!.id, req.params.id as string);
      res.json({ blocked: false });
    } catch (err) {
      next(err);
    }
  }
);

graphRouter.put(
  '/users/:id/mute',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await GraphService.muteUser(req.user!.id, req.params.id as string);
      res.json({ muted: true });
    } catch (err) {
      next(err);
    }
  }
);

graphRouter.delete(
  '/users/:id/mute',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await GraphService.unmuteUser(req.user!.id, req.params.id as string);
      res.json({ muted: false });
    } catch (err) {
      next(err);
    }
  }
);
