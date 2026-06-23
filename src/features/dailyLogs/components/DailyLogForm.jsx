import { useState } from 'react';

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

const MORTALITY_WARNING_HEADS = 5;
const MORTALITY_WARNING_RATE = 0.005;

export default function DailyLogForm({
  handleSubmit,
  editingId,
  formResetKey = 0,
  date,
  setDate,
  activeBuilding,
  setActiveBuilding,
  buildingNames,
  selectedEmployeeId,
  setSelectedEmployeeId,
  buildingAssignments,
  isLoading,
  isSubmitting = false,
  selectedAssignment,
  feedTarget,
  actualFcr,
  feedItemId,
  setFeedItemId,
  feedItems,
  selectedFeedItem,
  feedStockAfterLog,
  abnormalWarnings,
  feedConsumed,
  setFeedConsumed,
  mortality,
  setMortality,
  averageWeightGrams,
  setAverageWeightGrams,
  remarks,
  setRemarks,
  resetForm,
  discardDraft,
  activeBatchId
}) {
  const currentPropsKey = `${activeBuilding}:${editingId}:${formResetKey}`;
  const [stepState, setStepState] = useState(() => ({
    key: currentPropsKey,
    step: 1
  }));
  const step = stepState.key === currentPropsKey ? stepState.step : 1;
  const setStep = (nextStepValue) => {
    setStepState((current) => {
      const currentStep = current.key === currentPropsKey ? current.step : 1;
      const nextStep = typeof nextStepValue === 'function' ? nextStepValue(currentStep) : nextStepValue;

      return {
        key: currentPropsKey,
        step: nextStep
      };
    });
  };

  const draftKey = `octavioDailyLogDraft:${activeBatchId}:${activeBuilding}`;
  const draftData = localStorage.getItem(draftKey);
  const hasSavedDraft = Boolean(draftData && !editingId);

  const nextStep = () => {
    // Basic validation per step
    if (step === 1 && !date) return;
    if (step === 2 && !selectedEmployeeId) return;
    if (step === 3) {
      if (feedConsumed !== '') {
        const parsedFeed = parseFloat(feedConsumed);
        if (isNaN(parsedFeed) || parsedFeed < 0) return;
        if (parsedFeed > 0 && !feedItemId) return;
      }
    }
    if (step === 4) {
      if (mortality !== '') {
        const parsedMort = parseInt(mortality, 10);
        if (isNaN(parsedMort) || parsedMort < 0) return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 7));
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className={`bg-app-card p-5 rounded-2xl border border-app-border shadow-sm mb-6 transition-all duration-300 ${editingId ? 'border-app-accent ring-1 ring-app-accent/20 bg-app-accent/5' : ''}`}>
      {/* Draft Restore Alert */}
      {hasSavedDraft && step === 1 && (
        <div className="bg-app-accent/5 border border-app-accent/20 rounded-xl p-3 flex items-center justify-between gap-3 text-xs mb-4 animate-toast-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-app-accent text-sm">restore</span>
            <span className="font-bold text-app-text-secondary">Restored unsaved progress draft.</span>
          </div>
          <button
            type="button"
            onClick={discardDraft}
            className="px-2.5 py-1 text-[10px] font-black uppercase text-app-danger hover:bg-app-danger-bg rounded-lg border border-app-danger/10 cursor-pointer transition-colors"
          >
            Discard
          </button>
        </div>
      )}

      {/* Wizard Stepper Header */}
      <div className="mb-6 animate-toast-in">
        <div className="flex items-center justify-between text-xs font-bold text-app-text-secondary mb-3">
          <span className="uppercase tracking-wider font-jetbrains text-[10px]">
            {editingId ? 'Edit Entry Wizard' : 'New Entry Wizard'}
          </span>
          <span className="font-jetbrains text-[10px]">Step {step} of 7</span>
        </div>
        
        {/* Stepper Progress Bar */}
        <div className="flex gap-1.5 h-1.5 rounded-full bg-app-bg overflow-hidden border border-app-border">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className={`flex-1 h-full rounded-full transition-all duration-300 ${
                i <= step ? 'bg-app-accent' : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* Step Titles */}
        <div className="grid grid-cols-7 text-center mt-2.5 text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-app-text-secondary gap-0.5">
          <span className={step === 1 ? 'text-app-accent' : ''}>1. Bldg</span>
          <span className={step === 2 ? 'text-app-accent' : ''}>2. Worker</span>
          <span className={step === 3 ? 'text-app-accent' : ''}>3. Feed</span>
          <span className={step === 4 ? 'text-app-accent' : ''}>4. Mortality</span>
          <span className={step === 5 ? 'text-app-accent' : ''}>5. Weight</span>
          <span className={step === 6 ? 'text-app-accent' : ''}>6. Warnings</span>
          <span className={step === 7 ? 'text-app-accent' : ''}>7. Save</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* STEP 1: Building & Date */}
        {step === 1 && (
          <div className="space-y-4 animate-toast-in">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dl-date" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                Select Date
              </label>
              <input
                id="dl-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold focus:ring-2 focus:ring-app-accent/20 outline-none font-jetbrains"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                Select Building
              </label>
              <div className="flex space-x-1.5">
                {buildingNames.map((building) => (
                  <button
                    key={building}
                    type="button"
                    onClick={() => setActiveBuilding(building)}
                    className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-card ${
                      activeBuilding === building
                        ? 'bg-app-accent text-app-on-accent border-app-accent shadow-sm scale-102'
                        : 'bg-app-bg text-app-text-secondary border-app-border hover:bg-app-accent/5 hover:text-app-accent'
                    }`}
                  >
                    Bldg {building}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Worker Selection */}
        {step === 2 && (
          <div className="space-y-4 animate-toast-in">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dl-employee" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                Employee Share
              </label>
              <select
                id="dl-employee"
                required
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
                className="w-full px-3 py-2.5 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
              >
                {buildingAssignments.length === 0 && (
                  <option value="">No employees assigned</option>
                )}
                {buildingAssignments.map((assignment) => (
                  <option key={assignment.employeeId} value={assignment.employeeId}>
                    {assignment.employeeName} &bull; {formatBirds(assignment.handledBirds)} birds
                  </option>
                ))}
              </select>
              {isLoading && (
                <p className="text-[10px] text-app-text-secondary font-black">Loading employee shares...</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">
                  Handled Birds
                </label>
                <div className="h-10 flex items-center px-3 border border-app-border rounded-xl bg-app-bg/40 text-app-text font-black text-sm font-jetbrains">
                  {formatBirds(selectedAssignment?.handledBirds)}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">
                  Building Chicks
                </label>
                <div className="h-10 flex items-center px-3 border border-app-border rounded-xl bg-app-bg/40 text-app-text font-black text-sm font-jetbrains">
                  {formatBirds(selectedAssignment?.buildingChicksLoaded)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Enter Feed Used */}
        {step === 3 && (
          <div className="space-y-4 animate-toast-in">
            <div className="flex flex-col gap-1">
              <label htmlFor="dl-feed" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                Feed Used (Sacks)
              </label>
              <input
                id="dl-feed"
                type="number"
                step="0.5"
                min="0"
                required
                value={feedConsumed}
                onChange={(event) => setFeedConsumed(event.target.value)}
                placeholder="0.00"
                className="w-full p-2.5 border border-app-border rounded-xl bg-app-bg text-app-text text-lg font-black focus:ring-2 focus:ring-app-accent/20 outline-none font-jetbrains"
              />
            </div>

            {/* Expected Today & Difference pedagogical helper */}
            {feedTarget && (
              <div className="p-3 rounded-xl border border-app-border bg-app-bg/30 text-xs space-y-1.5 font-jetbrains shadow-inner">
                <p className="text-app-text-secondary font-semibold flex items-center justify-between">
                  <span>Expected today:</span>
                  <span className="font-bold text-app-text">{formatDecimal(feedTarget.targetBags, 2)} sacks</span>
                </p>
                {feedConsumed !== '' && !isNaN(parseFloat(feedConsumed)) && (
                  <p className="text-app-text-secondary font-semibold flex items-center justify-between">
                    <span>Difference:</span>
                    <span className={`font-black ${
                      parseFloat(feedConsumed) - feedTarget.targetBags > 0 ? 'text-app-danger' : 'text-app-success'
                    }`}>
                      {parseFloat(feedConsumed) - feedTarget.targetBags > 0 ? '+' : ''}
                      {formatDecimal(parseFloat(feedConsumed) - feedTarget.targetBags, 2)} sacks
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="dl-feed-item" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                Feed Inventory Item
              </label>
              <select
                id="dl-feed-item"
                value={feedItemId}
                onChange={(event) => setFeedItemId(event.target.value)}
                disabled={feedItems.length === 0}
                className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {feedItems.length === 0 && (
                  <option value="">No feed items loaded</option>
                )}
                {feedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} &bull; {formatFeed(item.currentStock)} {item.unit}
                  </option>
                ))}
              </select>
              {selectedFeedItem && (
                <p className={`text-[10px] font-semibold mt-1 font-jetbrains ${feedStockAfterLog < 0 ? 'text-app-danger' : 'text-app-text-secondary'}`}>
                  Stock after this log: {formatFeed(feedStockAfterLog)} {selectedFeedItem.unit}
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Enter Mortality */}
        {step === 4 && (
          <div className="space-y-4 animate-toast-in">
            <div className="flex flex-col gap-1">
              <label htmlFor="dl-mortality" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                Mortality (Birds)
              </label>
              <input
                id="dl-mortality"
                type="number"
                min="0"
                required
                value={mortality}
                onChange={(event) => setMortality(event.target.value)}
                placeholder="0"
                className="w-full p-2.5 border border-app-danger/30 rounded-xl bg-app-bg text-app-danger text-lg font-black focus:ring-2 focus:ring-app-danger/20 outline-none font-jetbrains"
              />
            </div>

            {/* Normal warning level pedagogical helper */}
            {(() => {
              const handledBirds = Number(selectedAssignment?.handledBirds || 0);
              const mortalityThreshold = Math.max(MORTALITY_WARNING_HEADS, Math.ceil(handledBirds * MORTALITY_WARNING_RATE));
              return (
                <div className="p-3 rounded-xl border border-app-border bg-app-bg/30 text-xs font-jetbrains shadow-inner">
                  <p className="text-app-text-secondary font-semibold flex items-center justify-between">
                    <span>Normal warning level:</span>
                    <span className="font-bold text-app-text">{mortalityThreshold} heads</span>
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {/* STEP 5: Enter Average Weight & Remarks */}
        {step === 5 && (
          <div className="space-y-4 animate-toast-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="dl-weight" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                  Actual Avg Weight (g)
                </label>
                <input
                  id="dl-weight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={averageWeightGrams}
                  onChange={(event) => setAverageWeightGrams(event.target.value)}
                  placeholder="Average bird weight (g)"
                  className="w-full p-2.5 border border-app-border rounded-xl bg-app-bg text-app-text font-bold focus:ring-2 focus:ring-app-accent/20 outline-none font-jetbrains text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="dl-remarks" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
                  Remarks
                </label>
                <input
                  id="dl-remarks"
                  type="text"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Optional remarks"
                  className="w-full p-2.5 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20"
                />
              </div>
            </div>

            {/* Estimated FCR live preview */}
            {averageWeightGrams && actualFcr && (
              <div className="p-3 rounded-xl border border-app-border bg-app-bg/30 text-xs font-jetbrains shadow-inner">
                <p className="text-app-text-secondary font-semibold flex items-center justify-between">
                  <span>Estimated FCR:</span>
                  <span className="font-bold text-app-text">{formatDecimal(actualFcr, 2)}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 6: Review Warnings */}
        {step === 6 && (
          <div className="space-y-4 animate-toast-in">
            {abnormalWarnings.length > 0 ? (
              <div className="rounded-xl border border-app-warning bg-app-warning-bg p-3.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-app-warning flex items-center gap-1.5 font-jetbrains">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Abnormal Warnings Detected
                </p>
                <div className="mt-2.5 space-y-2">
                  {abnormalWarnings.map((warning) => (
                    <div key={warning.label} className="text-xs text-app-text-secondary">
                      <span className="font-extrabold text-app-text">{warning.label}: </span>
                      {warning.detail}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-app-success bg-app-success-bg p-4 flex flex-col items-center text-center gap-2">
                <span className="material-symbols-outlined text-app-success text-3xl font-bold">check_circle</span>
                <div>
                  <h4 className="text-xs font-black text-app-success uppercase tracking-wider font-jetbrains">All Clear</h4>
                  <p className="text-[11px] text-app-text-secondary mt-1">
                    No abnormal warnings detected for feed variance, mortality threshold, or inventory stock levels.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 7: Save Log */}
        {step === 7 && (
          <div className="space-y-4 animate-toast-in">
            <div className="rounded-xl border border-app-border bg-app-bg/50 p-4 space-y-3.5 text-xs">
              <h4 className="font-extrabold text-app-text text-[13px] border-b border-app-border/40 pb-2">
                Verify Log Details
              </h4>
              
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                <div>
                  <p className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider font-jetbrains">Date & Building</p>
                  <p className="font-black text-app-text mt-0.5 font-jetbrains">{date} &bull; Bldg {activeBuilding}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider font-jetbrains">Employee</p>
                  <p className="font-black text-app-text mt-0.5">{selectedAssignment?.employeeName || 'None'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider font-jetbrains">Feed Consumed</p>
                  <p className="font-black text-app-text mt-0.5 font-jetbrains">
                    {feedConsumed || '0'} bags {selectedFeedItem ? `(${selectedFeedItem.name})` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider font-jetbrains">Mortality</p>
                  <p className="font-black text-app-danger mt-0.5 font-jetbrains">{mortality || '0'} birds</p>
                </div>
                {averageWeightGrams && (
                  <div>
                    <p className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider font-jetbrains">Avg Weight</p>
                    <p className="font-black text-app-accent mt-0.5 font-jetbrains">{averageWeightGrams} g</p>
                  </div>
                )}
                {remarks && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider font-jetbrains">Remarks</p>
                    <p className="font-bold text-app-text mt-0.5 italic">"{remarks}"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-2.5 pt-3 border-t border-app-border/40 font-jetbrains">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="flex-1 bg-app-bg text-app-text border border-app-border px-3.5 h-11 md:h-10 flex items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-app-border active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-card"
            >
              Back
            </button>
          ) : (
            editingId && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setStep(1);
                }}
                className="flex-1 bg-app-bg text-app-text border border-app-border px-3.5 h-11 md:h-10 flex items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-card"
              >
                Cancel
              </button>
            )
          )}

          {step < 7 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex-[2] bg-app-accent text-app-on-accent px-3.5 h-11 md:h-10 flex items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-card"
            >
              Next Step
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] bg-app-accent text-app-on-accent px-3.5 h-11 md:h-10 flex items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:opacity-95 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-card disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isSubmitting ? 'Saving...' : (editingId ? 'Update Log' : 'Save Log')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
