import { Router } from 'express';
import { EngagementController } from '../controllers/engagement.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

export const engagementRouter = Router();

// Likes: 120 / min
engagementRouter.put(
  '/posts/:id/like',
  requireAuth,
  rateLimit({ windowSeconds: 60, maxRequests: 120, prefix: 'like', keyGenerator: (req) => req.user!.id }),
  EngagementController.toggleLike
);

engagementRouter.delete('/posts/:id/like', requireAuth, EngagementController.toggleLike);

// Bookmarks
engagementRouter.put('/posts/:id/bookmark', requireAuth, EngagementController.toggleBookmark);
engagementRouter.delete('/posts/:id/bookmark', requireAuth, EngagementController.toggleBookmark);

// Comments: 10 / min
engagementRouter.post(
  '/posts/:id/comments',
  requireAuth,
  rateLimit({ windowSeconds: 60, maxRequests: 10, prefix: 'comment-create', keyGenerator: (req) => req.user!.id }),
  EngagementController.createComment
);

engagementRouter.get('/posts/:id/comments', optionalAuth, EngagementController.getComments);
engagementRouter.delete('/comments/:id', requireAuth, EngagementController.deleteComment);
