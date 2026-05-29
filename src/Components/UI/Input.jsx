import React from 'react';

/**
 * Premium reusable Form Input component with validation border, active rings, label, and error layout.
 */
export default React.forwardRef(function Input({
  label = '',
  error = '',
  helperText = '',
  className = '',
  icon = '',
  id,
  ...props
}, ref) {
  const inputId = id || React.useId();
  const borderStyle = error
    ? 'border-app-danger focus:ring-app-danger/20 focus:border-app-danger'
    : 'border-app-border focus:ring-app-accent/20 focus:border-app-accent';

  return (
    <div className={`w-full flex flex-col ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-app-text-secondary mb-1.5 font-hanken select-none"
        >
          {label}
        </label>
      )}
      
      <div className="relative flex items-center">
        {icon && (
          <span
            className="material-symbols-outlined absolute left-3.5 text-app-text-secondary text-lg pointer-events-none select-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full ${
            icon ? 'pl-11' : 'pl-4'
          } pr-4 py-3 border rounded-xl bg-app-bg text-app-text text-sm outline-none focus:ring-4 transition-all duration-200 placeholder:text-app-text-secondary/50 font-medium ${borderStyle}`}
          {...props}
        />
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
