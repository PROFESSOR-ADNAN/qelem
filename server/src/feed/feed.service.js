import { Types } from 'mongoose';
import { Post } from '../models/Post.js';
import { Follow } from '../models/Follow.js';
import { Like } from '../models/Like.js';
import { Bookmark } from '../models/Bookmark.js';
import { Block } from '../models/Block.js';
import { Mute } from '../models/Mute.js';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { encodeCursor, decodeCursor, SYSTEM_LIMITS } from '@qelem/shared';
import { rebuildQueue } from '../services/queue.service.js';
export class FeedService {
    /**
     * Refreshes active:{userId} key with 14-day TTL at most once per hour.
     */
    static async touchActive(userId) {
        const key = `active:${userId}`;
        const exists = await redis.exists(key);
        if (!exists) {
            await redis.set(key, '1', 'EX', SYSTEM_LIMITS.ACTIVE_WINDOW_DAYS * 24 * 60 * 60);
        }
    }
    /**
     * Reads the home feed for a user, using hybrid fan-out merge and batched hydration.
     */
    static async getHomeFeed(userId, cursorStr, limit = SYSTEM_LIMITS.FEED_PAGE_DEFAULT_LIMIT) {
        await this.touchActive(userId);
        const timelineKey = `feed:${userId}`;
        const exists = await redis.exists(timelineKey);
        if (!exists) {
            // Timeline missing in Redis (cold start or Redis wipe): trigger rebuild or degraded path
            const rebuildSuccess = await this.tryColdStartRebuild(userId);
            if (!rebuildSuccess) {
                return this.getDegradedFeed(userId, limit);
            }
        }
        let cursorScore = Infinity;
        let cursorId = null;
        if (cursorStr) {
            try {
                const decoded = decodeCursor(cursorStr, env.CURSOR_SIGNING_SECRET, env.CURSOR_SIGNING_SECRET_OLD);
                cursorScore = decoded.score;
                cursorId = decoded.id;
            }
            catch (err) {
                logger.warn({ msg: 'Invalid cursor provided to home feed', error: err });
            }
        }
        // Safety margin to account for read-time filtering
        const safetyMargin = 15;
        const fetchCount = limit + safetyMargin;
        let items = [];
        let lastExaminedEntry = null;
        let refillRound = 0;
        let currentScoreWindow = cursorScore;
        let currentTieBreakerId = cursorId;
        while (items.length < limit && refillRound <= SYSTEM_LIMITS.FEED_REFILL_MAX_ROUNDS) {
            refillRound++;
            // 1. Fetch entries from user's Redis timeline
            const timelineEntries = [];
            const rawTimeline = await redis.zrevrangebyscore(timelineKey, currentScoreWindow === Infinity ? '+inf' : currentScoreWindow, '-inf', 'WITHSCORES', 'LIMIT', 0, fetchCount);
            for (let i = 0; i < rawTimeline.length; i += 2) {
                const postId = rawTimeline[i];
                const score = parseFloat(rawTimeline[i + 1]);
                // Apply cursor tie-breaking
                if (score === currentScoreWindow && currentTieBreakerId && postId >= currentTieBreakerId) {
                    continue;
                }
                timelineEntries.push({ postId, score });
            }
            // 2. Fetch high-fanout authors followed by this user
            const hfAuthors = await redis.smembers(`following_hf:${userId}`);
            const hfEntries = [];
            if (hfAuthors.length > 0) {
                const hfPipeline = redis.pipeline();
                for (const authorId of hfAuthors.slice(0, 100)) {
                    hfPipeline.zrevrangebyscore(`author:${authorId}:recent`, currentScoreWindow === Infinity ? '+inf' : currentScoreWindow, '-inf', 'WITHSCORES', 'LIMIT', 0, fetchCount);
                }
                const hfResults = await hfPipeline.exec();
                if (hfResults) {
                    for (const res of hfResults) {
                        if (res && res[1]) {
                            const list = res[1];
                            for (let i = 0; i < list.length; i += 2) {
                                const postId = list[i];
                                const score = parseFloat(list[i + 1]);
                                if (score === currentScoreWindow && currentTieBreakerId && postId >= currentTieBreakerId) {
                                    continue;
                                }
                                hfEntries.push({ postId, score });
                            }
                        }
                    }
                }
            }
            // 3. In-memory k-way merge and deduplication
            const candidateMap = new Map();
            for (const e of timelineEntries)
                candidateMap.set(e.postId, e);
            for (const e of hfEntries)
                candidateMap.set(e.postId, e);
            const mergedCandidates = Array.from(candidateMap.values()).sort((a, b) => {
                if (b.score !== a.score)
                    return b.score - a.score;
                return b.postId.localeCompare(a.postId);
            });
            if (mergedCandidates.length === 0) {
                break; // No more items available
            }
            const batchToProcess = mergedCandidates.slice(0, fetchCount);
            lastExaminedEntry = batchToProcess[batchToProcess.length - 1];
            // 4. Batched Hydration (Fixed-query budget independent of limit)
            const hydratedBatch = await this.hydratePosts(batchToProcess.map(c => c.postId), userId);
            items.push(...hydratedBatch);
            if (items.length >= limit || batchToProcess.length < fetchCount) {
                break;
            }
            // Set up next refill window
            currentScoreWindow = lastExaminedEntry.score;
            currentTieBreakerId = lastExaminedEntry.postId;
        }
        const finalItems = items.slice(0, limit);
        let nextCursor = null;
        let endReason;
        if (lastExaminedEntry && items.length >= limit) {
            nextCursor = encodeCursor({
                v: 1,
                kind: 'home',
                score: lastExaminedEntry.score,
                id: lastExaminedEntry.postId,
                ts: Date.now()
            }, env.CURSOR_SIGNING_SECRET);
        }
        else {
            endReason = 'end_of_results';
        }
        return {
            items: finalItems,
            nextCursor,
            endReason
        };
    }
    /**
     * Batched post hydration pipeline with strictly bounded database queries.
     */
    static async hydratePosts(postIds, viewerId) {
        if (!postIds.length)
            return [];
        const userObjId = new Types.ObjectId(viewerId);
        // 1. Post cache lookup (MGET)
        const pipeline = redis.pipeline();
        for (const pId of postIds) {
            pipeline.get(`post:${pId}`);
        }
        const cacheResults = await pipeline.exec();
        const postsMap = new Map();
        const missingPostIds = [];
        if (cacheResults) {
            for (let i = 0; i < postIds.length; i++) {
                const res = cacheResults[i];
                if (res && res[1]) {
                    try {
                        postsMap.set(postIds[i], JSON.parse(res[1]));
                    }
                    catch {
                        missingPostIds.push(new Types.ObjectId(postIds[i]));
                    }
                }
                else {
                    missingPostIds.push(new Types.ObjectId(postIds[i]));
                }
            }
        }
        // 2. Query missing posts in ONE MongoDB query
        if (missingPostIds.length > 0) {
            const fetchedPosts = await Post.find({
                _id: { $in: missingPostIds },
                state: 'published'
            })
                .populate('authorId', 'username displayName avatarMediaId cohortId state')
                .populate('mediaIds')
                .lean();
            for (const p of fetchedPosts) {
                const pIdStr = p._id.toString();
                postsMap.set(pIdStr, p);
                // Cache post JSON for 5 minutes
                await redis.setex(`post:${pIdStr}`, 300, JSON.stringify(p));
            }
        }
        const validPosts = postIds.map(id => postsMap.get(id)).filter(Boolean);
        if (!validPosts.length)
            return [];
        const authorIds = Array.from(new Set(validPosts.map(p => (p.authorId._id || p.authorId).toString()))).map(id => new Types.ObjectId(id));
        // 3. Batch fetch viewer relationship state (Blocks, Mutes, Follows)
        const [blocks, mutes, followedDocs, viewerLikes, viewerBookmarks] = await Promise.all([
            Block.find({
                $or: [
                    { blockerId: userObjId, blockedId: { $in: authorIds } },
                    { blockerId: { $in: authorIds }, blockedId: userObjId }
                ]
            }).select('blockerId blockedId').lean(),
            Mute.find({ muterId: userObjId, mutedId: { $in: authorIds } }).select('mutedId').lean(),
            Follow.find({ followerId: userObjId, followeeId: { $in: authorIds } }).select('followeeId').lean(),
            Like.find({ userId: userObjId, postId: { $in: validPosts.map(p => p._id) } }).select('postId').lean(),
            Bookmark.find({ userId: userObjId, postId: { $in: validPosts.map(p => p._id) } }).select('postId').lean()
        ]);
        const blockedSet = new Set(blocks.map(b => (b.blockerId.toString() === viewerId ? b.blockedId.toString() : b.blockerId.toString())));
        const mutedSet = new Set(mutes.map(m => m.mutedId.toString()));
        const followedSet = new Set(followedDocs.map(f => f.followeeId.toString()));
        const likedSet = new Set(viewerLikes.map(l => l.postId.toString()));
        const bookmarkedSet = new Set(viewerBookmarks.map(b => b.postId.toString()));
        // 4. Filter and assemble final hydrated objects
        const results = [];
        for (const post of validPosts) {
            const author = post.authorId;
            const authorIdStr = (author._id || author).toString();
            // Read-time filtering:
            if (post.state !== 'published')
                continue;
            if (author.state === 'suspended' || author.state === 'pending_deletion')
                continue;
            if (blockedSet.has(authorIdStr))
                continue;
            if (mutedSet.has(authorIdStr))
                continue;
            // Must be self or followed
            if (authorIdStr !== viewerId && !followedSet.has(authorIdStr))
                continue;
            results.push({
                post,
                viewerState: {
                    liked: likedSet.has(post._id.toString()),
                    bookmarked: bookmarkedSet.has(post._id.toString())
                }
            });
        }
        return results;
    }
    /**
     * Cold start timeline rebuild with single-flight stampede control.
     */
    static async tryColdStartRebuild(userId) {
        const lockKey = `lock:feed_rebuild:${userId}`;
        const acquired = await redis.set(lockKey, '1', 'PX', 5000, 'NX');
        if (!acquired) {
            // Another worker/thread is currently rebuilding; wait up to 300ms
            await new Promise(resolve => setTimeout(resolve, 300));
            return await redis.exists(`feed:${userId}`) === 1;
        }
        try {
            // Check global rebuild concurrency
            const currentGlobal = await redis.incr('metric:active_feed_rebuilds');
            if (currentGlobal > 20) {
                await redis.decr('metric:active_feed_rebuilds');
                return false; // Exceeded concurrency limit, trigger degraded path
            }
            await this.executeRebuild(userId);
            await redis.decr('metric:active_feed_rebuilds');
            return true;
        }
        catch (err) {
            logger.error({ msg: 'Cold start feed rebuild failed', userId, error: err });
            return false;
        }
        finally {
            await redis.del(lockKey);
        }
    }
    /**
     * Executes the full timeline reconstruction from MongoDB.
     */
    static async executeRebuild(userId) {
        const userObjId = new Types.ObjectId(userId);
        // Read followed users (cap at 500 newest followed)
        const follows = await Follow.find({ followerId: userObjId })
            .sort({ _id: -1 })
            .limit(500)
            .populate('followeeId', 'fanoutMode')
            .lean();
        if (!follows.length) {
            // User follows nobody: initialize empty timeline with 30-day TTL
            await redis.zadd(`feed:${userId}`, Date.now(), 'feed_init_placeholder');
            await redis.zrem(`feed:${userId}`, 'feed_init_placeholder');
            await redis.expire(`feed:${userId}`, SYSTEM_LIMITS.USER_TIMELINE_TTL_DAYS * 24 * 60 * 60);
            return;
        }
        const normalFolloweeIds = [];
        const hfFolloweeIds = [];
        for (const f of follows) {
            const followee = f.followeeId;
            if (followee.fanoutMode === 'high_fanout') {
                hfFolloweeIds.push(followee._id.toString());
            }
            else {
                normalFolloweeIds.push(followee._id);
            }
        }
        // Populate following_hf:{userId}
        if (hfFolloweeIds.length > 0) {
            await redis.del(`following_hf:${userId}`);
            await redis.sadd(`following_hf:${userId}`, ...hfFolloweeIds);
        }
        // Read latest published posts for normal followees from MongoDB
        const recentPosts = await Post.find({
            authorId: { $in: normalFolloweeIds },
            state: 'published'
        })
            .sort({ publishedAt: -1, _id: -1 })
            .limit(SYSTEM_LIMITS.FEED_MAX_ENTRIES)
            .select('_id publishedAt createdAt')
            .lean();
        if (recentPosts.length > 0) {
            const timelinePipeline = redis.pipeline();
            for (const p of recentPosts) {
                const score = (p.publishedAt || p.createdAt).getTime();
                timelinePipeline.zadd(`feed:${userId}`, score, p._id.toString());
            }
            timelinePipeline.expire(`feed:${userId}`, SYSTEM_LIMITS.USER_TIMELINE_TTL_DAYS * 24 * 60 * 60);
            await timelinePipeline.exec();
        }
    }
    /**
     * Degraded path: bounded MongoDB query to protect DB during cache wipes.
     */
    static async getDegradedFeed(userId, limit) {
        const userObjId = new Types.ObjectId(userId);
        const follows = await Follow.find({ followerId: userObjId })
            .sort({ _id: -1 })
            .limit(200)
            .select('followeeId')
            .lean();
        const followeeIds = follows.map(f => f.followeeId);
        const posts = await Post.find({
            authorId: { $in: followeeIds },
            state: 'published'
        })
            .sort({ publishedAt: -1, _id: -1 })
            .limit(limit)
            .populate('authorId', 'username displayName avatarMediaId cohortId')
            .populate('mediaIds')
            .lean();
        // Enqueue background rebuild so next request hits cache
        await rebuildQueue.add('rebuild-feed', { userId }, { attempts: 2 });
        return {
            items: posts.map(p => ({ post: p, viewerState: { liked: false, bookmarked: false } })),
            nextCursor: null,
            degraded: true
        };
    }
    /**
     * New-posts indicator: counts posts newer than score (cap 99).
     */
    static async getNewCount(userId, afterScore) {
        const timelineKey = `feed:${userId}`;
        const count = await redis.zcount(timelineKey, `(${afterScore}`, '+inf');
        return Math.min(count, 99);
    }
}
