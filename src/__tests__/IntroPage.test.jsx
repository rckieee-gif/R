import { render, screen, within } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import IntroPage from '../features/auth/IntroPage';
import { publicViewerData } from '../shared/utils/publicViewerData';

function buildSnapshot(batchOverrides = {}, logs = []) {
  return {
    batch: {
      id: 'PREVIEW-01',
      status: 'ON_THE_WAY',
      startDate: '2026-06-10',
      targetHarvestDate: '2026-07-15',
      totalChicksLoaded: 900,
      actualChicksArrived: 900,
      plannedFlock: 1000,
      mortalityAllowance: 20,
      targetFeedKg: 5200,
      ...batchOverrides
    },
    batches: [],
    logs,
    loadings: [
      { id: 1, building: 'A', chicksLoaded: 900 }
    ],
    inventoryItems: [
      { id: 1, name: 'Starter Feed', category: 'Feed', currentStock: 40, reorderLevel: 20 }
    ],
    feedItems: [
      { id: 1, name: 'Starter Feed', category: 'Feed', currentStock: 40, reorderLevel: 20 }
    ],
    harvestProductionSummary: {
      totals: { birds: 0 },
      perHarvest: []
    }
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('IntroPage public preview signals', () => {
  it('shows arrival variance and mortality allowance in the pre-arrival preview', () => {
    render(
      <IntroPage
        onContinueAsViewer={vi.fn()}
        onMemberLogin={vi.fn()}
        preloadedSnapshot={buildSnapshot({}, [
          { id: 1, date: '2026-06-10', building: 'A', mortality: 25 }
        ])}
      />
    );

    expect(screen.getByText('Pre-Arrival Prep')).toBeInTheDocument();
    expect(screen.getByText('ARRIVAL VARIANCE')).toBeInTheDocument();
    expect(screen.getByText('-100')).toBeInTheDocument();
    expect(screen.getByText('100 below planned flock (-10%).')).toBeInTheDocument();
    expect(screen.getAllByText('Mortality allowance').length).toBeGreaterThan(0);
    expect(screen.getByText('25 / 20')).toBeInTheDocument();
    expect(screen.getByText('Allowance exceeded.')).toBeInTheDocument();
  });

  it('keeps pre-arrival warning cards neutral until arrived DOC is recorded', () => {
    render(
      <IntroPage
        onContinueAsViewer={vi.fn()}
        onMemberLogin={vi.fn()}
        preloadedSnapshot={buildSnapshot({ actualChicksArrived: 0 }, [
          { id: 1, date: '2026-06-10', building: 'A', mortality: 25 }
        ])}
      />
    );

    expect(screen.getByText('Pre-Arrival Prep')).toBeInTheDocument();
    expect(screen.getByText('ARRIVAL VARIANCE')).toBeInTheDocument();
    expect(screen.getByText('Enter building chick counts when the delivery arrives.')).toBeInTheDocument();
    expect(screen.getByText('Record arrived DOC to track mortality allowance.')).toBeInTheDocument();
    expect(screen.queryByText('-100')).not.toBeInTheDocument();
    expect(screen.queryByText('100 below planned flock (-10%).')).not.toBeInTheDocument();
    expect(screen.queryByText('Allowance exceeded.')).not.toBeInTheDocument();
  });

  it('adds the same batch warnings to the active viewer preview list', () => {
    render(
      <IntroPage
        onContinueAsViewer={vi.fn()}
        onMemberLogin={vi.fn()}
        preloadedSnapshot={buildSnapshot({ status: 'ONGOING', startDate: '2026-05-20', totalChicksLoaded: 1000 }, [
          { id: 1, date: '2026-05-20', building: 'A', mortality: 25 }
        ])}
      />
    );

    expect(screen.getByText('Today at a glance')).toBeInTheDocument();
    const liveBirdsCard = screen.getByText('LIVE BIRDS').closest('div');
    expect(within(liveBirdsCard).getByText('875')).toBeInTheDocument();
    expect(screen.getByText('100 fewer chicks arrived than the planned flock of 1,000.')).toBeInTheDocument();
    expect(screen.getByText('25 total mortality recorded; allowance is 20 heads.')).toBeInTheDocument();
  });

  it('keeps active viewer live birds neutral until arrived DOC is recorded', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-09T00:00:00Z'));

    render(
      <IntroPage
        onContinueAsViewer={vi.fn()}
        onMemberLogin={vi.fn()}
        preloadedSnapshot={buildSnapshot({ status: 'ONGOING', startDate: '2026-05-20', actualChicksArrived: 0 }, [
          { id: 1, date: '2026-06-09', building: 'A', mortality: 25 }
        ])}
      />
    );

    expect(screen.getByText('Today at a glance')).toBeInTheDocument();
    const liveBirdsCard = screen.getByText('LIVE BIRDS').closest('div');
    expect(within(liveBirdsCard).getByText('--')).toHaveClass('text-app-text');
    expect(screen.queryByText('875')).not.toBeInTheDocument();
    expect(screen.queryByText('Arrival variance')).not.toBeInTheDocument();
    expect(screen.queryByText('25 total mortality recorded; allowance is 20 heads.')).not.toBeInTheDocument();
  });

  it('ships public viewer fixture data with batch signals for previews', () => {
    expect(publicViewerData.batch).toBeTruthy();
    expect(publicViewerData.logs.length).toBeGreaterThan(0);
    expect(publicViewerData.previewSignals.arrival).toEqual(expect.objectContaining({
      hasWarning: true,
      severity: 'warning'
    }));
    expect(publicViewerData.previewSignals.mortality).toEqual(expect.objectContaining({
      allowanceLimit: 200,
      severity: 'success'
    }));
  });
});
