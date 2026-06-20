import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useBatches from '../features/batches/useBatches';
import { apiClient } from '../shared/utils/apiClient';

vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const user = {
  username: 'farm.owner',
  role: 'AdminOwner',
};

const ongoingBatch = {
  id: '20260604-02',
  status: 'ONGOING',
};

const closedBatch = {
  id: '20260418',
  status: 'CLOSED',
};

describe('useBatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the selected closed batch when a refresh fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiClient.get.mockResolvedValueOnce([ongoingBatch, closedBatch]);

    const { result } = renderHook(() => useBatches('token', user, null));

    await waitFor(() => {
      expect(result.current.batches).toHaveLength(2);
      expect(result.current.activeBatch).toEqual(ongoingBatch);
    });

    act(() => {
      result.current.selectActiveBatch(closedBatch);
    });

    apiClient.get.mockRejectedValueOnce(new Error('Database schema is unavailable'));

    await act(async () => {
      await result.current.refreshBatches();
    });

    expect(result.current.activeBatch).toEqual(closedBatch);
    expect(result.current.batches).toEqual([ongoingBatch, closedBatch]);
    expect(result.current.batchListError).toMatch(/Batch list is unavailable/i);

    consoleError.mockRestore();
  });
});
