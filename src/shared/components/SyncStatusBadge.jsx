import { useSyncStatus } from '../../offline/syncStatus';

export default function SyncStatusBadge({ className = '' }) {
  const { isOnline, pendingCount } = useSyncStatus();

  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent('open-sync-drawer'));
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider font-jetbrains shrink-0 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-1 focus:ring-offset-app-card cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
        !isOnline
          ? 'text-app-warning border-app-warning/20 bg-app-warning-bg/40 hover:bg-app-warning-bg/60'
          : pendingCount > 0
            ? 'text-app-info border-app-info/20 bg-app-info-bg/40 hover:bg-app-info-bg/60'
            : 'text-app-success border-app-success/20 bg-app-success-bg/40 hover:bg-app-success-bg/60'
      } ${className}`}
      title={
        !isOnline
          ? `Offline (${pendingCount} pending) - Click to view Sync Queue`
          : pendingCount > 0
            ? `Syncing ${pendingCount} items... - Click to view Sync Queue`
            : 'Online & Synced - Click to view Sync Queue'
      }
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          !isOnline
            ? 'bg-app-warning animate-pulse'
            : pendingCount > 0
              ? 'bg-app-info animate-pulse'
              : 'bg-app-success'
        }`}
      />
      {pendingCount > 0 ? `Sync:${pendingCount}` : isOnline ? 'Online' : 'Offline'}
    </button>
  );
}
