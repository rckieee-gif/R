import { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

  it('keeps batch-history arrival variance neutral until arrived DOC is recorded', () => {
    const incomingBatch = {
      id: '20260604-02',
      startDate: '2026-06-04',
      status: 'ON_THE_WAY',
      totalChicksLoaded: 900,
      actualChicksArrived: 0,
      plannedFlock: 1000,
      mortalityAllowance: 50
    };

    render(
      <NotificationProvider>
        <BatchManagement
          activeBatch={incomingBatch}
          setActiveBatch={vi.fn()}
          token={null}
          readOnly={true}
          batchList={[incomingBatch]}
          isBatchListLoading={false}
        />
      </NotificationProvider>
    );

    expect(screen.getByText('Arrival variance')).toBeInTheDocument();
    expect(screen.getByText('Enter building chick counts when the delivery arrives.')).toBeInTheDocument();
    expect(screen.queryByText('-100')).not.toBeInTheDocument();
    expect(screen.queryByText('100 below planned flock (-10%).')).not.toBeInTheDocument();
  });

  it('deletes a selected closed batch from history when batch id types differ', async () => {
    const closedBatch = {
      id: '20260418',
      startDate: '2026-04-18',
      targetHarvestDate: '2026-05-23',
      status: 'CLOSED',
      totalChicksLoaded: 900,
      actualChicksArrived: 900,
      plannedFlock: 900,
      mortalityAllowance: 35
    };
    const nextBatch = {
      id: '20260604-02',
      startDate: '2026-06-04',
      status: 'ONGOING',
      totalChicksLoaded: 1000,
      actualChicksArrived: 1000,
      plannedFlock: 1000,
      mortalityAllowance: 50
    };
    const deletedBatchIds = [];
    const setActiveBatch = vi.fn();

    server.use(
      http.delete(apiPath('/batches/:batchId'), ({ params }) => {
        deletedBatchIds.push(params.batchId);
        return json({ ok: true });
      })
    );

    function Harness() {
      const [activeBatch, setActiveBatchState] = useState({ ...closedBatch, id: 20260418 });

      const handleSetActiveBatch = (batch) => {
        setActiveBatch(batch);
        setActiveBatchState(batch);
      };

      return (
        <NotificationProvider>
          <BatchManagement
            activeBatch={activeBatch}
            setActiveBatch={handleSetActiveBatch}
            token={null}
            canEditOrDelete={true}
            batchList={[closedBatch, nextBatch]}
            isBatchListLoading={false}
          />
        </NotificationProvider>
      );
    }

    render(<Harness />);

    const selectedButton = screen.getByRole('button', { name: /^Selected$/i });
    const closedBatchCard = selectedButton.closest('.bg-app-card');

    expect(closedBatchCard).not.toBeNull();
    expect(within(closedBatchCard).getByText('Status: CLOSED')).toBeInTheDocument();

    fireEvent.click(within(closedBatchCard).getByRole('button', { name: /^Delete$/i }));
    expect(await screen.findByText(/Are you sure you want to delete batch 20260418/i)).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/i });
    fireEvent.click(deleteButtons.at(-1));

    await waitFor(() => {
      expect(deletedBatchIds).toEqual(['20260418']);
    });
    expect(setActiveBatch).toHaveBeenCalledWith(nextBatch);

    await waitFor(() => {
      expect(screen.queryByText('20260418')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('20260604-02')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Selected$/i })).toBeInTheDocument();
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
        { id: 10, building: 'A', chicksLoaded: 1000, doaCount: 12, sampleWeightGrams: 42.5, loadingSharePct: 100, remarks: '' }
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
      actualChicksArrived: 1000,
      doaCount: 12,
      netChicksPlaced: 988,
      arrivalSampleWeightGrams: 42.5,
      plannedFlock: 1000
    }));
    expect(patches[0].loadings).toEqual([
      expect.objectContaining({
        building: 'A',
        chicksLoaded: 1000,
        doaCount: 12,
        netChicksPlaced: 988,
        sampleWeightGrams: 42.5
      })
    ]);
    expect(setActiveBatch).toHaveBeenCalledWith(updatedBatch);
    expect(onCycleStarted).toHaveBeenCalledWith(updatedBatch);
  });
});
