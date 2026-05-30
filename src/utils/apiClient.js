import { API_BASE } from '../api';

let onAuthFailureHandler = null;

/**
 * Register a callback to be executed when a 401 Unauthorized response is received.
 * Used to log the user out and clean up session state.
 */
export function registerAuthFailureHandler(handler) {
  onAuthFailureHandler = handler;
}

/**
 * Robust fetch wrapper that handles auth headers, retries, global errors, and array validation.
 */
async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const token = localStorage.getItem('octavioToken');

  const headers = {
    ...options.headers,
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !path.startsWith('http')) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers,
  };

  // Only retry GET or idempotent requests
  const isIdempotent = !options.method || options.method === 'GET';
  const maxRetries = isIdempotent ? (options.retries ?? 2) : 0;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, fetchOptions);

      // Handle token expiration / unauthorized
      if (response.status === 401) {
        if (onAuthFailureHandler && path !== '/api/auth/login') {
          onAuthFailureHandler();
        }
        throw new Error('Your session has expired. Please sign in again.');
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
        throw new Error(errorMessage);
      }

      if (options.returnResponse) {
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
      if (options.expectArray && !Array.isArray(data)) {
        console.warn(`Expected array from api path: ${path}, but received:`, data);
        return [];
      }

      return data;
    } catch (error) {
      attempt++;
      // Don't retry if it's an authorization/permission failure or if we've exhausted our retry budget
      if (
        attempt > maxRetries ||
        error.message.includes('expired') ||
        error.message.includes('denied')
      ) {
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
};
