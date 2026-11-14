import { Router } from 'express';
import { EngagementController } from '../controllers/engagement.controller.js';
import { TelegramService } from '../services/telegram.service.js';
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

// Telegram Bot Integration
notificationsRouter.post('/telegram/link-code', requireAuth, async (req, res, next) => {
  try {
    const code = await TelegramService.generateLinkCode(req.user!.id);
    res.json({
      code,
      botUsername: process.env.TELEGRAM_BOT_NAME || 'qelem_bot',
      deepLink: `https://t.me/${process.env.TELEGRAM_BOT_NAME || 'qelem_bot'}?start=${code}`
    });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/telegram/webhook', async (req, res, next) => {
  try {
    await TelegramService.handleWebhook(req.body);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
