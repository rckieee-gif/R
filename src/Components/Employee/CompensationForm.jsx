
function formatMoney(amount) {
  return `PHP ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatBirds(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

function getDraftPoolIds(draft) {
  return (draft?.poolEmployeeIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
}

function buildCompDraft(overrides = {}) {
  const draft = overrides || {};

  return {
    handledBirds: draft.handledBirds ?? '',
    ratePerBird: draft.ratePerBird ?? '1.5',
    poolEmployeeIds: draft.poolEmployeeIds || [],
    remarks: draft.remarks ?? ''
  };
}

export default function CompensationForm({
  compensationRows,
  paySheetEmployees,
  compDrafts,
  updateCompDraft,
  updatePoolSelection,
  canEditOrDelete,
  handleEdit,
  handleArchive,
  handleCompSave,
  isLoading,
  activeBatch
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3 ml-1 no-print">
        <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider font-hanken">
          Batch Pay Sheet
        </h3>
        <span className="text-[10px] text-app-text-secondary font-bold font-jetbrains">
          {activeBatch?.id ? `Batch ${activeBatch.id}` : 'No active batch'}
        </span>
      </div>

      {isLoading && (
        <p className="text-sm text-app-text-secondary mb-3 font-semibold">Loading employees...</p>
      )}

      <div className="space-y-3">
        {compensationRows.map((employee) => {
          const draft = buildCompDraft(compDrafts[employee.employeeId]);
          const selectedPoolIds = getDraftPoolIds(draft);
          const selectedPoolNames = paySheetEmployees
            .filter((item) => selectedPoolIds.includes(item.id))
            .map((item) => item.name);

          return (
            <div
              key={employee.employeeId}
              className="bg-app-card p-4 rounded-xl shadow-sm border border-app-border"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-app-text font-hanken">{employee.employeeName}</p>
                  <p className="text-xs text-app-text-secondary font-bold uppercase mt-1">
                    {employee.position || 'Employee'} {employee.assignedBuilding ? `- Bldg ${employee.assignedBuilding}` : ''}
                  </p>
                </div>

                {canEditOrDelete && (
                  <div className="flex gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => handleEdit(employee)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-app-accent text-app-on-accent hover:scale-105 active:scale-95 shadow-sm transition-all cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive({ ...employee, id: employee.employeeId, name: employee.employeeName })}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-app-danger-bg text-app-danger border border-app-danger hover:bg-opacity-90 transition-all cursor-pointer"
                    >
                      Archive
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <div>
                  <label className="block text-[10px] font-bold text-app-text-secondary mb-1">Handled Birds</label>
                  <input
                    type="number"
                    min="0"
                    value={draft.handledBirds}
                    onChange={(event) => updateCompDraft(employee.employeeId, 'handledBirds', event.target.value)}
                    disabled={!canEditOrDelete}
                    className="w-full p-2 border border-app-border rounded-lg bg-app-bg text-app-text outline-none font-bold font-jetbrains focus:ring-2 focus:ring-app-accent"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-app-text-secondary mb-1">Rate / Bird</label>
                  <input
                    type="number"
                    min="1.5"
                    max="3"
                    step="0.01"
                    value={draft.ratePerBird}
                    onChange={(event) => updateCompDraft(employee.employeeId, 'ratePerBird', event.target.value)}
                    disabled={!canEditOrDelete}
                    className="w-full p-2 border border-app-border rounded-lg bg-app-bg text-app-text outline-none font-bold font-jetbrains focus:ring-2 focus:ring-app-accent"
                    placeholder="1.50"
                  />
                </div>

                <div className="no-print">
                  <label className="flex items-center gap-1 text-[10px] font-bold text-app-text-secondary mb-1">
                    Corpo With
                    <span className="relative inline-flex group">
                      <button
                        type="button"
                        className="w-4 h-4 rounded-full border border-app-border text-[10px] leading-none font-black text-app-text-secondary bg-app-bg focus:outline-none focus:ring-2 focus:ring-app-accent cursor-pointer"
                        aria-label="Corpo pool instructions"
                      >
                        i
                      </button>
                      <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg bg-app-card border border-app-border px-3 py-2 text-[11px] font-semibold leading-snug text-app-text shadow-lg group-hover:block group-focus-within:block">
                        Select coworkers to pool handled birds. The app adds everyone's handled birds, splits the total equally across the pool members, then applies each employee's rate per bird.
                      </span>
                    </span>
                  </label>
                  <details className="group rounded-lg border border-app-border bg-app-bg text-app-text">
                    <summary className="min-h-10 cursor-pointer list-none px-2 py-2 text-sm font-bold outline-none flex items-center justify-between gap-2">
                      <span className="truncate">
                        {selectedPoolNames.length ? selectedPoolNames.join(', ') : 'No pooled coworkers'}
                      </span>
                      <span className="text-app-text-secondary group-open:rotate-180 transition-transform">v</span>
                    </summary>
                    <div className="max-h-36 overflow-y-auto border-t border-app-border px-2 py-2 space-y-2">
                      {paySheetEmployees
                        .filter((item) => item.id !== employee.employeeId)
                        .map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 text-xs font-bold text-app-text-secondary cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPoolIds.includes(item.id)}
                              onChange={(event) => updatePoolSelection(employee.employeeId, item.id, event.target.checked)}
                              disabled={!canEditOrDelete}
                              className="h-4 w-4 accent-app-accent cursor-pointer"
                            />
                            <span className="truncate">{item.name}</span>
                          </label>
                        ))}
                      {paySheetEmployees.length <= 1 && (
                        <p className="text-xs text-app-text-secondary">Add another employee to create a pool.</p>
                      )}
                    </div>
                  </details>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-app-text-secondary mb-1">Payable Birds</label>
                  <div className="h-10 flex items-center px-2 border border-app-border rounded-lg bg-app-bg text-app-text font-black font-jetbrains">
                    {formatBirds(employee.payableBirds)}
                  </div>
                  {employee.mortality > 0 && (
                    <p className="text-[10px] font-bold text-app-danger mt-1 font-jetbrains">
                      Less mortality: {formatBirds(employee.mortality)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="bg-app-bg p-2 rounded-lg border border-app-border/30">
                  <p className="text-app-text-secondary font-bold uppercase">Net Birds</p>
                  <p className="font-black text-app-text mt-1 font-jetbrains">
                    {formatBirds(employee.netHandledBirds)}
                  </p>
                </div>
                <div className="bg-app-bg p-2 rounded-lg border border-app-border/30">
                  <p className="text-app-text-secondary font-bold uppercase">Pool Birds</p>
                  <p className="font-black text-app-text mt-1 font-jetbrains">
                    {formatBirds(employee.poolBirds)}
                    {employee.memberCount > 1 ? ` / ${employee.memberCount}` : ''}
                  </p>
                </div>
                <div className="bg-app-bg p-2 rounded-lg border border-app-border/30">
                  <p className="text-app-text-secondary font-bold uppercase">Cycle Income</p>
                  <p className="font-black text-app-text mt-1 font-jetbrains">{formatMoney(employee.cycleIncome)}</p>
                </div>
                <div className="bg-app-bg p-2 rounded-lg border border-app-border/30">
                  <p className="text-app-text-secondary font-bold uppercase">Labor Paid</p>
                  <p className="font-black text-app-text mt-1 font-jetbrains">{formatMoney(employee.laborPaid)}</p>
                </div>
                <div className="bg-app-bg p-2 rounded-lg col-span-2 border border-app-border/30">
                  <p className="text-app-text-secondary font-bold uppercase">Net Payable</p>
                  <p className={`font-black mt-1 font-jetbrains ${employee.netPayable > 0 ? 'text-app-warning' : 'text-app-success'}`}>
                    {formatMoney(employee.netPayable)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-3 no-print">
                <input
                  type="text"
                  value={draft.remarks}
                  onChange={(event) => updateCompDraft(employee.employeeId, 'remarks', event.target.value)}
                  disabled={!canEditOrDelete}
                  className="flex-1 p-2 border border-app-border rounded-lg bg-app-bg text-app-text outline-none text-sm font-semibold focus:ring-2 focus:ring-app-accent transition-all"
                  placeholder="Remarks"
                />
                {canEditOrDelete && (
                  <button
                    type="button"
                    onClick={handleCompSave}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-app-accent text-app-on-accent hover:scale-105 active:scale-95 shadow-sm transition-all cursor-pointer"
                  >
                    Save Pay
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
                <p className="text-app-text-secondary font-semibold">Advance: <span className="font-black text-app-text font-jetbrains">{formatMoney(employee.cashAdvance)}</span></p>
                <p className="text-app-text-secondary font-semibold">Repaid: <span className="font-black text-app-text font-jetbrains">{formatMoney(employee.reimbursement)}</span></p>
                <p className={employee.outstandingAdvance > 0 ? 'text-app-danger' : 'text-app-success'}>
                  Balance: <span className="font-black font-jetbrains">{formatMoney(employee.outstandingAdvance)}</span>
                </p>
              </div>
            </div>
          );
        })}

        {compensationRows.length === 0 && !isLoading && (
          <p className="text-center text-app-text-secondary text-sm mt-4 font-semibold">
            No employees added yet.
          </p>
        )}
      </div>
    </div>
  );
}
