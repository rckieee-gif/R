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
      <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">
        Recent Logs
      </h3>
      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border flex flex-col relative overflow-hidden transition-colors ${editingId === log.id ? 'border-secondary bg-yellow-50/30 dark:bg-yellow-900/10' : 'border-neutral-border dark:border-gray-700'}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-4 min-w-0">
                <div className="bg-secondary/20 border border-secondary/30 text-secondary w-12 h-12 rounded-full flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                  {log.building}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">{log.date}</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                    {log.employeeName || 'Unassigned employee'}
                  </p>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatBirds(log.handledBirds)} birds - Feed {formatFeed(log.feed)} sx
                  </p>
                  {log.feedItemName && (
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                      {log.feedItemName}
                    </p>
                  )}
                  {log.averageWeightGrams != null && (
                    <p className="text-[10px] font-bold text-primary mt-0.5">
                      Avg weight {formatDecimal(log.averageWeightGrams, 0)}g
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">Mortality</p>
                <p className={`text-xl font-black ${log.mortality > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
                  {formatBirds(log.mortality)} <span className="text-sm font-normal">hd</span>
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 pl-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 italic flex-1 truncate pr-2">
                {log.remarks ? `"${log.remarks}"` : 'No remarks'}
              </p>

              {!readOnly && canEditOrDelete && (
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => handleEditClick(log)}
                    className="text-xs font-bold text-gray-400 hover:text-secondary transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLog(log.id)}
                    className="text-xs font-bold text-gray-400 hover:text-semantic-danger transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <p className="text-center text-gray-500 text-sm mt-4">No daily logs recorded yet.</p>
        )}
      </div>
    </div>
  );
}
