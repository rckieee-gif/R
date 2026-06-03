import { useState } from 'react';
import BatchSelector from '../../shared/components/BatchSelector';
import SyncStatusBadge from '../../shared/components/SyncStatusBadge';

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
  isPublicViewer,
  activeBatch,
  isBatchListLoading,
  batches,
  handleBatchSelectorChange,
  isDarkMode,
  setIsDarkMode,
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const moreScreens = [
    { id: 'batches', label: 'Batches' },
    { id: 'employees', label: 'Employees' },
    { id: 'paySummary', label: 'Pay Summary' },
    { id: 'ledger', label: 'Expenses' },
    { id: 'harvest', label: 'Harvest' },
    { id: 'analytics', label: 'Reports' },
    { id: 'statement', label: 'Statement' },
    { id: 'settings', label: 'Settings' }
  ];

  const allowedMoreScreens = moreScreens.filter(item => allowedScreens.includes(item.id));
  const isMoreActive = moreScreens.some(item => item.id === currentScreen);

  const getNavLinkClass = (screen) => {
    const isActive = currentScreen === screen;
    return `h-11 px-4 rounded uppercase tracking-wider font-bold text-[10px] sm:text-xs whitespace-nowrap transition-all duration-200 flex items-center justify-center ${
      isActive
        ? 'bg-app-accent text-app-on-accent shadow-sm scale-[1.02]'
        : 'bg-app-card text-app-text-secondary border border-app-border hover:bg-app-bg hover:text-app-text'
    }`;
  };

  return (
    <div className="no-print bg-app-card border-b border-app-border p-3 flex justify-between items-center sticky top-0 z-10 transition-colors duration-300 md:hidden">
      <div className="flex space-x-2 overflow-x-auto ag-scrollbar py-1">
        {allowedScreens.includes('today') && (
          <button onClick={() => setActiveScreen('today')} className={getNavLinkClass('today')}>Today</button>
        )}
        {allowedScreens.includes('dashboard') && (
          <button onClick={() => setActiveScreen('dashboard')} className={getNavLinkClass('dashboard')}>Home</button>
        )}
        {allowedScreens.includes('dailyLog') && (
          <button onClick={() => setActiveScreen('dailyLog')} className={getNavLinkClass('dailyLog')}>Daily Logs</button>
        )}
        {allowedScreens.includes('inventory') && (
          <button onClick={() => setActiveScreen('inventory')} className={getNavLinkClass('inventory')}>Feed & Inventory</button>
        )}
        
        {allowedMoreScreens.length > 0 && (
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`h-11 px-4 rounded uppercase tracking-wider font-bold text-[10px] sm:text-xs whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-1 focus:ring-offset-app-card ${
              isMoreActive || isMoreOpen
                ? 'bg-app-accent text-app-on-accent shadow-sm scale-[1.02]'
                : 'bg-app-card text-app-text-secondary border border-app-border hover:bg-app-bg hover:text-app-text'
            }`}
          >
            <span>More</span>
            <span className="material-symbols-outlined text-xs leading-none shrink-0" aria-hidden="true">
              {isMoreOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
            </span>
          </button>
        )}
      </div>

      {isMoreOpen && allowedMoreScreens.length > 0 && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-transparent" 
            onClick={() => setIsMoreOpen(false)}
          />
          
          <div className="absolute left-3 top-full mt-1.5 z-50 w-44 bg-app-card border border-app-border rounded-xl shadow-2xl overflow-hidden py-1.5 animate-[fadeIn_0.15s_ease-out]">
            {allowedMoreScreens.map(item => {
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveScreen(item.id);
                    setIsMoreOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-app-accent ${
                    isActive
                      ? 'bg-[#70B8F9]/10 text-app-accent font-black'
                      : 'text-app-text-secondary hover:bg-app-bg hover:text-app-text'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </>
      )}
      
      <div className="flex items-center gap-2 ml-3 shrink-0">
        {!isPublicViewer && (
          <BatchSelector
            activeBatch={activeBatch}
            batches={batches}
            isBatchListLoading={isBatchListLoading}
            onChange={handleBatchSelectorChange}
            variant="simple"
            className="h-11 w-24"
          />
        )}
        <SyncStatusBadge className="h-11" />
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="h-11 w-11 inline-flex items-center justify-center rounded bg-app-card text-app-text-secondary border border-app-border transition cursor-pointer"
          aria-label="Toggle theme"
        >
          <ThemeIcon isDarkMode={isDarkMode} />
        </button>
      </div>
    </div>
  );
}
