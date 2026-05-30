import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TransactionLedger from '../features/ledger/TransactionLedger';
import { apiClient } from '../shared/utils/apiClient';
import NotificationProvider from '../shared/components/NotificationProvider';

vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockTransactions = [
  { id: 1, date: '2026-05-29', building: 'All', type: 'Expense', category: 'Feed', amount: 1500, paidBy: 'Rolly', paidTo: 'Supplier Feed', remarks: '5 bags', status: 'PAID', description: 'Bought Starter Feed' },
];

const mockBuildings = [{ id: 1, name: 'A' }];
const mockCategories = [{ id: 1, name: 'Feed', fundingNature: 'OPEX' }];
const mockStakeholders = [{ id: 1, name: 'Rolly' }, { id: 2, name: 'Supplier Feed' }];
const mockFeedItems = [{ id: 10, name: 'Starter Feed' }];

describe('TransactionLedger Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockImplementation((url) => {
      if (url.includes('/api/buildings')) return Promise.resolve(mockBuildings);
      if (url.includes('/api/categories')) return Promise.resolve(mockCategories);
      if (url.includes('/api/stakeholders')) return Promise.resolve(mockStakeholders);
      if (url.includes('/api/inventory/items')) return Promise.resolve(mockFeedItems);
      return Promise.resolve([]);
    });
  });

  it('renders transactions table and entries', async () => {
    render(
      <NotificationProvider>
        <TransactionLedger
          transactions={mockTransactions}
          setTransactions={vi.fn()}
          activeBatch={{ id: 1 }}
          token="test-token"
        />
      </NotificationProvider>
    );

    screen.debug(undefined, 100000);
    await waitFor(() => {
      expect(screen.getAllByText('Bought Starter Feed')[0]).toBeInTheDocument();
      expect(screen.getAllByText(/PHP\s+1,500/)[0]).toBeInTheDocument();
    });
  });

  it('submits a new transaction', async () => {
    apiClient.post.mockResolvedValueOnce({
      id: 2,
      date: '2026-05-29',
      building: 'A',
      type: 'Expense',
      category: 'Feed',
      amount: 2000,
      paidBy: 'Rolly',
      paidTo: 'Supplier Feed',
      remarks: 'new transaction',
      status: 'PAID',
    });

    render(
      <NotificationProvider>
        <TransactionLedger
          transactions={mockTransactions}
          setTransactions={vi.fn()}
          activeBatch={{ id: 1 }}
          token="test-token"
          canEditOrDelete={true}
        />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save record/i })).toBeInTheDocument();
    });

    // Fill in transaction details
    const descInput = screen.getByLabelText('Description');
    const quantityInput = screen.getByLabelText('Quantity');
    const amountInput = screen.getByLabelText('Amount');
    const paidToInput = screen.getByLabelText('Paid To');
    const saveBtn = screen.getByRole('button', { name: /save record/i });

    fireEvent.change(descInput, { target: { value: 'Starter Feed' } });
    fireEvent.change(quantityInput, { target: { value: '10' } });
    fireEvent.change(amountInput, { target: { value: '2000' } });
    fireEvent.change(paidToInput, { target: { value: 'Supplier Feed' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/batches/1/transactions',
        expect.objectContaining({
          amount: 2000,
          paidTo: 'Supplier Feed',
        })
      );
    });
  });
});
