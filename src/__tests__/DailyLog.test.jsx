import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';
import { vi } from 'vitest';
import DailyLog from '../features/dailyLogs/DailyLog';
import { apiClient } from '../shared/utils/apiClient';
import NotificationProvider from '../shared/components/NotificationProvider';

// Mock the apiClient
vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
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

const mockExistingLog = {
  id: 55,
  batchId: '20260604-02',
  date: '2026-06-21',
  building: 'A',
  employeeId: 20,
  employeeName: 'Worker Rolly',
  handledBirds: 5000,
  feedItemId: 10,
  feedItemName: 'Starter Feed',
  feed: 1,
  mortality: 2,
  averageWeightGrams: null,
  remarks: 'Initial count',
};

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
      expect(screen.getByText(/1. Bldg/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/select date/i)).toBeInTheDocument();
    expect(screen.getByText(/Bldg A/i)).toBeInTheDocument();
  });

  it('renders daily logs as an overview data sheet with the event log on the side', async () => {
    renderComponent({
      logs: [
        mockExistingLog,
        {
          ...mockExistingLog,
          id: 56,
          date: '2026-06-22',
          building: 'B',
          employeeId: 21,
          employeeName: 'Worker Jane',
          handledBirds: 4800,
          feed: 2,
          mortality: 1,
          remarks: 'Second building',
        },
      ],
    });

    const sheet = screen.getByRole('table', { name: /daily log overview data sheet/i });
    expect(screen.getByText('Daily log data sheet')).toBeInTheDocument();
    expect(screen.getByText(/One sheet grouped by building and employee/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Event log$/i })).toBeInTheDocument();
    expect(screen.getByText('Placeholder')).toBeInTheDocument();
    expect(screen.queryByText('Recent Logs')).not.toBeInTheDocument();

    expect(within(sheet).getByText('Building A')).toBeInTheDocument();
    expect(within(sheet).getByText('Building B')).toBeInTheDocument();
    expect(within(sheet).getByText('Worker Rolly')).toBeInTheDocument();
    expect(within(sheet).getByText('Worker Jane')).toBeInTheDocument();
    expect(within(sheet).getByText('Second building')).toBeInTheDocument();
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

    // Go to step 3 (Feed)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText(/3. Feed/i)).toBeInTheDocument();
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

    // Step 3 (Feed)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/3. Feed/i);

    const feedInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(feedInput, { target: { value: '5' } });

    // Step 4 (Mortality)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/4. Mortality/i);

    // Step 5 (Weight)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/5. Weight/i);
    
    const weightInput = screen.getByPlaceholderText(/average bird weight/i);
    fireEvent.change(weightInput, { target: { value: '50' } });

    // Check FCR element value is 1.00
    await waitFor(() => {
      expect(screen.getByText(/1.00/i)).toBeInTheDocument();
    });
  });

  it('saves a daily log for string batch IDs', async () => {
    const setLogs = vi.fn();
    apiClient.post.mockResolvedValue({
      id: 100,
      batchId: '20260604-02',
      date: '2026-06-21',
      building: 'A',
      employeeId: 20,
      employeeName: 'Worker Rolly',
      handledBirds: 5000,
      feedItemId: 10,
      feedItemName: 'Starter Feed',
      feed: 2,
      mortality: 0,
      averageWeightGrams: null,
      remarks: '',
    });

    renderComponent({
      setLogs,
      activeBatch: {
        ...mockBatch,
        id: '20260604-02',
        batchCode: '20260604-02',
        startDate: '2026-06-21',
      },
    });

    await screen.findByText(/Bldg A/i);

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/2. Worker/i);

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/3. Feed/i);
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/4. Mortality/i);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '0' } });

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/5. Weight/i);

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/6. Warnings/i);

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/Verify Log Details/i);

    fireEvent.click(screen.getByRole('button', { name: /save log/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/logs', expect.objectContaining({
        batchId: '20260604-02',
        building: 'A',
        employeeId: 20,
        feed: 2,
        mortality: 0,
      }));
    });
    expect(setLogs).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 7/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /save log/i })).not.toBeInTheDocument();
  });

  it('prevents duplicate submissions while a daily log is saving', async () => {
    let resolvePost;
    apiClient.post.mockImplementation(() => new Promise((resolve) => {
      resolvePost = resolve;
    }));

    renderComponent({
      activeBatch: {
        ...mockBatch,
        id: '20260604-02',
        batchCode: '20260604-02',
        startDate: '2026-06-21',
      },
    });

    await screen.findByText(/Bldg A/i);

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/2. Worker/i);

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/3. Feed/i);
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/4. Mortality/i);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '0' } });

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/5. Weight/i);

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/6. Warnings/i);

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/Verify Log Details/i);

    const saveButton = screen.getByRole('button', { name: /save log/i });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });

    await act(async () => {
      resolvePost({
        id: 101,
        batchId: '20260604-02',
        date: '2026-06-21',
        building: 'A',
        employeeId: 20,
        employeeName: 'Worker Rolly',
        handledBirds: 5000,
        feedItemId: 10,
        feedItemName: 'Starter Feed',
        feed: 2,
        mortality: 0,
        averageWeightGrams: null,
        remarks: '',
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 7/i)).toBeInTheDocument();
    });
  });

  it('edits an existing daily log in a modal without replacing the new entry draft', async () => {
    const setLogs = vi.fn();
    apiClient.patch.mockResolvedValue({
      ...mockExistingLog,
      feed: 3,
      remarks: 'Corrected count',
    });

    renderComponent({
      logs: [mockExistingLog],
      setLogs,
      canEditOrDelete: true,
      activeBatch: {
        ...mockBatch,
        id: '20260604-02',
        batchCode: '20260604-02',
        startDate: '2026-06-21',
      },
    });

    await screen.findByText(/Bldg A/i);

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/2. Worker/i);

    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    await screen.findByText(/3. Feed/i);
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));

    const dialog = await screen.findByRole('dialog', { name: /edit daily log/i });
    expect(screen.getByText(/Step 3 of 7/i)).toBeInTheDocument();

    const modal = within(dialog);
    fireEvent.change(modal.getByLabelText(/feed used/i), { target: { value: '3' } });
    fireEvent.change(modal.getByLabelText(/remarks/i), { target: { value: 'Corrected count' } });
    fireEvent.click(modal.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/api/logs/55', expect.objectContaining({
        batchId: '20260604-02',
        building: 'A',
        employeeId: 20,
        feed: 3,
        mortality: 2,
        remarks: 'Corrected count',
      }));
    });
    expect(setLogs).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /edit daily log/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Step 3 of 7/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(5);
  });
});
