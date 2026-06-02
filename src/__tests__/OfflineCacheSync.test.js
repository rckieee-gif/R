import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mswServer';
import { apiClient } from '../shared/utils/apiClient';
import { processSyncQueue } from '../offline/syncQueue';
import { getCache, getQueue, removeFromQueue, saveCache, updateQueueStatus } from '../offline/db';

const offlineState = vi.hoisted(() => ({
  cache: null,
  queue: [],
}));

vi.mock('../offline/db', () => ({
  addToQueue: vi.fn(async (item) => {
    offlineState.queue.push(item);
  }),
  saveCache: vi.fn(async () => {}),
  getCache: vi.fn(async () => offlineState.cache),
  getQueue: vi.fn(async () => offlineState.queue),
  removeFromQueue: vi.fn(async (id) => {
    offlineState.queue = offlineState.queue.filter((item) => item.id !== id);
  }),
  updateQueueStatus: vi.fn(async (id, status, error = null) => {
    offlineState.queue = offlineState.queue.map((item) => (
      item.id === id ? { ...item, status, error } : item
    ));
  }),
}));

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}

function apiPath(path) {
  return `*/api${path}`;
}

describe('offline cache and sync regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offlineState.cache = null;
    offlineState.queue = [];
    setOnline(true);
  });

  afterEach(() => {
    setOnline(true);
  });

  it('serves cached reads with metadata when the backend is unavailable', async () => {
    const cachedPayload = [{ id: 1, name: 'Cached Starter Feed' }];
    Object.defineProperty(cachedPayload, '_cacheMeta', {
      value: {
        isCached: true,
        timestamp: Date.parse('2026-06-02T00:00:00Z'),
        isStale: true,
        ageMs: 20 * 60 * 1000,
      },
      enumerable: false,
    });
    offlineState.cache = cachedPayload;

    server.use(
      http.get(apiPath('/inventory/items'), () => HttpResponse.error())
    );

    const data = await apiClient.get('/api/inventory/items', {
      expectArray: true,
      retries: 0,
    });

    expect(data).toBe(cachedPayload);
    expect(data._cacheMeta).toEqual(expect.objectContaining({
      isCached: true,
      isStale: true,
    }));
    expect(getCache).toHaveBeenCalledWith('/api/inventory/items');
    expect(saveCache).not.toHaveBeenCalled();
  });

  it('replays queued mutations on reconnect and removes successful items', async () => {
    const replayedBodies = [];
    offlineState.queue = [{
      id: 'queue-log-1',
      type: 'CREATE_DAILY_LOG',
      url: '/api/logs',
      method: 'POST',
      payload: { batchId: 1, building: 'A', feed: 5 },
      createdAt: '2026-06-02T00:00:00.000Z',
      status: 'pending',
      error: null,
    }];

    server.use(
      http.post(apiPath('/logs'), async ({ request }) => {
        expect(request.headers.get('X-Sync-Queue-Id')).toBe('queue-log-1');
        replayedBodies.push(await request.json());
        return HttpResponse.json({ id: 99 });
      })
    );

    await processSyncQueue(apiClient);

    expect(getQueue).toHaveBeenCalled();
    expect(updateQueueStatus).toHaveBeenCalledWith('queue-log-1', 'syncing');
    expect(removeFromQueue).toHaveBeenCalledWith('queue-log-1');
    expect(replayedBodies).toEqual([{ batchId: 1, building: 'A', feed: 5 }]);
    expect(offlineState.queue).toEqual([]);
  });

  it('leaves queued mutations pending when reconnect replay hits a temporary backend failure', async () => {
    offlineState.queue = [{
      id: 'queue-log-2',
      type: 'CREATE_DAILY_LOG',
      url: '/api/logs',
      method: 'POST',
      payload: { batchId: 1, building: 'B', feed: 3 },
      createdAt: '2026-06-02T00:05:00.000Z',
      status: 'pending',
      error: null,
    }];

    server.use(
      http.post(apiPath('/logs'), () => HttpResponse.json({ error: 'Server warming up' }, { status: 503 }))
    );

    await processSyncQueue(apiClient);

    expect(removeFromQueue).not.toHaveBeenCalled();
    expect(updateQueueStatus).toHaveBeenCalledWith(
      'queue-log-2',
      'pending',
      'Server warming up'
    );
    expect(offlineState.queue[0]).toEqual(expect.objectContaining({
      id: 'queue-log-2',
      status: 'pending',
      error: 'Server warming up',
    }));
  });
});
