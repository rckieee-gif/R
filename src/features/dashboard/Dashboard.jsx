import { useState, useEffect } from 'react';
import {
  BAG_WEIGHT_KG,
  calculateTargetFeedForHeads,
  getAgeDay
} from '../../shared/utils/broilerTargets';
import WeatherForecast from './components/WeatherForecast';
import { hasMinimumRole } from '../../shared/utils/roles';
import { openDatabase, removeFromQueue, updateQueueStatus, getQueue } from '../../offline/db';
import { processSyncQueue } from '../../offline/syncQueue';
import { apiClient } from '../../shared/utils/apiClient';
import OfflineStaleBanner from '../../shared/components/OfflineStaleBanner';

async function updateQueuePayload(id, nextPayload) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.payload = nextPayload;
        item.status = 'pending';
        item.error = null;
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

function todayInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return '--';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatLedgerMoney(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '₱0.00';
  return `₱${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function getQueueItemLabel(item) {
  const p = item.payload || {};
  switch (item.type) {
    case 'CREATE_DAILY_LOG':
    case 'UPDATE_DAILY_LOG':
      return `Daily log for Building ${p.building || '?'}`;
    case 'SAVE_INVENTORY_ITEM':
      return `Inventory item: ${p.name || '?'}`;
    case 'SAVE_INVENTORY_MOVEMENT':
      return `Feed movement: ${p.feedName || p.itemName || 'Feed'} ${p.bags || p.quantity || 0} sacks`;
    case 'SAVE_TRANSACTION':
      return `${p.type || 'Transaction'}: ${p.description || p.category || 'Record'} ${formatLedgerMoney(p.amount || p.totalPrice)}`;
    case 'VOID_TRANSACTION':
      return `Void transaction #${p.transactionId || '?'}`;
    case 'SAVE_HARVEST_REPORT':
      return `Harvest report: Batch #${p.batchId || '?'}`;
    case 'SAVE_EMPLOYEE':
      return `Employee record: ${p.name || '?'}`;
    default:
      return `${item.type.replace(/_/g, ' ').toLowerCase()}`;
  }
}

