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

function formatBatchOption(batch) {
  const status = batch.status ? String(batch.status) : 'No status';
  const startDate = batch.startDate ? String(batch.startDate).slice(0, 10) : 'No start date';
  return `${batch.id} - ${status} - ${startDate}`;
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
  const [transactions, setTransactions] = useState([]);
  const [activeBatch, setActiveBatch] = useState(null);
  const [batches, setBatches] = useState([]);
  const [isBatchListLoading, setIsBatchListLoading] = useState(false);
  const [batchListError, setBatchListError] = useState('');
  const isPublicViewer = Boolean(user?.isPublicViewer);
  const apiToken = isPublicViewer ? null : token;
  const viewerPreviewData = isPublicViewer ? viewerSnapshot : null;
  const activeBatchId = activeBatch?.id;
  // --- DAILY LOGS DATABASE (NOW CONNECTED TO POSTGRESQL!) ---
  const [logs, setLogs] = useState([]);
  const canEnterDaily = hasMinimumRole(user?.role, 'DataEntry');
  const canManageOperations = hasMinimumRole(user?.role, 'OperationManager');
  const canViewFinancial = canManageOperations;
  const canEditOrDelete = Boolean(user?.isPrimaryOwner);
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
    setTransactions([]);
    setLogs([]);
    localStorage.removeItem('octavioUser');
    localStorage.removeItem('octavioToken');
    setAuthView('intro');
    setActiveScreen('today');
  }, []);

  useEffect(() => {
    if (isPublicViewer) {
      setTimeout(() => {
        const liveBatch = viewerPreviewData?.batch || viewerPreviewData?.batches?.[0] || null;
        setBatches(viewerPreviewData?.batches || (liveBatch ? [liveBatch] : []));
        setActiveBatch(liveBatch);
      }, 0);
      return;
    }

    if (!token) {
      if (!user) return;

      setTimeout(() => {
        clearSession();
      }, 0);
      return;
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
  }, [token, clearSession, isPublicViewer, user, viewerPreviewData]);

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
      setTimeout(() => {
        setTransactions([]);
      }, 0);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/batches/${activeBatchId}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        clearSession();
        return;
      }

      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  }, [token, activeBatchId, canViewFinancial, clearSession, isPublicViewer]);

  useEffect(() => {
    setTimeout(() => {
      refreshTransactions();
    }, 0);
  }, [refreshTransactions]);

  useEffect(() => {
    if (isPublicViewer) {
      setTimeout(() => {
        setLogs(viewerPreviewData?.logs || []);
      }, 0);
      return;
    }

    if (!token || !activeBatchId) {
      setTimeout(() => {
        setLogs([]);
      }, 0);
      return;
    }

    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/logs?batchId=${activeBatchId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 401) {
          clearSession();
          return;
        }

        const data = await response.json();
        setLogs(data);
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      }
    };

    fetchLogs();
  }, [token, activeBatchId, clearSession, isPublicViewer, viewerPreviewData]);

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
      const response = await fetch(`${API_BASE}/api/public/current-batch`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Current batch is unavailable.');
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
      setTransactions([]);
      setLogs(nextSnapshot.logs);
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

  useEffect(() => {
    if (user && !allowedScreens.includes(activeScreen)) {
      setTimeout(() => {
        setActiveScreen('dashboard');
      }, 0);
    }
  }, [activeScreen, user, allowedScreens]);

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
      />
    );
  }

  // If they ARE logged in, show the App!
  const getNavLinkClass = (screen) => {
    const isActive = activeScreen === screen;
    return `px-3.5 py-1.5 rounded uppercase tracking-wider font-bold text-[10px] sm:text-xs whitespace-nowrap transition-all duration-200 ${
      isActive
        ? 'bg-app-accent text-app-on-accent shadow-sm scale-[1.02]'
        : 'bg-app-card text-app-text-secondary border border-app-border hover:bg-app-bg hover:text-app-text'
    }`;
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-app-bg text-app-text min-h-screen flex flex-col md:flex-row transition-colors duration-300 font-sans">
        
        {/* --- DESKTOP SIDE NAVIGATION (md and up) --- */}
        <aside 
          className={`no-print hidden md:flex flex-col h-screen sticky top-0 left-0 z-40 bg-app-card border-r border-app-border transition-all duration-300 flex-shrink-0 overflow-hidden ${
            isNavMinimized ? 'w-16' : 'w-56'
          }`}
        >
          {/* Header */}
          <div className={`p-4 flex items-center justify-between border-b border-app-border shrink-0 ${isNavMinimized ? 'justify-center' : ''}`}>
            {!isNavMinimized ? (
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-app-text tracking-tighter truncate uppercase font-hanken">Octavio Farms</h2>
                <p className="text-[9px] font-mono text-app-text-secondary truncate mt-0.5 uppercase tracking-widest font-jetbrains">
                  {user?.role || 'Viewer'}
                </p>
              </div>
            ) : (
              <span className="material-symbols-outlined text-app-accent text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
            )}
            
            <button 
              onClick={toggleNavMinimized}
              className={`p-1.5 rounded hover:bg-app-bg text-app-text-secondary hover:text-app-text transition-colors ${isNavMinimized ? 'absolute right-2 top-2' : ''}`}
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
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveScreen(item.id)}
                  className={`w-full group flex items-center gap-3 py-2 transition-all rounded ${
                    isNavMinimized ? 'justify-center px-0' : 'px-3'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-app-accent/10 to-transparent border-l-[3px] border-app-accent text-app-text font-bold'
                      : 'text-app-text-secondary hover:bg-app-bg/50 hover:text-app-text'
                  }`}
                  title={item.label}
                >
                  <span 
                    className={`material-symbols-outlined text-[18px] transition-colors ${
                      isActive ? 'text-app-accent' : 'text-app-text-secondary group-hover:text-app-text'
                    }`}
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    {item.icon}
                  </span>
                  
                  {!isNavMinimized && (
                    <span className="text-[10px] font-bold tracking-wider uppercase truncate">
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer controls */}
          <div className="p-3 border-t border-app-border shrink-0 flex flex-col gap-3">
            {/* Active Batch Indicator / Selector */}
            {!isPublicViewer && (
              <div>
                {!isNavMinimized ? (
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
                ) : (
                  <div className="flex justify-center" title={`Active Batch: ${activeBatch?.id || 'None'}`}>
                    <span className="px-1.5 py-0.5 bg-app-accent/15 border border-app-accent/20 rounded text-[9px] font-bold text-app-accent font-jetbrains">
                      B:{activeBatch?.id || 'N/A'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Utility Buttons */}
            <div className={`flex gap-1.5 ${isNavMinimized ? 'flex-col items-center' : 'items-center justify-between'}`}>
              <div className={`flex gap-1.5 ${isNavMinimized ? 'flex-col' : 'items-center'}`}>
                {allowedScreens.includes('settings') && (
                  <button
                    onClick={() => setActiveScreen('settings')}
                    className={`h-8 w-8 inline-flex items-center justify-center rounded border transition hover:scale-105 ${
                      activeScreen === 'settings'
                        ? 'bg-app-accent text-app-on-accent border-app-accent'
                        : 'bg-app-card text-app-text-secondary border-app-border hover:text-app-text hover:border-app-text'
                    }`}
                    title="Settings"
                  >
                    <CogIcon />
                  </button>
                )}
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded bg-app-card text-app-text-secondary border border-app-border transition hover:scale-105 hover:text-app-text hover:border-app-text"
                  title={isDarkMode ? "Use Light Mode" : "Use Dark Mode"}
                >
                  <ThemeIcon isDarkMode={isDarkMode} />
                </button>
              </div>

              <button 
                onClick={handleLogout} 
                className={`flex items-center justify-center rounded border border-app-border p-1.5 bg-gradient-to-b from-app-card to-app-bg text-app-text-secondary hover:text-app-danger hover:border-app-danger/30 transition-all duration-75 ${
                  isNavMinimized ? 'w-8 h-8' : 'w-9 h-8'
                }`}
                title={isPublicViewer ? "Exit Preview" : "Logout"}
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* --- MAIN PAGE CONTENT CONTAINER --- */}
        <div className="flex-1 min-h-screen flex flex-col overflow-x-hidden">
          
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
                    activeScreen === 'settings'
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
            <div className="no-print mx-4 mt-4 mb-2 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              {batchListError}
            </div>
          )}

          {/* Screen Content Render */}
          <div className="flex-1">
            {activeScreen === 'today' && (
              <TodayOperations
                token={apiToken}
                activeBatch={activeBatch}
                logs={logs}
                setActiveScreen={setActiveScreen}
                previewData={viewerPreviewData}
              />
            )}

            {activeScreen === 'batches' && (
              <BatchManagement
                activeBatch={activeBatch}
                setActiveBatch={selectActiveBatch}
                token={apiToken}
                readOnly={!canManageOperations}
                canEditOrDelete={canEditOrDelete}
                previewData={viewerPreviewData}
              />
            )}
            
            {activeScreen === 'dashboard' && (
              <Dashboard setActiveScreen={setActiveScreen} logs={logs} activeBatch={activeBatch} user={user} />
            )}

            {activeScreen === 'employees' && canManageOperations && (
              <EmployeeManagement
                token={token}
                transactions={transactions}
                dailyLogs={logs}
                activeBatch={activeBatch}
                canEditOrDelete={canEditOrDelete}
              />
            )}

            {activeScreen === 'paySummary' && (
              <EmployeePaySummary token={token} activeBatch={activeBatch} />
            )}

            {activeScreen === 'ledger' && canViewFinancial && (
              <TransactionLedger
                transactions={transactions}
                setTransactions={setTransactions}
                activeBatch={activeBatch}
                token={token}
                readOnly={!canManageOperations}
                canEditOrDelete={canEditOrDelete}
              />
            )}

            {activeScreen === 'harvest' && canViewFinancial && (
              <HarvestRecording
                activeBatch={activeBatch}
                token={token}
                readOnly={!canManageOperations}
                onLedgerPosted={refreshTransactions}
              />
            )}

            {activeScreen === 'dailyLog' && (
              <DailyLog logs={logs} setLogs={setLogs} activeBatch={activeBatch} token={apiToken} readOnly={!canEnterDaily} canEditOrDelete={canEditOrDelete} />
            )}

            {activeScreen === 'inventory' && (
              <InventoryManagement activeBatch={activeBatch} token={apiToken} readOnly={!canManageOperations} canEditOrDelete={canEditOrDelete} previewData={viewerPreviewData} />
            )}

            {activeScreen === 'analytics' && (
              <Analytics transactions={canViewFinancial ? transactions : []} logs={logs} activeBatch={activeBatch} showFinancials={canViewFinancial} />
            )}

            {activeScreen === 'statement' && canViewFinancial && (
              <FinancialStatement transactions={transactions} activeBatch={activeBatch} />
            )}

            {activeScreen === 'settings' && (
              <Settings user={user} token={token} activeBatch={activeBatch} />
            )}
            
            <AntigravityAssistant
              activeBatch={activeBatch}
              logs={logs}
              transactions={transactions}
              user={user}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
