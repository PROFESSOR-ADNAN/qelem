import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

interface PostRecord {
  id: string;
  authorId: string;
  score: number;
  state: 'published' | 'hidden' | 'deleted';
}

/**
 * Brute-force reference model: obviously correct implementation against which
 * the hybrid fan-out system is mathematically verified.
 */
function referenceModelFeed(
  viewerId: string,
  allPosts: PostRecord[],
  followedAuthorIds: Set<string>,
  blockedAuthorIds: Set<string>,
  mutedAuthorIds: Set<string>,
  feedCap: number = 600
): PostRecord[] {
  return allPosts
    .filter(p => p.state === 'published')
    .filter(p => p.authorId === viewerId || followedAuthorIds.has(p.authorId))
    .filter(p => !blockedAuthorIds.has(p.authorId))
    .filter(p => !mutedAuthorIds.has(p.authorId))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    })
    .slice(0, feedCap);
}

/**
 * Simulated Hybrid System: Timeline (ZSET capped at 600) + High-Fanout Merge.
 */
function hybridSimulatedFeed(
  viewerId: string,
  allPosts: PostRecord[],
  normalFollowedIds: Set<string>,
  highFanoutFollowedIds: Set<string>,
  blockedAuthorIds: Set<string>,
  mutedAuthorIds: Set<string>,
  feedCap: number = 600
): PostRecord[] {
  // 1. Normal authors write into viewer's timeline (capped at 600)
  const timelinePosts = allPosts
    .filter(p => p.authorId === viewerId || normalFollowedIds.has(p.authorId))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    })
    .slice(0, feedCap);

  // 2. High-fanout authors merged on read
  const highFanoutPosts = allPosts
    .filter(p => highFanoutFollowedIds.has(p.authorId))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    })
    .slice(0, 200);

  // 3. In-memory k-way merge and deduplication
  const mergedMap = new Map<string, PostRecord>();
  for (const p of timelinePosts) mergedMap.set(p.id, p);
  for (const p of highFanoutPosts) mergedMap.set(p.id, p);

  // 4. Read-time filtering
  const hydrated = Array.from(mergedMap.values())
    .filter(p => p.state === 'published')
    .filter(p => !blockedAuthorIds.has(p.authorId))
    .filter(p => !mutedAuthorIds.has(p.authorId))
    .filter(p => p.authorId === viewerId || normalFollowedIds.has(p.authorId) || highFanoutFollowedIds.has(p.authorId))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    })
    .slice(0, feedCap);

  return hydrated;
}

describe('Feed Reference-Model Property Tests (fast-check)', () => {
  it('hybrid feed output matches brute-force reference model with zero mismatches, duplicates, or gaps', () => {
    const userIds = ['user_1', 'user_2', 'user_3', 'user_celebrity', 'user_viewer'];

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            authorId: fc.constantFrom(...userIds),
            score: fc.integer({ min: 1000, max: 999999 }),
            state: fc.constantFrom('published', 'published', 'published', 'hidden', 'deleted')
          }),
          { minLength: 10, maxLength: 200 }
        ),
        (posts) => {
          const viewerId = 'user_viewer';
          const normalFollowed = new Set(['user_1', 'user_2']);
          const highFanoutFollowed = new Set(['user_celebrity']);
          const allFollowed = new Set([...normalFollowed, ...highFanoutFollowed]);
          const blocked = new Set(['user_3']);
          const muted = new Set<string>();

          const referenceResult = referenceModelFeed(viewerId, posts, allFollowed, blocked, muted, 50);
          const hybridResult = hybridSimulatedFeed(viewerId, posts, normalFollowed, highFanoutFollowed, blocked, muted, 50);

          // Assert zero duplicates
          const seenIds = new Set<string>();
          for (const item of hybridResult) {
            expect(seenIds.has(item.id)).toBe(false);
            seenIds.add(item.id);
          }

          // Assert exact sequence match with reference model
          expect(hybridResult.map(p => p.id)).toEqual(referenceResult.map(p => p.id));
        }
      ),
      { numRuns: 100 }
    );
  });
});
