import { useSyncStatus } from '../../offline/syncStatus';

export default function SyncStatusBadge({ className = '' }) {
  const { isOnline, pendingCount } = useSyncStatus();

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider font-jetbrains shrink-0 transition-all duration-300 ${
        !isOnline
          ? 'text-amber-500 border-amber-500/20 bg-amber-500/5'
          : pendingCount > 0
            ? 'text-sky-500 border-sky-500/20 bg-sky-500/5'
            : 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5'
      } ${className}`}
      title={!isOnline ? `Offline (${pendingCount} pending)` : pendingCount > 0 ? `Syncing ${pendingCount} items...` : 'Online & Synced'}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          !isOnline
            ? 'bg-amber-400 animate-pulse'
            : pendingCount > 0
              ? 'bg-sky-400 animate-pulse'
              : 'bg-emerald-400'
        }`}
      />
      {pendingCount > 0 ? `Sync:${pendingCount}` : isOnline ? 'Online' : 'Offline'}
    </div>
  );
}
