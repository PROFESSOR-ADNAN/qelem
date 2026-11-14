import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { Post, IPost } from '../models/Post.js';
import { User } from '../models/User.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { Tag } from '../models/Tag.js';
import { Block } from '../models/Block.js';
import { redis } from '../config/redis.js';
import { AppError } from '../middleware/error.js';
import { CreatePostSchema, EditPostSchema, SYSTEM_LIMITS } from '@qelem/shared';
import { fanoutQueue, notificationsQueue } from './queue.service.js';

export class PostService {
  static computeContentHash(authorId: string, text: string, codeBody?: string): string {
    const raw = `${authorId}:${text.trim().normalize('NFKC')}:${(codeBody || '').trim()}`;
    return createHash('sha256').update(raw).digest('hex');
  }

  static normalizeTag(tag: string): string {
    return tag
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 30);
  }

  static async resolveMentions(authorObjId: Types.ObjectId, usernames: string[]): Promise<Types.ObjectId[]> {
    if (!usernames.length) return [];
    const normalized = usernames.map(u => u.toLowerCase().trim()).slice(0, 5);

    const users = await User.find({
      usernameLower: { $in: normalized },
      state: 'active'
    }).select('_id');

    if (!users.length) return [];

    const foundIds = users.map(u => u._id);

    // Filter out users who block the author
    const blocks = await Block.find({
      blockerId: { $in: foundIds },
      blockedId: authorObjId
    }).select('blockerId');

    const blockedSet = new Set(blocks.map(b => b.blockerId.toString()));
    return foundIds.filter(id => !blockedSet.has(id.toString()));
  }

  static async createPost(authorId: string, body: unknown): Promise<IPost> {
    const input = CreatePostSchema.parse(body);
    const authorObjId = new Types.ObjectId(authorId);

    // Check author state
    const author = await User.findById(authorObjId);
    if (!author || author.state !== 'active') {
      throw new AppError(403, 'Account is not active or does not exist');
    }

    // 1. Idempotency Check on (authorId, clientPostId)
    const existing = await Post.findOne({
      authorId: authorObjId,
      clientPostId: input.clientPostId
    });

    if (existing) {
      return existing; // Return existing post without re-executing
    }

    // 2. Duplicate Content Spam Check (same author & content within last 24h)
    const contentHash = this.computeContentHash(authorId, input.text, input.code?.body);
    const recentDuplicate = await Post.findOne({
      authorId: authorObjId,
      contentHash,
      createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      state: { $ne: 'deleted' }
    });

    if (recentDuplicate) {
      throw new AppError(409, 'Duplicate post detected: you submitted identical content within the last 24 hours.', 'https://qelem.et/errors/duplicate-post');
    }

    // 3. Normalize Tags
    const normalizedTags = Array.from(
      new Set(input.tags.map(t => this.normalizeTag(t)).filter(t => t.length >= 2))
    ).slice(0, SYSTEM_LIMITS.POST_MAX_TAGS);

    // 4. Resolve Mentions
    const mentionIds = await this.resolveMentions(authorObjId, input.mentions);

    // 5. Validate Media Ownership (if any)
    const mediaObjIds = input.mediaIds.map(id => new Types.ObjectId(id));
    if (mediaObjIds.length > 0) {
      const ownedMedia = await MediaAsset.find({
        _id: { $in: mediaObjIds },
        ownerId: authorObjId
      });

      if (ownedMedia.length !== mediaObjIds.length) {
        throw new AppError(404, 'One or more attached media assets were not found or do not belong to you');
      }

      // Check if all media are already ready
      const allReady = ownedMedia.every(m => m.state === 'ready');
      const initialState = allReady ? 'published' : 'processing';

      const post = await Post.create({
        authorId: authorObjId,
        clientPostId: input.clientPostId,
        text: input.text,
        code: input.code,
        mediaIds: mediaObjIds,
        tags: normalizedTags,
        mentions: mentionIds,
        state: initialState,
        authorCohortId: author.cohortId || null,
        contentHash,
        publishedAt: allReady ? new Date() : undefined
      });

      // Link post to media assets
      await MediaAsset.updateMany(
        { _id: { $in: mediaObjIds } },
        { $set: { attachedPostId: post._id } }
      );

      if (allReady) {
        await this.publishPost(post._id.toString());
      }

      return post;
    }

    // Direct publish for text-only / code-only posts
    const post = await Post.create({
      authorId: authorObjId,
      clientPostId: input.clientPostId,
      text: input.text,
      code: input.code,
      mediaIds: [],
      tags: normalizedTags,
      mentions: mentionIds,
      state: 'published',
      authorCohortId: author.cohortId || null,
      contentHash,
      publishedAt: new Date()
    });

    await this.publishPost(post._id.toString());
    return post;
  }

  static async publishPost(postId: string): Promise<void> {
    const postObjId = new Types.ObjectId(postId);
    const post = await Post.findById(postObjId);
    if (!post || post.state === 'deleted' || post.state === 'failed') return;

    const publishedAt = post.publishedAt || new Date();
    post.state = 'published';
    post.publishedAt = publishedAt;
    await post.save();

    const publishedAtMs = publishedAt.getTime();
    const authorIdStr = post.authorId.toString();

    // 1. Add to author recent posts cache in Redis (latest 200)
    await redis.zadd(`author:${authorIdStr}:recent`, publishedAtMs, postId);
    await redis.zremrangebyrank(`author:${authorIdStr}:recent`, 0, -201);

    // 2. Increment author's post count
    await User.findByIdAndUpdate(post.authorId, { $inc: { postsCount: 1 } });

    // 3. Update tag usage counts asynchronously
    if (post.tags && post.tags.length > 0) {
      for (const tagName of post.tags) {
        await Tag.findOneAndUpdate(
          { name: tagName },
          { $inc: { postCount: 1 }, $set: { lastUsedAt: new Date() } },
          { upsert: true }
        );
      }
    }

    // 4. Enqueue BullMQ fan-out job
    await fanoutQueue.add(
      'fanout-post',
      { postId, authorId: authorIdStr, publishedAtMs },
      { jobId: `fanout:${postId}`, attempts: 5, backoff: { type: 'exponential', delay: 1000 } }
    );

    // Invalidate cached explore feed
    await redis.del('cache:feed:explore:default');

    // 5. Enqueue mention notifications (if any)
    if (post.mentions && post.mentions.length > 0) {
      for (const mentionedUserId of post.mentions) {
        await notificationsQueue.add('mention', {
          recipientId: mentionedUserId.toString(),
          actorId: authorIdStr,
          type: 'mention',
          targetType: 'post',
          targetId: postId
        });
      }
    }
  }

  static async editPost(postId: string, userId: string, body: unknown): Promise<IPost> {
    const input = EditPostSchema.parse(body);
    const postObjId = new Types.ObjectId(postId);
    const post = await Post.findById(postObjId);

    if (!post || post.state === 'deleted') {
      throw new AppError(404, 'Post not found');
    }

    if (post.authorId.toString() !== userId) {
      throw new AppError(403, 'You do not have permission to edit this post');
    }

    // 30-minute edit window check
    if (post.publishedAt) {
      const elapsedMinutes = (Date.now() - post.publishedAt.getTime()) / (60 * 1000);
      if (elapsedMinutes > SYSTEM_LIMITS.POST_EDIT_WINDOW_MINUTES) {
        throw new AppError(400, 'The 30-minute edit window for this post has expired');
      }
    }

    post.text = input.text;
    if (input.code) post.code = input.code;
    if (input.tags) {
      post.tags = Array.from(
        new Set(input.tags.map(t => this.normalizeTag(t)).filter(t => t.length >= 2))
      ).slice(0, SYSTEM_LIMITS.POST_MAX_TAGS);
    }
    post.editedAt = new Date();
    await post.save();

    // Evict cached post JSON in Redis
    await redis.del(`post:${postId}`);

    return post;
  }

  static async deletePost(postId: string, userId: string, userRole: string): Promise<void> {
    const postObjId = new Types.ObjectId(postId);
    const post = await Post.findById(postObjId);

    if (!post || post.state === 'deleted') {
      throw new AppError(404, 'Post not found');
    }

    const isAuthor = post.authorId.toString() === userId;
    const isStaff = userRole === 'moderator' || userRole === 'admin';

    if (!isAuthor && !isStaff) {
      throw new AppError(403, 'You do not have permission to delete this post');
    }

    // Soft delete
    post.state = 'deleted';
    post.deletedAt = new Date();
    await post.save();

    // Decrement author's postsCount
    await User.findByIdAndUpdate(post.authorId, { $inc: { postsCount: -1 } });

    // Evict Redis caches
    await redis.del(`post:${postId}`);
    await redis.zrem(`author:${post.authorId}:recent`, postId);
  }
}
