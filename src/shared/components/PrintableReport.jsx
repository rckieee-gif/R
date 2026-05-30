export default function PrintableReport({
  title = '',
  subtitle = '',
  onPrint,
  className = '',
  children
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center no-print">
        <h2 className="text-sm font-black text-app-text-secondary uppercase tracking-wider select-none font-hanken">
          {title}
        </h2>
        <button
          onClick={onPrint || (() => window.print())}
          className="flex items-center gap-1.5 px-3 py-2 bg-app-card border border-app-border text-xs font-black text-app-text rounded-xl hover:border-app-accent hover:text-app-accent transition-all shadow-sm cursor-pointer select-none font-hanken"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">print</span>
          Print Report
        </button>
      </div>

      <div className="print-report border border-app-border rounded-2xl bg-app-card p-6 shadow-sm">
        {/* Printable Header - hidden on screen, visible during printing */}
        <div className="hidden print-only mb-6 border-b border-app-border pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-extrabold uppercase text-app-text tracking-tighter font-hanken">Octavio Farms</h1>
              <p className="text-[10px] font-black text-app-text-secondary uppercase tracking-widest font-jetbrains mt-1">
                {title || 'Financial Report'}
              </p>
              {subtitle && <p className="text-xs text-app-text-secondary mt-1.5 font-semibold font-inter">{subtitle}</p>}
            </div>
            <div className="text-right text-[10px] font-jetbrains text-app-text-secondary">
              <p>Printed: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </div>

        {/* Report Content */}
        {children}
      </div>
    </div>
  );
}
