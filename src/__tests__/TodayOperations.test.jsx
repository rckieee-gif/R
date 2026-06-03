import { render, screen, fireEvent } from '@testing-library/react';
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
