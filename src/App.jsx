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
import {
  publicViewerBatch,
  publicViewerData,
  publicViewerLogs,
  publicViewerUser
} from './publicViewerData';

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

  const [activeScreen, setActiveScreen] = useState('today');
  // --- LEDGER DATABASE (NOW CONNECTED TO POSTGRESQL!) ---
  const [transactions, setTransactions] = useState([]);
  const [activeBatch, setActiveBatch] = useState(null);
  const [batches, setBatches] = useState([]);
  const [isBatchListLoading, setIsBatchListLoading] = useState(false);
  const [batchListError, setBatchListError] = useState('');
  const isPublicViewer = Boolean(user?.isPublicViewer);
  const apiToken = isPublicViewer ? null : token;
  const viewerPreviewData = isPublicViewer ? publicViewerData : null;
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

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    setActiveBatch(null);
    setBatches([]);
    setBatchListError('');
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
        setBatches([publicViewerBatch]);
        setActiveBatch(publicViewerBatch);
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
      setLogs(publicViewerLogs);
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
  }, [token, activeBatchId, clearSession, isPublicViewer]);

  // --- LOGIN HANDLER ---
  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setAuthView('intro');
    localStorage.setItem('octavioUser', JSON.stringify(userData));
    localStorage.setItem('octavioToken', authToken);
  };

  const handleViewerAccess = () => {
    setUser(publicViewerUser);
    setToken(null);
    setActiveBatch(publicViewerBatch);
    setTransactions([]);
    setLogs(publicViewerLogs);
    setActiveScreen('dashboard');
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
      />
    );
  }

  // If they ARE logged in, show the App!
  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-neutral-light dark:bg-slate-950 text-gray-900 dark:text-gray-100 min-h-screen pb-10 transition-colors duration-300 font-sans">
        
        {/* --- TOP NAVIGATION MENU --- */}
        <div className="no-print bg-white/95 dark:bg-slate-900/95 shadow-sm border-b border-neutral-border dark:border-slate-800 p-3 sm:p-4 mb-2 sm:mb-4 flex justify-between items-center sticky top-0 z-10 transition-colors duration-300">
          
          <div className="flex space-x-2 overflow-x-auto">
            <button onClick={() => setActiveScreen('today')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'today' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Today</button>
            <button onClick={() => setActiveScreen('dashboard')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'dashboard' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Home</button>
            {allowedScreens.includes('batches') && (
            <button
  onClick={() => setActiveScreen('batches')}
  className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${
    activeScreen === 'batches'
      ? 'bg-primary text-white shadow-md'
      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'
  }`}
>
  Batches
</button>
            )}
            {canManageOperations && (
              <button onClick={() => setActiveScreen('employees')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'employees' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Employees</button>
            )}
            {allowedScreens.includes('paySummary') && (
              <button onClick={() => setActiveScreen('paySummary')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'paySummary' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Pay Summary</button>
            )}
            {/* RBAC: Only show Ledger and Statement to Admins/OpManagers */}
            {canViewFinancial && (
              <button onClick={() => setActiveScreen('ledger')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'ledger' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Ledger</button>
            )}
            {canViewFinancial && (
              <button onClick={() => setActiveScreen('harvest')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'harvest' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Harvest</button>
            )}
            
            {allowedScreens.includes('dailyLog') && (
              <button onClick={() => setActiveScreen('dailyLog')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'dailyLog' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Daily Logs</button>
            )}
            {allowedScreens.includes('inventory') && (
              <button onClick={() => setActiveScreen('inventory')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'inventory' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Inventory</button>
            )}
            {allowedScreens.includes('analytics') && (
              <button onClick={() => setActiveScreen('analytics')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'analytics' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Analytics</button>
            )}
            
            {canViewFinancial && (
              <button onClick={() => setActiveScreen('statement')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'statement' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Statement</button>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 ml-3 sm:ml-4 shrink-0">
            {!isPublicViewer && (
              <div className="flex items-center">
                <label htmlFor="app-batch-selector" className="sr-only">
                  Active batch
                </label>
                <select
                  id="app-batch-selector"
                  value={activeBatch?.id || ''}
                  onChange={handleBatchSelectorChange}
                  disabled={isBatchListLoading || batches.length === 0}
                  className="h-10 w-[8.5rem] sm:w-48 rounded-full border border-neutral-border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-100 shadow-sm outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  title="Active batch"
                >
                  {isBatchListLoading && <option value="">Loading batches</option>}
                  {!isBatchListLoading && batches.length === 0 && <option value="">No batches</option>}
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {formatBatchOption(batch)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {allowedScreens.includes('settings') && (
              <button
                onClick={() => setActiveScreen('settings')}
                className={`h-10 w-10 inline-flex items-center justify-center rounded-full border shadow-sm hover:scale-105 transition-transform ${
                  activeScreen === 'settings'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-neutral-border dark:bg-slate-800 dark:text-gray-200 dark:border-slate-700'
                }`}
                aria-label="Settings"
                title="Settings"
              >
                <CogIcon />
              </button>
            )}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-white dark:bg-slate-800 text-secondary dark:text-primary-light border border-neutral-border dark:border-slate-700 shadow-sm hover:scale-105 transition-transform"
              aria-label={isDarkMode ? 'Use Light Mode' : 'Use Dark Mode'}
              title={isDarkMode ? 'Use Light Mode' : 'Use Dark Mode'}
            >
              <ThemeIcon isDarkMode={isDarkMode} />
            </button>
            {/* NEW LOGOUT BUTTON */}
            <button onClick={handleLogout} className="p-2 text-xs font-bold text-gray-500 hover:text-semantic-danger transition-colors">
              {isPublicViewer ? 'Exit Preview' : 'Logout'}
            </button>
          </div>
        </div>

        {!isPublicViewer && batchListError && (
          <div className="no-print mx-3 sm:mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            {batchListError}
          </div>
        )}

        {/* --- SCREEN DISPLAY LOGIC --- */}
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
  );
}

export default App;
