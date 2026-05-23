import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';

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

export default function BatchManagement({ activeBatch, setActiveBatch, token, readOnly = false, canEditOrDelete = false }) {
  const [batches, setBatches] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loadings, setLoadings] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [targetHarvestDate, setTargetHarvestDate] = useState('');
  const [plannedFlock, setPlannedFlock] = useState('');
  const [targetFeedKg, setTargetFeedKg] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [isLoadingLoadings, setIsLoadingLoadings] = useState(false);

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

  const fetchBatches = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/batches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setBatches(data);
    } catch (err) {
      console.error('Failed to fetch batches:', err);
    }
  };

  const fetchBuildings = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/buildings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setBuildings(data);
      setLoadings((current) => current.length ? current : buildLoadingRows(data));
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
    }
  };

  useEffect(() => {
    if (!token) return;
    setTimeout(() => {
      fetchBatches();
      fetchBuildings();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resetForm = () => {
    setEditingBatchId(null);
    setStartDate('');
    setTargetHarvestDate('');
    setPlannedFlock('');
    setTargetFeedKg('');
    setNotes('');
    setLoadings(buildLoadingRows(buildings));
    setError('');
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
      const response = await fetch(`${API_BASE}/api/batches/${batchId}/loadings`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load building loadings');
      }

      const data = await response.json();
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
    setError('');

    if (readOnly) {
      setError('Your role can view batches but cannot create or edit them.');
      return;
    }

    if (editingBatchId && !canEditOrDelete) {
      setError('Only admin.roland can edit existing batches.');
      return;
    }

    if (loadings.length === 0) {
      setError('Add at least one building loading row.');
      return;
    }

    if (loadingTotal <= 0) {
      setError('Enter chicks loaded for at least one building.');
      return;
    }

    const batchPayload = {
      startDate,
      targetHarvestDate,
      totalChicksLoaded: loadingTotal,
      plannedFlock: parseInt(plannedFlock || 0),
      targetFeedKg: parseFloat(targetFeedKg || 0),
      notes,
      status: 'ONGOING',
      loadings: loadingsWithShares.map((row) => ({
        building: row.building,
        chicksLoaded: parseInt(row.chicksLoaded || 0),
        loadingSharePct: parseFloat(row.loadingSharePct || 0),
        remarks: row.remarks || ''
      }))
    };

    try {
      const url = editingBatchId
        ? `${API_BASE}/api/batches/${editingBatchId}`
        : `${API_BASE}/api/batches`;

      const method = editingBatchId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(batchPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save batch.');
        return;
      }

      if (editingBatchId) {
        setBatches(batches.map((batch) => batch.id === editingBatchId ? data : batch));

        if (activeBatch?.id === editingBatchId) {
          setActiveBatch(data);
        }
      } else {
        setBatches([data, ...batches]);
        setActiveBatch(data);
      }

      resetForm();
    } catch {
      setError('Cannot connect to server.');
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
    await fetchBatchLoadings(batch.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteBatch = async (batchId) => {
    if (!canEditOrDelete) return;

    const isConfirmed = window.confirm(
      `Are you sure you want to delete batch ${batchId}? This will also remove related records if your database uses CASCADE.`
    );

    if (!isConfirmed) return;

    try {
      const response = await fetch(`${API_BASE}/api/batches/${batchId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to delete batch.');
        return;
      }

      const remainingBatches = batches.filter((batch) => batch.id !== batchId);
      setBatches(remainingBatches);

      if (activeBatch?.id === batchId) {
        setActiveBatch(remainingBatches[0] || null);
      }
    } catch {
      setError('Cannot connect to server.');
    }
  };

  return (
    <div className="app-page">
      <div className="mb-6 mt-2">
        <h2 className="text-3xl font-extrabold text-primary tracking-tight">
          Batches
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {readOnly ? 'Review flock production cycles.' : 'Create and manage flock production cycles.'}
        </p>
      </div>

      {readOnly && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3 mb-6">
          <p className="text-xs font-black uppercase tracking-wider text-primary">Read-only access</p>
          <p className="text-sm font-bold text-blue-700 dark:text-blue-200 mt-1">
            You can select and review batches, but changes are restricted to operation managers and owners.
          </p>
        </div>
      )}

      {activeBatch && (
        <div className="bg-primary text-white p-4 rounded-2xl shadow-sm mb-6">
          <p className="text-xs font-bold uppercase opacity-80">Current Active Batch</p>
          <p className="text-2xl font-black mt-1">{activeBatch.id}</p>
          <p className="text-sm mt-1 opacity-90">
            Started: {toDateInput(activeBatch.startDate)}
          </p>
        </div>
      )}

      {!readOnly && (
      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {editingBatchId ? 'Edit Batch' : 'New Batch'}
          </h3>
          {editingBatchId && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-secondary/10 text-secondary">
              {editingBatchId}
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSaveBatch} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Loading / Start Date
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Target Harvest Date
            </label>
            <input
              type="date"
              value={targetHarvestDate}
              onChange={(e) => setTargetHarvestDate(e.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                Total Chicks Loaded
              </label>
              <input
                type="number"
                min="0"
                readOnly
                value={loadingTotal || ''}
                className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white outline-none font-bold"
                placeholder="0"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Calculated from building chicks.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                Planned Flock
              </label>
              <input
                type="number"
                min="0"
                value={plannedFlock}
                onChange={(e) => setPlannedFlock(e.target.value)}
                className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Target Feed Kg
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={targetFeedKg}
              onChange={(e) => setTargetFeedKg(e.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              placeholder="0"
            />
          </div>

          <div className="border border-neutral-border dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between bg-neutral-light dark:bg-gray-700 px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                Building Loading
              </p>
              <span className="text-[10px] font-bold text-primary">
                Shares locked to chicks
              </span>
            </div>

            <div className="divide-y divide-neutral-border dark:divide-gray-700">
              {loadingsWithShares.map((row, index) => (
                <div key={row.building} className="p-3 grid grid-cols-[72px_1fr_84px] gap-2 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1">
                      Owner
                    </label>
                    <div className="min-h-12 flex flex-col items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-neutral-border dark:border-gray-600">
                      <span className="font-black text-primary leading-none">{row.building}</span>
                      <span className="text-[9px] text-gray-500 dark:text-gray-400 leading-tight text-center mt-1">
                        {row.owner}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1">
                      Chicks
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={row.chicksLoaded}
                      onChange={(e) => updateLoading(index, 'chicksLoaded', e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white outline-none"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1">
                      Share %
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      max="100"
                      readOnly
                      value={formatPercent(row.loadingSharePct)}
                      className="w-full h-10 px-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white outline-none font-bold"
                    />
                  </div>
                </div>
              ))}

              {loadings.length === 0 && (
                <p className="p-3 text-sm text-gray-500">
                  No active buildings found.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 bg-neutral-light dark:bg-gray-700 px-3 py-2 text-xs">
              <p className="font-bold text-gray-500 dark:text-gray-300">
                Total chicks: {loadingTotal.toLocaleString()}
              </p>
              <p className={`font-bold text-right ${Number(shareTotal.toFixed(2)) === 100 ? 'text-semantic-success' : 'text-red-500'}`}>
                Shares: {shareTotal.toFixed(2)}%
              </p>
            </div>
          </div>

          {isLoadingLoadings && (
            <p className="text-xs text-gray-500">Loading building rows...</p>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              placeholder="Optional"
            />
          </div>

          <div className="flex gap-2">
            {editingBatchId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className="flex-[2] bg-secondary text-white p-3 rounded-xl font-bold shadow-md active:scale-95 transition-all"
            >
              {editingBatchId ? 'Update Batch' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
      )}

      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">
          Batch History
        </h3>

        <div className="space-y-3">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border ${
                activeBatch?.id === batch.id
                  ? 'border-primary'
                  : 'border-neutral-border dark:border-gray-700'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-lg font-black text-gray-900 dark:text-white">
                    {batch.id}
                  </p>
                  <p className="text-xs text-gray-400 font-bold uppercase mt-1">
                    Status: {batch.status}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Chicks: {Number(batch.totalChicksLoaded || 0).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setActiveBatch(batch)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold ${
                      activeBatch?.id === batch.id
                        ? 'bg-primary text-white'
                        : 'bg-neutral-light dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {activeBatch?.id === batch.id ? 'Selected' : 'Select'}
                  </button>

                  {!readOnly && canEditOrDelete && (
                    <>
                      <button
                        onClick={() => handleEditBatch(batch)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-secondary text-white"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDeleteBatch(batch.id)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-red-100 text-red-600 border border-red-200"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              {batch.notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-3">
                  "{batch.notes}"
                </p>
              )}
            </div>
          ))}

          {batches.length === 0 && (
            <p className="text-center text-gray-500 text-sm mt-4">
              No batches created yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
