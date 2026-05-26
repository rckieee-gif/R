import { useState, useEffect, useCallback, useMemo } from 'react';
import Login from './login';
import IntroPage from './IntroPage';
import TransactionLedger from './TransactionLedger';
import DailyLog from './DailyLog';
import Dashboard from './Dashboard';
import TodayOperations from './TodayOperations';
import Analytics from './Analytics';
import FinancialStatement from './FinancialStatement';
import HarvestRecording from './HarvestRecording';
import BatchManagement from './BatchManagement';
import EmployeeManagement from './EmployeeManagement';
import EmployeePaySummary from './EmployeePaySummary';
import InventoryManagement from './InventoryManagement';
import Settings from './Settings';
import { API_BASE } from './api';
import AntigravityAssistant from './Components/AntigravityAssistant';
import { publicViewerUser } from './publicViewerData';

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

function normalizeRole(role) {
  const compactRole = String(role || '').replace(/[\s_-]/g, '').toLowerCase();
  if (compactRole === 'admin' || compactRole === 'adminowner') return 'AdminOwner';
  if (compactRole === 'opmanager' || compactRole === 'operationmanager') return 'OperationManager';
  if (compactRole === 'dataentry') return 'DataEntry';
  if (compactRole === 'viewer') return 'Viewer';
  return role;
}

function hasMinimumRole(role, minimumRole) {
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

function readZeroGravityPreference() {
  const saved = localStorage.getItem(ZERO_GRAVITY_STORAGE_KEY);

  return saved !== 'false';
}

function CogIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.2 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 20 7.2l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.8.7Z" />
    </svg>
  );
}

function ThemeIcon({ isDarkMode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {isDarkMode ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      ) : (
        <path d="M21 13.8A8 8 0 0 1 10.2 3 7 7 0 1 0 21 13.8Z" />
      )}
    </svg>
  );
}

