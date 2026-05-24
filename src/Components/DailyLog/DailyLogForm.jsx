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

const BAG_WEIGHT_KG = 50; // Constant match

export default function DailyLogForm({
  handleSubmit,
  editingId,
  date,
  setDate,
  error,
  activeBuilding,
  setActiveBuilding,
  buildingNames,
  selectedEmployeeId,
  setSelectedEmployeeId,
  buildingAssignments,
  isLoading,
  selectedAssignment,
  ageDay,
  feedTarget,
  employeeActualToDate,
  targetVarianceKg,
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
  resetForm
}) {
  return (
    <div className={`bg-app-card p-5 rounded-2xl border-2 transition-colors duration-300 mb-6 ${editingId ? 'border-app-accent bg-app-accent/5' : 'border-app-border'}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-between items-center border-b border-app-border/40 pb-3">
          <h3 className={`text-[10px] font-black uppercase tracking-wider ${editingId ? 'text-app-accent' : 'text-app-text-secondary'}`}>
            {editingId ? 'Editing Entry' : 'New Entry'}
          </h3>
          <input
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="px-3 py-1.5 text-xs border border-app-border rounded-lg bg-app-bg text-app-text focus:ring-2 focus:ring-app-accent/20 outline-none font-black font-jetbrains"
          />
        </div>

        {error && (
          <div className="bg-app-danger-bg text-app-danger p-3 rounded-xl text-sm font-bold border border-app-danger">
            {error}
          </div>
        )}

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">
            Building
          </label>
          <div className="flex space-x-1.5">
            {buildingNames.map((building) => (
              <button
                key={building}
                type="button"
                onClick={() => setActiveBuilding(building)}
                className={`flex-1 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all border cursor-pointer ${
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

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">
            Employee Share
          </label>
          <select
            required
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
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
            <p className="text-[10px] text-app-text-secondary mt-1 font-black">Loading employee shares...</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">
              Handled Birds
            </label>
            <div className="h-10 flex items-center px-3 border border-app-border rounded-xl bg-app-bg/50 text-app-text font-black text-sm font-jetbrains">
              {formatBirds(selectedAssignment?.handledBirds)}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">
              Building Chicks
            </label>
            <div className="h-10 flex items-center px-3 border border-app-border rounded-xl bg-app-bg/50 text-app-text font-black text-sm font-jetbrains">
              {formatBirds(selectedAssignment?.buildingChicksLoaded)}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-app-border overflow-hidden bg-app-bg/30">
          <div className="flex items-center justify-between bg-app-bg px-3 py-2 border-b border-app-border/40">
            <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
              Daily Target Curve
            </p>
            <span className="text-[10px] font-black text-app-accent font-jetbrains">
              {ageDay ? `Day ${ageDay}` : 'No age'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 text-xs">
            <div className="bg-app-card border border-app-border/40 p-2 rounded-lg">
              <p className="text-app-text-secondary font-black uppercase tracking-wider text-[9px]">Target Feed</p>
              <p className="font-black text-app-text mt-0.5 font-jetbrains">
                {feedTarget ? `${formatDecimal(feedTarget.targetBags, 2)} bags` : '--'}
              </p>
              <p className="text-[10px] text-app-text-secondary font-jetbrains">
                {feedTarget ? `${formatDecimal(feedTarget.targetKg, 0)} kg` : 'No curve for day'}
              </p>
            </div>

            <div className="bg-app-card border border-app-border/40 p-2 rounded-lg">
              <p className="text-app-text-secondary font-black uppercase tracking-wider text-[9px]">Actual To Date</p>
              <p className="font-black text-app-text mt-0.5 font-jetbrains">
                {formatDecimal(employeeActualToDate.feedBags, 2)} bags
              </p>
              <p className="text-[10px] text-app-text-secondary font-jetbrains">
                {formatDecimal(employeeActualToDate.feedBags * BAG_WEIGHT_KG, 0)} kg
              </p>
            </div>

            <div className="bg-app-card border border-app-border/40 p-2 rounded-lg">
              <p className="text-app-text-secondary font-black uppercase tracking-wider text-[9px]">Feed Variance</p>
              <p className={`font-black mt-0.5 font-jetbrains ${targetVarianceKg > 0 ? 'text-app-danger' : 'text-app-success'}`}>
                {targetVarianceKg === null ? '--' : `${targetVarianceKg > 0 ? '+' : ''}${formatDecimal(targetVarianceKg, 0)} kg`}
              </p>
              <p className="text-[10px] text-app-text-secondary font-jetbrains">
                {targetVarianceKg === null ? 'No target' : `${targetVarianceKg > 0 ? '+' : ''}${formatDecimal(targetVarianceKg / BAG_WEIGHT_KG, 2)} bags`}
              </p>
            </div>

            <div className="bg-app-card border border-app-border/40 p-2 rounded-lg">
              <p className="text-app-text-secondary font-black uppercase tracking-wider text-[9px]">Weight / FCR</p>
              <p className="font-black text-app-text mt-0.5 font-jetbrains">
                {feedTarget ? `${formatBirds(feedTarget.weightGrams)}g / ${formatDecimal(feedTarget.fcr, 2)}` : '--'}
              </p>
              <p className="text-[10px] text-app-text-secondary font-jetbrains">
                Actual FCR {actualFcr ? formatDecimal(actualFcr, 2) : '--'}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">
            Feed Inventory Item
          </label>
          <select
            value={feedItemId}
            onChange={(event) => setFeedItemId(event.target.value)}
            disabled={feedItems.length === 0}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {feedItems.length === 0 && (
              <option value="">No feed items yet</option>
            )}
            {feedItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} &bull; {formatFeed(item.currentStock)} {item.unit}
              </option>
            ))}
          </select>
          {selectedFeedItem && (
            <p className={`text-[10px] font-black mt-1 font-jetbrains ${feedStockAfterLog < 0 ? 'text-app-danger' : 'text-app-text-secondary'}`}>
              Stock after this log: {formatFeed(feedStockAfterLog)} {selectedFeedItem.unit}
            </p>
          )}
        </div>

        {abnormalWarnings.length > 0 && (
          <div className="rounded-xl border border-app-warning bg-app-warning-bg p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-app-warning">
              Abnormal value warning
            </p>
            <div className="mt-2 space-y-2">
              {abnormalWarnings.map((warning) => (
                <div key={warning.label} className="rounded-lg bg-app-bg p-2 border border-app-warning/10">
                  <p className="text-xs font-black text-app-text">{warning.label}</p>
                  <p className="text-[10px] font-bold text-app-text-secondary mt-0.5">{warning.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex space-x-3 pt-2">
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">
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
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text text-lg font-black focus:ring-2 focus:ring-app-accent/20 outline-none font-jetbrains"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">
              Mortality (Birds)
            </label>
            <input
              type="number"
              min="0"
              required
              value={mortality}
              onChange={(event) => setMortality(event.target.value)}
              placeholder="0"
              className="w-full p-3 border border-app-danger/30 rounded-xl bg-app-bg text-app-danger text-lg font-black focus:ring-2 focus:ring-app-danger/20 outline-none font-jetbrains"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">
            Actual Avg Weight (g)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={averageWeightGrams}
            onChange={(event) => setAverageWeightGrams(event.target.value)}
            placeholder="Optional, usually Day 7 / 14 / 21"
            className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text font-bold focus:ring-2 focus:ring-app-accent/20 outline-none font-jetbrains text-sm placeholder-app-text-secondary/40"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">
            Remarks
          </label>
          <input
            type="text"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Optional remarks"
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          />
        </div>

        <div className="flex space-x-2 mt-4 pt-2">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 bg-app-bg text-app-text border border-app-border px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="flex-[2] bg-app-accent text-app-on-accent px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            {editingId ? 'Update Log' : 'Save Log'}
          </button>
        </div>
      </form>
    </div>
  );
}
