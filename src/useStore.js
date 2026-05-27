import { create } from 'zustand';
import { API_BASE } from './api';

const ZERO_GRAVITY_STORAGE_KEY = 'octavioZeroGravityEnabled';
const LEGACY_ZERO_GRAVITY_STORAGE_KEY = 'antigravityMode';
const EMPTY_TRANSACTION_STATE = { batchId: null, rows: [] };
const EMPTY_LOG_STATE = { batchId: null, rows: [] };

const roleRank = {
  Viewer: 1,
  DataEntry: 2,
  OperationManager: 3,
  AdminOwner: 4,
};

export function normalizeRole(role) {
  const compactRole = String(role || '').replace(/[\s_-]/g, '').toLowerCase();
  if (compactRole === 'admin' || compactRole === 'adminowner') return 'AdminOwner';
  if (compactRole === 'opmanager' || compactRole === 'operationmanager') return 'OperationManager';
  if (compactRole === 'dataentry') return 'DataEntry';
  if (compactRole === 'viewer') return 'Viewer';
  return role;
}

export function hasMinimumRole(role, minimumRole) {
  return (roleRank[normalizeRole(role)] || 0) >= (roleRank[minimumRole] || 0);
}

function getBatchPreferenceKey(user) {
  const identifier = user?.username || user?.email || user?.role || 'member';
  return `octavioActiveBatchId:${identifier}`;
}

function isCurrentBatch(batch) {
  const status = String(batch?.status || '').trim().toLowerCase();
  return status === 'ongoing' || status === 'active';
}

function pickPreferredBatch(batches, user) {
  const list = Array.isArray(batches) ? batches : [];
  const savedBatchId = localStorage.getItem(getBatchPreferenceKey(user));

  return (
    list.find((batch) => String(batch.id) === String(savedBatchId)) ||
    list.find(isCurrentBatch) ||
    list[0] ||
    null
  );
}

const initialUser = (() => {
  // Clean up legacy localStorage session data if present
  if (localStorage.getItem('octavioToken') || localStorage.getItem('octavioUser')) {
    localStorage.removeItem('octavioUser');
    localStorage.removeItem('octavioToken');
  }
  const savedToken = sessionStorage.getItem('octavioToken');
  const savedUser = sessionStorage.getItem('octavioUser');
  if (!savedToken || !savedUser) {
    sessionStorage.removeItem('octavioUser');
    sessionStorage.removeItem('octavioToken');
    return null;
  }
  try {
    return JSON.parse(savedUser);
  } catch (err) {
    console.error("Failed to parse user session:", err);
    sessionStorage.removeItem('octavioUser');
    sessionStorage.removeItem('octavioToken');
    return null;
  }
})();

