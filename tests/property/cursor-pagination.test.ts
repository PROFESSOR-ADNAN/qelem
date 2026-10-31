import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { encodeCursor, decodeCursor } from '../../packages/shared/src/cursors.js';

interface Item {
  id: string;
  score: number;
}

function paginate(items: Item[], cursorScore: number | null, cursorId: string | null, limit: number): { items: Item[]; nextCursorPayload: { score: number; id: string } | null } {
  // Filter items strictly older than cursor
  const filtered = items.filter(item => {
    if (cursorScore === null) return true;
    if (item.score < cursorScore) return true;
    if (item.score === cursorScore && cursorId !== null && item.id < cursorId) return true;
    return false;
  });

  const page = filtered.slice(0, limit);
  let nextCursorPayload: { score: number; id: string } | null = null;

  if (page.length > 0 && filtered.length > limit) {
    const lastItem = page[page.length - 1];
    nextCursorPayload = { score: lastItem.score, id: lastItem.id };
  }

  return { items: page, nextCursorPayload };
}

describe('Cursor Keyset Pagination Property Tests (fast-check)', () => {
  const secret = 'cursor-test-secret-at-least-32-chars-long-123456';

  it('walking paginated pages yields zero duplicate items and zero skipped items', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            score: fc.integer({ min: 1000, max: 999999 })
          }),
          { minLength: 20, maxLength: 100 }
        ),
        (rawItems) => {
          // Sort dataset newest first by (score desc, id desc)
          const allItems = [...rawItems].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.id.localeCompare(a.id);
          });

          // De-duplicate any identical items
          const uniqueItems: Item[] = [];
          const seen = new Set<string>();
          for (const item of allItems) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              uniqueItems.push(item);
            }
          }

          const pageSize = 10;
          const collectedItems: Item[] = [];
          let currentScore: number | null = null;
          let currentId: string | null = null;

          while (true) {
            const result = paginate(uniqueItems, currentScore, currentId, pageSize);
            collectedItems.push(...result.items);

            if (!result.nextCursorPayload) {
              break;
            }

            // Encode and decode cursor to prove roundtrip
            const encoded = encodeCursor(
              {
                v: 1,
                kind: 'home',
                score: result.nextCursorPayload.score,
                id: result.nextCursorPayload.id,
                ts: Date.now()
              },
              secret
            );

            const decoded = decodeCursor(encoded, secret);
            currentScore = decoded.score;
            currentId = decoded.id;
          }

          // Assert zero duplicates
          const collectedIds = collectedItems.map(i => i.id);
          const collectedSet = new Set(collectedIds);
          expect(collectedIds.length).toBe(collectedSet.size);

          // Assert all items collected with no skipped items
          expect(collectedIds).toEqual(uniqueItems.map(i => i.id));
        }
      ),
      { numRuns: 100 }
    );
  });
});
