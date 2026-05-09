import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';
import {
  BAG_WEIGHT_KG,
  calculateActualFcr,
  calculateTargetFeedForHeads,
  getAgeDay
} from './broilerTargets';

function todayInput() {
  return new Date().toISOString().split('T')[0];
}

function formatBirds(value) {
  return Number(value || 0).toLocaleString();
}

function formatFeed(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

function formatDecimal(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function getAssignmentBuilding(assignment) {
  return String(assignment.assignedBuilding || '').toUpperCase();
}

export default function DailyLog({ logs, setLogs, activeBatch, token }) {
  const [buildings, setBuildings] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [date, setDate] = useState(todayInput());
  const [activeBuilding, setActiveBuilding] = useState('A');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [feedItems, setFeedItems] = useState([]);
  const [feedItemId, setFeedItemId] = useState('');
  const [feedConsumed, setFeedConsumed] = useState('');
  const [mortality, setMortality] = useState('');
  const [averageWeightGrams, setAverageWeightGrams] = useState('');
  const [remarks, setRemarks] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const buildingNames = useMemo(
    () => buildings.length ? buildings.map((building) => building.name) : ['A', 'B', 'C'],
    [buildings]
  );

  const buildingAssignments = useMemo(
    () => assignments.filter((assignment) => {
      const assignedBuilding = getAssignmentBuilding(assignment);
      const hasHandledBirds = Number(assignment.handledBirds || 0) > 0;
      return hasHandledBirds && (!assignedBuilding || assignedBuilding === String(activeBuilding).toUpperCase());
    }),
    [assignments, activeBuilding]
  );

  const selectedAssignment = useMemo(
    () => buildingAssignments.find((assignment) => String(assignment.employeeId) === String(selectedEmployeeId)) || null,
    [buildingAssignments, selectedEmployeeId]
  );

  const selectedFeedItem = useMemo(
    () => feedItems.find((item) => String(item.id) === String(feedItemId)) || null,
    [feedItems, feedItemId]
  );

  const buildingLogTotals = useMemo(
    () => logs
      .filter((log) => log.building === activeBuilding)
      .reduce((totals, log) => ({
        feed: totals.feed + Number(log.feed || 0),
        mortality: totals.mortality + Number(log.mortality || 0)
      }), { feed: 0, mortality: 0 }),
    [logs, activeBuilding]
  );

  const ageDay = useMemo(
    () => getAgeDay(activeBatch?.startDate, date),
    [activeBatch?.startDate, date]
  );

  const employeeActualToDate = useMemo(() => {
    if (!selectedAssignment) {
      return {
        feedBags: Number(feedConsumed || 0),
        mortality: Number(mortality || 0)
      };
    }

    const savedTotals = logs
      .filter((log) => String(log.employeeId) === String(selectedAssignment.employeeId))
      .filter((log) => log.date <= date)
      .reduce((totals, log) => ({
        feedBags: totals.feedBags + Number(log.feed || 0),
        mortality: totals.mortality + Number(log.mortality || 0)
      }), { feedBags: 0, mortality: 0 });

    return {
      feedBags: savedTotals.feedBags + Number(feedConsumed || 0),
      mortality: savedTotals.mortality + Number(mortality || 0)
    };
  }, [date, feedConsumed, logs, mortality, selectedAssignment]);

  const feedTarget = useMemo(
    () => calculateTargetFeedForHeads(selectedAssignment?.handledBirds, ageDay),
    [ageDay, selectedAssignment?.handledBirds]
  );

  const targetVarianceKg = useMemo(() => {
    if (!feedTarget) return null;
    return (employeeActualToDate.feedBags * BAG_WEIGHT_KG) - feedTarget.targetKg;
  }, [employeeActualToDate.feedBags, feedTarget]);

  const actualFcr = useMemo(() => {
    if (!averageWeightGrams || !selectedAssignment) return null;
    const liveHeads = Math.max(Number(selectedAssignment.handledBirds || 0) - employeeActualToDate.mortality, 0);
    return calculateActualFcr(employeeActualToDate.feedBags * BAG_WEIGHT_KG, liveHeads, averageWeightGrams);
  }, [averageWeightGrams, employeeActualToDate.feedBags, employeeActualToDate.mortality, selectedAssignment]);

  const feedStockAfterLog = useMemo(() => {
    if (!selectedFeedItem) return null;
    return Number(selectedFeedItem.currentStock || 0) - Number(feedConsumed || 0);
  }, [feedConsumed, selectedFeedItem]);

  const fetchBuildings = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/buildings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (response.ok) {
        setBuildings(data);
        if (data.length && !data.some((building) => building.name === activeBuilding)) {
          setActiveBuilding(data[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load daily log buildings:', err);
    }
  };

  const fetchFeedItems = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/inventory/items?category=Feed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (response.ok) {
        setFeedItems(data);
        setFeedItemId((current) => current || (data[0]?.id ? String(data[0].id) : ''));
      }
    } catch (err) {
      console.error('Failed to load feed inventory items:', err);
    }
  };

  const fetchAssignments = async () => {
    if (!token || !activeBatch?.id) {
      setAssignments([]);
      setSelectedEmployeeId('');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/batches/${activeBatch.id}/employee-assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load employee assignments.');
        return;
      }

      setAssignments(data);
    } catch (err) {
      console.error(err);
      setError('Cannot connect to employee assignments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBuildings();
    fetchFeedItems();
  }, [token]);

  useEffect(() => {
    fetchAssignments();
  }, [token, activeBatch?.id]);

  useEffect(() => {
    if (!buildingAssignments.length) {
      setSelectedEmployeeId('');
      return;
    }

    const currentIsValid = buildingAssignments.some(
      (assignment) => String(assignment.employeeId) === String(selectedEmployeeId)
    );

    if (!currentIsValid) {
      setSelectedEmployeeId(String(buildingAssignments[0].employeeId));
    }
  }, [buildingAssignments, selectedEmployeeId]);

  const resetForm = () => {
    setEditingId(null);
    setFeedConsumed('');
    setMortality('');
    setAverageWeightGrams('');
    setRemarks('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (editingId) {
      setError('Daily log editing is not wired yet. Delete and re-enter the row for now.');
      setEditingId(null);
      return;
    }

    if (!activeBatch?.id) {
      setError('Select an active batch before saving a daily log.');
      return;
    }

    if (!selectedAssignment) {
      setError(`Assign at least one employee to Building ${activeBuilding} in the Employees tab first.`);
      return;
    }

    const feedQuantity = parseFloat(feedConsumed || 0);
    if (feedQuantity > 0 && !feedItemId) {
      setError('Select which feed inventory item was consumed.');
      return;
    }

    const newLogData = {
      batchId: activeBatch.id,
      date,
      building: activeBuilding,
      employeeId: selectedAssignment.employeeId,
      handledBirds: selectedAssignment.handledBirds,
      feedItemId: feedQuantity > 0 ? feedItemId : null,
      feed: feedQuantity,
      mortality: parseInt(mortality || 0, 10),
      averageWeightGrams: averageWeightGrams === '' ? null : parseFloat(averageWeightGrams),
      remarks
    };

    try {
      const response = await fetch(`${API_BASE}/api/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newLogData)
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save daily log.');
        return;
      }

      setLogs((current) => [data, ...current]);
      setFeedConsumed('');
      setMortality('');
      setAverageWeightGrams('');
      setRemarks('');
    } catch (err) {
      console.error('Failed to save log:', err);
      setError('Cannot connect to daily logs.');
    }
  };

  const handleEditClick = (log) => {
    setEditingId(log.id);
    setDate(log.date);
    setActiveBuilding(log.building);
    setSelectedEmployeeId(log.employeeId ? String(log.employeeId) : '');
    setFeedItemId(log.feedItemId ? String(log.feedItemId) : (feedItems[0]?.id ? String(feedItems[0].id) : ''));
    setFeedConsumed(String(log.feed || ''));
    setMortality(String(log.mortality || ''));
    setAverageWeightGrams(log.averageWeightGrams == null ? '' : String(log.averageWeightGrams));
    setRemarks(log.remarks || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteLog = async (idToDelete) => {
    const isConfirmed = window.confirm('Delete this daily log? This cannot be undone.');
    if (!isConfirmed) return;

    try {
      const response = await fetch(`${API_BASE}/api/logs/${idToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setLogs((current) => current.filter((log) => log.id !== idToDelete));
        if (editingId === idToDelete) resetForm();
      }
    } catch (err) {
      console.error('Failed to delete log:', err);
      setError('Cannot delete daily log right now.');
    }
  };

  return (
    <div className="app-page">
      <div className="mb-6 mt-2">
        <h2 className="text-3xl font-extrabold text-primary dark:text-primary tracking-tight">
          Daily Logs
        </h2>
        {activeBatch && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Batch <span className="font-bold">{activeBatch.id}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-neutral-border dark:border-gray-700 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Building Feed</p>
          <p className="text-lg font-black mt-1 text-gray-900 dark:text-white">
            {formatFeed(buildingLogTotals.feed)} sx
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-neutral-border dark:border-gray-700 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Building Mortality</p>
          <p className={`text-lg font-black mt-1 ${buildingLogTotals.mortality > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
            {formatBirds(buildingLogTotals.mortality)} hd
          </p>
        </div>
      </div>

      <div className={`bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border-2 transition-colors duration-300 mb-6 ${editingId ? 'border-secondary' : 'border-neutral-border dark:border-gray-700'}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${editingId ? 'text-secondary' : 'text-gray-400 dark:text-gray-500'}`}>
              {editingId ? 'Editing Entry' : 'New Entry'}
            </h3>
            <input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="p-1.5 text-sm border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
              Building
            </label>
            <div className="flex space-x-2">
              {buildingNames.map((building) => (
                <button
                  key={building}
                  type="button"
                  onClick={() => setActiveBuilding(building)}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all border ${
                    activeBuilding === building
                      ? 'bg-secondary text-white border-secondary shadow-md scale-105'
                      : 'bg-neutral-light dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Bldg {building}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Employee Share
            </label>
            <select
              required
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
            >
              {buildingAssignments.length === 0 && (
                <option value="">No employees assigned</option>
              )}
              {buildingAssignments.map((assignment) => (
                <option key={assignment.employeeId} value={assignment.employeeId}>
                  {assignment.employeeName} - {formatBirds(assignment.handledBirds)} birds
                </option>
              ))}
            </select>
            {isLoading && (
              <p className="text-[10px] text-gray-400 mt-1">Loading employee shares...</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">
                Handled Birds
              </label>
              <div className="h-11 flex items-center px-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white font-black">
                {formatBirds(selectedAssignment?.handledBirds)}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">
                Building Chicks
              </label>
              <div className="h-11 flex items-center px-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white font-black">
                {formatBirds(selectedAssignment?.buildingChicksLoaded)}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-border dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between bg-neutral-light dark:bg-gray-700 px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                Daily Target
              </p>
              <span className="text-[10px] font-bold text-primary">
                {ageDay ? `Day ${ageDay}` : 'No age'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 text-xs">
              <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                <p className="text-gray-400 font-bold uppercase">Target Feed</p>
                <p className="font-black text-gray-900 dark:text-white mt-1">
                  {feedTarget ? `${formatDecimal(feedTarget.targetBags, 2)} bags` : '--'}
                </p>
                <p className="text-[10px] text-gray-400">
                  {feedTarget ? `${formatDecimal(feedTarget.targetKg, 0)} kg` : 'No curve for day'}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                <p className="text-gray-400 font-bold uppercase">Actual To Date</p>
                <p className="font-black text-gray-900 dark:text-white mt-1">
                  {formatDecimal(employeeActualToDate.feedBags, 2)} bags
                </p>
                <p className="text-[10px] text-gray-400">
                  {formatDecimal(employeeActualToDate.feedBags * BAG_WEIGHT_KG, 0)} kg
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                <p className="text-gray-400 font-bold uppercase">Feed Variance</p>
                <p className={`font-black mt-1 ${targetVarianceKg > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
                  {targetVarianceKg === null ? '--' : `${targetVarianceKg > 0 ? '+' : ''}${formatDecimal(targetVarianceKg, 0)} kg`}
                </p>
                <p className="text-[10px] text-gray-400">
                  {targetVarianceKg === null ? 'No target' : `${targetVarianceKg > 0 ? '+' : ''}${formatDecimal(targetVarianceKg / BAG_WEIGHT_KG, 2)} bags`}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                <p className="text-gray-400 font-bold uppercase">Weight / FCR</p>
                <p className="font-black text-gray-900 dark:text-white mt-1">
                  {feedTarget ? `${formatBirds(feedTarget.weightGrams)}g / ${formatDecimal(feedTarget.fcr, 2)}` : '--'}
                </p>
                <p className="text-[10px] text-gray-400">
                  Actual FCR {actualFcr ? formatDecimal(actualFcr, 2) : '--'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Feed Inventory Item
            </label>
            <select
              value={feedItemId}
              onChange={(event) => setFeedItemId(event.target.value)}
              disabled={feedItems.length === 0}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none disabled:opacity-60"
            >
              {feedItems.length === 0 && (
                <option value="">No feed items yet</option>
              )}
              {feedItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {formatFeed(item.currentStock)} {item.unit}
                </option>
              ))}
            </select>
            {selectedFeedItem && (
              <p className={`text-[10px] font-bold mt-1 ${feedStockAfterLog < 0 ? 'text-semantic-danger' : 'text-gray-400'}`}>
                Stock after this log: {formatFeed(feedStockAfterLog)} {selectedFeedItem.unit}
              </p>
            )}
          </div>

          <div className="flex space-x-3 pt-2">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                Feed Used (Sacks)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                required
                value={feedConsumed}
                onChange={(event) => setFeedConsumed(event.target.value)}
                placeholder="0"
                className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white text-lg font-black focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                Mortality (Birds)
              </label>
              <input
                type="number"
                min="0"
                required
                value={mortality}
                onChange={(event) => setMortality(event.target.value)}
                placeholder="0"
                className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white text-lg font-black text-semantic-danger focus:ring-2 focus:ring-semantic-danger outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Actual Avg Weight (g)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={averageWeightGrams}
              onChange={(event) => setAverageWeightGrams(event.target.value)}
              placeholder="Optional, usually Day 7 / 14 / 21"
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white font-bold focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Optional"
              className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          <div className="flex space-x-2 mt-4 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 p-3 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all active:scale-95 shadow-sm"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className={`flex-[2] text-white p-3 rounded-xl font-bold transition-all active:scale-95 shadow-md ${editingId ? 'bg-secondary hover:bg-opacity-90' : 'bg-primary hover:bg-opacity-90'}`}
            >
              {editingId ? 'Update Log' : 'Save Log'}
            </button>
          </div>
        </form>
      </div>

      <div>
        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">
          Recent Logs
        </h3>
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border flex flex-col relative overflow-hidden transition-colors ${editingId === log.id ? 'border-secondary bg-yellow-50/30 dark:bg-yellow-900/10' : 'border-neutral-border dark:border-gray-700'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="bg-secondary/20 border border-secondary/30 text-secondary w-12 h-12 rounded-full flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                    {log.building}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">{log.date}</p>
                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                      {log.employeeName || 'Unassigned employee'}
                    </p>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatBirds(log.handledBirds)} birds - Feed {formatFeed(log.feed)} sx
                    </p>
                    {log.feedItemName && (
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                        {log.feedItemName}
                      </p>
                    )}
                    {log.averageWeightGrams != null && (
                      <p className="text-[10px] font-bold text-primary mt-0.5">
                        Avg weight {formatDecimal(log.averageWeightGrams, 0)}g
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">Mortality</p>
                  <p className={`text-xl font-black ${log.mortality > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
                    {formatBirds(log.mortality)} <span className="text-sm font-normal">hd</span>
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 pl-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 italic flex-1 truncate pr-2">
                  {log.remarks ? `"${log.remarks}"` : 'No remarks'}
                </p>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => handleEditClick(log)}
                    className="text-xs font-bold text-gray-400 hover:text-secondary transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLog(log.id)}
                    className="text-xs font-bold text-gray-400 hover:text-semantic-danger transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <p className="text-center text-gray-500 text-sm mt-4">No daily logs recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
