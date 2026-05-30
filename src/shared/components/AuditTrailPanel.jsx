import { useState, useMemo } from 'react';

const allFilterValue = 'all';

export default function AuditTrailPanel({
  logs = [],
  isLoading = false,
  onRefresh,
  title = 'Activity Logs',
  className = ''
}) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState(allFilterValue);
  const [entityFilter, setEntityFilter] = useState(allFilterValue);
  const [sort, setSort] = useState('newest');

  const actionOptions = useMemo(() => {
    const actions = new Set(logs.map(log => log.action).filter(Boolean));
    return Array.from(actions).sort();
  }, [logs]);

  const entityOptions = useMemo(() => {
    const entities = new Set(logs.map(log => log.entityType).filter(Boolean));
    return Array.from(entities).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(log => 
        String(log.action || '').toLowerCase().includes(q) ||
        String(log.entityType || '').toLowerCase().includes(q) ||
        String(log.actorUsername || log.actorEmail || '').toLowerCase().includes(q) ||
        String(log.entityId || '').toLowerCase().includes(q)
      );
    }

    if (actionFilter !== allFilterValue) {
      result = result.filter(log => log.action === actionFilter);
    }

    if (entityFilter !== allFilterValue) {
      result = result.filter(log => log.entityType === entityFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [logs, search, actionFilter, entityFilter, sort]);

  return (
    <div className={`bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6 font-hanken ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">{title}</h3>
          <p className="text-[10px] font-bold text-app-text-secondary mt-1 font-jetbrains">
            Showing {filteredLogs.length} of {logs.length}
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="text-xs font-black text-app-accent hover:underline cursor-pointer disabled:opacity-50"
          >
            Refresh
          </button>
        )}
      </div>

      {isLoading && (
        <p className="text-xs text-app-text-secondary mb-3 font-black">Loading logs...</p>
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_180px_140px] mb-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Search</label>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="User, action, type, ref"
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Action</label>
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all cursor-pointer text-xs"
          >
            <option value={allFilterValue}>All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Record Type</label>
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all cursor-pointer text-xs"
          >
            <option value={allFilterValue}>All types</option>
            {entityOptions.map((entityType) => (
              <option key={entityType} value={entityType}>{entityType}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Sort</label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains cursor-pointer text-xs"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {(search || actionFilter !== allFilterValue || entityFilter !== allFilterValue || sort !== 'newest') && (
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setActionFilter(allFilterValue);
            setEntityFilter(allFilterValue);
            setSort('newest');
          }}
          className="mb-4 text-xs font-black text-app-text bg-app-bg border border-app-border rounded-xl px-3 py-2 hover:border-app-accent hover:text-app-accent transition-all cursor-pointer font-hanken"
        >
          Clear filters
        </button>
      )}

      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {filteredLogs.map((log) => (
          <div key={log.id} className="rounded-xl border border-app-border bg-app-bg/50 p-3">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-app-text">
                  {log.action} {log.entityType}
                </p>
                <p className="text-[10px] font-black text-app-accent mt-1.5 uppercase tracking-wider font-jetbrains">
                  {(log.actorUsername || log.actorEmail || 'System')} {log.batchId ? `• Batch ${log.batchId}` : ''}
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

        {logs.length === 0 && !isLoading && (
          <p className="text-center text-app-text-secondary text-sm font-bold mt-4 font-inter">No activity logs yet.</p>
        )}
        {logs.length > 0 && filteredLogs.length === 0 && !isLoading && (
          <p className="text-center text-app-text-secondary text-sm font-bold mt-4 font-inter">No logs match those filters.</p>
        )}
      </div>
    </div>
  );
}
