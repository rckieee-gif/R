export default function EmployeeList({
  form,
  updateForm,
  handleSubmit,
  editingId,
  resetForm,
  buildings,
  error
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          {editingId ? 'Edit Employee' : 'New Employee'}
        </h3>
        {editingId && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-secondary/10 text-secondary">
            #{editingId}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Employee Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
            placeholder="e.g. Juan"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Position</label>
            <input
              type="text"
              value={form.position}
              onChange={(event) => updateForm('position', event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              placeholder="Worker"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Building</label>
            <select
              value={form.assignedBuilding}
              onChange={(event) => updateForm('assignedBuilding', event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none font-bold"
            >
              <option value="">Any</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.name}>{building.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Hire Date</label>
            <input
              type="date"
              value={form.hireDate}
              onChange={(event) => updateForm('hireDate', event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => updateForm('phone', event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={(event) => updateForm('notes', event.target.value)}
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
            placeholder="Optional"
          />
        </div>

        <div className="flex gap-2">
          {editingId && (
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
            {editingId ? 'Update Employee' : 'Save Employee'}
          </button>
        </div>
      </form>
    </div>
  );
}
