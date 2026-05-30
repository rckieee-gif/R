import BatchSelector from '../../shared/components/BatchSelector';
import SyncStatusBadge from '../../shared/components/SyncStatusBadge';

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

export default function MobileNav({
  allowedScreens,
  currentScreen,
  setActiveScreen,
  canManageOperations,
  canViewFinancial,
  isPublicViewer,
  activeBatch,
  isBatchListLoading,
  batches,
  handleBatchSelectorChange,
  isDarkMode,
  setIsDarkMode,
}) {

  const getNavLinkClass = (screen) => {
    const isActive = currentScreen === screen;
    return `px-3.5 py-1.5 rounded uppercase tracking-wider font-bold text-[10px] sm:text-xs whitespace-nowrap transition-all duration-200 ${
      isActive
        ? 'bg-app-accent text-app-on-accent shadow-sm scale-[1.02]'
        : 'bg-app-card text-app-text-secondary border border-app-border hover:bg-app-bg hover:text-app-text'
    }`;
  };

  return (
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
          <BatchSelector
            activeBatch={activeBatch}
            batches={batches}
            isBatchListLoading={isBatchListLoading}
            onChange={handleBatchSelectorChange}
            variant="simple"
            className="h-8 w-24"
          />
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
        <SyncStatusBadge className="h-8" />
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="h-8 w-8 inline-flex items-center justify-center rounded bg-app-card text-app-text-secondary border border-app-border transition"
        >
          <ThemeIcon isDarkMode={isDarkMode} />
        </button>
      </div>
    </div>
  );
}
