import { useEffect, useMemo, useState } from 'react';

function formatBirds(value) {
  return Number(value || 0).toLocaleString();
}

function formatFeed(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

function getAssignmentBuilding(assignment) {
  return String(assignment.assignedBuilding || '').toUpperCase();
}

function getInitialValues(log, feedItems) {
  return {
    date: log.date || '',
    building: log.building || 'A',
    employeeId: log.employeeId ? String(log.employeeId) : '',
    feedItemId: log.feedItemId ? String(log.feedItemId) : (feedItems[0]?.id ? String(feedItems[0].id) : ''),
    feed: String(log.feed || ''),
    mortality: String(log.mortality || ''),
    averageWeightGrams: log.averageWeightGrams == null ? '' : String(log.averageWeightGrams),
    remarks: log.remarks || ''
  };
}

export default function DailyLogEditModal({
  log,
  activeBatchId,
  buildingNames,
  assignments,
  feedItems,
  isSaving,
  onClose,
  onSave
}) {
  const [values, setValues] = useState(() => getInitialValues(log, feedItems));

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const employeeOptions = useMemo(() => {
    const options = assignments.filter((assignment) => {
      const assignedBuilding = getAssignmentBuilding(assignment);
      const hasHandledBirds = Number(assignment.handledBirds || 0) > 0;
      return hasHandledBirds && (!assignedBuilding || assignedBuilding === String(values.building).toUpperCase());
    });

    if (log.employeeId && !options.some((assignment) => String(assignment.employeeId) === String(log.employeeId))) {
      options.push({
        employeeId: log.employeeId,
        employeeName: log.employeeName || 'Current employee',
        assignedBuilding: log.building,
        handledBirds: log.handledBirds || 0,
        buildingChicksLoaded: log.handledBirds || 0
      });
    }

    return options;
  }, [assignments, log, values.building]);

  const feedOptions = useMemo(() => {
    const options = [...feedItems];
    if (log.feedItemId && !options.some((item) => String(item.id) === String(log.feedItemId))) {
      options.push({
        id: log.feedItemId,
        name: log.feedItemName || 'Current feed item',
        currentStock: 0,
        unit: 'sacks'
      });
    }
    return options;
  }, [feedItems, log]);

  const selectedEmployeeId = employeeOptions.some(
    (assignment) => String(assignment.employeeId) === String(values.employeeId)
  )
    ? values.employeeId
    : (employeeOptions[0]?.employeeId ? String(employeeOptions[0].employeeId) : '');
  const selectedAssignment = employeeOptions.find(
    (assignment) => String(assignment.employeeId) === String(selectedEmployeeId)
  );

  const setField = (field, value) => {
    setValues((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const feedQuantity = parseFloat(values.feed || 0);

    await onSave({
      date: values.date,
      building: values.building,
      employeeId: selectedAssignment?.employeeId || selectedEmployeeId,
      handledBirds: selectedAssignment?.handledBirds ?? log.handledBirds ?? 0,
      feedItemId: feedQuantity > 0 ? values.feedItemId : null,
      feed: feedQuantity,
      mortality: parseInt(values.mortality || 0, 10),
      averageWeightGrams: values.averageWeightGrams === '' ? null : parseFloat(values.averageWeightGrams),
      remarks: values.remarks
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4 animate-backdrop-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-log-edit-title"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-app-border bg-app-card shadow-xl animate-modal-in"
      >
        <div className="flex items-start justify-between gap-4 border-b border-app-border/50 p-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary font-inter">
              Existing entry
            </p>
            <h3 id="daily-log-edit-title" className="mt-1 text-xl font-black text-app-text font-hanken">
              Edit daily log
            </h3>
            <p className="mt-1 text-sm font-semibold leading-snug text-app-text-secondary font-inter">
              Updates this saved record for Batch {activeBatchId}. Your new-entry draft stays open behind this popup.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-2 text-app-text-secondary transition-colors hover:bg-app-bg hover:text-app-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
            aria-label="Close edit daily log popup"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[68vh] space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-wide text-app-text-secondary font-inter">
                Date
              </span>
              <input
                type="date"
                required
                value={values.date}
                onChange={(event) => setField('date', event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-app-border bg-app-bg px-3 text-sm font-bold text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 font-jetbrains"
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-wide text-app-text-secondary font-inter">
                Building
              </span>
              <select
                required
                value={values.building}
                onChange={(event) => setField('building', event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-app-border bg-app-bg px-3 text-sm font-bold text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 font-jetbrains"
              >
                {buildingNames.map((building) => (
                  <option key={building} value={building}>
                    Building {building}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-wide text-app-text-secondary font-inter">
              Employee share
            </span>
            <select
              required
              value={selectedEmployeeId}
              onChange={(event) => setField('employeeId', event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-app-border bg-app-bg px-3 text-sm font-bold text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
            >
              {employeeOptions.length === 0 && (
                <option value="">No employees assigned</option>
              )}
              {employeeOptions.map((assignment) => (
                <option key={assignment.employeeId} value={assignment.employeeId}>
                  {assignment.employeeName} &bull; {formatBirds(assignment.handledBirds)} birds
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-wide text-app-text-secondary font-inter">
                Feed used (sacks)
              </span>
              <input
                type="number"
                step="0.5"
                min="0"
                required
                value={values.feed}
                onChange={(event) => setField('feed', event.target.value)}
                placeholder="0.00"
                className="mt-1 min-h-11 w-full rounded-lg border border-app-border bg-app-bg px-3 text-right text-base font-black text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 font-jetbrains"
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-wide text-app-text-secondary font-inter">
                Mortality (birds)
              </span>
              <input
                type="number"
                min="0"
                required
                value={values.mortality}
                onChange={(event) => setField('mortality', event.target.value)}
                placeholder="0"
                className="mt-1 min-h-11 w-full rounded-lg border border-app-border bg-app-bg px-3 text-right text-base font-black text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 font-jetbrains"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-[10px] font-black uppercase tracking-wide text-app-text-secondary font-inter">
              Feed inventory item
            </span>
            <select
              value={values.feedItemId}
              onChange={(event) => setField('feedItemId', event.target.value)}
              disabled={feedOptions.length === 0}
              className="mt-1 min-h-11 w-full rounded-lg border border-app-border bg-app-bg px-3 text-sm font-bold text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 disabled:opacity-50"
            >
              {feedOptions.length === 0 && (
                <option value="">No feed items loaded</option>
              )}
              {feedOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} &bull; {formatFeed(item.currentStock)} {item.unit}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-wide text-app-text-secondary font-inter">
                Average weight (g)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={values.averageWeightGrams}
                onChange={(event) => setField('averageWeightGrams', event.target.value)}
                placeholder="Optional"
                className="mt-1 min-h-11 w-full rounded-lg border border-app-border bg-app-bg px-3 text-right text-base font-black text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 font-jetbrains"
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-black uppercase tracking-wide text-app-text-secondary font-inter">
                Remarks
              </span>
              <input
                type="text"
                value={values.remarks}
                onChange={(event) => setField('remarks', event.target.value)}
                placeholder="Optional remarks"
                className="mt-1 min-h-11 w-full rounded-lg border border-app-border bg-app-bg px-3 text-sm font-bold text-app-text outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-app-border/50 p-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-11 rounded-xl border border-app-border bg-app-bg px-4 text-xs font-black uppercase tracking-wider text-app-text-secondary transition-colors hover:bg-app-border disabled:opacity-50 font-jetbrains"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="h-11 rounded-xl bg-app-accent px-5 text-xs font-black uppercase tracking-wider text-app-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 font-jetbrains"
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
