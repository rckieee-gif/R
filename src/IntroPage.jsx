function IntroMetric({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-widest text-[#bccbb9] uppercase mb-1 font-jetbrains">{label}</p>
      <p className="text-base font-semibold font-inter text-[#e0e3e5]">{value}</p>
    </div>
  );
}

function PreviewStat({ label, value, tone = 'text-[#e0e3e5]', suffix = null, isAlert = false }) {
  if (isAlert) {
    return (
      <div className="bg-[#0F172A] p-4 rounded-lg border border-[#ef4444]/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#ef4444]/10 pointer-events-none"></div>
        <p className="text-xs font-medium tracking-widest text-[#ef4444] uppercase mb-2 font-jetbrains relative z-10">{label}</p>
        <p className="text-2xl font-semibold font-jetbrains text-[#ef4444] relative z-10">{value}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0F172A] p-4 rounded-lg border border-[#334155]">
      <p className="text-xs font-medium tracking-widest text-[#bccbb9] uppercase mb-2 font-jetbrains">{label}</p>
      <p className={`text-2xl font-semibold font-jetbrains ${tone}`}>
        {value} {suffix && <span className="text-sm font-normal text-[#bccbb9] font-inter">{suffix}</span>}
      </p>
    </div>
  );
}

export default function IntroPage({ onContinueAsViewer, onMemberLogin }) {
  return (
    <div className="bg-[#0F172A] text-[#e0e3e5] min-h-screen flex flex-col font-inter selection:bg-[#4be277]/30">
      {/* TopAppBar */}
      <header className="bg-[#101415] border-b border-[#3d4a3d]/40 sticky top-0 z-50">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4be277] select-none" style={{ fontSize: '28px' }}>
              agriculture
            </span>
            <div>
              <div className="text-[10px] font-medium tracking-widest text-[#4be277] uppercase font-jetbrains">
                Octavio Poultry
              </div>
              <div className="text-lg md:text-xl font-bold font-hanken text-white">
                Farm Management
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onMemberLogin}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[#3d4a3d] hover:bg-[#272a2c] text-[#e0e3e5] transition-all duration-200 active:scale-[0.98]"
          >
            Member Login
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col md:flex-row gap-10 px-6 py-12 max-w-[1440px] mx-auto w-full items-center">
        {/* Left Column: Hero & Actions */}
        <section className="flex-1 flex flex-col justify-center max-w-2xl">
          <div className="text-[#4be277] text-xs font-semibold tracking-widest uppercase mb-4 font-jetbrains">
            BEFORE YOU SIGN IN
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-hanken mb-6 leading-[1.1] text-white">
            Know the flock, the<br />feed, and the next<br />move.
          </h1>
          <p className="text-base text-[#bccbb9] mb-8 max-w-lg leading-relaxed">
            Start with a read-only view of daily operations, batch health, feed usage, and inventory alerts. Members can sign in to record work, manage ledgers, and update farm data.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <button
              type="button"
              onClick={onContinueAsViewer}
              className="btn-primary btn-3d font-medium px-6 py-3.5 rounded-lg text-sm hover:opacity-95 transition-opacity active:scale-[0.98]"
              style={{ backgroundColor: '#22c55e', color: '#003915' }}
            >
              Continue as Viewer
            </button>
            <button
              type="button"
              onClick={onMemberLogin}
              className="btn-secondary btn-3d font-medium px-6 py-3.5 rounded-lg text-sm border border-[#94a3b8] hover:bg-[#1d2022] text-[#e0e3e5] transition-all duration-200 active:scale-[0.98]"
            >
              Login as Member
            </button>
          </div>

          {/* Features Bento */}
          <div className="grid grid-cols-3 gap-6 border-t border-[#334155] pt-8">
            <IntroMetric label="Viewer Access" value="Read-only" />
            <IntroMetric label="Member Access" value="Role based" />
            <IntroMetric label="Data Scope" value="Batch first" />
          </div>
        </section>

        {/* Right Column: Dashboard Preview */}
        <section className="flex-1 flex flex-col justify-center items-center md:items-end w-full mt-10 md:mt-0 perspective-container">
          <div className="tonal-layer-1 model-3d rounded-xl p-6 w-full max-w-lg relative overflow-hidden group">
            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 bg-[#4be277]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="text-[#4be277] text-xs font-semibold tracking-widest uppercase mb-2 font-jetbrains">
                  LIVE PREVIEW
                </div>
                <h2 className="text-xl font-bold font-hanken text-white">Today at a glance</h2>
              </div>
              <div className="px-2.5 py-1 bg-[#003915] text-[#6bff8f] rounded text-[10px] font-semibold tracking-widest font-jetbrains border border-[#4be277]/20">
                READ-ONLY
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <PreviewStat label="LIVE BIRDS" value="38,474" tone="text-[#4be277]" />
              <PreviewStat label="LOGS TODAY" value="3" tone="text-[#bec6e0]" />
              <PreviewStat label="FEED STOCK" value="980" suffix="sx" />
              <PreviewStat label="LOW ALERTS" value="1" isAlert={true} />
            </div>

            {/* Recent Activity List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg border border-[#334155] hover:border-[#4be277]/30 transition-colors duration-200">
                <span className="text-sm text-[#e0e3e5]">Building A logged</span>
                <div className="w-2.5 h-2.5 rounded-full bg-[#dae2fd]"></div>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg border border-[#334155] hover:border-[#4be277]/30 transition-colors duration-200">
                <span className="text-sm text-[#e0e3e5]">Feed stock reviewed</span>
                <div className="w-2.5 h-2.5 rounded-full bg-[#dae2fd]"></div>
              </div>
              <div className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg border border-[#ef4444]/30 hover:border-[#ef4444]/50 transition-colors duration-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#ef4444]/5 pointer-events-none"></div>
                <span className="text-sm text-[#e0e3e5] relative z-10 font-medium">Inventory alert open</span>
                <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] relative z-10 animate-pulse"></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Info Cards / Pre-Footer */}
      <section className="border-t border-[#334155] bg-[#101415]/50">
        <div className="max-w-[1440px] mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-[#bccbb9] text-sm">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3 font-jetbrains text-[#e0e3e5]">
              Viewer Access
            </p>
            <p className="leading-relaxed">
              Viewers can inspect live batch health, logs, and feeding schedules without administrative privileges.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3 font-jetbrains text-[#e0e3e5]">
              Member Operations
            </p>
            <div className="grid grid-cols-1 gap-4 mt-2">
              <div className="bg-[#1e293b]/50 p-4 rounded-lg border border-[#334155]/60 hover:border-[#4be277]/20 transition-all duration-200">
                <h4 className="text-sm font-semibold text-white mb-1">Daily checks</h4>
                <p className="text-xs text-[#bccbb9]">Record mortality stats, feed usage details, temperature fluctuations, and water logs.</p>
              </div>
              <div className="bg-[#1e293b]/50 p-4 rounded-lg border border-[#334155]/60 hover:border-[#4be277]/20 transition-all duration-200">
                <h4 className="text-sm font-semibold text-white mb-1">Production trends</h4>
                <p className="text-xs text-[#bccbb9]">Gain visibility into cost per bird, average body weights, feed conversion ratios, and harvest records.</p>
              </div>
              <div className="bg-[#1e293b]/50 p-4 rounded-lg border border-[#334155]/60 hover:border-[#4be277]/20 transition-all duration-200">
                <h4 className="text-sm font-semibold text-white mb-1">Inventory alerts</h4>
                <p className="text-xs text-[#bccbb9]">Track stock status, set alerts for critical feed shortages, and monitor vaccination storage levels.</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-3 font-jetbrains text-[#e0e3e5]">
              Security Scope
            </p>
            <p className="leading-relaxed">
              Role-based restrictions protect ledger operations, harvest payments, and employee management tools.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0b0f10] border-t border-[#3d4a3d]/20 py-8">
        <div className="max-w-[1440px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#bccbb9]">
          <span className="font-jetbrains">
            © 2024 Octavio Poultry Farm Management System
          </span>
          <nav className="flex gap-6">
            <span className="hover:text-[#4be277] cursor-pointer transition-colors duration-200">Daily Checks</span>
            <span className="hover:text-[#4be277] cursor-pointer transition-colors duration-200">Production Trends</span>
            <span className="hover:text-[#4be277] cursor-pointer transition-colors duration-200">Inventory Alerts</span>
            <span className="hover:text-[#4be277] cursor-pointer transition-colors duration-200">Privacy Policy</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
