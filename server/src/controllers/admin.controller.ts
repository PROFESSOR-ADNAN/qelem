import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Report } from '../models/Report.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';
import { Cohort } from '../models/Cohort.js';
import { AuditLog } from '../models/AuditLog.js';
import { AuthService } from '../services/auth.service.js';
import { CreateReportSchema } from '@qelem/shared';
import { AppError } from '../middleware/error.js';
import { redis } from '../config/redis.js';

export class AdminController {
  static async createReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = CreateReportSchema.parse(req.body);
      const reporterObjId = new Types.ObjectId(req.user!.id);
      const targetObjId = new Types.ObjectId(input.targetId);

      // Snapshot target content for moderator review
      let snapshot: any = null;
      if (input.targetType === 'post') {
        snapshot = await Post.findById(targetObjId).lean();
      } else if (input.targetType === 'user') {
        snapshot = await User.findById(targetObjId).select('username displayName bio').lean();
      }

      const report = await Report.findOneAndUpdate(
        {
          reporterId: reporterObjId,
          targetType: input.targetType,
          targetId: targetObjId
        },
        {
          reporterId: reporterObjId,
          targetType: input.targetType,
          targetId: targetObjId,
          reason: input.reason,
          notes: input.notes,
          contentSnapshot: snapshot,
          status: 'pending'
        },
        { upsert: true, new: true }
      );

      res.status(201).json({ reportId: report._id, message: 'Report submitted successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async getReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string || 'pending';
      const reports = await Report.find({ status })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('reporterId', 'username displayName')
        .lean();

      res.json({ reports });
    } catch (err) {
      next(err);
    }
  }

  static async hidePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const postId = req.params.id as string;
      const post = await Post.findByIdAndUpdate(postId, { $set: { state: 'hidden' } }, { new: true });
      if (!post) throw new AppError(404, 'Post not found');

      // Evict Redis caches
      await redis.del(`post:${postId}`);
      await redis.zrem(`author:${post.authorId}:recent`, postId);

      await AuditLog.create({
        actorId: new Types.ObjectId(req.user!.id),
        action: 'HIDE_POST',
        targetType: 'post',
        targetId: postId,
        details: { reason: req.body?.reason }
      });

      res.json({ message: 'Post hidden by moderator', post });
    } catch (err) {
      next(err);
    }
  }

  static async restorePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const postId = req.params.id as string;
      const post = await Post.findByIdAndUpdate(postId, { $set: { state: 'published' } }, { new: true });
      if (!post) throw new AppError(404, 'Post not found');

      await redis.del(`post:${postId}`);

      await AuditLog.create({
        actorId: new Types.ObjectId(req.user!.id),
        action: 'RESTORE_POST',
        targetType: 'post',
        targetId: postId
      });

      res.json({ message: 'Post restored', post });
    } catch (err) {
      next(err);
    }
  }

  static async suspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id as string;
      const user = await User.findByIdAndUpdate(userId, { $set: { state: 'suspended' } }, { new: true });
      if (!user) throw new AppError(404, 'User not found');

      // Add to Redis fast-check suspended users set
      await redis.sadd('suspended:users', userId);

      // Revoke all active refresh sessions
      await AuthService.revokeAllUserSessions(userId);

      await AuditLog.create({
        actorId: new Types.ObjectId(req.user!.id),
        action: 'SUSPEND_USER',
        targetType: 'user',
        targetId: userId,
        details: { reason: req.body?.reason }
      });

      res.json({ message: 'User suspended successfully', user });
    } catch (err) {
      next(err);
    }
  }

  static async unsuspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id as string;
      const user = await User.findByIdAndUpdate(userId, { $set: { state: 'active' } }, { new: true });
      if (!user) throw new AppError(404, 'User not found');

      await redis.srem('suspended:users', userId);

      await AuditLog.create({
        actorId: new Types.ObjectId(req.user!.id),
        action: 'UNSUSPEND_USER',
        targetType: 'user',
        targetId: userId
      });

      res.json({ message: 'User unsuspended successfully', user });
    } catch (err) {
      next(err);
    }
  }

  static async manageCohort(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, name, description, isActive } = req.body;
      const cohort = await Cohort.findOneAndUpdate(
        { code: code.toLowerCase().trim() },
        { code: code.toLowerCase().trim(), name, description, isActive: isActive ?? true },
        { upsert: true, new: true }
      );

      res.json({ cohort });
    } catch (err) {
      next(err);
    }
  }
}
