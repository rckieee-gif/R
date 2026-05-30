import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../shared/utils/apiClient';
import { useNotification } from '../../shared/hooks/useNotification';

function toDateInput(value) {
  return value?.split('T')[0] || value || '';
}

function formatPercent(value) {
  const numberValue = Number(value || 0);
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(2);
}

function getBuildingOwner(buildingName) {
  const normalized = String(buildingName || '').toUpperCase();

  if (normalized === 'A') return 'Rolly';
  if (normalized === 'B') return 'Rodney';
  if (normalized === 'C') return 'Rolly + Rodney';
  return 'Unassigned';
}

function getLoadingTotal(loadings) {
  return loadings.reduce((sum, row) => sum + Number(row.chicksLoaded || 0), 0);
}

function getLockedSharePct(chicksLoaded, totalChicksLoaded) {
  const total = Number(totalChicksLoaded || 0);
  if (!total) return 0;
  return Number(((Number(chicksLoaded || 0) / total) * 100).toFixed(4));
}

function calculateLoadingShares(loadings) {
  const total = getLoadingTotal(loadings);

  return loadings.map((row) => ({
    ...row,
    owner: row.owner || getBuildingOwner(row.building),
    loadingSharePct: getLockedSharePct(row.chicksLoaded, total)
  }));
}

function buildLoadingRows(buildings) {
  return buildings.map((building) => ({
    building: building.name,
    owner: getBuildingOwner(building.name),
    chicksLoaded: '',
    loadingSharePct: 0,
    remarks: ''
  }));
}

