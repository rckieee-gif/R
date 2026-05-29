import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import InventoryManagement from '../InventoryManagement';
import DailyLog from '../DailyLog';
import TransactionLedger from '../TransactionLedger';
import NotificationProvider from '../Components/NotificationProvider';

// Mock apiClient
vi.mock('../utils/apiClient', () => ({
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
});
