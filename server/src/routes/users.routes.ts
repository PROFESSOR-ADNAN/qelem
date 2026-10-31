import { Router } from 'express';
import { UsersController } from '../controllers/users.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, UsersController.getMe);
usersRouter.patch('/me', requireAuth, UsersController.updateMe);

// Search users by prefix (rate limited: 30 / min)
usersRouter.get(
  '/search',
  rateLimit({ windowSeconds: 60, maxRequests: 30, prefix: 'user-search' }),
  UsersController.searchUsers
);

usersRouter.get('/cohorts', UsersController.getCohorts);

usersRouter.get('/:username', optionalAuth, UsersController.getByUsername);
usersRouter.get('/:id/followers', optionalAuth, UsersController.getFollowers);
usersRouter.get('/:id/following', optionalAuth, UsersController.getFollowing);
