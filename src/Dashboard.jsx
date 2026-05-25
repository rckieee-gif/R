import {
  BAG_WEIGHT_KG,
  calculateTargetFeedForHeads,
  getAgeDay,
  getLastBroilerTargetDay
} from './broilerTargets';
import WeatherForecast from './Components/WeatherForecast';

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

function MetricCard({ label, value, subtext, icon = null, tone = 'text-dashboard-text' }) {
  const finalTone = tone === 'text-white' ? 'text-dashboard-text' : tone;
  return (
    <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-5 hover:border-dashboard-accent transition-colors relative overflow-hidden group">
      {icon && (
        <div className="absolute top-0 right-0 p-2 opacity-25 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none text-dashboard-text-secondary">
          <span className="material-symbols-outlined text-7xl select-none">{icon}</span>
        </div>
      )}
      <h3 className="text-[10px] font-bold tracking-widest text-dashboard-text-secondary uppercase mb-2 relative z-10 font-jetbrains">
        {label}
      </h3>
      <div className="flex items-baseline gap-2 relative z-10 mt-1">
        <p className={`text-2xl font-black font-jetbrains ${finalTone}`}>
          {value}
        </p>
      </div>
      {subtext && (
        <p className="text-[10px] font-semibold text-dashboard-text-secondary mt-2 relative z-10 leading-tight font-inter">
          {subtext}
        </p>
      )}
    </div>
  );
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
      { label: 'Daily Logs', detail: 'Mortality, feed, weight', screen: 'dailyLog' },
      { label: 'Analytics', detail: 'Targets and charts', screen: 'analytics' },
      { label: 'Employees', detail: 'Shares and pay', screen: 'employees' },
      { label: 'Ledger', detail: 'Expenses and balances', screen: 'ledger' }
    ]
    : canEnterDaily
      ? [
      { label: 'Daily Logs', detail: 'Mortality, feed, weight', screen: 'dailyLog' },
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

      {/* Quick Action buttons */}
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

      {/* Main Grid: Flock Status, Feed Performance, Recent Logs */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        
        {/* Flock Status Block */}
        <div className="mb-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-dashboard-text-secondary font-bold tracking-widest uppercase text-xs font-jetbrains">Flock Status</h3>
            <span className="text-[10px] font-bold text-dashboard-text-secondary/80 font-jetbrains">
              Live estimate
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Loaded"
              value={formatNumber(actualLoaded)}
              subtext="Total chicks"
              icon="egg_alt"
            />
            <MetricCard
              label="Live Birds"
              value={formatNumber(liveBirds)}
              subtext={yieldVsPlanPercent === null ? 'No plan set' : `${formatNumber(yieldVsPlanPercent, 2)}% vs plan`}
              tone="text-dashboard-success"
              icon="flutter_dash"
            />
            <MetricCard
              label="Mortality"
              value={formatNumber(totalMortality)}
              subtext={`${formatNumber(mortalityPercent, 2)}% rate`}
              tone={totalMortality > 0 ? 'text-dashboard-danger' : 'text-dashboard-success'}
              icon="medical_services"
            />
            <MetricCard
              label="Latest Weight"
              value={latestWeightLog ? `${formatNumber(latestWeightLog.averageWeightGrams, 0)}g` : '--'}
              subtext={latestWeightLog ? `Logged ${latestWeightLog.date}` : 'No weigh-in yet'}
              icon="scale"
            />
          </div>
        </div>

        {/* Feed Performance Block */}
        <div className="mb-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-dashboard-text-secondary font-bold tracking-widest uppercase text-xs font-jetbrains">Feed Performance</h3>
            <button
              type="button"
              onClick={() => setActiveScreen('analytics')}
              className="text-[10px] font-bold text-dashboard-accent bg-dashboard-accent/15 px-2 py-1 rounded-lg hover:bg-dashboard-accent/25 transition-colors font-jetbrains"
            >
              View telemetry
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {/* Actual Feed */}
            <div className="bg-dashboard-card border border-dashboard-border p-5 rounded-xl hover:border-dashboard-accent transition-colors relative overflow-hidden group">
              <div className="flex justify-between items-center gap-3">
                <div>
                  <p className="text-xs font-bold text-dashboard-text-secondary tracking-wider uppercase font-jetbrains">Actual Feed</p>
                  <p className="text-[10px] text-dashboard-text-secondary/80 mt-1 font-inter">Accumulated daily logs</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold font-jetbrains">
                    {formatNumber(totalFeedKg, 0)} <span className="text-xs font-semibold text-dashboard-text-secondary font-inter">kg</span>
                  </p>
                  <p className="text-xs font-bold text-dashboard-success mt-0.5 font-jetbrains">
                    {formatNumber(totalFeedBags, 2)} bags
                  </p>
                </div>
              </div>
            </div>

            {/* Target Feed */}
            <div className="bg-dashboard-card border border-dashboard-border p-5 rounded-xl hover:border-dashboard-accent transition-colors relative overflow-hidden group">
              <div className="flex justify-between items-center gap-3">
                <div>
                  <p className="text-xs font-bold text-dashboard-text-secondary tracking-wider uppercase font-jetbrains">Target Feed</p>
                  <p className="text-[10px] text-dashboard-text-secondary/80 mt-1 font-inter">
                    {feedTarget ? `Curve day ${currentAgeDays}` : `Curve available through day ${lastTargetDay}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold font-jetbrains">
                    {feedTarget ? formatNumber(feedTarget.targetKg, 0) : '--'} <span className="text-xs font-semibold text-dashboard-text-secondary font-inter">kg</span>
                  </p>
                  <p className="text-xs font-bold text-dashboard-text-secondary mt-0.5 font-jetbrains">
                    {feedTarget ? formatNumber(feedTarget.targetBags, 2) : '--'} bags
                  </p>
                </div>
              </div>
            </div>

            {/* Feed Variance Warning */}
            <div className={`p-5 rounded-xl border transition-colors ${
              varianceKg === null || varianceKg <= 0
                ? 'bg-dashboard-success-bg border-dashboard-success/30 hover:border-dashboard-success'
                : 'bg-dashboard-warning-bg border-dashboard-warning/30 hover:border-dashboard-warning'
            }`}>
              <div className="flex justify-between items-center gap-3">
                <div>
                  <p className={`text-xs font-bold tracking-wider uppercase font-jetbrains ${
                    varianceKg === null || varianceKg <= 0 ? 'text-dashboard-success' : 'text-dashboard-warning'
                  }`}>
                    Feed Variance
                  </p>
                  <p className={`text-2xl font-black mt-1 font-jetbrains ${
                    varianceKg === null || varianceKg <= 0 ? 'text-dashboard-success' : 'text-dashboard-warning'
                  }`}>
                    {variancePercent === null ? '--' : `${variancePercent > 0 ? '+' : ''}${formatNumber(variancePercent, 2)}%`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold font-jetbrains ${
                    varianceKg === null || varianceKg <= 0 ? 'text-dashboard-success' : 'text-dashboard-warning'
                  }`}>
                    {varianceKg === null ? 'No target' : `${varianceKg > 0 ? '+' : ''}${formatNumber(varianceKg, 0)} kg`}
                  </p>
                  <p className={`text-xs font-semibold mt-0.5 font-jetbrains ${
                    varianceKg === null || varianceKg <= 0 ? 'text-dashboard-success' : 'text-dashboard-warning'
                  }`}>
                    {varianceBags === null ? 'Need curve extension' : `${varianceBags > 0 ? '+' : ''}${formatNumber(varianceBags, 2)} bags`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="xl:col-span-2 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-dashboard-text-secondary uppercase tracking-widest font-jetbrains">
              Recent Activity Log
            </h3>
            <button
              type="button"
              onClick={() => setActiveScreen('dailyLog')}
              className="text-[10px] font-bold text-dashboard-accent bg-dashboard-accent/15 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-dashboard-accent/25 transition-colors font-jetbrains"
            >
              Open Logs Portal
            </button>
          </div>

          <div className="bg-dashboard-card border border-dashboard-border rounded-xl overflow-hidden shadow-md">
            <ul className="divide-y divide-dashboard-border">
              {recentLogs.map((log) => {
                const hasMortality = Number(log.mortality || 0) > 0;
                const dotClass = hasMortality
                  ? 'bg-dashboard-danger shadow-[0_0_8px_var(--dashboard-danger)]'
                  : 'bg-dashboard-success shadow-[0_0_8px_var(--dashboard-success)]';
                
                return (
                  <li key={log.id} className="p-4 hover:bg-dashboard-bg transition-colors flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`}></div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold font-hanken truncate">
                          Building {log.building} logged by {log.employeeName || 'Unassigned'}
                        </p>
                        <p className="text-xs text-dashboard-text-secondary mt-1 font-inter">
                          {log.feed ? `${formatNumber(log.feed, 2)} bags feed` : 'No feed logged'}
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

      </div>
    </div>
  );
}
