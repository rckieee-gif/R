import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import AntigravityAssistant from '../shared/components/AntigravityAssistant';

vi.mock('../shared/components/EggModel', () => ({
  default: () => <div>Assistant</div>
}));

vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {
    post: vi.fn()
  }
}));

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('AntigravityAssistant arrival-adjusted metrics', () => {
  it('keeps the batch briefing neutral before arrived DOC is explicit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T00:00:00Z'));

    render(
      <AntigravityAssistant
        activeBatch={{
          id: 'AST-PRE',
          startDate: '2026-06-06',
          targetHarvestDate: '2026-07-10',
          totalChicksLoaded: 1000,
          plannedFlock: 1000
        }}
        logs={[
          { id: 1, date: '2026-06-06', feed: 1, mortality: 20, averageWeightGrams: 53 }
        ]}
        user={{ name: 'Rolly', role: 'OperationManager' }}
        allowedScreens={['dailyLog', 'analytics']}
        canEnterDaily={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Farm Assistant' }));
    fireEvent.click(screen.getByRole('button', { name: /Batch Briefing/i }));

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(screen.getAllByText((_, element) => (
      element?.textContent?.includes('Live estimate: Awaiting arrived DOC')
    )).length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => (
      element?.textContent?.includes('Awaiting arrived DOC before flock health is scored')
    )).length).toBeGreaterThan(0);
    expect(screen.queryByText((_, element) => (
      element?.textContent?.includes('980 / 1,000 birds')
    ))).not.toBeInTheDocument();
  });

  it('uses net placed heads in the batch briefing live estimate', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T00:00:00Z'));

    render(
      <AntigravityAssistant
        activeBatch={{
          id: 'AST-01',
          startDate: '2026-06-06',
          targetHarvestDate: '2026-07-10',
          totalChicksLoaded: 1000,
          actualChicksArrived: 1000,
          doaCount: 100,
          netChicksPlaced: 900
        }}
        logs={[
          { id: 1, date: '2026-06-06', feed: 1, mortality: 20, averageWeightGrams: 53 }
        ]}
        user={{ name: 'Rolly', role: 'OperationManager' }}
        allowedScreens={['dailyLog', 'analytics']}
        canEnterDaily={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Farm Assistant' }));
    fireEvent.click(screen.getByRole('button', { name: /Batch Briefing/i }));

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(screen.getAllByText((_, element) => (
      element?.textContent?.includes('880 / 900 birds')
    )).length).toBeGreaterThan(0);
  });
});
