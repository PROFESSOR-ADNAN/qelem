import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { Like } from '../models/Like.js';
import { Bookmark } from '../models/Bookmark.js';
import { PostService } from '../services/post.service.js';
import { AppError } from '../middleware/error.js';
import { PaginationQuerySchema } from '@qelem/shared';
import { encodeCursor, decodeCursor } from '@qelem/shared/cursors';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';

export class PostsController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await PostService.createPost(req.user!.id, req.body);
      res.status(201).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const postId = req.params.id as string;
      const cached = await redis.get(`post:${postId}`);

      let postData: any;
      if (cached) {
        postData = JSON.parse(cached);
      } else {
        const post = await Post.findById(postId)
          .populate('authorId', 'username displayName avatarMediaId cohortId')
          .populate('mediaIds')
          .lean();

        if (!post || post.state === 'deleted' || post.state === 'failed') {
          throw new AppError(404, 'Post not found');
        }

        if (post.state === 'hidden' && (!req.user || req.user.role === 'user')) {
          throw new AppError(404, 'Post not found');
        }

        postData = post;
        // Cache post for 5 minutes
        await redis.setex(`post:${postId}`, 300, JSON.stringify(post));
      }

      // Read live engagement counters from Redis if available
      const liveCounts = await redis.hgetall(`counts:${postId}`);
      if (liveCounts && liveCounts.likeCount) {
        postData.likeCount = parseInt(liveCounts.likeCount, 10);
      }
      if (liveCounts && liveCounts.commentCount) {
        postData.commentCount = parseInt(liveCounts.commentCount, 10);
      }

      // Join viewer-specific state (never cached)
      let viewerLiked = false;
      let viewerBookmarked = false;

      if (req.user) {
        const [likeDoc, bookmarkDoc] = await Promise.all([
          Like.findOne({ postId: postData._id, userId: new Types.ObjectId(req.user.id) }),
          Bookmark.findOne({ postId: postData._id, userId: new Types.ObjectId(req.user.id) })
        ]);
        viewerLiked = !!likeDoc;
        viewerBookmarked = !!bookmarkDoc;
      }

      res.json({
        post: postData,
        viewerState: {
          liked: viewerLiked,
          bookmarked: viewerBookmarked
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async edit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const post = await PostService.editPost(req.params.id as string, req.user!.id, req.body);
      res.json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await PostService.deletePost(req.params.id as string, req.user!.id, req.user!.role);
      res.json({ message: 'Post deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async getByAuthor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = (req.params.username as string).toLowerCase().trim();
      const user = await User.findOne({ usernameLower: username });
      if (!user) throw new AppError(404, 'User not found');

      const { cursor, limit } = PaginationQuerySchema.parse(req.query);

      const query: Record<string, unknown> = {
        authorId: user._id,
        state: 'published'
      };

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
            kind: 'profile',
            score: (lastItem.publishedAt || lastItem.createdAt).getTime(),
            id: lastItem._id.toString(),
            ts: Date.now()
          },
          env.CURSOR_SIGNING_SECRET
        );
      }

      res.json({ items, nextCursor });
    } catch (err) {
      next(err);
    }
  }

  static async getByTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tag = PostService.normalizeTag(req.params.tag as string);
      const { cursor, limit } = PaginationQuerySchema.parse(req.query);

      const query: Record<string, unknown> = {
        tags: tag,
        state: 'published'
      };

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
            kind: 'tag',
            score: (lastItem.publishedAt || lastItem.createdAt).getTime(),
            id: lastItem._id.toString(),
            ts: Date.now()
          },
          env.CURSOR_SIGNING_SECRET
        );
      }

      res.json({ tag, items, nextCursor });
    } catch (err) {
      next(err);
    }
  }

  static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = (req.query.q as string || '').trim();
      const tag = (req.query.tag as string || '').trim().toLowerCase();
      const cohort = (req.query.cohort as string || '').trim();
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 50);

      const query: Record<string, unknown> = { state: 'published' };

      if (tag) {
        query.tags = tag;
      }

      if (cohort) {
        query.authorCohortId = cohort;
      }

      if (q) {
        query.$or = [
          { text: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { tags: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
        ];
      }

      const posts = await Post.find(query)
        .sort({ publishedAt: -1, _id: -1 })
        .limit(limit)
        .populate('authorId', 'username displayName avatarMediaId cohortId university')
        .populate('mediaIds')
        .lean();

      res.json({ items: posts, query: { q, tag, cohort } });
    } catch (err) {
      next(err);
    }
  }
}
