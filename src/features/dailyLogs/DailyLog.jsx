import { useEffect, useMemo, useState, useRef } from 'react';
import { apiClient } from '../../shared/utils/apiClient';
import { useNotification } from '../../shared/hooks/useNotification';
import {
  BAG_WEIGHT_KG,
  calculateActualFcr,
  calculateTargetFeedForHeads,
  getAgeDay
} from '../../shared/utils/broilerTargets';
import OfflineStaleBanner from '../../shared/components/OfflineStaleBanner';
import { calculateMortalityBuffer, applyMortalityBuffer } from '../../shared/utils/mortalityBuffer';
import DailyLogForm from './components/DailyLogForm';
import DailyLogHistory from './components/DailyLogHistory';
import DailyLogEditModal from './components/DailyLogEditModal';
import { dailyLogSchema } from './dailyLogSchemas';
import SuccessBurst from '../../shared/components/SuccessBurst';


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

function formatAgeDay(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return String(Number(value));
}

function getAssignmentBuilding(assignment) {
  return String(assignment.assignedBuilding || '').toUpperCase();
}

const FEED_VARIANCE_WARNING_PERCENT = 15;
const MORTALITY_WARNING_RATE = 0.005;
const MORTALITY_WARNING_HEADS = 5;
const DEFAULT_BUILDINGS = [
  { name: 'A' },
  { name: 'B' },
  { name: 'C' }
];

function getDailyLogFormKey(batchId, building, editingId) {
  return `${batchId || 'none'}:${building || 'A'}:${editingId || 'new'}`;
}

function getEmptyDailyLogValues(fallback = {}) {
  return {
    date: fallback.date || todayInput(),
    selectedEmployeeId: fallback.selectedEmployeeId || '',
    feedItemId: fallback.feedItemId || '',
    feedConsumed: '',
    mortality: '',
    averageWeightGrams: '',
    remarks: ''
  };
}

function readDailyLogDraft(batchId, building, fallback = {}) {
  const emptyValues = getEmptyDailyLogValues(fallback);
  if (!batchId) return emptyValues;

  const saved = localStorage.getItem(`octavioDailyLogDraft:${batchId}:${building}`);
  if (!saved) return emptyValues;

  try {
    const draft = JSON.parse(saved);
    return {
      ...emptyValues,
      date: draft.date || emptyValues.date,
      selectedEmployeeId: draft.selectedEmployeeId || emptyValues.selectedEmployeeId,
      feedItemId: draft.feedItemId || emptyValues.feedItemId,
      feedConsumed: draft.feedConsumed || '',
      mortality: draft.mortality || '',
      averageWeightGrams: draft.averageWeightGrams || '',
      remarks: draft.remarks || ''
    };
  } catch (err) {
    console.error('Failed to parse draft details:', err);
    return emptyValues;
  }
}

