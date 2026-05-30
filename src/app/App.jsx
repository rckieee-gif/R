import { useState, useEffect, useMemo, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import Login from '../features/auth/Login';
import IntroPage from '../features/auth/IntroPage';
import AntigravityAssistant from '../shared/components/AntigravityAssistant';

import Sidebar from './layout/Sidebar';
import MobileNav from './layout/MobileNav';
import AppShell from './layout/AppShell';

import useAuth from '../features/auth/useAuth';
import useBatches from '../features/batches/useBatches';
import useTransactions from '../features/ledger/useTransactions';
import useDailyLogs from '../features/dailyLogs/useDailyLogs';

import {
  TodayOperations,
  BatchManagement,
  Dashboard,
  EmployeeManagement,
  EmployeePaySummary,
  TransactionLedger,
  HarvestRecording,
  DailyLog,
  InventoryManagement,
  Analytics,
  FinancialStatement,
  Settings
} from './routes';

const ZERO_GRAVITY_STORAGE_KEY = 'octavioZeroGravityEnabled';
const LEGACY_ZERO_GRAVITY_STORAGE_KEY = 'antigravityMode';

import { hasMinimumRole } from '../shared/utils/roles';

function readZeroGravityPreference() {
  const saved = localStorage.getItem(ZERO_GRAVITY_STORAGE_KEY);

  return saved !== 'false';
}

function BatchesRoute({ batches, ...props }) {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const { batches: batchList, visibleActiveBatch, selectActiveBatch } = batches;

  // URL -> State: when batchId in URL changes, update activeBatch state
  useEffect(() => {
    if (batchId) {
      const matched = batchList.find((b) => String(b.id) === String(batchId));
      if (matched && String(matched.id) !== String(visibleActiveBatch?.id)) {
        selectActiveBatch(matched);
      }
    }
  }, [batchId, batchList, visibleActiveBatch?.id, selectActiveBatch]);

  // State -> URL: when activeBatch state changes, update the URL
  useEffect(() => {
    if (visibleActiveBatch?.id) {
      if (String(batchId) !== String(visibleActiveBatch.id)) {
        navigate(`/batches/${visibleActiveBatch.id}`);
      }
    } else if (batchId) {
      const hasBatchesLoaded = batchList.length > 0;
      const matched = batchList.find((b) => String(b.id) === String(batchId));
      if (hasBatchesLoaded && !matched) {
        navigate('/batches');
      }
    }
  }, [visibleActiveBatch?.id, batchId, navigate, batchList]);

  return (
    <BatchManagement
      activeBatch={visibleActiveBatch}
      setActiveBatch={selectActiveBatch}
      {...props}
    />
  );
}

function App() {
  const auth = useAuth();
  const batches = useBatches(auth.token, auth.user, auth.viewerSnapshot);

  const canEnterDaily = useMemo(() => hasMinimumRole(auth.user?.role, 'DataEntry'), [auth.user]);
  const canManageOperations = useMemo(() => hasMinimumRole(auth.user?.role, 'OperationManager'), [auth.user]);
  const canViewFinancial = canManageOperations;
  const canEditOrDelete = useMemo(() => Boolean(auth.user?.isPrimaryOwner), [auth.user]);

  const { transactions, setTransactions, refreshTransactions } = useTransactions(
    batches.visibleActiveBatch?.id,
    auth.token,
    canViewFinancial
  );

  const { logs, setLogs } = useDailyLogs(
    batches.visibleActiveBatch?.id,
    auth.apiToken,
    auth.isPublicViewer,
    auth.viewerPreviewData
  );

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

  const navigate = useNavigate();
  const location = useLocation();

  const currentScreen = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/today')) return 'today';
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/batches')) return 'batches';
    if (path.startsWith('/employees')) return 'employees';
    if (path.startsWith('/pay-summary')) return 'paySummary';
    if (path.startsWith('/ledger')) return 'ledger';
    if (path.startsWith('/harvest')) return 'harvest';
    if (path.startsWith('/daily-log')) return 'dailyLog';
    if (path.startsWith('/inventory')) return 'inventory';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.startsWith('/statement')) return 'statement';
    if (path.startsWith('/settings')) return 'settings';
    return 'today';
  }, [location.pathname]);

  const setActiveScreen = (screenId) => {
    const routeMap = {
      today: '/today',
      dashboard: '/dashboard',
      batches: '/batches',
      employees: '/employees',
      paySummary: '/pay-summary',
      ledger: '/ledger',
      harvest: '/harvest',
      dailyLog: '/daily-log',
      inventory: '/inventory',
      analytics: '/analytics',
      statement: '/statement',
      settings: '/settings',
    };
    const route = routeMap[screenId];
    if (route) {
      navigate(route);
    }
  };

  const allowedScreens = useMemo(() => {
    if (auth.isPublicViewer) {
      return ['today', 'dashboard'];
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
  }, [canManageOperations, auth.isPublicViewer]);

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

  // Route guard: Redirect if trying to access unauthorized screen
  useEffect(() => {
    const routeToScreen = {
      '/today': 'today',
      '/dashboard': 'dashboard',
      '/batches': 'batches',
      '/inventory': 'inventory',
      '/ledger': 'ledger',
      '/harvest': 'harvest',
      '/employees': 'employees',
      '/pay-summary': 'paySummary',
      '/daily-log': 'dailyLog',
      '/analytics': 'analytics',
      '/statement': 'statement',
      '/settings': 'settings',
    };
    
    const path = location.pathname;
    let screen = null;
    for (const [route, screenId] of Object.entries(routeToScreen)) {
      if (path.startsWith(route)) {
        screen = screenId;
        break;
      }
    }
    
    // Only guard if user is logged in
    if (auth.user && screen && !allowedScreens.includes(screen)) {
      navigate('/today', { replace: true });
    }
  }, [location.pathname, allowedScreens, navigate, auth.user]);

  // --- SECURITY GATEKEEPER ---
  if (!auth.user || (!auth.token && !auth.isPublicViewer)) {
    if (auth.authView === 'login') {
      return <Login onLogin={auth.handleLogin} onBack={() => auth.setAuthView('intro')} />;
    }

    return (
      <IntroPage
        onContinueAsViewer={auth.handleViewerAccess}
        onMemberLogin={() => auth.setAuthView('login')}
        isViewerLoading={auth.isViewerLoading}
        viewerError={auth.viewerError}
        preloadedSnapshot={auth.preloadedSnapshot}
      />
    );
  }

  // Render Sidebar layout component
  const sidebar = (
    <Sidebar
      user={auth.user}
      isNavMinimized={isNavMinimized}
      toggleNavMinimized={toggleNavMinimized}
      visibleNavItems={visibleNavItems}
      currentScreen={currentScreen}
      setActiveScreen={setActiveScreen}
      activeBatch={batches.visibleActiveBatch}
      isBatchListLoading={batches.isBatchListLoading}
      batches={batches.batches}
      handleBatchSelectorChange={batches.handleBatchSelectorChange}
      allowedScreens={allowedScreens}
      isDarkMode={isDarkMode}
      setIsDarkMode={setIsDarkMode}
      isPublicViewer={auth.isPublicViewer}
      handleLogout={auth.handleLogout}
    />
  );

  // Render MobileNav layout component
  const mobileNav = (
    <MobileNav
      allowedScreens={allowedScreens}
      currentScreen={currentScreen}
      setActiveScreen={setActiveScreen}
      canManageOperations={canManageOperations}
      canViewFinancial={canViewFinancial}
      isPublicViewer={auth.isPublicViewer}
      activeBatch={batches.visibleActiveBatch}
      isBatchListLoading={batches.isBatchListLoading}
      batches={batches.batches}
      handleBatchSelectorChange={batches.handleBatchSelectorChange}
      isDarkMode={isDarkMode}
      setIsDarkMode={setIsDarkMode}
    />
  );

  return (
    <AppShell sidebar={sidebar} mobileNav={mobileNav} isDarkMode={isDarkMode}>
      {/* Batch list error overlay */}
      {!auth.isPublicViewer && batches.batchListError && (
        <div className="no-print mx-4 mt-4 mb-2 rounded border border-app-warning/30 bg-app-warning-bg px-4 py-3 text-sm font-semibold text-app-warning">
          {batches.batchListError}
        </div>
      )}

      {/* Screen Content Render */}
      <div className="flex-1 min-w-0">
        <Suspense fallback={
          <div className="flex h-64 w-full flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-app-accent animate-spin text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              progress_activity
            </span>
            <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-jetbrains">
              Loading screen...
            </p>
          </div>
        }>
          <Routes>
            <Route
              path="/today"
              element={
                <TodayOperations
                  key={batches.visibleActiveBatch?.id ?? 'none'}
                  token={auth.apiToken}
                  activeBatch={batches.visibleActiveBatch}
                  logs={logs}
                  setActiveScreen={setActiveScreen}
                  previewData={auth.viewerPreviewData}
                />
              }
            />
            <Route
              path="/batches"
              element={
                <BatchesRoute
                  batches={batches}
                  token={auth.apiToken}
                  readOnly={!canManageOperations}
                  canEditOrDelete={canEditOrDelete}
                  previewData={auth.viewerPreviewData}
                />
              }
            />
            <Route
              path="/batches/:batchId"
              element={
                <BatchesRoute
                  batches={batches}
                  token={auth.apiToken}
                  readOnly={!canManageOperations}
                  canEditOrDelete={canEditOrDelete}
                  previewData={auth.viewerPreviewData}
                />
              }
            />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  setActiveScreen={setActiveScreen}
                  logs={logs}
                  activeBatch={batches.visibleActiveBatch}
                  user={auth.user}
                />
              }
            />
            <Route
              path="/employees"
              element={
                canManageOperations ? (
                  <EmployeeManagement
                    token={auth.token}
                    transactions={transactions}
                    dailyLogs={logs}
                    activeBatch={batches.visibleActiveBatch}
                    canEditOrDelete={canEditOrDelete}
                  />
                ) : (
                  <Navigate to="/today" replace />
                )
              }
            />
            <Route
              path="/pay-summary"
              element={
                <EmployeePaySummary
                  token={auth.token}
                  activeBatch={batches.visibleActiveBatch}
                  transactions={transactions}
                />
              }
            />
            <Route
              path="/ledger"
              element={
                canViewFinancial ? (
                  <TransactionLedger
                    transactions={transactions}
                    setTransactions={setTransactions}
                    activeBatch={batches.visibleActiveBatch}
                    token={auth.token}
                    readOnly={!canManageOperations}
                    canEditOrDelete={canEditOrDelete}
                  />
                ) : (
                  <Navigate to="/today" replace />
                )
              }
            />
            <Route
              path="/harvest"
              element={
                canViewFinancial ? (
                  <HarvestRecording
                    activeBatch={batches.visibleActiveBatch}
                    token={auth.token}
                    readOnly={!canManageOperations}
                    onLedgerPosted={refreshTransactions}
                    onBatchesChanged={batches.refreshBatches}
                  />
                ) : (
                  <Navigate to="/today" replace />
                )
              }
            />
            <Route
              path="/daily-log"
              element={
                <DailyLog
                  logs={logs}
                  setLogs={setLogs}
                  activeBatch={batches.visibleActiveBatch}
                  token={auth.apiToken}
                  readOnly={!canEnterDaily}
                  canEditOrDelete={canEditOrDelete}
                />
              }
            />
            <Route
              path="/inventory"
              element={
                <InventoryManagement
                  activeBatch={batches.visibleActiveBatch}
                  token={auth.apiToken}
                  readOnly={!canManageOperations}
                  canEditOrDelete={canEditOrDelete}
                  previewData={auth.viewerPreviewData}
                />
              }
            />
            <Route
              path="/analytics"
              element={
                <Analytics
                  transactions={canViewFinancial ? transactions : []}
                  logs={logs}
                  activeBatch={batches.visibleActiveBatch}
                  showFinancials={canViewFinancial}
                />
              }
            />
            <Route
              path="/statement"
              element={
                canViewFinancial ? (
                  <FinancialStatement
                    transactions={transactions}
                    activeBatch={batches.visibleActiveBatch}
                  />
                ) : (
                  <Navigate to="/today" replace />
                )
              }
            />
            <Route
              path="/settings"
              element={
                <Settings
                  user={auth.user}
                  token={auth.token}
                  activeBatch={batches.visibleActiveBatch}
                  isZeroGravity={isZeroGravity}
                  setIsZeroGravity={setIsZeroGravity}
                />
              }
            />
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </Suspense>
        
        <AntigravityAssistant
          activeBatch={batches.visibleActiveBatch}
          logs={logs}
          transactions={transactions}
          user={auth.user}
          isZeroGravity={isZeroGravity}
          allowedScreens={allowedScreens}
          canEnterDaily={canEnterDaily}
          canViewFinancial={canViewFinancial}
          isPublicViewer={auth.isPublicViewer}
          token={auth.apiToken}
        />
      </div>
    </AppShell>
  );
}

export default App;
