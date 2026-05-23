import { useState, useEffect, useCallback, useMemo } from 'react';
import Login from './login';
import TransactionLedger from './TransactionLedger';
import DailyLog from './DailyLog';
import Dashboard from './Dashboard';
import TodayOperations from './TodayOperations';
import Analytics from './Analytics';
import FinancialStatement from './FinancialStatement';
import BatchManagement from './BatchManagement';
import EmployeeManagement from './EmployeeManagement';
import EmployeePaySummary from './EmployeePaySummary';
import InventoryManagement from './InventoryManagement';
import Settings from './Settings';
import { API_BASE } from './api';
import AntigravityAssistant from './Components/AntigravityAssistant';

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
  // --- DAILY LOGS DATABASE (NOW CONNECTED TO POSTGRESQL!) ---
  const [logs, setLogs] = useState([]);
  const canEnterDaily = hasMinimumRole(user?.role, 'DataEntry');
  const canManageOperations = hasMinimumRole(user?.role, 'OperationManager');
  const canViewFinancial = canManageOperations;
  const canEditOrDelete = Boolean(user?.isPrimaryOwner);
  const allowedScreens = useMemo(() => [
    'today',
    'dashboard',
    'batches',
    'dailyLog',
    'paySummary',
    'inventory',
    'analytics',
    'settings',
    ...(canManageOperations ? ['employees', 'ledger', 'statement'] : []),
  ], [canManageOperations]);

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    setActiveBatch(null);
    setTransactions([]);
    setLogs([]);
    localStorage.removeItem('octavioUser');
    localStorage.removeItem('octavioToken');
    setActiveScreen('today');
  }, []);

  useEffect(() => {
    if (!token) {
      setTimeout(() => {
        clearSession();
      }, 0);
      return;
    }

    const fetchActiveBatch = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/batches/active`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 401) {
          clearSession();
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setActiveBatch(data);
        }
      } catch (error) {
        console.error("Failed to fetch active batch:", error);
      }
    };

    fetchActiveBatch();
  }, [token, clearSession]);

  useEffect(() => {
    if (!token || !activeBatch?.id || !canViewFinancial) {
      setTimeout(() => {
        setTransactions([]);
      }, 0);
      return;
    }

    const fetchTransactions = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/batches/${activeBatch.id}/transactions`, {
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
    };

    fetchTransactions();
  }, [token, activeBatch?.id, canViewFinancial, clearSession]);

  useEffect(() => {
    if (!token || !activeBatch?.id) {
      setTimeout(() => {
        setLogs([]);
      }, 0);
      return;
    }

    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/logs?batchId=${activeBatch.id}`, {
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
  }, [token, activeBatch?.id, clearSession]);

  // --- LOGIN HANDLER ---
  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('octavioUser', JSON.stringify(userData));
    localStorage.setItem('octavioToken', authToken);
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
  if (!user || !token) {
    return <Login onLogin={handleLogin} />;
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
            {canManageOperations && (
              <button onClick={() => setActiveScreen('employees')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'employees' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Employees</button>
            )}
            <button onClick={() => setActiveScreen('paySummary')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'paySummary' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Pay Summary</button>
            {/* RBAC: Only show Ledger and Statement to Admins/OpManagers */}
            {canViewFinancial && (
              <button onClick={() => setActiveScreen('ledger')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'ledger' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Ledger</button>
            )}
            
            <button onClick={() => setActiveScreen('dailyLog')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'dailyLog' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Daily Logs</button>
            <button onClick={() => setActiveScreen('inventory')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'inventory' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Inventory</button>
            <button onClick={() => setActiveScreen('analytics')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'analytics' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Analytics</button>
            
            {canViewFinancial && (
              <button onClick={() => setActiveScreen('statement')} className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${activeScreen === 'statement' ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-neutral-border dark:border-slate-700'}`}>Statement</button>
            )}
          </div>
          
          <div className="flex items-center space-x-3 ml-4">
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
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-white dark:bg-slate-800 text-secondary dark:text-primary-light border border-neutral-border dark:border-slate-700 shadow-sm hover:scale-105 transition-transform"
              aria-label={isDarkMode ? 'Use Light Mode' : 'Use Dark Mode'}
              title={isDarkMode ? 'Use Light Mode' : 'Use Dark Mode'}
            >
              <ThemeIcon isDarkMode={isDarkMode} />
            </button>
            {/* NEW LOGOUT BUTTON */}
            <button onClick={handleLogout} className="p-2 text-xs font-bold text-gray-500 hover:text-semantic-danger transition-colors">Logout</button>
          </div>
        </div>

        {/* --- SCREEN DISPLAY LOGIC --- */}
        {activeScreen === 'today' && (
  <TodayOperations
    token={token}
    activeBatch={activeBatch}
    logs={logs}
    setActiveScreen={setActiveScreen}
  />
)}

        {activeScreen === 'batches' && (
  <BatchManagement
    activeBatch={activeBatch}
    setActiveBatch={setActiveBatch}
    token={token}
    readOnly={!canManageOperations}
    canEditOrDelete={canEditOrDelete}
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

{activeScreen === 'dailyLog' && (
  <DailyLog logs={logs} setLogs={setLogs} activeBatch={activeBatch} token={token} readOnly={!canEnterDaily} canEditOrDelete={canEditOrDelete} />
)}

{activeScreen === 'inventory' && (
  <InventoryManagement activeBatch={activeBatch} token={token} readOnly={!canManageOperations} canEditOrDelete={canEditOrDelete} />
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
