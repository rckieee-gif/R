const allFilterValue = 'all';

export default function ActivityLogs({
  fetchActivityLogs,
  isLoadingActivity,
  activitySearch,
  setActivitySearch,
  activityActionFilter,
  setActivityActionFilter,
  activityEntityFilter,
  setActivityEntityFilter,
  activitySort,
  setActivitySort,
  activityActionOptions,
  activityEntityOptions,
  filteredActivityLogs,
  activityLogs
}) {
  return (
    <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6 font-hanken">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Activity Logs</h3>
          <p className="text-[10px] font-bold text-app-text-secondary mt-1 font-jetbrains">
            Showing {filteredActivityLogs.length} of {activityLogs.length}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchActivityLogs}
          className="text-xs font-black text-app-accent hover:underline cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {isLoadingActivity && (
        <p className="text-xs text-app-text-secondary mb-3 font-black">Loading activity logs...</p>
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_180px_140px] mb-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Search</label>
          <input
            type="search"
            value={activitySearch}
            onChange={(event) => setActivitySearch(event.target.value)}
            placeholder="User, action, batch, ref"
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Action</label>
          <select
            value={activityActionFilter}
            onChange={(event) => setActivityActionFilter(event.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          >
            <option value={allFilterValue}>All actions</option>
            {activityActionOptions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Record Type</label>
          <select
            value={activityEntityFilter}
            onChange={(event) => setActivityEntityFilter(event.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          >
            <option value={allFilterValue}>All types</option>
            {activityEntityOptions.map((entityType) => (
              <option key={entityType} value={entityType}>{entityType}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Sort</label>
          <select
            value={activitySort}
            onChange={(event) => setActivitySort(event.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {(activitySearch || activityActionFilter !== allFilterValue || activityEntityFilter !== allFilterValue || activitySort !== 'newest') && (
        <button
          type="button"
          onClick={() => {
            setActivitySearch('');
            setActivityActionFilter(allFilterValue);
            setActivityEntityFilter(allFilterValue);
            setActivitySort('newest');
          }}
          className="mb-4 text-xs font-black text-app-text bg-app-bg border border-app-border rounded-xl px-3 py-2 hover:border-app-accent hover:text-app-accent transition-all cursor-pointer"
        >
          Clear filters
        </button>
      )}

      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {filteredActivityLogs.map((log) => (
          <div key={log.id} className="rounded-xl border border-app-border bg-app-bg/50 p-3">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-app-text">
                  {log.action} {log.entityType}
                </p>
                <p className="text-[10px] font-black text-app-accent mt-1.5 uppercase tracking-wider font-jetbrains">
                  {(log.actorUsername || log.actorEmail || 'System')} {log.batchId ? `&bull; Batch ${log.batchId}` : ''}
                </p>
              </div>
              <p className="text-[10px] text-app-text-secondary text-right shrink-0 font-jetbrains">
                {new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
            <p className="text-[10px] text-app-text-secondary mt-2 font-jetbrains">
              Ref: {log.entityId || 'n/a'}
            </p>
          </div>
        ))}

        {activityLogs.length === 0 && !isLoadingActivity && (
          <p className="text-center text-app-text-secondary text-sm font-bold">No activity logs yet.</p>
        )}
        {activityLogs.length > 0 && filteredActivityLogs.length === 0 && !isLoadingActivity && (
          <p className="text-center text-app-text-secondary text-sm font-bold">No activity logs match those filters.</p>
        )}
      </div>
    </div>
  );
}
