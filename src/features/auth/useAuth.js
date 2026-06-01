import { useState, useEffect, useCallback } from 'react';
import { publicViewerUser } from '../../shared/utils/publicViewerData';
import { apiClient, registerAuthFailureHandler } from '../../shared/utils/apiClient';

export default function useAuth() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('octavioUser');
    if (!savedUser) {
      localStorage.removeItem('octavioToken');
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch (err) {
      console.error("Failed to parse user session:", err);
      localStorage.removeItem('octavioUser');
      localStorage.removeItem('octavioToken');
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('octavioToken'));
  const [isCheckingSession, setIsCheckingSession] = useState(() => {
    const savedUser = localStorage.getItem('octavioUser');
    const savedToken = localStorage.getItem('octavioToken');
    return Boolean(savedUser && !savedToken);
  });
  const [authView, setAuthView] = useState('intro');
  const [viewerSnapshot, setViewerSnapshot] = useState(null);
  const [viewerError, setViewerError] = useState('');
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [preloadedSnapshot, setPreloadedSnapshot] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const savedUser = localStorage.getItem('octavioUser');
      const savedToken = localStorage.getItem('octavioToken');
      if (!savedUser || savedToken) {
        setIsCheckingSession(false);
        return;
      }
      try {
        const data = await apiClient.get('/api/auth/me');
        if (data && data.user) {
          setUser(data.user);
          setToken(data.token);
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem('octavioUser');
          localStorage.removeItem('octavioToken');
        }
      } catch (err) {
        console.error("Session verification failed:", err);
        setUser(null);
        setToken(null);
        localStorage.removeItem('octavioUser');
        localStorage.removeItem('octavioToken');
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

  const handleLogin = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setAuthView('intro');
    localStorage.setItem('octavioUser', JSON.stringify(userData));
    // Secure Cookie auth: do not save token to localStorage in normal web flows
  }, []);

  const clearSession = useCallback(() => {
    apiClient.post('/api/auth/logout').catch(err => {
      console.warn("Backend logout failed or session already cleared:", err);
    });
    setUser(null);
    setToken(null);
    setViewerSnapshot(null);
    setViewerError('');
    localStorage.removeItem('octavioUser');
    localStorage.removeItem('octavioToken');
    setAuthView('intro');
  }, []);

  useEffect(() => {
    registerAuthFailureHandler(clearSession);
    return () => {
      registerAuthFailureHandler(null);
    };
  }, [clearSession]);

  const handleViewerAccess = useCallback(async () => {
    setIsViewerLoading(true);
    setViewerError('');

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
