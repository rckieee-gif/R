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
        <h2 className="text-3xl font-extrabold text-primary tracking-tight">
          Employee Pay Summary
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Batch {activeBatch?.id || 'not selected'} pay, debts, balances, and mortality deductions.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-neutral-border dark:border-gray-700 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cycle Income</p>
          <p className="text-lg font-black mt-1 text-gray-900 dark:text-white">{formatMoney(totals.cycleIncome)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-neutral-border dark:border-gray-700 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Mortality Deducted</p>
          <p className="text-lg font-black mt-1 text-semantic-danger">{formatBirds(totals.mortality)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-neutral-border dark:border-gray-700 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Advance Balance</p>
          <p className={`text-lg font-black mt-1 ${Number(totals.outstandingAdvance || 0) > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
            {formatMoney(totals.outstandingAdvance)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-neutral-border dark:border-gray-700 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Net Payable</p>
          <p className={`text-lg font-black mt-1 ${Number(totals.netPayable || 0) > 0 ? 'text-semantic-warning' : 'text-semantic-success'}`}>
            {formatMoney(totals.netPayable)}
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-500 mb-3">Loading pay summary...</p>
      )}

      <div className="space-y-3">
        {summary.rows.map((employee) => (
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
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-gray-400">Net Payable</p>
                <p className={`font-black ${Number(employee.netPayable || 0) > 0 ? 'text-semantic-warning' : 'text-semantic-success'}`}>
                  {formatMoney(employee.netPayable)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-4 text-xs">
              <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg">
                <p className="text-gray-400 font-bold uppercase">Handled</p>
                <p className="font-black text-gray-800 dark:text-white mt-1">{formatBirds(employee.grossHandledBirds)}</p>
              </div>
              <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg">
                <p className="text-gray-400 font-bold uppercase">Mortality</p>
                <p className="font-black text-semantic-danger mt-1">{formatBirds(employee.mortality)}</p>
              </div>
              <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg">
                <p className="text-gray-400 font-bold uppercase">Payable Birds</p>
                <p className="font-black text-gray-800 dark:text-white mt-1">
                  {formatBirds(employee.payableBirds)}
                  {employee.memberCount > 1 ? ` / pool ${employee.memberCount}` : ''}
                </p>
              </div>
              <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg">
                <p className="text-gray-400 font-bold uppercase">Cycle Income</p>
                <p className="font-black text-gray-800 dark:text-white mt-1">{formatMoney(employee.cycleIncome)}</p>
              </div>
              <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg">
                <p className="text-gray-400 font-bold uppercase">Debt Balance</p>
                <p className={`font-black mt-1 ${Number(employee.outstandingAdvance || 0) > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
                  {formatMoney(employee.outstandingAdvance)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
              <p className="text-gray-500">Paid: <span className="font-bold">{formatMoney(employee.laborPaid)}</span></p>
              <p className="text-gray-500">Advance: <span className="font-bold">{formatMoney(employee.cashAdvance)}</span></p>
              <p className="text-gray-500">Repaid: <span className="font-bold">{formatMoney(employee.reimbursement)}</span></p>
            </div>
          </div>
        ))}

        {summary.rows.length === 0 && !isLoading && (
          <p className="text-center text-gray-500 text-sm mt-4">No employee pay data yet.</p>
        )}
      </div>
    </div>
  );
}
