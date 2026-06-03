import { render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import Analytics from '../features/analytics/Analytics';

vi.mock('recharts', () => {
  const Container = ({ children }) => <div data-testid="chart-container">{children}</div>;
  const ChartPart = () => null;

  return {
    ResponsiveContainer: Container,
    LineChart: Container,
    Line: ChartPart,
    BarChart: Container,
    Bar: ChartPart,
    XAxis: ChartPart,
    YAxis: ChartPart,
    CartesianGrid: ChartPart,
    Tooltip: ChartPart,
    Legend: ChartPart
  };
});

describe('Analytics report context', () => {
  it('shows arrival variance and configured mortality allowance context', () => {
    render(
      <Analytics
        showFinancials={false}
        transactions={[]}
        activeBatch={{
          id: 1,
          startDate: '2026-05-20',
          totalChicksLoaded: 900,
          plannedFlock: 1000,
          mortalityAllowance: 50
        }}
        logs={[
          { id: 1, date: '2026-05-20', feed: 1, mortality: 40 },
          { id: 2, date: '2026-05-21', feed: 2, mortality: 20 }
        ]}
      />
    );

    expect(screen.getAllByText('Arrival Variance').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100 fewer than planned.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mortality Allowance').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Allowance exceeded.').length).toBeGreaterThan(0);

    const allowanceCardLabel = screen
      .getAllByText('Mortality Allowance')
      .find((element) => element.tagName === 'P');
    const allowanceCard = allowanceCardLabel.closest('div');
    expect(within(allowanceCard).getByText('60 / 50')).toHaveClass('text-app-warning');
  });

  it('uses the fallback mortality warning limit when no allowance is configured', () => {
    render(
      <Analytics
        showFinancials={false}
        transactions={[]}
        activeBatch={{
          id: 2,
          startDate: '2026-05-20',
          totalChicksLoaded: 900,
          plannedFlock: 900,
          mortalityAllowance: 0
        }}
        logs={[
          { id: 1, date: '2026-05-20', feed: 1, mortality: 12 }
        ]}
      />
    );

    expect(screen.getAllByText('Warning Limit Used').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Limit exceeded.').length).toBeGreaterThan(0);

    const limitCardLabel = screen
      .getAllByText('Warning Limit Used')
      .find((element) => element.tagName === 'P');
    const limitCard = limitCardLabel.closest('div');
    expect(within(limitCard).getByText('12 / 5')).toHaveClass('text-app-danger');
  });
});
