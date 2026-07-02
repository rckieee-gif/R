import { useSyncStatus } from '../../offline/syncStatus';

const NAV_ORDER = [
  { id: 'dashboard', label: 'Farm Overview', icon: 'dashboard' },
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'dailyLog', label: 'Daily Logs', icon: 'edit_note' },
  { id: 'inventory', label: 'Feed & inventory', icon: 'inventory_2' },
  { id: 'batches', label: 'Batches', icon: 'layers' },
  { id: 'harvest', label: 'Harvest', icon: 'agriculture' },
  { id: 'analytics', label: 'Reports', icon: 'bar_chart' },
  { id: 'ledger', label: 'Expenses', icon: 'receipt_long' },
  { id: 'employees', label: 'Employees', icon: 'group' },
  { id: 'paySummary', label: 'Pay Summary', icon: 'payments' },
  { id: 'statement', label: 'Statement', icon: 'description' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function getUserName(user) {
  return user?.displayName || user?.username || user?.email?.split('@')[0] || 'Username';
}

function getUserLabel(user, isPublicViewer) {
  if (isPublicViewer) return 'Viewer';
  return user?.role || 'Label';
}

export default function Sidebar({
  user,
  currentScreen,
  setActiveScreen,
  allowedScreens,
  isPublicViewer,
  handleLogout,
}) {
  const { isOnline, pendingCount } = useSyncStatus();
  const visibleItems = NAV_ORDER.filter((item) => allowedScreens.includes(item.id));
  const syncTitle = !isOnline
    ? `Offline (${pendingCount} pending)`
    : pendingCount > 0
      ? `${pendingCount} pending sync items`
      : 'Online and synced';

  return (
    <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[250px] shrink-0 flex-col border-r border-app-border bg-[#f8f1e3] text-app-text md:flex">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-app-border">
        <div className="h-9 w-9 rounded-full bg-app-accent text-app-on-accent flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>
            eco
          </span>
        </div>
        <div className="min-w-0">
          <h1 className="octavio-serif text-[19px] leading-tight font-bold truncate">Octavio Farms</h1>
          <p className="text-xs text-app-text-secondary">Farm Manager</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 ag-scrollbar" aria-label="Primary navigation">
        {visibleItems.map((item) => {
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveScreen(item.id)}
              className={`group flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-app-accent text-app-on-accent shadow-[0_2px_5px_rgba(67,110,69,0.28)]'
                  : 'text-app-text hover:bg-white/55 hover:text-app-text'
              }`}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
            >
              <span
                className={`material-symbols-outlined text-[19px] shrink-0 ${isActive ? 'text-app-on-accent' : 'text-app-text'}`}
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-app-border p-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-sync-drawer'))}
          className="mb-3 flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[11px] font-semibold text-app-text-secondary hover:bg-white/60 cursor-pointer"
          title={syncTitle}
        >
          <span className={`h-2 w-2 rounded-full ${!isOnline ? 'bg-app-warning' : pendingCount ? 'bg-app-info' : 'bg-app-success'}`} />
          <span className="truncate">{syncTitle}</span>
        </button>

        <div className="px-2 pb-2">
          <p className="text-xs font-bold text-app-text truncate">{getUserName(user)}</p>
          <p className="text-xs text-app-text-secondary truncate">{getUserLabel(user, isPublicViewer)}</p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-app-card text-xs font-semibold text-app-text shadow-sm hover:bg-white cursor-pointer"
        >
          <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 0" }}>
            logout
          </span>
          {isPublicViewer ? 'Exit preview' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
