import {
  BAG_WEIGHT_KG,
  calculateTargetFeedForHeads,
  getAgeDay,
  getLastBroilerTargetDay
} from './broilerTargets';

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

function getToneClass(value) {
  const isOver = Number(value || 0) > 0;
  return isOver ? 'text-semantic-danger' : 'text-semantic-success';
}

const roleRank = {
  Viewer: 1,
  DataEntry: 2,
  OperationManager: 3,
  AdminOwner: 4,
};

function hasMinimumRole(role, minimumRole) {
  const compactRole = String(role || '').replace(/[\s_-]/g, '').toLowerCase();
  const normalizedRole =
    compactRole === 'admin' || compactRole === 'adminowner' ? 'AdminOwner'
      : compactRole === 'opmanager' || compactRole === 'operationmanager' ? 'OperationManager'
        : compactRole === 'dataentry' ? 'DataEntry'
          : compactRole === 'viewer' ? 'Viewer'
            : role;

  return (roleRank[normalizedRole] || 0) >= (roleRank[minimumRole] || 0);
}

function MetricCard({ label, value, subtext, tone = 'text-gray-900 dark:text-white' }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-neutral-border dark:border-gray-700 p-3 rounded-xl shadow-sm">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-black mt-1 ${tone}`}>{value}</p>
      {subtext && (
        <p className="text-[10px] font-bold text-gray-400 mt-1 leading-tight">{subtext}</p>
      )}
    </div>
  );
}

