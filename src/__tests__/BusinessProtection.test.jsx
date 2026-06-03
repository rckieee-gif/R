import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from '../app/App';
import TransactionLedger from '../features/ledger/TransactionLedger';
import HarvestRecording from '../features/harvest/HarvestRecording';
import InventoryManagement from '../features/inventory/InventoryManagement';
import NotificationProvider from '../shared/components/NotificationProvider';
import { server } from '../test/mswServer';
import { processSyncQueue } from '../offline/syncQueue';

const queueState = vi.hoisted(() => ({
  items: [],
}));

vi.mock('../offline/db', () => ({
  addToQueue: vi.fn(async (item) => {
    queueState.items.push(item);
  }),
  getQueue: vi.fn(async () => queueState.items),
  removeFromQueue: vi.fn(async (id) => {
    queueState.items = queueState.items.filter((item) => item.id !== id);
  }),
  updateQueueStatus: vi.fn(async (id, status, error = null) => {
    queueState.items = queueState.items.map((item) => (
      item.id === id ? { ...item, status, error } : item
    ));
  }),
  saveCache: vi.fn(async () => {}),
  getCache: vi.fn(async () => null),
}));

const activeBatch = {
  id: 1,
  batchCode: 'BATCH-01',
  startDate: '2026-05-01',
  status: 'ACTIVE',
  totalChicksLoaded: 10000,
};

const buildings = [{ id: 1, name: 'A' }];
const feedItems = [{ id: 10, name: 'Starter Feed', category: 'Feed', currentStock: 20, unit: 'sacks' }];
const assignments = [{
  employeeId: 20,
  employeeName: 'Worker Rolly',
  assignedBuilding: 'A',
  handledBirds: 5000,
  buildingChicksLoaded: 5000,
}];

function json(data, status = 200) {
  return HttpResponse.json(data, { status });
}

function apiPath(path) {
  return `*/api${path}`;
}

function mockAuthenticatedUser(user) {
  server.use(
    http.get(apiPath('/auth/me'), () => json({ user }))
  );
}

function mockCommonAppApi() {
  server.use(
    http.get(apiPath('/public/current-batch'), () => json({
      batch: activeBatch,
      batches: [activeBatch],
      logs: [],
      inventoryItems: feedItems,
      feedItems,
      loadings: [{ id: 1, batchId: 1, building: 'A', chicksLoaded: 5000 }],
    })),
    http.get(apiPath('/batches'), () => json([activeBatch])),
    http.get(apiPath('/logs'), () => json([])),
    http.get(apiPath('/buildings'), () => json(buildings)),
    http.get(apiPath('/inventory/items'), () => json(feedItems)),
    http.get(apiPath('/batches/:batchId/employee-assignments'), () => json(assignments)),
    http.get(apiPath('/batches/:batchId/loadings'), () => json([{ id: 1, building: 'A', chicksLoaded: 5000 }])),
    http.get(apiPath('/batches/:batchId/harvest-production-summary'), () => json({
      totals: { birds: 0 },
      perHarvest: [],
    }))
  );
}

