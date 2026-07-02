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
  { id: 1, date: '2026-05-29', building: 'All', type: 'Expense', fundingNature: 'OPEX', category: 'Feed', quantity: 5, unitCost: 300, amount: 1500, paidBy: 'Rolly', paidTo: 'Supplier Feed', remarks: '5 bags', status: 'PAID', description: 'Bought Starter Feed', feedItemId: 10 },
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
          activeBatch={{ id: '20260604-02' }}
          token="test-token"
        />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Bought Starter Feed')[0]).toBeInTheDocument();
      expect(screen.getAllByText(/\$1,500\.00/)[0]).toBeInTheDocument();
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
          activeBatch={{ id: '20260604-02' }}
          token="test-token"
          canEditOrDelete={true}
        />
      </NotificationProvider>
    );

    await screen.findByRole('button', { name: /new expense/i });
    fireEvent.click(screen.getByRole('button', { name: /new expense/i }));

    const descInput = screen.getByLabelText(/Description/i);
    const amountInput = screen.getByLabelText(/Amount/i);
    const paidToInput = screen.getByLabelText(/Vendor/i);
    const saveBtn = screen.getByRole('button', { name: /add expense/i });

    fireEvent.change(descInput, { target: { value: 'Starter Feed' } });
    fireEvent.change(amountInput, { target: { value: '2000' } });
    fireEvent.change(paidToInput, { target: { value: 'Supplier Feed' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/batches/20260604-02/transactions',
        expect.objectContaining({
          amount: 2000,
          paidTo: 'Supplier Feed',
          description: 'Starter Feed',
        })
      );
    });
  });

  it('updates a transaction for a hyphenated batch ID', async () => {
    apiClient.patch.mockResolvedValueOnce({
      ...mockTransactions[0],
      description: 'Updated Starter Feed',
    });

    render(
      <NotificationProvider>
        <TransactionLedger
          transactions={mockTransactions}
          setTransactions={vi.fn()}
          activeBatch={{ id: '20260604-02' }}
          token="test-token"
          canEditOrDelete={true}
        />
      </NotificationProvider>
    );

    const editButton = await screen.findByRole('button', { name: /edit bought starter feed/i });

    fireEvent.click(editButton);
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Updated Starter Feed' } });
    fireEvent.click(screen.getByRole('button', { name: /update expense/i }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/batches/20260604-02/transactions/1',
        expect.objectContaining({
          batchId: '20260604-02',
          description: 'Updated Starter Feed',
        })
      );
    });
  });
});
