import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import App from '../app/App';
import TodayOperations from '../features/dailyLogs/TodayOperations';
import NotificationProvider from '../shared/components/NotificationProvider';
import { server } from '../test/mswServer';

// Mock getLastBroilerTargetDay partially
vi.mock('../shared/utils/broilerTargets', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getLastBroilerTargetDay: () => 35,
  };
});

const mockBatchActive = {
  id: 1,
  batchCode: 'BATCH-01',
  startDate: '2026-05-20',
  status: 'ACTIVE',
  totalChicksLoaded: 1000,
  targetHarvestDate: '2026-06-25',
};

const mockBatchOnTheWay = {
  id: 2,
  batchCode: 'BATCH-02',
  startDate: '2026-06-10',
  status: 'ON_THE_WAY',
  targetHarvestDate: '2026-07-15',
};

const mockBatchPostSummary = {
  id: 3,
  batchCode: 'BATCH-03',
  startDate: '2026-04-01',
  status: 'CLOSED',
  actualHarvestEndDate: '2026-05-10',
};

const renderComponent = (props = {}) => {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={props.initialEntries || ['/today']}>
        <TodayOperations
          token="test-token"
          activeBatch={mockBatchActive}
          logs={[]}
          setActiveScreen={vi.fn()}
          {...props}
        />
      </MemoryRouter>
    </NotificationProvider>
  );
};

function json(data, status = 200) {
  return HttpResponse.json(data, { status });
}

function apiPath(path) {
  return `*/api${path}`;
}

function todayInputForTest() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mockTodayApi() {
  server.use(
    http.get(apiPath('/batches/:batchId/loadings'), () => json([])),
    http.get(apiPath('/batches/:batchId/employee-assignments'), () => json([])),
    http.get(apiPath('/inventory/items'), () => json([])),
    http.get(apiPath('/batches/:batchId/harvest-production-summary'), () => json({
      totals: { birds: 0 },
      perHarvest: [],
    }))
  );
}

