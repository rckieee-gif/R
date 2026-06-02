import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import SyncDrawer from '../offline/SyncDrawer';
import OfflineStaleBanner from '../shared/components/OfflineStaleBanner';
import { getQueue } from '../offline/db';

vi.mock('../offline/db', () => ({
  getQueue: vi.fn(),
  openDatabase: vi.fn(),
  removeFromQueue: vi.fn(),
  updateQueueStatus: vi.fn(),
}));

vi.mock('../offline/syncQueue', () => ({
  processSyncQueue: vi.fn(),
}));

vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {},
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Offline UI lint-safe timing flows', () => {
  it('updates cached data age after the deferred clock tick', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T00:30:00Z'));

    render(
      <OfflineStaleBanner
        data={{ _cacheMeta: { timestamp: Date.parse('2026-06-02T00:00:00Z'), isStale: false } }}
      />
    );

    expect(screen.getByText(/from just now/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByText(/from 30m ago/i)).toBeInTheDocument();
  });

  it('shows the stale cache warning when cache metadata is past the TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T00:20:00Z'));

    render(
      <OfflineStaleBanner
        data={[
          { name: 'live-ish' },
          { _cacheMeta: { timestamp: Date.parse('2026-06-02T00:00:00Z'), isStale: true } },
        ]}
      />
    );

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByText(/Warning: Viewing stale offline data loaded 20m ago/i)).toBeInTheDocument();
    expect(screen.getByText(/limit: 15m/i)).toBeInTheDocument();
  });

  it('does not show an offline banner when cache metadata is absent', () => {
    render(<OfflineStaleBanner data={[{ name: 'fresh-server-data' }]} />);

    expect(screen.queryByText(/Offline Mode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Viewing stale offline data/i)).not.toBeInTheDocument();
  });

  it('keeps the sync drawer accidental-close guard after opening', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T00:00:00Z'));
    getQueue.mockResolvedValue([]);

    const onClose = vi.fn();
    const { container, rerender } = render(<SyncDrawer isOpen={false} onClose={onClose} />);

    rerender(<SyncDrawer isOpen={true} onClose={onClose} />);
    const backdrop = container.firstChild;

    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(301);
    });

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
