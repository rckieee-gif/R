import React from 'react';
import Button from './Button';

/**
 * Premium reusable Empty State component to represent blank lists, missing drafts, or empty searches.
 */
export default function EmptyState({
  title = 'No records found',
  description = 'There is currently no data to display here.',
  icon = 'database_off',
  actionText = '',
  onAction,
  className = '',
  ...props
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-app-border bg-app-card/30 backdrop-blur-sm select-none ${className}`}
      {...props}
    >
      <div className="p-4 bg-app-bg rounded-2xl border border-app-border text-app-text-secondary/60 mb-4.5 shadow-inner">
        <span className="material-symbols-outlined text-4xl block leading-none" aria-hidden="true">
          {icon}
        </span>
      </div>
      
      <h4 className="text-base font-extrabold tracking-tight text-app-text font-hanken">
        {title}
      </h4>
      
      <p className="text-xs text-app-text-secondary mt-2 max-w-xs leading-relaxed font-semibold">
        {description}
      </p>

      {actionText && onAction && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={onAction}
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}
