import { useMemo } from 'react';

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatNumber(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '--';
  return Number(num).toLocaleString();
}

function IntroMetric({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-widest text-app-text-secondary uppercase mb-1 font-jetbrains">{label}</p>
      <p className="text-base font-semibold font-inter text-app-text">{value}</p>
    </div>
  );
}

function PreviewStat({ label, value, tone = 'text-app-text', suffix = null, isAlert = false }) {
  if (isAlert) {
    return (
      <div className="bg-app-danger-bg/25 backdrop-blur-sm p-4 rounded-lg border border-app-danger/25 relative overflow-hidden hover:bg-app-danger-bg/35 transition-colors duration-200">
        <p className="text-xs font-medium tracking-widest text-app-danger uppercase mb-2 font-jetbrains relative z-10">{label}</p>
        <p className="text-2xl font-semibold font-jetbrains text-app-danger relative z-10">{value}</p>
      </div>
    );
  }

  return (
    <div className="bg-app-bg/40 backdrop-blur-sm p-4 rounded-lg border border-app-border/40 hover:bg-app-bg/60 transition-colors duration-200">
      <p className="text-xs font-medium tracking-widest text-app-text-secondary uppercase mb-2 font-jetbrains">{label}</p>
      <p className={`text-2xl font-semibold font-jetbrains ${tone}`}>
        {value} {suffix && <span className="text-sm font-normal text-app-text-secondary font-inter">{suffix}</span>}
      </p>
    </div>
  );
}

