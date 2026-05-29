export default function EmployeeList({
  form,
  updateForm,
  handleSubmit,
  editingId,
  resetForm,
  buildings
}) {
  return (
    <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-hanken">
          {editingId ? 'Edit Employee' : 'New Employee'}
        </h3>
        {editingId && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-app-accent/15 text-app-accent font-jetbrains">
            #{editingId}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-app-text-secondary mb-1">Employee Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
            className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
            placeholder="e.g. Juan"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-app-text-secondary mb-1">Position</label>
            <input
              type="text"
              value={form.position}
              onChange={(event) => updateForm('position', event.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
              placeholder="Worker"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text-secondary mb-1">Building</label>
            <select
              value={form.assignedBuilding}
              onChange={(event) => updateForm('assignedBuilding', event.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-bold transition-all"
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
            <label className="block text-xs font-bold text-app-text-secondary mb-1">Hire Date</label>
            <input
              type="date"
              value={form.hireDate}
              onChange={(event) => updateForm('hireDate', event.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-bold transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text-secondary mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => updateForm('phone', event.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-app-text-secondary mb-1">Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={(event) => updateForm('notes', event.target.value)}
            className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
            placeholder="Optional"
          />
        </div>

        <div className="flex gap-2">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 bg-app-card border border-app-border text-app-text p-3 rounded-xl font-bold shadow-sm hover:bg-app-bg active:scale-95 transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            className="flex-[2] bg-app-accent text-app-on-accent p-3 rounded-xl font-bold shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
          >
            {editingId ? 'Update Employee' : 'Save Employee'}
          </button>
        </div>
      </form>
    </div>
  );
}
