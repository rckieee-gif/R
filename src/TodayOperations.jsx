import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';
import {
  BAG_WEIGHT_KG,
  calculateActualFcr,
  calculateTargetFeedForHeads,
  getAgeDay,
  getLastBroilerTargetDay
} from './broilerTargets';

const FEED_VARIANCE_WARNING_PERCENT = 15;
const MORTALITY_WARNING_RATE = 0.005;
const MORTALITY_WARNING_HEADS = 5;
const HARVEST_SOON_DAYS = 7;
const EMPTY_TODAY_DATA = {
  loadings: [],
  assignments: [],
  feedItems: [],
  harvestProductionSummary: null
};

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

function getBatchStatus(batch) {
  return String(batch?.status || '').trim().toUpperCase();
}

function isPostBatch(batch) {
  const status = getBatchStatus(batch);
  return Boolean(batch?.actualHarvestEndDate) || ['HARVESTED', 'CLOSED', 'POSTED'].includes(status);
}

function getLatestLogDate(logRows) {
  return logRows.reduce((latest, log) => {
    if (!log.date) return latest;
    if (!latest || String(log.date) > String(latest)) return log.date;
    return latest;
  }, '');
}

function getLatestWeightLog(logRows) {
  return [...logRows]
    .filter((log) => Number(log.averageWeightGrams || 0) > 0)
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))[0] || null;
}

function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return `${formatNumber(value, digits)}%`;
}

function AttentionCard({ label, value, detail, tone = 'neutral', onClick }) {
  const toneClass = {
    danger: 'border-app-danger/30 bg-app-danger-bg text-app-danger hover:border-app-danger',
    warning: 'border-app-warning/30 bg-app-warning-bg text-app-warning hover:border-app-warning',
    success: 'border-app-success/30 bg-app-success-bg text-app-success hover:border-app-success',
    neutral: 'border-app-border bg-app-card text-app-text hover:border-app-accent'
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-28 rounded-xl border p-4 text-left shadow-sm transition-all duration-200 active:scale-[0.98] ${toneClass}`}
    >
      <p className="text-[10px] font-black uppercase tracking-wider opacity-85 font-jetbrains">{label}</p>
      <p className="text-3xl font-black mt-1 font-hanken">{value}</p>
      <p className="text-xs font-bold mt-2 leading-snug opacity-90 font-inter">{detail}</p>
    </button>
  );
}

function WarningRow({ warning }) {
  const toneClass = warning.severity === 'danger'
    ? 'border-app-danger/30 bg-app-danger-bg'
    : 'border-app-warning/30 bg-app-warning-bg';
  const labelClass = warning.severity === 'danger' ? 'text-app-danger' : 'text-app-warning';

  return (
    <div className={`rounded-xl border p-3 transition-colors ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-wider font-jetbrains ${labelClass}`}>{warning.label}</p>
          <p className="text-sm font-black text-app-text mt-1 font-hanken">{warning.title}</p>
          <p className="text-xs font-bold text-app-text-secondary mt-1 leading-snug font-inter">{warning.detail}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase font-jetbrains ${labelClass} bg-app-card/85 border border-app-border`}>
          {warning.severity}
        </span>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, detail, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'border-app-border bg-app-card text-app-text',
    success: 'border-app-success/30 bg-app-success-bg text-app-success',
    warning: 'border-app-warning/30 bg-app-warning-bg text-app-warning',
    danger: 'border-app-danger/30 bg-app-danger-bg text-app-danger'
  }[tone];

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-colors ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-wider opacity-85 font-jetbrains">{label}</p>
      <p className="mt-1 text-2xl font-black font-jetbrains">{value}</p>
      <p className="mt-2 text-xs font-bold leading-snug opacity-90 font-inter">{detail}</p>
    </div>
  );
}