describe('Business protection coverage', () => {
  beforeEach(() => {
    queueState.items = [];
    localStorage.setItem('octavioZeroGravityEnabled', 'false');
  });

  it('lets a DataEntry user add a daily log through the real API client', async () => {
    const createdLogs = [];
    mockCommonAppApi();
    server.use(
      http.post(apiPath('/logs'), async ({ request }) => {
        const body = await request.json();
        createdLogs.push(body);
        return json({ id: 99, ...body });
      })
    );
    mockAuthenticatedUser({
      id: 7,
      username: 'data.entry',
      role: 'DataEntry',
      isPrimaryOwner: false,
    });

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={['/daily-log']}>
          <App />
        </MemoryRouter>
      </NotificationProvider>
    );

    await screen.findByRole('heading', { name: /^Daily Logs$/i });
    fireEvent.click(await screen.findByRole('button', { name: /next/i }));

    await screen.findByText(/2. Worker/i);
    await waitFor(() => {
      expect(screen.getByLabelText(/Employee Share/i)).toHaveValue('20');
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await screen.findByText(/3. Feed/i);
    fireEvent.change(screen.getByLabelText(/Feed Used/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await screen.findByText(/4. Mortality/i);
    fireEvent.change(screen.getByLabelText(/Mortality/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await screen.findByText(/5. Weight/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await screen.findByText(/6. Warnings/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await screen.findByText(/7. Save/i);
    fireEvent.click(screen.getByRole('button', { name: /save log/i }));

    await waitFor(() => {
      expect(createdLogs).toHaveLength(1);
    });
    expect(createdLogs[0]).toEqual(expect.objectContaining({
      batchId: activeBatch.id,
      building: 'A',
      employeeId: 20,
      feed: 5,
      mortality: 1,
    }));
  });

  it('redirects a Viewer away from financial screens', async () => {
    mockCommonAppApi();
    mockAuthenticatedUser({
      id: 8,
      username: 'viewer.user',
      role: 'Viewer',
      isPrimaryOwner: false,
    });

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={['/ledger']}>
          <App />
        </MemoryRouter>
      </NotificationProvider>
    );

    await screen.findByRole('heading', { name: /^Today$/i });
    expect(screen.queryByRole('heading', { name: /^Expenses$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save record/i })).not.toBeInTheDocument();
  });

  it('blocks negative transaction amounts before the API is called', async () => {
    const transactionPosts = [];
    server.use(
      http.get(apiPath('/buildings'), () => json(buildings)),
      http.get(apiPath('/categories'), () => json([{ id: 1, name: 'Medicine', fundingNature: 'OPEX' }])),
      http.get(apiPath('/stakeholders'), () => json([{ id: 1, name: 'Rolly' }, { id: 2, name: 'Supplier' }])),
      http.get(apiPath('/inventory/items'), () => json(feedItems)),
      http.post(apiPath('/batches/:batchId/transactions'), async ({ request }) => {
        transactionPosts.push(await request.json());
        return json({ id: 123 });
      })
    );

    render(
      <NotificationProvider>
        <TransactionLedger
          transactions={[]}
          setTransactions={vi.fn()}
          activeBatch={activeBatch}
          token="manager-token"
        />
      </NotificationProvider>
    );

    await screen.findByRole('button', { name: /save record/i });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Medicine purchase' } });
    const amountInput = screen.getByLabelText('Amount');
    fireEvent.change(amountInput, { target: { value: '-25' } });
    fireEvent.change(screen.getByLabelText('Paid To'), { target: { value: 'Supplier' } });
    fireEvent.click(screen.getByRole('button', { name: /save record/i }));

    expect(amountInput).toBeInvalid();
    expect(transactionPosts).toHaveLength(0);
  });

  it('does not expose harvest recording actions without a batch ID', () => {
    render(
      <NotificationProvider>
        <HarvestRecording activeBatch={null} token="manager-token" />
      </NotificationProvider>
    );

    expect(screen.getByText(/Select a batch before recording harvest details/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /post summary/i })).not.toBeInTheDocument();
  });

  it('blocks inventory movements that would send stock below zero', async () => {
    const movementPosts = [];
    server.use(
      http.get(apiPath('/inventory/items'), () => json([
        { id: 1, name: 'Starter Feed', category: 'Feed', currentStock: 5, targetQuantity: 100, reorderLevel: 10, unit: 'sacks' },
      ])),
      http.get(apiPath('/inventory/movements'), () => json([])),
      http.get(apiPath('/buildings'), () => json(buildings)),
      http.get(apiPath('/stakeholders'), () => json([{ id: 1, name: 'Rolly' }])),
      http.post(apiPath('/inventory/movements'), async ({ request }) => {
        movementPosts.push(await request.json());
        return json({ id: 500 });
      })
    );

    render(<InventoryManagement token="manager-token" activeBatch={activeBatch} />);

    await screen.findByRole('button', { name: /save movement/i });
    fireEvent.change(screen.getByDisplayValue('Stock In'), { target: { value: 'Stock Out' } });
    fireEvent.change(screen.getAllByPlaceholderText('0')[2], { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /save movement/i }));

    await screen.findByText(/Starter Feed cannot go below zero stock/i);
    expect(movementPosts).toHaveLength(0);
  });

  it('syncs concurrent offline queue attempts once and carries the de-dupe header', async () => {
    let resolveRequest;
    const requestPromise = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    queueState.items = [{
      id: 'queue-entry-1',
      type: 'CREATE_DAILY_LOG',
      url: '/api/logs',
      method: 'POST',
      payload: { batchId: 1, building: 'A', feed: 5 },
      status: 'pending',
      error: null,
    }];
    const directApiClient = {
      request: vi.fn(() => requestPromise),
    };

    const firstSync = processSyncQueue(directApiClient);
    const secondSync = processSyncQueue(directApiClient);

    await waitFor(() => {
      expect(directApiClient.request).toHaveBeenCalledTimes(1);
    });
    expect(directApiClient.request).toHaveBeenCalledWith('/api/logs', expect.objectContaining({
      method: 'POST',
      headers: { 'X-Sync-Queue-Id': 'queue-entry-1' },
    }));

    resolveRequest({ id: 10 });
    await Promise.all([firstSync, secondSync]);
    expect(queueState.items).toEqual([]);
  });
});