export const useStore = create((set, get) => ({
  // --- AUTHENTICATION STATE ---
  user: initialUser,
  token: sessionStorage.getItem('octavioToken'),
  authView: 'intro',
  
  // --- BATCH STATE ---
  activeBatch: null,
  batches: [],
  isBatchListLoading: false,
  batchListError: '',
  
  // --- DATA STATE ---
  transactionState: EMPTY_TRANSACTION_STATE,
  logState: EMPTY_LOG_STATE,
  
  // --- VIEW SNAPSHOTS ---
  viewerSnapshot: null,
  viewerError: '',
  isViewerLoading: false,
  preloadedSnapshot: null,

  // --- PREFERENCES ---
  isDarkMode: (() => {
    const saved = localStorage.getItem('themeMode');
    return saved ? saved === 'dark' : true;
  })(),
  isZeroGravity: (() => {
    const saved = localStorage.getItem(ZERO_GRAVITY_STORAGE_KEY);
    return saved !== 'false';
  })(),
  isNavMinimized: (() => {
    const saved = localStorage.getItem('octavioNavMinimized');
    return saved === 'true';
  })(),

  // --- ACTIONS ---
  setAuthView: (view) => set({ authView: view }),
  setPreloadedSnapshot: (snapshot) => set({ preloadedSnapshot: snapshot }),

  login: (userData, authToken) => {
    sessionStorage.setItem('octavioUser', JSON.stringify(userData));
    if (authToken) {
      sessionStorage.setItem('octavioToken', authToken);
    } else {
      sessionStorage.removeItem('octavioToken');
    }
    set({ user: userData, token: authToken, authView: 'intro' });
  },

  logout: () => {
    sessionStorage.removeItem('octavioUser');
    sessionStorage.removeItem('octavioToken');
    set({
      user: null,
      token: null,
      activeBatch: null,
      batches: [],
      batchListError: '',
      viewerSnapshot: null,
      viewerError: '',
      transactionState: EMPTY_TRANSACTION_STATE,
      logState: EMPTY_LOG_STATE,
      authView: 'intro'
    });
  },

  setActiveBatch: (batch) => {
    const { user, user: { isPublicViewer } = {} } = get();
    set({ activeBatch: batch });
    if (!isPublicViewer && batch?.id && user) {
      localStorage.setItem(getBatchPreferenceKey(user), String(batch.id));
    }
  },

  setBatches: (batches) => set({ batches }),
  
  setIsBatchListLoading: (isLoading) => set({ isBatchListLoading: isLoading }),
  setBatchListError: (error) => set({ batchListError: error }),
  
  setTransactionState: (transactionState) => set({ transactionState }),
  setLogState: (logState) => set({ logState }),

  setViewerSnapshot: (snapshot) => set({ viewerSnapshot: snapshot }),
  setViewerError: (error) => set({ viewerError: error }),
  setIsViewerLoading: (isLoading) => set({ isViewerLoading: isLoading }),

  toggleDarkMode: () => {
    set((state) => {
      const nextMode = !state.isDarkMode;
      localStorage.setItem('themeMode', nextMode ? 'dark' : 'light');
      if (nextMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { isDarkMode: nextMode };
    });
  },

  toggleZeroGravity: () => {
    set((state) => {
      const nextGravity = !state.isZeroGravity;
      document.body.classList.toggle('antigravity-active', nextGravity);
      localStorage.setItem(ZERO_GRAVITY_STORAGE_KEY, String(nextGravity));
      localStorage.setItem(LEGACY_ZERO_GRAVITY_STORAGE_KEY, String(nextGravity));
      return { isZeroGravity: nextGravity };
    });
  },

  toggleNavMinimized: () => {
    set((state) => {
      const nextMin = !state.isNavMinimized;
      localStorage.setItem('octavioNavMinimized', String(nextMin));
      return { isNavMinimized: nextMin };
    });
  },

  fetchBatches: async () => {
    const { token, logout, user } = get();
    if (!token) return;

    set({ isBatchListLoading: true, batchListError: '' });

    try {
      const response = await fetch(`${API_BASE}/api/batches`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        logout();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const nextBatches = Array.isArray(data) ? data : [];
        
        set({ batches: nextBatches });
        
        // Pick preferred batch
        const currentActiveBatch = get().activeBatch;
        const currentMatch = nextBatches.find((b) => String(b.id) === String(currentActiveBatch?.id));
        const nextBatch = currentMatch || pickPreferredBatch(nextBatches, user);
        
        if (nextBatch?.id && user) {
          localStorage.setItem(getBatchPreferenceKey(user), String(nextBatch.id));
        }
        
        set({ activeBatch: nextBatch });
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load batches.');
      }
    } catch (error) {
      console.error("Failed to fetch batches:", error);
      set({ batches: [], activeBatch: null, batchListError: 'Batch list is unavailable. Try refreshing.' });
    } finally {
      set({ isBatchListLoading: false });
    }
  },

  fetchTransactions: async () => {
    const { token, logout, activeBatch, user } = get();
    const isPublicViewer = Boolean(user?.isPublicViewer);
    if (isPublicViewer || !token || !activeBatch?.id) return;

    try {
      const response = await fetch(`${API_BASE}/api/batches/${activeBatch.id}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        logout();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        set({ transactionState: { batchId: activeBatch.id, rows: data } });
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  },

  fetchLogs: async () => {
    const { token, logout, activeBatch, user } = get();
    const isPublicViewer = Boolean(user?.isPublicViewer);
    if (isPublicViewer || !token || !activeBatch?.id) return;

    try {
      const response = await fetch(`${API_BASE}/api/logs?batchId=${activeBatch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        logout();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        set({ logState: { batchId: activeBatch.id, rows: data } });
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  }
}));

export function useVisibleActiveBatch() {
  return useStore((state) => state.activeBatch);
}

export function useVisibleLogs() {
  return useStore((state) => {
    const isPublicViewer = Boolean(state.user?.isPublicViewer);
    const activeBatchId = state.activeBatch?.id;
    if (isPublicViewer) {
      return state.viewerSnapshot?.logs || [];
    }
    return activeBatchId && state.logState.batchId === activeBatchId ? state.logState.rows : [];
  });
}

export function useVisibleTransactions() {
  return useStore((state) => {
    const isPublicViewer = Boolean(state.user?.isPublicViewer);
    if (isPublicViewer) return [];
    const activeBatchId = state.activeBatch?.id;
    return activeBatchId && state.transactionState.batchId === activeBatchId ? state.transactionState.rows : [];
  });
}

export function usePermissions() {
  const user = useStore((state) => state.user);
  return {
    canEnterDaily: hasMinimumRole(user?.role, 'DataEntry'),
    canManageOperations: hasMinimumRole(user?.role, 'OperationManager'),
    canViewFinancial: hasMinimumRole(user?.role, 'OperationManager'),
    canEditOrDelete: Boolean(user?.isPrimaryOwner),
    isPublicViewer: Boolean(user?.isPublicViewer),
  };
}

