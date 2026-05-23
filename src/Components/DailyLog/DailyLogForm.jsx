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
            className="p-1.5 text-sm border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none font-bold"
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
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none font-bold"
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
            <p className="text-[10px] text-gray-400 mt-1 font-semibold">Loading employee shares...</p>
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
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none disabled:opacity-60 font-bold"
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

        {abnormalWarnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20">
            <p className="text-[10px] font-black uppercase tracking-wider text-semantic-warning">
              Abnormal value warning
            </p>
            <div className="mt-2 space-y-2">
              {abnormalWarnings.map((warning) => (
                <div key={warning.label} className="rounded-lg bg-white/80 p-2 dark:bg-slate-900/60">
                  <p className="text-xs font-black text-gray-900 dark:text-white">{warning.label}</p>
                  <p className="text-[10px] font-bold text-gray-500 dark:text-gray-300 mt-0.5">{warning.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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
  );
}
