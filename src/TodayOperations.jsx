import { useEffect, useMemo, useState } from 'react';
import { apiClient } from './utils/apiClient';
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

  const [prepChecklist, setPrepChecklist] = useState(() => {
    const initial = {
      dungCleanup: false,
      pressureWasher: false,
      clean: false,
      bedding: false,
      equipment: false,
      feed: false,
      inventory: false,
      prewarm: false
    };
    if (activeBatchId) {
      const saved = localStorage.getItem(`octavioPrepChecklist:${activeBatchId}`);
      if (saved) {
        try {
          return { ...initial, ...JSON.parse(saved) };
        } catch {
          // ignore
        }
      }
    }
    return initial;
  });



  const togglePrepItem = (key) => {
    setPrepChecklist((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (activeBatchId) {
        localStorage.setItem(`octavioPrepChecklist:${activeBatchId}`, JSON.stringify(next));
      }
      return next;
    });
  };
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
        const [loadingData, assignmentData, feedData, harvestData] = await Promise.all([
          apiClient.get(`/api/batches/${requestBatchId}/loadings`, { expectArray: true }),
          apiClient.get(`/api/batches/${requestBatchId}/employee-assignments`, { expectArray: true }),
          apiClient.get(`/api/inventory/items?category=Feed`, { expectArray: true }),
          apiClient.get(`/api/batches/${requestBatchId}/harvest-production-summary`).catch(() => null)
        ]);

        if (!isMounted) return;

        setTodayRequest({
          key: requestKey,
          data: {
            loadings: loadingData,
            assignments: assignmentData,
            feedItems: feedData,
            harvestProductionSummary: harvestData
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
            error: err.message || 'Cannot connect to today operations.',
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

  const status = getBatchStatus(activeBatch);
  const daysUntilArrival = activeBatch?.startDate ? diffDays(activeBatch.startDate, today) : null;
  const isOnTheWay = status === 'ON_THE_WAY' || status === 'ON THE WAY' || (daysUntilArrival !== null && daysUntilArrival > 0);

  if (isOnTheWay) {
    const checklistItems = [
      { key: 'dungCleanup', title: 'Chicken Dung Cleanup', desc: 'Thorough removal and disposal of previous flock\'s dung' },
      { key: 'pressureWasher', title: 'Pressure Washer Setup', desc: 'Inspect hoses, nozzle, and fuel for the pressure washer' },
      { key: 'clean', title: 'Sanitize & Disinfect', desc: 'Clean houses and apply virucidal sanitizers' },
      { key: 'bedding', title: 'Lay Dry Bedding', desc: 'Spread dry wood shavings or rice hulls 2" deep' },
      { key: 'equipment', title: 'Brooder & Heater Test', desc: 'Ensure all heating lamps and regulators function' },
      { key: 'feed', title: 'Feed & Water Prep', desc: 'Confirm starter feed is on hand and flush drinker lines' },
      { key: 'inventory', title: 'Inventory Audit', desc: 'Check and record starter feed, medicine, and vitamins' },
      { key: 'prewarm', title: '24-Hour Pre-warming', desc: 'Start heaters 24h before arrival to warm concrete to 32°C' }
    ];

    const checkedCount = Object.values(prepChecklist).filter(Boolean).length;
    const percentComplete = Math.round((checkedCount / checklistItems.length) * 100);

    const countdownText = daysUntilArrival !== null && daysUntilArrival > 0
      ? `Starts in ${daysUntilArrival} day${daysUntilArrival === 1 ? '' : 's'}`
      : daysUntilArrival === 0
        ? 'Arriving Today'
        : 'In Transit / Delayed';

    const countdownSubtext = daysUntilArrival !== null && daysUntilArrival > 0
      ? `Expected arrival: ${formatDate(activeBatch.startDate)}`
      : daysUntilArrival === 0
        ? 'Prepare for reception and unloading.'
        : `Expected arrival date was ${formatDate(activeBatch.startDate)}`;

    const readinessTone = percentComplete === 100
      ? 'success'
      : percentComplete >= 60
        ? 'warning'
        : 'danger';

    const readinessToneClass = {
      success: 'border-app-success/30 bg-app-success-bg text-app-success',
      warning: 'border-app-warning/30 bg-app-warning-bg text-app-warning',
      danger: 'border-app-danger/30 bg-app-danger-bg text-app-danger'
    }[readinessTone];

    return (
      <div className="app-page text-app-text">
        {/* Header */}
        <div className="mb-5 mt-2">
          <p className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-jetbrains">Operations</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold text-app-accent tracking-tight font-hanken">Pre-Arrival Prep</h2>
              <p className="text-sm text-app-text-secondary mt-1 font-jetbrains">
                Batch {activeBatch.id} • Status: {activeBatch.status || 'ON THE WAY'}
              </p>
            </div>
            
            {/* Countdown Badge */}
            <div className="rounded-xl border border-app-border bg-app-card px-4 py-2 flex items-center gap-3 shadow-sm min-w-56">
              <svg className="h-6 w-6 text-app-accent shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-jetbrains">ETA Status</p>
                <p className="text-sm font-black font-jetbrains text-app-accent">
                  {countdownText}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Card / Countdown Section */}
        <div className="relative overflow-hidden rounded-2xl border border-app-border bg-gradient-to-br from-app-card via-app-card to-app-accent/5 p-6 shadow-sm mb-6">
          {/* Decorative background grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
          
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-app-accent/10 px-2.5 py-0.5 text-xs font-semibold text-app-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-app-accent animate-pulse" />
                Transit & Setup Mode
              </span>
              <h3 className="text-2xl font-black font-hanken tracking-tight">
                {countdownText}
              </h3>
              <p className="text-sm text-app-text-secondary font-inter">
                {countdownSubtext}
              </p>
            </div>

            {/* Checklist Progress Bar */}
            <div className="w-full md:w-80 shrink-0 space-y-2">
              <div className="flex justify-between text-xs font-bold font-jetbrains">
                <span className="text-app-text-secondary">PREPARATION PROGRESS</span>
                <span className="text-app-accent">{percentComplete}% READY</span>
              </div>
              <div className="h-3 w-full rounded-full bg-app-bg overflow-hidden border border-app-border">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-app-accent to-[#50B8F9] transition-all duration-500 ease-out"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
              <p className="text-[10px] text-app-text-secondary text-right font-inter font-semibold">
                {checkedCount} of {checklistItems.length} essential tasks complete
              </p>
            </div>
          </div>
        </div>

        {/* Expected Metrics Bento Grid */}
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryMetric
            label="Arrival Date"
            value={formatDate(activeBatch.startDate)}
            detail="Scheduled reception day"
          />
          <SummaryMetric
            label="Planned Flock"
            value={formatNumber(activeBatch.plannedFlock || activeBatch.totalChicksLoaded)}
            detail="Target flock size"
          />
          <SummaryMetric
            label="Target Feed Requirement"
            value={activeBatch.targetFeedKg ? `${formatNumber(activeBatch.targetFeedKg)} kg` : '--'}
            detail="Expected starter feed"
          />
          <div className={`rounded-xl border p-4 shadow-sm transition-colors ${readinessToneClass}`}>
            <p className="text-[10px] font-black uppercase tracking-wider opacity-85 font-jetbrains">Readiness Status</p>
            <p className="mt-1 text-2xl font-black font-jetbrains">{percentComplete}%</p>
            <p className="mt-2 text-xs font-bold leading-snug opacity-90 font-inter">
              {percentComplete === 100 
                ? 'All systems go! Houses prepped.' 
                : `${checklistItems.length - checkedCount} tasks remaining before chicks arrive.`}
            </p>
          </div>
        </div>

        {/* Interactive Checklist Cards */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Pre-Arrival Checklist</h3>
            <span className="text-[10px] font-bold text-app-text-secondary font-jetbrains">
              {checkedCount}/{checklistItems.length} Completed
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {checklistItems.map((item) => {
              const isChecked = prepChecklist[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => togglePrepItem(item.key)}
                  className={`group relative flex flex-col justify-between rounded-xl border p-5 text-left shadow-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                    isChecked
                      ? 'border-app-success bg-app-success-bg/20 text-app-text'
                      : 'border-app-border bg-app-card hover:border-app-accent text-app-text'
                  }`}
                >
                  <div className="w-full flex items-start justify-between gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isChecked ? 'bg-app-success-bg text-app-success' : 'bg-app-bg text-app-text-secondary group-hover:text-app-accent group-hover:bg-app-accent/5'
                    } transition-colors`}>
                      {item.key === 'dungCleanup' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                      {item.key === 'pressureWasher' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072M6 18H4a2 2 0 01-2-2v-4a2 2 0 012-2h2m10-4H8a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V8a2 2 0 00-2-2z" />
                        </svg>
                      )}
                      {item.key === 'clean' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3M3 12l3-3m-3 3l-3-3M19.5 12a45.54 45.54 0 01-15 0" />
                        </svg>
                      )}
                      {item.key === 'bedding' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
                        </svg>
                      )}
                      {item.key === 'equipment' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                      {item.key === 'feed' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      )}
                      {item.key === 'inventory' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      )}
                      {item.key === 'prewarm' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                        </svg>
                      )}
                    </span>

                    {/* Custom circle checkbox */}
                    <div className="shrink-0">
                      {isChecked ? (
                        <svg className="h-6 w-6 text-app-success" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-6 w-6 text-app-text-secondary/30 group-hover:text-app-accent/60 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="font-extrabold text-sm font-hanken tracking-tight leading-tight group-hover:text-app-accent transition-colors">
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-xs text-app-text-secondary leading-snug font-inter">
                      {item.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Action Quick Links */}
        <section className="mt-6">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent mb-3 font-hanken">Quick Actions</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setActiveScreen('batches')}
              className="flex items-center justify-between rounded-xl border border-app-border bg-app-card p-4 shadow-sm hover:border-app-accent transition-all duration-200 cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-accent/10 text-app-accent">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </span>
                <div>
                  <p className="font-black text-sm text-app-text font-hanken">Manage Batches</p>
                  <p className="text-xs text-app-text-secondary font-inter">Configure start dates, planned counts, or switch active batches.</p>
                </div>
              </div>
              <svg className="h-5 w-5 text-app-text-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setActiveScreen('inventory')}
              className="flex items-center justify-between rounded-xl border border-app-border bg-app-card p-4 shadow-sm hover:border-app-accent transition-all duration-200 cursor-pointer text-left active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-accent/10 text-app-accent">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </span>
                <div>
                  <p className="font-black text-sm text-app-text font-hanken">Check Feed Stock</p>
                  <p className="text-xs text-app-text-secondary font-inter">Verify starter feed inventory levels before bird arrival.</p>
                </div>
              </div>
              <svg className="h-5 w-5 text-app-text-secondary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </section>
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