function ActionButton({ label, detail, onClick, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 rounded-xl border text-left shadow-sm active:scale-[0.98] transition-all flex flex-col justify-between min-h-[95px] cursor-pointer ${
        primary
          ? 'bg-dashboard-accent text-dashboard-on-accent border-dashboard-accent hover:opacity-90'
          : 'bg-dashboard-card hover:bg-dashboard-bg text-dashboard-text border-dashboard-border'
      }`}
    >
      <div>
        <span className={`block text-[9px] font-bold uppercase tracking-widest font-jetbrains ${primary ? 'text-dashboard-on-accent/80' : 'text-dashboard-text-secondary'}`}>
          Action
        </span>
        <span className="block text-base font-extrabold font-hanken mt-0.5">
          {label}
        </span>
      </div>
      <span className={`block text-[10px] mt-2 font-inter leading-tight ${primary ? 'text-dashboard-on-accent/75' : 'text-dashboard-text-secondary'}`}>
        {detail}
      </span>
    </button>
  );
}

export default function Dashboard({ setActiveScreen, logs = [], activeBatch, user }) {
  const today = todayInput();
  const currentAgeDays = activeBatch?.startDate ? getAgeDay(activeBatch.startDate, today) : null;
  const actualLoaded = Number(activeBatch?.totalChicksLoaded || 0);
  const plannedFlock = Number(activeBatch?.plannedFlock || 0);
  const totalMortality = logs.reduce((sum, log) => sum + Number(log.mortality || 0), 0);
  const liveBirds = Math.max(actualLoaded - totalMortality, 0);
  const mortalityPercent = actualLoaded > 0 ? (totalMortality / actualLoaded) * 100 : 0;
  const configuredMortalityAllowance = Number(activeBatch?.mortalityAllowance || 0);
  const batchThreshold = configuredMortalityAllowance > 0
    ? configuredMortalityAllowance
    : Math.max(5, Math.ceil(actualLoaded * 0.005));
  const mortalityTone = totalMortality <= batchThreshold ? 'text-dashboard-success' :
    totalMortality <= batchThreshold * 2 ? 'text-dashboard-warning' : 'text-dashboard-danger';
  const yieldVsPlanPercent = plannedFlock > 0 ? (liveBirds / plannedFlock) * 100 : null;
  const totalFeedBags = logs.reduce((sum, log) => sum + Number(log.feed || 0), 0);
  const totalFeedKg = totalFeedBags * BAG_WEIGHT_KG;

  const feedTarget = calculateTargetFeedForHeads(actualLoaded, currentAgeDays);

  const varianceKg = feedTarget ? totalFeedKg - feedTarget.targetKg : null;
  const variancePercent = feedTarget?.targetKg ? (varianceKg / feedTarget.targetKg) * 100 : null;
  const todaysLogs = logs.filter((log) => log.date === today);
  
  const canEnterDaily = hasMinimumRole(user?.role, 'DataEntry');
  const canUseFinancialScreens = hasMinimumRole(user?.role, 'OperationManager');

  // Dashboard API Telemetry and Offline states
  const [feedItems, setFeedItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadings, setLoadings] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  
  // JSON payload editor states
  const [editingItem, setEditingItem] = useState(null);
  const [editPayloadStr, setEditPayloadStr] = useState('');
  const [editError, setEditError] = useState('');

  // Consolidated async data loading effect
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (!activeBatch?.id) return;
      try {
        const [feedData, transData, loadData, queueData] = await Promise.all([
          apiClient.get('/api/inventory/items?category=Feed', { expectArray: true }).catch(() => []),
          apiClient.get(`/api/batches/${activeBatch.id}/transactions`, { expectArray: true }).catch(() => []),
          apiClient.get(`/api/batches/${activeBatch.id}/loadings`, { expectArray: true }).catch(() => []),
          getQueue().catch(() => [])
        ]);
        if (!active) return;
        setFeedItems(feedData);
        setTransactions(transData);
        setLoadings(loadData);
        setQueueItems(queueData);
      } catch (err) {
        console.error('Failed to load dashboard active batch telemetry:', err);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [activeBatch?.id]);

  // Sync Queue status change event listener
  useEffect(() => {
    let active = true;
    const handleSyncChange = async () => {
      try {
        const [queueData, feedData, transData] = await Promise.all([
          getQueue().catch(() => []),
          apiClient.get('/api/inventory/items?category=Feed', { expectArray: true }).catch(() => []),
          activeBatch?.id 
            ? apiClient.get(`/api/batches/${activeBatch.id}/transactions`, { expectArray: true }).catch(() => [])
            : Promise.resolve([])
        ]);
        if (!active) return;
        setQueueItems(queueData);
        setFeedItems(feedData);
        setTransactions(transData);
      } catch (err) {
        console.warn('Failed to update telemetry on sync change:', err);
      }
    };
    window.addEventListener('sync-status-changed', handleSyncChange);
    return () => {
      active = false;
      window.removeEventListener('sync-status-changed', handleSyncChange);
    };
  }, [activeBatch?.id]);

  // Sync Queue handlers
  const handleRetryQueueItem = async (id) => {
    try {
      await updateQueueStatus(id, 'pending');
      window.dispatchEvent(new CustomEvent('sync-status-changed'));
      await processSyncQueue(apiClient);
    } catch (err) {
      console.error('Failed to retry sync queue item:', err);
    }
  };

  const handleDiscardQueueItem = async (id) => {
    try {
      await removeFromQueue(id);
      window.dispatchEvent(new CustomEvent('sync-status-changed'));
    } catch (err) {
      console.error('Failed to discard sync queue item:', err);
    }
  };

  const handleEditClick = (item) => {
    setEditingItem(item);
    setEditPayloadStr(JSON.stringify(item.payload, null, 2));
    setEditError('');
  };

  const handleSaveEdit = async () => {
    try {
      const parsed = JSON.parse(editPayloadStr);
      await updateQueuePayload(editingItem.id, parsed);
      setEditingItem(null);
      window.dispatchEvent(new CustomEvent('sync-status-changed'));
      await processSyncQueue(apiClient);
    } catch (err) {
      setEditError(err.message || 'Invalid JSON format');
    }
  };

  // 1. Health Score Calculation (inline calculation to keep React Compiler happy)
  let healthScore = 100;
  const healthDeductions = [];

  // A. Mortality Threshold Exceedance
  if (totalMortality > batchThreshold * 2) {
    healthScore -= 30;
    healthDeductions.push({
      label: 'Severe Mortality Exceedance',
      value: '-30 pts',
      detail: `Total mortality is ${formatNumber(totalMortality)} (allowance: ${formatNumber(batchThreshold)})`
    });
  } else if (totalMortality > batchThreshold) {
    healthScore -= 15;
    healthDeductions.push({
      label: 'Mortality Exceeds Guidelines',
      value: '-15 pts',
      detail: `Total mortality is ${formatNumber(totalMortality)} (allowance: ${formatNumber(batchThreshold)})`
    });
  }

  // B. Mortality Rate above 1%
  if (mortalityPercent > 1) {
    const excessRate = mortalityPercent - 1;
    const rateDeduction = Math.min(20, Number((excessRate * 5).toFixed(1)));
    if (rateDeduction > 0) {
      healthScore -= rateDeduction;
      healthDeductions.push({
        label: 'Elevated Mortality Rate (>1%)',
        value: `-${rateDeduction} pts`,
        detail: `Current rate: ${formatNumber(mortalityPercent, 2)}%`
      });
    }
  }

  // C. Feed Stock Level
  const totalFeedStock = feedItems.reduce((sum, item) => sum + Number(item.currentStock || 0), 0);
  const daysOfFeedRemaining = (!feedTarget || feedTarget.targetBags <= 0)
    ? null
    : totalFeedStock / feedTarget.targetBags;

  if (daysOfFeedRemaining !== null) {
    if (daysOfFeedRemaining < 3) {
      healthScore -= 25;
      healthDeductions.push({
        label: 'Critical Feed Stock',
        value: '-25 pts',
        detail: `${formatNumber(daysOfFeedRemaining, 1)} days of feed remaining`
      });
    } else if (daysOfFeedRemaining < 7) {
      healthScore -= 10;
      healthDeductions.push({
        label: 'Low Feed Stock',
        value: '-10 pts',
        detail: `${formatNumber(daysOfFeedRemaining, 1)} days of feed remaining`
      });
    }
  }

  // D. Feed Variance
  if (variancePercent !== null) {
    const absVar = Math.abs(variancePercent);
    if (absVar >= 25) {
      healthScore -= 20;
      healthDeductions.push({
        label: 'High Feed Variance',
        value: '-20 pts',
        detail: `${variancePercent > 0 ? '+' : ''}${formatNumber(variancePercent, 1)}% vs target`
      });
    } else if (absVar >= 15) {
      healthScore -= 10;
      healthDeductions.push({
        label: 'Moderate Feed Variance',
        value: '-10 pts',
        detail: `${variancePercent > 0 ? '+' : ''}${formatNumber(variancePercent, 1)}% vs target`
      });
    }
  }

  // E. Missing daily logs today
  const activeLoadings = loadings.filter(l => Number(l.chicksLoaded || 0) > 0);
  const missingLogsBuildings = activeLoadings.filter(l => {
    const bKey = String(l.building || '').trim().toUpperCase();
    return !todaysLogs.some(log => String(log.building || '').trim().toUpperCase() === bKey);
  });

  if (missingLogsBuildings.length > 0) {
    const logsDeduction = Math.min(30, missingLogsBuildings.length * 10);
    healthDeductions.push({
      label: 'Missing Daily Logs Today',
      value: `-${logsDeduction} pts`,
      detail: `No logs for building(s): ${missingLogsBuildings.map(l => l.building).join(', ')}`
    });
    healthScore -= logsDeduction;
  }

  healthScore = Math.max(0, Math.round(healthScore));

  // Score details mapping
  const getScoreColorInfo = (score) => {
    if (score >= 90) {
      return {
        bg: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
        text: 'text-emerald-500 dark:text-emerald-400',
        circleColor: 'var(--color-app-success)',
        title: 'Is the farm okay today?',
        status: 'YES, THE FARM IS DOING GREAT TODAY!',
        description: 'All key performance indicators are within safe thresholds. Flock mortality and feed curves align with targets.',
        tone: 'text-dashboard-success'
      };
    } else if (score >= 75) {
      return {
        bg: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
        text: 'text-amber-500 dark:text-amber-400',
        circleColor: 'var(--color-app-warning)',
        title: 'Is the farm okay today?',
        status: 'THE FARM IS MOSTLY OKAY, BUT NEEDS SOME ATTENTION',
        description: 'Minor warnings or logs are missing. Review the warnings and sync status below to restore optimal status.',
        tone: 'text-dashboard-warning'
      };
    } else {
      return {
        bg: 'from-red-500/20 to-rose-500/20 border-red-500/30',
        text: 'text-red-500 dark:text-red-400',
        circleColor: 'var(--color-app-danger)',
        title: 'Is the farm okay today?',
        status: 'CRITICAL ISSUES REQUIRING IMMEDIATE ACTION!',
        description: 'Flock mortality exceeds safe thresholds, feed levels are critically low, or logs have not been submitted. Resolve these issues immediately.',
        tone: 'text-dashboard-danger'
      };
    }
  };

  const colorInfo = getScoreColorInfo(healthScore);
  const strokeWidth = 8;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  // 2. Warnings List
  const warningsList = [];
  if (missingLogsBuildings.length > 0) {
    warningsList.push({
      type: 'missing_log',
      severity: 'warning',
      icon: 'pending_actions',
      text: `Missing daily log for today: Building(s) ${missingLogsBuildings.map(l => l.building).join(', ')}`
    });
  }

  // High Mortality
  if (totalMortality > batchThreshold) {
    warningsList.push({
      type: 'high_mortality',
      severity: 'danger',
      icon: 'warning',
      text: `High cumulative mortality: ${formatNumber(totalMortality)} birds lost (${formatNumber(mortalityPercent, 2)}% rate)`
    });
  }

  // Low Feed Stock
  if (daysOfFeedRemaining !== null && daysOfFeedRemaining < 7) {
    warningsList.push({
      type: 'low_feed',
      severity: daysOfFeedRemaining < 3 ? 'danger' : 'warning',
      icon: 'inventory_2',
      text: `Low feed stock: ${formatNumber(daysOfFeedRemaining, 1)} day${daysOfFeedRemaining === 1 ? '' : 's'} remaining (${formatNumber(totalFeedStock, 1)} sacks)`
    });
  }

  // Sync Queue Separation
  const pendingQueue = queueItems.filter(item => item.status === 'pending' || item.status === 'syncing');
  const failedQueue = queueItems.filter(item => item.status === 'conflict');

  const getInventoryRiskText = (days) => {
    if (days === null) return 'No Stock Data';
    if (days < 3) return 'Critical Risk';
    if (days < 7) return 'Low Stock Alert';
    return 'Safe Level';
  };
  
  const getInventoryRiskTone = (days) => {
    if (days === null) return 'text-dashboard-text-secondary';
    if (days < 3) return 'text-dashboard-danger';
    if (days < 7) return 'text-dashboard-warning';
    return 'text-dashboard-success';
  };

  // 3. Quick Actions visibility filtering
  const quickActions = [
    {
      label: 'Add Daily Log',
      detail: 'Record daily mortality, feed, and weight',
      screen: 'dailyLog',
      visible: canEnterDaily
    },
    {
      label: 'Add Expense',
      detail: 'Record financial expenses in ledger',
      screen: 'ledger',
      visible: canUseFinancialScreens
    },
    {
      label: 'Add Inventory Movement',
      detail: 'Record stock feed usage or adjustments',
      screen: 'inventory',
      visible: canEnterDaily
    },
    {
      label: 'View Analytics',
      detail: 'Analyze FCR, weight curves and trends',
      screen: 'analytics',
      visible: true
    }
  ].filter(action => action.visible);

  // Recent logs and transactions lists
  const recentLogs = logs.slice(0, 5);
  const recentTransactions = transactions.slice(0, 5);

  if (!activeBatch) {
    return (
      <div className="app-page text-dashboard-text min-h-screen p-6">
        <div className="mb-5 mt-2">
          <p className="text-xs font-bold uppercase tracking-widest text-dashboard-accent font-jetbrains">Octavio Poultry</p>
          <h2 className="text-3xl font-bold tracking-tight mt-1 font-hanken">Home</h2>
        </div>

        <div className="bg-dashboard-card border border-dashboard-border rounded-2xl p-6 shadow-lg max-w-md mx-auto mt-10">
          <p className="text-xl font-bold font-hanken">No active batch selected</p>
          <p className="text-sm text-dashboard-text-secondary mt-3 leading-relaxed">
            Create or select an active flock batch before daily logging, performance monitoring, and production telemetry can be accessed here.
          </p>
          <button
            type="button"
            onClick={() => setActiveScreen('batches')}
            className="w-full mt-6 bg-dashboard-accent text-dashboard-on-accent py-3.5 rounded-xl font-extrabold text-base shadow-md active:scale-95 transition-all cursor-pointer hover:opacity-90"
          >
            Open Batches Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page text-dashboard-text p-4 sm:p-6">
      
      {/* Top Banner Info */}
      <div className="mb-6 mt-2">
        <p className="text-xs font-bold uppercase tracking-widest text-dashboard-accent font-jetbrains">Octavio Poultry</p>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div>
            <h2 className="text-3xl font-bold tracking-tight font-hanken">Home Portal</h2>
            <p className="text-xs text-dashboard-text-secondary font-jetbrains mt-1 bg-dashboard-card px-2 py-0.5 rounded border border-dashboard-border inline-block">
              Batch #{activeBatch.id}
            </p>
          </div>
          <div className="text-right bg-dashboard-card border border-dashboard-border rounded-xl px-4 py-2 shadow-sm">
            <p className="text-[9px] font-bold text-dashboard-text-secondary uppercase tracking-widest font-jetbrains">Flock Age</p>
            <p className="text-xl font-black text-dashboard-success font-jetbrains mt-0.5">D{currentAgeDays || '--'}</p>
          </div>
        </div>
      </div>

      <OfflineStaleBanner data={[feedItems, transactions, loadings]} />

      {/* Date and Log Summary row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-dashboard-card border border-dashboard-border text-dashboard-text rounded-xl p-4 shadow-sm">
          <p className="text-[9px] text-dashboard-text-secondary uppercase tracking-widest font-bold font-jetbrains">Started</p>
          <p className="text-sm font-bold mt-1 font-inter">{formatDate(activeBatch.startDate)}</p>
        </div>
        <div className="bg-dashboard-card border border-dashboard-border text-dashboard-text rounded-xl p-4 shadow-sm">
          <p className="text-[9px] text-dashboard-text-secondary uppercase tracking-widest font-bold font-jetbrains">Today</p>
          <p className="text-sm font-bold mt-1 font-inter">{formatDate(today)}</p>
        </div>
        <div className="bg-dashboard-card border border-dashboard-border text-dashboard-text rounded-xl p-4 shadow-sm">
          <p className="text-[9px] text-dashboard-text-secondary uppercase tracking-widest font-bold font-jetbrains">Logs Today</p>
          <p className="text-sm font-bold mt-1 font-jetbrains">{todaysLogs.length}</p>
        </div>
      </div>

      {/* Weather Forecast */}
      <WeatherForecast />

      {/* 1. Farm Health Today */}
      <div className="bg-dashboard-card border border-dashboard-border rounded-2xl p-5 md:p-6 shadow-md mb-6 relative overflow-hidden group">
        <div className={`absolute -right-16 -top-16 w-48 h-48 rounded-full blur-3xl opacity-10 bg-gradient-to-br ${colorInfo.bg}`} />
        
        <h3 className="text-xs font-bold uppercase tracking-widest text-dashboard-text-secondary font-jetbrains mb-4">
          Farm Health Today
        </h3>

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
          {/* Visual Health Score Circle */}
          <div className="relative shrink-0 flex items-center justify-center">
            <svg className="w-24 h-24 transform -rotate-90 select-none">
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="transparent"
                className="text-dashboard-border/30 dark:text-dashboard-border/10"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke={colorInfo.circleColor}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black font-jetbrains tracking-tight leading-none">
                {healthScore}
              </span>
              <span className="text-[8px] font-bold text-dashboard-text-secondary uppercase tracking-wider mt-0.5 leading-none font-jetbrains">
                Score
              </span>
            </div>
          </div>

          {/* Status and description */}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <p className="text-[10px] font-bold text-dashboard-text-secondary uppercase tracking-widest font-jetbrains">
              {colorInfo.title}
            </p>
            <h4 className={`text-base font-extrabold tracking-wide font-hanken uppercase mt-1 ${colorInfo.text}`}>
              {colorInfo.status}
            </h4>
            <p className="text-xs text-dashboard-text-secondary mt-2 leading-relaxed font-inter">
              {colorInfo.description}
            </p>

            {/* Status Factors Breakdown */}
            {healthDeductions.length > 0 && (
              <div className="mt-4 border-t border-dashboard-border/40 pt-3">
                <h5 className="text-[10px] font-bold text-dashboard-text-secondary uppercase tracking-wider font-jetbrains mb-2">
                  Status Factors
                </h5>
                <div className="grid gap-2 sm:grid-cols-2">
                  {healthDeductions.map((d, index) => (
                    <div key={index} className="flex items-start gap-2 bg-dashboard-bg/40 p-2 rounded border border-dashboard-border/30 text-[11px] text-left">
                      <span className="material-symbols-outlined text-xs text-dashboard-danger shrink-0 mt-0.5">remove_circle_outline</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold font-inter text-dashboard-text flex justify-between gap-2">
                          <span className="truncate">{d.label}</span>
                          <span className="text-dashboard-danger shrink-0 font-jetbrains">{d.value}</span>
                        </p>
                        <p className="text-[10px] text-dashboard-text-secondary font-inter truncate mt-0.5">{d.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Telemetry Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-dashboard-border/50">
          <div className="bg-dashboard-bg/50 border border-dashboard-border/40 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-dashboard-text-secondary font-jetbrains">Live Birds</span>
            <p className="text-lg font-black font-jetbrains text-dashboard-text mt-1">{formatNumber(liveBirds)}</p>
            <span className="text-[8px] font-bold text-dashboard-text-secondary font-inter mt-1.5 leading-none">
              {yieldVsPlanPercent === null ? 'No planned flock' : `${formatNumber(yieldVsPlanPercent, 1)}% of plan`}
            </span>
          </div>

          <div className="bg-dashboard-bg/50 border border-dashboard-border/40 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-dashboard-text-secondary font-jetbrains">Mortality Rate</span>
            <p className={`text-lg font-black font-jetbrains mt-1 ${mortalityTone}`}>{formatNumber(mortalityPercent, 2)}%</p>
            <span className="text-[8px] font-bold text-dashboard-text-secondary font-inter mt-1.5 leading-none">
              {formatNumber(totalMortality)} total lost
            </span>
          </div>

          <div className="bg-dashboard-bg/50 border border-dashboard-border/40 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-dashboard-text-secondary font-jetbrains">Feed Variance</span>
            <p className={`text-lg font-black font-jetbrains mt-1 ${
              varianceKg === null || varianceKg <= 0 ? 'text-dashboard-success' : 'text-dashboard-warning'
            }`}>
              {variancePercent === null ? '--' : `${variancePercent > 0 ? '+' : ''}${formatNumber(variancePercent, 1)}%`}
            </p>
            <span className="text-[8px] font-bold text-dashboard-text-secondary font-inter mt-1.5 leading-none">
              {varianceKg === null ? 'No target' : `${varianceKg > 0 ? '+' : ''}${formatNumber(varianceKg, 0)} kg`}
            </span>
          </div>

          <div className="bg-dashboard-bg/50 border border-dashboard-border/40 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[9px] font-bold uppercase tracking-wider text-dashboard-text-secondary font-jetbrains">Inventory Risk</span>
            <p className={`text-lg font-black font-jetbrains mt-1 ${getInventoryRiskTone(daysOfFeedRemaining)}`}>
              {getInventoryRiskText(daysOfFeedRemaining)}
            </p>
            <span className="text-[8px] font-bold text-dashboard-text-secondary font-inter mt-1.5 leading-none">
              {daysOfFeedRemaining !== null ? `${formatNumber(daysOfFeedRemaining, 1)} days remaining` : 'Stock level unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. What Needs Action & Offline Sync Queue */}
      <div className="mb-6">
        <h3 className="text-dashboard-text-secondary font-bold tracking-widest uppercase text-xs font-jetbrains mb-3">
          What Needs Action
        </h3>

        {warningsList.length === 0 && pendingQueue.length === 0 && failedQueue.length === 0 ? (
          /* Premium All Clear Card */
          <div className="bg-dashboard-success-bg/10 border border-dashboard-success/30 rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-dashboard-success/20 flex items-center justify-center text-dashboard-success shrink-0">
              <span className="material-symbols-outlined text-2xl font-bold">check_circle</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-dashboard-success uppercase tracking-wider font-jetbrains">All Clear Today</h4>
              <p className="text-xs text-dashboard-text-secondary mt-1 font-inter">
                All daily logs recorded, normal mortality levels, safe feed stock, and all offline queues synced successfully.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {/* Active Warnings */}
            {warningsList.map((w, index) => (
              <div
                key={index}
                className={`border rounded-xl p-4 flex items-center gap-3.5 ${
                  w.severity === 'danger'
                    ? 'bg-dashboard-danger-bg/10 border-dashboard-danger/25 text-dashboard-danger'
                    : 'bg-dashboard-warning-bg/10 border-dashboard-warning/25 text-dashboard-warning'
                }`}
              >
                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                  w.severity === 'danger' ? 'bg-dashboard-danger/20 text-dashboard-danger' : 'bg-dashboard-warning/20 text-dashboard-warning'
                }`}>
                  <span className="material-symbols-outlined text-lg">{w.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold font-inter leading-relaxed">{w.text}</p>
                </div>
              </div>
            ))}

            {/* Offline Sync Queue Dashboard */}
            {(pendingQueue.length > 0 || failedQueue.length > 0) && (
              <div className="border border-dashboard-border/60 bg-dashboard-bg/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 border-b border-dashboard-border/40 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-dashboard-accent">sync</span>
                    <h4 className="text-xs font-black uppercase tracking-wider font-jetbrains">Offline Sync Queue</h4>
                  </div>
                  <span className="text-[10px] font-bold text-dashboard-text-secondary px-2 py-0.5 bg-dashboard-card rounded border border-dashboard-border font-jetbrains">
                    {queueItems.length} total items
                  </span>
                </div>

                {pendingQueue.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-[10px] font-bold text-dashboard-text-secondary uppercase tracking-wider font-jetbrains mb-1.5">
                      Pending Sync
                    </h5>
                    <ul className="space-y-1.5 pl-3 list-disc text-xs font-inter text-dashboard-text-secondary">
                      {pendingQueue.map(item => (
                        <li key={item.id} className="leading-relaxed">
                          <div className="flex items-center gap-2">
                            <span className="text-dashboard-text font-medium">{getQueueItemLabel(item)}</span>
                            {item.status === 'syncing' && (
                              <span className="text-[8px] font-bold uppercase bg-dashboard-accent/25 text-dashboard-accent px-1.5 py-0.5 rounded animate-pulse">
                                syncing...
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {failedQueue.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-bold text-dashboard-danger uppercase tracking-wider font-jetbrains mb-2">
                      Failed Actions
                    </h5>
                    <ul className="space-y-3">
                      {failedQueue.map(item => (
                        <li key={item.id} className="bg-dashboard-card border border-dashboard-border p-3 rounded-lg flex flex-col gap-2 relative">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-dashboard-text truncate">
                                {getQueueItemLabel(item)}
                              </p>
                              {item.error && (
                                <p className="text-[10px] text-dashboard-danger font-jetbrains mt-1 bg-dashboard-danger-bg/20 p-1.5 rounded leading-tight border border-dashboard-danger/10">
                                  Error: {item.error}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 border-t border-dashboard-border/40 pt-2 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => handleRetryQueueItem(item.id)}
                              className="px-2.5 py-1 rounded bg-dashboard-accent text-dashboard-on-accent hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1 font-jetbrains"
                            >
                              <span className="material-symbols-outlined text-xs">replay</span> Retry
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditClick(item)}
                              className="px-2.5 py-1 rounded bg-dashboard-card border border-dashboard-border hover:bg-dashboard-bg active:scale-95 transition-all cursor-pointer text-dashboard-text flex items-center gap-1 font-jetbrains"
                            >
                              <span className="material-symbols-outlined text-xs">edit</span> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDiscardQueueItem(item.id)}
                              className="px-2.5 py-1 rounded bg-dashboard-danger-bg text-dashboard-danger hover:bg-dashboard-danger hover:text-white active:scale-95 transition-all cursor-pointer flex items-center gap-1 border border-dashboard-danger/20 font-jetbrains"
                            >
                              <span className="material-symbols-outlined text-xs">delete</span> Discard
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Quick Actions */}
      <div className="mb-6">
        <h3 className="text-dashboard-text-secondary font-bold tracking-widest uppercase text-xs font-jetbrains mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action, idx) => (
            <ActionButton
              key={idx}
              label={action.label}
              detail={action.detail}
              onClick={() => setActiveScreen(action.screen)}
            />
          ))}
        </div>
      </div>

      {/* 4. Recent Activity */}
      <div className="mb-6">
        <h3 className="text-dashboard-text-secondary font-bold tracking-widest uppercase text-xs font-jetbrains mb-3">
          Recent Activity
        </h3>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Latest Daily Logs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-bold text-dashboard-text-secondary uppercase tracking-wider font-jetbrains">
                Latest Daily Logs
              </h4>
              <button
                type="button"
                onClick={() => setActiveScreen('dailyLog')}
                className="text-[10px] font-bold text-dashboard-accent bg-dashboard-accent/15 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-dashboard-accent/25 transition-colors font-jetbrains"
              >
                All Logs
              </button>
            </div>

            <div className="bg-dashboard-card border border-dashboard-border rounded-xl overflow-hidden shadow-sm">
              <ul className="divide-y divide-dashboard-border">
                {recentLogs.map((log) => {
                  const hasMortality = Number(log.mortality || 0) > 0;
                  const dotClass = hasMortality
                    ? 'bg-dashboard-danger shadow-[0_0_8px_var(--dashboard-danger)]'
                    : 'bg-dashboard-success shadow-[0_0_8px_var(--dashboard-success)]';

                  return (
                    <li key={log.id} className="p-4 hover:bg-dashboard-bg/50 transition-colors flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`}></div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold font-hanken truncate">
                            Building {log.building} logged by {log.employeeName || 'Unassigned'}
                          </p>
                          <p className="text-xs text-dashboard-text-secondary mt-1 font-inter">
                            {log.feed ? `${formatNumber(log.feed, 1)} bags feed` : 'No feed logged'}
                            {log.mortality ? ` • ${formatNumber(log.mortality)} mortality` : ' • 0 mortality'}
                          </p>
                        </div>
                      </div>
                      <span className="font-jetbrains text-xs text-dashboard-text-secondary shrink-0 font-medium bg-dashboard-bg px-2.5 py-1 rounded border border-dashboard-border">
                        {log.date}
                      </span>
                    </li>
                  );
                })}

                {recentLogs.length === 0 && (
                  <li className="p-6 text-center text-sm text-dashboard-text-secondary font-inter">
                    No recent activity records registered for this flock batch.
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Latest Transactions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-bold text-dashboard-text-secondary uppercase tracking-wider font-jetbrains">
                Latest Transactions
              </h4>
              <button
                type="button"
                onClick={() => setActiveScreen('ledger')}
                className="text-[10px] font-bold text-dashboard-accent bg-dashboard-accent/15 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-dashboard-accent/25 transition-colors font-jetbrains"
              >
                All Ledger
              </button>
            </div>

            <div className="bg-dashboard-card border border-dashboard-border rounded-xl overflow-hidden shadow-sm">
              <ul className="divide-y divide-dashboard-border">
                {recentTransactions.map((tx) => {
                  const isIncome = tx.type === 'Income' || tx.fundingNature === 'Revenue';
                  const dotClass = isIncome
                    ? 'bg-dashboard-success shadow-[0_0_8px_var(--dashboard-success)]'
                    : 'bg-dashboard-danger shadow-[0_0_8px_var(--dashboard-danger)]';

                  return (
                    <li key={tx.id} className="p-4 hover:bg-dashboard-bg/50 transition-colors flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`}></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold font-hanken truncate">
                            {tx.category}: {tx.description || tx.type || 'Transaction'}
                          </p>
                          <p className="text-xs text-dashboard-text-secondary mt-1 font-inter">
                            Building {tx.building || 'All'} • Paid by {tx.paidBy || 'Unspecified'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-jetbrains text-xs font-bold text-dashboard-text block">
                          {formatLedgerMoney(tx.amount)}
                        </span>
                        <span className="font-jetbrains text-[10px] text-dashboard-text-secondary block mt-0.5">
                          {tx.date}
                        </span>
                      </div>
                    </li>
                  );
                })}

                {recentTransactions.length === 0 && (
                  <li className="p-6 text-center text-sm text-dashboard-text-secondary font-inter">
                    No recent transactions recorded for this flock batch.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* JSON Payload Editor Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-dashboard-card border border-dashboard-border w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-dashboard-border pb-3">
              <div>
                <h3 className="text-lg font-bold font-hanken">Edit Queue Payload</h3>
                <p className="text-[10px] text-dashboard-text-secondary font-jetbrains mt-0.5">
                  ID: {editingItem.id} ({editingItem.type})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-dashboard-text-secondary hover:text-dashboard-text cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <label className="text-[10px] font-bold text-dashboard-text-secondary uppercase tracking-widest font-jetbrains">
                Payload JSON
              </label>
              <textarea
                value={editPayloadStr}
                onChange={(e) => setEditPayloadStr(e.target.value)}
                rows="12"
                className="w-full bg-dashboard-bg border border-dashboard-border rounded-xl p-3 font-jetbrains text-xs text-dashboard-text focus:outline-none focus:border-dashboard-accent resize-none leading-relaxed shadow-inner"
              />
              {editError && (
                <p className="text-xs text-dashboard-danger font-bold mt-1 bg-dashboard-danger-bg/20 p-2 rounded border border-dashboard-danger/30 font-jetbrains">
                  Error: {editError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-2 border-t border-dashboard-border pt-4">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-sm font-extrabold font-hanken rounded-xl border border-dashboard-border hover:bg-dashboard-bg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm font-extrabold font-hanken rounded-xl bg-dashboard-accent text-dashboard-on-accent hover:opacity-90 cursor-pointer shadow-md transition-all active:scale-95"
              >
                Save & Retry Sync
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