function ActionButton({ label, detail, onClick, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-20 rounded-xl border p-3 text-left shadow-sm active:scale-[0.98] transition-all ${
        primary
          ? 'bg-primary text-white border-primary'
          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-white border-neutral-border dark:border-gray-700'
      }`}
    >
      <span className={`block text-sm font-black ${primary ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
        {label}
      </span>
      <span className={`block text-[10px] font-bold mt-1 leading-tight ${primary ? 'text-white/80' : 'text-gray-400'}`}>
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
  const yieldVsPlanPercent = plannedFlock > 0 ? (liveBirds / plannedFlock) * 100 : null;
  const totalFeedBags = logs.reduce((sum, log) => sum + Number(log.feed || 0), 0);
  const totalFeedKg = totalFeedBags * BAG_WEIGHT_KG;
  const feedTarget = calculateTargetFeedForHeads(actualLoaded, currentAgeDays);
  const varianceKg = feedTarget ? totalFeedKg - feedTarget.targetKg : null;
  const varianceBags = varianceKg === null ? null : varianceKg / BAG_WEIGHT_KG;
  const variancePercent = feedTarget?.targetKg ? (varianceKg / feedTarget.targetKg) * 100 : null;
  const todaysLogs = logs.filter((log) => log.date === today);
  const latestWeightLog = logs.find((log) => log.averageWeightGrams != null && Number(log.averageWeightGrams) > 0);
  const recentLogs = logs.slice(0, 3);
  const canEnterDaily = hasMinimumRole(user?.role, 'DataEntry');
  const canUseFinancialScreens = hasMinimumRole(user?.role, 'OperationManager');
  const lastTargetDay = getLastBroilerTargetDay();
  const quickActions = canUseFinancialScreens
    ? [
      { label: 'Daily Logs', detail: 'Mortality, feed, weight', screen: 'dailyLog', primary: true },
      { label: 'Analytics', detail: 'Targets and charts', screen: 'analytics' },
      { label: 'Employees', detail: 'Shares and pay', screen: 'employees' },
      { label: 'Ledger', detail: 'Expenses and balances', screen: 'ledger' }
    ]
    : canEnterDaily
      ? [
      { label: 'Daily Logs', detail: 'Mortality, feed, weight', screen: 'dailyLog', primary: true },
      { label: 'Analytics', detail: 'Targets and charts', screen: 'analytics' },
      { label: 'Inventory', detail: 'Stock levels', screen: 'inventory' },
      { label: 'Batches', detail: 'Batch setup', screen: 'batches' }
      ]
      : [
      { label: 'Analytics', detail: 'Targets and charts', screen: 'analytics', primary: true },
      { label: 'Daily Logs', detail: 'Read-only history', screen: 'dailyLog' },
      { label: 'Inventory', detail: 'Read-only stock', screen: 'inventory' },
      { label: 'Batches', detail: 'Read-only cycles', screen: 'batches' }
      ];

  if (!activeBatch) {
    return (
      <div className="app-page">
        <div className="mb-5 mt-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Octavio Poultry</p>
          <h2 className="text-3xl font-extrabold text-primary tracking-tight mt-1">Home</h2>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-neutral-border dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <p className="text-lg font-black text-gray-900 dark:text-white">No active batch selected</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Create or select a batch before daily logging and production targets can appear here.
          </p>
          <button
            type="button"
            onClick={() => setActiveScreen('batches')}
            className="w-full mt-4 bg-primary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all"
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
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Octavio Poultry</p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl font-extrabold text-primary tracking-tight">Home</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Batch {activeBatch.id}
            </p>
          </div>
          <div className="text-right bg-white dark:bg-gray-800 border border-neutral-border dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Age</p>
            <p className="text-xl font-black text-secondary">D{currentAgeDays || '--'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-xl p-3 shadow-sm">
          <p className="text-[10px] text-gray-300 uppercase tracking-wider font-bold">Started</p>
          <p className="text-xs font-black mt-1">{formatDate(activeBatch.startDate)}</p>
        </div>
        <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-xl p-3 shadow-sm">
          <p className="text-[10px] text-gray-300 uppercase tracking-wider font-bold">Today</p>
          <p className="text-xs font-black mt-1">{formatDate(today)}</p>
        </div>
        <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-xl p-3 shadow-sm">
          <p className="text-[10px] text-gray-300 uppercase tracking-wider font-bold">Logs</p>
          <p className="text-xs font-black mt-1">{todaysLogs.length} today</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {quickActions.map((action) => (
          <ActionButton
            key={action.screen}
            primary={action.primary}
            label={action.label}
            detail={action.detail}
            onClick={() => setActiveScreen(action.screen)}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
      <div className="mb-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-secondary font-extrabold tracking-wide uppercase text-sm">Flock Status</h3>
          <span className="text-[10px] font-bold text-gray-400">
            Live estimate
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3">
          <MetricCard
            label="Loaded"
            value={formatNumber(actualLoaded)}
            subtext="Total chicks"
          />
          <MetricCard
            label="Live Birds"
            value={formatNumber(liveBirds)}
            subtext={yieldVsPlanPercent === null ? 'No plan set' : `${formatNumber(yieldVsPlanPercent, 2)}% vs plan`}
            tone="text-semantic-success"
          />
          <MetricCard
            label="Mortality"
            value={formatNumber(totalMortality)}
            subtext={`${formatNumber(mortalityPercent, 2)}% rate`}
            tone={totalMortality > 0 ? 'text-semantic-danger' : 'text-semantic-success'}
          />
          <MetricCard
            label="Latest Weight"
            value={latestWeightLog ? `${formatNumber(latestWeightLog.averageWeightGrams, 0)}g` : '--'}
            subtext={latestWeightLog ? `Logged ${latestWeightLog.date}` : 'No weigh-in yet'}
            tone="text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="mb-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-primary dark:text-primary-light font-extrabold tracking-wide uppercase text-sm">Feed Performance</h3>
          <button
            type="button"
            onClick={() => setActiveScreen('analytics')}
            className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded-lg"
          >
            View chart
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
          <div className="bg-white dark:bg-gray-800 border border-neutral-border dark:border-gray-700 p-4 rounded-xl shadow-sm">
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Actual Feed</p>
                <p className="text-[10px] text-gray-400">Accumulated daily logs</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-gray-800 dark:text-white">
                  {formatNumber(totalFeedKg, 0)} <span className="text-sm font-bold text-gray-500">kg</span>
                </p>
                <p className="text-xs font-bold text-primary">
                  {formatNumber(totalFeedBags, 2)} bags
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-neutral-border dark:border-gray-700 p-4 rounded-xl shadow-sm">
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Target Feed</p>
                <p className="text-[10px] text-gray-400">
                  {feedTarget ? `Curve day ${currentAgeDays}` : `Curve available through day ${lastTargetDay}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-gray-800 dark:text-white">
                  {feedTarget ? formatNumber(feedTarget.targetKg, 0) : '--'} <span className="text-sm font-bold text-gray-500">kg</span>
                </p>
                <p className="text-xs font-bold text-gray-500">
                  {feedTarget ? formatNumber(feedTarget.targetBags, 2) : '--'} bags
                </p>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-xl shadow-sm border ${varianceKg === null || varianceKg <= 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/30' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/30'}`}>
            <div className="flex justify-between items-center gap-3">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${getToneClass(varianceKg)}`}>
                  Feed Variance
                </p>
                <p className={`text-2xl font-black ${getToneClass(varianceKg)}`}>
                  {variancePercent === null ? '--' : `${variancePercent > 0 ? '+' : ''}${formatNumber(variancePercent, 2)}%`}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-black ${getToneClass(varianceKg)}`}>
                  {varianceKg === null ? 'No target' : `${varianceKg > 0 ? '+' : ''}${formatNumber(varianceKg, 0)} kg`}
                </p>
                <p className={`text-xs font-bold mt-0.5 ${getToneClass(varianceKg)}`}>
                  {varianceBags === null ? 'Need curve extension' : `${varianceBags > 0 ? '+' : ''}${formatNumber(varianceBags, 2)} bags`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="xl:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Recent Activity</h3>
          <button
            type="button"
            onClick={() => setActiveScreen('dailyLog')}
            className="text-[10px] font-black text-primary"
          >
            Open logs
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          {recentLogs.map((log) => (
            <div key={log.id} className="bg-white dark:bg-gray-800 border border-neutral-border dark:border-gray-700 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                  Bldg {log.building} - {log.employeeName || 'Unassigned'}
                </p>
                <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                  {log.date} - {formatNumber(log.feed, 2)} bags feed
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-black ${Number(log.mortality || 0) > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
                  {formatNumber(log.mortality)} hd
                </p>
                <p className="text-[10px] text-gray-400">mortality</p>
              </div>
            </div>
          ))}

          {recentLogs.length === 0 && (
            <div className="bg-white dark:bg-gray-800 border border-neutral-border dark:border-gray-700 rounded-xl p-4 text-center">
              <p className="text-sm font-bold text-gray-500">No daily logs yet for this batch.</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
