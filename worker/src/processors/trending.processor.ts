import { Job } from 'bullmq';
import { Post } from '../../../server/src/models/Post.js';
import { redis } from '../../../server/src/config/redis.js';
import { logger } from '../../../server/src/utils/logger.js';

export async function processTrendingJob(_job: Job): Promise<void> {
  const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

  const candidates = await Post.find({
    state: 'published',
    publishedAt: { $gte: windowStart }
  })
    .select('_id authorId likeCount commentCount bookmarkCount publishedAt createdAt')
    .lean();

  if (!candidates.length) return;

  const nowMs = Date.now();
  const scoredPosts: { id: string; authorId: string; score: number }[] = [];

  for (const post of candidates) {
    const publishedAtMs = (post.publishedAt || post.createdAt).getTime();
    const ageHours = Math.max(0, (nowMs - publishedAtMs) / (1000 * 60 * 60));

    // Engagement decay formula: (likes + 2*comments + 0.5*bookmarks) / (ageHours + 2)^1.5
    const engagement = post.likeCount + 2 * post.commentCount + 0.5 * post.bookmarkCount;
    const score = engagement / Math.pow(ageHours + 2, 1.5);

    scoredPosts.push({
      id: post._id.toString(),
      authorId: post.authorId.toString(),
      score
    });
  }

  // Sort by score descending
  scoredPosts.sort((a, b) => b.score - a.score);

  // Author diversity guard: at most 2 posts per author in top 50
  const authorPostCount = new Map<string, number>();
  const topTrendingIds: string[] = [];

  for (const item of scoredPosts) {
    const currentCount = authorPostCount.get(item.authorId) || 0;
    if (currentCount < 2) {
      topTrendingIds.push(item.id);
      authorPostCount.set(item.authorId, currentCount + 1);
    }
    if (topTrendingIds.length >= 50) break;
  }

  // Write versioned snapshot to Redis
  const version = Date.now().toString();
  const snapshotKey = `trending:global:${version}`;

  if (topTrendingIds.length > 0) {
    await redis.rpush(snapshotKey, ...topTrendingIds);
    await redis.expire(snapshotKey, 1800); // 30-minute snapshot TTL
    await redis.set('trending:global:latest', version);

    logger.info({ msg: 'Updated global trending snapshot', count: topTrendingIds.length, version });
  }
}
