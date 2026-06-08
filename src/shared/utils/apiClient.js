import { API_BASE } from './api';
import { saveCache, getCache } from '../../offline/db';
import { enqueueRequest, processSyncQueue } from '../../offline/syncQueue';

let onAuthFailureHandler = null;

function isLocalDevApiPath(path) {
  return import.meta.env.DEV && API_BASE === '' && typeof path === 'string' && path.startsWith('/api/');
}

export function isBackendUnavailableError(error) {
  return Boolean(error?.isBackendUnavailable);
}

function markBackendUnavailable(error, path) {
  if (!isLocalDevApiPath(path)) return error;

  const isProxyFailure = error?.status === 502 || error?.status === 504;
  const isNetworkFailure = error instanceof TypeError || /fetch|network/i.test(error?.message || '');

  if (isProxyFailure || isNetworkFailure) {
    error.isBackendUnavailable = true;
  }

  return error;
}

/**
 * Register a callback to be executed when a 401 Unauthorized response is received.
 * Used to log the user out and clean up session state.
 */
export function registerAuthFailureHandler(handler) {
  onAuthFailureHandler = handler;
}

function isQueueablePath(path) {
  return (
    path.startsWith('/api/logs') ||
    path.startsWith('/api/batches') ||
    path.startsWith('/api/inventory') ||
    path.startsWith('/api/employees') ||
    path.startsWith('/api/quick-entry')
  );
}

function getSyncType(path, method) {
  if (path.startsWith('/api/logs')) return method === 'POST' ? 'CREATE_DAILY_LOG' : 'UPDATE_DAILY_LOG';
  if (path.startsWith('/api/inventory/items')) return 'SAVE_INVENTORY_ITEM';
  if (path.startsWith('/api/inventory/movements')) return 'SAVE_INVENTORY_MOVEMENT';
  if (path.includes('/transactions')) return path.endsWith('/void') ? 'VOID_TRANSACTION' : 'SAVE_TRANSACTION';
  if (path.includes('/harvest-report')) return 'SAVE_HARVEST_REPORT';
  if (path.startsWith('/api/employees')) return 'SAVE_EMPLOYEE';
  return `MUTATION_${method}`;
}

function generateMockResponse(path, method, bodyParsed) {
  const mockId = Math.floor(Math.random() * -100000);
  return {
    id: mockId,
    ...(bodyParsed || {}),
    isOfflineDraft: true,
    createdAt: new Date().toISOString()
  };
}

/**
 * Robust fetch wrapper that handles auth headers, retries, global errors, and array validation.
 * Intercepts connection errors to serve cached reads or queue updates locally.
 */
export async function request(path, options = {}) {
  const method = options.method || 'GET';
  const isGet = method === 'GET';
  const isMutationMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const isQueueRequest = options.headers?.['X-Sync-Queue-Id'];
  const {
    authToken,
    bearerToken,
    suppressAuthFailure = false,
    quietOnBackendUnavailable = false,
    backendUnavailableFallback = null,
    retries,
    returnResponse,
    expectArray,
    ...fetchOptionOverrides
  } = options;
  const explicitBearerToken = bearerToken || authToken;
  const shouldUseCache = isGet && !path.startsWith('/api/auth/');

  // Fast offline guard: if completely offline, intercept mutation requests immediately
  if (!navigator.onLine && isMutationMethod && !isQueueRequest) {
    if (isQueueablePath(path)) {
      console.log(`Offline: queuing request for ${path}`);
      const bodyParsed = options.body ? JSON.parse(options.body) : null;
      await enqueueRequest(getSyncType(path, method), path, method, bodyParsed);
      return generateMockResponse(path, method, bodyParsed);
    }
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  const headers = {
    ...options.headers,
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (explicitBearerToken && !path.startsWith('http') && !headers.Authorization) {
    headers.Authorization = `Bearer ${explicitBearerToken}`;
  }

  const fetchOptions = {
    ...fetchOptionOverrides,
    credentials: 'include',
    headers,
  };

  // Only retry GET or idempotent requests
  const isIdempotent = method === 'GET';
  const maxRetries = isIdempotent ? (retries ?? 2) : 0;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, fetchOptions);

      // Handle token expiration / unauthorized
      if (response.status === 401) {
        if (path.includes('/api/auth/login')) {
          const contentType = response.headers.get('content-type');
          let data = null;
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }
          const errorMessage = (data && data.error) || 'Invalid username or password';
          throw new Error(errorMessage);
        }

        if (!suppressAuthFailure && onAuthFailureHandler) {
          onAuthFailureHandler();
        }
        const error = new Error('Your session has expired. Please sign in again.');
        error.status = 401;
        throw error;
      }

      // Handle forbidden access
      if (response.status === 403) {
        throw new Error('Access denied: You do not have permission to perform this action.');
      }

      // Handle bad request or server errors
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let data = null;
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
        const errorMessage = (data && data.error) || `Request failed with status ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        throw markBackendUnavailable(error, path);
      }

      if (returnResponse) {
        return response;
      }

      // Handle response parsing
      const contentType = response.headers.get('content-type');
      let data = null;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle array validation to prevent rendering crashes
      if (expectArray && !Array.isArray(data)) {
        console.warn(`Expected array from api path: ${path}, but received:`, data);
        return [];
      }

      // Cache successful GET results
      if (shouldUseCache) {
        saveCache(path, data);
      }

      return data;
    } catch (error) {
      markBackendUnavailable(error, path);
      attempt++;
      // Don't retry if it's an authorization/permission failure or if we've exhausted our retry budget
      if (
        attempt > maxRetries ||
        isBackendUnavailableError(error) ||
        error.message.includes('expired') ||
        error.message.includes('denied')
      ) {
        // Handle offline fallback reads for GET
        if (shouldUseCache) {
          const cached = await getCache(path);
          if (cached !== null) {
            console.log(`Offline fallback: serving cached data for ${path}`);
            return cached;
          }
        }

        // Handle offline fallback queueing for POST/PUT/PATCH/DELETE mutations
        const isConnectionError = isBackendUnavailableError(error) || error instanceof TypeError || error.message.includes('fetch') || !navigator.onLine;
        if (isMutationMethod && !isQueueRequest && isConnectionError && isQueueablePath(path)) {
          console.log(`Offline connection error: queuing request for ${path}`);
          const bodyParsed = options.body ? JSON.parse(options.body) : null;
          await enqueueRequest(getSyncType(path, method), path, method, bodyParsed);
          return generateMockResponse(path, method, bodyParsed);
        }

        if (quietOnBackendUnavailable && isBackendUnavailableError(error)) {
          return backendUnavailableFallback;
        }

        throw error;
      }

      // Exponential backoff before retry (e.g. 400ms, 800ms)
      const delay = Math.pow(2, attempt) * 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export const apiClient = {
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
  request: (path, options = {}) => request(path, options)
};

// Automatic Sync Triggers
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (typeof indexedDB !== 'undefined') {
      processSyncQueue(apiClient);
    }
  });
  
  if (navigator.onLine && typeof indexedDB !== 'undefined') {
    // Stagger slightly on boot
    setTimeout(() => {
      processSyncQueue(apiClient);
    }, 1000);
  }
}
