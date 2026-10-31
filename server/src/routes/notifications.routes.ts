import { Router } from 'express';
import { EngagementController } from '../controllers/engagement.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, EngagementController.getNotifications);
notificationsRouter.get('/unread-count', requireAuth, EngagementController.getUnreadCount);
notificationsRouter.post('/seen', requireAuth, EngagementController.markSeen);
notificationsRouter.post('/read', requireAuth, EngagementController.markRead);

notificationsRouter.get('/preferences', requireAuth, EngagementController.getPreferences);
notificationsRouter.patch('/preferences', requireAuth, EngagementController.updatePreferences);

// One-click unsubscribe route (public)
notificationsRouter.get('/unsubscribe', EngagementController.unsubscribe);
