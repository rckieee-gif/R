import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../../shared/utils/apiClient';
import {
  BAG_WEIGHT_KG,
  calculateActualFcr,
  calculateTargetFeedForHeads,
  getAgeDay,
  getLastBroilerTargetDay
} from '../../shared/utils/broilerTargets';
import OfflineStaleBanner from '../../shared/components/OfflineStaleBanner';

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
const INITIAL_PREP_CHECKLIST = {
  dungCleanup: false,
  pressureWasher: false,
  clean: false,
  bedding: false,
  equipment: false,
  feed: false,
  inventory: false,
  prewarm: false
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

function getArrivalEtaStatus(daysUntilArrival, expectedDate) {
  if (daysUntilArrival === null) {
    return {
      statusText: 'Date not set',
      detailText: 'Set the expected arrival date.'
    };
  }

  if (daysUntilArrival > 0) {
    return {
      statusText: `On schedule: ${daysUntilArrival} day${daysUntilArrival === 1 ? '' : 's'}`,
      detailText: `Expected: ${expectedDate}`
    };
  }

  if (daysUntilArrival === 0) {
    return {
      statusText: 'Arriving today',
      detailText: `Expected: ${expectedDate}`
    };
  }

  const lateDays = Math.abs(daysUntilArrival);
  return {
    statusText: `Overdue: ${lateDays} day${lateDays === 1 ? '' : 's'} late`,
    detailText: `Expected: ${expectedDate}`
  };
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

function readPrepChecklist(batchId) {
  if (!batchId) return INITIAL_PREP_CHECKLIST;

  const saved = localStorage.getItem(`octavioPrepChecklist:${batchId}`);
  if (!saved) return INITIAL_PREP_CHECKLIST;

  try {
    return { ...INITIAL_PREP_CHECKLIST, ...JSON.parse(saved) };
  } catch {
    return INITIAL_PREP_CHECKLIST;
  }
}

function readFarmChecklist(batchId, date) {
  if (!batchId) return {};
  const saved = localStorage.getItem(`farmChecklist:${batchId}:${date}`);
  if (!saved) return {};
  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
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

function InfoButton({ term, setActiveTooltip }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setActiveTooltip(term);
      }}
      className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-app-accent/10 text-app-accent text-[9px] font-black hover:bg-app-accent/25 active:scale-90 transition-all cursor-pointer font-jetbrains"
      title="Click for explanation"
    >
      ?
    </button>
  );
}

