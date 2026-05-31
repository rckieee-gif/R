import { useSyncStatus } from '../../offline/syncStatus';
import BatchSelector from '../../shared/components/BatchSelector';

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

export default function Sidebar({
  user,
  isNavMinimized,
  toggleNavMinimized,
  visibleNavItems,
  currentScreen,
  setActiveScreen,
  activeBatch,
  isBatchListLoading,
  batches,
  handleBatchSelectorChange,
  allowedScreens,
  isDarkMode,
  setIsDarkMode,
  isPublicViewer,
  handleLogout,
}) {
  const { isOnline, pendingCount } = useSyncStatus();

  const getScreenMeta = (id) => {
    if (id === 'settings') return { label: 'Settings', icon: 'settings' };
    const found = visibleNavItems.find(item => item.id === id);
    if (found) return found;
    const meta = {
      today: { label: 'Today', icon: 'today' },
      dailyLog: { label: 'Daily Logs', icon: 'edit_note' },
      inventory: { label: 'Inventory', icon: 'inventory' },
      batches: { label: 'Batches', icon: 'layers' },
      harvest: { label: 'Harvest', icon: 'agriculture' },
      analytics: { label: 'Analytics', icon: 'monitoring' },
      ledger: { label: 'Ledger', icon: 'receipt_long' },
      employees: { label: 'Employees', icon: 'group' },
      paySummary: { label: 'Pay Summary', icon: 'payments' },
      statement: { label: 'Statement', icon: 'description' },
      dashboard: { label: 'Home', icon: 'home' }
    };
    return meta[id] || { label: id, icon: 'link' };
  };

  const groups = [
    {
      title: 'Daily Work',
      items: ['today', 'dailyLog', 'inventory']
    },
    {
      title: 'Farm Cycle',
      items: ['batches', 'harvest', 'analytics']
    },
    {
      title: 'Money & People',
      items: ['ledger', 'employees', 'paySummary', 'statement']
    },
    {
      title: 'System',
      items: ['settings']
    }
  ];

  return (
    <aside 
      className={`no-print hidden md:flex flex-col h-screen sticky top-0 left-0 z-40 bg-gradient-to-b from-sidebar-grad-start to-sidebar-grad-end border-r border-white/10 text-white transition-all duration-300 flex-shrink-0 overflow-hidden ${
        isNavMinimized ? 'w-16' : 'w-56'
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0 h-[65px] transition-all duration-300">
        <div className={`min-w-0 transition-all duration-300 ${
          isNavMinimized ? 'w-0 opacity-0 pointer-events-none overflow-hidden' : 'w-auto opacity-100 flex-1'
        }`}>
          <div className="flex items-center">
            {/* Logo/Avatar rounded square */}
            <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-transparent mr-2.5 shadow-inner border border-white/10">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuABNsQ960Pmrnk68ERL8H1V7nTNgR3VcAhTQXfjz54-FzDhXtDujsFIH0JzNSozB1jq8KcKbnBMU0gkAWJTk9GX9myEeB1tWAyvtANgNNFQ66WQ31VJbRwGVC8BY0mhR-bRO0HPeLoB8xtdcQ1nOIzlL20AQ01eQQe5-PICHUimZgBgPMPZESXFLDMNCpO0Bv7p9mVW78U-HcnNZyRrppjA3inwLIZGJI2_o6DNMav2H25TGm0xApDdSwy_jmRqO97c9Q8yvn7ketUJ" 
                alt="Octavio Farms Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-extrabold text-white tracking-tighter truncate uppercase font-hanken whitespace-nowrap">Octavio Farms</h2>
                <div 
                  className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)] flex-shrink-0 cursor-pointer hover:scale-110 transition-transform ${
                    !isOnline 
                      ? 'bg-app-warning animate-pulse' 
                      : pendingCount > 0 
                        ? 'bg-app-info animate-pulse' 
                        : 'bg-app-success'
                  }`}
                  onClick={() => window.dispatchEvent(new CustomEvent('open-sync-drawer'))}
                  title={!isOnline ? `Offline (${pendingCount} pending) - Click to open Sync Queue` : pendingCount > 0 ? `Syncing ${pendingCount} items... - Click to open Sync Queue` : 'Online & Synced - Click to open Sync Queue'}
                />
              </div>
              <p className="text-[9px] font-bold text-white/60 truncate mt-0.5 uppercase tracking-widest font-jetbrains whitespace-nowrap flex items-center gap-1">
                <span>{user?.role === 'Admin' ? 'ADMIN OWNER' : (user?.role || 'Viewer').toUpperCase()}</span>
                {pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-sync-drawer'))}
                    className="px-1.5 py-0.5 rounded bg-app-info/20 text-app-info text-[8px] font-black leading-none uppercase animate-pulse cursor-pointer hover:bg-app-info/30 transition-colors border-0 text-left font-jetbrains"
                  >
                    Sync: {pendingCount}
                  </button>
                )}
              </p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={toggleNavMinimized}
          className={`rounded hover:bg-white/10 text-white/80 hover:text-white transition-all duration-300 flex items-center justify-center ${
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
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4 ag-scrollbar">
        {/* Standalone Home link if allowed */}
        {allowedScreens.includes('dashboard') && (
          <div className="space-y-1">
            {(() => {
              const item = getScreenMeta('dashboard');
              const isActive = currentScreen === 'dashboard';
              return (
                <button
                  onClick={() => setActiveScreen('dashboard')}
                  className={`w-full group flex items-center transition-all duration-200 rounded-xl py-2.5 cursor-pointer ${
                    isNavMinimized ? 'px-4 gap-0 justify-center' : 'px-3.5 gap-3'
                  } ${
                    isActive
                      ? 'bg-[#70B8F9] text-[#0A2540] font-black shadow-sm'
                      : 'bg-transparent text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <span 
                    className={`material-symbols-outlined text-[18px] transition-colors shrink-0 ${
                      isActive ? 'text-[#0A2540]' : 'text-white/80 group-hover:text-white'
                    }`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {item.icon}
                  </span>
                  
                  <span className={`transition-all duration-200 text-[10px] font-bold tracking-wider uppercase truncate ${
                    isNavMinimized ? 'w-0 opacity-0 pointer-events-none' : 'w-28 opacity-100'
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })()}
            <hr className="border-t border-white/10 my-2.5 mx-2" />
          </div>
        )}

        {/* Grouped Sections */}
        {groups.map((group, index) => {
          const visibleItems = group.items.filter(id => allowedScreens.includes(id));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.title} className="space-y-1.5">
              {index > 0 && isNavMinimized && (
                <hr className="border-t border-white/10 my-2 mx-2" />
              )}
              {!isNavMinimized && (
                <div className="text-[9px] font-black tracking-widest text-white/40 px-3.5 uppercase mt-3 mb-1.5 font-jetbrains">
                  {group.title}
                </div>
              )}
              {visibleItems.map(id => {
                const item = getScreenMeta(id);
                const isActive = currentScreen === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveScreen(id)}
                    className={`w-full group flex items-center transition-all duration-200 rounded-xl py-2.5 cursor-pointer ${
                      isNavMinimized ? 'px-4 gap-0 justify-center' : 'px-3.5 gap-3'
                    } ${
                      isActive
                        ? 'bg-[#70B8F9] text-[#0A2540] font-black shadow-sm'
                        : 'bg-transparent text-white/90 hover:bg-white/10 hover:text-white'
                    }`}
                    title={item.label}
                  >
                    <span 
                      className={`material-symbols-outlined text-[18px] transition-colors shrink-0 ${
                        isActive ? 'text-[#0A2540]' : 'text-white/80 group-hover:text-white'
                      }`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {item.icon}
                    </span>
                    
                    <span className={`transition-all duration-200 text-[10px] font-bold tracking-wider uppercase truncate ${
                      isNavMinimized ? 'w-0 opacity-0 pointer-events-none' : 'w-28 opacity-100'
                    }`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer controls */}
      <div className="p-3 border-t border-white/10 shrink-0 flex flex-col gap-3">
        {/* Active Batch Indicator / Selector */}
        {!isPublicViewer && (
          <>
            <div className="relative min-h-[38px] transition-all duration-300">
              <div className={`transition-all duration-300 ${
                isNavMinimized ? 'opacity-0 scale-95 pointer-events-none absolute inset-0' : 'opacity-100 scale-100'
              }`}>
                <div className="flex flex-col gap-1">
                  <label htmlFor="desktop-batch-selector" className="text-[9px] font-bold uppercase tracking-wider text-white/60">
                    Active Batch
                  </label>
                    <BatchSelector
                      id="desktop-batch-selector"
                      activeBatch={activeBatch}
                      batches={batches}
                      isBatchListLoading={isBatchListLoading}
                      onChange={handleBatchSelectorChange}
                      className="w-full h-8"
                    />
                </div>
              </div>
              
              <div className={`transition-all duration-300 ${
                isNavMinimized ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute inset-0'
              }`}>
                <div className="flex justify-center" title={`Active Batch: ${activeBatch?.id || 'None'}`}>
                  <span className="px-1.5 py-0.5 bg-[#70B8F9] rounded text-[9px] font-bold text-[#0A2540] font-jetbrains">
                    B:{activeBatch?.id || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            {/* Divider after Active Batch */}
            <hr className="border-t border-white/10 my-1 mx-2" />
          </>
        )}

        {/* Utility Buttons */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-full group flex items-center transition-all duration-200 rounded-xl py-2.5 bg-transparent text-white/90 hover:bg-white/10 hover:text-white cursor-pointer ${
              isNavMinimized ? 'px-4 gap-0 justify-center' : 'px-3.5 gap-3'
            }`}
            title={isDarkMode ? "Use Light Mode" : "Use Dark Mode"}
          >
            <span className="flex items-center justify-center h-[18px] w-[18px] shrink-0 text-white/80 group-hover:text-white transition-colors">
              <ThemeIcon isDarkMode={isDarkMode} />
            </span>
            <span className={`transition-all duration-200 text-[10px] font-bold tracking-wider uppercase truncate ${
              isNavMinimized ? 'w-0 opacity-0 pointer-events-none' : 'w-28 opacity-100'
            }`}>
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          <button 
            onClick={handleLogout} 
            className={`w-full group flex items-center transition-all duration-200 rounded-xl py-2.5 bg-transparent text-white/90 hover:bg-white/10 hover:text-white cursor-pointer ${
              isNavMinimized ? 'px-4 gap-0 justify-center' : 'px-3.5 gap-3'
            }`}
            title={isPublicViewer ? "Exit Preview" : "Logout"}
          >
            <span className="material-symbols-outlined text-[18px] shrink-0 text-white/80 group-hover:text-white transition-colors" style={{ fontVariationSettings: "'FILL' 1" }}>
              logout
            </span>
            <span className={`transition-all duration-200 text-[10px] font-bold tracking-wider uppercase truncate ${
              isNavMinimized ? 'w-0 opacity-0 pointer-events-none' : 'w-28 opacity-100'
            }`}>
              {isPublicViewer ? "Exit Preview" : "Logout"}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
