import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import DailyLog from '../features/dailyLogs/DailyLog';
import { apiClient } from '../shared/utils/apiClient';
import NotificationProvider from '../shared/components/NotificationProvider';

// Mock the apiClient
vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockBatch = {
  id: 1,
  batchCode: 'BATCH-01',
  startDate: '2026-05-01',
  totalChicksLoaded: 10000,
};

const mockFeedItems = [
  { id: 10, name: 'Starter Feed', currentStock: 100, unit: 'sacks' },
];

const mockBuildings = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
];

const mockAssignments = [
  { employeeId: 20, employeeName: 'Worker Rolly', assignedBuilding: 'A', handledBirds: 5000, buildingChicksLoaded: 5000 },
];

const renderComponent = (props = {}) => {
  return render(
    <NotificationProvider>
      <DailyLog
        logs={[]}
        setLogs={vi.fn()}
        activeBatch={mockBatch}
        token="test-token"
        {...props}
      />
    </NotificationProvider>
  );
};

describe('DailyLog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Set up mock API responses
    apiClient.get.mockImplementation((url) => {
      if (url.includes('/api/buildings')) {
        return Promise.resolve(mockBuildings);
      }
      if (url.includes('employee-assignments')) {
        return Promise.resolve(mockAssignments);
      }
      if (url.includes('/api/inventory/items')) {
        return Promise.resolve(mockFeedItems);
      }
      return Promise.resolve([]);
    });
  });

  it('renders guided wizard steps', async () => {
    renderComponent();

    // Loading indicators or element presence after async mount
    await waitFor(() => {
      expect(screen.getByText(/1. Bldg & Date/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/select date/i)).toBeInTheDocument();
    expect(screen.getByText(/Bldg A/i)).toBeInTheDocument();
  });

  it('saves draft to localStorage on input changes and displays restore warning', async () => {
    // Mock get requests so state loads
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Bldg A/i)).toBeInTheDocument();
    });

    // Go to step 2 (Worker)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/2. Worker/i)).toBeInTheDocument();
    });

    // Worker dropdown should have Worker Rolly
    const workerSelect = screen.getByRole('combobox');
    fireEvent.change(workerSelect, { target: { value: '20' } });

    // Go to step 3 (Log Info)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText(/3. Log Info/i)).toBeInTheDocument();
    });

    // Enter feed consumed
    const feedInput = screen.getByPlaceholderText(/0.00/);
    fireEvent.change(feedInput, { target: { value: '5' } });

    // Expect localStorage to have been updated
    await waitFor(() => {
      const draftKey = 'octavioDailyLogDraft:1:A';
      const draft = JSON.parse(localStorage.getItem(draftKey));
      expect(draft).not.toBeNull();
      expect(draft.feedConsumed).toBe('5');
    });

    // Reset rendering to verify restore by unmounting and remounting
    cleanup();
    renderComponent();

    // Verify restore alert is visible on Step 1
    await waitFor(() => {
      expect(screen.getByText(/Restored unsaved progress draft./i)).toBeInTheDocument();
    });
  });

  it('allows discarding draft', async () => {
    // Write a dummy draft first
    localStorage.setItem(
      'octavioDailyLogDraft:1:A',
      JSON.stringify({
        date: '2026-05-29',
        feedConsumed: '10',
        mortality: '2',
        averageWeightGrams: '150',
        remarks: 'Test draft',
      })
    );

    renderComponent();

    // Verify draft restored message is shown
    await waitFor(() => {
      expect(screen.getByText(/Restored unsaved progress draft./i)).toBeInTheDocument();
    });

    const discardBtn = screen.getByText('Discard');
    fireEvent.click(discardBtn);

    // Verify draft is removed
    await waitFor(() => {
      expect(localStorage.getItem('octavioDailyLogDraft:1:A')).toBeNull();
      expect(screen.queryByText(/Restored unsaved progress draft./i)).not.toBeInTheDocument();
    });
  });

  it('performs calculations correctly (FCR)', async () => {
    // 5 bags of 50kg = 250kg feed
    // Live birds = 5000 birds - 0 mortality = 5000
    // Average weight = 50g -> total weight = 5000 * 50g = 250,000g = 250kg
    // FCR = 250kg feed / 250kg weight = 1.00
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Bldg A/i)).toBeInTheDocument();
    });

    // Step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/2. Worker/i);
    const workerSelect = screen.getByRole('combobox');
    fireEvent.change(workerSelect, { target: { value: '20' } });

    // Step 3
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/3. Log Info/i);

    const feedInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(feedInput, { target: { value: '5' } });
    
    const weightInput = screen.getByPlaceholderText(/average bird weight/i);
    fireEvent.change(weightInput, { target: { value: '50' } });

    // Check FCR element value is 1.00
    await waitFor(() => {
      expect(screen.getByText(/1.00/i)).toBeInTheDocument();
    });
  });
});
