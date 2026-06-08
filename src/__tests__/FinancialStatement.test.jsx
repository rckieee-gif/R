import { render, screen, within } from '@testing-library/react';
import FinancialStatement from '../features/ledger/FinancialStatement';

describe('FinancialStatement arrival summary', () => {
  it('does not treat planned totalChicksLoaded as arrived DOC before explicit arrival', () => {
    render(
      <FinancialStatement
        transactions={[]}
        activeBatch={{
          id: 'FS-PRE',
          totalChicksLoaded: 900,
          plannedFlock: 1000
        }}
      />
    );

    const arrivedDocCard = screen.getByText('Arrived DOC').closest('div');
    const doaCard = screen.getByText('DOA').closest('div');
    const netPlacedCard = screen.getByText('Net placed').closest('div');
    const sampleWeightCard = screen.getByText('Sample wt').closest('div');

    expect(within(arrivedDocCard).getByText('--')).toBeInTheDocument();
    expect(within(doaCard).getByText('--')).toBeInTheDocument();
    expect(within(netPlacedCard).getByText('--')).toBeInTheDocument();
    expect(within(sampleWeightCard).getByText('--')).toBeInTheDocument();
  });

  it('shows arrived DOC details once explicit arrival is recorded', () => {
    render(
      <FinancialStatement
        transactions={[]}
        activeBatch={{
          id: 'FS-POST',
          totalChicksLoaded: 900,
          actualChicksArrived: 900,
          doaCount: 12,
          netChicksPlaced: 888,
          arrivalSampleWeightGrams: 42.5,
          plannedFlock: 1000
        }}
      />
    );

    expect(within(screen.getByText('Arrived DOC').closest('div')).getByText('900')).toBeInTheDocument();
    expect(within(screen.getByText('DOA').closest('div')).getByText('12')).toBeInTheDocument();
    expect(within(screen.getByText('Net placed').closest('div')).getByText('888')).toBeInTheDocument();
    expect(within(screen.getByText('Sample wt').closest('div')).getByText('42.5 g')).toBeInTheDocument();
  });
});
