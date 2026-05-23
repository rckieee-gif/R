
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
      <div className="flex items-center justify-between mb-3 ml-1">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Batch Pay Sheet
        </h3>
        <span className="text-[10px] text-gray-400 font-bold">
          {activeBatch?.id ? `Batch ${activeBatch.id}` : 'No active batch'}
        </span>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500 mb-3 font-semibold">Loading employees...</p>
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
              className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-neutral-border dark:border-gray-700"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-gray-900 dark:text-white">{employee.employeeName}</p>
                  <p className="text-xs text-gray-400 font-bold uppercase mt-1">
                    {employee.position || 'Employee'} {employee.assignedBuilding ? `- Bldg ${employee.assignedBuilding}` : ''}
                  </p>
                </div>

                {canEditOrDelete && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(employee)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-secondary text-white hover:bg-opacity-95 shadow-sm transition-all"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive({ ...employee, id: employee.employeeId, name: employee.employeeName })}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-red-100 text-red-600 border border-red-200 hover:bg-red-200 transition-colors"
                    >
                      Archive
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">Handled Birds</label>
                  <input
                    type="number"
                    min="0"
                    value={draft.handledBirds}
                    onChange={(event) => updateCompDraft(employee.employeeId, 'handledBirds', event.target.value)}
                    disabled={!canEditOrDelete}
                    className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none font-bold"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">Rate / Bird</label>
                  <input
                    type="number"
                    min="1.5"
                    max="3"
                    step="0.01"
                    value={draft.ratePerBird}
                    onChange={(event) => updateCompDraft(employee.employeeId, 'ratePerBird', event.target.value)}
                    disabled={!canEditOrDelete}
                    className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none font-bold"
                    placeholder="1.50"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-gray-400 mb-1">
                    Corpo With
                    <span className="relative inline-flex group">
                      <button
                        type="button"
                        className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-500 text-[10px] leading-none font-black text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
                        aria-label="Corpo pool instructions"
                      >
                        i
                      </button>
                      <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-[11px] font-medium normal-case leading-snug text-white shadow-lg group-hover:block group-focus-within:block">
                        Select coworkers to pool handled birds. The app adds everyone's handled birds, splits the total equally across the pool members, then applies each employee's rate per bird.
                      </span>
                    </span>
                  </label>
                  <details className="group rounded-lg border border-neutral-border dark:border-gray-600 bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white">
                    <summary className="min-h-10 cursor-pointer list-none px-2 py-2 text-sm font-bold outline-none flex items-center justify-between gap-2">
                      <span className="truncate">
                        {selectedPoolNames.length ? selectedPoolNames.join(', ') : 'No pooled coworkers'}
                      </span>
                      <span className="text-gray-400 group-open:rotate-180 transition-transform">v</span>
                    </summary>
                    <div className="max-h-36 overflow-y-auto border-t border-neutral-border dark:border-gray-600 px-2 py-2 space-y-2">
                      {paySheetEmployees
                        .filter((item) => item.id !== employee.employeeId)
                        .map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-200 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPoolIds.includes(item.id)}
                              onChange={(event) => updatePoolSelection(employee.employeeId, item.id, event.target.checked)}
                              disabled={!canEditOrDelete}
                              className="h-4 w-4 accent-primary cursor-pointer"
                            />
                            <span className="truncate">{item.name}</span>
                          </label>
                        ))}
                      {paySheetEmployees.length <= 1 && (
                        <p className="text-xs text-gray-400">Add another employee to create a pool.</p>
                      )}
                    </div>
                  </details>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 mb-1">Payable Birds</label>
                  <div className="h-10 flex items-center px-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white font-black">
                    {formatBirds(employee.payableBirds)}
                  </div>
                  {employee.mortality > 0 && (
                    <p className="text-[10px] font-bold text-semantic-danger mt-1">
                      Less mortality: {formatBirds(employee.mortality)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg">
                  <p className="text-gray-400 font-bold uppercase">Net Birds</p>
                  <p className="font-black text-gray-800 dark:text-white mt-1">
                    {formatBirds(employee.netHandledBirds)}
                  </p>
                </div>
                <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg">
                  <p className="text-gray-400 font-bold uppercase">Pool Birds</p>
                  <p className="font-black text-gray-800 dark:text-white mt-1">
                    {formatBirds(employee.poolBirds)}
                    {employee.memberCount > 1 ? ` / ${employee.memberCount}` : ''}
                  </p>
                </div>
                <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg">
                  <p className="text-gray-400 font-bold uppercase">Cycle Income</p>
                  <p className="font-black text-gray-800 dark:text-white mt-1">{formatMoney(employee.cycleIncome)}</p>
                </div>
                <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg">
                  <p className="text-gray-400 font-bold uppercase">Labor Paid</p>
                  <p className="font-black text-gray-800 dark:text-white mt-1">{formatMoney(employee.laborPaid)}</p>
                </div>
                <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg col-span-2">
                  <p className="text-gray-400 font-bold uppercase">Net Payable</p>
                  <p className={`font-black mt-1 ${employee.netPayable > 0 ? 'text-semantic-warning' : 'text-semantic-success'}`}>
                    {formatMoney(employee.netPayable)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={draft.remarks}
                  onChange={(event) => updateCompDraft(employee.employeeId, 'remarks', event.target.value)}
                  disabled={!canEditOrDelete}
                  className="flex-1 p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none text-sm font-semibold"
                  placeholder="Remarks"
                />
                {canEditOrDelete && (
                  <button
                    type="button"
                    onClick={handleCompSave}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-opacity-95 shadow-sm transition-all"
                  >
                    Save Pay
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
                <p className="text-gray-500 font-semibold">Advance: <span className="font-black text-gray-700 dark:text-gray-300">{formatMoney(employee.cashAdvance)}</span></p>
                <p className="text-gray-500 font-semibold">Repaid: <span className="font-black text-gray-700 dark:text-gray-300">{formatMoney(employee.reimbursement)}</span></p>
                <p className={employee.outstandingAdvance > 0 ? 'text-semantic-danger' : 'text-semantic-success'}>
                  Balance: <span className="font-black">{formatMoney(employee.outstandingAdvance)}</span>
                </p>
              </div>
            </div>
          );
        })}

        {compensationRows.length === 0 && !isLoading && (
          <p className="text-center text-gray-500 text-sm mt-4 font-semibold">
            No employees added yet.
          </p>
        )}
      </div>
    </div>
  );
}
