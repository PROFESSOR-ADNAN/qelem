import { Router } from 'express';
import { ShareController } from '../controllers/share.controller.js';

export const shareRouter = Router();

shareRouter.get('/p/:id', ShareController.getPostPreview);
shareRouter.get('/u/:username', ShareController.getUserPreview);
