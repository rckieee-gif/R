import { useState, useEffect, useCallback } from 'react';
import { publicViewerUser } from '../../shared/utils/publicViewerData';
import { apiClient, registerAuthFailureHandler, setFallbackAuthToken } from '../../shared/utils/apiClient';

const COOKIE_SESSION_MARKER = 'cookie-session';
const FALLBACK_TOKEN_KEY = 'octavioToken';

function readStoredUser() {
  const savedUser = localStorage.getItem('octavioUser');
  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser);
  } catch (err) {
    console.error("Failed to parse user session:", err);
    localStorage.removeItem('octavioUser');
    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem('octavioUser');
  localStorage.removeItem(FALLBACK_TOKEN_KEY);
  setFallbackAuthToken(null);
}

export default function useAuth() {
  const [user, setUser] = useState(() => readStoredUser());
  const [token, setToken] = useState(() => localStorage.getItem(FALLBACK_TOKEN_KEY) || (readStoredUser() ? COOKIE_SESSION_MARKER : null));
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [authView, setAuthView] = useState('intro');
  const [viewerSnapshot, setViewerSnapshot] = useState(null);
  const [viewerError, setViewerError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [preloadedSnapshot, setPreloadedSnapshot] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const hadStoredUser = Boolean(localStorage.getItem('octavioUser'));
      const fallbackToken = localStorage.getItem(FALLBACK_TOKEN_KEY);

      try {
        const data = await apiClient.get('/api/auth/me', {
          retries: 0,
          suppressAuthFailure: true,
        });
        if (data && data.user) {
          setUser(data.user);
          setToken(COOKIE_SESSION_MARKER);
          setFallbackAuthToken(null);
          localStorage.removeItem(FALLBACK_TOKEN_KEY);
          setSessionError('');
          localStorage.setItem('octavioUser', JSON.stringify(data.user));
        } else {
          setUser(null);
          setToken(null);
          clearStoredSession();
        }
      } catch (err) {
        if (fallbackToken) {
          try {
            const data = await apiClient.get('/api/auth/me', {
              authToken: fallbackToken,
              retries: 0,
              suppressAuthFailure: true,
            });
            if (data?.user) {
              setFallbackAuthToken(fallbackToken);
              setUser(data.user);
              setToken(fallbackToken);
              setSessionError('');
              localStorage.setItem('octavioUser', JSON.stringify(data.user));
              return;
            }
          } catch (fallbackErr) {
            if (fallbackErr.status !== 401) {
              console.error("Bearer fallback session verification failed:", fallbackErr);
            }
          }
        }

        if (err.status !== 401) {
          console.error("Session verification failed:", err);
        }
        if (hadStoredUser) {
          setSessionError('Your saved session could not be verified. Please sign in again.');
        }
        setUser(null);
        setToken(null);
        clearStoredSession();
      } finally {
        setIsCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const preloadSnapshot = async () => {
      try {
        const data = await apiClient.get('/api/public/current-batch');
        if (isMounted) {
          setPreloadedSnapshot(data);
        }
      } catch (err) {
        console.error("Failed to preload public current batch snapshot:", err);
      }
    };
    preloadSnapshot();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = useCallback((userData, authToken = null) => {
    setUser(userData);
    setToken(authToken || COOKIE_SESSION_MARKER);
    setAuthView('intro');
    setSessionError('');
    localStorage.setItem('octavioUser', JSON.stringify(userData));
    if (authToken) {
      setFallbackAuthToken(authToken);
      localStorage.setItem(FALLBACK_TOKEN_KEY, authToken);
    } else {
      setFallbackAuthToken(null);
      localStorage.removeItem(FALLBACK_TOKEN_KEY);
    }
  }, []);

  const clearSession = useCallback((message = '') => {
    apiClient.post('/api/auth/logout').catch(err => {
      console.warn("Backend logout failed or session already cleared:", err);
    });
    setUser(null);
    setToken(null);
    setViewerSnapshot(null);
    setViewerError('');
    setSessionError(message);
    clearStoredSession();
    setAuthView('intro');
  }, []);

  useEffect(() => {
    registerAuthFailureHandler(() => {
      clearSession('Your session could not be verified. Please sign in again.');
    });
    return () => {
      registerAuthFailureHandler(null);
    };
  }, [clearSession]);

  const handleViewerAccess = useCallback(async () => {
    setIsViewerLoading(true);
      setViewerError('');
      setSessionError('');

    try {
      let data = preloadedSnapshot;
      if (!data) {
        data = await apiClient.get('/api/public/current-batch');
      }

      const liveBatch = data.batch || data.batches?.[0] || null;

      if (!liveBatch) {
        throw new Error('No current batch is available for viewer access.');
      }

      const nextSnapshot = {
        ...data,
        batch: liveBatch,
        batches: data.batches?.length ? data.batches : [liveBatch],
        logs: data.logs || [],
      };

      setViewerSnapshot(nextSnapshot);
      setUser({
        ...publicViewerUser,
        username: 'viewer.live',
        email: 'viewer@octavio.live',
      });
      setToken(null);
      localStorage.removeItem('octavioUser');
      localStorage.removeItem(FALLBACK_TOKEN_KEY);
      setFallbackAuthToken(null);
    } catch (error) {
      console.error('Failed to open viewer mode:', error);
      setViewerError(error.message || 'Cannot open the current batch right now.');
    } finally {
      setIsViewerLoading(false);
    }
  }, [preloadedSnapshot]);

  const isPublicViewer = Boolean(user?.isPublicViewer);
  const apiToken = isPublicViewer ? null : token;
  const viewerPreviewData = isPublicViewer ? viewerSnapshot : null;

  return {
    user,
    token,
    apiToken,
    isPublicViewer,
    authView,
    setAuthView,
    viewerSnapshot,
    viewerPreviewData,
    viewerError,
    sessionError,
    setViewerError,
    isViewerLoading,
    preloadedSnapshot,
    handleLogin,
    handleViewerAccess,
    handleLogout: clearSession,
    clearSession,
    isCheckingSession
  };
}
