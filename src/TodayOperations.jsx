import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';
import {
  BAG_WEIGHT_KG,
  calculateTargetFeedForHeads,
  getAgeDay,
  getLastBroilerTargetDay
} from './broilerTargets';

const FEED_VARIANCE_WARNING_PERCENT = 15;
const MORTALITY_WARNING_RATE = 0.005;
const MORTALITY_WARNING_HEADS = 5;
const HARVEST_SOON_DAYS = 7;

function todayInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function diffDays(left, right) {
  const leftDate = parseDateOnly(left);
  const rightDate = parseDateOnly(right);
  if (!leftDate || !rightDate) return null;
  return Math.round((leftDate - rightDate) / (24 * 60 * 60 * 1000));
}

function formatDate(value) {
  if (!value) return '--';
  return parseDateOnly(value)?.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) || '--';
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function getAssignmentBuilding(assignment) {
  return String(assignment.assignedBuilding || '').trim().toUpperCase();
}

function getBuildingKey(value) {
  return String(value || '').trim().toUpperCase();
}

function buildLogTotals(logRows) {
  return logRows.reduce((totals, log) => ({
    feed: totals.feed + Number(log.feed || 0),
    mortality: totals.mortality + Number(log.mortality || 0)
  }), { feed: 0, mortality: 0 });
}

function AttentionCard({ label, value, detail, tone = 'neutral', onClick }) {
  const toneClass = {
    danger: 'border-red-200 bg-red-50 text-semantic-danger dark:border-red-800/40 dark:bg-red-900/20',
    warning: 'border-amber-200 bg-amber-50 text-semantic-warning dark:border-amber-800/40 dark:bg-amber-900/20',
    success: 'border-green-200 bg-green-50 text-semantic-success dark:border-green-800/40 dark:bg-green-900/20',
    neutral: 'border-neutral-border bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-28 rounded-xl border p-4 text-left shadow-sm transition active:scale-[0.98] ${toneClass}`}
    >
      <p className="text-[10px] font-black uppercase tracking-wider opacity-75">{label}</p>
      <p className="text-3xl font-black mt-1">{value}</p>
      <p className="text-xs font-bold mt-2 leading-snug opacity-80">{detail}</p>
    </button>
  );
}

function WarningRow({ warning }) {
  const toneClass = warning.severity === 'danger'
    ? 'border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/20'
    : 'border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20';
  const labelClass = warning.severity === 'danger' ? 'text-semantic-danger' : 'text-semantic-warning';

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-wider ${labelClass}`}>{warning.label}</p>
          <p className="text-sm font-black text-gray-900 dark:text-white mt-1">{warning.title}</p>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-300 mt-1 leading-snug">{warning.detail}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${labelClass} bg-white/80 dark:bg-slate-900/70`}>
          {warning.severity}
        </span>
      </div>
    </div>
  );
}

