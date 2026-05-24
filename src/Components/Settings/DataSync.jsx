import { useMemo } from 'react';

const exportDatasets = [
  { value: 'transactions', label: 'Ledger Transactions' },
  { value: 'daily_logs', label: 'Daily Logs' },
  { value: 'inventory', label: 'Inventory Movements' },
  { value: 'employees', label: 'Employees' },
  { value: 'batches', label: 'Batches' }
];

const importDatasets = [
  { value: 'transactions', label: 'Ledger Transactions', accept: '.csv,text/csv' },
  { value: 'daily_logs', label: 'Daily Logs', accept: '.csv,text/csv' },
  { value: 'inventory', label: 'Inventory Movements', accept: '.csv,text/csv' },
  { value: 'employees', label: 'Employees', accept: '.csv,text/csv' },
  { value: 'batch_archive', label: 'Single Batch Archive', accept: '.json,application/json' }
];

export default function DataSync({
  exportAllowed,
  dataset,
  setDataset,
  exportScope,
  setExportScope,
  exportError,
  exportUsesBatch,
  exportHint,
  effectiveBatchId,
  handleExport,
  isExporting,

  importError,
  importMessage,
  importType,
  setImportType,
  importFile,
  setImportFile,
  importSummary,
  setImportSummary,
  setImportError,
  setImportMessage,
  handleImport,
  isImporting,

  archiveError,
  archiveScope,
  setArchiveScope,
  archiveBatchId,
  handleArchiveDownload,
  isArchiving
}) {
  const selectedImportDataset = useMemo(() => {
    return importDatasets.find((option) => option.value === importType) || importDatasets[0];
  }, [importType]);

  return (
    <>
      <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6 font-hanken">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-4">Export Database</h3>

        {exportError && (
          <div className="bg-app-danger-bg text-app-danger p-3 rounded-xl text-sm font-bold mb-4 border border-app-danger">
            {exportError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">File Dataset</label>
            <select
              value={dataset}
              onChange={(event) => setDataset(event.target.value)}
              disabled={!exportAllowed}
              className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exportDatasets.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {exportUsesBatch && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Scope</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExportScope('active')}
                  disabled={!exportAllowed}
                  className={`p-2.5 rounded-xl border font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    exportScope === 'active'
                      ? 'bg-app-accent text-app-on-accent border-app-accent shadow-sm scale-102'
                      : 'bg-app-bg text-app-text-secondary border-app-border hover:bg-app-accent/5 hover:text-app-accent'
                  }`}
                >
                  Active Batch
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  disabled={!exportAllowed}
                  className={`p-2.5 rounded-xl border font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    exportScope === 'all'
                      ? 'bg-app-accent text-app-on-accent border-app-accent shadow-sm scale-102'
                      : 'bg-app-bg text-app-text-secondary border-app-border hover:bg-app-accent/5 hover:text-app-accent'
                  }`}
                >
                  All Batches
                </button>
              </div>
            </div>
          )}

          <div className="bg-app-bg rounded-xl p-3 border border-app-border/40">
            <p className="text-xs text-app-text-secondary font-bold">{exportHint}</p>
            {effectiveBatchId && (
              <p className="text-[10px] text-app-accent font-black mt-1.5 uppercase tracking-wider font-jetbrains">Batch {effectiveBatchId}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={!exportAllowed || isExporting}
            className="w-full bg-app-accent text-app-on-accent p-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-102 active:scale-98 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isExporting ? 'Preparing...' : 'Download CSV'}
          </button>
        </div>
      </div>

      <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6 font-hanken">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-4">Import Records</h3>

        {importError && (
          <div className="bg-app-danger-bg text-app-danger p-3 rounded-xl text-sm font-bold mb-4 border border-app-danger">
            {importError}
          </div>
        )}
        {importMessage && (
          <div className="bg-app-success-bg text-app-success p-3 rounded-xl text-sm font-bold mb-4 border border-app-success">
            {importMessage}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Import Type</label>
            <select
              value={importType}
              onChange={(event) => {
                setImportType(event.target.value);
                setImportFile(null);
                setImportSummary(null);
                setImportError('');
                setImportMessage('');
              }}
              disabled={!exportAllowed}
              className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importDatasets.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">File Upload</label>
            <input
              type="file"
              accept={selectedImportDataset.accept}
              disabled={!exportAllowed}
              onChange={(event) => {
                setImportFile(event.target.files?.[0] || null);
                setImportSummary(null);
                setImportError('');
                setImportMessage('');
              }}
              className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none disabled:opacity-40 disabled:cursor-not-allowed file:mr-4 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-app-accent file:text-app-on-accent hover:file:opacity-90 file:cursor-pointer"
            />
          </div>

          {importFile && (
            <div className="bg-app-bg rounded-xl p-3 border border-app-border/40">
              <p className="text-xs font-black text-app-text truncate font-jetbrains">{importFile.name}</p>
              <p className="text-[10px] font-bold text-app-text-secondary mt-1 font-jetbrains">
                {(importFile.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB
              </p>
            </div>
          )}

          {importSummary && (
            <div className="grid grid-cols-2 gap-2 font-jetbrains">
              {Object.entries(importSummary).map(([key, item]) => (
                <div key={key} className="rounded-xl bg-app-bg border border-app-border/40 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">{item.label || key}</p>
                  <p className="text-sm font-black text-app-text mt-1">
                    +{item.created || 0} / {item.updated || 0}
                  </p>
                  {item.skipped > 0 && (
                    <p className="text-[10px] font-black text-app-warning mt-1.5">
                      {item.skipped} skipped
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleImport}
            disabled={!exportAllowed || !importFile || isImporting}
            className="w-full bg-app-accent text-app-on-accent p-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-102 active:scale-98 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isImporting ? 'Importing...' : 'Import File'}
          </button>
        </div>
      </div>

      <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6 font-hanken">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-4">Archive System</h3>

        {archiveError && (
          <div className="bg-app-danger-bg text-app-danger p-3 rounded-xl text-sm font-bold mb-4 border border-app-danger">
            {archiveError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Archive Scope</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setArchiveScope('active')}
                disabled={!exportAllowed}
                className={`p-2.5 rounded-xl border font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  archiveScope === 'active'
                    ? 'bg-app-accent text-app-on-accent border-app-accent shadow-sm scale-102'
                    : 'bg-app-bg text-app-text-secondary border-app-border hover:bg-app-accent/5 hover:text-app-accent'
                }`}
              >
                Active Batch
              </button>
              <button
                type="button"
                onClick={() => setArchiveScope('all')}
                disabled={!exportAllowed}
                className={`p-2.5 rounded-xl border font-black text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  archiveScope === 'all'
                    ? 'bg-app-accent text-app-on-accent border-app-accent shadow-sm scale-102'
                    : 'bg-app-bg text-app-text-secondary border-app-border hover:bg-app-accent/5 hover:text-app-accent'
                }`}
              >
                All Batches
              </button>
            </div>
          </div>

          <div className="bg-app-bg rounded-xl p-3 border border-app-border/40">
            <p className="text-xs text-app-text-secondary font-bold">
              Archive downloads include batch records, loadings, ledger entries, daily logs, inventory, and employee compensation data.
            </p>
            {archiveBatchId && (
              <p className="text-[10px] text-app-accent font-black mt-1.5 uppercase tracking-wider font-jetbrains">Batch {archiveBatchId}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleArchiveDownload}
            disabled={!exportAllowed || isArchiving}
            className="w-full bg-app-accent text-app-on-accent p-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-102 active:scale-98 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isArchiving ? 'Preparing Archive...' : 'Download Archive JSON'}
          </button>
        </div>
      </div>
    </>
  );
}
