import Button from './Button';

/**
 * Reusable empty state for blank farm logs, missing drafts, or empty searches.
 */
export default function EmptyState({
  title = 'No mortality logged today.',
  description = "Add today's mortality count to keep your batch records accurate.",
  icon = 'database_off',
  actionText = 'Add Mortality',
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
