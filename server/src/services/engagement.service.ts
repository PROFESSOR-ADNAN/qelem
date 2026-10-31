import { Types } from 'mongoose';
import { Like } from '../models/Like.js';
import { Bookmark } from '../models/Bookmark.js';
import { Comment, IComment } from '../models/Comment.js';
import { Post } from '../models/Post.js';
import { redis } from '../config/redis.js';
import { AppError } from '../middleware/error.js';
import { CreateCommentSchema } from '@qelem/shared';
import { notificationsQueue } from './queue.service.js';

export class EngagementService {
  static async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const postObjId = new Types.ObjectId(postId);
    const userObjId = new Types.ObjectId(userId);

    const post = await Post.findById(postObjId);
    if (!post || post.state === 'deleted') {
      throw new AppError(404, 'Post not found');
    }

    const existing = await Like.findOne({ postId: postObjId, userId: userObjId });

    if (existing) {
      // Unlike
      await Like.deleteOne({ _id: existing._id });
      const current = await redis.hincrby(`counts:${postId}`, 'likeCount', -1);
      const safeCount = Math.max(0, current);
      if (current < 0) {
        await redis.hset(`counts:${postId}`, 'likeCount', 0);
      }
      await redis.sadd('dirty:counts', postId);
      return { liked: false, likeCount: safeCount };
    }

    try {
      // Like
      const likeDoc = await Like.create({ postId: postObjId, userId: userObjId, notified: false });
      const count = await redis.hincrby(`counts:${postId}`, 'likeCount', 1);
      await redis.sadd('dirty:counts', postId);

      // Dispatch notification only if not author and not already notified
      const authorIdStr = post.authorId.toString();
      if (authorIdStr !== userId && !likeDoc.notified) {
        await notificationsQueue.add('like', {
          recipientId: authorIdStr,
          actorId: userId,
          type: 'like',
          targetType: 'post',
          targetId: postId
        });
        likeDoc.notified = true;
        await likeDoc.save();
      }

      return { liked: true, likeCount: count };
    } catch (err: unknown) {
      // Idempotent duplicate check
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
        const val = await redis.hget(`counts:${postId}`, 'likeCount');
        return { liked: true, likeCount: parseInt(val || '1', 10) };
      }
      throw err;
    }
  }

  static async toggleBookmark(postId: string, userId: string): Promise<{ bookmarked: boolean }> {
    const postObjId = new Types.ObjectId(postId);
    const userObjId = new Types.ObjectId(userId);

    const existing = await Bookmark.findOne({ postId: postObjId, userId: userObjId });

    if (existing) {
      await Bookmark.deleteOne({ _id: existing._id });
      await redis.hincrby(`counts:${postId}`, 'bookmarkCount', -1);
      await redis.sadd('dirty:counts', postId);
      return { bookmarked: false };
    }

    try {
      await Bookmark.create({ postId: postObjId, userId: userObjId });
      await redis.hincrby(`counts:${postId}`, 'bookmarkCount', 1);
      await redis.sadd('dirty:counts', postId);
      return { bookmarked: true };
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
        return { bookmarked: true };
      }
      throw err;
    }
  }

  static async createComment(postId: string, authorId: string, body: unknown): Promise<IComment> {
    const input = CreateCommentSchema.parse(body);
    const postObjId = new Types.ObjectId(postId);
    const authorObjId = new Types.ObjectId(authorId);

    const post = await Post.findById(postObjId);
    if (!post || post.state === 'deleted') {
      throw new AppError(404, 'Post not found');
    }

    // Idempotency check with clientCommentId
    const existing = await Comment.findOne({
      authorId: authorObjId,
      clientCommentId: input.clientCommentId
    });

    if (existing) {
      return existing;
    }

    let parentObjId: Types.ObjectId | null = null;
    let parentAuthorId: string | null = null;

    if (input.parentId) {
      const parent = await Comment.findById(input.parentId);
      if (!parent || parent.state === 'deleted') {
        throw new AppError(404, 'Parent comment not found');
      }
      // Replies attach to top-level parent only (1-level nesting)
      parentObjId = parent.parentId ? parent.parentId : parent._id;
      parentAuthorId = parent.authorId.toString();
    }

    const comment = await Comment.create({
      postId: postObjId,
      authorId: authorObjId,
      parentId: parentObjId,
      clientCommentId: input.clientCommentId,
      text: input.text,
      state: 'published'
    });

    // Update live comment count in Redis
    await redis.hincrby(`counts:${postId}`, 'commentCount', 1);
    await redis.sadd('dirty:counts', postId);

    // Enqueue notification for post author (if not self)
    const postAuthorIdStr = post.authorId.toString();
    if (postAuthorIdStr !== authorId) {
      await notificationsQueue.add('comment', {
        recipientId: postAuthorIdStr,
        actorId: authorId,
        type: 'comment',
        targetType: 'post',
        targetId: postId
      });
    }

    // Enqueue reply notification for parent comment author (if reply and not self)
    if (parentAuthorId && parentAuthorId !== authorId && parentAuthorId !== postAuthorIdStr) {
      await notificationsQueue.add('reply', {
        recipientId: parentAuthorId,
        actorId: authorId,
        type: 'reply',
        targetType: 'comment',
        targetId: comment._id.toString()
      });
    }

    return comment;
  }
}
