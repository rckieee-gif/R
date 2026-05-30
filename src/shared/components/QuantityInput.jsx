export default function QuantityInput({
  id,
  label,
  value,
  onChange,
  unit = 'units',
  placeholder = '0',
  required = false,
  disabled = false,
  min = 0,
  step = 'any',
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
        <input
          id={id}
          type="number"
          step={step}
          min={min}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pr-14 pl-3 py-2 border border-app-border rounded-xl text-app-text text-sm font-bold bg-app-bg placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains ${
            disabled ? 'bg-app-bg/50 cursor-not-allowed text-app-text/70' : ''
          }`}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <span className="text-app-text-secondary text-[10px] font-black uppercase tracking-wider font-jetbrains select-none">
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
}
