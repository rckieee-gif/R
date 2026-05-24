function formatBirds(value) {
  return Number(value || 0).toLocaleString();
}

function formatFeed(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

function formatDecimal(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export default function DailyLogHistory({
  logs,
  editingId,
  readOnly,
  canEditOrDelete,
  handleEditClick,
  handleDeleteLog
}) {
  return (
    <div>
      <h3 className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider mb-3 ml-1">
        Recent Logs
      </h3>
      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`bg-app-card p-4 rounded-xl border flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-sm ${editingId === log.id ? 'border-app-accent bg-app-accent/5' : 'border-app-border'}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="bg-app-accent/10 border border-app-accent/20 text-app-accent w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm shrink-0 font-jetbrains">
                  {log.building}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-app-text-secondary font-black uppercase tracking-wide font-jetbrains">{log.date}</p>
                  <p className="text-sm font-black text-app-text truncate">
                    {log.employeeName || 'Unassigned Employee'}
                  </p>
                  <p className="text-xs font-bold text-app-text-secondary mt-0.5 font-jetbrains">
                    {formatBirds(log.handledBirds)} birds &bull; Feed {formatFeed(log.feed)} sx
                  </p>
                  {log.feedItemName && (
                    <p className="text-[10px] font-black text-app-text-secondary/70 mt-0.5 font-jetbrains">
                      {log.feedItemName}
                    </p>
                  )}
                  {log.averageWeightGrams != null && (
                    <p className="text-[10px] font-black text-app-accent mt-0.5 font-jetbrains">
                      Avg Weight {formatDecimal(log.averageWeightGrams, 0)}g
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className="text-[9px] text-app-text-secondary font-black uppercase tracking-wide">Mortality</p>
                <p className={`text-xl font-black font-jetbrains ${log.mortality > 0 ? 'text-app-danger' : 'text-app-success'}`}>
                  {formatBirds(log.mortality)} <span className="text-xs font-normal">hd</span>
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-app-border/40 pl-1">
              <p className="text-xs text-app-text-secondary italic flex-1 truncate pr-2">
                {log.remarks ? `"${log.remarks}"` : 'No remarks'}
              </p>

              {!readOnly && canEditOrDelete && (
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => handleEditClick(log)}
                    className="text-xs font-black uppercase tracking-wider text-app-text-secondary hover:text-app-accent transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLog(log.id)}
                    className="text-xs font-black uppercase tracking-wider text-app-text-secondary hover:text-app-danger transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <p className="text-center text-app-text-secondary text-sm mt-4 font-bold">No daily logs recorded yet.</p>
        )}
      </div>
    </div>
  );
}
