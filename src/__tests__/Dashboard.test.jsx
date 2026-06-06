import { render, screen, within } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import Dashboard from '../features/dashboard/Dashboard';
import { apiClient } from '../shared/utils/apiClient';

vi.mock('../features/dashboard/components/WeatherForecast', () => ({
  default: () => <div data-testid="weather-forecast" />
}));

vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {
    get: vi.fn()
  }
}));

vi.mock('../offline/db', () => ({
  getQueue: vi.fn(() => Promise.resolve([])),
  openDatabase: vi.fn(),
  removeFromQueue: vi.fn(),
  updateQueueStatus: vi.fn()
}));

vi.mock('../offline/syncQueue', () => ({
  processSyncQueue: vi.fn()
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Dashboard arrival-adjusted operations metrics', () => {
  it('uses net placed heads for live flock and feed target variance after DOA', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T00:00:00Z'));
    apiClient.get.mockResolvedValue([]);

    render(
      <Dashboard
        setActiveScreen={vi.fn()}
        user={{ role: 'OperationManager' }}
        activeBatch={{
          id: 'DASH-01',
          startDate: '2026-06-06',
          totalChicksLoaded: 1000,
          actualChicksArrived: 1000,
          doaCount: 100,
          netChicksPlaced: 900,
          plannedFlock: 1000,
          mortalityAllowance: 0
        }}
        logs={[
          { id: 1, date: '2026-06-06', building: 'A', feed: 1, mortality: 20 }
        ]}
      />
    );

    const liveBirdsCard = screen.getByText('Live Birds').closest('div');
    expect(within(liveBirdsCard).getByText('880')).toBeInTheDocument();

    const feedVarianceCard = screen.getByText('Feed Variance').closest('div');
    expect(within(feedVarianceCard).getByText('+270.4%')).toBeInTheDocument();
  });
});
