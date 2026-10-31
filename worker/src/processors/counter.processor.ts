import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { Post } from '../../../server/src/models/Post.js';
import { Like } from '../../../server/src/models/Like.js';
import { Comment } from '../../../server/src/models/Comment.js';
import { Bookmark } from '../../../server/src/models/Bookmark.js';
import { redis } from '../../../server/src/config/redis.js';
import { logger } from '../../../server/src/utils/logger.js';

/**
 * 5-second interval flush of absolute in-memory Redis counters to MongoDB.
 */
export async function processCounterFlushJob(_job: Job): Promise<void> {
  // Pop up to 500 dirty post IDs
  const dirtyIds = await redis.spop('dirty:counts', 500);
  if (!dirtyIds || dirtyIds.length === 0) return;

  const bulkOps: any[] = [];

  for (const postId of dirtyIds) {
    const counts = await redis.hgetall(`counts:${postId}`);
    if (counts && Object.keys(counts).length > 0) {
      const setPayload: Record<string, number> = {};
      if (counts.likeCount !== undefined) setPayload.likeCount = Math.max(0, parseInt(counts.likeCount, 10));
      if (counts.commentCount !== undefined) setPayload.commentCount = Math.max(0, parseInt(counts.commentCount, 10));
      if (counts.bookmarkCount !== undefined) setPayload.bookmarkCount = Math.max(0, parseInt(counts.bookmarkCount, 10));

      bulkOps.push({
        updateOne: {
          filter: { _id: new Types.ObjectId(postId) },
          update: { $set: setPayload }
        }
      });
    }
  }

  if (bulkOps.length > 0) {
    await Post.bulkWrite(bulkOps, { ordered: false });
    logger.debug({ msg: 'Flushed absolute counter values to MongoDB', count: bulkOps.length });
  }
}

/**
 * Hourly / Nightly exact reconciliation job.
 */
export async function processCounterReconciliationJob(job: Job<{ fullAudit?: boolean }>): Promise<{ audited: number; drifted: number }> {
  const isFullAudit = job.data?.fullAudit || false;
  let audited = 0;
  let drifted = 0;

  const query: Record<string, unknown> = { state: { $ne: 'deleted' } };
  if (!isFullAudit) {
    // Audit posts touched in last 48 hours
    query.updatedAt = { $gt: new Date(Date.now() - 48 * 60 * 60 * 1000) };
  } else {
    // Full audit: posts with > 1,000 likes or sample
    query.$or = [{ likeCount: { $gte: 1000 } }, { _id: { $exists: true } }];
  }

  const posts = await Post.find(query).select('_id likeCount commentCount bookmarkCount').limit(5000).lean();

  for (const post of posts) {
    audited++;
    const [trueLikes, trueComments, trueBookmarks] = await Promise.all([
      Like.countDocuments({ postId: post._id }),
      Comment.countDocuments({ postId: post._id, state: 'published' }),
      Bookmark.countDocuments({ postId: post._id })
    ]);

    const hasDrift =
      post.likeCount !== trueLikes ||
      post.commentCount !== trueComments ||
      post.bookmarkCount !== trueBookmarks;

    if (hasDrift) {
      drifted++;
      logger.warn({
        msg: 'Counter drift detected during reconciliation',
        postId: post._id,
        stored: { likes: post.likeCount, comments: post.commentCount, bookmarks: post.bookmarkCount },
        actual: { likes: trueLikes, comments: trueComments, bookmarks: trueBookmarks }
      });

      // Correct MongoDB
      await Post.updateOne(
        { _id: post._id },
        {
          $set: {
            likeCount: trueLikes,
            commentCount: trueComments,
            bookmarkCount: trueBookmarks
          }
        }
      );

      // Correct Redis
      await redis.hset(
        `counts:${post._id}`,
        'likeCount', trueLikes,
        'commentCount', trueComments,
        'bookmarkCount', trueBookmarks
      );
    }
  }

  logger.info({ msg: 'Counter reconciliation audit completed', audited, drifted });
  return { audited, drifted };
}
