import { Router } from 'express';
import { AccountController } from '../controllers/account.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const accountRouter = Router();

accountRouter.get('/export', requireAuth, AccountController.exportData);
accountRouter.post('/delete', requireAuth, AccountController.requestDeletion);
accountRouter.post('/cancel-deletion', requireAuth, AccountController.cancelDeletion);
