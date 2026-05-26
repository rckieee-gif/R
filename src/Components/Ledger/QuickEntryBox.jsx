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
    <div className="rounded-xl border border-app-border bg-app-bg/50 p-4 space-y-3">
      <div>
        <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Quick Entry</label>
        <textarea
          rows="3"
          value={quickEntryText}
          onChange={(e) => {
            setQuickEntryText(e.target.value);
            setPendingQuickEntry(null);
            setQuickEntryStatus('');
          }}
          placeholder="Describe transaction details (e.g. bought 25 sacks of charcoal for 300 pesos)"
          className="w-full p-2.5 border border-app-border rounded-xl bg-app-card text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setQuickEntryText(example);
              setPendingQuickEntry(null);
              setQuickEntryStatus('');
            }}
            className="px-2 py-1 rounded-lg border border-app-border text-app-text-secondary text-[11px] font-bold bg-app-bg hover:border-app-accent hover:text-app-accent hover:bg-app-accent/5 transition-all cursor-pointer"
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
          className="px-3 py-2 rounded-xl bg-app-accent text-app-on-accent text-xs font-black shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
        >
          {isParsingQuickEntry ? 'Parsing...' : 'Parse Quick Entry'}
        </button>
        {quickEntryStatus && (
          <p className="text-[11px] font-bold text-app-text-secondary text-right">
            {quickEntryStatus}
          </p>
        )}
      </div>

      {parsedPreview && (
        <div className="rounded-xl border border-app-warning bg-app-warning-bg p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-app-warning">
                Parsed Preview
              </p>
              <p className="text-sm font-black text-app-text mt-1">
                {parsedPreview.type} - {parsedPreview.fundingNature} / {parsedPreview.category}
              </p>
              <p className="text-xs font-bold text-app-text-secondary mt-1 font-jetbrains">
                {parsedPreview.description} - PHP {formattedAmount}
              </p>
            </div>
            <span className="text-[11px] font-black text-app-warning font-jetbrains">
              {confidencePct}% Match
            </span>
          </div>

          {replacementRows.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-lg border border-app-warning/20 bg-app-bg/50">
              {replacementRows.map((row) => (
                <div key={row.key} className="grid grid-cols-[96px_1fr] gap-2 border-b last:border-b-0 border-app-warning/10 px-2 py-1.5 text-[11px]">
                  <span className="font-black text-app-text-secondary">{row.label}</span>
                  <span className="font-bold text-app-text font-jetbrains">
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
              className="px-3 py-2 rounded-xl bg-app-accent text-app-on-accent text-xs font-black shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              Send to Ledger Form
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingQuickEntry(null);
                setQuickEntryStatus('Parsed entry discarded.');
              }}
              className="px-3 py-2 rounded-xl bg-app-bg text-app-text border border-app-border text-xs font-black hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              Discard Parse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
