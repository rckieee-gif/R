
import { useState } from 'react';

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
  activeBatch,
  transactions = []
}) {
  const [expandedIds, setExpandedIds] = useState({});

  const toggleExpand = (employeeId) => {
    setExpandedIds((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId]
    }));
  };

  const isAllExpanded = compensationRows.length > 0 && compensationRows.every(row => expandedIds[row.employeeId]);

  const toggleAll = () => {
    if (isAllExpanded) {
      setExpandedIds({});
    } else {
      const next = {};
      compensationRows.forEach(row => {
        next[row.employeeId] = true;
      });
      setExpandedIds(next);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3 ml-1 no-print">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider font-hanken">
            Batch Pay Sheet
          </h3>
          {compensationRows.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-[10px] font-bold text-app-accent hover:underline cursor-pointer transition-colors"
            >
              {isAllExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          )}
        </div>
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

          const isExpanded = expandedIds[employee.employeeId];
          const names = new Set([employee.name, employee.displayName, employee.employeeName].filter(Boolean));
          const employeeTransactions = transactions.filter((tx) => {
            const isAdvance = tx.fundingNature === 'Receivable' && tx.category === 'Cash Advance' && names.has(tx.paidTo);
            const isRepayment = tx.fundingNature === 'Receivable' && (tx.type === 'Reimbursement' || tx.category === 'Reimbursement') && names.has(tx.paidBy);
            return isAdvance || isRepayment;
          });

          return (
            <div
              key={employee.employeeId}
              className="bg-app-card rounded-xl shadow-sm border border-app-border overflow-hidden transition-all duration-200"
            >
              {/* Clickable Header */}
              <div
                onClick={() => toggleExpand(employee.employeeId)}
                className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-app-bg/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-black text-app-text font-hanken tracking-tight">
                      {employee.employeeName}
                    </p>
                    {employee.outstandingAdvance > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-app-danger-bg text-app-danger font-jetbrains whitespace-nowrap">
                        Advance: {formatMoney(employee.outstandingAdvance)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-app-text-secondary font-bold uppercase mt-1">
                    {employee.position || 'Employee'} {employee.assignedBuilding ? `- Bldg ${employee.assignedBuilding}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-app-text-secondary">Net Payable</p>
                    <p className={`text-base font-black font-jetbrains ${employee.netPayable > 0 ? 'text-app-warning' : 'text-app-success'}`}>
                      {formatMoney(employee.netPayable)}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-app-text-secondary select-none no-print">
                    {isExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </div>

              {/* Collapsible Details Panel */}
              <div
                className={`p-4 pt-0 border-t border-app-border/40 ${
                  isExpanded ? 'block' : 'hidden print:block'
                }`}
              >
                {/* Admin Actions */}
                {canEditOrDelete && (
                  <div className="flex justify-end gap-2 mt-4 no-print border-b border-app-border/30 pb-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(employee);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-app-accent text-app-on-accent hover:scale-105 active:scale-95 shadow-sm transition-all cursor-pointer"
                    >
                      Edit Details
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive({ ...employee, id: employee.employeeId, name: employee.employeeName });
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-app-danger-bg text-app-danger border border-app-danger hover:bg-opacity-90 transition-all cursor-pointer"
                    >
                      Archive Employee
                    </button>
                  </div>
                )}

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

                {/* Detailed Cash Advance & Repayment History */}
                <div className="border-t border-app-border/40 mt-4 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary mb-2">
                    Cash Advance & Repayment Ledger
                  </p>
                  
                  {employeeTransactions.length > 0 ? (
                    <div className="bg-app-bg rounded-lg border border-app-border/30 overflow-hidden mb-3">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-app-border/30 bg-app-card/30 text-[9px] font-black uppercase text-app-text-secondary">
                            <th className="p-2 font-hanken">Date</th>
                            <th className="p-2 font-hanken">Type</th>
                            <th className="p-2 font-hanken">Description</th>
                            <th className="p-2 text-right font-hanken">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border/20">
                          {employeeTransactions.map((tx) => {
                            const isAdvance = tx.fundingNature === 'Receivable' && tx.category === 'Cash Advance' && names.has(tx.paidTo);
                            return (
                              <tr key={tx.id} className="hover:bg-app-card/20 transition-colors">
                                <td className="p-2 font-semibold font-jetbrains whitespace-nowrap text-app-text">
                                  {new Date(tx.date).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </td>
                                <td className="p-2">
                                  <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider ${
                                    isAdvance 
                                      ? 'bg-app-danger-bg text-app-danger' 
                                      : 'bg-app-success-bg text-app-success'
                                  }`}>
                                    {isAdvance ? 'Advance' : 'Repayment'}
                                  </span>
                                </td>
                                <td className="p-2 text-app-text-secondary font-medium max-w-[180px] truncate" title={tx.description || tx.remarks}>
                                  {tx.description || tx.remarks || '--'}
                                </td>
                                <td className={`p-2 text-right font-black font-jetbrains ${
                                  isAdvance ? 'text-app-danger' : 'text-app-success'
                                }`}>
                                  {isAdvance ? '+' : '-'}{formatMoney(tx.amount).replace('PHP ', '')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[11px] text-app-text-secondary italic mb-3">
                      No cash advance or repayment transactions for this batch.
                    </p>
                  )}

                  {/* Totals Summary */}
                  <div className="grid grid-cols-3 gap-2 text-[10px] bg-app-bg/30 p-2 rounded-lg border border-app-border/20">
                    <div>
                      <p className="text-app-text-secondary font-bold uppercase text-[8px] tracking-wider">Total Advance</p>
                      <p className="font-black text-app-text font-jetbrains mt-0.5">{formatMoney(employee.cashAdvance)}</p>
                    </div>
                    <div>
                      <p className="text-app-text-secondary font-bold uppercase text-[8px] tracking-wider">Total Repaid</p>
                      <p className="font-black text-app-text font-jetbrains mt-0.5">{formatMoney(employee.reimbursement)}</p>
                    </div>
                    <div>
                      <p className="text-app-text-secondary font-bold uppercase text-[8px] tracking-wider">Debt Balance</p>
                      <p className={`font-black font-jetbrains mt-0.5 ${employee.outstandingAdvance > 0 ? 'text-app-danger' : 'text-app-success'}`}>
                        {formatMoney(employee.outstandingAdvance)}
                      </p>
                    </div>
                  </div>
                </div>
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
