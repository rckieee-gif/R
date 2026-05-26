import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { API_BASE } from './api';
import {
  BAG_WEIGHT_KG,
  calculateActualFcr,
  calculateTargetFeedForHeads,
  getAgeDay
} from './broilerTargets';
import DailyLogForm from './Components/DailyLog/DailyLogForm';
import DailyLogHistory from './Components/DailyLog/DailyLogHistory';
import { useStore, useVisibleLogs, useVisibleActiveBatch, usePermissions } from './useStore';

const dailyLogSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  activeBuilding: z.string().min(1, 'Building is required'),
  selectedEmployeeId: z.string().min(1, 'Employee Share is required'),
  feedItemId: z.string().optional().or(z.literal('')),
  feedConsumed: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().nonnegative('Feed used must be non-negative')
  ),
  mortality: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().int('Mortality must be an integer').nonnegative('Mortality must be non-negative')
  ),
  averageWeightGrams: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().positive('Average weight must be positive').optional()
  ),
  remarks: z.string().optional().or(z.literal('')),
});

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

const FEED_VARIANCE_WARNING_PERCENT = 15;
const MORTALITY_WARNING_RATE = 0.005;
const MORTALITY_WARNING_HEADS = 5;

export default function DailyLog() {
  const token = useStore((state) => state.token);
  const activeBatch = useVisibleActiveBatch();
  const logs = useVisibleLogs();
  const setLogState = useStore((state) => state.setLogState);
  const { canEnterDaily, canEditOrDelete } = usePermissions();
  const readOnly = !canEnterDaily;

  const setLogs = (value) => {
    if (!activeBatch?.id) return;
    const currentRows = useStore.getState().logState.rows;
    const nextRows = typeof value === 'function' ? value(currentRows) : value;
    setLogState({
      batchId: activeBatch.id,
      rows: Array.isArray(nextRows) ? nextRows : []
    });
  };
  const [buildings, setBuildings] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const { register, handleSubmit: hookSubmit, watch, control, setValue, getValues, reset, formState: { errors } } = useForm({
    resolver: zodResolver(dailyLogSchema),
    defaultValues: {
      date: todayInput(),
      activeBuilding: 'A',
      selectedEmployeeId: '',
      feedItemId: '',
      feedConsumed: '',
      mortality: '',
      averageWeightGrams: '',
      remarks: ''
    }
  });

  const watchedValues = useWatch({ control }) || {};
  const date = watchedValues.date;
  const activeBuilding = watchedValues.activeBuilding;
  const selectedEmployeeId = watchedValues.selectedEmployeeId;
  const feedItemId = watchedValues.feedItemId;
  const feedConsumed = watchedValues.feedConsumed;
  const mortality = watchedValues.mortality;
  const averageWeightGrams = watchedValues.averageWeightGrams;
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
      .filter((log) => log.id !== editingId)
      .filter((log) => log.date <= date)
      .reduce((totals, log) => ({
        feedBags: totals.feedBags + Number(log.feed || 0),
        mortality: totals.mortality + Number(log.mortality || 0)
      }), { feedBags: 0, mortality: 0 });

    return {
      feedBags: savedTotals.feedBags + Number(feedConsumed || 0),
      mortality: savedTotals.mortality + Number(mortality || 0)
    };
  }, [date, editingId, feedConsumed, logs, mortality, selectedAssignment]);

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

  const abnormalWarnings = useMemo(() => {
    const warnings = [];

    if (!isLoading && !selectedAssignment) {
      warnings.push({
        label: 'No employee assigned to this building',
        detail: `Assign at least one employee share for Building ${activeBuilding} before saving.`
      });
    }

    if (feedStockAfterLog !== null && feedStockAfterLog < 0) {
      warnings.push({
        label: 'Feed stock will go negative',
        detail: `${selectedFeedItem?.name || 'Selected feed'} will be short by ${formatFeed(Math.abs(feedStockAfterLog))} ${selectedFeedItem?.unit || 'sacks'}.`
      });
    }

    const mortalityValue = Number(mortality || 0);
    const handledBirds = Number(selectedAssignment?.handledBirds || 0);
    const mortalityThreshold = Math.max(MORTALITY_WARNING_HEADS, Math.ceil(handledBirds * MORTALITY_WARNING_RATE));

    if (mortalityValue > mortalityThreshold) {
      warnings.push({
        label: 'Mortality unusually high',
        detail: `${formatBirds(mortalityValue)} mortality is above the ${formatBirds(mortalityThreshold)} head warning level for this share.`
      });
    }

    if (feedTarget?.targetKg && targetVarianceKg !== null) {
      const variancePercent = (targetVarianceKg / feedTarget.targetKg) * 100;

      if (Math.abs(variancePercent) >= FEED_VARIANCE_WARNING_PERCENT) {
        warnings.push({
          label: `Feed usage far ${variancePercent > 0 ? 'above' : 'below'} target`,
          detail: `${variancePercent > 0 ? '+' : ''}${formatDecimal(variancePercent, 1)}% versus the day ${ageDay || '--'} employee target curve.`
        });
      }
    }

    return warnings;
  }, [activeBuilding, ageDay, feedStockAfterLog, feedTarget, isLoading, mortality, selectedAssignment, selectedFeedItem, targetVarianceKg]);

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
          setValue('activeBuilding', data[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load daily log dailyLogBuildings:', err);
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
        const currentFeedItemId = getValues('feedItemId');
        setValue('feedItemId', currentFeedItemId || (data[0]?.id ? String(data[0].id) : ''));
      }
    } catch (err) {
      console.error('Failed to load feed inventory items:', err);
    }
  };

  const fetchAssignments = async () => {
    if (!token || !activeBatch?.id) {
      setAssignments([]);
      setValue('selectedEmployeeId', '');
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
    setTimeout(() => {
      fetchBuildings();
      fetchFeedItems();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setTimeout(() => {
      fetchAssignments();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeBatch?.id]);

  useEffect(() => {
    if (!buildingAssignments.length) {
      setValue('selectedEmployeeId', '');
      return;
    }

    const currentIsValid = buildingAssignments.some(
      (assignment) => String(assignment.employeeId) === String(selectedEmployeeId)
    );

    if (!currentIsValid) {
      setValue('selectedEmployeeId', String(buildingAssignments[0].employeeId));
    }
  }, [buildingAssignments, selectedEmployeeId, setValue]);

  const resetForm = () => {
    setEditingId(null);
    reset({
      date: todayInput(),
      activeBuilding: 'A',
      selectedEmployeeId: buildingAssignments[0]?.employeeId ? String(buildingAssignments[0].employeeId) : '',
      feedItemId: feedItems[0]?.id ? String(feedItems[0].id) : '',
      feedConsumed: '',
      mortality: '',
      averageWeightGrams: '',
      remarks: ''
    });
    setError('');
  };

  const onSave = async (formData) => {
    setError('');

    if (readOnly) {
      setError('Your role can view daily logs but cannot add or edit entries.');
      return;
    }

    if (editingId && !canEditOrDelete) {
      setError('Only admin.roland can edit existing daily logs.');
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

    const feedQuantity = parseFloat(formData.feedConsumed || 0);
    if (feedQuantity > 0 && !formData.feedItemId) {
      setError('Select which feed inventory item was consumed.');
      return;
    }

    const newLogData = {
      batchId: activeBatch.id,
      date: formData.date,
      building: formData.activeBuilding,
      employeeId: selectedAssignment.employeeId,
      handledBirds: selectedAssignment.handledBirds,
      feedItemId: feedQuantity > 0 ? formData.feedItemId : null,
      feed: feedQuantity,
      mortality: parseInt(formData.mortality || 0, 10),
      averageWeightGrams: formData.averageWeightGrams === '' || formData.averageWeightGrams === undefined ? null : parseFloat(formData.averageWeightGrams),
      remarks: formData.remarks
    };

    try {
      const response = await fetch(editingId ? `${API_BASE}/api/logs/${editingId}` : `${API_BASE}/api/logs`, {
        method: editingId ? 'PATCH' : 'POST',
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

      setLogs((current) => (
        editingId
          ? current.map((log) => log.id === editingId ? data : log)
          : [data, ...current]
      ));
      resetForm();
    } catch (err) {
      console.error('Failed to save log:', err);
      setError('Cannot connect to daily logs.');
    }
  };

  const handleEditClick = (log) => {
    if (!canEditOrDelete) return;

    setEditingId(log.id);
    reset({
      date: log.date,
      activeBuilding: log.building,
      selectedEmployeeId: log.employeeId ? String(log.employeeId) : '',
      feedItemId: log.feedItemId ? String(log.feedItemId) : (feedItems[0]?.id ? String(feedItems[0].id) : ''),
      feedConsumed: String(log.feed || ''),
      mortality: String(log.mortality || ''),
      averageWeightGrams: log.averageWeightGrams == null ? '' : String(log.averageWeightGrams),
      remarks: log.remarks || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteLog = async (idToDelete) => {
    if (readOnly || !canEditOrDelete) return;

    const isConfirmed = window.confirm('Delete this daily log? This cannot be undone.');
    if (!isConfirmed) return;

    try {
      const response = await fetch(`${API_BASE}/api/logs/${idToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setLogs((current) => current.filter((log) => log.id !== idToDelete));
        if (editingId === idToDelete) resetForm();
      } else {
        setError(data.error || 'Failed to delete daily log.');
      }
    } catch (err) {
      console.error('Failed to delete log:', err);
      setError('Cannot delete daily log right now.');
    }
  };

  return (
    <div className="app-page font-hanken">
      <div className="mb-6 mt-2">
        <h2 className="text-3xl font-extrabold text-app-text tracking-tight">
          Daily Logs
        </h2>
        {activeBatch && (
          <p className="text-sm text-app-text-secondary mt-1">
            Batch <span className="font-bold font-jetbrains">{activeBatch.id}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Building Feed</p>
          <p className="text-lg font-black mt-1 text-app-text font-jetbrains">
            {formatFeed(buildingLogTotals.feed)} sx
          </p>
        </div>

        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Building Mortality</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${buildingLogTotals.mortality > 0 ? 'text-app-danger' : 'text-app-success'}`}>
            {formatBirds(buildingLogTotals.mortality)} hd
          </p>
        </div>
      </div>

      {readOnly && (
        <div className="no-print bg-app-accent/5 border border-app-border rounded-xl p-4 mb-6">
          <p className="text-xs font-black uppercase tracking-wider text-app-accent">Read-only access</p>
          <p className="text-sm font-bold text-app-text-secondary mt-1">
            You can review daily logs and production totals. New entries are restricted to workers, operation managers, and owners.
          </p>
          <div className="flex space-x-2 mt-4">
            {buildingNames.map((building) => (
              <button
                key={building}
                type="button"
                onClick={() => setValue('activeBuilding', building)}
                className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border cursor-pointer hover:scale-102 ${
                  activeBuilding === building
                    ? 'bg-app-accent text-app-on-accent border-app-accent'
                    : 'bg-app-bg text-app-text-secondary border-app-border'
                }`}
              >
                Bldg {building}
              </button>
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <DailyLogForm
          handleSubmit={hookSubmit(onSave)}
          editingId={editingId}
          error={error}
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
          buildingNames={buildingNames}
          buildingAssignments={buildingAssignments}
          isLoading={isLoading}
          selectedAssignment={selectedAssignment}
          ageDay={ageDay}
          feedTarget={feedTarget}
          employeeActualToDate={employeeActualToDate}
          targetVarianceKg={targetVarianceKg}
          actualFcr={actualFcr}
          feedItems={feedItems}
          selectedFeedItem={selectedFeedItem}
          feedStockAfterLog={feedStockAfterLog}
          abnormalWarnings={abnormalWarnings}
          resetForm={resetForm}
        />
      )}

      <DailyLogHistory
        logs={logs}
        editingId={editingId}
        readOnly={readOnly}
        canEditOrDelete={canEditOrDelete}
        handleEditClick={handleEditClick}
        handleDeleteLog={handleDeleteLog}
      />
    </div>
  );
}
