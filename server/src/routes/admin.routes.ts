import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';

export const adminRouter = Router();

// Reports creation (rate limited: 10 / day)
adminRouter.post(
  '/reports',
  requireAuth,
  rateLimit({ windowSeconds: 86400, maxRequests: 10, prefix: 'report', keyGenerator: (req) => req.user!.id }),
  AdminController.createReport
);

// Staff moderator / admin operations
adminRouter.get('/reports', requireAuth, requireRole('moderator', 'admin'), AdminController.getReports);
adminRouter.post('/posts/:id/hide', requireAuth, requireRole('moderator', 'admin'), AdminController.hidePost);
adminRouter.post('/posts/:id/restore', requireAuth, requireRole('moderator', 'admin'), AdminController.restorePost);
adminRouter.post('/users/:id/suspend', requireAuth, requireRole('moderator', 'admin'), AdminController.suspendUser);
adminRouter.post('/users/:id/unsuspend', requireAuth, requireRole('moderator', 'admin'), AdminController.unsuspendUser);
adminRouter.post('/cohorts', requireAuth, requireRole('admin'), AdminController.manageCohort);