export default function TodayOperations({ token, activeBatch, logs = [], setActiveScreen, previewData = null }) {
  const [loadings, setLoadings] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const today = todayInput();
  const ageDay = activeBatch?.startDate ? getAgeDay(activeBatch.startDate, today) : null;
  const lastTargetDay = getLastBroilerTargetDay();
  const daysToHarvest = diffDays(activeBatch?.targetHarvestDate, today);

  useEffect(() => {
    if (!token && previewData) {
      setLoadings(previewData.loadings || []);
      setAssignments(previewData.assignments || []);
      setFeedItems(previewData.feedItems || []);
      setError('');
      setIsLoading(false);
      return;
    }

    if (!token || !activeBatch?.id) {
      setTimeout(() => {
        setLoadings([]);
        setAssignments([]);
        setFeedItems([]);
      }, 0);
      return;
    }

    let isMounted = true;
    const headers = { Authorization: `Bearer ${token}` };

    const fetchTodayData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [loadingResponse, assignmentResponse, feedResponse] = await Promise.all([
          fetch(`${API_BASE}/api/batches/${activeBatch.id}/loadings`, { headers }),
          fetch(`${API_BASE}/api/batches/${activeBatch.id}/employee-assignments`, { headers }),
          fetch(`${API_BASE}/api/inventory/items?category=Feed`, { headers })
        ]);

        const [loadingData, assignmentData, feedData] = await Promise.all([
          loadingResponse.json(),
          assignmentResponse.json(),
          feedResponse.json()
        ]);

        if (!isMounted) return;

        if (!loadingResponse.ok || !assignmentResponse.ok || !feedResponse.ok) {
          setError(loadingData.error || assignmentData.error || feedData.error || 'Failed to load today operations.');
          return;
        }

        setLoadings(loadingData);
        setAssignments(assignmentData);
        setFeedItems(feedData);
      } catch (err) {
        console.error(err);
        if (isMounted) setError('Cannot connect to today operations.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTodayData();

    return () => {
      isMounted = false;
    };
  }, [activeBatch?.id, token, previewData]);

  const todayLogs = useMemo(
    () => logs.filter((log) => log.date === today),
    [logs, today]
  );

  const activeLoadings = useMemo(
    () => loadings.filter((loading) => Number(loading.chicksLoaded || 0) > 0),
    [loadings]
  );

  const buildingChecks = useMemo(() => activeLoadings.map((loading) => {
    const buildingKey = getBuildingKey(loading.building);
    const todaysBuildingLogs = todayLogs.filter((log) => getBuildingKey(log.building) === buildingKey);
    const buildingLogsToDate = logs.filter((log) => getBuildingKey(log.building) === buildingKey && log.date <= today);
    const assignedEmployees = assignments.filter((assignment) => (
      getAssignmentBuilding(assignment) === buildingKey && Number(assignment.handledBirds || 0) > 0
    ));
    const todaysTotals = buildLogTotals(todaysBuildingLogs);
    const toDateTotals = buildLogTotals(buildingLogsToDate);
    const feedTarget = calculateTargetFeedForHeads(loading.chicksLoaded, ageDay);
    const varianceKg = feedTarget ? (toDateTotals.feed * BAG_WEIGHT_KG) - feedTarget.targetKg : null;
    const variancePercent = feedTarget?.targetKg ? (varianceKg / feedTarget.targetKg) * 100 : null;

    return {
      building: loading.building,
      chicksLoaded: Number(loading.chicksLoaded || 0),
      assignedEmployees,
      todaysLogs: todaysBuildingLogs,
      todaysTotals,
      toDateTotals,
      feedTarget,
      varianceKg,
      variancePercent,
      hasLogToday: todaysBuildingLogs.length > 0,
      hasAssignedEmployee: assignedEmployees.length > 0
    };
  }), [activeLoadings, ageDay, assignments, logs, today, todayLogs]);

  const lowFeedItems = useMemo(
    () => feedItems.filter((item) => (
      Number(item.reorderLevel || 0) > 0 && Number(item.currentStock || 0) < Number(item.reorderLevel || 0)
    )),
    [feedItems]
  );

  const dailyFeedTarget = useMemo(
    () => calculateTargetFeedForHeads(activeBatch?.totalChicksLoaded, ageDay),
    [activeBatch?.totalChicksLoaded, ageDay]
  );

  const feedStockAfterTodayTarget = useMemo(() => {
    const totalFeedStock = feedItems.reduce((sum, item) => sum + Number(item.currentStock || 0), 0);
    if (!dailyFeedTarget) return null;
    return totalFeedStock - dailyFeedTarget.targetBags;
  }, [dailyFeedTarget, feedItems]);

  const abnormalWarnings = useMemo(() => {
    const warnings = [];

    buildingChecks.forEach((check) => {
      if (!check.hasLogToday) {
        warnings.push({
          key: `missing-log-${check.building}`,
          label: 'Missing daily log',
          severity: 'danger',
          title: `Building ${check.building} has no log today`,
          detail: 'Feed, mortality, and weight checks are incomplete for this building.'
        });
      }

      if (!check.hasAssignedEmployee) {
        warnings.push({
          key: `missing-employee-${check.building}`,
          label: 'No employee assigned',
          severity: 'danger',
          title: `Building ${check.building} has no assigned employee`,
          detail: 'Add an employee share for this building before the daily log is entered.'
        });
      }

      if (check.variancePercent !== null && Math.abs(check.variancePercent) >= FEED_VARIANCE_WARNING_PERCENT) {
        warnings.push({
          key: `feed-variance-${check.building}`,
          label: 'Feed variance',
          severity: Math.abs(check.variancePercent) >= 25 ? 'danger' : 'warning',
          title: `Building ${check.building} feed is ${check.variancePercent > 0 ? 'above' : 'below'} target`,
          detail: `${check.variancePercent > 0 ? '+' : ''}${formatNumber(check.variancePercent, 1)}% versus the day ${ageDay || '--'} target curve.`
        });
      }
    });

    todayLogs.forEach((log) => {
      const handledBirds = Number(log.handledBirds || 0);
      const mortality = Number(log.mortality || 0);
      const threshold = Math.max(MORTALITY_WARNING_HEADS, Math.ceil(handledBirds * MORTALITY_WARNING_RATE));

      if (mortality > threshold) {
        warnings.push({
          key: `mortality-${log.id}`,
          label: 'Unusual mortality',
          severity: 'danger',
          title: `${log.employeeName || `Building ${log.building}`} logged ${formatNumber(mortality)} mortality`,
          detail: `Today is above the ${formatNumber(threshold)} head warning level for this share.`
        });
      }
    });

    lowFeedItems.forEach((item) => {
      warnings.push({
        key: `feed-low-${item.id}`,
        label: 'Feed reorder',
        severity: 'warning',
        title: `${item.name} is below reorder level`,
        detail: `${formatNumber(item.currentStock, 2)} ${item.unit} on hand; reorder level is ${formatNumber(item.reorderLevel, 2)} ${item.unit}.`
      });
    });

    if (feedStockAfterTodayTarget !== null && feedStockAfterTodayTarget < 0) {
      warnings.push({
        key: 'feed-negative-target',
        label: 'Feed stock risk',
        severity: 'danger',
        title: 'Feed stock will go negative against today target',
        detail: `Current feed stock is short by ${formatNumber(Math.abs(feedStockAfterTodayTarget), 2)} sacks if the batch follows today's target.`
      });
    }

    if (daysToHarvest !== null && daysToHarvest < 0) {
      warnings.push({
        key: 'harvest-overdue',
        label: 'Harvest date',
        severity: 'danger',
        title: 'Target harvest date has passed',
        detail: `Target harvest was ${formatDate(activeBatch?.targetHarvestDate)}.`
      });
    } else if (daysToHarvest !== null && daysToHarvest <= HARVEST_SOON_DAYS) {
      warnings.push({
        key: 'harvest-soon',
        label: 'Harvest date',
        severity: 'warning',
        title: `Harvest is due in ${daysToHarvest} day${daysToHarvest === 1 ? '' : 's'}`,
        detail: `Target harvest date is ${formatDate(activeBatch?.targetHarvestDate)}.`
      });
    }

    if (ageDay && ageDay > lastTargetDay) {
      warnings.push({
        key: 'age-over-target',
        label: 'Batch age',
        severity: 'warning',
        title: `Active batch is beyond day ${lastTargetDay}`,
        detail: 'The standard feed curve has ended, so feed targets need manual review.'
      });
    }

    return warnings;
  }, [activeBatch?.targetHarvestDate, ageDay, buildingChecks, daysToHarvest, feedStockAfterTodayTarget, lastTargetDay, lowFeedItems, todayLogs]);

  const missingLogCount = buildingChecks.filter((check) => !check.hasLogToday).length;
  const noEmployeeCount = buildingChecks.filter((check) => !check.hasAssignedEmployee).length;
  const dangerCount = abnormalWarnings.filter((warning) => warning.severity === 'danger').length;
  const todayTotals = buildLogTotals(todayLogs);

  if (!activeBatch) {
    return (
      <div className="app-page">
        <div className="mb-5 mt-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Operations</p>
          <h2 className="text-3xl font-extrabold text-primary tracking-tight mt-1">Today</h2>
        </div>

        <div className="rounded-2xl border border-neutral-border bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-lg font-black text-gray-900 dark:text-white">No active batch selected</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Select an active batch before today&apos;s operations can be checked.
          </p>
          <button
            type="button"
            onClick={() => setActiveScreen('batches')}
            className="mt-4 w-full rounded-xl bg-primary p-3 font-bold text-white shadow-sm active:scale-95"
          >
            Open Batches
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="mb-5 mt-2">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Operations</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold text-primary tracking-tight">Today</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Batch {activeBatch.id} - {formatDate(today)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-72">
            <div className="rounded-xl border border-neutral-border bg-white px-3 py-2 text-right shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Age</p>
              <p className={`text-xl font-black ${ageDay > lastTargetDay ? 'text-semantic-warning' : 'text-secondary'}`}>
                D{ageDay || '--'}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-border bg-white px-3 py-2 text-right shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Harvest</p>
              <p className={`text-xl font-black ${daysToHarvest !== null && daysToHarvest <= HARVEST_SOON_DAYS ? 'text-semantic-warning' : 'text-gray-900 dark:text-white'}`}>
                {daysToHarvest === null ? '--' : daysToHarvest < 0 ? `${Math.abs(daysToHarvest)}d late` : `${daysToHarvest}d`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <AttentionCard
          label="Buildings without log"
          value={missingLogCount}
          detail={missingLogCount ? 'Open daily logs and complete these buildings.' : 'Every loaded building has a log today.'}
          tone={missingLogCount ? 'danger' : 'success'}
          onClick={() => setActiveScreen('dailyLog')}
        />
        <AttentionCard
          label="Feed below reorder"
          value={lowFeedItems.length}
          detail={lowFeedItems.length ? 'Review feed purchases or stock transfers.' : 'Feed items are above reorder level.'}
          tone={lowFeedItems.length ? 'warning' : 'success'}
          onClick={() => setActiveScreen('inventory')}
        />
        <AttentionCard
          label="Abnormal warnings"
          value={abnormalWarnings.length}
          detail={dangerCount ? `${dangerCount} need urgent review.` : 'No urgent abnormal value detected.'}
          tone={dangerCount ? 'danger' : abnormalWarnings.length ? 'warning' : 'success'}
          onClick={() => setActiveScreen('dailyLog')}
        />
        <AttentionCard
          label="Unassigned buildings"
          value={noEmployeeCount}
          detail={noEmployeeCount ? 'Assign employee shares before logging.' : 'Loaded buildings have employees assigned.'}
          tone={noEmployeeCount ? 'danger' : 'success'}
          onClick={() => setActiveScreen('employees')}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-secondary">Building Checklist</h3>
            <span className="text-[10px] font-bold text-gray-400">
              {isLoading ? 'Loading...' : `${todayLogs.length} log${todayLogs.length === 1 ? '' : 's'} today`}
            </span>
          </div>

          <div className="space-y-3">
            {buildingChecks.map((check) => {
              const varianceIsHigh = check.variancePercent !== null && Math.abs(check.variancePercent) >= FEED_VARIANCE_WARNING_PERCENT;
              return (
                <div
                  key={check.building}
                  className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-800 ${
                    !check.hasLogToday || !check.hasAssignedEmployee
                      ? 'border-red-200 dark:border-red-800/40'
                      : varianceIsHigh
                        ? 'border-amber-200 dark:border-amber-800/40'
                        : 'border-neutral-border dark:border-gray-700'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-black ${
                          check.hasLogToday ? 'bg-green-100 text-semantic-success dark:bg-green-900/30' : 'bg-red-100 text-semantic-danger dark:bg-red-900/30'
                        }`}>
                          {check.building}
                        </span>
                        <div className="min-w-0">
                          <p className="font-black text-gray-900 dark:text-white">Building {check.building}</p>
                          <p className="text-xs font-bold text-gray-400">
                            {formatNumber(check.chicksLoaded)} loaded - {check.assignedEmployees.length} employee{check.assignedEmployees.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-right">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400">Feed Today</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{formatNumber(check.todaysTotals.feed, 2)} sx</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400">Mortality</p>
                        <p className={`text-sm font-black ${check.todaysTotals.mortality > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
                          {formatNumber(check.todaysTotals.mortality)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-400">Variance</p>
                        <p className={`text-sm font-black ${varianceIsHigh ? 'text-semantic-warning' : 'text-gray-900 dark:text-white'}`}>
                          {check.variancePercent === null ? '--' : `${check.variancePercent > 0 ? '+' : ''}${formatNumber(check.variancePercent, 1)}%`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                    <span className={`rounded-full px-2 py-1 ${check.hasLogToday ? 'bg-green-100 text-semantic-success dark:bg-green-900/30' : 'bg-red-100 text-semantic-danger dark:bg-red-900/30'}`}>
                      {check.hasLogToday ? 'Logged today' : 'Needs log'}
                    </span>
                    <span className={`rounded-full px-2 py-1 ${check.hasAssignedEmployee ? 'bg-green-100 text-semantic-success dark:bg-green-900/30' : 'bg-red-100 text-semantic-danger dark:bg-red-900/30'}`}>
                      {check.hasAssignedEmployee ? 'Employee assigned' : 'No employee'}
                    </span>
                    {check.feedTarget && (
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-primary dark:bg-blue-900/20 dark:text-primary-light">
                        Target {formatNumber(check.feedTarget.targetBags, 2)} sx
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {!buildingChecks.length && (
              <div className="rounded-xl border border-neutral-border bg-white p-4 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm font-bold text-gray-500">No building loadings found for this batch.</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-primary dark:text-primary-light">Warnings</h3>
            <span className="text-[10px] font-bold text-gray-400">
              {dangerCount} urgent
            </span>
          </div>

          <div className="space-y-3">
            {abnormalWarnings.map((warning) => (
              <WarningRow key={warning.key} warning={warning} />
            ))}

            {!abnormalWarnings.length && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-sm dark:border-green-800/40 dark:bg-green-900/20">
                <p className="text-sm font-black text-semantic-success">No abnormal values today</p>
                <p className="mt-1 text-xs font-bold text-green-700 dark:text-green-200">
                  Logs, feed stock, employee assignment, age, and harvest checks look clear.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-neutral-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Today totals</p>
                <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">
                  {formatNumber(todayTotals.feed, 2)} sx feed
                </p>
                <p className={`text-sm font-black ${todayTotals.mortality > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
                  {formatNumber(todayTotals.mortality)} mortality
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveScreen('dailyLog')}
                className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-white shadow-sm active:scale-95"
              >
                Open Logs
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-neutral-light p-3 dark:bg-gray-900">
                <p className="font-bold uppercase text-gray-400">Feed stock after target</p>
                <p className={`mt-1 font-black ${feedStockAfterTodayTarget !== null && feedStockAfterTodayTarget < 0 ? 'text-semantic-danger' : 'text-gray-900 dark:text-white'}`}>
                  {feedStockAfterTodayTarget === null ? '--' : `${formatNumber(feedStockAfterTodayTarget, 2)} sx`}
                </p>
              </div>
              <div className="rounded-lg bg-neutral-light p-3 dark:bg-gray-900">
                <p className="font-bold uppercase text-gray-400">Harvest target</p>
                <p className="mt-1 font-black text-gray-900 dark:text-white">{formatDate(activeBatch.targetHarvestDate)}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
