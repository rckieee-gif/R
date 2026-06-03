import { lazy, useState, useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import Login from '../features/auth/Login';
import IntroPage from '../features/auth/IntroPage';

import Sidebar from './layout/Sidebar';
import MobileNav from './layout/MobileNav';
import AppShell from './layout/AppShell';
import StatusBar from '../shared/components/StatusBar';
import { useSyncStatus } from '../offline/syncStatus';
import SyncDrawer from '../offline/SyncDrawer';

import useAuth from '../features/auth/useAuth';
import useBatches from '../features/batches/useBatches';
import useTransactions from '../features/ledger/useTransactions';
import useDailyLogs from '../features/dailyLogs/useDailyLogs';

import useAppPreferences from './hooks/useAppPreferences';
import usePermissions from './hooks/usePermissions';
import useNavigation from './hooks/useNavigation';

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

const AntigravityAssistant = lazy(() => import('../shared/components/AntigravityAssistant'));

function BatchesRoute({ batches, ...props }) {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const { batches: batchList, visibleActiveBatch, selectActiveBatch } = batches;

  const handleCycleStarted = (batch) => {
    selectActiveBatch(batch);
    navigate('/today?handoff=day-one', {
      state: { dayOneHandoffBatchId: batch?.id },
    });
  };

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
      batchList={batchList}
      isBatchListLoading={batches.isBatchListLoading}
      onBatchesChanged={batches.refreshBatches}
      onCycleStarted={handleCycleStarted}
      {...props}
    />
  );
}

function App() {
  const auth = useAuth();
  const batches = useBatches(auth.token, auth.user, auth.viewerSnapshot);

  const { isOnline } = useSyncStatus();
  const [isSyncDrawerOpen, setIsSyncDrawerOpen] = useState(false);

  useEffect(() => {
    const handleOpenSyncDrawer = () => {
      setIsSyncDrawerOpen(true);
    };
    window.addEventListener('open-sync-drawer', handleOpenSyncDrawer);
    return () => {
      window.removeEventListener('open-sync-drawer', handleOpenSyncDrawer);
    };
  }, []);

  const { canEnterDaily, canManageOperations, canViewFinancial, canEditOrDelete } = usePermissions(auth.user);

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

  const { isDarkMode, setIsDarkMode, isZeroGravity, setIsZeroGravity, isNavMinimized, toggleNavMinimized } = useAppPreferences();

  const { currentScreen, setActiveScreen, allowedScreens, visibleNavItems } = useNavigation({
    canManageOperations,
    isPublicViewer: auth.isPublicViewer,
    user: auth.user,
  });

  // --- SECURITY GATEKEEPER ---
  if (auth.isCheckingSession) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-100">
        <span className="material-symbols-outlined text-app-accent animate-spin text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          progress_activity
        </span>
        <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-jetbrains">
          Verifying session...
        </p>
      </div>
    );
  }

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
        sessionError={auth.sessionError}
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
      {!isOnline && (
        <div className="no-print bg-app-warning-bg/90 border-b border-app-warning/20 px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-app-warning text-center transition-all duration-300">
          <span className="material-symbols-outlined text-[15px] leading-none animate-pulse">wifi_off</span>
          <span className="font-semibold">You are offline. New entries will be saved on this device and synced later.</span>
        </div>
      )}
      <StatusBar activeBatch={batches.visibleActiveBatch} />

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
                  setActiveBatch={batches.selectActiveBatch}
                  onBatchesChanged={batches.refreshBatches}
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
        
        <Suspense fallback={null}>
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
        </Suspense>
      </div>
      <SyncDrawer isOpen={isSyncDrawerOpen} onClose={() => setIsSyncDrawerOpen(false)} />
    </AppShell>
  );
}

export default App;
