import { Router, Request, Response, NextFunction } from 'express';
import { Tag } from '../models/Tag.js';

export const tagsRouter = Router();

tagsRouter.get('/suggest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) {
      const popular = await Tag.find().sort({ postCount: -1 }).limit(10).lean();
      res.json({ tags: popular.map(t => t.name) });
      return;
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tags = await Tag.find({ name: { $regex: `^${escaped}` } })
      .sort({ postCount: -1 })
      .limit(8)
      .lean();

    res.json({ tags: tags.map(t => t.name) });
  } catch (err) {
    next(err);
  }
});
