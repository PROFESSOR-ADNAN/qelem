import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Follow } from '../models/Follow.js';
import { Cohort } from '../models/Cohort.js';
import { Block } from '../models/Block.js';
import { UpdateProfileSchema, PaginationQuerySchema } from '@qelem/shared';
import { encodeCursor, decodeCursor } from '@qelem/shared/cursors';
import { AppError } from '../middleware/error.js';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';

export class UsersController {
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findById(req.user!.id);
      if (!user) throw new AppError(404, 'User not found');
      res.json({ user });
    } catch (err) {
      next(err);
    }
  }

  static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = UpdateProfileSchema.parse(req.body);
      const user = await User.findById(req.user!.id);
      if (!user) throw new AppError(404, 'User not found');

      if (input.displayName !== undefined) user.displayName = input.displayName;
      if (input.bio !== undefined) user.bio = input.bio;
      if (input.cohortId !== undefined) user.cohortId = input.cohortId;
      if (input.avatarMediaId !== undefined) {
        user.avatarMediaId = input.avatarMediaId ? new Types.ObjectId(input.avatarMediaId) : null;
      }

      await user.save();
      // Invalidate profile cache
      await redis.del(`user:${user._id}`);

      res.json({ user });
    } catch (err) {
      next(err);
    }
  }

  static async getByUsername(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = (req.params.username as string).toLowerCase().trim();
      const user = await User.findOne({ usernameLower: username });

      if (!user || user.state !== 'active') {
        throw new AppError(404, 'User not found');
      }

      let isFollowing = false;
      let isBlocked = false;

      if (req.user) {
        const viewerId = new Types.ObjectId(req.user.id);
        const [followDoc, blockDoc] = await Promise.all([
          Follow.findOne({ followerId: viewerId, followeeId: user._id }),
          Block.findOne({ blockerId: viewerId, blockedId: user._id })
        ]);
        isFollowing = !!followDoc;
        isBlocked = !!blockDoc;
      }

      res.json({
        user: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          avatarMediaId: user.avatarMediaId,
          cohortId: user.cohortId,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          postsCount: user.postsCount,
          createdAt: user.createdAt
        },
        viewerContext: {
          isFollowing,
          isBlocked
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = String(req.query.q || '').trim().toLowerCase();
      if (!q || q.length < 2) {
        res.json({ items: [] });
        return;
      }

      // Safe indexed prefix regex search on lowercase username
      const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const users = await User.find({
        state: 'active',
        $or: [
          { usernameLower: { $regex: `^${escapedQuery}`, $options: 'i' } },
          { displayName: { $regex: `^${escapedQuery}`, $options: 'i' } }
        ]
      })
        .select('username displayName avatarMediaId cohortId followersCount')
        .limit(10)
        .lean();

      res.json({ items: users });
    } catch (err) {
      next(err);
    }
  }

  static async getFollowers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = new Types.ObjectId(req.params.id as string);
      const { cursor, limit } = PaginationQuerySchema.parse(req.query);

      const query: Record<string, unknown> = { followeeId: targetUserId };

      if (cursor) {
        const decoded = decodeCursor(cursor, env.CURSOR_SIGNING_SECRET, env.CURSOR_SIGNING_SECRET_OLD);
        query._id = { $lt: new Types.ObjectId(decoded.id) };
      }

      const follows = await Follow.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate('followerId', 'username displayName avatarMediaId cohortId')
        .lean();

      const hasMore = follows.length > limit;
      const items = hasMore ? follows.slice(0, limit) : follows;

      let nextCursor: string | null = null;
      if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        nextCursor = encodeCursor(
          {
            v: 1,
            kind: 'followers',
            score: lastItem.createdAt.getTime(),
            id: lastItem._id.toString(),
            ts: Date.now()
          },
          env.CURSOR_SIGNING_SECRET
        );
      }

      res.json({
        items: items.map(f => f.followerId),
        nextCursor
      });
    } catch (err) {
      next(err);
    }
  }

  static async getFollowing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = new Types.ObjectId(req.params.id as string);
      const { cursor, limit } = PaginationQuerySchema.parse(req.query);

      const query: Record<string, unknown> = { followerId: targetUserId };

      if (cursor) {
        const decoded = decodeCursor(cursor, env.CURSOR_SIGNING_SECRET, env.CURSOR_SIGNING_SECRET_OLD);
        query._id = { $lt: new Types.ObjectId(decoded.id) };
      }

      const follows = await Follow.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate('followeeId', 'username displayName avatarMediaId cohortId')
        .lean();

      const hasMore = follows.length > limit;
      const items = hasMore ? follows.slice(0, limit) : follows;

      let nextCursor: string | null = null;
      if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        nextCursor = encodeCursor(
          {
            v: 1,
            kind: 'followers',
            score: lastItem.createdAt.getTime(),
            id: lastItem._id.toString(),
            ts: Date.now()
          },
          env.CURSOR_SIGNING_SECRET
        );
      }

      res.json({
        items: items.map(f => f.followeeId),
        nextCursor
      });
    } catch (err) {
      next(err);
    }
  }

  static async getCohorts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cohorts = await Cohort.find({ isActive: true }).sort({ name: 1 }).lean();
      res.json({ cohorts });
    } catch (err) {
      next(err);
    }
  }
}
