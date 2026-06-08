import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../app/App';
import NotificationProvider from '../shared/components/NotificationProvider';
import { server } from '../test/mswServer';

vi.mock('../offline/db', () => ({
  addToQueue: vi.fn(),
  getQueue: vi.fn(async () => []),
  removeFromQueue: vi.fn(),
  updateQueueStatus: vi.fn(),
  saveCache: vi.fn(async () => {}),
  getCache: vi.fn(async () => null),
}));

vi.mock('../offline/syncQueue', () => ({
  enqueueRequest: vi.fn(),
  processSyncQueue: vi.fn(),
}));

function apiPath(path) {
  return `*/api${path}`;
}

function renderApp() {
  return render(
    <StrictMode>
      <NotificationProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </NotificationProvider>
    </StrictMode>
  );
}

describe('auth startup resilience', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('quietly falls back to the intro screen when the local backend is unavailable', async () => {
    let authMeCalls = 0;
    let currentBatchCalls = 0;
    const savedUser = {
      id: 31,
      username: 'saved.manager',
      role: 'OperationManager',
      isPrimaryOwner: false,
    };
    localStorage.setItem('octavioUser', JSON.stringify(savedUser));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    server.use(
      http.get(apiPath('/auth/me'), () => {
        authMeCalls += 1;
        return HttpResponse.text('Proxy unavailable', { status: 502 });
      }),
      http.get(apiPath('/public/current-batch'), () => {
        currentBatchCalls += 1;
        return HttpResponse.text('Proxy unavailable', { status: 502 });
      })
    );

    renderApp();

    expect(await screen.findByRole('button', { name: /^Member Login$/i })).toBeInTheDocument();
    expect(screen.queryByText(/saved session could not be verified/i)).not.toBeInTheDocument();
    expect(localStorage.getItem('octavioUser')).toContain('saved.manager');
    expect(authMeCalls).toBe(1);
    expect(currentBatchCalls).toBe(1);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('still reports an invalid saved session when the backend returns 401', async () => {
    localStorage.setItem('octavioUser', JSON.stringify({
      id: 32,
      username: 'expired.manager',
      role: 'OperationManager',
      isPrimaryOwner: false,
    }));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    server.use(
      http.get(apiPath('/auth/me'), () => HttpResponse.json(
        { error: 'Unauthenticated' },
        { status: 401 }
      )),
      http.get(apiPath('/public/current-batch'), () => HttpResponse.json({
        batch: null,
        batches: [],
        logs: [],
      }))
    );

    renderApp();

    expect(await screen.findByText(/saved session could not be verified/i)).toBeInTheDocument();
    expect(localStorage.getItem('octavioUser')).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
