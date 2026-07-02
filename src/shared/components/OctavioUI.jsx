export function Card({ className = '', children, as: Component = 'div' }) {
  return (
    <Component className={`rounded-2xl border border-app-border bg-app-card octavio-shadow ${className}`}>
      {children}
    </Component>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="octavio-serif text-[32px] leading-tight font-bold text-app-text">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-app-text-secondary">{subtitle}</p>}
      </div>
      {action && <div className="no-print shrink-0">{action}</div>}
    </div>
  );
}

export function Button({ variant = 'primary', className = '', children, ...props }) {
  const variants = {
    primary: 'bg-app-accent text-app-on-accent border-app-accent hover:bg-[#437447]',
    secondary: 'bg-app-card text-app-text border-app-border hover:bg-white',
    ghost: 'bg-transparent text-app-text border-transparent hover:bg-white/60',
    danger: 'bg-app-danger text-white border-app-danger hover:bg-[#b72f2a]',
  };

  return (
    <button
      type="button"
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ tone = 'beige', className = '', children }) {
  const tones = {
    beige: 'bg-[#f1dfbd] text-app-text',
    success: 'bg-app-success-bg text-app-success',
    danger: 'bg-app-danger-bg text-app-danger',
    warning: 'bg-app-warning-bg text-app-warning',
    info: 'bg-app-info-bg text-app-info',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${tones[tone] || tones.beige} ${className}`}>
      {children}
    </span>
  );
}

export function SearchInput({ className = '', ...props }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-app-text-secondary">
        search
      </span>
      <input
        type="search"
        className="h-9 w-full rounded-full border border-app-border bg-app-card pl-10 pr-4 text-sm text-app-text shadow-sm outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
        {...props}
      />
    </label>
  );
}

export function Modal({ open, title, helperText, onClose, children, footer, maxWidth = 'max-w-lg' }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6">
      <Card className={`relative w-full ${maxWidth} bg-[#fffaf0] p-6`}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-app-text-secondary hover:bg-app-border/40 hover:text-app-text cursor-pointer"
          aria-label="Close modal"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
        <div className="mb-4 pr-8">
          <h2 className="octavio-serif text-xl font-bold text-app-text">{title}</h2>
          {helperText && <p className="mt-1 text-sm text-app-text-secondary">{helperText}</p>}
        </div>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-3">{footer}</div>}
      </Card>
    </div>
  );
}

export function FormField({ label, required = false, error, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-semibold text-app-text">
        {label}{required ? ' *' : ''}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-semibold text-app-danger">{error}</span>}
    </label>
  );
}

const fieldClass = 'h-10 w-full rounded-xl border border-app-border bg-app-card px-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/20';

export function TextInput(props) {
  return <input className={fieldClass} {...props} />;
}

export function TextArea(props) {
  return <textarea className={`${fieldClass} h-16 resize-y py-2`} {...props} />;
}

export function SelectField({ children, ...props }) {
  return (
    <select className={fieldClass} {...props}>
      {children}
    </select>
  );
}

export function SectionLabel({ children }) {
  return <p className="octavio-serif mt-4 mb-3 text-sm font-bold uppercase tracking-wide text-app-text-secondary">{children}</p>;
}

export function MetricCard({ label, value, detail, icon, tone = 'success', valueClassName = 'text-app-text' }) {
  const toneClass = {
    success: 'bg-app-success-bg text-app-success',
    warning: 'bg-app-warning-bg text-app-warning',
    danger: 'bg-app-danger-bg text-app-danger',
    info: 'bg-app-info-bg text-app-info',
    beige: 'bg-app-gray-bg text-app-text-secondary',
  }[tone] || 'bg-app-success-bg text-app-success';

  return (
    <Card className="min-h-[132px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="max-w-[92px] text-[12px] font-semibold uppercase leading-tight tracking-wide text-app-text-secondary">{label}</p>
          <p className={`mt-2 text-2xl font-bold leading-none ${valueClassName}`}>{value}</p>
          {detail && <p className="mt-3 text-xs leading-snug text-app-text-secondary">{detail}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneClass}`}>
          <span className="material-symbols-outlined text-[21px]" style={{ fontVariationSettings: "'FILL' 0" }}>
            {icon}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function AlertCard({ title, icon, tone = 'warning', children }) {
  const tones = {
    danger: 'border-[#f0a49a] bg-[#fde8e0]',
    warning: 'border-[#efbf72] bg-[#f9e7bf]',
    success: 'border-[#9dcca4] bg-[#edf6e6]',
    info: 'border-[#a8c7cd] bg-[#e7f0f1]',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.warning}`}>
      <div className="mb-2 flex items-center gap-2 font-bold text-app-text">
        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 0" }}>
          {icon}
        </span>
        <span className="octavio-serif">{title}</span>
      </div>
      <div className="text-sm leading-6 text-app-text">{children}</div>
    </div>
  );
}

export function DataTable({ columns, rows, emptyMessage = 'No records yet.', rowKey = 'id', className = '' }) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[#f2eadc] text-xs uppercase tracking-wide text-app-text-secondary">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-4 py-3 text-left font-semibold ${column.className || ''}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row[rowKey] ?? index} className="border-t border-app-border bg-app-card">
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-4 align-middle ${column.cellClassName || ''}`}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-app-text-secondary">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
