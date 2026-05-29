import React from 'react';

/**
 * Premium status pill badge component.
 */
export default function Badge({
  children,
  variant = 'info',
  className = '',
  icon = '',
  ...props
}) {
  const baseStyle = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider select-none shrink-0 w-fit font-jetbrains';

  const variants = {
    info: 'bg-app-accent/10 text-app-accent border border-app-accent/20',
    success: 'bg-app-success/10 text-app-success border border-app-success/20',
    danger: 'bg-app-danger/10 text-app-danger border border-app-danger/20',
    warning: 'bg-app-warning/10 text-app-warning border border-app-warning/20',
    ongoing: 'bg-app-accent/15 text-app-accent border border-app-accent/30',
    closed: 'bg-app-text-secondary/15 text-app-text-secondary border border-app-border',
    safe: 'bg-app-success/15 text-app-success border border-app-success/30',
  };

  return (
    <span
      className={`${baseStyle} ${variants[variant]} ${className}`}
      {...props}
    >
      {icon && (
        <span className="material-symbols-outlined text-[12px] leading-none" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
