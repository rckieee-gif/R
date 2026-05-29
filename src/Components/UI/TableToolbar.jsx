import React from 'react';

/**
 * Premium reusable TableToolbar component providing unified layout for search inputs and dynamic filters.
 */
export default function TableToolbar({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters = [],
  actions = null,
  className = '',
  ...props
}) {
  return (
    <div
      className={`flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4.5 p-3 rounded-2xl border border-app-border bg-app-card shadow-sm ${className}`}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {/* Search Input */}
        {onSearchChange && (
          <div className="relative min-w-[200px] max-w-sm flex-1 md:flex-initial">
            <span
              className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-secondary text-base select-none pointer-events-none"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-xs outline-none focus:ring-4 focus:ring-app-accent/20 focus:border-app-accent font-semibold transition-all duration-200"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-secondary hover:text-app-text cursor-pointer select-none"
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined text-sm leading-none block" aria-hidden="true">close</span>
              </button>
            )}
          </div>
        )}

        {/* Dynamic Filters */}
        {filters.map((filter, index) => (
          <div key={filter.key || index} className="relative min-w-[120px] max-w-[180px] flex-1 md:flex-initial">
            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="w-full pl-3.5 pr-8 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-xs outline-none focus:ring-4 focus:ring-app-accent/20 focus:border-app-accent font-bold cursor-pointer appearance-none transition-all duration-200"
              aria-label={filter.label || `Filter ${index + 1}`}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span
              className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-app-text-secondary pointer-events-none select-none text-base"
              aria-hidden="true"
            >
              keyboard_arrow_down
            </span>
          </div>
        ))}
      </div>

      {/* Actions (Buttons/Downloads) */}
      {actions && (
        <div className="flex items-center gap-2 md:self-auto self-end">
          {actions}
        </div>
      )}
    </div>
  );
}
