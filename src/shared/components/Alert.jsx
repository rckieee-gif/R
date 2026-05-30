/**
 * Premium reusable Alert callout component for warnings, validation summaries, and operational updates.
 */
export default function Alert({
  title = '',
  children,
  variant = 'info',
  icon = '',
  className = '',
  onClose,
  ...props
}) {
  const baseStyle = 'relative flex gap-3 p-4 rounded-xl border font-inter text-xs leading-relaxed animate-[fadeIn_0.2s_ease-out]';

  const defaultIcons = {
    info: 'info',
    success: 'check_circle',
    warning: 'warning',
    error: 'error',
  };

  const variants = {
    info: 'bg-app-info/5 border-app-info/20 text-app-text-secondary select-none [&_.alert-icon]:text-app-info [&_.alert-title]:text-app-text',
    success: 'bg-app-success/5 border-app-success/20 text-app-text-secondary select-none [&_.alert-icon]:text-app-success [&_.alert-title]:text-app-text',
    warning: 'bg-app-warning/5 border-app-warning/20 text-app-text-secondary select-none [&_.alert-icon]:text-app-warning [&_.alert-title]:text-app-text',
    error: 'bg-app-danger/5 border-app-danger/20 text-app-text-secondary select-none [&_.alert-icon]:text-app-danger [&_.alert-title]:text-app-text',
  };

  const selectedIcon = icon || defaultIcons[variant];

  return (
    <div
      role="alert"
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      <span className="material-symbols-outlined alert-icon text-lg shrink-0 select-none" aria-hidden="true">
        {selectedIcon}
      </span>
      <div className="flex-1 space-y-1">
        {title && <h5 className="alert-title font-black font-hanken tracking-tight text-sm select-none">{title}</h5>}
        <div className="font-semibold text-app-text-secondary">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-app-text-secondary hover:text-app-text p-0.5 rounded-lg transition-colors cursor-pointer select-none self-start"
          aria-label="Close alert"
        >
          <span className="material-symbols-outlined text-sm block" aria-hidden="true">close</span>
        </button>
      )}
    </div>
  );
}