export default function DailyLog({ logs, setLogs, activeBatch, token, readOnly = false, canEditOrDelete = false }) {
  const [buildings, setBuildings] = useState([]);
  const [assignmentsState, setAssignmentsState] = useState({
    batchId: null,
    rows: []
  });
  const [activeBuilding, setActiveBuilding] = useState('A');
  const [feedItems, setFeedItems] = useState([]);
  const [editModalLog, setEditModalLog] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const [successBurstKey, setSuccessBurstKey] = useState(0);
  const { success, error: toastError, confirm } = useNotification();
  const skipSaveRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const editSubmitInFlightRef = useRef(false);
  const activeBatchId = activeBatch?.id ?? null;
  const formKey = getDailyLogFormKey(activeBatchId, activeBuilding, null);
  const [formState, setFormState] = useState(() => ({
    key: getDailyLogFormKey(activeBatchId, 'A', null),
    values: readDailyLogDraft(activeBatchId, 'A')
  }));
  const formValues = formState.key === formKey
    ? formState.values
    : readDailyLogDraft(activeBatchId, activeBuilding, formState.values);
  const assignments = useMemo(
    () => (token && activeBatchId && assignmentsState.batchId === activeBatchId ? assignmentsState.rows : []),
    [activeBatchId, assignmentsState, token]
  );

  const setFormField = (field, value) => {
    setFormState((current) => {
      const currentValues = current.key === formKey
        ? current.values
        : readDailyLogDraft(activeBatchId, activeBuilding, current.values);
      const nextValue = typeof value === 'function' ? value(currentValues[field]) : value;

      return {
        key: formKey,
        values: {
          ...currentValues,
          [field]: nextValue
        }
      };
    });
  };

  const date = formValues.date;
  const feedItemId = formValues.feedItemId || (feedItems[0]?.id ? String(feedItems[0].id) : '');
  const feedConsumed = formValues.feedConsumed;
  const mortality = formValues.mortality;
  const averageWeightGrams = formValues.averageWeightGrams;
  const remarks = formValues.remarks;
  const setDate = (value) => setFormField('date', value);
  const setSelectedEmployeeId = (value) => setFormField('selectedEmployeeId', value);
  const setFeedItemId = (value) => setFormField('feedItemId', value);
  const setFeedConsumed = (value) => setFormField('feedConsumed', value);
  const setMortality = (value) => setFormField('mortality', value);
  const setAverageWeightGrams = (value) => setFormField('averageWeightGrams', value);
  const setRemarks = (value) => setFormField('remarks', value);

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

  const selectedEmployeeId = useMemo(() => {
    if (!buildingAssignments.length) return '';

    const selectedId = formValues.selectedEmployeeId;
    const selectedIsValid = buildingAssignments.some(
      (assignment) => String(assignment.employeeId) === String(selectedId)
    );

    return selectedIsValid ? String(selectedId) : String(buildingAssignments[0].employeeId);
  }, [buildingAssignments, formValues.selectedEmployeeId]);

  const selectedAssignment = useMemo(
    () => buildingAssignments.find((assignment) => String(assignment.employeeId) === String(selectedEmployeeId)) || null,
    [buildingAssignments, selectedEmployeeId]
  );

  const selectedEmployeeBuffer = useMemo(() => {
    if (!selectedAssignment) return 0;
    const totalBuildingHandled = buildingAssignments.reduce(
      (sum, a) => sum + Number(a.handledBirds || 0), 0
    );
    return calculateMortalityBuffer(
      selectedAssignment.buildingChicksLoaded,
      selectedAssignment.handledBirds,
      totalBuildingHandled
    );
  }, [buildingAssignments, selectedAssignment]);

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

  const buildingLoadedBirds = useMemo(() => {
    if (selectedAssignment) return Number(selectedAssignment.buildingChicksLoaded || 0);
    if (buildingAssignments.length > 0) return Number(buildingAssignments[0].buildingChicksLoaded || 0);
    return 0;
  }, [selectedAssignment, buildingAssignments]);

  const buildingThreshold = useMemo(() => {
    return Math.max(5, Math.ceil(buildingLoadedBirds * 0.005));
  }, [buildingLoadedBirds]);

  const buildingMortalityColor = useMemo(() => {
    const val = buildingLogTotals.mortality;
    if (val <= buildingThreshold) return 'text-app-success';
    if (val <= buildingThreshold * 2) return 'text-app-warning';
    return 'text-app-danger';
  }, [buildingLogTotals.mortality, buildingThreshold]);

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
    const effectiveMortality = applyMortalityBuffer(employeeActualToDate.mortality, selectedEmployeeBuffer);
    const liveHeads = Math.max(Number(selectedAssignment.handledBirds || 0) - effectiveMortality, 0);
    return calculateActualFcr(employeeActualToDate.feedBags * BAG_WEIGHT_KG, liveHeads, averageWeightGrams);
  }, [averageWeightGrams, employeeActualToDate.feedBags, employeeActualToDate.mortality, selectedAssignment, selectedEmployeeBuffer]);

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
        detail: `${variancePercent > 0 ? '+' : ''}${formatDecimal(variancePercent, 1)}% versus the day ${formatAgeDay(ageDay)} employee target curve.`
      });
      }
    }

    return warnings;
  }, [activeBuilding, ageDay, feedStockAfterLog, feedTarget, isLoading, mortality, selectedAssignment, selectedFeedItem, targetVarianceKg]);

  useEffect(() => {
    if (!token) return undefined;

    let isCancelled = false;

    const fetchDailyLogMasters = async () => {
      try {
        const [buildingData, feedData] = await Promise.all([
          apiClient.get('/api/buildings', { expectArray: true }).catch((err) => {
            console.warn('Falling back to default buildings:', err);
            return DEFAULT_BUILDINGS;
          }),
          apiClient.get('/api/inventory/items?category=Feed', { expectArray: true }).catch((err) => {
            console.warn('Falling back to default feed items:', err);
            return [];
          })
        ]);

        if (isCancelled) return;

        setBuildings(buildingData);
        setActiveBuilding((current) => (
          buildingData.length && !buildingData.some((building) => building.name === current)
            ? buildingData[0].name
            : current
        ));
        setFeedItems(feedData);
      } catch (err) {
        console.error('Failed to load daily log master data:', err);
      }
    };

    fetchDailyLogMasters();

    return () => {
      isCancelled = true;
    };
  }, [token]);


  useEffect(() => {
    if (!token || !activeBatchId) return undefined;

    let isCancelled = false;

    const fetchAssignments = async () => {
      setIsLoading(true);

      try {
        const data = await apiClient.get(`/api/batches/${activeBatchId}/employee-assignments`, { expectArray: true });
        if (!isCancelled) {
          setAssignmentsState({
            batchId: activeBatchId,
            rows: data
          });
        }
      } catch (err) {
        console.error(err);
        if (!isCancelled) {
          toastError(err.message || 'Cannot connect to employee assignments.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchAssignments();

    return () => {
      isCancelled = true;
    };
  }, [token, activeBatchId, toastError]);

  // --- OFFLINE DRAFT STATE MANAGEMENT ---
  useEffect(() => {
    if (!activeBatchId || skipSaveRef.current) return;

    const draft = {
      date,
      selectedEmployeeId,
      feedItemId,
      feedConsumed,
      mortality,
      averageWeightGrams,
      remarks,
    };

    const hasData = feedConsumed || mortality || averageWeightGrams || remarks;
    if (hasData) {
      localStorage.setItem(
        `octavioDailyLogDraft:${activeBatchId}:${activeBuilding}`,
        JSON.stringify(draft)
      );
    }
  }, [date, activeBuilding, selectedEmployeeId, feedItemId, feedConsumed, mortality, averageWeightGrams, remarks, activeBatchId]);

  const discardDraft = () => {
    if (!activeBatchId) return;
    skipSaveRef.current = true;
    localStorage.removeItem(`octavioDailyLogDraft:${activeBatchId}:${activeBuilding}`);
    setFormState({
      key: formKey,
      values: {
        ...formValues,
        feedConsumed: '',
        mortality: '',
        averageWeightGrams: '',
        remarks: ''
      }
    });
    success('Offline draft discarded.');
    setTimeout(() => {
      skipSaveRef.current = false;
    }, 0);
  };

  const resetForm = () => {
    const nextKey = getDailyLogFormKey(activeBatchId, activeBuilding, null);
    setFormState({
      key: nextKey,
      values: {
        ...formValues,
        feedConsumed: '',
        mortality: '',
        averageWeightGrams: '',
        remarks: ''
      }
    });
    setFormResetKey((current) => current + 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitInFlightRef.current) {
      return;
    }

    if (readOnly) {
      toastError('Your role can view daily logs but cannot add or edit entries.');
      return;
    }

    if (!activeBatch?.id) {
      toastError('Select an active batch before saving a daily log.');
      return;
    }

    if (!selectedAssignment) {
      toastError(`Assign at least one employee to Building ${activeBuilding} in the Employees tab first.`);
      return;
    }

    const feedQuantity = parseFloat(feedConsumed || 0);
    if (feedQuantity > 0 && !feedItemId) {
      toastError('Select which feed inventory item was consumed.');
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

    const result = dailyLogSchema.safeParse(newLogData);
    if (!result.success) {
      const errorMsg = result.error.issues.map(err => err.message).join('. ');
      toastError(errorMsg);
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const data = await apiClient.post('/api/logs', newLogData);

      setLogs((current) => [data, ...current]);
      success('Daily log entry saved!');
      setSuccessBurstKey((prev) => prev + 1);
      localStorage.removeItem(`octavioDailyLogDraft:${activeBatch.id}:${activeBuilding}`);
      resetForm();
    } catch (err) {
      console.error('Failed to save log:', err);
      toastError(err.message || 'Cannot connect to daily logs.');
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleEditSave = async (updatedLogData) => {
    if (editSubmitInFlightRef.current) {
      return;
    }

    if (readOnly || !canEditOrDelete) {
      toastError('Only admin.roland can edit existing daily logs.');
      setEditModalLog(null);
      return;
    }

    if (!activeBatch?.id || !editModalLog?.id) {
      toastError('Select an active batch before updating a daily log.');
      return;
    }

    const feedQuantity = Number(updatedLogData.feed || 0);
    if (feedQuantity > 0 && !updatedLogData.feedItemId) {
      toastError('Select which feed inventory item was consumed.');
      return;
    }

    const payload = {
      batchId: activeBatch.id,
      ...updatedLogData,
      feedItemId: feedQuantity > 0 ? updatedLogData.feedItemId : null
    };

    const result = dailyLogSchema.safeParse(payload);
    if (!result.success) {
      const errorMsg = result.error.issues.map(err => err.message).join('. ');
      toastError(errorMsg);
      return;
    }

    editSubmitInFlightRef.current = true;
    setIsEditSubmitting(true);

    try {
      const data = await apiClient.patch(`/api/logs/${editModalLog.id}`, payload);
      setLogs((current) => current.map((log) => log.id === editModalLog.id ? data : log));
      success('Daily log entry updated!');
      setSuccessBurstKey((prev) => prev + 1);
      setEditModalLog(null);
    } catch (err) {
      console.error('Failed to update log:', err);
      toastError(err.message || 'Cannot update daily log right now.');
    } finally {
      editSubmitInFlightRef.current = false;
      setIsEditSubmitting(false);
    }
  };

  const handleEditClick = (log) => {
    if (!canEditOrDelete) return;

    setEditModalLog(log);
  };

  const handleDeleteLog = async (idToDelete) => {
    if (readOnly || !canEditOrDelete) return;

    const isConfirmed = await confirm({
      title: 'Delete Daily Log',
      message: 'Are you sure you want to delete this daily log? This cannot be undone.',
      confirmText: 'Delete',
      danger: true
    });
    if (!isConfirmed) return;

    try {
      await apiClient.delete(`/api/logs/${idToDelete}`);
      setLogs((current) => current.filter((log) => log.id !== idToDelete));
      if (editModalLog?.id === idToDelete) setEditModalLog(null);
      success('Daily log deleted successfully!');
    } catch (err) {
      console.error('Failed to delete log:', err);
      toastError(err.message || 'Cannot delete daily log right now.');
    }
  };

  return (
    <div className="app-page font-hanken relative">
      {successBurstKey > 0 && <SuccessBurst key={successBurstKey} active={true} />}
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

      <OfflineStaleBanner data={[logs, buildings, feedItems, assignmentsState.rows]} />

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Building Feed</p>
          <p className="text-lg font-black mt-1 text-app-text font-jetbrains">
            {formatFeed(buildingLogTotals.feed)} sx
          </p>
        </div>

        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Building Mortality</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${buildingMortalityColor}`}>
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
                onClick={() => setActiveBuilding(building)}
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
          handleSubmit={handleSubmit}
          editingId={null}
          formResetKey={formResetKey}
          date={date}
          setDate={setDate}
          activeBuilding={activeBuilding}
          setActiveBuilding={setActiveBuilding}
          buildingNames={buildingNames}
          selectedEmployeeId={selectedEmployeeId}
          setSelectedEmployeeId={setSelectedEmployeeId}
          buildingAssignments={buildingAssignments}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          selectedAssignment={selectedAssignment}
          ageDay={ageDay}
          feedTarget={feedTarget}
          employeeActualToDate={employeeActualToDate}
          targetVarianceKg={targetVarianceKg}
          actualFcr={actualFcr}
          feedItemId={feedItemId}
          setFeedItemId={setFeedItemId}
          feedItems={feedItems}
          selectedFeedItem={selectedFeedItem}
          feedStockAfterLog={feedStockAfterLog}
          abnormalWarnings={abnormalWarnings}
          feedConsumed={feedConsumed}
          setFeedConsumed={setFeedConsumed}
          mortality={mortality}
          setMortality={setMortality}
          averageWeightGrams={averageWeightGrams}
          setAverageWeightGrams={setAverageWeightGrams}
          remarks={remarks}
          setRemarks={setRemarks}
          resetForm={resetForm}
          discardDraft={discardDraft}
          activeBatchId={activeBatch?.id}
        />
      )}

      <DailyLogHistory
        logs={logs}
        editingId={editModalLog?.id ?? null}
        readOnly={readOnly}
        canEditOrDelete={canEditOrDelete}
        handleEditClick={handleEditClick}
        handleDeleteLog={handleDeleteLog}
        activeBatch={activeBatch}
      />

      {editModalLog && (
        <DailyLogEditModal
          key={editModalLog.id}
          log={editModalLog}
          activeBatchId={activeBatch?.id}
          buildingNames={buildingNames}
          assignments={assignments}
          feedItems={feedItems}
          isSaving={isEditSubmitting}
          onClose={() => {
            if (!isEditSubmitting) setEditModalLog(null);
          }}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
