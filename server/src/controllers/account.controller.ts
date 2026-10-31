import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { Comment } from '../models/Comment.js';
import { Like } from '../models/Like.js';
import { Follow } from '../models/Follow.js';
import { AuthService } from '../services/auth.service.js';
import { AppError } from '../middleware/error.js';
import { AuditLog } from '../models/AuditLog.js';

export class AccountController {
  static async exportData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userObjId = new Types.ObjectId(req.user!.id);

      const [user, posts, comments, likes, follows] = await Promise.all([
        User.findById(userObjId).lean(),
        Post.find({ authorId: userObjId }).lean(),
        Comment.find({ authorId: userObjId }).lean(),
        Like.find({ userId: userObjId }).lean(),
        Follow.find({ followerId: userObjId }).lean()
      ]);

      if (!user) throw new AppError(404, 'User not found');

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        profile: {
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          bio: user.bio,
          cohortId: user.cohortId,
          createdAt: user.createdAt
        },
        posts: posts.map(p => ({
          text: p.text,
          code: p.code,
          tags: p.tags,
          createdAt: p.createdAt,
          likeCount: p.likeCount,
          commentCount: p.commentCount
        })),
        comments: comments.map(c => ({
          text: c.text,
          postId: c.postId,
          createdAt: c.createdAt
        })),
        likedPostIds: likes.map(l => l.postId),
        followingUserIds: follows.map(f => f.followeeId)
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="qelem-export-${user.username}.json"`);
      res.json(exportPayload);
    } catch (err) {
      next(err);
    }
  }

  static async requestDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findById(req.user!.id);
      if (!user) throw new AppError(404, 'User not found');

      user.state = 'pending_deletion';
      user.deletionRequestedAt = new Date();
      await user.save();

      // Revoke all refresh sessions
      await AuthService.revokeAllUserSessions(user._id);

      await AuditLog.create({
        actorId: user._id,
        action: 'REQUEST_ACCOUNT_DELETION',
        targetType: 'user',
        targetId: user._id.toString()
      });

      res.json({
        message: 'Account deletion requested. Your profile is now hidden. You have 30 days to log in and cancel before permanent purge.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async cancelDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findById(req.user!.id);
      if (!user) throw new AppError(404, 'User not found');

      user.state = 'active';
      user.deletionRequestedAt = null;
      await user.save();

      await AuditLog.create({
        actorId: user._id,
        action: 'CANCEL_ACCOUNT_DELETION',
        targetType: 'user',
        targetId: user._id.toString()
      });

      res.json({ message: 'Account deletion cancelled. Your account is active.' });
    } catch (err) {
      next(err);
    }
  }
}
