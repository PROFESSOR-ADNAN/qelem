import { Router } from 'express';
import { PostsController } from '../controllers/posts.controller.js';
import { requireAuth, optionalAuth, requireVerifiedEmail } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

export const postsRouter = Router();

// Create post: rate limited to 6 / hour, verified email required
postsRouter.post(
  '/',
  requireAuth,
  requireVerifiedEmail,
  rateLimit({ windowSeconds: 3600, maxRequests: 6, prefix: 'post-create', keyGenerator: (req) => req.user!.id }),
  PostsController.create
);

postsRouter.get('/:id', optionalAuth, PostsController.getById);
postsRouter.patch('/:id', requireAuth, PostsController.edit);
postsRouter.delete('/:id', requireAuth, PostsController.delete);

postsRouter.get('/author/:username', optionalAuth, PostsController.getByAuthor);
postsRouter.get('/tag/:tag', optionalAuth, PostsController.getByTag);
