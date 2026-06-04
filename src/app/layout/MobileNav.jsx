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

  // Group tabs dynamically by permissions
  const primaryTabs = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'dailyLog', label: 'Logs', icon: 'edit_note' },
    { id: 'inventory', label: 'Stock', icon: 'inventory' }
  ].filter(tab => allowedScreens.includes(tab.id));

  const allMoreScreens = [
    { id: 'batches', label: 'Batches' },
    { id: 'employees', label: 'Employees' },
    { id: 'paySummary', label: 'Pay Summary' },
    { id: 'ledger', label: 'Expenses' },
    { id: 'harvest', label: 'Harvest' },
    { id: 'analytics', label: 'Reports' },
    { id: 'statement', label: 'Statement' },
    { id: 'settings', label: 'Settings' }
  ];

  // Exclude primary tabs from "More" list to avoid duplication
  const allowedMoreScreens = allMoreScreens.filter(
    item => allowedScreens.includes(item.id) && !primaryTabs.some(tab => tab.id === item.id)
  );

  return (
    <>
      {/* Clean Top Header */}
      <div className="no-print bg-app-card border-b border-app-border p-3 flex justify-between items-center sticky top-0 z-30 transition-colors duration-300 md:hidden">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-transparent shadow-inner border border-app-border/40">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuABNsQ960Pmrnk68ERL8H1V7nTNgR3VcAhTQXfjz54-FzDhXtDujsFIH0JzNSozB1jq8KcKbnBMU0gkAWJTk9GX9myEeB1tWAyvtANgNNFQ66WQ31VJbRwGVC8BY0mhR-bRO0HPeLoB8xtdcQ1nOIzlL20AQ01eQQe5-PICHUimZgBgPMPZESXFLDMNCpO0Bv7p9mVW78U-HcnNZyRrppjA3inwLIZGJI2_o6DNMav2H25TGm0xApDdSwy_jmRqO97c9Q8yvn7ketUJ" 
              alt="Octavio Farms Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-xs font-black text-app-text tracking-tighter truncate uppercase font-hanken">
            Octavio Farms
          </h2>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isPublicViewer && (
            <BatchSelector
              activeBatch={activeBatch}
              batches={batches}
              isBatchListLoading={isBatchListLoading}
              onChange={handleBatchSelectorChange}
              variant="simple"
              className="h-9 w-28 text-xs"
            />
          )}
          <SyncStatusBadge className="h-9 px-2" />
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-app-card text-app-text-secondary border border-app-border transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-1 focus-visible:ring-offset-app-card hover:bg-app-bg hover:text-app-text active:scale-95"
            aria-label="Toggle theme"
          >
            <ThemeIcon isDarkMode={isDarkMode} />
          </button>
        </div>
      </div>

      {/* Ergonomic Bottom Tab Bar */}
      <nav className="no-print fixed bottom-0 left-0 right-0 z-30 bg-app-card/90 backdrop-blur-md border-t border-app-border h-16 flex items-center justify-around px-2 pb-safe-bottom transition-colors duration-300 md:hidden">
        {primaryTabs.map((tab) => {
          const isActive = currentScreen === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveScreen(tab.id);
                setIsMoreOpen(false);
              }}
              className={`flex-1 flex flex-col items-center justify-center h-full transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/35 rounded-xl ${
                isActive ? 'text-app-accent' : 'text-app-text-secondary hover:text-app-text'
              }`}
            >
              <span 
                className="material-symbols-outlined text-xl mb-0.5" 
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {tab.icon}
              </span>
              <span className={`text-[8.5px] font-black uppercase tracking-wider ${isActive ? 'font-black' : 'font-extrabold'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="w-5 h-0.5 bg-app-accent rounded-full mt-0.5 animate-[fadeIn_0.15s_ease-out]" />
              )}
            </button>
          );
        })}

        {allowedMoreScreens.length > 0 && (
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={`flex-1 flex flex-col items-center justify-center h-full transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/35 rounded-xl ${
              isMoreOpen || allowedMoreScreens.some(s => s.id === currentScreen)
                ? 'text-app-accent'
                : 'text-app-text-secondary hover:text-app-text'
            }`}
          >
            <span className="material-symbols-outlined text-xl mb-0.5">
              apps
            </span>
            <span className="text-[8.5px] font-black uppercase tracking-wider">
              More
            </span>
            {(isMoreOpen || allowedMoreScreens.some(s => s.id === currentScreen)) && (
              <span className="w-5 h-0.5 bg-app-accent rounded-full mt-0.5" />
            )}
          </button>
        )}
      </nav>

      {/* "More" Sheet Overlay */}
      {isMoreOpen && allowedMoreScreens.length > 0 && (
        <>
          <div 
            className="fixed inset-0 z-20 bg-black/25 backdrop-blur-sm md:hidden" 
            onClick={() => setIsMoreOpen(false)}
          />
          
          <div className="fixed left-3 bottom-18 z-30 w-48 bg-app-card border border-app-border rounded-2xl shadow-2xl overflow-hidden py-1.5 animate-[fadeIn_0.15s_ease-out]">
            {allowedMoreScreens.map(item => {
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveScreen(item.id);
                    setIsMoreOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3.5 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-app-accent ${
                    isActive
                      ? 'bg-app-accent/10 text-app-accent font-black'
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
    </>
  );
}
