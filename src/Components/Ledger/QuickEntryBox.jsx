import { useMemo } from 'react';

export default function QuickEntryBox({
  quickEntryText,
  setQuickEntryText,
  quickEntryStatus,
  setQuickEntryStatus,
  pendingQuickEntry,
  setPendingQuickEntry,
  isParsingQuickEntry,
  handleQuickEntryParse,
  confirmApplyQuickEntry,
  getQuickEntryReplacementRows
}) {
  const examples = useMemo(() => [
    'bought 25 sacks of charcoal for 300 pesos',
    'Sold 200 sacks of chicken dung for 35',
    'paid helper yesterday 500 pesos',
    'customer paid balance 1000'
  ], []);

  const parsedPreview = pendingQuickEntry?.parsed;
  const replacementRows = useMemo(() => {
    if (!parsedPreview) return [];
    return getQuickEntryReplacementRows(parsedPreview);
  }, [parsedPreview, getQuickEntryReplacementRows]);

  const formattedAmount = useMemo(() => {
    if (!parsedPreview) return '0.00';
    return Number(parsedPreview.amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2
    });
  }, [parsedPreview]);

  const confidencePct = useMemo(() => {
    if (!parsedPreview) return 0;
    return Math.round(Number(parsedPreview.confidence || 0) * 100);
  }, [parsedPreview]);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3 space-y-3">
      <div>
        <label className="block text-xs font-bold text-primary mb-1">Quick Entry</label>
        <textarea
          rows="3"
          value={quickEntryText}
          onChange={(e) => {
            setQuickEntryText(e.target.value);
            setPendingQuickEntry(null);
            setQuickEntryStatus('');
          }}
          placeholder="Write the description"
          className="w-full p-2 border border-primary/20 dark:border-primary/40 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQuickEntryText(example);
              setPendingQuickEntry(null);
              setQuickEntryStatus('');
            }}
            className="px-2 py-1 rounded-lg border border-primary/30 text-primary dark:text-blue-300 text-[11px] font-black hover:bg-primary hover:text-white transition-colors"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleQuickEntryParse}
          disabled={isParsingQuickEntry}
          className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-black disabled:opacity-60"
        >
          {isParsingQuickEntry ? 'Parsing...' : 'Parse Quick Entry'}
        </button>
        {quickEntryStatus && (
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-300 text-right">
            {quickEntryStatus}
          </p>
        )}
      </div>

      {parsedPreview && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Parsed Preview
              </p>
              <p className="text-sm font-black text-gray-800 dark:text-white mt-1">
                {parsedPreview.type} - {parsedPreview.fundingNature} / {parsedPreview.category}
              </p>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-300 mt-1">
                {parsedPreview.description} - PHP {formattedAmount}
              </p>
            </div>
            <span className="text-[11px] font-black text-amber-700 dark:text-amber-300">
              {confidencePct}%
            </span>
          </div>

          {replacementRows.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-lg border border-amber-200 dark:border-amber-800/70 bg-white/70 dark:bg-gray-900/30">
              {replacementRows.map((row) => (
                <div key={row.key} className="grid grid-cols-[96px_1fr] gap-2 border-b last:border-b-0 border-amber-100 dark:border-amber-900/60 px-2 py-1.5 text-[11px]">
                  <span className="font-black text-gray-500 dark:text-gray-400">{row.label}</span>
                  <span className="font-bold text-gray-700 dark:text-gray-200">
                    {row.from} {'->'} {row.to}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmApplyQuickEntry}
              className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-black hover:bg-amber-700"
            >
              Send to Ledger Form
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingQuickEntry(null);
                setQuickEntryStatus('Parsed entry discarded.');
              }}
              className="px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-black"
            >
              Discard Parse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
