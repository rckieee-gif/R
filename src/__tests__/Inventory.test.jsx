import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import InventoryManagement from '../features/inventory/InventoryManagement';
import { apiClient } from '../shared/utils/apiClient';

vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockItems = [
  { id: 1, name: 'Starter Feed', category: 'Feed', currentStock: 5, targetQuantity: 100, reorderLevel: 10, unit: 'sacks', warningType: 'low-stock' },
  { id: 2, name: 'Grower Feed', category: 'Feed', currentStock: 25, targetQuantity: 50, reorderLevel: 5, unit: 'sacks', warningType: 'ok' },
];

const mockMovements = [
  { id: 101, itemName: 'Starter Feed', movementDate: '2026-05-29', building: 'All', movementType: 'Stock In', quantity: 5, unit: 'sacks', remarks: 'Init stock' },
];

const mockBuildings = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
];

const mockStakeholders = [
  { id: 1, name: 'Rolly' },
  { id: 2, name: 'Roland' },
];

describe('InventoryManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockImplementation((url) => {
      if (url.includes('/api/inventory/items')) {
        return Promise.resolve(mockItems);
      }
      if (url.includes('/api/inventory/movements')) {
        return Promise.resolve(mockMovements);
      }
      if (url.includes('/api/buildings')) {
        return Promise.resolve(mockBuildings);
      }
      if (url.includes('/api/stakeholders')) {
        return Promise.resolve(mockStakeholders);
      }
      return Promise.resolve([]);
    });
  });

  it('renders items list and active warnings', async () => {
    render(<InventoryManagement token="test-token" activeBatch={{ id: 1 }} />);

    await waitFor(() => {
      expect(screen.getByText('Grower Feed')).toBeInTheDocument();
      expect(screen.getAllByText('Starter Feed').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/Low stock/i).length).toBeGreaterThan(0);
  });

  it('allows creation of a new item', async () => {
    apiClient.post.mockResolvedValueOnce({ success: true });

    render(<InventoryManagement token="test-token" activeBatch={{ id: 1 }} canEditOrDelete={true} />);

    await screen.findByRole('button', { name: /new item/i });
    fireEvent.click(screen.getByRole('button', { name: /new item/i }));

    const nameInput = screen.getByPlaceholderText(/e.g. Starter Feed/i);
    const saveButton = screen.getByRole('button', { name: /add item/i });

    fireEvent.change(nameInput, { target: { value: 'Finisher Feed' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/inventory/items', expect.objectContaining({
        name: 'Finisher Feed',
        category: 'Feed',
      }));
    });
  });

  it('allows logging a stock movement', async () => {
    apiClient.post.mockResolvedValueOnce({ success: true });

    render(<InventoryManagement token="test-token" activeBatch={{ id: 1 }} canEditOrDelete={true} />);

    await screen.findByRole('button', { name: /log movement/i });
    fireEvent.click(screen.getByRole('button', { name: /log movement/i }));

    const qtyInput = screen.getByLabelText(/Qty/i);
    fireEvent.change(qtyInput, { target: { value: '15' } });

    const saveMovementBtn = screen.getByRole('button', { name: /save movement/i });
    fireEvent.click(saveMovementBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/inventory/movements', expect.objectContaining({
        quantity: '15',
        movementType: 'Stock In',
      }));
    });
  });
});
