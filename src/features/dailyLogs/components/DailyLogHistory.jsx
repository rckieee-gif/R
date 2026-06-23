import { useMemo, useState } from 'react';
import {
  calculateTargetFeedForHeads,
  getAgeDay
} from '../../../shared/utils/broilerTargets';

const FILTER_ALL = 'all';
const BEST_VARIANCE_PERCENT = 5;
const WARNING_VARIANCE_PERCENT = 15;

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

function getEmployeeKey(log) {
  return String(log.employeeId || getEmployeeName(log));
}

function getUniqueHandledBirds(rows) {
  const byEmployee = new Map();

  rows.forEach((log) => {
    const key = `${normalizeBuilding(log.building)}:${getEmployeeKey(log)}`;
    const handledBirds = Number(log.handledBirds || 0);
    const current = byEmployee.get(key) || 0;
    byEmployee.set(key, Math.max(current, handledBirds));
  });

  return [...byEmployee.values()].reduce((sum, birds) => sum + birds, 0);
}

function getVarianceTone(percent, targetBags, actualFeedBags) {
  if (targetBags === null || targetBags === undefined) return 'neutral';
  if (targetBags === 0) return actualFeedBags > 0 ? 'warning' : 'success';
  if (Math.abs(percent) <= BEST_VARIANCE_PERCENT) return 'success';
  if (Math.abs(percent) >= WARNING_VARIANCE_PERCENT) return 'danger';
  return 'warning';
}

function getVarianceStatus(percent, targetBags, actualFeedBags) {
  if (targetBags === null || targetBags === undefined) return 'Waiting for target';
  if (targetBags === 0) return actualFeedBags > 0 ? 'Above day-zero target' : 'On target';
  if (Math.abs(percent) <= BEST_VARIANCE_PERCENT) return 'Best range';
  return percent < 0 ? 'Under target' : 'Over target';
}

function getBestAction(feedVariance) {
  if (!feedVariance) return 'Choose a day with filtered log rows to calculate feed variance.';
  if (feedVariance.ageDay === null) return 'Best action: check the batch start date so the guide day can be calculated.';
  if (!feedVariance.targetHeads) return 'Best action: keep handled bird counts on each employee log before judging feed variance.';
  if (!feedVariance.targetFeed) return 'Best action: use the latest available guide day or review the feed plan manually.';
  if (feedVariance.targetFeed.targetBags === 0) {
    return feedVariance.actualFeedBags > 0
      ? 'Best action: treat day 0 feed as a startup check and confirm the chicks have settled before increasing.'
      : 'Best action: keep feed ready and start tracking intake from day 1.';
  }
  if (Math.abs(feedVariance.variancePercent) <= BEST_VARIANCE_PERCENT) {
    return 'Best action: keep the current feeding plan. The filtered sheet is inside the best range.';
  }
  if (feedVariance.varianceBags < 0) {
    return `Best action: filtered feed is short by ${formatFeed(Math.abs(feedVariance.varianceBags))} sx. Check intake, feeder space, and weighbacks before catching up.`;
  }
  return `Best action: filtered feed is ${formatFeed(feedVariance.varianceBags)} sx over target. Check wastage, feeder height, and stale feed before adding more.`;
}

