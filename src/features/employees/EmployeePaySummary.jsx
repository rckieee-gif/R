import { useEffect, useState } from 'react';
import { apiClient } from '../../shared/utils/apiClient';

const EMPTY_SUMMARY = { totals: {}, rows: [] };

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

export default function EmployeePaySummary({ token, activeBatch, transactions = [] }) {
  const activeBatchId = activeBatch?.id ?? null;
  const [summaryRequest, setSummaryRequest] = useState({
    batchId: null,
    data: EMPTY_SUMMARY,
    error: '',
    isLoading: false
  });
  const [expandedIds, setExpandedIds] = useState({});

  const hasActiveSummary = Boolean(token && activeBatchId);
  const isCurrentSummary = hasActiveSummary && summaryRequest.batchId === activeBatchId;
  const summary = isCurrentSummary ? summaryRequest.data : EMPTY_SUMMARY;
  const error = isCurrentSummary ? summaryRequest.error : '';
  const isLoading = hasActiveSummary && summaryRequest.batchId === activeBatchId && summaryRequest.isLoading;

  const toggleExpand = (employeeId) => {
    setExpandedIds((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId]
    }));
  };

  const isAllExpanded = summary.rows.length > 0 && summary.rows.every(row => expandedIds[row.employeeId]);

  const toggleAll = () => {
    if (isAllExpanded) {
      setExpandedIds({});
    } else {
      const next = {};
      summary.rows.forEach(row => {
        next[row.employeeId] = true;
      });
      setExpandedIds(next);
    }
  };

  useEffect(() => {
    if (!token || !activeBatchId) {
      return;
    }

    let isCancelled = false;
    const requestBatchId = activeBatchId;

    const fetchSummary = async () => {
      setSummaryRequest((current) => ({
        batchId: requestBatchId,
        data: current.batchId === requestBatchId ? current.data : EMPTY_SUMMARY,
        error: '',
        isLoading: true
      }));

      try {
        const data = await apiClient.get(`/api/batches/${requestBatchId}/employee-pay-summary`);

        if (isCancelled) return;

        setSummaryRequest({
          batchId: requestBatchId,
          data,
          error: '',
          isLoading: false
        });
      } catch (err) {
        if (isCancelled) return;
        console.error(err);
        setSummaryRequest({
          batchId: requestBatchId,
          data: EMPTY_SUMMARY,
          error: 'Cannot connect to employee pay summary.',
          isLoading: false
        });
      }
    };

    fetchSummary();

    return () => {
      isCancelled = true;
    };
  }, [token, activeBatchId]);

  const totals = summary.totals || {};

  return (
    <div className="app-page">
      <div className="mb-6 mt-2">
        <h2 className="text-3xl font-extrabold text-app-text tracking-tight font-hanken">
          Employee Pay Summary
        </h2>
        <p className="text-app-text-secondary text-sm mt-1">
          Batch {activeBatch?.id || 'not selected'} pay, debts, balances, and mortality deductions.
        </p>
      </div>

      {error && (
        <div className="bg-app-danger-bg text-app-danger p-3 rounded-xl text-sm font-bold mb-4 border border-app-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Cycle Income</p>
          <p className="text-lg font-black mt-1 text-app-text font-jetbrains">{formatMoney(totals.cycleIncome)}</p>
        </div>
        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Mortality Deducted</p>
          <p className="text-lg font-black mt-1 text-app-danger font-jetbrains">{formatBirds(totals.mortality)}</p>
        </div>
        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Advance Balance</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${Number(totals.outstandingAdvance || 0) > 0 ? 'text-app-danger' : 'text-app-success'}`}>
            {formatMoney(totals.outstandingAdvance)}
          </p>
        </div>
        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Net Payable</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${Number(totals.netPayable || 0) > 0 ? 'text-app-warning' : 'text-app-success'}`}>
            {formatMoney(totals.netPayable)}
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-app-text-secondary mb-3 font-semibold">Loading pay summary...</p>
      )}

      <div className="flex items-center justify-between mb-3 ml-1 no-print">
        <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider font-hanken">
          Pay Summary Sheet
        </h3>
        {summary.rows.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-[10px] font-bold text-app-accent hover:underline cursor-pointer transition-colors"
          >
            {isAllExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {summary.rows.map((employee) => {
          const isExpanded = expandedIds[employee.employeeId];
          const names = new Set([employee.employeeName].filter(Boolean));
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
                    {Number(employee.outstandingAdvance || 0) > 0 && (
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
                    <p className={`text-base font-black font-jetbrains ${Number(employee.netPayable || 0) > 0 ? 'text-app-warning' : 'text-app-success'}`}>
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
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-4 text-xs">
                  <div className="bg-app-bg border border-app-border/30 p-2 rounded-lg">
                    <p className="text-app-text-secondary font-bold uppercase">Handled</p>
                    <p className="font-black text-app-text mt-1 font-jetbrains">{formatBirds(employee.grossHandledBirds)}</p>
                  </div>
                  <div className="bg-app-bg border border-app-border/30 p-2 rounded-lg">
                    <p className="text-app-text-secondary font-bold uppercase">Mortality</p>
                    <p className="font-black text-app-danger mt-1 font-jetbrains">{formatBirds(employee.mortality)}</p>
                    {employee.mortalityBuffer > 0 && (
                      <p className="text-[9px] font-bold text-app-success mt-0.5 font-jetbrains">
                        Buffer absorbed {formatBirds(Math.min(employee.mortality, employee.mortalityBuffer))}
                      </p>
                    )}
                  </div>
                  <div className="bg-app-bg border border-app-border/30 p-2 rounded-lg">
                    <p className="text-app-text-secondary font-bold uppercase">Payable Birds</p>
                    <p className="font-black text-app-text mt-1 font-jetbrains">
                      {formatBirds(employee.payableBirds)}
                      {employee.memberCount > 1 ? ` / pool ${employee.memberCount}` : ''}
                    </p>
                  </div>
                  <div className="bg-app-bg border border-app-border/30 p-2 rounded-lg">
                    <p className="text-app-text-secondary font-bold uppercase">Cycle Income</p>
                    <p className="font-black text-app-text mt-1 font-jetbrains">{formatMoney(employee.cycleIncome)}</p>
                  </div>
                  <div className="bg-app-bg border border-app-border/30 p-2 rounded-lg">
                    <p className="text-app-text-secondary font-bold uppercase">Debt Balance</p>
                    <p className={`font-black mt-1 font-jetbrains ${Number(employee.outstandingAdvance || 0) > 0 ? 'text-app-danger' : 'text-app-success'}`}>
                      {formatMoney(employee.outstandingAdvance)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-[10px] bg-app-bg/30 p-2 rounded-lg border border-app-border/20">
                  <p className="text-app-text-secondary">Paid: <span className="font-bold font-jetbrains">{formatMoney(employee.laborPaid)}</span></p>
                  <p className="text-app-text-secondary">Advance: <span className="font-bold font-jetbrains">{formatMoney(employee.cashAdvance)}</span></p>
                  <p className="text-app-text-secondary">Repaid: <span className="font-bold font-jetbrains">{formatMoney(employee.reimbursement)}</span></p>
                </div>

                {/* Detailed Cash Advance & Repayment History */}
                <div className="border-t border-app-border/40 mt-4 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary mb-2">
                    Cash Advance & Repayment Ledger
                  </p>
                  
                  {employeeTransactions.length > 0 ? (
                    <div className="bg-app-bg rounded-lg border border-app-border/30 overflow-hidden mb-1">
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
                    <p className="text-[11px] text-app-text-secondary italic mb-1">
                      No cash advance or repayment transactions for this batch.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {summary.rows.length === 0 && !isLoading && (
          <p className="text-center text-app-text-secondary text-sm mt-4 font-semibold">No employee pay data yet.</p>
        )}
      </div>
    </div>
  );
}
