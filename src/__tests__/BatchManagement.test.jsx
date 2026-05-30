import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import BatchManagement from '../features/batches/BatchManagement';
import NotificationProvider from '../shared/components/NotificationProvider';

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
});
