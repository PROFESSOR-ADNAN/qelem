import { offlineDB } from './db.js';
import { apiFetch, getAccessToken } from '../api/client.js';

let isSyncing = false;

export async function flushOutbox(): Promise<void> {
  if (isSyncing || typeof navigator === 'undefined' || !navigator.onLine || !getAccessToken()) {
    return;
  }
  isSyncing = true;

  try {
    const queuedItems = await offlineDB.outbox
      .where('status')
      .equals('queued')
      .toArray();

    for (const item of queuedItems) {
      try {
        await offlineDB.outbox.update(item.clientPostId, { status: 'sending' });
        await apiFetch('/posts', {
          method: 'POST',
          body: JSON.stringify(item.payload)
        });
        await offlineDB.outbox.delete(item.clientPostId);
      } catch (err: any) {
        if (err?.status && err.status >= 400 && err.status < 500) {
          // Bad request or validation failure - remove to prevent endless retry loops
          await offlineDB.outbox.delete(item.clientPostId);
        } else {
          // Network error or server cold start - leave in queue to retry next time
          await offlineDB.outbox.update(item.clientPostId, {
            status: 'queued',
            attempts: item.attempts + 1,
            error: err?.message
          });
        }
      }
    }
  } finally {
    isSyncing = false;
  }
}

export function initOutboxSync(): () => void {
  const onOnline = () => {
    flushOutbox();
  };

  window.addEventListener('online', onOnline);
  // Attempt sync immediately on startup
  flushOutbox();

  return () => {
    window.removeEventListener('online', onOnline);
  };
}