export default function TodayOperations({ token, activeBatch, logs = [], setActiveScreen, previewData = null }) {
  const activeBatchId = activeBatch?.id ?? null;
  const previewKey = previewData ? `preview:${previewData.batch?.id || activeBatchId || 'current'}` : null;
  const todayDataKey = token && activeBatchId ? `batch:${activeBatchId}` : previewKey;
  const [todayRequest, setTodayRequest] = useState({
    key: null,
    data: EMPTY_TODAY_DATA,
    error: '',
    isLoading: false
  });
  const previewTodayData = previewData ? {
    loadings: previewData.loadings || [],
    assignments: previewData.assignments || [],
    feedItems: previewData.feedItems || [],
    harvestProductionSummary: previewData.harvestProductionSummary || null
  } : null;
  const isCurrentTodayData = Boolean(todayDataKey) && todayRequest.key === todayDataKey;
  const todayData = !token && previewTodayData
    ? previewTodayData
    : (isCurrentTodayData ? todayRequest.data : EMPTY_TODAY_DATA);
  const { loadings, assignments, feedItems, harvestProductionSummary } = todayData;
  const error = !token && previewTodayData ? '' : (isCurrentTodayData ? todayRequest.error : '');
  const isLoading = Boolean(token && isCurrentTodayData && todayRequest.isLoading);
  const today = todayInput();
  const ageDay = activeBatch?.startDate ? getAgeDay(activeBatch.startDate, today) : null;
  const lastTargetDay = getLastBroilerTargetDay();
  const daysToHarvest = diffDays(activeBatch?.targetHarvestDate, today);

  useEffect(() => {
    if (!todayDataKey) {
      return;
    }

    if (!token || !activeBatchId) {
      return;
    }

    let isMounted = true;
    const headers = { Authorization: `Bearer ${token}` };
    const requestKey = todayDataKey;
    const requestBatchId = activeBatchId;

    const fetchTodayData = async () => {
      setTodayRequest((current) => ({
        key: requestKey,
        data: current.key === requestKey ? current.data : EMPTY_TODAY_DATA,
        error: '',
        isLoading: true
      }));

      try {
        const [loadingResponse, assignmentResponse, feedResponse, harvestResponse] = await Promise.all([
          fetch(`${API_BASE}/api/batches/${requestBatchId}/loadings`, { headers }),
          fetch(`${API_BASE}/api/batches/${requestBatchId}/employee-assignments`, { headers }),
          fetch(`${API_BASE}/api/inventory/items?category=Feed`, { headers }),
          fetch(`${API_BASE}/api/batches/${requestBatchId}/harvest-production-summary`, { headers })
        ]);

        const [loadingData, assignmentData, feedData, harvestData] = await Promise.all([
          loadingResponse.json(),
          assignmentResponse.json(),
          feedResponse.json(),
          harvestResponse.json().catch(() => null)
        ]);

        if (!isMounted) return;

        if (!loadingResponse.ok || !assignmentResponse.ok || !feedResponse.ok) {
          setTodayRequest({
            key: requestKey,
            data: EMPTY_TODAY_DATA,
            error: loadingData.error || assignmentData.error || feedData.error || 'Failed to load today operations.',
            isLoading: false
          });
          return;
        }

        setTodayRequest({
          key: requestKey,
          data: {
            loadings: loadingData,
            assignments: assignmentData,
            feedItems: feedData,
            harvestProductionSummary: harvestResponse.ok ? harvestData : null
          },
          error: '',
          isLoading: false
        });
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setTodayRequest({
            key: requestKey,
            data: EMPTY_TODAY_DATA,
            error: 'Cannot connect to today operations.',
            isLoading: false
          });
        }
      }
    };

    fetchTodayData();

    return () => {
      isMounted = false;
    };
  }, [activeBatchId, token, todayDataKey]);

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
  const isPostSummaryMode = isPostBatch(activeBatch);

  const postSummary = useMemo(() => {
    if (!activeBatch) return null;

    const latestLogDate = getLatestLogDate(logs);
    const summaryDate = activeBatch.actualHarvestEndDate || latestLogDate || today;
    const summaryAgeDay = activeBatch.startDate ? getAgeDay(activeBatch.startDate, summaryDate) : null;
    const targetDay = summaryAgeDay ? Math.min(summaryAgeDay, lastTargetDay) : null;
    const batchTotals = buildLogTotals(logs);
    const loadedFromLoadings = activeLoadings.reduce((sum, loading) => sum + Number(loading.chicksLoaded || 0), 0);
    const loadedBirds = Number(activeBatch.totalChicksLoaded || 0) || loadedFromLoadings;
    const estimatedLiveBirds = loadedBirds > 0 ? Math.max(loadedBirds - batchTotals.mortality, 0) : 0;
    const mortalityRate = loadedBirds > 0 ? (batchTotals.mortality / loadedBirds) * 100 : null;
    const survivalRate = loadedBirds > 0 ? (estimatedLiveBirds / loadedBirds) * 100 : null;
    const totalFeedKg = batchTotals.feed * BAG_WEIGHT_KG;
    const latestBatchWeightLog = getLatestWeightLog(logs);
    const latestWeightLogsByBuilding = new Map();
    const harvestTotals = harvestProductionSummary?.totals || {};
    const harvestSoldBirds = harvestProductionSummary?.hasActualSales ? Number(harvestTotals.birds || 0) : null;
    const harvestKilos = harvestProductionSummary?.hasActualSales ? Number(harvestTotals.kilos || 0) : null;
    const harvestAverageWeightKg = harvestSoldBirds && harvestKilos
      ? harvestKilos / harvestSoldBirds
      : Number(harvestTotals.averageWeightKg || 0) || null;
    const harvestYieldRate = loadedBirds > 0 && harvestSoldBirds !== null
      ? (harvestSoldBirds / loadedBirds) * 100
      : null;
    const harvestFcr = harvestKilos && harvestKilos > 0 ? totalFeedKg / harvestKilos : null;
    const estimatedVsSoldGap = harvestSoldBirds !== null ? estimatedLiveBirds - harvestSoldBirds : null;

    [...logs]
      .filter((log) => Number(log.averageWeightGrams || 0) > 0)
      .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
      .forEach((log) => {
        const buildingKey = getBuildingKey(log.building);
        if (buildingKey && !latestWeightLogsByBuilding.has(buildingKey)) {
          latestWeightLogsByBuilding.set(buildingKey, log);
        }
      });

    const buildingSummaries = activeLoadings.map((loading) => {
      const buildingKey = getBuildingKey(loading.building);
      const buildingLogs = logs.filter((log) => getBuildingKey(log.building) === buildingKey);
      const buildingTotals = buildLogTotals(buildingLogs);
      const buildingLoaded = Number(loading.chicksLoaded || 0);
      const buildingLiveBirds = Math.max(buildingLoaded - buildingTotals.mortality, 0);
      const latestWeightLog = latestWeightLogsByBuilding.get(buildingKey) || getLatestWeightLog(buildingLogs);
      const averageWeightGrams = Number(latestWeightLog?.averageWeightGrams || 0) || null;
      const feedKg = buildingTotals.feed * BAG_WEIGHT_KG;
      const fcr = calculateActualFcr(feedKg, buildingLiveBirds, averageWeightGrams);
      const assignedEmployees = assignments.filter((assignment) => (
        getAssignmentBuilding(assignment) === buildingKey && Number(assignment.handledBirds || 0) > 0
      ));

      return {
        building: loading.building,
        loadedBirds: buildingLoaded,
        estimatedLiveBirds: buildingLiveBirds,
        mortality: buildingTotals.mortality,
        mortalityRate: buildingLoaded > 0 ? (buildingTotals.mortality / buildingLoaded) * 100 : null,
        feedBags: buildingTotals.feed,
        feedKg,
        averageWeightGrams,
        latestLogDate: getLatestLogDate(buildingLogs),
        latestWeightDate: latestWeightLog?.date || '',
        fcr,
        employeeCount: assignedEmployees.length
      };
    });

    const weightedWeightSources = buildingSummaries.filter((summary) => (
      summary.averageWeightGrams && summary.estimatedLiveBirds > 0
    ));
    const weightedLiveBirds = weightedWeightSources.reduce((sum, summary) => sum + summary.estimatedLiveBirds, 0);
    const averageWeightGrams = weightedLiveBirds > 0
      ? weightedWeightSources.reduce((sum, summary) => (
        sum + (summary.averageWeightGrams * summary.estimatedLiveBirds)
      ), 0) / weightedLiveBirds
      : Number(latestBatchWeightLog?.averageWeightGrams || 0) || null;
    const actualFcr = calculateActualFcr(totalFeedKg, estimatedLiveBirds, averageWeightGrams);
    const targetFeed = targetDay ? calculateTargetFeedForHeads(loadedBirds, targetDay) : null;

    return {
      status: getBatchStatus(activeBatch),
      summaryDate,
      summaryAgeDay,
      latestLogDate,
      loadedBirds,
      estimatedLiveBirds,
      mortality: batchTotals.mortality,
      mortalityRate,
      survivalRate,
      totalFeedBags: batchTotals.feed,
      totalFeedKg,
      averageWeightGrams,
      latestWeightDate: latestBatchWeightLog?.date || '',
      actualFcr,
      targetFcr: targetFeed?.fcr ?? null,
      harvest: {
        ...harvestProductionSummary,
        hasReport: Boolean(harvestProductionSummary?.hasReport),
        hasActualSales: Boolean(harvestProductionSummary?.hasActualSales),
        soldBirds: harvestSoldBirds,
        kilos: harvestKilos,
        averageWeightKg: harvestAverageWeightKg,
        yieldRate: harvestYieldRate,
        fcr: harvestFcr,
        estimatedVsSoldGap,
        perHarvest: harvestProductionSummary?.perHarvest || []
      },
      buildingSummaries
    };
  }, [activeBatch, activeLoadings, assignments, harvestProductionSummary, lastTargetDay, logs, today]);

  const postChecklist = useMemo(() => {
    if (!postSummary) return [];

    return [
      {
        key: 'harvest-status',
        label: 'Harvest status',
        value: activeBatch?.actualHarvestEndDate ? 'Dated' : postSummary.status || 'Closed',
        detail: activeBatch?.actualHarvestEndDate
          ? `Harvested ${formatDate(activeBatch.actualHarvestEndDate)}`
          : `Status ${postSummary.status || '--'}`,
        tone: 'success'
      },
      {
        key: 'daily-logs',
        label: 'Daily logs',
        value: logs.length ? `${formatNumber(logs.length)} row${logs.length === 1 ? '' : 's'}` : 'No logs',
        detail: postSummary.latestLogDate ? `Last log ${formatDate(postSummary.latestLogDate)}` : 'No production logs found',
        tone: logs.length ? 'success' : 'warning',
        actionScreen: logs.length ? null : 'dailyLog'
      },
      {
        key: 'building-loadings',
        label: 'Buildings',
        value: activeLoadings.length ? `${activeLoadings.length} loaded` : 'None',
        detail: `${formatNumber(postSummary.loadedBirds)} birds loaded`,
        tone: activeLoadings.length ? 'success' : 'warning'
      },
      {
        key: 'harvest-report',
        label: 'Harvest report',
        value: postSummary.harvest.hasActualSales ? 'Actuals loaded' : postSummary.harvest.hasReport ? 'No totals' : 'Missing',
        detail: postSummary.harvest.hasActualSales
          ? `${formatNumber(postSummary.harvest.soldBirds)} birds / ${formatNumber(postSummary.harvest.kilos, 1)} kg`
          : 'No sold birds or kilos recorded',
        tone: postSummary.harvest.hasActualSales ? 'success' : 'warning',
        actionScreen: postSummary.harvest.hasActualSales ? null : 'harvest'
      },
      {
        key: 'feed-inventory',
        label: 'Feed inventory',
        value: lowFeedItems.length ? `${lowFeedItems.length} low` : 'Clear',
        detail: lowFeedItems.length ? 'Feed stock has items below reorder level' : 'Feed items are above reorder level',
        tone: lowFeedItems.length ? 'warning' : 'success',
        actionScreen: lowFeedItems.length ? 'inventory' : null
      }
    ];
  }, [activeBatch, activeLoadings.length, logs.length, lowFeedItems.length, postSummary]);

  if (!activeBatch) {
    return (
      <div className="app-page text-app-text">
        <div className="mb-5 mt-2">
          <p className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-jetbrains">Operations</p>
          <h2 className="text-3xl font-extrabold text-app-accent tracking-tight mt-1 font-hanken">Today</h2>
        </div>

        <div className="rounded-2xl border border-app-border bg-app-card p-5 shadow-sm">
          <p className="text-lg font-black font-hanken">No active batch selected</p>
          <p className="text-sm text-app-text-secondary mt-2 font-inter">
            Select an active batch before today&apos;s operations can be checked.
          </p>
          <button
            type="button"
            onClick={() => setActiveScreen('batches')}
            className="mt-4 w-full rounded-xl bg-app-accent p-3 font-bold text-app-on-accent shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
          >
            Open Batches
          </button>
        </div>
      </div>
    );
  }

  if (isPostSummaryMode && postSummary) {
    const mortalityTone = postSummary.mortalityRate === null
      ? 'neutral'
      : postSummary.mortalityRate >= 5
        ? 'danger'
        : postSummary.mortalityRate >= 3
          ? 'warning'
          : 'success';
    const fcrTone = postSummary.actualFcr === null || postSummary.targetFcr === null
      ? 'neutral'
      : postSummary.actualFcr > postSummary.targetFcr + 0.15
        ? 'warning'
        : 'success';
    const harvestRows = postSummary.harvest.perHarvest.filter((row) => (
      row.harvestDate || Number(row.birds || 0) > 0 || Number(row.kilos || 0) > 0
    ));
    const harvestFcrTone = postSummary.harvest.fcr === null || postSummary.targetFcr === null
      ? 'neutral'
      : postSummary.harvest.fcr > postSummary.targetFcr + 0.15
        ? 'warning'
        : 'success';

    return (
      <div className="app-page text-app-text">
        <div className="mb-5 mt-2">
          <p className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-jetbrains">Operations</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold text-app-accent tracking-tight font-hanken">Post Summary</h2>
              <p className="mt-1 text-sm text-app-text-secondary font-jetbrains">
                Batch {activeBatch.id} - {postSummary.status || 'Closed'} - {formatDate(postSummary.summaryDate)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-72">
              <button
                type="button"
                onClick={() => setActiveScreen('dailyLog')}
                className="rounded-xl bg-app-accent px-3 py-3 text-xs font-black text-app-on-accent shadow-sm active:scale-95 hover:opacity-90 transition-all cursor-pointer font-jetbrains"
              >
                Open Logs
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('analytics')}
                className="rounded-xl border border-app-border bg-app-card px-3 py-3 text-xs font-black text-app-text-secondary shadow-sm active:scale-95 hover:text-app-text transition-all cursor-pointer font-jetbrains"
              >
                Analytics
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-app-danger/30 bg-app-danger-bg p-3 text-sm font-bold text-app-danger">
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryMetric
            label="Loaded"
            value={formatNumber(postSummary.loadedBirds)}
            detail={`${postSummary.buildingSummaries.length} building${postSummary.buildingSummaries.length === 1 ? '' : 's'}`}
          />
          <SummaryMetric
            label="Est. live"
            value={formatNumber(postSummary.estimatedLiveBirds)}
            detail={`${formatPercent(postSummary.survivalRate)} survival`}
            tone={postSummary.survivalRate !== null && postSummary.survivalRate < 95 ? 'warning' : 'success'}
          />
          <SummaryMetric
            label="Mortality"
            value={formatNumber(postSummary.mortality)}
            detail={`${formatPercent(postSummary.mortalityRate)} of loaded birds`}
            tone={mortalityTone}
          />
          <SummaryMetric
            label="Total feed"
            value={`${formatNumber(postSummary.totalFeedBags, 2)} sx`}
            detail={`${formatNumber(postSummary.totalFeedKg, 0)} kg consumed`}
          />
          <SummaryMetric
            label="Avg weight"
            value={postSummary.averageWeightGrams ? `${formatNumber(postSummary.averageWeightGrams / 1000, 2)} kg` : '--'}
            detail={postSummary.latestWeightDate ? `Latest ${formatDate(postSummary.latestWeightDate)}` : 'No weight logs'}
          />
          <SummaryMetric
            label="FCR"
            value={postSummary.actualFcr === null ? '--' : formatNumber(postSummary.actualFcr, 2)}
            detail={postSummary.targetFcr === null ? 'Needs weight logs' : `Target ${formatNumber(postSummary.targetFcr, 2)}`}
            tone={fcrTone}
          />
        </div>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Harvest Yield</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary font-jetbrains">
              {postSummary.harvest.hasActualSales ? postSummary.harvest.status || 'Recorded' : 'Awaiting actuals'}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <SummaryMetric
              label="Actual sold"
              value={postSummary.harvest.soldBirds === null ? '--' : formatNumber(postSummary.harvest.soldBirds)}
              detail={`Est. live ${formatNumber(postSummary.estimatedLiveBirds)}`}
              tone={postSummary.harvest.hasActualSales ? 'success' : 'neutral'}
            />
            <SummaryMetric
              label="Actual kilos"
              value={postSummary.harvest.kilos === null ? '--' : `${formatNumber(postSummary.harvest.kilos, 1)} kg`}
              detail={postSummary.harvest.averageWeightKg ? `${formatNumber(postSummary.harvest.averageWeightKg, 2)} kg average` : 'No sold kilos recorded'}
              tone={postSummary.harvest.hasActualSales ? 'success' : 'neutral'}
            />
            <SummaryMetric
              label="Harvest yield"
              value={formatPercent(postSummary.harvest.yieldRate)}
              detail={postSummary.harvest.estimatedVsSoldGap === null ? 'Waiting for sold birds' : `${formatNumber(postSummary.harvest.estimatedVsSoldGap)} est. vs sold gap`}
              tone={postSummary.harvest.hasActualSales ? 'success' : 'neutral'}
            />
            <SummaryMetric
              label="Actual FCR"
              value={postSummary.harvest.fcr === null ? '--' : formatNumber(postSummary.harvest.fcr, 2)}
              detail={postSummary.harvest.fcr === null ? 'Needs sold kilos' : 'Feed kg divided by sold kg'}
              tone={harvestFcrTone}
            />
          </div>

          {harvestRows.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-app-border bg-app-card shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-app-bg text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                  <tr>
                    <th className="px-4 py-3">Harvest</th>
                    <th className="px-4 py-3 text-right">Date</th>
                    <th className="px-4 py-3 text-right">Birds</th>
                    <th className="px-4 py-3 text-right">Kilos</th>
                    <th className="px-4 py-3 text-right">Avg wt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {harvestRows.map((row) => (
                    <tr key={row.harvestOrder}>
                      <td className="px-4 py-3 font-black text-app-text">
                        {row.harvestOrder}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-app-text-secondary font-jetbrains">
                        {formatDate(row.harvestDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-app-text font-jetbrains">
                        {formatNumber(row.birds)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-app-text font-jetbrains">
                        {formatNumber(row.kilos, 1)} kg
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-app-text font-jetbrains">
                        {row.averageWeightKg ? `${formatNumber(row.averageWeightKg, 2)} kg` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Building Closeout</h3>
            <span className="text-[10px] font-bold text-app-text-secondary font-jetbrains">
              {isLoading ? 'Loading...' : `${postSummary.buildingSummaries.length} building${postSummary.buildingSummaries.length === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-app-border bg-app-card shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-app-bg text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                <tr>
                  <th className="px-4 py-3">Building</th>
                  <th className="px-4 py-3 text-right">Loaded</th>
                  <th className="px-4 py-3 text-right">Est. live</th>
                  <th className="px-4 py-3 text-right">Mortality</th>
                  <th className="px-4 py-3 text-right">Feed</th>
                  <th className="px-4 py-3 text-right">Avg wt</th>
                  <th className="px-4 py-3 text-right">FCR</th>
                  <th className="px-4 py-3 text-right">Last log</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {postSummary.buildingSummaries.map((summary) => (
                  <tr key={summary.building}>
                    <td className="px-4 py-3">
                      <p className="font-black text-app-text">Building {summary.building}</p>
                      <p className="text-xs font-bold text-app-text-secondary">
                        {summary.employeeCount} employee{summary.employeeCount === 1 ? '' : 's'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-app-text font-jetbrains">
                      {formatNumber(summary.loadedBirds)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-app-text font-jetbrains">
                      {formatNumber(summary.estimatedLiveBirds)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-black text-app-danger font-jetbrains">{formatNumber(summary.mortality)}</p>
                      <p className="text-xs font-bold text-app-text-secondary font-jetbrains">{formatPercent(summary.mortalityRate)}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-app-text font-jetbrains">
                      {formatNumber(summary.feedBags, 2)} sx
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-app-text font-jetbrains">
                      {summary.averageWeightGrams ? `${formatNumber(summary.averageWeightGrams / 1000, 2)} kg` : '--'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-app-text font-jetbrains">
                      {summary.fcr === null ? '--' : formatNumber(summary.fcr, 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-app-text-secondary font-jetbrains">
                      {formatDate(summary.latestLogDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!postSummary.buildingSummaries.length && (
              <div className="p-5 text-center">
                <p className="text-sm font-bold text-app-text-secondary font-inter">No building loadings found for this batch.</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Closeout Checks</h3>
            <span className="text-[10px] font-bold text-app-text-secondary font-jetbrains">
              Day {postSummary.summaryAgeDay || '--'}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {postChecklist.map((item) => {
              const isActionable = Boolean(item.actionScreen) && item.tone !== 'success';
              const cardClass = `rounded-xl border p-4 shadow-sm ${
                item.tone === 'success'
                  ? 'border-app-success/30 bg-app-success-bg'
                  : item.tone === 'warning'
                    ? 'border-app-warning/30 bg-app-warning-bg'
                    : 'border-app-border bg-app-card'
              }`;
              const content = (
                <>
                  <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-jetbrains">{item.label}</p>
                  <p className={`mt-1 text-lg font-black font-jetbrains ${
                    item.tone === 'success'
                      ? 'text-app-success'
                      : item.tone === 'warning'
                        ? 'text-app-warning'
                        : 'text-app-text'
                  }`}>
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs font-bold leading-snug text-app-text-secondary font-inter">{item.detail}</p>
                </>
              );

              if (isActionable) {
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveScreen(item.actionScreen)}
                    className={`${cardClass} text-left transition-all duration-200 active:scale-[0.98] hover:border-app-accent cursor-pointer`}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <div key={item.key} className={cardClass}>
                  {content}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-page text-app-text">
      <div className="mb-5 mt-2">
        <p className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-jetbrains">Operations</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold text-app-accent tracking-tight font-hanken">Today</h2>
            <p className="text-sm text-app-text-secondary mt-1 font-jetbrains">
              Batch {activeBatch.id} - {formatDate(today)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-72">
            <div className="rounded-xl border border-app-border bg-app-card px-3 py-2 text-right shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-jetbrains">Age</p>
              <p className={`text-xl font-black font-jetbrains ${ageDay > lastTargetDay ? 'text-app-warning' : 'text-app-accent'}`}>
                D{ageDay || '--'}
              </p>
            </div>
            <div className="rounded-xl border border-app-border bg-app-card px-3 py-2 text-right shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-jetbrains">Harvest</p>
              <p className={`text-xl font-black font-jetbrains ${daysToHarvest !== null && daysToHarvest <= HARVEST_SOON_DAYS ? 'text-app-warning' : 'text-app-text'}`}>
                {daysToHarvest === null ? '--' : daysToHarvest < 0 ? `${Math.abs(daysToHarvest)}d late` : `${daysToHarvest}d`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-app-danger/30 bg-app-danger-bg p-3 text-sm font-bold text-app-danger">
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
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Building Checklist</h3>
            <span className="text-[10px] font-bold text-app-text-secondary font-jetbrains">
              {isLoading ? 'Loading...' : `${todayLogs.length} log${todayLogs.length === 1 ? '' : 's'} today`}
            </span>
          </div>

          <div className="space-y-3">
            {buildingChecks.map((check) => {
              const varianceIsHigh = check.variancePercent !== null && Math.abs(check.variancePercent) >= FEED_VARIANCE_WARNING_PERCENT;
              return (
                <div
                  key={check.building}
                  className={`rounded-xl border bg-app-card p-4 shadow-sm hover:border-app-accent transition-all duration-200 ${
                    !check.hasLogToday || !check.hasAssignedEmployee
                      ? 'border-app-danger/30'
                      : varianceIsHigh
                        ? 'border-app-warning/30'
                        : 'border-app-border'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-black font-hanken ${
                          check.hasLogToday ? 'bg-app-success-bg text-app-success' : 'bg-app-danger-bg text-app-danger'
                        }`}>
                          {check.building}
                        </span>
                        <div className="min-w-0">
                          <p className="font-black text-app-text">Building {check.building}</p>
                          <p className="text-xs font-bold text-app-text-secondary font-inter">
                            {formatNumber(check.chicksLoaded)} loaded - {check.assignedEmployees.length} employee{check.assignedEmployees.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-right">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-app-text-secondary font-jetbrains">Feed Today</p>
                        <p className="text-sm font-black text-app-text font-jetbrains">{formatNumber(check.todaysTotals.feed, 2)} sx</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-app-text-secondary font-jetbrains">Mortality</p>
                        <p className={`text-sm font-black font-jetbrains ${check.todaysTotals.mortality > 0 ? 'text-app-danger' : 'text-app-success'}`}>
                          {formatNumber(check.todaysTotals.mortality)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-app-text-secondary font-jetbrains">Variance</p>
                        <p className={`text-sm font-black font-jetbrains ${varianceIsHigh ? 'text-app-warning' : 'text-app-text'}`}>
                          {check.variancePercent === null ? '--' : `${check.variancePercent > 0 ? '+' : ''}${formatNumber(check.variancePercent, 1)}%`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider font-jetbrains">
                    <span className={`rounded-full px-2.5 py-1 ${check.hasLogToday ? 'bg-app-success-bg text-app-success' : 'bg-app-danger-bg text-app-danger'}`}>
                      {check.hasLogToday ? 'Logged today' : 'Needs log'}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 ${check.hasAssignedEmployee ? 'bg-app-success-bg text-app-success' : 'bg-app-danger-bg text-app-danger'}`}>
                      {check.hasAssignedEmployee ? 'Employee assigned' : 'No employee'}
                    </span>
                    {check.feedTarget && (
                      <span className="rounded-full bg-app-accent/15 px-2.5 py-1 text-app-accent">
                        Target {formatNumber(check.feedTarget.targetBags, 2)} sx
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {!buildingChecks.length && (
              <div className="rounded-xl border border-app-border bg-app-card p-4 text-center shadow-sm">
                <p className="text-sm font-bold text-app-text-secondary font-inter">No building loadings found for this batch.</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Warnings</h3>
            <span className="text-[10px] font-bold text-app-text-secondary font-jetbrains">
              {dangerCount} urgent
            </span>
          </div>

          <div className="space-y-3">
            {abnormalWarnings.map((warning) => (
              <WarningRow key={warning.key} warning={warning} />
            ))}

            {!abnormalWarnings.length && (
              <div className="rounded-xl border border-app-success/30 bg-app-success-bg p-4 shadow-sm text-app-success">
                <p className="text-sm font-black">No abnormal values today</p>
                <p className="mt-1 text-xs font-bold opacity-90 font-inter">
                  Logs, feed stock, employee assignment, age, and harvest checks look clear.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-app-border bg-app-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-jetbrains">Today totals</p>
                <p className="mt-1 text-lg font-black text-app-text font-jetbrains">
                  {formatNumber(todayTotals.feed, 2)} sx feed
                </p>
                <p className={`text-sm font-black font-jetbrains ${todayTotals.mortality > 0 ? 'text-app-danger' : 'text-app-success'}`}>
                  {formatNumber(todayTotals.mortality)} mortality
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveScreen('dailyLog')}
                className="rounded-xl bg-app-accent px-3 py-2 text-xs font-black text-app-on-accent shadow-sm active:scale-95 hover:opacity-90 transition-all cursor-pointer font-jetbrains"
              >
                Open Logs
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-app-bg p-3">
                <p className="font-bold uppercase text-app-text-secondary font-jetbrains">Feed stock after target</p>
                <p className={`mt-1 font-black font-jetbrains ${feedStockAfterTodayTarget !== null && feedStockAfterTodayTarget < 0 ? 'text-app-danger' : 'text-app-text'}`}>
                  {feedStockAfterTodayTarget === null ? '--' : `${formatNumber(feedStockAfterTodayTarget, 2)} sx`}
                </p>
              </div>
              <div className="rounded-lg bg-app-bg p-3">
                <p className="font-bold uppercase text-app-text-secondary font-jetbrains">Harvest target</p>
                <p className="mt-1 font-black text-app-text font-jetbrains">{formatDate(activeBatch.targetHarvestDate)}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