export default function IntroPage({ onContinueAsViewer, onMemberLogin, isViewerLoading = false, viewerError = '', preloadedSnapshot = null }) {
  const todayStr = getTodayDateString();

  const liveBirdsValue = preloadedSnapshot
    ? Math.max(
        Number(preloadedSnapshot.batch?.totalChicksLoaded || 0) -
        (preloadedSnapshot.logs || []).reduce((sum, log) => sum + Number(log.mortality || 0), 0) -
        Number(preloadedSnapshot.harvestProductionSummary?.totals?.birds || 0),
        0
      )
    : 38474;

  const logsTodayValue = preloadedSnapshot
    ? (preloadedSnapshot.logs || []).filter(log => log.date === todayStr).length
    : 3;

  const feedStockValue = preloadedSnapshot
    ? (preloadedSnapshot.feedItems || preloadedSnapshot.inventoryItems || [])
        .filter(item => item.category === 'Feed')
        .reduce((sum, item) => sum + Number(item.currentStock || 0), 0)
    : 980;

  const lowAlertsValue = preloadedSnapshot
    ? (preloadedSnapshot.inventoryItems || []).filter(item => Number(item.reorderLevel || 0) > 0 && Number(item.currentStock || 0) < Number(item.reorderLevel || 0)).length +
      (preloadedSnapshot.loadings || []).filter(l => Number(l.chicksLoaded || 0) > 0).filter(l => 
        !(preloadedSnapshot.logs || []).some(log => log.date === todayStr && String(log.building).toUpperCase() === String(l.building).toUpperCase())
      ).length
    : 1;

  const displayItems = useMemo(() => {
    if (!preloadedSnapshot) {
      return [
        { key: 'bld-a', label: 'Building A logged', status: 'ok' },
        { key: 'feed-rev', label: 'Feed stock reviewed', status: 'ok' },
        { key: 'inv-alert', label: 'Inventory alert open', status: 'alert' }
      ];
    }

    const items = [];

    // 1. Building logs today status
    const activeBuildings = (preloadedSnapshot.loadings || [])
      .filter(l => Number(l.chicksLoaded || 0) > 0);

    if (activeBuildings.length === 0) {
      items.push({ key: 'no-loadings', label: 'No buildings loaded in batch', status: 'alert' });
    } else {
      activeBuildings.forEach(loading => {
        const hasLog = (preloadedSnapshot.logs || []).some(
          log => log.date === todayStr && String(log.building).toUpperCase() === String(loading.building).toUpperCase()
        );
        items.push({
          key: `bld-${loading.building}`,
          label: `Building ${loading.building} ${hasLog ? 'logged today' : 'missing log'}`,
          status: hasLog ? 'ok' : 'warning'
        });
      });
    }

    // 2. Feed stock level status
    const lowFeedItems = (preloadedSnapshot.inventoryItems || [])
      .filter(item => Number(item.reorderLevel || 0) > 0 && Number(item.currentStock || 0) < Number(item.reorderLevel || 0));

    if (lowFeedItems.length > 0) {
      items.push({
        key: 'feed-low-alert',
        label: `${lowFeedItems.length} feed item(s) below reorder level`,
        status: 'alert'
      });
    } else {
      items.push({
        key: 'feed-stock-ok',
        label: 'Feed stock levels reviewed & stable',
        status: 'ok'
      });
    }

    // 3. Batch age status
    if (preloadedSnapshot.batch) {
      const start = preloadedSnapshot.batch.startDate;
      if (start) {
        const parseDateOnly = (val) => {
          if (!val) return null;
          const [year, month, day] = String(val).split('T')[0].split('-').map(Number);
          return new Date(year, month - 1, day);
        };
        const startD = parseDateOnly(start);
        const todayD = parseDateOnly(todayStr);
        if (startD && todayD) {
          const ageDays = Math.round((todayD - startD) / (24 * 60 * 60 * 1000));
          items.push({
            key: 'batch-age',
            label: `Batch ${preloadedSnapshot.batch.id}: Day ${ageDays}`,
            status: 'ok'
          });
        }
      }
    }

    return items;
  }, [preloadedSnapshot, todayStr]);

  return (
    <div className="bg-app-bg text-app-text min-h-screen flex flex-col font-inter selection:bg-app-accent selection:text-app-on-accent">
      <header className="bg-app-card border-b border-app-border sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-app-accent select-none" style={{ fontSize: '28px' }}>
              agriculture
            </span>
            <div>
              <div className="text-[10px] font-medium tracking-widest text-app-accent uppercase font-jetbrains">
                Octavio Poultry
              </div>
              <div className="text-lg md:text-xl font-bold font-hanken text-app-text">
                Farm Management
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onMemberLogin}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-app-border hover:bg-app-bg text-app-text transition-all duration-200 active:scale-[0.98]"
          >
            Member Login
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col md:flex-row gap-10 px-6 py-12 max-w-[1440px] mx-auto w-full items-center">
        <section className="flex-1 flex flex-col justify-center max-w-2xl">
          <div className="text-app-accent text-xs font-semibold tracking-widest uppercase mb-4 font-jetbrains">
            BEFORE YOU SIGN IN
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-hanken mb-6 leading-[1.1] text-app-text">
            Know the flock, the<br />feed, and the next<br />move.
          </h1>
          <p className="text-base text-app-text-secondary mb-8 max-w-lg leading-relaxed">
            Start with a read-only view of daily operations, batch health, feed usage, and inventory alerts. Members can sign in to record work, manage ledgers, and update farm data.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <button
              type="button"
              onClick={onContinueAsViewer}
              disabled={isViewerLoading}
              className="btn-primary btn-3d font-medium px-6 py-3.5 rounded-lg text-sm bg-app-accent text-app-on-accent hover:opacity-95 transition-opacity active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
            >
              {isViewerLoading ? 'Opening Current Batch' : 'Continue as Viewer'}
            </button>
            <button
              type="button"
              onClick={onMemberLogin}
              className="btn-secondary btn-3d font-medium px-6 py-3.5 rounded-lg text-sm border border-app-border hover:bg-app-card text-app-text transition-all duration-200 active:scale-[0.98]"
            >
              Login as Member
            </button>
          </div>

          {viewerError && (
            <div className="mb-8 rounded-lg border border-app-danger/40 bg-app-danger-bg px-4 py-3 text-sm font-medium text-app-danger">
              {viewerError}
            </div>
          )}

          <div className="grid grid-cols-3 gap-6 border-t border-app-border pt-8">
            <IntroMetric label="Viewer Access" value="Read-only" />
            <IntroMetric label="Member Access" value="Role based" />
            <IntroMetric label="Data Scope" value="Batch first" />
          </div>
        </section>

        <section className="flex-1 flex flex-col justify-center items-center md:items-end w-full mt-10 md:mt-0 perspective-container">
          <div className="glass-card model-3d rounded-xl p-6 w-full max-w-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-app-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-app-accent text-xs font-semibold tracking-widest uppercase mb-2 font-jetbrains">
                  LIVE PREVIEW
                </div>
                <h2 className="text-xl font-bold font-hanken text-app-text">Today at a glance</h2>
              </div>
              <div className="px-2.5 py-1 bg-app-accent/15 text-app-accent rounded text-[10px] font-semibold tracking-widest font-jetbrains border border-app-accent/20">
                READ-ONLY
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <PreviewStat label="LIVE BIRDS" value={formatNumber(liveBirdsValue)} tone="text-app-success" />
              <PreviewStat label="LOGS TODAY" value={formatNumber(logsTodayValue)} tone="text-app-accent" />
              <PreviewStat label="FEED STOCK" value={formatNumber(feedStockValue)} suffix="sx" />
              <PreviewStat label="LOW ALERTS" value={formatNumber(lowAlertsValue)} isAlert={lowAlertsValue > 0} />
            </div>

            <div className="space-y-2">
              {displayItems.map((item) => {
                const isAlert = item.status === 'alert';
                const isWarning = item.status === 'warning';
                
                let containerClass = "flex items-center justify-between p-3 bg-app-bg/50 backdrop-blur-sm rounded-lg border border-app-border/40 hover:border-app-accent/30 transition-colors duration-200";
                let dotClass = "w-2.5 h-2.5 rounded-full bg-app-accent";
                
                if (isAlert) {
                  containerClass = "flex items-center justify-between p-3 bg-app-danger-bg/25 backdrop-blur-sm rounded-lg border border-app-danger/25 hover:border-app-danger/50 transition-colors duration-200 relative overflow-hidden";
                  dotClass = "w-2.5 h-2.5 rounded-full bg-app-danger relative z-10 animate-pulse";
                } else if (isWarning) {
                  containerClass = "flex items-center justify-between p-3 bg-app-warning-bg/25 backdrop-blur-sm rounded-lg border border-app-warning/25 hover:border-app-warning/50 transition-colors duration-200 relative overflow-hidden";
                  dotClass = "w-2.5 h-2.5 rounded-full bg-app-warning relative z-10 animate-pulse";
                }

                return (
                  <div key={item.key} className={containerClass}>
                    <span className={`text-sm text-app-text ${isAlert || isWarning ? 'relative z-10 font-medium' : ''}`}>
                      {item.label}
                    </span>
                    <div className={dotClass}></div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <section className="border-t border-app-border bg-app-card/50">
        <div className="max-w-[1440px] mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-app-text-secondary text-sm">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3 font-jetbrains text-app-text">
              Viewer Access
            </p>
            <p className="leading-relaxed">
              Viewers can inspect live batch health, logs, and feeding schedules without administrative privileges.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3 font-jetbrains text-app-text">
              Member Operations
            </p>
            <div className="grid grid-cols-1 gap-4 mt-2">
              <div className="bg-app-bg p-4 rounded-lg border border-app-border hover:border-app-accent/30 transition-all duration-200">
                <h4 className="text-sm font-semibold text-app-text mb-1">Daily checks</h4>
                <p className="text-xs text-app-text-secondary">Record mortality stats, feed usage details, temperature fluctuations, and water logs.</p>
              </div>
              <div className="bg-app-bg p-4 rounded-lg border border-app-border hover:border-app-accent/30 transition-all duration-200">
                <h4 className="text-sm font-semibold text-app-text mb-1">Production trends</h4>
                <p className="text-xs text-app-text-secondary">Gain visibility into cost per bird, average body weights, feed conversion ratios, and harvest records.</p>
              </div>
              <div className="bg-app-bg p-4 rounded-lg border border-app-border hover:border-app-accent/30 transition-all duration-200">
                <h4 className="text-sm font-semibold text-app-text mb-1">Inventory alerts</h4>
                <p className="text-xs text-app-text-secondary">Track stock status, set alerts for critical feed shortages, and monitor vaccination storage levels.</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3 font-jetbrains text-app-text">
              Security Scope
            </p>
            <p className="leading-relaxed">
              Role-based restrictions protect ledger operations, harvest payments, and employee management tools.
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-app-bg border-t border-app-border py-8">
        <div className="max-w-[1440px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-app-text-secondary">
          <span className="font-jetbrains">
            (c) 2024 Octavio Poultry Farm Management System
          </span>
          <nav className="flex gap-6">
            <span className="hover:text-app-accent cursor-pointer transition-colors duration-200">Daily Checks</span>
            <span className="hover:text-app-accent cursor-pointer transition-colors duration-200">Production Trends</span>
            <span className="hover:text-app-accent cursor-pointer transition-colors duration-200">Inventory Alerts</span>
            <span className="hover:text-app-accent cursor-pointer transition-colors duration-200">Privacy Policy</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
