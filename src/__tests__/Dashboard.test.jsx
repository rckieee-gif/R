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
  it('keeps planned totalChicksLoaded neutral until arrived DOC is explicitly recorded', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T00:00:00Z'));
    apiClient.get.mockResolvedValue([]);

    render(
      <Dashboard
        setActiveScreen={vi.fn()}
        user={{ role: 'OperationManager' }}
        activeBatch={{
          id: 'DASH-PRE',
          startDate: '2026-06-06',
          totalChicksLoaded: 900,
          plannedFlock: 1000,
          mortalityAllowance: 0
        }}
        logs={[
          { id: 1, date: '2026-06-06', building: 'A', feed: 1, mortality: 12 }
        ]}
      />
    );

    const liveBirdsCard = screen.getByText('Live Birds').closest('div');
    expect(within(liveBirdsCard).getByText('--')).toBeInTheDocument();
    expect(within(liveBirdsCard).getByText('Awaiting arrived DOC')).toBeInTheDocument();

    const allowanceCard = screen.getByText('Warning Limit Used').closest('div');
    expect(within(allowanceCard).getByText('-- / 5')).toHaveClass('text-dashboard-text');
    expect(within(allowanceCard).getByText('Record arrived DOC to track mortality allowance.')).toBeInTheDocument();

    expect(screen.queryByText(/Arrival variance:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/High cumulative mortality:/i)).not.toBeInTheDocument();
  });

  it('shows arrival variance and mortality allowance once arrived DOC is confirmed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T00:00:00Z'));
    apiClient.get.mockResolvedValue([]);

    render(
      <Dashboard
        setActiveScreen={vi.fn()}
        user={{ role: 'OperationManager' }}
        activeBatch={{
          id: 'DASH-CONFIRMED',
          startDate: '2026-06-06',
          totalChicksLoaded: 900,
          actualChicksArrived: 900,
          plannedFlock: 1000,
          mortalityAllowance: 0
        }}
        logs={[
          { id: 1, date: '2026-06-06', building: 'A', feed: 1, mortality: 12 }
        ]}
      />
    );

    const liveBirdsCard = screen.getByText('Live Birds').closest('div');
    expect(within(liveBirdsCard).getByText('888')).toBeInTheDocument();
    expect(within(liveBirdsCard).getByText('88.8% of plan')).toBeInTheDocument();

    const allowanceCard = screen.getByText('Warning Limit Used').closest('div');
    expect(within(allowanceCard).getByText('12 / 5')).toHaveClass('text-dashboard-danger');
    expect(within(allowanceCard).getByText('Allowance exceeded')).toBeInTheDocument();

    expect(screen.getByText('Arrival variance: actual arrival is 100 below planned flock.')).toBeInTheDocument();
    expect(screen.getByText(/High cumulative mortality:/i)).toBeInTheDocument();
  });

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
          startDate: '2026-06-05',
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
