import { Router } from 'express';
import { FeedController } from '../controllers/feed.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

export const feedRouter = Router();

feedRouter.get('/home', requireAuth, FeedController.getHomeFeed);
feedRouter.get('/home/new-count', requireAuth, FeedController.getNewCount);
feedRouter.get('/explore', optionalAuth, FeedController.getExploreFeed);
feedRouter.get('/bookmarks', requireAuth, FeedController.getBookmarks);