export default function BatchManagement({
  activeBatch,
  setActiveBatch,
  token,
  readOnly = false,
  canEditOrDelete = false,
  previewData = null,
  batchList = null,
  isBatchListLoading = false,
  onBatchesChanged = null
}) {
  const hasExternalBatchList = Array.isArray(batchList);
  const [batches, setBatches] = useState([]);
  const [optimisticBatchList, setOptimisticBatchList] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [loadings, setLoadings] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [targetHarvestDate, setTargetHarvestDate] = useState('');
  const [plannedFlock, setPlannedFlock] = useState('');
  const [targetFeedKg, setTargetFeedKg] = useState('');
  const [notes, setNotes] = useState('');
  const [statusField, setStatusField] = useState('ONGOING');
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [isLoadingLoadings, setIsLoadingLoadings] = useState(false);
  const { success, error: toastError, confirm } = useNotification();
  const isPreviewMode = !token && Boolean(previewData);
  const visibleBatches = useMemo(() => {
    const sourceBatches = isPreviewMode
      ? previewData.batches || []
      : optimisticBatchList ?? (hasExternalBatchList ? batchList : batches);

    if (!activeBatch?.id || sourceBatches.some((batch) => String(batch.id) === String(activeBatch.id))) {
      return sourceBatches;
    }

    return [activeBatch, ...sourceBatches];
  }, [activeBatch, batchList, batches, hasExternalBatchList, isPreviewMode, optimisticBatchList, previewData]);

  const loadingsWithShares = useMemo(
    () => calculateLoadingShares(loadings),
    [loadings]
  );

  const loadingTotal = useMemo(
    () => getLoadingTotal(loadings),
    [loadings]
  );

  const shareTotal = useMemo(
    () => loadingsWithShares.reduce((sum, row) => sum + Number(row.loadingSharePct || 0), 0),
    [loadingsWithShares]
  );

  const DEFAULT_BUILDINGS = [
    { name: 'A' },
    { name: 'B' },
    { name: 'C' }
  ];

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    const loadBatchSetup = async () => {
      try {
        const [batchData, buildingData] = await Promise.all([
          hasExternalBatchList
            ? Promise.resolve(null)
            : apiClient.get('/api/batches', { expectArray: true, signal: controller.signal }),
          apiClient.get('/api/buildings', { expectArray: true, signal: controller.signal }).catch((err) => {
            console.warn('Falling back to default buildings:', err);
            return DEFAULT_BUILDINGS;
          })
        ]);

        if (controller.signal.aborted) return;

        if (!hasExternalBatchList) {
          setBatches(batchData);
        }
        setBuildings(buildingData);
        setLoadings((current) => current.length ? current : buildLoadingRows(buildingData));
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Failed to load batch setup:', err);
      }
    };

    loadBatchSetup();
    return () => {
      controller.abort();
    };
  }, [hasExternalBatchList, setBatches, token]);


  const resetForm = () => {
    setEditingBatchId(null);
    setStartDate('');
    setTargetHarvestDate('');
    setPlannedFlock('');
    setTargetFeedKg('');
    setNotes('');
    setStatusField('ONGOING');
    setLoadings(buildLoadingRows(buildings));
  };

  const updateBatchList = (updater) => {
    const currentList = hasExternalBatchList ? (optimisticBatchList ?? batchList) : batches;
    const nextList = typeof updater === 'function' ? updater(currentList) : updater;

    if (hasExternalBatchList) {
      setOptimisticBatchList(nextList);
    } else {
      setBatches(nextList);
    }

    return nextList;
  };

  const refreshExternalBatchList = () => {
    if (!onBatchesChanged) return;

    Promise.resolve(onBatchesChanged()).finally(() => {
      if (hasExternalBatchList) {
        setOptimisticBatchList(null);
      }
    });
  };

  const updateLoading = (index, field, value) => {
    setLoadings((current) => {
      return current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      );
    });
  };

  const fetchBatchLoadings = async (batchId) => {
    setIsLoadingLoadings(true);

    try {
      const data = await apiClient.get(`/api/batches/${batchId}/loadings`, { expectArray: true });
      setLoadings(data.map((row) => ({
        building: row.building,
        owner: getBuildingOwner(row.building),
        chicksLoaded: String(row.chicksLoaded || ''),
        loadingSharePct: row.loadingSharePct || 0,
        remarks: row.remarks || ''
      })));
    } catch (err) {
      console.error(err);
      setLoadings(buildLoadingRows(buildings));
    } finally {
      setIsLoadingLoadings(false);
    }
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();

    if (readOnly) {
      toastError('Your role can view batches but cannot create or edit them.');
      return;
    }

    if (editingBatchId && !canEditOrDelete) {
      toastError('Only admin.roland can edit existing batches.');
      return;
    }

    if (loadings.length === 0) {
      toastError('Add at least one building loading row.');
      return;
    }

    if (loadingTotal <= 0) {
      toastError('Enter chicks loaded for at least one building.');
      return;
    }

    const batchPayload = {
      startDate,
      targetHarvestDate,
      totalChicksLoaded: loadingTotal,
      plannedFlock: parseInt(plannedFlock || 0),
      targetFeedKg: parseFloat(targetFeedKg || 0),
      notes,
      status: editingBatchId ? statusField : 'ONGOING',
      loadings: loadingsWithShares.map((row) => ({
        building: row.building,
        chicksLoaded: parseInt(row.chicksLoaded || 0),
        loadingSharePct: parseFloat(row.loadingSharePct || 0),
        remarks: row.remarks || ''
      }))
    };

    try {
      const url = editingBatchId
        ? `/api/batches/${editingBatchId}`
        : `/api/batches`;

      const data = editingBatchId
        ? await apiClient.patch(url, batchPayload)
        : await apiClient.post(url, batchPayload);

      if (editingBatchId) {
        updateBatchList((current) => current.map((batch) => batch.id === editingBatchId ? data : batch));

        if (activeBatch?.id === editingBatchId) {
          setActiveBatch(data);
        }
        success('Batch updated successfully!');
      } else {
        updateBatchList((current) => [data, ...current]);
        setActiveBatch(data);
        success('Batch created successfully!');
      }

      refreshExternalBatchList();
      resetForm();
    } catch (err) {
      toastError(err.message || 'Cannot connect to server.');
    }
  };

  const handleEditBatch = async (batch) => {
    if (!canEditOrDelete) return;

    setEditingBatchId(batch.id);
    setStartDate(toDateInput(batch.startDate));
    setTargetHarvestDate(toDateInput(batch.targetHarvestDate));
    setPlannedFlock(batch.plannedFlock || '');
    setTargetFeedKg(batch.targetFeedKg || '');
    setNotes(batch.notes || '');
    setStatusField(batch.status || 'ONGOING');
    await fetchBatchLoadings(batch.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteBatch = async (batchId) => {
    if (!canEditOrDelete) return;

    const isConfirmed = await confirm({
      title: 'Delete Batch',
      message: `Are you sure you want to delete batch ${batchId}? This will also remove related records if your database uses CASCADE.`,
      confirmText: 'Delete',
      danger: true
    });

    if (!isConfirmed) return;

    try {
      await apiClient.delete(`/api/batches/${batchId}`);

      const remainingBatches = updateBatchList((current) => current.filter((batch) => batch.id !== batchId));

      if (activeBatch?.id === batchId) {
        setActiveBatch(remainingBatches[0] || null);
      }
      refreshExternalBatchList();
      success('Batch deleted successfully!');
    } catch {
      toastError('Cannot connect to server.');
    }
  };

  return (
    <div className="app-page text-app-text">
      <div className="mb-6 mt-2">
        <h2 className="text-3xl font-extrabold text-app-accent tracking-tight font-hanken">
          Batches
        </h2>
        <p className="text-app-text-secondary text-sm mt-1 font-inter">
          {readOnly ? 'Review flock production cycles.' : 'Create and manage flock production cycles.'}
        </p>
      </div>

      {readOnly && (
        <div className="bg-app-accent/15 border border-app-accent/30 rounded-xl p-3 mb-6">
          <p className="text-xs font-black uppercase tracking-wider text-app-accent font-jetbrains">Read-only access</p>
          <p className="text-sm font-bold text-app-text-secondary mt-1 font-inter">
            You can select and review batches, but changes are restricted to operation managers and owners.
          </p>
        </div>
      )}

      {activeBatch && (
        <div className="bg-app-accent text-app-on-accent p-4 rounded-2xl shadow-sm mb-6">
          <p className="text-xs font-bold uppercase opacity-80 font-jetbrains">Current Active Batch</p>
          <p className="text-2xl font-black mt-1 font-jetbrains">{activeBatch.id}</p>
          <p className="text-sm mt-1 opacity-90 font-inter">
            Started: {toDateInput(activeBatch.startDate)}
          </p>
        </div>
      )}

      {!readOnly && (
      <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-jetbrains">
            {editingBatchId ? 'Edit Batch' : 'New Batch'}
          </h3>
          {editingBatchId && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-app-accent/15 text-app-accent font-jetbrains">
              {editingBatchId}
            </span>
          )}
        </div>

        <form onSubmit={handleSaveBatch} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-app-text-secondary mb-1 font-jetbrains">
              Loading / Start Date
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text-secondary mb-1 font-jetbrains">
              Target Harvest Date
            </label>
            <input
              type="date"
              value={targetHarvestDate}
              onChange={(e) => setTargetHarvestDate(e.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1 font-jetbrains">
                Total Chicks Loaded
              </label>
              <input
                type="number"
                min="0"
                readOnly
                value={loadingTotal || ''}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none font-bold font-jetbrains"
                placeholder="0"
              />
              <p className="text-[10px] text-app-text-secondary mt-1 font-inter">
                Calculated from building chicks.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1 font-jetbrains">
                Planned Flock
              </label>
              <input
                type="number"
                min="0"
                value={plannedFlock}
                onChange={(e) => setPlannedFlock(e.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-jetbrains"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text-secondary mb-1 font-jetbrains">
              Target Feed Kg
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={targetFeedKg}
              onChange={(e) => setTargetFeedKg(e.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-jetbrains"
              placeholder="0"
            />
          </div>

          <div className="border border-app-border rounded-xl overflow-hidden bg-app-card">
            <div className="flex items-center justify-between bg-app-bg px-3 py-2 border-b border-app-border">
              <p className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-jetbrains">
                Building Loading
              </p>
              <span className="text-[10px] font-bold text-app-accent font-jetbrains">
                Shares locked to chicks
              </span>
            </div>

            <div className="divide-y divide-app-border">
              {loadingsWithShares.map((row, index) => (
                <div key={row.building} className="p-3 grid grid-cols-[80px_1fr_90px] gap-2 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-app-text-secondary mb-1 font-jetbrains">
                      Building
                    </label>
                    <div className="min-h-12 flex flex-col items-center justify-center rounded-lg bg-app-bg border border-app-border">
                      <span className="font-black text-app-accent font-hanken leading-none">{row.building}</span>
                      <span className="text-[9px] text-app-text-secondary leading-tight text-center mt-1 font-inter">
                        {row.owner}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-app-text-secondary mb-1 font-jetbrains">
                      Chicks
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={row.chicksLoaded}
                      onChange={(e) => updateLoading(index, 'chicksLoaded', e.target.value)}
                      className="w-full h-10 px-3 border border-app-border rounded-lg bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-jetbrains"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-app-text-secondary mb-1 font-jetbrains">
                      Share %
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      max="100"
                      readOnly
                      value={formatPercent(row.loadingSharePct)}
                      className="w-full h-10 px-2 border border-app-border rounded-lg bg-app-bg text-app-text outline-none font-bold font-jetbrains"
                    />
                  </div>
                </div>
              ))}

              {loadings.length === 0 && (
                <p className="p-3 text-sm text-app-text-secondary font-inter">
                  No active buildings found.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 bg-app-bg px-3 py-2 text-xs font-jetbrains">
              <p className="font-bold text-app-text-secondary">
                Total chicks: {loadingTotal.toLocaleString()}
              </p>
              <p className={`font-bold text-right ${Number(shareTotal.toFixed(2)) === 100 ? 'text-app-success' : 'text-app-danger'}`}>
                Shares: {shareTotal.toFixed(2)}%
              </p>
            </div>
          </div>

          {isLoadingLoadings && (
            <p className="text-xs text-app-text-secondary font-jetbrains">Loading building rows...</p>
          )}

          {editingBatchId && (
            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1 font-jetbrains">
                Status
              </label>
              <select
                value={statusField}
                onChange={(e) => setStatusField(e.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-bold"
              >
                <option value="ONGOING">ONGOING</option>
                <option value="HARVESTED">HARVESTED</option>
                <option value="CLOSED">CLOSED</option>
              </select>

              {statusField === 'CLOSED' && (
                <div className="bg-app-warning-bg border border-app-warning/20 p-4 rounded-xl text-xs space-y-2 mt-3 animate-toast-in text-app-warning">
                  <p className="font-extrabold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">assignment_late</span>
                    Batch Closeout Verification Checklist
                  </p>
                  <p className="text-app-text-secondary leading-normal">
                    Before marking this batch as closed, verify that:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-app-text font-bold">
                    <li>All daily production logs are entered.</li>
                    <li>Drinker lines are flushed and barns are cleaned.</li>
                    <li>Final harvest totals are posted to the ledger.</li>
                    <li>Feed inventory reorder warnings are clear.</li>
                  </ul>
                  <p className="text-[10px] text-app-text-secondary italic">
                    Note: Closing a batch locks the production data and archives logs.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-app-text-secondary mb-1 font-jetbrains">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent"
              placeholder="Optional"
            />
          </div>

          <div className="flex gap-2">
            {editingBatchId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-app-card border border-app-border text-app-text-secondary p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all cursor-pointer font-hanken"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className="flex-[2] bg-app-accent text-app-on-accent p-3 rounded-xl font-bold shadow-md active:scale-95 transition-all cursor-pointer font-hanken"
            >
              {editingBatchId ? 'Update Batch' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
      )}

      <div>
        <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider mb-3 ml-1 font-jetbrains">
          Batch History
        </h3>

        <div className="space-y-3">
          {visibleBatches.map((batch) => (
            <div
              key={batch.id}
              className={`bg-app-card p-4 rounded-xl shadow-sm border transition-all ${
                activeBatch?.id === batch.id
                  ? 'border-app-accent shadow-[0_0_12px_rgba(75,226,119,0.15)]'
                  : 'border-app-border'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-lg font-black text-app-text font-jetbrains">
                    {batch.id}
                  </p>
                  <p className="text-xs text-app-text-secondary font-bold uppercase mt-1 font-jetbrains">
                    Status: {batch.status}
                  </p>
                  <p className="text-sm text-app-text-secondary mt-1 font-jetbrains">
                    Chicks: {Number(batch.totalChicksLoaded || 0).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setActiveBatch(batch)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition ${
                      activeBatch?.id === batch.id
                        ? 'bg-app-accent text-app-on-accent'
                        : 'bg-app-bg text-app-text-secondary border border-app-border hover:text-app-text'
                    }`}
                  >
                    {activeBatch?.id === batch.id ? 'Selected' : 'Select'}
                  </button>

                  {!readOnly && canEditOrDelete && (
                    <>
                      <button
                        onClick={() => handleEditBatch(batch)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-app-accent text-app-on-accent cursor-pointer"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-app-danger-bg text-app-danger border border-app-danger/30 hover:border-app-danger cursor-pointer"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {batch.notes && (
                <p className="text-xs text-app-text-secondary italic mt-3 font-inter">
                  "{batch.notes}"
                </p>
              )}
            </div>
          ))}

          {visibleBatches.length === 0 && (
            <p className="text-center text-app-text-secondary text-sm mt-4 font-inter">
              {isBatchListLoading ? 'Loading batches...' : 'No batches created yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
