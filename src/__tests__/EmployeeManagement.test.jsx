import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import EmployeeManagement from '../features/employees/EmployeeManagement';
import NotificationProvider from '../shared/components/NotificationProvider';
import { apiClient } from '../shared/utils/apiClient';

vi.mock('../shared/utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('EmployeeManagement', () => {
  it('loads employees when the buildings endpoint is missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    apiClient.get.mockImplementation((path) => {
      if (path === '/api/employees') {
        return Promise.resolve([
          { id: 29, name: 'Jane', displayName: 'Jane', position: 'Worker', assignedBuilding: 'A' }
        ]);
      }

      if (path === '/api/buildings') {
        return Promise.reject(new Error('Request failed with status 404'));
      }

      if (path === '/api/batches/20260604-02/employee-compensations') {
        return Promise.resolve([
          {
            employeeId: 29,
            employeeName: 'Jane',
            position: 'Worker',
            assignedBuilding: 'A',
            batchId: '20260604-02',
            handledBirds: 0,
            ratePerBird: 1.5,
            corpoGroup: '',
            remarks: ''
          }
        ]);
      }

      if (path === '/api/batches/20260604-02/loadings') {
        return Promise.resolve([]);
      }

      return Promise.resolve([]);
    });

    render(
      <NotificationProvider>
        <EmployeeManagement
          token="test-token"
          activeBatch={{ id: '20260604-02' }}
          canEditOrDelete={true}
        />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });

    expect(screen.queryByText('Request failed with status 404')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();

    console.warn.mockRestore();
  });
});
