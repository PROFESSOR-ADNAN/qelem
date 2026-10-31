import { Job } from 'bullmq';
import { Types } from 'mongoose';
import { User } from '../../../server/src/models/User.js';
import { Follow } from '../../../server/src/models/Follow.js';
import { redis } from '../../../server/src/config/redis.js';
import { logger } from '../../../server/src/utils/logger.js';
import { SYSTEM_LIMITS } from '@qelem/shared';

export interface FanoutJobData {
  postId: string;
  authorId: string;
  publishedAtMs: number;
  lastFollowerId?: string;
}

export async function processFanoutJob(job: Job<FanoutJobData>): Promise<void> {
  const { postId, authorId, publishedAtMs } = job.data;
  let lastFollowerId = job.data.lastFollowerId;

  const authorObjId = new Types.ObjectId(authorId);
  const author = await User.findById(authorObjId).select('fanoutMode followersCount');
  if (!author) return;

  // Write to author's own timeline first
  await redis.zadd(`feed:${authorId}`, publishedAtMs, postId);
  await redis.zremrangebyrank(`feed:${authorId}`, 0, -(SYSTEM_LIMITS.FEED_MAX_ENTRIES + 1));

  // If author has >= 2,000 followers, do not fan out to followers (High-fanout reads merge on-demand)
  if (author.fanoutMode === 'high_fanout') {
    logger.info({ msg: 'Skipping write fan-out for high-fanout author', authorId, postId });
    return;
  }

  const chunkSize = SYSTEM_LIMITS.FANOUT_CHUNK; // 1,000 followers per chunk

  while (true) {
    const query: Record<string, unknown> = { followeeId: authorObjId };
    if (lastFollowerId) {
      query._id = { $gt: new Types.ObjectId(lastFollowerId) };
    }

    // Keyset pagination using Index A: (followeeId, _id)
    const follows = await Follow.find(query)
      .sort({ _id: 1 })
      .limit(chunkSize)
      .select('followerId _id')
      .lean();

    if (!follows.length) break;

    const followerIds = follows.map(f => f.followerId.toString());

    // 1. Pipeline check active:{followerId} to skip inactive followers (> 14 days inactive)
    const activePipeline = redis.pipeline();
    for (const fId of followerIds) {
      activePipeline.exists(`active:${fId}`);
    }
    const activeResults = await activePipeline.exec();

    // 2. Pipeline timeline writes for active followers
    const fanoutPipeline = redis.pipeline();
    let activeCount = 0;

    for (let i = 0; i < followerIds.length; i++) {
      const fId = followerIds[i];
      const isActive = activeResults && activeResults[i] && activeResults[i][1] === 1;

      if (isActive) {
        activeCount++;
        // Write to follower timeline and trim to newest 600
        fanoutPipeline.zadd(`feed:${fId}`, publishedAtMs, postId);
        fanoutPipeline.zremrangebyrank(`feed:${fId}`, 0, -(SYSTEM_LIMITS.FEED_MAX_ENTRIES + 1));
      }
    }

    if (activeCount > 0) {
      await fanoutPipeline.exec();
    }

    lastFollowerId = follows[follows.length - 1]._id.toString();

    // Store progress cursor in job state so crashes resume at this exact chunk
    await job.updateData({
      postId,
      authorId,
      publishedAtMs,
      lastFollowerId
    });

    if (follows.length < chunkSize) break;
  }

  logger.info({ msg: 'Fan-out job completed successfully', postId, authorId });
}