describe('TodayOperations Component Keyboard Shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockTodayApi();
  });

  it('allows switching mobile tabs via 1, 2, 3 keys in active batch mode', async () => {
    renderComponent();

    const overviewTab = screen.getByRole('button', { name: /^Daily Logs$/i });
    const checklistTab = screen.getByRole('button', { name: /^Checklist$/i });
    const warningsTab = screen.getByRole('button', { name: /^Warnings$/i });

    // Default tab is 'overview'
    expect(overviewTab).toHaveClass('border-app-accent');
    expect(checklistTab).toHaveClass('border-transparent');

    // Press key '2' to go to checklist
    fireEvent.keyDown(window, { key: '2' });
    expect(overviewTab).toHaveClass('border-transparent');
    expect(checklistTab).toHaveClass('border-app-accent');

    // Press key '3' to go to warnings
    fireEvent.keyDown(window, { key: '3' });
    expect(checklistTab).toHaveClass('border-transparent');
    expect(warningsTab).toHaveClass('border-app-accent');

    // Press key '1' to go back to overview
    fireEvent.keyDown(window, { key: '1' });
    expect(warningsTab).toHaveClass('border-transparent');
    expect(overviewTab).toHaveClass('border-app-accent');
  });

  it('allows switching mobile tabs in ON_THE_WAY mode', async () => {
    renderComponent({ activeBatch: mockBatchOnTheWay });

    const overviewTab = screen.getByRole('button', { name: /^Batches$/i });
    const checklistTab = screen.getByRole('button', { name: /^Checklist$/i });
    const actionsTab = screen.getByRole('button', { name: /^Actions$/i });

    // Default tab is 'overview'
    expect(overviewTab).toHaveClass('border-app-accent');
    expect(checklistTab).toHaveClass('border-transparent');

    // In ON_THE_WAY mode, Tab 2 switches to 'checklist', Tab 3 switches to 'actions'
    fireEvent.keyDown(window, { key: '2' });
    expect(overviewTab).toHaveClass('border-transparent');
    expect(checklistTab).toHaveClass('border-app-accent');

    fireEvent.keyDown(window, { key: '3' });
    expect(checklistTab).toHaveClass('border-transparent');
    expect(actionsTab).toHaveClass('border-app-accent');

    fireEvent.keyDown(window, { key: '1' });
    expect(actionsTab).toHaveClass('border-transparent');
    expect(overviewTab).toHaveClass('border-app-accent');
  });

  it('shows pre-placement downtime preparation while arrived DOC is not entered', async () => {
    renderComponent({
      activeBatch: {
        ...mockBatchActive,
        id: 44,
        status: 'ONGOING',
        totalChicksLoaded: 0,
        plannedFlock: 1000,
      },
    });

    expect(screen.getByRole('heading', { name: /Pre-placement \/ Downtime preparation/i })).toBeInTheDocument();
    expect(screen.getByText(/No arrived DOC input yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting arrived DOC count/i)).toBeInTheDocument();
    expect(screen.getByText(/Remove old litter and manure/i)).toBeInTheDocument();
    expect(screen.getByText(/Pre-heat brooding area/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Arrived DOC/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^Daily Logs$/i })).not.toBeInTheDocument();
  });

  it('keeps D1 in pre-placement when only planned loading numbers exist', async () => {
    renderComponent({
      activeBatch: {
        ...mockBatchActive,
        id: 45,
        startDate: todayInputForTest(),
        status: 'ONGOING',
        totalChicksLoaded: 45000,
        plannedFlock: 45000,
      },
    });

    expect(screen.getByRole('heading', { name: /Pre-placement \/ Downtime preparation/i })).toBeInTheDocument();
    expect(screen.getByText(/No arrived DOC input yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter actual day-old chicken arrivals in Batches once placement is complete/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Daily Logs$/i })).not.toBeInTheDocument();
  });

  it('keeps D1 in pre-placement when arrived DOC field is present but still zero', async () => {
    renderComponent({
      activeBatch: {
        ...mockBatchActive,
        id: 145,
        startDate: todayInputForTest(),
        status: 'ONGOING',
        totalChicksLoaded: 45000,
        plannedFlock: 45000,
        actualChicksArrived: 0,
      },
    });

    expect(screen.getByRole('heading', { name: /Pre-placement \/ Downtime preparation/i })).toBeInTheDocument();
    expect(screen.getByText(/No arrived DOC input yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Daily Logs$/i })).not.toBeInTheDocument();
  });

  it('shows active operations on D1 when arrived DOC is explicitly recorded', async () => {
    renderComponent({
      activeBatch: {
        ...mockBatchActive,
        id: 46,
        startDate: todayInputForTest(),
        status: 'ONGOING',
        totalChicksLoaded: 45000,
        plannedFlock: 45000,
        actualChicksArrived: 44850,
      },
    });

    expect(screen.getByRole('heading', { name: /Today.s Farm Checklist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Daily Logs$/i })).toBeInTheDocument();
    expect(screen.queryByText(/No arrived DOC input yet/i)).not.toBeInTheDocument();
  });

  it('records arrived DOC from the pre-placement quick popup', async () => {
    const setActiveBatch = vi.fn();
    const onBatchesChanged = vi.fn();
    let patchPayload;

    server.use(
      http.get(apiPath('/batches/:batchId/loadings'), () => json([
        { building: 'A', chicksLoaded: 15000, loadingSharePct: 33.3333, remarks: '' },
        { building: 'B', chicksLoaded: 15000, loadingSharePct: 33.3333, remarks: '' },
        { building: 'C', chicksLoaded: 15000, loadingSharePct: 33.3333, remarks: '' },
      ])),
      http.patch(apiPath('/batches/:batchId'), async ({ request }) => {
        patchPayload = await request.json();
        return json({
          id: 47,
          batchCode: 'BATCH-47',
          ...patchPayload,
        });
      })
    );

    renderComponent({
      activeBatch: {
        ...mockBatchActive,
        id: 47,
        batchCode: 'BATCH-47',
        startDate: todayInputForTest(),
        status: 'ONGOING',
        totalChicksLoaded: 45000,
        plannedFlock: 45000,
      },
      setActiveBatch,
      onBatchesChanged,
    });

    fireEvent.click(screen.getByRole('button', { name: /Enter DOC/i }));

    expect(screen.queryByLabelText(/Actual received head count/i)).not.toBeInTheDocument();
    expect(screen.getByText('Building A')).toBeInTheDocument();
    expect(screen.getByText('Building B')).toBeInTheDocument();
    expect(screen.getByText('Building C')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Building A arrived DOC/i), { target: { value: '14950' } });
    fireEvent.change(screen.getByLabelText(/Building B arrived DOC/i), { target: { value: '14950' } });
    fireEvent.change(screen.getByLabelText(/Building C arrived DOC/i), { target: { value: '14950' } });
    fireEvent.change(screen.getByLabelText(/Building A DOA/i), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText(/Building B DOA/i), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText(/Building C DOA/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/Building A sample weight/i), { target: { value: '42' } });
    fireEvent.change(screen.getByLabelText(/Building B sample weight/i), { target: { value: '41' } });
    fireEvent.change(screen.getByLabelText(/Building C sample weight/i), { target: { value: '43' } });

    expect(screen.getByText('44,850')).toBeInTheDocument();
    expect(screen.getByText('73')).toBeInTheDocument();
    expect(screen.getByText('44,777')).toBeInTheDocument();
    expect(screen.getByText('42.0 g')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save arrival/i }));

    await waitFor(() => {
      expect(patchPayload).toMatchObject({
        totalChicksLoaded: 44850,
        actualChicksArrived: 44850,
        doaCount: 73,
        netChicksPlaced: 44777,
        arrivalSampleWeightGrams: 42,
        status: 'ONGOING',
      });
    });
    expect(patchPayload.loadings).toHaveLength(3);
    expect(patchPayload.loadings.reduce((sum, row) => sum + row.chicksLoaded, 0)).toBe(44850);
    expect(patchPayload.loadings).toEqual([
      expect.objectContaining({ building: 'A', chicksLoaded: 14950, doaCount: 25, netChicksPlaced: 14925, sampleWeightGrams: 42 }),
      expect.objectContaining({ building: 'B', chicksLoaded: 14950, doaCount: 18, netChicksPlaced: 14932, sampleWeightGrams: 41 }),
      expect.objectContaining({ building: 'C', chicksLoaded: 14950, doaCount: 30, netChicksPlaced: 14920, sampleWeightGrams: 43 }),
    ]);
    expect(setActiveBatch).toHaveBeenCalledWith(expect.objectContaining({
      id: 47,
      totalChicksLoaded: 44850,
      actualChicksArrived: 44850,
      doaCount: 73,
      netChicksPlaced: 44777,
      arrivalSampleWeightGrams: 42,
    }));
    expect(onBatchesChanged).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: /Today.s Farm Checklist/i })).toBeInTheDocument();
  });

  it('allows switching mobile tabs in Post Batch mode', async () => {
    renderComponent({ activeBatch: mockBatchPostSummary });

    const overviewTab = screen.getByRole('button', { name: /^Reports$/i });
    const buildingsTab = screen.getByRole('button', { name: /^Buildings$/i });
    const checksTab = screen.getByRole('button', { name: /^Checks$/i });

    // Default tab is 'overview'
    expect(overviewTab).toHaveClass('border-app-accent');
    expect(buildingsTab).toHaveClass('border-transparent');

    // In CLOSED / Post Batch mode, Tab 2 switches to 'buildings', Tab 3 switches to 'checks'
    fireEvent.keyDown(window, { key: '2' });
    expect(overviewTab).toHaveClass('border-transparent');
    expect(buildingsTab).toHaveClass('border-app-accent');

    fireEvent.keyDown(window, { key: '3' });
    expect(buildingsTab).toHaveClass('border-transparent');
    expect(checksTab).toHaveClass('border-app-accent');

    fireEvent.keyDown(window, { key: '1' });
    expect(checksTab).toHaveClass('border-transparent');
    expect(overviewTab).toHaveClass('border-app-accent');
  });

  it('shows arrival quick-entry totals in post-summary reports and building closeout', async () => {
    server.use(
      http.get(apiPath('/batches/:batchId/loadings'), () => json([
        {
          id: 1,
          building: 'A',
          chicksLoaded: 600,
          doaCount: 8,
          netChicksPlaced: 592,
          sampleWeightGrams: 42.5,
          loadingSharePct: 60,
        },
        {
          id: 2,
          building: 'B',
          chicksLoaded: 400,
          doaCount: 4,
          netChicksPlaced: 396,
          sampleWeightGrams: 41.5,
          loadingSharePct: 40,
        },
      ]))
    );

    renderComponent({
      activeBatch: {
        ...mockBatchPostSummary,
        id: 88,
        totalChicksLoaded: 1000,
        actualChicksArrived: 1000,
        plannedFlock: 1000,
        doaCount: 12,
        netChicksPlaced: 988,
        arrivalSampleWeightGrams: 42.1,
      },
      logs: [
        { id: 1, date: '2026-04-02', building: 'A', feed: 2, mortality: 3, averageWeightGrams: 900 },
        { id: 2, date: '2026-04-02', building: 'B', feed: 1, mortality: 2, averageWeightGrams: 880 },
      ],
    });

    expect(await screen.findByText('Arrival Quality')).toBeInTheDocument();
    expect(screen.getByText('Arrived DOC')).toBeInTheDocument();
    expect(screen.getAllByText('Net placed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sample wt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.getAllByText('988').length).toBeGreaterThan(0);
    expect(screen.getAllByText('42.1 g').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /^Buildings$/i }));
    expect(await screen.findByText('592')).toBeInTheDocument();
    expect(screen.getByText('396')).toBeInTheDocument();
    expect(screen.getByText('42.5 g')).toBeInTheDocument();
    expect(screen.getByText('41.5 g')).toBeInTheDocument();
  });

  it('ignores keys when focused on input fields', async () => {
    renderComponent();

    const overviewTab = screen.getByRole('button', { name: /^Daily Logs$/i });
    const checklistTab = screen.getByRole('button', { name: /^Checklist$/i });

    // Default is overview
    expect(overviewTab).toHaveClass('border-app-accent');
    expect(checklistTab).toHaveClass('border-transparent');

    // Create a dummy input, focus on it, and type '2'
    const dummyInput = document.createElement('input');
    document.body.appendChild(dummyInput);
    dummyInput.focus();

    fireEvent.keyDown(dummyInput, { key: '2', target: dummyInput });

    // The tab should NOT switch
    expect(overviewTab).toHaveClass('border-app-accent');
    expect(checklistTab).toHaveClass('border-transparent');

    document.body.removeChild(dummyInput);
  });

  it('closes active tooltip modal when Escape is pressed', async () => {
    renderComponent();

    // Find the first info button and click it to open the tooltip modal
    const infoBtns = screen.getAllByTitle('Click for explanation');
    expect(infoBtns.length).toBeGreaterThan(0);
    fireEvent.click(infoBtns[0]);

    // Verify tooltip modal is open
    expect(screen.getByLabelText('Close explanation')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Verify the tooltip modal is closed
    expect(screen.queryByLabelText('Close explanation')).not.toBeInTheDocument();
  });

  it('surfaces day-one arrival tasks first after a cycle handoff', async () => {
    server.use(
      http.get(apiPath('/batches/:batchId/loadings'), () => json([
        { id: 1, building: 'A', chicksLoaded: 900 }
      ])),
      http.get(apiPath('/batches/:batchId/employee-assignments'), () => json([])),
      http.get(apiPath('/inventory/items'), () => json([
        { id: 1, name: 'Starter Feed', category: 'Feed', currentStock: 2, reorderLevel: 5 }
      ])),
      http.get(apiPath('/batches/:batchId/harvest-production-summary'), () => json({
        totals: { birds: 0 },
        perHarvest: [],
      }))
    );

    renderComponent({
      activeBatch: {
        ...mockBatchActive,
        id: 55,
        totalChicksLoaded: 900,
        plannedFlock: 1000,
        status: 'ONGOING',
      },
      initialEntries: [{
        pathname: '/today',
        search: '?handoff=day-one',
        state: { dayOneHandoffBatchId: 55 },
      }],
    });

    const handoffTitle = await screen.findByText(/Day-one arrival handoff/i);
    expect(screen.getByText(/Batch 55 is now active/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirm arrival counts/i)).toBeInTheDocument();
    expect(screen.getByText(/Record first daily log/i)).toBeInTheDocument();

    const normalChecklist = screen.getByText(/Active Operations Checklist/i);
    expect(Boolean(
      handoffTitle.compareDocumentPosition(normalChecklist) & Node.DOCUMENT_POSITION_FOLLOWING
    )).toBe(true);
  });

  it('shows a usable offline state when current batch and batch list requests fail', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get(apiPath('/auth/me'), () => json({
        user: {
          id: 9,
          username: 'offline.manager',
          role: 'OperationManager',
          isPrimaryOwner: false,
        },
      })),
      http.get(apiPath('/public/current-batch'), () => HttpResponse.error()),
      http.get(apiPath('/batches'), () => HttpResponse.error())
    );

    try {
      render(
        <NotificationProvider>
          <MemoryRouter initialEntries={['/today']}>
            <App />
          </MemoryRouter>
        </NotificationProvider>
      );

      expect(await screen.findByRole('heading', { name: /^Today$/i })).toBeInTheDocument();
      expect(await screen.findByText(/Batch data unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/batch list loads/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Open Batches/i })).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });
});