function App() {
  // --- AUTHENTICATION STATE ---
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
        const response = await fetch(`${API_BASE}/api/public/current-batch`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setPreloadedSnapshot(data);
          }
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

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('themeMode');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('themeMode', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const [isZeroGravity, setIsZeroGravity] = useState(readZeroGravityPreference);

  useEffect(() => {
    document.body.classList.toggle('antigravity-active', isZeroGravity);
    localStorage.setItem(ZERO_GRAVITY_STORAGE_KEY, String(isZeroGravity));
    localStorage.setItem(LEGACY_ZERO_GRAVITY_STORAGE_KEY, String(isZeroGravity));

    return () => {
      document.body.classList.remove('antigravity-active');
    };
  }, [isZeroGravity]);

  const [isNavMinimized, setIsNavMinimized] = useState(() => {
    const saved = localStorage.getItem('octavioNavMinimized');
    return saved ? saved === 'true' : false;
  });

  const toggleNavMinimized = () => {
    setIsNavMinimized((prev) => {
      const next = !prev;
      localStorage.setItem('octavioNavMinimized', String(next));
      return next;
    });
  };

  const [activeScreen, setActiveScreen] = useState('today');
  // --- LEDGER DATABASE (NOW CONNECTED TO POSTGRESQL!) ---
  const [transactionState, setTransactionState] = useState(EMPTY_TRANSACTION_STATE);
  const [activeBatch, setActiveBatch] = useState(null);
  const [batches, setBatches] = useState([]);
  const [isBatchListLoading, setIsBatchListLoading] = useState(false);
  const [batchListError, setBatchListError] = useState('');
  const isPublicViewer = Boolean(user?.isPublicViewer);
  const apiToken = isPublicViewer ? null : token;
  const viewerPreviewData = isPublicViewer ? viewerSnapshot : null;
  const viewerActiveBatch = viewerPreviewData?.batch || viewerPreviewData?.batches?.[0] || null;
  const visibleActiveBatch = isPublicViewer ? viewerActiveBatch : activeBatch;
  const activeBatchId = visibleActiveBatch?.id;
  // --- DAILY LOGS DATABASE (NOW CONNECTED TO POSTGRESQL!) ---
  const [logState, setLogState] = useState(EMPTY_LOG_STATE);
  const canEnterDaily = hasMinimumRole(user?.role, 'DataEntry');
  const canManageOperations = hasMinimumRole(user?.role, 'OperationManager');
  const canViewFinancial = canManageOperations;
  const canEditOrDelete = Boolean(user?.isPrimaryOwner);
  const transactions = canViewFinancial && activeBatchId && transactionState.batchId === activeBatchId
    ? transactionState.rows
    : [];
  const visibleLogs = isPublicViewer
    ? (viewerPreviewData?.logs || [])
    : (activeBatchId && logState.batchId === activeBatchId ? logState.rows : []);
  const setVisibleTransactions = useCallback((value) => {
    if (!activeBatchId) return;

    setTransactionState((current) => {
      const currentRows = current.batchId === activeBatchId ? current.rows : [];
      const nextRows = typeof value === 'function' ? value(currentRows) : value;

      return {
        batchId: activeBatchId,
        rows: Array.isArray(nextRows) ? nextRows : []
      };
    });
  }, [activeBatchId]);
  const setVisibleLogs = useCallback((value) => {
    if (!activeBatchId) return;

    setLogState((current) => {
      const currentRows = current.batchId === activeBatchId ? current.rows : [];
      const nextRows = typeof value === 'function' ? value(currentRows) : value;

      return {
        batchId: activeBatchId,
        rows: Array.isArray(nextRows) ? nextRows : []
      };
    });
  }, [activeBatchId]);
  const allowedScreens = useMemo(() => {
    if (isPublicViewer) {
      return ['today', 'dashboard', 'batches', 'dailyLog', 'inventory', 'analytics'];
    }

    return [
      'today',
      'dashboard',
      'batches',
      'dailyLog',
      'paySummary',
      'inventory',
      'analytics',
      'settings',
      ...(canManageOperations ? ['employees', 'ledger', 'harvest', 'statement'] : []),
    ];
  }, [canManageOperations, isPublicViewer]);

  const screensMeta = useMemo(() => [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'batches', label: 'Batches', icon: 'layers' },
    { id: 'employees', label: 'Employees', icon: 'group' },
    { id: 'paySummary', label: 'Pay Summary', icon: 'payments' },
    { id: 'ledger', label: 'Ledger', icon: 'receipt_long' },
    { id: 'harvest', label: 'Harvest', icon: 'agriculture' },
    { id: 'dailyLog', label: 'Daily Logs', icon: 'edit_note' },
    { id: 'inventory', label: 'Inventory', icon: 'inventory' },
    { id: 'analytics', label: 'Analytics', icon: 'monitoring' },
    { id: 'statement', label: 'Statement', icon: 'description' },
  ], []);

  const visibleNavItems = useMemo(() => {
    return screensMeta.filter((item) => allowedScreens.includes(item.id));
  }, [allowedScreens, screensMeta]);

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    setActiveBatch(null);
    setBatches([]);
    setBatchListError('');
    setViewerSnapshot(null);
    setViewerError('');
    setTransactionState(EMPTY_TRANSACTION_STATE);
    setLogState(EMPTY_LOG_STATE);
    localStorage.removeItem('octavioUser');
    localStorage.removeItem('octavioToken');
    setAuthView('intro');
    setActiveScreen('today');
  }, []);

  useEffect(() => {
    if (isPublicViewer) {
      return undefined;
    }

    if (!token) {
      return undefined;
    }

    let isCancelled = false;

    const fetchBatches = async () => {
      setIsBatchListLoading(true);
      setBatchListError('');

      try {
        const response = await fetch(`${API_BASE}/api/batches`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 401) {
          clearSession();
          return;
        }

        if (response.ok) {
          const data = await response.json();
          const nextBatches = Array.isArray(data) ? data : [];

          if (isCancelled) return;

          setBatches(nextBatches);
          setActiveBatch((currentBatch) => {
            const currentMatch = nextBatches.find((batch) => String(batch.id) === String(currentBatch?.id));
            const nextBatch = currentMatch || pickPreferredBatch(nextBatches, user);

            if (nextBatch?.id) {
              localStorage.setItem(getBatchPreferenceKey(user), String(nextBatch.id));
            }

            return nextBatch;
          });
        } else {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load batches.');
        }
      } catch (error) {
        if (isCancelled) return;
        console.error("Failed to fetch batches:", error);
        setBatches([]);
        setActiveBatch(null);
        setBatchListError('Batch list is unavailable. Try refreshing or open Batches after the connection recovers.');
      } finally {
        if (!isCancelled) {
          setIsBatchListLoading(false);
        }
      }
    };

    fetchBatches();

    return () => {
      isCancelled = true;
    };
  }, [token, clearSession, isPublicViewer, user]);

  const selectActiveBatch = useCallback((batch) => {
    setActiveBatch(batch || null);

    if (!isPublicViewer && batch?.id) {
      localStorage.setItem(getBatchPreferenceKey(user), String(batch.id));
    }
  }, [isPublicViewer, user]);

  const handleBatchSelectorChange = useCallback((event) => {
    const nextBatch = batches.find((batch) => String(batch.id) === event.target.value) || null;
    selectActiveBatch(nextBatch);
  }, [batches, selectActiveBatch]);

  const refreshTransactions = useCallback(async () => {
    if (isPublicViewer || !token || !activeBatchId || !canViewFinancial) {
      return;
    }

    const requestBatchId = activeBatchId;

    try {
      const response = await fetch(`${API_BASE}/api/batches/${requestBatchId}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        clearSession();
        return;
      }

      const data = await response.json();
      setTransactionState({ batchId: requestBatchId, rows: data });
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  }, [token, activeBatchId, canViewFinancial, clearSession, isPublicViewer]);

  useEffect(() => {
    if (isPublicViewer || !token || !activeBatchId || !canViewFinancial) {
      return undefined;
    }

    let isCancelled = false;
    const requestBatchId = activeBatchId;

    const fetchTransactions = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/batches/${requestBatchId}/transactions`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 401) {
          clearSession();
          return;
        }

        const data = await response.json();

        if (!isCancelled) {
          setTransactionState({ batchId: requestBatchId, rows: data });
        }
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      }
    };

    fetchTransactions();

    return () => {
      isCancelled = true;
    };
  }, [token, activeBatchId, canViewFinancial, clearSession, isPublicViewer]);

  useEffect(() => {
    if (isPublicViewer) {
      return undefined;
    }

    if (!token || !activeBatchId) {
      return undefined;
    }

    const requestBatchId = activeBatchId;

    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/logs?batchId=${requestBatchId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 401) {
          clearSession();
          return;
        }

        const data = await response.json();
        setLogState({ batchId: requestBatchId, rows: data });
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      }
    };

    fetchLogs();
  }, [token, activeBatchId, clearSession, isPublicViewer]);

  // --- LOGIN HANDLER ---
  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setAuthView('intro');
    localStorage.setItem('octavioUser', JSON.stringify(userData));
    localStorage.setItem('octavioToken', authToken);
  };

  const handleViewerAccess = async () => {
    setIsViewerLoading(true);
    setViewerError('');

    try {
      let data = preloadedSnapshot;
      if (!data) {
        const response = await fetch(`${API_BASE}/api/public/current-batch`);
        data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Current batch is unavailable.');
        }
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
      setActiveBatch(liveBatch);
      setBatches(nextSnapshot.batches);
      setTransactionState(EMPTY_TRANSACTION_STATE);
      setLogState({ batchId: liveBatch.id, rows: nextSnapshot.logs });
      setActiveScreen('today');
    } catch (error) {
      console.error('Failed to open viewer mode:', error);
      setViewerError(error.message || 'Cannot open the current batch right now.');
    } finally {
      setIsViewerLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
  };

  // --- SECURITY GATEKEEPER ---
  // If there is no user logged in, show ONLY the Login Screen!
  if (!user || (!token && !isPublicViewer)) {
    if (authView === 'login') {
      return <Login onLogin={handleLogin} onBack={() => setAuthView('intro')} />;
    }

    return (
      <IntroPage
        onContinueAsViewer={handleViewerAccess}
        onMemberLogin={() => setAuthView('login')}
        isViewerLoading={isViewerLoading}
        viewerError={viewerError}
        preloadedSnapshot={preloadedSnapshot}
      />
    );
  }

  // If they ARE logged in, show the App!
  const currentScreen = allowedScreens.includes(activeScreen) ? activeScreen : 'dashboard';
  const getNavLinkClass = (screen) => {
    const isActive = currentScreen === screen;
    return `px-3.5 py-1.5 rounded uppercase tracking-wider font-bold text-[10px] sm:text-xs whitespace-nowrap transition-all duration-200 ${
      isActive
        ? 'bg-app-accent text-app-on-accent shadow-sm scale-[1.02]'
        : 'bg-app-card text-app-text-secondary border border-app-border hover:bg-app-bg hover:text-app-text'
    }`;
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-app-bg text-app-text min-h-screen flex min-w-0 flex-col md:flex-row transition-colors duration-300 font-sans">
        
        {/* --- DESKTOP SIDE NAVIGATION (md and up) --- */}
        <aside 
          className={`no-print hidden md:flex flex-col h-screen sticky top-0 left-0 z-40 bg-app-card border-r border-app-border transition-all duration-300 flex-shrink-0 overflow-hidden ${
            isNavMinimized ? 'w-16' : 'w-56'
          }`}
        >
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-app-border shrink-0 h-[65px] transition-all duration-300">
            <div className={`min-w-0 transition-all duration-300 ${
              isNavMinimized ? 'w-0 opacity-0 pointer-events-none overflow-hidden' : 'w-auto opacity-100 flex-1'
            }`}>
              <h2 className="text-sm font-bold text-app-text tracking-tighter truncate uppercase font-hanken whitespace-nowrap">Octavio Farms</h2>
              <p className="text-[9px] font-mono text-app-text-secondary truncate mt-0.5 uppercase tracking-widest font-jetbrains whitespace-nowrap">
                {user?.role || 'Viewer'}
              </p>
            </div>
            
            <button 
              onClick={toggleNavMinimized}
              className={`rounded hover:bg-app-bg text-app-text-secondary hover:text-app-text transition-all duration-300 flex items-center justify-center ${
                isNavMinimized ? 'w-full py-1.5' : 'p-1.5 ml-2'
              }`}
              title={isNavMinimized ? "Expand Sidebar" : "Minimize Sidebar"}
            >
              <span className="material-symbols-outlined text-base">
                {isNavMinimized ? 'menu' : 'menu_open'}
              </span>
            </button>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1.5 ag-scrollbar">
            {visibleNavItems.map((item) => {
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveScreen(item.id)}
                  className={`w-full group flex items-center transition-all duration-300 rounded border-l-[3px] border-r-[3px] py-2 ${
                    isNavMinimized ? 'px-5 gap-0' : 'px-3.5 gap-3'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-app-accent/10 to-transparent border-l-app-accent border-r-transparent text-app-text font-bold'
                      : 'border-l-transparent border-r-transparent text-app-text-secondary hover:bg-app-bg/50 hover:text-app-text'
                  }`}
                  title={item.label}
                >
                  <span 
                    className={`material-symbols-outlined text-[18px] transition-colors shrink-0 ${
                      isActive ? 'text-app-accent' : 'text-app-text-secondary group-hover:text-app-text'
                    }`}
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    {item.icon}
                  </span>
                  
                  <span className={`transition-all duration-300 text-[10px] font-bold tracking-wider uppercase truncate ${
                    isNavMinimized ? 'w-0 opacity-0 pointer-events-none' : 'w-28 opacity-100'
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Footer controls */}
          <div className="p-3 border-t border-app-border shrink-0 flex flex-col gap-3">
            {/* Active Batch Indicator / Selector */}
            {!isPublicViewer && (
              <div className="relative min-h-[38px] transition-all duration-300">
                <div className={`transition-all duration-300 ${
                  isNavMinimized ? 'opacity-0 scale-95 pointer-events-none absolute inset-0' : 'opacity-100 scale-100'
                }`}>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="desktop-batch-selector" className="text-[9px] font-bold uppercase tracking-wider text-app-text-secondary">
                      Active Batch
                    </label>
                    <select
                      id="desktop-batch-selector"
                      value={activeBatch?.id || ''}
                      onChange={handleBatchSelectorChange}
                      disabled={isBatchListLoading || batches.length === 0}
                      className="w-full h-8 rounded border border-app-border bg-app-bg px-2 text-xs font-bold text-app-text outline-none transition focus:ring-1 focus:ring-app-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBatchListLoading && <option value="">Loading...</option>}
                      {!isBatchListLoading && batches.length === 0 && <option value="">None</option>}
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.id} ({batch.status || 'No status'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className={`transition-all duration-300 ${
                  isNavMinimized ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute inset-0'
                }`}>
                  <div className="flex justify-center" title={`Active Batch: ${activeBatch?.id || 'None'}`}>
                    <span className="px-1.5 py-0.5 bg-app-accent/15 border border-app-accent/20 rounded text-[9px] font-bold text-app-accent font-jetbrains">
                      B:{activeBatch?.id || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Utility Buttons */}
            <div className="flex flex-col gap-1.5">
              {allowedScreens.includes('settings') && (
                <button
                  onClick={() => setActiveScreen('settings')}
                  className={`w-full group flex items-center transition-all duration-300 rounded border-l-[3px] border-r-[3px] py-2 ${
                    isNavMinimized ? 'px-5 gap-0' : 'px-3.5 gap-3'
                  } ${
                    currentScreen === 'settings'
                      ? 'bg-gradient-to-r from-app-accent/10 to-transparent border-l-app-accent border-r-transparent text-app-text font-bold'
                      : 'border-l-transparent border-r-transparent text-app-text-secondary hover:bg-app-bg/50 hover:text-app-text'
                  }`}
                  title="Settings"
                >
                  <span className={`flex items-center justify-center h-[18px] w-[18px] shrink-0 transition-colors ${
                    currentScreen === 'settings' ? 'text-app-accent' : 'text-app-text-secondary group-hover:text-app-text'
                  }`}>
                    <CogIcon />
                  </span>
                  <span className={`transition-all duration-300 text-[10px] font-bold tracking-wider uppercase truncate ${
                    isNavMinimized ? 'w-0 opacity-0 pointer-events-none' : 'w-28 opacity-100'
                  }`}>
                    Settings
                  </span>
                </button>
              )}

              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`w-full group flex items-center transition-all duration-300 rounded border-l-[3px] border-r-[3px] py-2 border-l-transparent border-r-transparent text-app-text-secondary hover:bg-app-bg/50 hover:text-app-text ${
                  isNavMinimized ? 'px-5 gap-0' : 'px-3.5 gap-3'
                }`}
                title={isDarkMode ? "Use Light Mode" : "Use Dark Mode"}
              >
                <span className="flex items-center justify-center h-[18px] w-[18px] shrink-0 text-app-text-secondary group-hover:text-app-text">
                  <ThemeIcon isDarkMode={isDarkMode} />
                </span>
                <span className={`transition-all duration-300 text-[10px] font-bold tracking-wider uppercase truncate ${
                  isNavMinimized ? 'w-0 opacity-0 pointer-events-none' : 'w-28 opacity-100'
                }`}>
                  {isDarkMode ? "Light Mode" : "Dark Mode"}
                </span>
              </button>

              <button 
                onClick={handleLogout} 
                className={`w-full group flex items-center transition-all duration-300 rounded border-l-[3px] border-r-[3px] py-2 text-app-text-secondary hover:bg-app-danger-bg hover:text-app-danger border-l-transparent border-r-transparent ${
                  isNavMinimized ? 'px-5 gap-0' : 'px-3.5 gap-3'
                }`}
                title={isPublicViewer ? "Exit Preview" : "Logout"}
              >
                <span className="material-symbols-outlined text-[18px] shrink-0 text-app-text-secondary group-hover:text-app-danger transition-colors">
                  logout
                </span>
                <span className={`transition-all duration-300 text-[10px] font-bold tracking-wider uppercase truncate ${
                  isNavMinimized ? 'w-0 opacity-0 pointer-events-none' : 'w-28 opacity-100'
                }`}>
                  {isPublicViewer ? "Exit Preview" : "Logout"}
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* --- MAIN PAGE CONTENT CONTAINER --- */}
        <div className="flex-1 min-w-0 min-h-screen flex flex-col overflow-x-hidden">
          
          {/* --- MOBILE NAVIGATION BAR (md:hidden) --- */}
          <div className="no-print bg-app-card border-b border-app-border p-3 flex justify-between items-center sticky top-0 z-10 transition-colors duration-300 md:hidden">
            <div className="flex space-x-2 overflow-x-auto ag-scrollbar py-1">
              <button onClick={() => setActiveScreen('today')} className={getNavLinkClass('today')}>Today</button>
              <button onClick={() => setActiveScreen('dashboard')} className={getNavLinkClass('dashboard')}>Home</button>
              {allowedScreens.includes('batches') && (
                <button onClick={() => setActiveScreen('batches')} className={getNavLinkClass('batches')}>Batches</button>
              )}
              {canManageOperations && (
                <button onClick={() => setActiveScreen('employees')} className={getNavLinkClass('employees')}>Employees</button>
              )}
              {allowedScreens.includes('paySummary') && (
                <button onClick={() => setActiveScreen('paySummary')} className={getNavLinkClass('paySummary')}>Pay Summary</button>
              )}
              {canViewFinancial && (
                <button onClick={() => setActiveScreen('ledger')} className={getNavLinkClass('ledger')}>Ledger</button>
              )}
              {canViewFinancial && (
                <button onClick={() => setActiveScreen('harvest')} className={getNavLinkClass('harvest')}>Harvest</button>
              )}
              {allowedScreens.includes('dailyLog') && (
                <button onClick={() => setActiveScreen('dailyLog')} className={getNavLinkClass('dailyLog')}>Daily Logs</button>
              )}
              {allowedScreens.includes('inventory') && (
                <button onClick={() => setActiveScreen('inventory')} className={getNavLinkClass('inventory')}>Inventory</button>
              )}
              {allowedScreens.includes('analytics') && (
                <button onClick={() => setActiveScreen('analytics')} className={getNavLinkClass('analytics')}>Analytics</button>
              )}
              {canViewFinancial && (
                <button onClick={() => setActiveScreen('statement')} className={getNavLinkClass('statement')}>Statement</button>
              )}
            </div>
            
            <div className="flex items-center gap-2 ml-3 shrink-0">
              {!isPublicViewer && (
                <select
                  value={activeBatch?.id || ''}
                  onChange={handleBatchSelectorChange}
                  disabled={isBatchListLoading || batches.length === 0}
                  className="h-8 w-24 rounded border border-app-border bg-app-card px-2 text-[10px] font-bold text-app-text outline-none transition focus:ring-1 focus:ring-app-accent"
                >
                  {isBatchListLoading && <option value="">Loading...</option>}
                  {!isBatchListLoading && batches.length === 0 && <option value="">None</option>}
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.id}
                    </option>
                  ))}
                </select>
              )}
              {allowedScreens.includes('settings') && (
                <button
                  onClick={() => setActiveScreen('settings')}
                  className={`h-8 w-8 inline-flex items-center justify-center rounded border transition ${
                    currentScreen === 'settings'
                      ? 'bg-app-accent text-app-on-accent border-app-accent'
                      : 'bg-app-card text-app-text-secondary border-app-border'
                  }`}
                  aria-label="Settings"
                >
                  <CogIcon />
                </button>
              )}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="h-8 w-8 inline-flex items-center justify-center rounded bg-app-card text-app-text-secondary border border-app-border transition"
              >
                <ThemeIcon isDarkMode={isDarkMode} />
              </button>
            </div>
          </div>

          {/* Batch list error overlay */}
          {!isPublicViewer && batchListError && (
            <div className="no-print mx-4 mt-4 mb-2 rounded border border-app-warning/30 bg-app-warning-bg px-4 py-3 text-sm font-semibold text-app-warning">
              {batchListError}
            </div>
          )}

          {/* Screen Content Render */}
          <div className="flex-1 min-w-0">
            {currentScreen === 'today' && (
              <TodayOperations
                token={apiToken}
                activeBatch={visibleActiveBatch}
                logs={visibleLogs}
                setActiveScreen={setActiveScreen}
                previewData={viewerPreviewData}
              />
            )}

            {currentScreen === 'batches' && (
              <BatchManagement
                activeBatch={visibleActiveBatch}
                setActiveBatch={selectActiveBatch}
                token={apiToken}
                readOnly={!canManageOperations}
                canEditOrDelete={canEditOrDelete}
                previewData={viewerPreviewData}
              />
            )}
            
            {currentScreen === 'dashboard' && (
              <Dashboard setActiveScreen={setActiveScreen} logs={visibleLogs} activeBatch={visibleActiveBatch} user={user} />
            )}

            {currentScreen === 'employees' && canManageOperations && (
              <EmployeeManagement
                token={token}
                transactions={transactions}
                dailyLogs={visibleLogs}
                activeBatch={visibleActiveBatch}
                canEditOrDelete={canEditOrDelete}
              />
            )}

            {currentScreen === 'paySummary' && (
              <EmployeePaySummary token={token} activeBatch={visibleActiveBatch} transactions={transactions} />
            )}

            {currentScreen === 'ledger' && canViewFinancial && (
              <TransactionLedger
                transactions={transactions}
                setTransactions={setVisibleTransactions}
                activeBatch={visibleActiveBatch}
                token={token}
                readOnly={!canManageOperations}
                canEditOrDelete={canEditOrDelete}
              />
            )}

            {currentScreen === 'harvest' && canViewFinancial && (
              <HarvestRecording
                activeBatch={visibleActiveBatch}
                token={token}
                readOnly={!canManageOperations}
                onLedgerPosted={refreshTransactions}
              />
            )}

            {currentScreen === 'dailyLog' && (
              <DailyLog logs={visibleLogs} setLogs={setVisibleLogs} activeBatch={visibleActiveBatch} token={apiToken} readOnly={!canEnterDaily} canEditOrDelete={canEditOrDelete} />
            )}

            {currentScreen === 'inventory' && (
              <InventoryManagement activeBatch={visibleActiveBatch} token={apiToken} readOnly={!canManageOperations} canEditOrDelete={canEditOrDelete} previewData={viewerPreviewData} />
            )}

            {currentScreen === 'analytics' && (
              <Analytics transactions={canViewFinancial ? transactions : []} logs={visibleLogs} activeBatch={visibleActiveBatch} showFinancials={canViewFinancial} />
            )}

            {currentScreen === 'statement' && canViewFinancial && (
              <FinancialStatement transactions={transactions} activeBatch={visibleActiveBatch} />
            )}

            {currentScreen === 'settings' && (
              <Settings 
                user={user} 
                token={token} 
                activeBatch={visibleActiveBatch} 
                isZeroGravity={isZeroGravity}
                setIsZeroGravity={setIsZeroGravity}
              />
            )}
            
            <AntigravityAssistant
              activeBatch={visibleActiveBatch}
              logs={visibleLogs}
              transactions={transactions}
              user={user}
              isZeroGravity={isZeroGravity}
              allowedScreens={allowedScreens}
              canEnterDaily={canEnterDaily}
              canViewFinancial={canViewFinancial}
              isPublicViewer={isPublicViewer}
              token={apiToken}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
