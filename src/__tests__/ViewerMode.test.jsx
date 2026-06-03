import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import InventoryManagement from '../features/inventory/InventoryManagement';
import DailyLog from '../features/dailyLogs/DailyLog';
import TransactionLedger from '../features/ledger/TransactionLedger';
import TodayOperations from '../features/dailyLogs/TodayOperations';
import NotificationProvider from '../shared/components/NotificationProvider';

// Mock apiClient
vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Public Viewer Mode Constraints', () => {
  describe('InventoryManagement in Viewer Mode', () => {
    it('restricts edit buttons and displays read-only banner', async () => {
      const mockItems = [
        { id: 1, name: 'Starter Feed', category: 'Feed', currentStock: 5, targetQuantity: 100, reorderLevel: 10, unit: 'sacks' },
      ];

      render(
        <InventoryManagement
          token={null}
          activeBatch={{ id: 1 }}
          readOnly={true}
          canEditOrDelete={false}
          previewData={{ inventoryItems: mockItems, inventoryMovements: [] }}
        />
      );

      // Verify read-only access message is visible
      expect(screen.getByText(/Read-only access/i)).toBeInTheDocument();
      expect(screen.getByText(/You can review stock levels/i)).toBeInTheDocument();

      // Form elements should not be present
      expect(screen.queryByPlaceholderText(/e.g. Starter Feed/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save item/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save movement/i })).not.toBeInTheDocument();

      // Edit item button should not render
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });
  });

  describe('DailyLog in Viewer Mode', () => {
    it('does not display new log entry buttons or forms', async () => {
      render(
        <NotificationProvider>
          <DailyLog
            logs={[]}
            activeBatch={{ id: 1 }}
            readOnly={true}
            canEditOrDelete={false}
          />
        </NotificationProvider>
      );

      // Verify wizard headers and log inputs are hidden
      expect(screen.queryByText(/1. Bldg & Date/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save log/i })).not.toBeInTheDocument();
    });
  });

  describe('TransactionLedger in Viewer Mode', () => {
    it('hides transaction form and quick entries', async () => {
      render(
        <NotificationProvider>
          <TransactionLedger
            transactions={[]}
            activeBatch={{ id: 1 }}
            readOnly={true}
            canEditOrDelete={false}
          />
        </NotificationProvider>
      );

      // Form heading for creating entries should not be present
      expect(screen.queryByRole('button', { name: /save entry/i })).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/where did it go/i)).not.toBeInTheDocument();
    });
  });

  describe('TodayOperations in Viewer Mode', () => {
    it('disables checklist clicks and hides quick actions', async () => {
      const mockBatchOnTheWay = {
        id: 2,
        batchCode: 'BATCH-02',
        startDate: '2026-06-10',
        status: 'ON_THE_WAY',
        targetHarvestDate: '2026-07-15',
      };

      render(
        <NotificationProvider>
          <MemoryRouter initialEntries={['/today']}>
            <TodayOperations
              token={null}
              activeBatch={mockBatchOnTheWay}
              logs={[]}
              setActiveScreen={vi.fn()}
            />
          </MemoryRouter>
        </NotificationProvider>
      );

      // Verify checklist items are rendered but disabled
      const cleanButton = screen.getByRole('button', { name: /chicken dung cleanup/i });
      expect(cleanButton).toBeInTheDocument();
      expect(cleanButton).toBeDisabled();

      // Verify Quick Actions section and its buttons are not rendered
      expect(screen.queryByText(/Quick Actions/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /manage batches/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /check feed stock/i })).not.toBeInTheDocument();

      // Verify Actions tab button is also not rendered in mobile tabs view
      expect(screen.queryByRole('button', { name: /^Actions$/i })).not.toBeInTheDocument();
    });
  });
});
