import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { EngagementService } from '../services/engagement.service.js';
import { Comment } from '../models/Comment.js';
import { Notification } from '../models/Notification.js';
import { NotificationPref } from '../models/NotificationPref.js';
import { EmailSuppression } from '../models/EmailSuppression.js';
import { PaginationQuerySchema } from '@qelem/shared';
import { encodeCursor, decodeCursor } from '@qelem/shared/cursors';
import { AppError } from '../middleware/error.js';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';

export class EngagementController {
  static async toggleLike(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await EngagementService.toggleLike(req.params.id as string, req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async toggleBookmark(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await EngagementService.toggleBookmark(req.params.id as string, req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async createComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const comment = await EngagementService.createComment(req.params.id as string, req.user!.id, req.body);
      res.status(201).json({ comment });
    } catch (err) {
      next(err);
    }
  }

  static async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const postObjId = new Types.ObjectId(req.params.id as string);
      const { cursor, limit } = PaginationQuerySchema.parse(req.query);

      const query: Record<string, unknown> = {
        postId: postObjId,
        state: 'published'
      };

      if (cursor) {
        const decoded = decodeCursor(cursor, env.CURSOR_SIGNING_SECRET, env.CURSOR_SIGNING_SECRET_OLD);
        query._id = { $gt: new Types.ObjectId(decoded.id) };
      }

      // Oldest first for comments
      const comments = await Comment.find(query)
        .sort({ _id: 1 })
        .limit(limit + 1)
        .populate('authorId', 'username displayName avatarMediaId cohortId')
        .lean();

      const hasMore = comments.length > limit;
      const items = hasMore ? comments.slice(0, limit) : comments;

      let nextCursor: string | null = null;
      if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        nextCursor = encodeCursor(
          {
            v: 1,
            kind: 'comments',
            score: lastItem.createdAt.getTime(),
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

  static async deleteComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const comment = await Comment.findById(req.params.id as string);
      if (!comment || comment.state === 'deleted') {
        throw new AppError(404, 'Comment not found');
      }

      const isAuthor = comment.authorId.toString() === req.user!.id;
      const isStaff = req.user!.role === 'moderator' || req.user!.role === 'admin';

      if (!isAuthor && !isStaff) {
        throw new AppError(403, 'You do not have permission to delete this comment');
      }

      comment.state = 'deleted';
      comment.text = '[Comment deleted by user]';
      await comment.save();

      await redis.hincrby(`counts:${comment.postId}`, 'commentCount', -1);
      await redis.sadd('dirty:counts', comment.postId.toString());

      res.json({ message: 'Comment deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userObjId = new Types.ObjectId(req.user!.id);
      const { cursor, limit } = PaginationQuerySchema.parse(req.query);

      const query: Record<string, unknown> = { userId: userObjId };

      if (cursor) {
        const decoded = decodeCursor(cursor, env.CURSOR_SIGNING_SECRET, env.CURSOR_SIGNING_SECRET_OLD);
        query.$or = [
          { updatedAt: { $lt: new Date(decoded.score) } },
          { updatedAt: new Date(decoded.score), _id: { $lt: new Types.ObjectId(decoded.id) } }
        ];
      }

      const notifications = await Notification.find(query)
        .sort({ updatedAt: -1, _id: -1 })
        .limit(limit + 1)
        .populate('actorIds', 'username displayName avatarMediaId')
        .lean();

      const hasMore = notifications.length > limit;
      const items = hasMore ? notifications.slice(0, limit) : notifications;

      let nextCursor: string | null = null;
      if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        nextCursor = encodeCursor(
          {
            v: 1,
            kind: 'notifications',
            score: lastItem.updatedAt.getTime(),
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

  static async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      let countStr = await redis.get(`unread:${userId}`);

      if (countStr === null) {
        // Recompute from MongoDB source of truth
        const actualCount = await Notification.countDocuments({
          userId: new Types.ObjectId(userId),
          readAt: null
        });
        await redis.set(`unread:${userId}`, actualCount.toString(), 'EX', 3600);
        countStr = actualCount.toString();
      }

      const count = parseInt(countStr, 10);
      res.setHeader('ETag', `"${count}"`);
      res.json({ count });
    } catch (err) {
      next(err);
    }
  }

  static async markSeen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userObjId = new Types.ObjectId(req.user!.id);
      await Notification.updateMany({ userId: userObjId, seenAt: null }, { $set: { seenAt: new Date() } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userObjId = new Types.ObjectId(req.user!.id);
      const notificationId = req.body?.notificationId;

      if (notificationId) {
        await Notification.updateOne(
          { _id: new Types.ObjectId(notificationId), userId: userObjId },
          { $set: { readAt: new Date() } }
        );
      } else {
        await Notification.updateMany({ userId: userObjId, readAt: null }, { $set: { readAt: new Date() } });
      }

      // Reset unread count
      const remaining = await Notification.countDocuments({ userId: userObjId, readAt: null });
      await redis.set(`unread:${req.user!.id}`, remaining.toString(), 'EX', 3600);

      res.json({ unreadCount: remaining });
    } catch (err) {
      next(err);
    }
  }

  static async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pref = (await NotificationPref.findOne({ userId: req.user!.id })) || {
        emailLikes: false,
        emailComments: true,
        emailMentions: true,
        emailFollows: false,
        emailDailyDigest: true
      };
      res.json({ preferences: pref });
    } catch (err) {
      next(err);
    }
  }

  static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await NotificationPref.findOneAndUpdate(
        { userId: new Types.ObjectId(req.user!.id) },
        { $set: req.body },
        { upsert: true, new: true }
      );
      res.json({ preferences: updated });
    } catch (err) {
      next(err);
    }
  }

  static async unsubscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = String(req.query.email || '').toLowerCase().trim();
      if (!email) throw new AppError(400, 'Email parameter is required');

      await EmailSuppression.findOneAndUpdate(
        { emailLower: email },
        { emailLower: email, reason: 'unsubscribe' },
        { upsert: true }
      );

      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2>You have been unsubscribed</h2>
            <p>You will no longer receive notification emails from Qelem for ${email}.</p>
          </body>
        </html>
      `);
    } catch (err) {
      next(err);
    }
  }
}