function AttentionCard({ label, value, detail, tone = 'neutral', onClick, isLoading = false, infoTerm = null, setActiveTooltip = null }) {
  if (isLoading) {
    return (
      <div className="min-h-28 rounded-xl border border-app-border bg-app-card p-4 animate-pulse">
        <div className="h-3 w-2/3 bg-app-border/40 rounded"></div>
        <div className="h-8 w-1/3 bg-app-border/50 rounded mt-2"></div>
        <div className="h-3.5 w-4/5 bg-app-border/30 rounded mt-3"></div>
      </div>
    );
  }
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
      <p className="text-[10px] font-black uppercase tracking-wider opacity-85 font-inter">
        {label}
        {infoTerm && setActiveTooltip && (
          <InfoButton term={infoTerm} setActiveTooltip={setActiveTooltip} />
        )}
      </p>
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
          <p className={`text-[10px] font-black uppercase tracking-wider font-inter ${labelClass}`}>{warning.label}</p>
          <p className="text-sm font-black text-app-text mt-1 font-hanken">{warning.title}</p>
          <p className="text-xs font-bold text-app-text-secondary mt-1 leading-snug font-inter">{warning.detail}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase font-inter ${labelClass} bg-app-card/85 border border-app-border`}>
          {warning.severity}
        </span>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, detail, tone = 'neutral', isLoading = false, infoTerm = null, setActiveTooltip = null }) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-app-border bg-app-card p-4 shadow-sm animate-pulse">
        <div className="h-3 w-1/2 bg-app-border/40 rounded"></div>
        <div className="h-6 w-1/3 bg-app-border/50 rounded mt-2"></div>
        <div className="h-3 w-3/4 bg-app-border/30 rounded mt-3"></div>
      </div>
    );
  }
  const toneClass = {
    neutral: 'border-app-border bg-app-card text-app-text',
    success: 'border-app-success/30 bg-app-success-bg text-app-success',
    warning: 'border-app-warning/30 bg-app-warning-bg text-app-warning',
    danger: 'border-app-danger/30 bg-app-danger-bg text-app-danger'
  }[tone];

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-colors ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-wider opacity-85 font-inter">
        {label}
        {infoTerm && setActiveTooltip && (
          <InfoButton term={infoTerm} setActiveTooltip={setActiveTooltip} />
        )}
      </p>
      <p className="mt-1 text-2xl font-black font-jetbrains">{value}</p>
      <p className="mt-2 text-xs font-bold leading-snug opacity-90 font-inter">{detail}</p>
    </div>
  );
}

const TOOLTIP_DEFINITIONS = {
  fcr: {
    title: 'Feed Conversion Ratio (FCR)',
    desc: 'FCR measures how efficiently birds convert feed into live body weight. Formula: Total Feed Consumed (kg) / Total Live Bird Weight (kg). A lower FCR means higher feed efficiency and profitability.',
  },
  'feed-variance': {
    title: 'Feed Variance',
    desc: 'The percentage difference between the actual feed consumed by your batch and the standard target broiler guidelines for their age. A high positive variance indicates over-feeding, while a negative variance indicates potential under-feeding or feed waste.',
  },
  age: {
    title: 'Batch Age',
    desc: 'The current age of the broiler batch in days. Day 1 starts when the chicks are unloaded in the building. Feed targets and mortality thresholds are determined dynamically based on this age.',
  }
};

export default function TodayOperations({ token, activeBatch, logs = [], setActiveScreen, previewData = null }) {
  const activeBatchId = activeBatch?.id ?? null;
  const location = useLocation();
  const navigate = useNavigate();
  const previewKey = previewData ? `preview:${previewData.batch?.id || activeBatchId || 'current'}` : null;
  const todayDataKey = token && activeBatchId ? `batch:${activeBatchId}` : previewKey;
  const [todayRequest, setTodayRequest] = useState({
    key: null,
    data: EMPTY_TODAY_DATA,
    error: '',
    isLoading: false
  });

  const [mobileTabState, setMobileTabState] = useState({
    batchId: activeBatchId,
    tab: 'overview'
  });
  const mobileTab = mobileTabState.batchId === activeBatchId ? mobileTabState.tab : 'overview';
  const setMobileTab = useCallback((nextTab) => {
    setMobileTabState((current) => {
      const currentTab = current.batchId === activeBatchId ? current.tab : 'overview';
      const tab = typeof nextTab === 'function' ? nextTab(currentTab) : nextTab;
      return { batchId: activeBatchId, tab };
    });
  }, [activeBatchId]);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [dayOneHandoffBatchId, setDayOneHandoffBatchId] = useState(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('handoff') !== 'day-one') return null;
    return location.state?.dayOneHandoffBatchId ?? 'current';
  });

  const renderTooltipModal = () => {
    if (!activeTooltip) return null;

    const tooltips = TOOLTIP_DEFINITIONS[activeTooltip];
    if (!tooltips) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-backdrop-in">
        <div className="relative w-full max-w-sm rounded-xl border border-app-border bg-app-card p-5 shadow-xl animate-modal-in">
          <button
            type="button"
            onClick={() => setActiveTooltip(null)}
            className="absolute top-3 right-3 text-app-text-secondary hover:text-app-text transition-colors p-2 -m-2 rounded-lg focus-visible:ring-2 focus-visible:ring-app-accent"
            aria-label="Close explanation"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h4 className="text-base font-black text-app-accent font-hanken">{tooltips.title}</h4>
          <p className="text-xs font-bold text-app-text-secondary mt-3 leading-relaxed font-inter">
            {tooltips.desc}
          </p>
          <button
            type="button"
            onClick={() => setActiveTooltip(null)}
            className="mt-5 w-full rounded-lg bg-app-accent py-2 text-xs font-bold text-app-on-accent shadow-sm active:scale-[0.98] transition-all duration-200 cursor-pointer font-inter"
            aria-label="Close dialog"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const [prepChecklistState, setPrepChecklistState] = useState(() => ({
    batchId: activeBatchId,
    items: readPrepChecklist(activeBatchId)
  }));
  const prepChecklist = useMemo(() => {
    if (prepChecklistState.batchId === activeBatchId) {
      return prepChecklistState.items;
    }

    return readPrepChecklist(activeBatchId);
  }, [activeBatchId, prepChecklistState]);

  const togglePrepItem = (key) => {
    if (!token) return;
    setPrepChecklistState((current) => {
      const currentItems = current.batchId === activeBatchId
        ? current.items
        : readPrepChecklist(activeBatchId);
      const next = { ...currentItems, [key]: !currentItems[key] };
      if (activeBatchId) {
        localStorage.setItem(`octavioPrepChecklist:${activeBatchId}`, JSON.stringify(next));
      }
      return { batchId: activeBatchId, items: next };
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
  const [lastBatchIdAndDate, setLastBatchIdAndDate] = useState(`${activeBatchId}:${today}`);
  const [manualCheckedItems, setManualCheckedItems] = useState(() => {
    return readFarmChecklist(activeBatchId, today);
  });

  const currentBatchIdAndDate = `${activeBatchId}:${today}`;
  if (lastBatchIdAndDate !== currentBatchIdAndDate) {
    setLastBatchIdAndDate(currentBatchIdAndDate);
    setManualCheckedItems(readFarmChecklist(activeBatchId, today));
  }

  const toggleFarmChecklistItem = (itemKey) => {
    setManualCheckedItems((prev) => {
      const next = { ...prev, [itemKey]: !prev[itemKey] };
      if (activeBatchId) {
        localStorage.setItem(`farmChecklist:${activeBatchId}:${today}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const ageDay = activeBatch?.startDate ? getAgeDay(activeBatch.startDate, today) : null;
  const lastTargetDay = getLastBroilerTargetDay();
  const daysToHarvest = diffDays(activeBatch?.targetHarvestDate, today);

  const status = getBatchStatus(activeBatch);
  const daysUntilArrival = activeBatch?.startDate ? diffDays(activeBatch.startDate, today) : null;
  const isOnTheWay = status === 'ON_THE_WAY' || status === 'ON THE WAY' || (daysUntilArrival !== null && daysUntilArrival > 0);
  const isPostSummaryMode = isPostBatch(activeBatch);
  const showDayOneHandoff = Boolean(
    dayOneHandoffBatchId &&
    (dayOneHandoffBatchId === 'current' || String(dayOneHandoffBatchId) === String(activeBatchId)) &&
    !isOnTheWay &&
    !isPostSummaryMode
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('handoff') !== 'day-one') return;
    navigate('/today', { replace: true, state: null });
  }, [location.search, navigate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeTooltip) {
        setActiveTooltip(null);
        return;
      }

      const target = e.target;
      if (target && target.tagName) {
        const tagName = target.tagName.toUpperCase();
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable) {
          return;
        }
      }

      if (e.key === '1') {
        setMobileTab('overview');
      } else if (e.key === '2') {
        if (isOnTheWay) {
          setMobileTab('checklist');
        } else if (isPostSummaryMode) {
          setMobileTab('buildings');
        } else {
          setMobileTab('checklist');
        }
      } else if (e.key === '3') {
        if (isOnTheWay) {
          setMobileTab('actions');
        } else if (isPostSummaryMode) {
          setMobileTab('checks');
        } else {
          setMobileTab('warnings');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTooltip, isOnTheWay, isPostSummaryMode, setMobileTab]);

  useEffect(() => {
    if (!todayDataKey) {
      return;
    }

    if (!token || !activeBatchId) {
      return;
    }

    let isMounted = true;
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

  const buildingChecks = activeLoadings.map((loading) => {
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
  });

  const lowFeedItems = feedItems.filter((item) => (
    Number(item.reorderLevel || 0) > 0 && Number(item.currentStock || 0) < Number(item.reorderLevel || 0)
  ));

  const dailyFeedTarget = calculateTargetFeedForHeads(activeBatch?.totalChicksLoaded, ageDay);

  const totalFeedStock = feedItems.reduce((sum, item) => sum + Number(item.currentStock || 0), 0);

  const daysOfFeedRemaining = (!dailyFeedTarget || dailyFeedTarget.targetBags <= 0)
    ? null
    : totalFeedStock / dailyFeedTarget.targetBags;
  const totalMortalityToDate = logs.reduce((sum, log) => sum + Number(log.mortality || 0), 0);
  const mortalityAllowance = Number(activeBatch?.mortalityAllowance || 0);
  const mortalityAllowanceLimit = mortalityAllowance > 0
    ? mortalityAllowance
    : Math.max(MORTALITY_WARNING_HEADS, Math.ceil(Number(activeBatch?.totalChicksLoaded || 0) * MORTALITY_WARNING_RATE));
  const mortalityAllowanceUsedPercent = mortalityAllowanceLimit > 0
    ? Math.min(100, (totalMortalityToDate / mortalityAllowanceLimit) * 100)
    : 0;
  const mortalityAllowanceRemaining = Math.max(mortalityAllowanceLimit - totalMortalityToDate, 0);
  const mortalityAllowanceTone = totalMortalityToDate <= mortalityAllowanceLimit
    ? 'success'
    : totalMortalityToDate <= mortalityAllowanceLimit * 2
      ? 'warning'
      : 'danger';

  const abnormalWarnings = (() => {
    const warnings = [];
    const plannedFlock = Number(activeBatch?.plannedFlock || 0);
    const actualLoaded = Number(activeBatch?.totalChicksLoaded || 0);
    const arrivalVariance = actualLoaded - plannedFlock;

    if (plannedFlock > 0 && actualLoaded > 0 && arrivalVariance < 0) {
      warnings.push({
        key: 'arrival-variance',
        label: 'Arrival variance',
        severity: 'warning',
        title: 'Actual arrival is below plan',
        detail: `${formatNumber(Math.abs(arrivalVariance))} fewer chicks arrived than the planned flock of ${formatNumber(plannedFlock)}.`
      });
    }

    if (mortalityAllowance > 0 && totalMortalityToDate > mortalityAllowance) {
      warnings.push({
        key: 'mortality-allowance',
        label: 'Mortality allowance',
        severity: totalMortalityToDate > mortalityAllowance * 2 ? 'danger' : 'warning',
        title: 'Cumulative mortality is above allowance',
        detail: `${formatNumber(totalMortalityToDate)} total mortality recorded; allowance is ${formatNumber(mortalityAllowance)} heads.`
      });
    }

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
        const isSevere = mortality > threshold * 2;
        warnings.push({
          key: `mortality-${log.id}`,
          label: isSevere ? 'Severe mortality' : 'Unusual mortality',
          severity: isSevere ? 'danger' : 'warning',
          title: `${log.employeeName || `Building ${log.building}`} logged ${isSevere ? 'severe ' : ''}(${formatNumber(mortality)}) mortality`,
          detail: isSevere 
            ? `Severe mortality is more than double the ${formatNumber(threshold)} head warning level.`
            : `Today is above the ${formatNumber(threshold)} head warning level for this share.`
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

    if (daysOfFeedRemaining !== null) {
      if (daysOfFeedRemaining < 3) {
        warnings.push({
          key: 'feed-stock-critical',
          label: 'Feed stock critical',
          severity: 'danger',
          title: `Critical Feed Stock: ${formatNumber(daysOfFeedRemaining, 1)} day${daysOfFeedRemaining === 1 ? '' : 's'} left`,
          detail: `Current feed stock of ${formatNumber(totalFeedStock, 2)} sacks is short for the 3-day warning limit.`
        });
      } else if (daysOfFeedRemaining < 7) {
        warnings.push({
          key: 'feed-stock-low',
          label: 'Feed stock low',
          severity: 'warning',
          title: `Low Feed Stock: ${formatNumber(daysOfFeedRemaining, 1)} day${daysOfFeedRemaining === 1 ? '' : 's'} left`,
          detail: `Current feed stock of ${formatNumber(totalFeedStock, 2)} sacks is below the 7-day safety threshold.`
        });
      }
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
  })();

  const missingLogCount = buildingChecks.filter((check) => !check.hasLogToday).length;
  const noEmployeeCount = buildingChecks.filter((check) => !check.hasAssignedEmployee).length;
  const dangerCount = abnormalWarnings.filter((warning) => warning.severity === 'danger').length;
  const todayTotals = buildLogTotals(todayLogs);

  const farmChecklistItems = (() => {
    const isMortalityRecorded = buildingChecks.length > 0 && buildingChecks.every(check => 
      check.hasLogToday && check.todaysLogs.some(log => log.mortality !== null && log.mortality !== undefined && log.mortality !== '')
    );

    const isFeedRecorded = buildingChecks.length > 0 && buildingChecks.every(check => 
      check.hasLogToday && check.todaysLogs.some(log => log.feed !== null && log.feed !== undefined && log.feed !== '')
    );

    const isWeightRecorded = buildingChecks.length > 0 && buildingChecks.some(check => 
      check.hasLogToday && check.todaysLogs.some(log => Number(log.averageWeightGrams || 0) > 0)
    );

    const isFeedStockOk = lowFeedItems.length === 0 && (daysOfFeedRemaining === null || daysOfFeedRemaining >= 7);

    const isWarningsClear = dangerCount === 0 && abnormalWarnings.length === 0;

    const isAssignmentsConfirmed = buildingChecks.length > 0 && noEmployeeCount === 0;

    const isDailyLogSubmitted = buildingChecks.length > 0 && missingLogCount === 0;

    const weightLog = todayLogs.find(log => Number(log.averageWeightGrams || 0) > 0);
    const weightValue = weightLog ? Number(weightLog.averageWeightGrams) : null;

    const items = [
      {
        key: 'mortality',
        title: 'Record mortality',
        desc: 'Log bird mortality count for each building today.',
        statusLabel: isMortalityRecorded 
          ? `Mortality: ${formatNumber(todayTotals.mortality)} head${todayTotals.mortality === 1 ? '' : 's'} recorded`
          : (todayLogs.length > 0 
              ? `Mortality: ${formatNumber(todayTotals.mortality)} head${todayTotals.mortality === 1 ? '' : 's'} recorded` 
              : 'No mortality logged today.'),
        autoComplete: isMortalityRecorded,
        actionScreen: 'dailyLog',
        actionLabel: 'Add Mortality'
      },
      {
        key: 'feed',
        title: 'Record feed used',
        desc: 'Log bags of feed consumed by flock in each building.',
        statusLabel: isFeedRecorded 
          ? `Feed: ${formatNumber(todayTotals.feed, todayTotals.feed % 1 === 0 ? 0 : 1)} sack${todayTotals.feed === 1 ? '' : 's'} recorded`
          : (todayTotals.feed > 0 
              ? `Feed: ${formatNumber(todayTotals.feed, todayTotals.feed % 1 === 0 ? 0 : 1)} sack${todayTotals.feed === 1 ? '' : 's'} recorded` 
              : 'Feed: Not recorded'),
        autoComplete: isFeedRecorded,
        actionScreen: 'dailyLog',
        actionLabel: 'Go to Logs'
      },
      {
        key: 'weight',
        title: 'Record average weight',
        desc: 'Weigh a sample of birds to update daily average weight.',
        statusLabel: weightValue !== null 
          ? `Weight: ${formatNumber(weightValue)}g average` 
          : 'Weight: Missing',
        autoComplete: isWeightRecorded,
        actionScreen: 'dailyLog',
        actionLabel: 'Go to Logs'
      },
      {
        key: 'feedStock',
        title: 'Check feed stock',
        desc: 'Verify if current feed inventory is above safety thresholds.',
        statusLabel: daysOfFeedRemaining !== null 
          ? `Inventory: Feed will last ${Math.round(daysOfFeedRemaining)} day${Math.round(daysOfFeedRemaining) === 1 ? '' : 's'}` 
          : 'Inventory: Feed levels unknown',
        autoComplete: isFeedStockOk,
        actionScreen: 'inventory',
        actionLabel: 'Check Stock'
      },
      {
        key: 'warnings',
        title: 'Check abnormal warnings',
        desc: 'Review any feed, mortality, or age variance warning alerts.',
        statusLabel: abnormalWarnings.length > 0 
          ? `Warnings: ${abnormalWarnings.length} active warning${abnormalWarnings.length === 1 ? '' : 's'}` 
          : 'Warnings: Clear',
        autoComplete: isWarningsClear,
        actionScreen: 'warnings',
        actionLabel: 'Review Warnings'
      },
      {
        key: 'assignments',
        title: 'Confirm employee assignments',
        desc: 'Ensure all active buildings have assigned workers today.',
        statusLabel: noEmployeeCount > 0 
          ? `Employees: ${noEmployeeCount} building${noEmployeeCount === 1 ? '' : 's'} unassigned` 
          : 'Employees: All buildings assigned',
        autoComplete: isAssignmentsConfirmed,
        actionScreen: 'employees',
        actionLabel: 'Assign Staff'
      },
      {
        key: 'dailyLog',
        title: 'Submit daily log',
        desc: 'Verify all logs are submitted and finalise for the day.',
        statusLabel: missingLogCount > 0 
          ? `Logs: ${missingLogCount} building${missingLogCount === 1 ? '' : 's'} missing` 
          : 'Logs: All buildings submitted',
        autoComplete: isDailyLogSubmitted,
        actionScreen: 'dailyLog',
        actionLabel: 'Submit Log'
      }
    ];

    return items.map(item => ({
      ...item,
      checked: Boolean(manualCheckedItems[item.key] || item.autoComplete)
    }));
  })();

  const farmCheckedCount = farmChecklistItems.filter(item => item.checked).length;
  const farmPercentComplete = farmChecklistItems.length > 0 
    ? Math.round((farmCheckedCount / farmChecklistItems.length) * 100) 
    : 0;

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

  const postChecklist = (() => {
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
  })();

  const renderDayOneHandoff = () => {
    const loadedBirds = activeLoadings.reduce((sum, loading) => sum + Number(loading.chicksLoaded || 0), 0) ||
      Number(activeBatch?.totalChicksLoaded || 0);
    const plannedFlock = Number(activeBatch?.plannedFlock || 0);
    const arrivalVariance = loadedBirds - plannedFlock;
    const hasPlannedFlock = plannedFlock > 0;
    const varianceDetail = !hasPlannedFlock
      ? 'Planned flock is not set.'
      : arrivalVariance < 0
        ? `${formatNumber(Math.abs(arrivalVariance))} fewer than planned.`
        : arrivalVariance > 0
          ? `${formatNumber(arrivalVariance)} above planned.`
          : 'Arrival count matches plan.';
    const arrivalCountTone = loadedBirds > 0 && (!hasPlannedFlock || arrivalVariance >= 0)
      ? 'success'
      : loadedBirds > 0
        ? 'warning'
        : 'danger';
    const handoffTasks = [
      {
        key: 'arrival-counts',
        label: 'Confirm arrival counts',
        value: loadedBirds > 0 ? formatNumber(loadedBirds) : 'Missing',
        detail: loadedBirds > 0 ? varianceDetail : 'Enter actual chicks arrived by building.',
        tone: arrivalCountTone,
        actionScreen: 'batches',
        actionLabel: loadedBirds > 0 ? 'Review counts' : 'Add counts'
      },
      {
        key: 'assignments',
        label: 'Assign buildings',
        value: noEmployeeCount > 0 ? `${formatNumber(noEmployeeCount)} open` : 'Ready',
        detail: noEmployeeCount > 0 ? 'Assign workers before the first log.' : 'Loaded buildings have workers assigned.',
        tone: noEmployeeCount > 0 ? 'warning' : 'success',
        actionScreen: 'employees',
        actionLabel: 'Assign staff'
      },
      {
        key: 'first-log',
        label: 'Record first daily log',
        value: missingLogCount > 0 ? `${formatNumber(missingLogCount)} left` : 'Logged',
        detail: missingLogCount > 0 ? 'Capture feed, mortality, and starting weight today.' : 'All loaded buildings have a log today.',
        tone: missingLogCount > 0 ? 'warning' : 'success',
        actionScreen: 'dailyLog',
        actionLabel: 'Open logs'
      },
      {
        key: 'starter-feed',
        label: 'Check starter feed',
        value: lowFeedItems.length > 0 ? `${formatNumber(lowFeedItems.length)} low` : 'Clear',
        detail: lowFeedItems.length > 0 ? 'Review stock before the first feeding.' : 'Feed stock is above reorder level.',
        tone: lowFeedItems.length > 0 ? 'warning' : 'success',
        actionScreen: 'inventory',
        actionLabel: 'Check stock'
      }
    ];

    const toneClass = {
      success: 'border-app-success/30 bg-app-success-bg text-app-success',
      warning: 'border-app-warning/30 bg-app-warning-bg text-app-warning',
      danger: 'border-app-danger/30 bg-app-danger-bg text-app-danger'
    };

    return (
      <div className="mb-6 rounded-2xl border border-app-accent/30 bg-app-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-app-accent font-inter">
              Day-one arrival handoff
            </p>
            <h3 className="mt-1 text-xl font-black text-app-text font-hanken">
              Batch {activeBatch.id} is now active
            </h3>
            <p className="mt-1 text-sm font-bold text-app-text-secondary font-inter">
              Start with arrival checks before the regular daily closeout.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDayOneHandoffBatchId(null)}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-app-border bg-app-bg px-3 text-xs font-black text-app-text-secondary hover:text-app-text active:scale-[0.98] transition-all cursor-pointer font-inter"
          >
            Dismiss
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {handoffTasks.map((task) => {
            const content = (
              <>
                <p className="text-[10px] font-black uppercase tracking-wider opacity-85 font-inter">
                  {task.label}
                </p>
                <p className="mt-1 text-xl font-black font-jetbrains">
                  {isLoading ? '--' : task.value}
                </p>
                <p className="mt-1 text-xs font-bold leading-snug opacity-90 font-inter">
                  {isLoading ? 'Loading arrival data...' : task.detail}
                </p>
              </>
            );

            return (
              <button
                key={task.key}
                type="button"
                onClick={() => setActiveScreen(task.actionScreen)}
                className={`rounded-xl border p-4 text-left shadow-sm transition-all duration-200 active:scale-[0.98] hover:border-app-accent cursor-pointer ${toneClass[task.tone]}`}
              >
                {content}
                <span className="mt-3 inline-flex text-[10px] font-black uppercase tracking-wider opacity-90 font-inter">
                  {task.actionLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFarmChecklist = () => {
    const needsMortalityLog = farmChecklistItems.some((item) => item.key === 'mortality' && !item.autoComplete);

    return (
      <div className="rounded-2xl border border-app-border bg-gradient-to-br from-app-card via-app-card to-app-accent/5 p-6 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-app-accent/10 px-2.5 py-0.5 text-xs font-semibold text-app-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-app-accent animate-pulse" />
              Active Operations Checklist
            </span>
            <h3 className="text-xl font-black font-hanken tracking-tight">
              Today’s Farm Checklist
            </h3>
            <p className="text-xs text-app-text-secondary font-inter">
              Operator page tasks for Batch #{activeBatch.id} • D{ageDay || '--'}.
            </p>
          </div>

          <div className="w-full lg:w-80 shrink-0 space-y-2">
            <div className="flex justify-between text-xs font-bold font-inter">
              <span className="text-app-text-secondary">DAILY PROGRESS</span>
              <span className="text-app-accent font-black">{farmPercentComplete}% COMPLETE</span>
            </div>
            <div className="h-3 w-full rounded-full bg-app-bg overflow-hidden border border-app-border">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-app-accent to-[#50B8F9] transition-all duration-500 ease-out"
                style={{ width: `${farmPercentComplete}%` }}
              />
            </div>
            <p className="text-[10px] text-app-text-secondary text-right font-inter font-semibold">
              {farmCheckedCount} of {farmChecklistItems.length} tasks completed today
            </p>
          </div>
        </div>

        {needsMortalityLog && !isLoading && (
          <div className="mb-5 rounded-xl border border-app-warning/30 bg-app-warning-bg p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-black text-app-warning font-hanken">
                  No mortality logged today.
                </h4>
                <p className="mt-1 text-xs font-bold text-app-text-secondary font-inter">
                  Add today's mortality count to keep your batch records accurate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveScreen('dailyLog')}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-app-accent px-4 text-xs font-black text-app-on-accent shadow-sm active:scale-[0.98] transition-all cursor-pointer font-inter whitespace-nowrap"
              >
                Add Mortality
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-app-border/60">
          {farmChecklistItems.map((item) => {
            const isAuto = item.autoComplete;
            return (
              <div
                key={item.key}
                onClick={() => toggleFarmChecklistItem(item.key)}
                className="group flex items-center justify-between py-3.5 transition-all duration-150 cursor-pointer first:pt-0 last:pb-0 hover:bg-app-accent/[0.02] px-2 -mx-2 rounded-xl"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFarmChecklistItem(item.key);
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-bg border border-app-border text-app-text-secondary/40 hover:text-app-accent hover:border-app-accent hover:bg-app-accent/5 focus-visible:ring-2 focus-visible:ring-app-accent transition-all active:scale-95 cursor-pointer"
                    aria-label={`Toggle check for ${item.title}`}
                  >
                    {item.checked ? (
                      <svg className="h-6 w-6 text-app-success animate-[checkmark-in_0.2s_ease-out]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6 text-app-text-secondary/30 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    )}
                  </button>

                  <div className="min-w-0">
                    <p className={`font-extrabold text-sm font-hanken tracking-tight leading-snug transition-colors group-hover:text-app-accent ${
                      item.checked ? 'line-through text-app-text-secondary/70' : 'text-app-text'
                    }`}>
                      {item.title}
                    </p>
                    <p className={`mt-0.5 text-[11px] font-black font-inter leading-tight ${
                      item.checked 
                        ? 'text-app-success' 
                        : item.key === 'warnings' && dangerCount > 0
                          ? 'text-app-danger'
                          : item.key === 'feedStock' && daysOfFeedRemaining !== null && daysOfFeedRemaining < 3
                            ? 'text-app-danger'
                            : item.key === 'feedStock' && daysOfFeedRemaining !== null && daysOfFeedRemaining < 7
                              ? 'text-app-warning'
                              : ['mortality', 'feed', 'weight', 'assignments', 'dailyLog'].includes(item.key) && !item.checked
                                ? 'text-app-warning'
                                : 'text-app-text-secondary'
                    }`}>
                      {item.statusLabel}
                    </p>
                    <p className="mt-1 text-xs text-app-text-secondary leading-snug font-inter truncate sm:whitespace-normal">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider font-inter border ${
                    item.checked
                      ? isAuto
                        ? 'bg-app-success-bg/40 text-app-success border-app-success/20'
                        : 'bg-app-accent/10 text-app-accent border-app-accent/20'
                      : 'bg-app-bg text-app-text-secondary/60 border-app-border'
                  }`}>
                    {item.checked ? (isAuto ? 'Auto-done' : 'Done') : 'Pending'}
                  </span>

                  {item.actionScreen && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.actionScreen === 'warnings') {
                          setMobileTab('warnings');
                        } else {
                          setActiveScreen(item.actionScreen);
                        }
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-app-border bg-app-card px-3 text-xs font-black text-app-text-secondary hover:text-app-accent hover:border-app-accent active:scale-[0.98] transition-all shadow-sm cursor-pointer font-inter whitespace-nowrap"
                    >
                      {item.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!activeBatch) {
    const emptyBatchTitle = token ? 'Batch data unavailable' : 'No current batch available';
    const emptyBatchMessage = token
      ? 'Today cannot check operations until the batch list loads. Try refreshing after the connection recovers or open Batches.'
      : 'The current public batch is unavailable right now. Try again after the connection recovers.';

    return (
      <div className="app-page text-app-text">
        <div className="mb-5 mt-2">
          <p className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-jetbrains">Operations</p>
          <h2 className="text-3xl font-extrabold text-app-accent tracking-tight mt-1 font-hanken">Today</h2>
        </div>

        <div className="rounded-2xl border border-app-border bg-app-card p-5 shadow-sm">
          <p className="text-lg font-black font-hanken">{emptyBatchTitle}</p>
          <p className="text-sm text-app-text-secondary mt-2 font-inter">
            {emptyBatchMessage}
          </p>
          {token && (
            <button
              type="button"
              onClick={() => setActiveScreen('batches')}
              className="mt-4 w-full rounded-xl bg-app-accent p-3 font-bold text-app-on-accent shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
            >
              Open Batches
            </button>
          )}
        </div>
      </div>
    );
  }

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

    const arrivalEta = getArrivalEtaStatus(daysUntilArrival, formatDate(activeBatch.startDate));
    const countdownText = arrivalEta.statusText;
    const countdownSubtext = arrivalEta.detailText;

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
          <p className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-inter">Operations</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold text-app-accent tracking-tight font-hanken">Pre-Arrival Prep</h2>
              <p className="text-sm text-app-text-secondary mt-1 font-inter">
                Batch {activeBatch.id} • Status: {activeBatch.status || 'ON THE WAY'}
              </p>
            </div>
            
            {/* ETA Badge */}
            <div className="rounded-xl border border-app-border bg-app-card px-4 py-2 flex items-center gap-3 shadow-sm min-w-60">
              <svg className="h-6 w-6 text-app-accent shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Arrival ETA</p>
                <p className="text-sm font-black font-jetbrains text-app-accent">
                  {countdownText}
                </p>
                <p className="text-[10px] font-bold text-app-text-secondary font-inter">
                  {countdownSubtext}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Tabs Navigation */}
        <div className="flex border-b border-app-border mb-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileTab('overview')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all duration-200 active:scale-[0.98] ${
              mobileTab === 'overview' ? 'border-app-accent text-app-accent font-black' : 'border-transparent text-app-text-secondary'
            }`}
          >
            Batches
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('checklist')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all duration-200 active:scale-[0.98] ${
              mobileTab === 'checklist' ? 'border-app-accent text-app-accent font-black' : 'border-transparent text-app-text-secondary'
            }`}
          >
            Checklist
          </button>
          {token && (
            <button
              type="button"
              onClick={() => setMobileTab('actions')}
              className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all duration-200 active:scale-[0.98] ${
                mobileTab === 'actions' ? 'border-app-accent text-app-accent font-black' : 'border-transparent text-app-text-secondary'
              }`}
            >
              Actions
            </button>
          )}
        </div>

        {/* Batches Tab Content */}
        <div className={`md:block ${mobileTab === 'overview' ? 'block' : 'hidden'}`}>
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
                <div className="flex justify-between text-xs font-bold font-inter">
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
              label="Mortality Allowance"
              value={formatNumber(activeBatch.mortalityAllowance || 0)}
              detail="Allowed heads before alert"
            />
            <SummaryMetric
              label="Target Feed Requirement"
              value={activeBatch.targetFeedKg ? `${formatNumber(activeBatch.targetFeedKg)} kg` : '--'}
              detail="Expected starter feed"
            />
            <div className={`rounded-xl border p-4 shadow-sm transition-colors ${readinessToneClass}`}>
              <p className="text-[10px] font-black uppercase tracking-wider opacity-85 font-inter">Readiness Status</p>
              <p className="mt-1 text-2xl font-black font-jetbrains">{percentComplete}%</p>
              <p className="mt-2 text-xs font-bold leading-snug opacity-90 font-inter">
                {percentComplete === 100 
                  ? 'All systems go! Houses prepped.' 
                  : `${checklistItems.length - checkedCount} tasks remaining before chicks arrive.`}
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Checklist Cards */}
        <section className={`mt-6 md:block ${mobileTab === 'checklist' ? 'block' : 'hidden'}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Pre-Arrival Checklist</h3>
            <span className="text-[10px] font-bold text-app-text-secondary font-inter">
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
                  onClick={() => token && togglePrepItem(item.key)}
                  disabled={!token}
                  className={`group relative flex flex-col justify-between rounded-xl border p-5 text-left shadow-sm transition-all duration-200 ${
                    !token
                      ? 'cursor-not-allowed opacity-80'
                      : 'transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                  } ${
                    isChecked
                      ? 'border-app-success bg-app-success-bg/20 text-app-text'
                      : 'border-app-border bg-app-card text-app-text'
                  } ${
                    token && !isChecked ? 'hover:border-app-accent' : ''
                  }`}
                >
                  <div className="w-full flex items-start justify-between gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isChecked ? 'bg-app-success-bg text-app-success' : 'bg-app-bg text-app-text-secondary transition-colors'
                    } ${token && !isChecked ? 'group-hover:text-app-accent group-hover:bg-app-accent/5' : ''}`}>
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
                        <svg className={`h-6 w-6 text-app-text-secondary/30 transition-colors ${token ? 'group-hover:text-app-accent/60' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className={`font-extrabold text-sm font-hanken tracking-tight leading-tight transition-colors ${token ? 'group-hover:text-app-accent' : ''}`}>
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
        {token && (
          <section className={`mt-6 md:block ${mobileTab === 'actions' ? 'block' : 'hidden'}`}>
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
        )}
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
          <p className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-inter">Operations</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold text-app-accent tracking-tight font-hanken">Post Summary</h2>
              <p className="mt-1 text-sm text-app-text-secondary font-inter">
                Batch {activeBatch.id} - {postSummary.status || 'Closed'} - {formatDate(postSummary.summaryDate)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-72">
              <button
                type="button"
                onClick={() => setActiveScreen('dailyLog')}
                className="rounded-xl bg-app-accent px-3 py-3 text-xs font-black text-app-on-accent shadow-sm active:scale-[0.98] hover:opacity-90 transition-all duration-200 cursor-pointer font-inter"
              >
                Open Logs
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('analytics')}
                className="rounded-xl border border-app-border bg-app-card px-3 py-3 text-xs font-black text-app-text-secondary shadow-sm active:scale-[0.98] hover:text-app-text transition-all duration-200 cursor-pointer font-inter"
              >
                Open Reports
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-app-danger/30 bg-app-danger-bg p-3 text-sm font-bold text-app-danger">
            {error}
          </div>
        )}

        {/* Mobile Tabs Navigation */}
        <div className="flex border-b border-app-border mb-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileTab('overview')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all duration-200 active:scale-[0.98] ${
              mobileTab === 'overview' ? 'border-app-accent text-app-accent font-black' : 'border-transparent text-app-text-secondary'
            }`}
          >
            Reports
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('buildings')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all duration-200 active:scale-[0.98] ${
              mobileTab === 'buildings' ? 'border-app-accent text-app-accent font-black' : 'border-transparent text-app-text-secondary'
            }`}
          >
            Buildings
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('checks')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all duration-200 active:scale-[0.98] ${
              mobileTab === 'checks' ? 'border-app-accent text-app-accent font-black' : 'border-transparent text-app-text-secondary'
            }`}
          >
            Checks
          </button>
        </div>

        {/* Reports Tab Content */}
        <div className={`space-y-6 md:block ${mobileTab === 'overview' ? 'block' : 'hidden'}`}>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <SummaryMetric
              label="Loaded"
              value={formatNumber(postSummary.loadedBirds)}
              detail={`${postSummary.buildingSummaries.length} building${postSummary.buildingSummaries.length === 1 ? '' : 's'}`}
              isLoading={isLoading}
            />
            <SummaryMetric
              label="Est. live"
              value={formatNumber(postSummary.estimatedLiveBirds)}
              detail={`${formatPercent(postSummary.survivalRate)} survival`}
              tone={postSummary.survivalRate !== null && postSummary.survivalRate < 95 ? 'warning' : 'success'}
              isLoading={isLoading}
            />
            <SummaryMetric
              label="Mortality"
              value={formatNumber(postSummary.mortality)}
              detail={`${formatPercent(postSummary.mortalityRate)} of loaded birds`}
              tone={mortalityTone}
              isLoading={isLoading}
            />
            <SummaryMetric
              label="Total feed"
              value={`${formatNumber(postSummary.totalFeedBags, 2)} sx`}
              detail={`${formatNumber(postSummary.totalFeedKg, 0)} kg consumed`}
              isLoading={isLoading}
            />
            <SummaryMetric
              label="Avg weight"
              value={postSummary.averageWeightGrams ? `${formatNumber(postSummary.averageWeightGrams / 1000, 2)} kg` : '--'}
              detail={postSummary.latestWeightDate ? `Latest ${formatDate(postSummary.latestWeightDate)}` : 'No weight logs'}
              isLoading={isLoading}
            />
            <SummaryMetric
              label="FCR"
              value={postSummary.actualFcr === null ? '--' : formatNumber(postSummary.actualFcr, 2)}
              detail={postSummary.targetFcr === null ? 'Needs weight logs' : `Target ${formatNumber(postSummary.targetFcr, 2)}`}
              tone={fcrTone}
              infoTerm="fcr"
              setActiveTooltip={setActiveTooltip}
              isLoading={isLoading}
            />
          </div>

          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Harvest Yield</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary font-inter">
                {postSummary.harvest.hasActualSales ? postSummary.harvest.status || 'Recorded' : 'Awaiting actuals'}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <SummaryMetric
                label="Actual sold"
                value={postSummary.harvest.soldBirds === null ? '--' : formatNumber(postSummary.harvest.soldBirds)}
                detail={`Est. live ${formatNumber(postSummary.estimatedLiveBirds)}`}
                tone={postSummary.harvest.hasActualSales ? 'success' : 'neutral'}
                isLoading={isLoading}
              />
              <SummaryMetric
                label="Actual kilos"
                value={postSummary.harvest.kilos === null ? '--' : `${formatNumber(postSummary.harvest.kilos, 1)} kg`}
                detail={postSummary.harvest.averageWeightKg ? `${formatNumber(postSummary.harvest.averageWeightKg, 2)} kg average` : 'No sold kilos recorded'}
                tone={postSummary.harvest.hasActualSales ? 'success' : 'neutral'}
                isLoading={isLoading}
              />
              <SummaryMetric
                label="Harvest yield"
                value={formatPercent(postSummary.harvest.yieldRate)}
                detail={postSummary.harvest.estimatedVsSoldGap === null ? 'Waiting for sold birds' : `${formatNumber(postSummary.harvest.estimatedVsSoldGap)} est. vs sold gap`}
                tone={postSummary.harvest.hasActualSales ? 'success' : 'neutral'}
                isLoading={isLoading}
              />
              <SummaryMetric
                label="Actual FCR"
                value={postSummary.harvest.fcr === null ? '--' : formatNumber(postSummary.harvest.fcr, 2)}
                detail={postSummary.harvest.fcr === null ? 'Needs sold kilos' : 'Feed kg divided by sold kg'}
                tone={harvestFcrTone}
                infoTerm="fcr"
                setActiveTooltip={setActiveTooltip}
                isLoading={isLoading}
              />
            </div>

            {harvestRows.length > 0 && !isLoading && (
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
                        <td className="px-4 py-3 text-right font-bold text-app-text-secondary font-inter">
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
        </div>

        {/* Building Closeout Section */}
        <section className={`mt-6 md:block ${mobileTab === 'buildings' ? 'block' : 'hidden'}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Building Closeout</h3>
            <span className="text-[10px] font-bold text-app-text-secondary font-inter">
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
                  <th className="px-4 py-3 text-right">FCR <InfoButton term="fcr" setActiveTooltip={setActiveTooltip} /></th>
                  <th className="px-4 py-3 text-right">Last log</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-4 py-3"><div className="h-4 w-24 bg-app-border/40 rounded"></div></td>
                      <td className="px-4 py-3 text-right"><div className="h-4 w-12 bg-app-border/40 rounded ml-auto"></div></td>
                      <td className="px-4 py-3 text-right"><div className="h-4 w-12 bg-app-border/40 rounded ml-auto"></div></td>
                      <td className="px-4 py-3 text-right"><div className="h-4 w-12 bg-app-border/40 rounded ml-auto"></div></td>
                      <td className="px-4 py-3 text-right"><div className="h-4 w-16 bg-app-border/40 rounded ml-auto"></div></td>
                      <td className="px-4 py-3 text-right"><div className="h-4 w-12 bg-app-border/40 rounded ml-auto"></div></td>
                      <td className="px-4 py-3 text-right"><div className="h-4 w-12 bg-app-border/40 rounded ml-auto"></div></td>
                      <td className="px-4 py-3 text-right"><div className="h-4 w-20 bg-app-border/40 rounded ml-auto"></div></td>
                    </tr>
                  ))
                ) : (
                  postSummary.buildingSummaries.map((summary) => (
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
                        <p className="text-xs font-bold text-app-text-secondary font-inter">{formatPercent(summary.mortalityRate)}</p>
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
                      <td className="px-4 py-3 text-right font-bold text-app-text-secondary font-inter">
                        {formatDate(summary.latestLogDate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {!postSummary.buildingSummaries.length && !isLoading && (
              <div className="p-5 text-center">
                <p className="text-sm font-bold text-app-text-secondary font-inter">No building loadings found for this batch.</p>
              </div>
            )}
          </div>
        </section>

        {/* Closeout Checks Section */}
        <section className={`mt-6 md:block ${mobileTab === 'checks' ? 'block' : 'hidden'}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Closeout Checks</h3>
            <span className="text-[10px] font-bold text-app-text-secondary font-inter">
              Day {postSummary.summaryAgeDay || '--'} <InfoButton term="age" setActiveTooltip={setActiveTooltip} />
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="rounded-xl border border-app-border bg-app-card p-4 shadow-sm animate-pulse">
                  <div className="h-3 w-1/2 bg-app-border/40 rounded"></div>
                  <div className="h-6 w-1/3 bg-app-border/50 rounded mt-2"></div>
                  <div className="h-3 w-3/4 bg-app-border/30 rounded mt-3"></div>
                </div>
              ))
            ) : (
              postChecklist.map((item) => {
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
                    <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">{item.label}</p>
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
              })
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-page text-app-text">
      <div className="mb-5 mt-2">
        <p className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-inter">Operations</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold text-app-accent tracking-tight font-hanken">Today</h2>
            <p className="text-sm text-app-text-secondary mt-1 font-inter">
              Batch {activeBatch.id} - {formatDate(today)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-72">
            <div className="rounded-xl border border-app-border bg-app-card px-3 py-2 text-right shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Age <InfoButton term="age" setActiveTooltip={setActiveTooltip} /></p>
              <p className={`text-xl font-black font-jetbrains ${ageDay > lastTargetDay ? 'text-app-warning' : 'text-app-accent'}`}>
                D{ageDay || '--'}
              </p>
            </div>
            <div className="rounded-xl border border-app-border bg-app-card px-3 py-2 text-right shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Harvest</p>
              <p className={`text-xl font-black font-jetbrains ${daysToHarvest !== null && daysToHarvest <= HARVEST_SOON_DAYS ? 'text-app-warning' : 'text-app-text'}`}>
                {daysToHarvest === null ? '--' : daysToHarvest < 0 ? `${Math.abs(daysToHarvest)}d late` : `${daysToHarvest}d`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <OfflineStaleBanner data={[loadings, assignments, feedItems]} />

      {error && (
        <div className="mb-5 rounded-xl border border-app-danger/30 bg-app-danger-bg p-3 text-sm font-bold text-app-danger">
          {error}
        </div>
      )}

      {/* Mobile Tabs Navigation */}
      <div className="flex border-b border-app-border mb-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('overview')}
          className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all duration-200 active:scale-[0.98] ${
            mobileTab === 'overview' ? 'border-app-accent text-app-accent font-black' : 'border-transparent text-app-text-secondary'
          }`}
        >
          Daily Logs
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('checklist')}
          className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all duration-200 active:scale-[0.98] ${
            mobileTab === 'checklist' ? 'border-app-accent text-app-accent font-black' : 'border-transparent text-app-text-secondary'
          }`}
        >
          Checklist
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('warnings')}
          className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all duration-200 active:scale-[0.98] relative ${
            mobileTab === 'warnings' ? 'border-app-accent text-app-accent font-black' : 'border-transparent text-app-text-secondary'
          }`}
        >
          Warnings
          {abnormalWarnings.length > 0 && (
            <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-app-danger animate-pulse" />
          )}
        </button>
      </div>

      <div className={mobileTab === 'overview' ? 'block' : 'hidden md:block'}>
        {showDayOneHandoff && renderDayOneHandoff()}
        {renderFarmChecklist()}
      </div>

      <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-5 md:grid ${mobileTab === 'overview' ? 'grid' : 'hidden'}`}>
        <AttentionCard
          label="Buildings without log"
          value={missingLogCount}
          detail={missingLogCount ? 'Open daily logs and complete these buildings.' : 'Every loaded building has a log today.'}
          tone={missingLogCount ? 'danger' : 'success'}
          onClick={() => setActiveScreen('dailyLog')}
          isLoading={isLoading}
        />
        <AttentionCard
          label="Feed below reorder"
          value={lowFeedItems.length}
          detail={lowFeedItems.length ? 'Review feed purchases or stock transfers.' : 'Feed items are above reorder level.'}
          tone={lowFeedItems.length ? 'warning' : 'success'}
          onClick={() => setActiveScreen('inventory')}
          isLoading={isLoading}
        />
        <AttentionCard
          label={mortalityAllowance > 0 ? 'Allowance used' : 'Mortality limit used'}
          value={`${formatNumber(totalMortalityToDate)} / ${formatNumber(mortalityAllowanceLimit)}`}
          detail={mortalityAllowanceRemaining > 0
            ? `${formatNumber(mortalityAllowanceRemaining)} heads remaining before alert.`
            : 'Allowance has been exceeded.'}
          tone={mortalityAllowanceTone}
          onClick={() => setMobileTab('warnings')}
          isLoading={isLoading}
        />
        <AttentionCard
          label="Abnormal warnings"
          value={abnormalWarnings.length}
          detail={dangerCount ? `${dangerCount} need urgent review.` : 'No urgent abnormal value detected.'}
          tone={dangerCount ? 'danger' : abnormalWarnings.length ? 'warning' : 'success'}
          onClick={() => setActiveScreen('dailyLog')}
          isLoading={isLoading}
        />
        <AttentionCard
          label="Unassigned buildings"
          value={noEmployeeCount}
          detail={noEmployeeCount ? 'Assign employee shares before logging.' : 'Loaded buildings have employees assigned.'}
          tone={noEmployeeCount ? 'danger' : 'success'}
          onClick={() => setActiveScreen('employees')}
          isLoading={isLoading}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className={`md:block ${mobileTab === 'checklist' ? 'block' : 'hidden'}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Building Checklist</h3>
            <span className="text-[10px] font-bold text-app-text-secondary font-inter">
              {isLoading ? 'Loading...' : `${todayLogs.length} log${todayLogs.length === 1 ? '' : 's'} today`}
            </span>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="rounded-xl border border-app-border bg-app-card p-4 shadow-sm animate-pulse">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 bg-app-border/40 rounded-full"></div>
                      <div>
                        <div className="h-4 w-24 bg-app-border/40 rounded"></div>
                        <div className="h-3 w-32 bg-app-border/30 rounded mt-2"></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-right">
                      <div className="h-6 w-12 bg-app-border/40 rounded ml-auto"></div>
                      <div className="h-6 w-12 bg-app-border/40 rounded ml-auto"></div>
                      <div className="h-6 w-12 bg-app-border/40 rounded ml-auto"></div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <div className="h-5 w-20 bg-app-border/30 rounded-full"></div>
                    <div className="h-5 w-24 bg-app-border/30 rounded-full"></div>
                    <div className="h-5 w-20 bg-app-border/30 rounded-full"></div>
                  </div>
                </div>
              ))
            ) : (
              buildingChecks.map((check) => {
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
                          <p className="text-[10px] font-bold uppercase text-app-text-secondary font-inter">Feed Today</p>
                          <p className="text-sm font-black text-app-text font-jetbrains">{formatNumber(check.todaysTotals.feed, 2)} sx</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-app-text-secondary font-inter">Mortality</p>
                          {(() => {
                            const buildingHandledBirds = check.assignedEmployees.reduce((sum, e) => sum + Number(e.handledBirds || 0), 0) || check.chicksLoaded;
                            const buildingThreshold = Math.max(5, Math.ceil(buildingHandledBirds * 0.005));
                            const mortalityVal = check.todaysTotals.mortality;
                            const mortalityColor = mortalityVal <= buildingThreshold ? 'text-app-success' :
                              mortalityVal <= buildingThreshold * 2 ? 'text-app-warning' : 'text-app-danger';
                            return (
                              <p className={`text-sm font-black font-jetbrains ${mortalityColor}`}>
                                {formatNumber(mortalityVal)}
                              </p>
                            );
                          })()}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-app-text-secondary font-inter">Variance <InfoButton term="feed-variance" setActiveTooltip={setActiveTooltip} /></p>
                          <p className={`text-sm font-black font-jetbrains ${varianceIsHigh ? 'text-app-warning' : 'text-app-text'}`}>
                            {check.variancePercent === null ? '--' : `${check.variancePercent > 0 ? '+' : ''}${formatNumber(check.variancePercent, 1)}%`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider font-inter">
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
              })
            )}

            {!buildingChecks.length && !isLoading && (
              <div className="rounded-xl border border-app-border bg-app-card p-4 text-center shadow-sm">
                <p className="text-sm font-bold text-app-text-secondary font-inter">No building loadings found for this batch.</p>
              </div>
            )}
          </div>
        </section>

        <section className={`md:block ${mobileTab === 'warnings' || mobileTab === 'overview' ? 'block' : 'hidden'}`}>
          <div className={mobileTab === 'warnings' ? 'block' : 'hidden md:block'}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-app-accent font-hanken">Warnings</h3>
              <span className="text-[10px] font-bold text-app-text-secondary font-inter">
                {dangerCount} urgent
              </span>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, idx) => (
                  <div key={idx} className="rounded-xl border border-app-border bg-app-card p-4 shadow-sm animate-pulse">
                    <div className="h-3 w-1/4 bg-app-border/40 rounded"></div>
                    <div className="h-4 w-3/4 bg-app-border/40 rounded mt-2"></div>
                    <div className="h-3 w-full bg-app-border/30 rounded mt-2"></div>
                  </div>
                ))
              ) : (
                abnormalWarnings.map((warning) => (
                  <WarningRow key={warning.key} warning={warning} />
                ))
              )}

              {!abnormalWarnings.length && !isLoading && (
                <div className="rounded-xl border border-app-success/30 bg-app-success-bg p-4 shadow-sm text-app-success">
                  <p className="text-sm font-black">No abnormal values today</p>
                  <p className="mt-1 text-xs font-bold opacity-90 font-inter">
                    Logs, feed stock, employee assignment, age, and harvest checks look clear.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className={`mt-6 rounded-xl border border-app-border bg-app-card p-4 shadow-sm ${mobileTab === 'overview' ? 'block' : 'hidden md:block'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">Today totals</p>
                <p className="mt-1 text-lg font-black text-app-text font-jetbrains">
                  {formatNumber(todayTotals.feed, 2)} sx feed
                </p>
                {(() => {
                  const todayTotalsHandled = todayLogs.reduce((sum, log) => sum + Number(log.handledBirds || 0), 0) || (
                    buildingChecks.reduce((sum, check) => sum + check.chicksLoaded, 0)
                  );
                  const todayTotalsThreshold = Math.max(5, Math.ceil(todayTotalsHandled * 0.005));
                  const todayMortalityColor = todayTotals.mortality <= todayTotalsThreshold ? 'text-app-success' :
                    todayTotals.mortality <= todayTotalsThreshold * 2 ? 'text-app-warning' : 'text-app-danger';
                  return (
                    <p className={`text-sm font-black font-jetbrains ${todayMortalityColor}`}>
                      {formatNumber(todayTotals.mortality)} mortality
                    </p>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => setActiveScreen('dailyLog')}
                className="rounded-xl bg-app-accent px-3 py-2 text-xs font-black text-app-on-accent shadow-sm active:scale-[0.98] hover:opacity-90 transition-all duration-200 cursor-pointer font-inter"
              >
                Open Logs
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-app-bg p-3">
                <p className="font-bold uppercase text-app-text-secondary font-inter">
                  {mortalityAllowance > 0 ? 'Allowance used' : 'Mortality limit'}
                </p>
                <p className={`mt-1 font-black font-jetbrains ${
                  mortalityAllowanceTone === 'success'
                    ? 'text-app-success'
                    : mortalityAllowanceTone === 'warning'
                      ? 'text-app-warning'
                      : 'text-app-danger'
                }`}>
                  {formatNumber(totalMortalityToDate)} / {formatNumber(mortalityAllowanceLimit)}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-app-border/40">
                  <div
                    className={`h-full rounded-full ${
                      mortalityAllowanceTone === 'success'
                        ? 'bg-app-success'
                        : mortalityAllowanceTone === 'warning'
                          ? 'bg-app-warning'
                          : 'bg-app-danger'
                    }`}
                    style={{ width: `${mortalityAllowanceUsedPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] font-bold text-app-text-secondary">
                  {mortalityAllowanceRemaining > 0 ? `${formatNumber(mortalityAllowanceRemaining)} heads remaining` : 'Allowance exceeded'}
                </p>
              </div>
              <div className="rounded-lg bg-app-bg p-3">
                <p className="font-bold uppercase text-app-text-secondary font-inter">Days of Feed Remaining <InfoButton term="feed-variance" setActiveTooltip={setActiveTooltip} /></p>
                <p className={`mt-1 font-black font-jetbrains ${
                  daysOfFeedRemaining === null ? 'text-app-text-secondary' :
                  daysOfFeedRemaining >= 7 ? 'text-app-success' :
                  daysOfFeedRemaining >= 3 ? 'text-app-warning' : 'text-app-danger'
                }`}>
                  {daysOfFeedRemaining === null ? '--' : `${formatNumber(daysOfFeedRemaining, 1)} day${daysOfFeedRemaining === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="rounded-lg bg-app-bg p-3">
                <p className="font-bold uppercase text-app-text-secondary font-inter">Harvest target</p>
                <p className="mt-1 font-black text-app-text font-jetbrains">{formatDate(activeBatch.targetHarvestDate)}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
      {renderTooltipModal()}
    </div>
  );
}
