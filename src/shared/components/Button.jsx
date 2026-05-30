/**
 * Premium, stateful reusable Button component with loading spinner support and custom themes.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon = '',
  className = '',
  disabled = false,
  type = 'button',
  ...props
}) {
  const baseStyle = 'inline-flex items-center justify-center font-bold tracking-tight rounded-xl transition-all active:scale-[0.98] cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-app-card disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-app-accent text-app-on-accent hover:opacity-90 shadow-sm focus:ring-app-accent',
    secondary: 'bg-app-card text-app-text border border-app-border hover:bg-app-bg focus:ring-app-accent',
    danger: 'bg-app-danger text-white hover:opacity-90 shadow-sm focus:ring-app-danger',
    warning: 'bg-app-warning text-white hover:opacity-90 shadow-sm focus:ring-app-warning',
    success: 'bg-app-success text-white hover:opacity-90 shadow-sm focus:ring-app-success',
    outline: 'bg-transparent text-app-accent border border-app-accent hover:bg-app-accent/10 focus:ring-app-accent',
    ghost: 'bg-transparent text-app-text-secondary hover:bg-app-card hover:text-app-text focus:ring-app-accent',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4.5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3.5 text-base gap-2.5',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="material-symbols-outlined text-sm animate-spin" aria-hidden="true">
          progress_activity
        </span>
      ) : icon ? (
        <span className="material-symbols-outlined text-[1.1em] leading-none shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
