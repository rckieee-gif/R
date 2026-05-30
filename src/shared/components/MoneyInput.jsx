export default function MoneyInput({
  id,
  label,
  value,
  onChange,
  placeholder = '0.00',
  required = false,
  disabled = false,
  readOnly = false,
  min = 0,
  className = ''
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">
          {label}
        </label>
      )}
      <div className="relative rounded-xl shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <span className="text-app-text-secondary text-xs font-bold font-jetbrains select-none">PHP</span>
        </div>
        <input
          id={id}
          type="number"
          step="0.01"
          min={min}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-11 pr-3 py-2 border border-app-border rounded-xl text-app-text text-sm font-bold bg-app-bg placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains ${
            disabled || readOnly ? 'bg-app-bg/50 cursor-not-allowed text-app-text/70' : ''
          }`}
        />
      </div>
    </div>
  );
}
