import { useEffect, useState } from 'react';
import { API_BASE } from './api';

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

export default function EmployeePaySummary({ token, activeBatch }) {
  const [summary, setSummary] = useState({ totals: {}, rows: [] });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token || !activeBatch?.id) {
      setTimeout(() => {
        setSummary({ totals: {}, rows: [] });
      }, 0);
      return;
    }

    const fetchSummary = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch(`${API_BASE}/api/batches/${activeBatch.id}/employee-pay-summary`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to load employee pay summary.');
          return;
        }

        setSummary(data);
      } catch (err) {
        console.error(err);
        setError('Cannot connect to employee pay summary.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [token, activeBatch?.id]);

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

      <div className="space-y-3">
        {summary.rows.map((employee) => (
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
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-app-text-secondary">Net Payable</p>
                <p className={`font-black font-jetbrains ${Number(employee.netPayable || 0) > 0 ? 'text-app-warning' : 'text-app-success'}`}>
                  {formatMoney(employee.netPayable)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-4 text-xs">
              <div className="bg-app-bg border border-app-border/30 p-2 rounded-lg">
                <p className="text-app-text-secondary font-bold uppercase">Handled</p>
                <p className="font-black text-app-text mt-1 font-jetbrains">{formatBirds(employee.grossHandledBirds)}</p>
              </div>
              <div className="bg-app-bg border border-app-border/30 p-2 rounded-lg">
                <p className="text-app-text-secondary font-bold uppercase">Mortality</p>
                <p className="font-black text-app-danger mt-1 font-jetbrains">{formatBirds(employee.mortality)}</p>
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

            <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
              <p className="text-app-text-secondary">Paid: <span className="font-bold font-jetbrains">{formatMoney(employee.laborPaid)}</span></p>
              <p className="text-app-text-secondary">Advance: <span className="font-bold font-jetbrains">{formatMoney(employee.cashAdvance)}</span></p>
              <p className="text-app-text-secondary">Repaid: <span className="font-bold font-jetbrains">{formatMoney(employee.reimbursement)}</span></p>
            </div>
          </div>
        ))}

        {summary.rows.length === 0 && !isLoading && (
          <p className="text-center text-app-text-secondary text-sm mt-4 font-semibold">No employee pay data yet.</p>
        )}
      </div>
    </div>
  );
}
