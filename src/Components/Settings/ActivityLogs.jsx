const allFilterValue = 'all';

export default function ActivityLogs({
  fetchActivityLogs,
  activityError,
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
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Activity Logs</h3>
          <p className="text-[10px] font-bold text-gray-400 mt-1">
            Showing {filteredActivityLogs.length} of {activityLogs.length}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchActivityLogs}
          className="text-xs font-black text-primary hover:underline"
        >
          Refresh
        </button>
      </div>

      {activityError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
          {activityError}
        </div>
      )}

      {isLoadingActivity && (
        <p className="text-xs text-gray-500 mb-3 font-semibold">Loading activity logs...</p>
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_180px_140px] mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Search</label>
          <input
            type="search"
            value={activitySearch}
            onChange={(event) => setActivitySearch(event.target.value)}
            placeholder="User, action, batch, ref"
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Action</label>
          <select
            value={activityActionFilter}
            onChange={(event) => setActivityActionFilter(event.target.value)}
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none font-bold"
          >
            <option value={allFilterValue}>All actions</option>
            {activityActionOptions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Record Type</label>
          <select
            value={activityEntityFilter}
            onChange={(event) => setActivityEntityFilter(event.target.value)}
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none font-bold"
          >
            <option value={allFilterValue}>All types</option>
            {activityEntityOptions.map((entityType) => (
              <option key={entityType} value={entityType}>{entityType}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Sort</label>
          <select
            value={activitySort}
            onChange={(event) => setActivitySort(event.target.value)}
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none font-bold"
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
          className="mb-4 text-xs font-black text-gray-500 dark:text-gray-300 bg-neutral-light dark:bg-gray-700 border border-neutral-border dark:border-gray-600 rounded-lg px-3 py-2 hover:bg-neutral-200 dark:hover:bg-gray-600 transition-colors"
        >
          Clear filters
        </button>
      )}

      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {filteredActivityLogs.map((log) => (
          <div key={log.id} className="rounded-xl border border-neutral-border dark:border-gray-700 bg-neutral-light dark:bg-gray-900 p-3">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                  {log.action} {log.entityType}
                </p>
                <p className="text-[10px] font-bold text-primary mt-1">
                  {(log.actorUsername || log.actorEmail || 'System')} {log.batchId ? `- Batch ${log.batchId}` : ''}
                </p>
              </div>
              <p className="text-[10px] text-gray-400 text-right shrink-0">
                {new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">
              Ref: {log.entityId || 'n/a'}
            </p>
          </div>
        ))}

        {activityLogs.length === 0 && !isLoadingActivity && (
          <p className="text-center text-gray-500 text-sm">No activity logs yet.</p>
        )}
        {activityLogs.length > 0 && filteredActivityLogs.length === 0 && !isLoadingActivity && (
          <p className="text-center text-gray-500 text-sm">No activity logs match those filters.</p>
        )}
      </div>
    </div>
  );
}
