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

function normalizeBuilding(building) {
  return String(building || 'Unassigned').toUpperCase();
}

function getEmployeeName(log) {
  return log.employeeName || 'Unassigned Employee';
}

export default function DailyLogHistory({
  logs,
  editingId,
  readOnly,
  canEditOrDelete,
  handleEditClick,
  handleDeleteLog
}) {
  const canManageLogs = !readOnly && canEditOrDelete;
  const overviewRows = [...logs].sort((left, right) => {
    const buildingSort = normalizeBuilding(left.building).localeCompare(normalizeBuilding(right.building));
    if (buildingSort !== 0) return buildingSort;

    const employeeSort = getEmployeeName(left).localeCompare(getEmployeeName(right));
    if (employeeSort !== 0) return employeeSort;

    return String(right.date || '').localeCompare(String(left.date || ''));
  });
  const buildingCount = new Set(logs.map((log) => normalizeBuilding(log.building))).size;
  const employeeCount = new Set(logs.map((log) => String(log.employeeId || getEmployeeName(log)))).size;
  const totalFeed = logs.reduce((sum, log) => sum + Number(log.feed || 0), 0);
  const totalMortality = logs.reduce((sum, log) => sum + Number(log.mortality || 0), 0);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-2xl border border-app-border bg-app-card shadow-sm overflow-hidden">
        <div className="border-b border-app-border/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
                Overview data
              </p>
              <h3 className="mt-1 text-lg font-black text-app-text font-hanken">
                Daily log data sheet
              </h3>
              <p className="mt-1 text-xs font-bold text-app-text-secondary font-inter">
                One sheet grouped by building and employee, with each daily log as a row.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
              <div className="rounded-xl border border-app-border bg-app-bg px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Rows</p>
                <p className="mt-0.5 text-sm font-black text-app-text font-jetbrains">{formatBirds(logs.length)}</p>
              </div>
              <div className="rounded-xl border border-app-border bg-app-bg px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Buildings</p>
                <p className="mt-0.5 text-sm font-black text-app-text font-jetbrains">{formatBirds(buildingCount)}</p>
              </div>
              <div className="rounded-xl border border-app-border bg-app-bg px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Feed</p>
                <p className="mt-0.5 text-sm font-black text-app-text font-jetbrains">{formatFeed(totalFeed)} sx</p>
              </div>
              <div className="rounded-xl border border-app-border bg-app-bg px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Mortality</p>
                <p className="mt-0.5 text-sm font-black text-app-text font-jetbrains">{formatBirds(totalMortality)} hd</p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm" aria-label="Daily log overview data sheet">
            <thead className="bg-app-bg/70 text-[10px] uppercase tracking-wider text-app-text-secondary font-inter">
              <tr>
                <th className="px-4 py-3 font-black">Building</th>
                <th className="px-4 py-3 font-black">Employee</th>
                <th className="px-4 py-3 font-black">Date</th>
                <th className="px-4 py-3 font-black text-right">Birds</th>
                <th className="px-4 py-3 font-black text-right">Feed</th>
                <th className="px-4 py-3 font-black text-right">Mortality</th>
                <th className="px-4 py-3 font-black text-right">Avg wt</th>
                <th className="px-4 py-3 font-black">Feed item</th>
                <th className="px-4 py-3 font-black">Remarks</th>
                {canManageLogs && <th className="px-4 py-3 font-black text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/60">
              {overviewRows.map((log) => {
                const logThreshold = Math.max(5, Math.ceil(Number(log.handledBirds || 0) * 0.005));
                const mortalityVal = Number(log.mortality || 0);
                const mortalityColor = mortalityVal <= logThreshold ? 'text-app-success' :
                  mortalityVal <= logThreshold * 2 ? 'text-app-warning' : 'text-app-danger';

                return (
                  <tr
                    key={log.id}
                    className={`transition-colors hover:bg-app-accent/[0.03] ${
                      editingId === log.id ? 'bg-app-accent/5' : 'bg-app-card'
                    }`}
                  >
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex min-w-10 items-center justify-center rounded-lg border border-app-accent/20 bg-app-accent/10 px-2 py-1 text-xs font-black text-app-accent font-jetbrains">
                        Building {normalizeBuilding(log.building)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-black text-app-text font-hanken">{getEmployeeName(log)}</p>
                      <p className="mt-0.5 text-[10px] font-bold text-app-text-secondary font-jetbrains">
                        ID {log.employeeId || '--'}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-black text-app-text-secondary font-jetbrains">
                      {log.date || '--'}
                    </td>
                    <td className="px-4 py-3 align-top text-right font-black text-app-text font-jetbrains">
                      {formatBirds(log.handledBirds)}
                    </td>
                    <td className="px-4 py-3 align-top text-right font-black text-app-text font-jetbrains">
                      {formatFeed(log.feed)} sx
                    </td>
                    <td className={`px-4 py-3 align-top text-right font-black font-jetbrains ${mortalityColor}`}>
                      {formatBirds(log.mortality)} hd
                    </td>
                    <td className="px-4 py-3 align-top text-right font-black text-app-text font-jetbrains">
                      {log.averageWeightGrams != null ? `${formatDecimal(log.averageWeightGrams, 0)}g` : '--'}
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-bold text-app-text-secondary">
                      {log.feedItemName || '--'}
                    </td>
                    <td className="px-4 py-3 align-top text-xs font-bold text-app-text-secondary">
                      <span className="line-clamp-2">{log.remarks || 'No remarks'}</span>
                    </td>
                    {canManageLogs && (
                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex justify-end gap-3">
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
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && (
          <div className="border-t border-app-border/60 px-5 py-8 text-center">
            <p className="text-sm font-black text-app-text font-hanken">No daily logs recorded yet.</p>
            <p className="mt-1 text-xs font-bold text-app-text-secondary font-inter">
              Saved entries will appear here as one overview data sheet.
            </p>
          </div>
        )}
      </div>

      <aside className="rounded-2xl border border-dashed border-app-border bg-app-card p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
              Side panel
            </p>
            <h3 className="mt-1 text-base font-black text-app-text font-hanken">
              Event log
            </h3>
          </div>
          <span className="rounded-full border border-app-border bg-app-bg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
            Placeholder
          </span>
        </div>

        <p className="mt-3 text-xs font-bold leading-relaxed text-app-text-secondary font-inter">
          Timeline-style events can live here later. For now, daily log records stay in the overview data sheet.
        </p>

        <div className="mt-4 rounded-xl border border-app-border bg-app-bg p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
            Current sheet
          </p>
          <p className="mt-1 text-sm font-black text-app-text font-jetbrains">
            {formatBirds(logs.length)} row{logs.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs font-bold text-app-text-secondary font-inter">
            {formatBirds(employeeCount)} employee{employeeCount === 1 ? '' : 's'} across {formatBirds(buildingCount)} building{buildingCount === 1 ? '' : 's'}.
          </p>
        </div>
      </aside>
    </section>
  );
}
