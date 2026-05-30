export default function BatchSelector({
  activeBatch,
  batches,
  isBatchListLoading,
  onChange,
  id = 'batch-selector',
  variant = 'detailed', // 'detailed' or 'simple'
  className = ''
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <select
        id={id}
        value={activeBatch?.id || ''}
        onChange={onChange}
        disabled={isBatchListLoading || batches.length === 0}
        className="w-full h-full rounded border border-app-border bg-app-card px-2 text-app-text outline-none transition focus:ring-1 focus:ring-app-accent cursor-pointer pr-7 appearance-none disabled:cursor-not-allowed disabled:opacity-60 text-xs font-bold"
      >
        {isBatchListLoading && <option value="" className="bg-app-card text-app-text">Loading...</option>}
        {!isBatchListLoading && batches.length === 0 && <option value="" className="bg-app-card text-app-text">None</option>}
        {batches.map((batch) => (
          <option key={batch.id} value={batch.id} className="bg-app-card text-app-text">
            {variant === 'detailed'
              ? `${batch.id} (${batch.status || 'No status'})`
              : batch.id
            }
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-app-text-secondary/70">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </span>
    </div>
  );
}
