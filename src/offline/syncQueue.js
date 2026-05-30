import { addToQueue, getQueue, removeFromQueue, updateQueueStatus } from './db';
import { resolveConflict } from './conflictResolver';

let isProcessing = false;

// Event notifier for sync changes
export function notifySyncStatus() {
  window.dispatchEvent(new CustomEvent('sync-status-changed'));
}

export async function enqueueRequest(type, url, method, payload) {
  const item = {
    id: crypto.randomUUID(),
    type,
    url,
    method,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
    error: null
  };

  await addToQueue(item);
  notifySyncStatus();
  return item;
}

export async function processSyncQueue(directApiClient) {
  if (isProcessing) return;
  if (!navigator.onLine) return;

  isProcessing = true;

  try {
    const queue = await getQueue();
    const pendingItems = queue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) return;

    console.log(`Processing ${pendingItems.length} items from sync queue...`);

    for (const item of pendingItems) {
      try {
        await updateQueueStatus(item.id, 'syncing');
        notifySyncStatus();

        // Perform request bypass-caching directly
        await directApiClient.request(item.url, {
          method: item.method,
          body: JSON.stringify(item.payload),
          headers: { 'X-Sync-Queue-Id': item.id } // Header to let backend know/de-duplicate
        });

        await removeFromQueue(item.id);
        console.log(`Successfully synced queue item: ${item.id}`);
      } catch (err) {
        console.error(`Failed to sync item ${item.id}:`, err);

        const resolution = resolveConflict(item, err);
        if (resolution.action === 'discard') {
          await removeFromQueue(item.id);
        } else if (resolution.action === 'flag') {
          await updateQueueStatus(item.id, 'conflict', resolution.reason);
        } else {
          // Retry later
          await updateQueueStatus(item.id, 'pending', err.message);
          break; // Stop queue processing on temporary server failures
        }
      } finally {
        notifySyncStatus();
      }
    }
  } finally {
    isProcessing = false;
  }
}
