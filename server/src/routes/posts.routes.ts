import { Router } from 'express';
import { PostsController } from '../controllers/posts.controller.js';
import { EngagementController } from '../controllers/engagement.controller.js';
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

// Live search with debounce
postsRouter.get('/search/query', optionalAuth, PostsController.search);

postsRouter.get('/:id', optionalAuth, PostsController.getById);
postsRouter.patch('/:id', requireAuth, PostsController.edit);
postsRouter.delete('/:id', requireAuth, PostsController.delete);

// Like & Bookmark shortcuts matching frontend client paths
postsRouter.put('/:id/like', requireAuth, EngagementController.toggleLike);
postsRouter.delete('/:id/like', requireAuth, EngagementController.toggleLike);
postsRouter.put('/:id/bookmark', requireAuth, EngagementController.toggleBookmark);
postsRouter.delete('/:id/bookmark', requireAuth, EngagementController.toggleBookmark);

// Comments shortcuts matching frontend client paths
postsRouter.post('/:id/comments', requireAuth, EngagementController.createComment);
postsRouter.get('/:id/comments', optionalAuth, EngagementController.getComments);

postsRouter.get('/author/:username', optionalAuth, PostsController.getByAuthor);
postsRouter.get('/tag/:tag', optionalAuth, PostsController.getByTag);
