import { useSyncStatus } from '../../offline/syncStatus';
import { processSyncQueue } from '../../offline/syncQueue';
import { apiClient } from '../utils/apiClient';

export default function SyncStatusBadge({ className = '' }) {
  const { isOnline, pendingCount } = useSyncStatus();

  return (
    <button
      type="button"
      onClick={() => {
        if (pendingCount > 0) {
          processSyncQueue(apiClient);
        }
      }}
      disabled={pendingCount === 0}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider font-jetbrains shrink-0 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-app-accent focus:ring-offset-1 focus:ring-offset-app-card disabled:opacity-85 disabled:cursor-not-allowed ${
        !isOnline
          ? 'text-app-warning border-app-warning/20 bg-app-warning-bg/40 hover:bg-app-warning-bg/60 cursor-pointer'
          : pendingCount > 0
            ? 'text-app-info border-app-info/20 bg-app-info-bg/40 hover:bg-app-info-bg/60 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
            : 'text-app-success border-app-success/20 bg-app-success-bg/40'
      } ${className}`}
      title={
        !isOnline
          ? `Offline (${pendingCount} pending)`
          : pendingCount > 0
            ? `Click to sync ${pendingCount} items now`
            : 'Online & Synced'
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
