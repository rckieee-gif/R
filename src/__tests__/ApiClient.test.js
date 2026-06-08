import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, isBackendUnavailableError } from '../shared/utils/apiClient';

vi.mock('../offline/db', () => ({
  saveCache: vi.fn(),
  getCache: vi.fn(async () => null),
}));

vi.mock('../offline/syncQueue', () => ({
  enqueueRequest: vi.fn(),
  processSyncQueue: vi.fn(),
}));

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiClient auth transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('octavioToken', 'legacy-local-storage-token');
    globalThis.fetch = vi.fn(async () => jsonResponse({ ok: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses cookies without promoting stale localStorage tokens to bearer headers', async () => {
    await apiClient.get('/api/protected', { retries: 0 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/protected$/),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      })
    );
  });

  it('keeps bearer auth available when a caller passes an explicit token', async () => {
    await apiClient.get('/api/protected', {
      authToken: 'explicit-test-token',
      retries: 0,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/protected$/),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          Authorization: 'Bearer explicit-test-token',
        }),
      })
    );
  });

  it('tags local dev proxy failures as backend unavailable without retrying', async () => {
    globalThis.fetch = vi.fn(async () => new Response('Proxy unavailable', { status: 502 }));

    let caughtError;
    try {
      await apiClient.get('/api/auth/me');
    } catch (error) {
      caughtError = error;
    }

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(caughtError).toMatchObject({ status: 502 });
    expect(isBackendUnavailableError(caughtError)).toBe(true);
  });

  it('allows optional startup reads to quietly fall back when the backend is unavailable', async () => {
    globalThis.fetch = vi.fn(async () => new Response('Proxy unavailable', { status: 502 }));

    const data = await apiClient.get('/api/public/current-batch', {
      quietOnBackendUnavailable: true,
      backendUnavailableFallback: null,
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(data).toBeNull();
  });
});
