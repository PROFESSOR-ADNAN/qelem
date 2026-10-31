import { Router } from 'express';
import { handleSSEStream } from '../controllers/stream.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const streamRouter = Router();

streamRouter.get('/', requireAuth, handleSSEStream);