export default function DailyLogHistory({
  logs,
  editingId,
  readOnly,
  canEditOrDelete,
  handleEditClick,
  handleDeleteLog,
  activeBatch
}) {
  const [buildingFilter, setBuildingFilter] = useState(FILTER_ALL);
  const [employeeFilter, setEmployeeFilter] = useState(FILTER_ALL);
  const [dateFilter, setDateFilter] = useState(FILTER_ALL);
  const [varianceDate, setVarianceDate] = useState('');
  const canManageLogs = !readOnly && canEditOrDelete;

  const filterOptions = useMemo(() => {
    const buildingOptions = [...new Set(logs.map((log) => normalizeBuilding(log.building)))].sort();
    const employeeOptions = [...logs.reduce((map, log) => {
      map.set(getEmployeeKey(log), getEmployeeName(log));
      return map;
    }, new Map()).entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
    const dateOptions = [...new Set(logs.map((log) => log.date).filter(Boolean))].sort();

    return {
      buildings: buildingOptions,
      employees: employeeOptions,
      dates: dateOptions
    };
  }, [logs]);

  const filteredRows = useMemo(() => {
    return logs.filter((log) => {
      const matchesBuilding = buildingFilter === FILTER_ALL || normalizeBuilding(log.building) === buildingFilter;
      const matchesEmployee = employeeFilter === FILTER_ALL || getEmployeeKey(log) === employeeFilter;
      const matchesDate = dateFilter === FILTER_ALL || log.date === dateFilter;
      return matchesBuilding && matchesEmployee && matchesDate;
    });
  }, [buildingFilter, dateFilter, employeeFilter, logs]);

  const overviewRows = useMemo(() => {
    return [...filteredRows].sort((left, right) => {
      const buildingSort = normalizeBuilding(left.building).localeCompare(normalizeBuilding(right.building));
      if (buildingSort !== 0) return buildingSort;

      const employeeSort = getEmployeeName(left).localeCompare(getEmployeeName(right));
      if (employeeSort !== 0) return employeeSort;

      return String(right.date || '').localeCompare(String(left.date || ''));
    });
  }, [filteredRows]);

  const varianceDateOptions = useMemo(
    () => [...new Set(filteredRows.map((log) => log.date).filter(Boolean))].sort(),
    [filteredRows]
  );

  const activeBatchStartDate = activeBatch?.startDate || '';
  const selectedVarianceDate = varianceDateOptions.includes(varianceDate)
    ? varianceDate
    : varianceDateOptions[varianceDateOptions.length - 1] || '';

  const feedVariance = useMemo(() => {
    if (!selectedVarianceDate) return null;

    const rowsToDate = filteredRows.filter((log) => log.date && log.date <= selectedVarianceDate);
    const dayRows = filteredRows.filter((log) => log.date === selectedVarianceDate);
    const actualFeedBags = rowsToDate.reduce((sum, log) => sum + Number(log.feed || 0), 0);
    const targetHeads = getUniqueHandledBirds(rowsToDate);
    const ageDay = activeBatchStartDate ? getAgeDay(activeBatchStartDate, selectedVarianceDate) : null;
    const targetFeed = calculateTargetFeedForHeads(targetHeads, ageDay);
    const targetBags = targetFeed?.targetBags ?? null;
    const varianceBags = targetBags === null ? null : actualFeedBags - targetBags;
    const variancePercent = targetBags && targetBags > 0 ? (varianceBags / targetBags) * 100 : null;
    const bestLow = targetBags === null ? null : Math.max(targetBags * (1 - BEST_VARIANCE_PERCENT / 100), 0);
    const bestHigh = targetBags === null ? null : targetBags * (1 + BEST_VARIANCE_PERCENT / 100);
    const tone = getVarianceTone(variancePercent, targetBags, actualFeedBags);

    return {
      selectedDate: selectedVarianceDate,
      ageDay,
      rowsToDate,
      dayRows,
      actualFeedBags,
      targetHeads,
      targetFeed,
      targetBags,
      varianceBags,
      variancePercent,
      bestLow,
      bestHigh,
      tone,
      status: getVarianceStatus(variancePercent, targetBags, actualFeedBags)
    };
  }, [activeBatchStartDate, filteredRows, selectedVarianceDate]);

  const buildingCount = new Set(filteredRows.map((log) => normalizeBuilding(log.building))).size;
  const totalFeed = filteredRows.reduce((sum, log) => sum + Number(log.feed || 0), 0);
  const totalMortality = filteredRows.reduce((sum, log) => sum + Number(log.mortality || 0), 0);
  const hasActiveFilters = buildingFilter !== FILTER_ALL || employeeFilter !== FILTER_ALL || dateFilter !== FILTER_ALL;
  const panelToneClass = {
    neutral: 'border-app-border bg-app-bg text-app-text-secondary',
    success: 'border-app-success/30 bg-app-success-bg text-app-success',
    warning: 'border-app-warning/30 bg-app-warning-bg text-app-warning',
    danger: 'border-app-danger/30 bg-app-danger-bg text-app-danger'
  };

  const clearFilters = () => {
    setBuildingFilter(FILTER_ALL);
    setEmployeeFilter(FILTER_ALL);
    setDateFilter(FILTER_ALL);
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                <p className="mt-0.5 text-sm font-black text-app-text font-jetbrains">{formatBirds(filteredRows.length)}</p>
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

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label htmlFor="daily-log-filter-building" className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
                Filter building
              </span>
              <select
                id="daily-log-filter-building"
                value={buildingFilter}
                onChange={(event) => setBuildingFilter(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-app-border bg-app-bg px-3 text-xs font-black text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
              >
                <option value={FILTER_ALL}>All buildings</option>
                {filterOptions.buildings.map((building) => (
                  <option key={building} value={building}>
                    Building {building}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="daily-log-filter-employee" className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
                Filter employee
              </span>
              <select
                id="daily-log-filter-employee"
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-app-border bg-app-bg px-3 text-xs font-black text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
              >
                <option value={FILTER_ALL}>All employees</option>
                {filterOptions.employees.map((employee) => (
                  <option key={employee.value} value={employee.value}>
                    {employee.label}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="daily-log-filter-date" className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
                Sheet day
              </span>
              <select
                id="daily-log-filter-date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-app-border bg-app-bg px-3 text-xs font-black text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
              >
                <option value={FILTER_ALL}>All days</option>
                {filterOptions.dates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="h-10 w-full rounded-lg border border-app-border bg-app-card px-3 text-xs font-black text-app-text-secondary transition-all hover:border-app-accent hover:text-app-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear filters
              </button>
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

        {overviewRows.length === 0 && (
          <div className="border-t border-app-border/60 px-5 py-8 text-center">
            <p className="text-sm font-black text-app-text font-hanken">
              {logs.length === 0 ? 'No daily logs recorded yet.' : 'No rows match these filters.'}
            </p>
            <p className="mt-1 text-xs font-bold text-app-text-secondary font-inter">
              {logs.length === 0
                ? 'Saved entries will appear here as one overview data sheet.'
                : 'Clear or change the filters to bring rows back into the sheet.'}
            </p>
          </div>
        )}
      </div>

      <aside className="rounded-2xl border border-app-border bg-app-card p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
            Parameter
          </p>
          <h3 className="mt-1 text-base font-black text-app-text font-hanken">
            Feed variance
          </h3>
          <p className="mt-1 text-xs font-bold leading-relaxed text-app-text-secondary font-inter">
            Uses the filtered sheet, then compares cumulative feed to the chosen guide day.
          </p>
        </div>

        <label htmlFor="daily-log-variance-day" className="mt-4 block">
          <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
            Variance day
          </span>
          <select
            id="daily-log-variance-day"
            value={selectedVarianceDate}
            onChange={(event) => setVarianceDate(event.target.value)}
            disabled={!varianceDateOptions.length}
            className="mt-1 h-10 w-full rounded-lg border border-app-border bg-app-bg px-3 text-xs font-black text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {varianceDateOptions.length === 0 && <option value="">No filtered days</option>}
            {varianceDateOptions.map((date) => {
              const ageDay = activeBatchStartDate ? getAgeDay(activeBatchStartDate, date) : null;
              return (
                <option key={date} value={date}>
                  {date}{ageDay !== null ? `, Day ${ageDay}` : ''}
                </option>
              );
            })}
          </select>
        </label>

        <div className={`mt-4 rounded-xl border p-3 ${panelToneClass[feedVariance?.tone || 'neutral']}`}>
          <p className="text-[10px] font-black uppercase tracking-wider opacity-80 font-inter">
            Status
          </p>
          <p className="mt-1 text-xl font-black font-hanken">
            {feedVariance?.status || 'No day selected'}
          </p>
          <p className="mt-1 text-xs font-bold leading-relaxed opacity-90 font-inter">
            {feedVariance
              ? `${formatBirds(feedVariance.dayRows.length)} row${feedVariance.dayRows.length === 1 ? '' : 's'} on chosen day, ${formatBirds(feedVariance.rowsToDate.length)} row${feedVariance.rowsToDate.length === 1 ? '' : 's'} to date.`
              : 'Filter the sheet or add logs to calculate variance.'}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-app-border bg-app-bg p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Actual</p>
            <p className="mt-1 text-lg font-black text-app-text font-jetbrains">
              {feedVariance ? `${formatFeed(feedVariance.actualFeedBags)} sx` : '--'}
            </p>
          </div>
          <div className="rounded-xl border border-app-border bg-app-bg p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Guide target</p>
            <p className="mt-1 text-lg font-black text-app-text font-jetbrains">
              {feedVariance?.targetBags !== null && feedVariance?.targetBags !== undefined
                ? `${formatFeed(feedVariance.targetBags)} sx`
                : '--'}
            </p>
          </div>
          <div className="rounded-xl border border-app-border bg-app-bg p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Variance</p>
            <p className="mt-1 text-lg font-black text-app-text font-jetbrains">
              {feedVariance?.varianceBags !== null && feedVariance?.varianceBags !== undefined
                ? `${feedVariance.varianceBags > 0 ? '+' : ''}${formatFeed(feedVariance.varianceBags)} sx`
                : '--'}
            </p>
          </div>
          <div className="rounded-xl border border-app-border bg-app-bg p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Percent</p>
            <p className="mt-1 text-lg font-black text-app-text font-jetbrains">
              {feedVariance?.variancePercent !== null && feedVariance?.variancePercent !== undefined
                ? `${feedVariance.variancePercent > 0 ? '+' : ''}${formatDecimal(feedVariance.variancePercent, 1)}%`
                : '--'}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-app-border bg-app-bg p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
            Best range
          </p>
          <p className="mt-1 text-sm font-black text-app-text font-jetbrains">
            {feedVariance?.bestLow !== null && feedVariance?.bestLow !== undefined
              ? `${formatFeed(feedVariance.bestLow)} to ${formatFeed(feedVariance.bestHigh)} sx`
              : '--'}
          </p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-app-text-secondary font-inter">
            Best is within {BEST_VARIANCE_PERCENT}% of target. Review urgently at {WARNING_VARIANCE_PERCENT}% or more.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-app-border bg-app-bg p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
            Best action
          </p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-app-text-secondary font-inter">
            {getBestAction(feedVariance)}
          </p>
        </div>
      </aside>
    </section>
  );
}
