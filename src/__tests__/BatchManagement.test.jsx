import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import BatchManagement from '../features/batches/BatchManagement';
import NotificationProvider from '../shared/components/NotificationProvider';
import { server } from '../test/mswServer';

function json(data, status = 200) {
  return HttpResponse.json(data, { status });
}

function apiPath(path) {
  return `*/api${path}`;
}

describe('BatchManagement', () => {
  it('shows the active batch in history when the shared list is temporarily empty', () => {
    const activeBatch = {
      id: '20260604-02',
      startDate: '2026-06-04',
      status: 'ONGOING',
      totalChicksLoaded: 0
    };

    render(
      <NotificationProvider>
        <BatchManagement
          activeBatch={activeBatch}
          setActiveBatch={vi.fn()}
          token={null}
          readOnly={true}
          batchList={[]}
          isBatchListLoading={false}
        />
      </NotificationProvider>
    );

    expect(screen.getByText('Current Active Batch')).toBeInTheDocument();
    expect(screen.getAllByText('20260604-02')).toHaveLength(2);
    expect(screen.queryByText('No batches created yet.')).not.toBeInTheDocument();
  });

  it('selects and hands off an incoming batch after starting its cycle', async () => {
    const activeBatch = {
      id: '20260604-01',
      startDate: '2026-06-01',
      status: 'ONGOING',
      totalChicksLoaded: 800
    };
    const incomingBatch = {
      id: '20260604-02',
      startDate: '2026-06-04',
      targetHarvestDate: '2026-07-10',
      status: 'ON_THE_WAY',
      totalChicksLoaded: 0,
      plannedFlock: 1000,
      mortalityAllowance: 50,
      targetFeedKg: 0,
      notes: ''
    };
    const updatedBatch = {
      ...incomingBatch,
      status: 'ONGOING',
      totalChicksLoaded: 1000
    };
    const setActiveBatch = vi.fn();
    const onCycleStarted = vi.fn();
    const patches = [];

    server.use(
      http.get(apiPath('/buildings'), () => json([{ id: 1, name: 'A' }])),
      http.get(apiPath('/batches/:batchId/loadings'), () => json([
        { id: 10, building: 'A', chicksLoaded: 1000, loadingSharePct: 100, remarks: '' }
      ])),
      http.patch(apiPath('/batches/:batchId'), async ({ request }) => {
        patches.push(await request.json());
        return json(updatedBatch);
      })
    );

    render(
      <NotificationProvider>
        <BatchManagement
          activeBatch={activeBatch}
          setActiveBatch={setActiveBatch}
          token="manager-token"
          canEditOrDelete={true}
          batchList={[activeBatch, incomingBatch]}
          onCycleStarted={onCycleStarted}
        />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /^Start cycle$/i }));
    await screen.findByDisplayValue('ONGOING');

    fireEvent.click(screen.getByRole('button', { name: /Start \/ Update Cycle/i }));

    await waitFor(() => {
      expect(patches).toHaveLength(1);
    });
    expect(patches[0]).toEqual(expect.objectContaining({
      status: 'ONGOING',
      totalChicksLoaded: 1000,
      plannedFlock: 1000
    }));
    expect(setActiveBatch).toHaveBeenCalledWith(updatedBatch);
    expect(onCycleStarted).toHaveBeenCalledWith(updatedBatch);
  });
});
