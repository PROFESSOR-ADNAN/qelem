import Dexie, { type Table } from 'dexie';

export interface DraftPost {
  id?: number;
  text: string;
  code?: { lang: string; body: string };
  tags: string[];
  updatedAt: number;
}

export interface CachedFeedPost {
  id: string;
  post: any;
  viewerState: { liked: boolean; bookmarked: boolean };
  cachedAt: number;
}

export interface OutboxQueueItem {
  clientPostId: string;
  payload: any;
  status: 'queued' | 'sending' | 'failed';
  attempts: number;
  error?: string;
  createdAt: number;
}

export class QelemDatabase extends Dexie {
  drafts!: Table<DraftPost, number>;
  feedCache!: Table<CachedFeedPost, string>;
  outbox!: Table<OutboxQueueItem, string>;

  constructor() {
    super('QelemOfflineDB');
    this.version(1).stores({
      drafts: '++id, updatedAt',
      feedCache: 'id, cachedAt',
      outbox: 'clientPostId, status, createdAt'
    });
  }
}

export const offlineDB = new QelemDatabase();
