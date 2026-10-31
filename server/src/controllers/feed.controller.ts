import { Request, Response, NextFunction } from 'express';
import { FeedService } from '../feed/feed.service.js';
import { Bookmark } from '../models/Bookmark.js';
import { Post } from '../models/Post.js';
import { Types } from 'mongoose';
import { PaginationQuerySchema, SYSTEM_LIMITS } from '@qelem/shared';
import { encodeCursor, decodeCursor } from '@qelem/shared/cursors';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';

export class FeedController {
  static async getHomeFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cursor, limit } = PaginationQuerySchema.parse(req.query);
      const result = await FeedService.getHomeFeed(req.user!.id, cursor, limit);

      if (result.degraded) {
        res.setHeader('X-Feed-Degraded', 'true');
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getNewCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const after = parseFloat(req.query.after as string);
      if (isNaN(after)) {
        res.json({ count: 0 });
        return;
      }

      const count = await FeedService.getNewCount(req.user!.id, after);
      res.json({ count });
    } catch (err) {
      next(err);
    }
  }

  static async getExploreFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohort = req.query.cohort as string | undefined;
      const tag = req.query.tag as string | undefined;
      const { cursor, limit } = PaginationQuerySchema.parse(req.query);

      // If specific cohort or tag filter requested, query indexed MongoDB posts
      if (cohort || tag) {
        const query: Record<string, unknown> = { state: 'published' };
        if (cohort) query.authorCohortId = cohort;
        if (tag) query.tags = tag.toLowerCase().trim();

        if (cursor) {
          const decoded = decodeCursor(cursor, env.CURSOR_SIGNING_SECRET, env.CURSOR_SIGNING_SECRET_OLD);
          query.$or = [
            { publishedAt: { $lt: new Date(decoded.score) } },
            { publishedAt: new Date(decoded.score), _id: { $lt: new Types.ObjectId(decoded.id) } }
          ];
        }

        const posts = await Post.find(query)
          .sort({ publishedAt: -1, _id: -1 })
          .limit(limit + 1)
          .populate('authorId', 'username displayName avatarMediaId cohortId')
          .populate('mediaIds')
          .lean();

        const hasMore = posts.length > limit;
        const items = hasMore ? posts.slice(0, limit) : posts;

        let nextCursor: string | null = null;
        if (hasMore && items.length > 0) {
          const lastItem = items[items.length - 1];
          nextCursor = encodeCursor(
            {
              v: 1,
              kind: 'explore',
              score: (lastItem.publishedAt || lastItem.createdAt).getTime(),
              id: lastItem._id.toString(),
              ts: Date.now()
            },
            env.CURSOR_SIGNING_SECRET
          );
        }

        res.json({ items: items.map(p => ({ post: p })), nextCursor });
        return;
      }

      // Read from latest versioned trending snapshot in Redis
      const latestVersion = await redis.get('trending:global:latest');
      if (latestVersion) {
        const snapshotKey = `trending:global:${latestVersion}`;
        const rawIds = await redis.lrange(snapshotKey, 0, 49);

        if (rawIds.length > 0) {
          const hydrated = await FeedService.hydratePosts(
            rawIds.slice(0, limit),
            req.user ? req.user.id : '000000000000000000000000'
          );
          res.json({ items: hydrated, nextCursor: null });
          return;
        }
      }

      // Fallback: newest published posts
      const fallbackPosts = await Post.find({ state: 'published' })
        .sort({ publishedAt: -1, _id: -1 })
        .limit(limit)
        .populate('authorId', 'username displayName avatarMediaId cohortId')
        .populate('mediaIds')
        .lean();

      res.json({
        items: fallbackPosts.map(p => ({ post: p })),
        nextCursor: null
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBookmarks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userObjId = new Types.ObjectId(req.user!.id);
      const { cursor, limit } = PaginationQuerySchema.parse(req.query);

      const query: Record<string, unknown> = { userId: userObjId };
      if (cursor) {
        const decoded = decodeCursor(cursor, env.CURSOR_SIGNING_SECRET, env.CURSOR_SIGNING_SECRET_OLD);
        query._id = { $lt: new Types.ObjectId(decoded.id) };
      }

      const bookmarks = await Bookmark.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate({
          path: 'postId',
          populate: [
            { path: 'authorId', select: 'username displayName avatarMediaId cohortId' },
            { path: 'mediaIds' }
          ]
        })
        .lean();

      const hasMore = bookmarks.length > limit;
      const items = hasMore ? bookmarks.slice(0, limit) : bookmarks;

      let nextCursor: string | null = null;
      if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        nextCursor = encodeCursor(
          {
            v: 1,
            kind: 'home',
            score: lastItem.createdAt.getTime(),
            id: lastItem._id.toString(),
            ts: Date.now()
          },
          env.CURSOR_SIGNING_SECRET
        );
      }

      res.json({
        items: items
          .filter(b => b.postId && (b.postId as any).state === 'published')
          .map(b => ({ post: b.postId, viewerState: { liked: false, bookmarked: true } })),
        nextCursor
      });
    } catch (err) {
      next(err);
    }
  }
}
