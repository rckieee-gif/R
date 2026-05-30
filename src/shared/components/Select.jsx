import React from 'react';

/**
 * Premium reusable Form Select component with label, validation state, and custom option support.
 */
export default React.forwardRef(function Select({
  label = '',
  error = '',
  helperText = '',
  className = '',
  id,
  children,
  ...props
}, ref) {
  const defaultId = React.useId();
  const selectId = id || defaultId;
  const borderStyle = error
    ? 'border-app-danger focus:ring-app-danger focus:border-app-danger'
    : 'border-app-border focus:ring-app-accent focus:border-app-accent';

  return (
    <div className={`w-full flex flex-col ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-bold text-app-text-secondary mb-1.5 font-hanken select-none"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          ref={ref}
          className={`w-full pl-4 pr-10 py-3 border rounded-xl bg-app-bg text-app-text text-sm outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-app-card transition-all duration-200 font-bold appearance-none cursor-pointer ${borderStyle}`}
          {...props}
        >
          {children}
        </select>
        <span
          className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-app-text-secondary pointer-events-none select-none text-lg"
          aria-hidden="true"
        >
          keyboard_arrow_down
        </span>
      </div>

      {error ? (
        <p className="text-[11px] font-semibold text-app-danger mt-1.5 flex items-center gap-1 select-none font-inter animate-[fadeIn_0.15s_ease-out]">
          <span className="material-symbols-outlined text-xs leading-none">error</span>
          {error}
        </p>
      ) : helperText ? (
        <p className="text-[11px] font-medium text-app-text-secondary/75 mt-1.5 select-none font-inter">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
