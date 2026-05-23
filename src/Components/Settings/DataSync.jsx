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
      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Export Files</h3>

        {exportError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
            {exportError}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">File</label>
            <select
              value={dataset}
              onChange={(event) => setDataset(event.target.value)}
              disabled={!exportAllowed}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none disabled:opacity-60"
            >
              {exportDatasets.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {exportUsesBatch && (
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Scope</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExportScope('active')}
                  disabled={!exportAllowed}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all disabled:opacity-60 ${
                    exportScope === 'active'
                      ? 'bg-secondary text-white border-secondary'
                      : 'bg-neutral-light dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-neutral-border dark:border-gray-600'
                  }`}
                >
                  Active Batch
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  disabled={!exportAllowed}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all disabled:opacity-60 ${
                    exportScope === 'all'
                      ? 'bg-secondary text-white border-secondary'
                      : 'bg-neutral-light dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-neutral-border dark:border-gray-600'
                  }`}
                >
                  All Batches
                </button>
              </div>
            </div>
          )}

          <div className="bg-neutral-light dark:bg-gray-900 rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{exportHint}</p>
            {effectiveBatchId && (
              <p className="text-[10px] text-primary font-black mt-1">Batch {effectiveBatchId}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={!exportAllowed || isExporting}
            className="w-full bg-secondary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all disabled:opacity-60"
          >
            {isExporting ? 'Preparing...' : 'Download CSV'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Import Files</h3>

        {importError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
            {importError}
          </div>
        )}
        {importMessage && (
          <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm font-bold mb-4 border border-green-200">
            {importMessage}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Import Type</label>
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
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none disabled:opacity-60"
            >
              {importDatasets.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">File</label>
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
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none disabled:opacity-60 text-sm"
            />
          </div>

          {importFile && (
            <div className="bg-neutral-light dark:bg-gray-900 rounded-xl p-3">
              <p className="text-xs font-black text-gray-700 dark:text-gray-200 truncate">{importFile.name}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">
                {(importFile.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB
              </p>
            </div>
          )}

          {importSummary && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(importSummary).map(([key, item]) => (
                <div key={key} className="rounded-xl bg-neutral-light dark:bg-gray-900 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{item.label || key}</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white mt-1">
                    +{item.created || 0} / {item.updated || 0}
                  </p>
                  {item.skipped > 0 && (
                    <p className="text-[10px] font-bold text-semantic-warning mt-1">
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
            className="w-full bg-primary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all disabled:opacity-60"
          >
            {isImporting ? 'Importing...' : 'Import File'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Archive System</h3>

        {archiveError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
            {archiveError}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Archive Scope</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setArchiveScope('active')}
                disabled={!exportAllowed}
                className={`p-3 rounded-xl border text-sm font-bold transition-all disabled:opacity-60 ${
                  archiveScope === 'active'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-neutral-light dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-neutral-border dark:border-gray-600'
                }`}
              >
                Active Batch
              </button>
              <button
                type="button"
                onClick={() => setArchiveScope('all')}
                disabled={!exportAllowed}
                className={`p-3 rounded-xl border text-sm font-bold transition-all disabled:opacity-60 ${
                  archiveScope === 'all'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-neutral-light dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-neutral-border dark:border-gray-600'
                }`}
              >
                All Batches
              </button>
            </div>
          </div>

          <div className="bg-neutral-light dark:bg-gray-900 rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
              Archive downloads include batch records, loadings, ledger entries, daily logs, inventory, and employee compensation data.
            </p>
            {archiveBatchId && (
              <p className="text-[10px] text-primary font-black mt-1">Batch {archiveBatchId}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleArchiveDownload}
            disabled={!exportAllowed || isArchiving}
            className="w-full bg-primary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all disabled:opacity-60"
          >
            {isArchiving ? 'Preparing Archive...' : 'Download Archive JSON'}
          </button>
        </div>
      </div>
    </>
  );
}
