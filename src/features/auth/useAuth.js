import { useState, useEffect, useCallback } from 'react';
import { publicViewerUser } from '../../shared/utils/publicViewerData';
import { apiClient, registerAuthFailureHandler } from '../../shared/utils/apiClient';

export default function useAuth() {
  const [user, setUser] = useState(() => {
    const savedToken = localStorage.getItem('octavioToken');
    const savedUser = localStorage.getItem('octavioUser');

    if (!savedToken || !savedUser) {
      localStorage.removeItem('octavioUser');
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
  const [authView, setAuthView] = useState('intro');
  const [viewerSnapshot, setViewerSnapshot] = useState(null);
  const [viewerError, setViewerError] = useState('');
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [preloadedSnapshot, setPreloadedSnapshot] = useState(null);

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
    localStorage.setItem('octavioToken', authToken);
  }, []);

  const clearSession = useCallback(() => {
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
    clearSession
  };
}
