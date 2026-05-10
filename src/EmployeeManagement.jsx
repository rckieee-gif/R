import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';

const emptyForm = {
  name: '',
  position: '',
  hireDate: '',
  assignedBuilding: '',
  phone: '',
  email: '',
  address: '',
  notes: ''
};

const CORPO_GROUP_PREFIX = 'employees:';

function formatMoney(amount) {
  return `PHP ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function parseCorpoGroupIds(corpoGroup) {
  if (!corpoGroup?.startsWith(CORPO_GROUP_PREFIX)) return [];

  return corpoGroup
    .slice(CORPO_GROUP_PREFIX.length)
    .split(',')
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
}

function buildCorpoGroupValue(employeeIds) {
  const ids = [...new Set(employeeIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))]
    .sort((a, b) => a - b);

  return ids.length > 1 ? `${CORPO_GROUP_PREFIX}${ids.join(',')}` : '';
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

function getConnectedPoolIds(employeeId, employeeIds, compDrafts = {}) {
  const targetId = Number(employeeId);
  const ids = [...new Set([...employeeIds, targetId].map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
  const parent = new Map(ids.map((id) => [id, id]));

  const find = (id) => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (left, right) => {
    if (!parent.has(left) || !parent.has(right)) return;
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  ids.forEach((id) => {
    getDraftPoolIds(compDrafts[id]).forEach((otherId) => union(id, otherId));
  });

  const root = find(targetId);
  return ids.filter((id) => find(id) === root);
}

function formatBirds(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

function getEmployeeSummary(employee, transactions) {
  const names = new Set([employee.name, employee.displayName, employee.employeeName].filter(Boolean));

  return transactions.reduce((summary, tx) => {
    const amount = Number(tx.amount || 0);

    if (tx.fundingNature === 'Receivable' && tx.category === 'Cash Advance' && names.has(tx.paidTo)) {
      summary.cashAdvance += amount;
    }

    if (
      tx.fundingNature === 'Receivable' &&
      (tx.type === 'Reimbursement' || tx.category === 'Reimbursement') &&
      names.has(tx.paidBy)
    ) {
      summary.reimbursement += amount;
    }

    if (tx.fundingNature === 'OPEX' && tx.category === 'Labor' && names.has(tx.paidTo)) {
      summary.laborPaid += amount;
    }

    return summary;
  }, {
    cashAdvance: 0,
    reimbursement: 0,
    laborPaid: 0
  });
}

function getCompensationRows(compensations, employees, transactions, compDrafts = {}) {
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  const parent = new Map();
  const effectiveRows = compensations.map((compensation) => {
    const draft = compDrafts[compensation.employeeId] || {};
    const hasPoolDraft = Object.prototype.hasOwnProperty.call(draft, 'poolEmployeeIds');
    const handledBirds = draft.handledBirds === '' || draft.handledBirds === undefined
      ? 0
      : Number(draft.handledBirds || 0);
    const ratePerBird = draft.ratePerBird === '' || draft.ratePerBird === undefined
      ? 1.5
      : Number(draft.ratePerBird || 1.5);
    const draftPoolIds = getDraftPoolIds(draft);

    parent.set(compensation.employeeId, compensation.employeeId);

    return {
      ...compensation,
      handledBirds,
      ratePerBird,
      corpoGroup: hasPoolDraft
        ? buildCorpoGroupValue([compensation.employeeId, ...draftPoolIds])
        : compensation.corpoGroup,
      remarks: draft.remarks ?? compensation.remarks ?? ''
    };
  });

  const find = (id) => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (left, right) => {
    if (!parent.has(left) || !parent.has(right)) return;
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  effectiveRows.forEach((row) => {
    getDraftPoolIds(compDrafts[row.employeeId]).forEach((otherId) => union(row.employeeId, otherId));
    parseCorpoGroupIds(row.corpoGroup).forEach((otherId) => union(row.employeeId, otherId));
  });

  const groups = new Map();

  effectiveRows.forEach((compensation) => {
    const key = find(compensation.employeeId);

    const group = groups.get(key) || {
      handledBirds: 0,
      members: []
    };

    group.handledBirds += Number(compensation.handledBirds || 0);
    group.members.push(compensation.employeeId);
    groups.set(key, group);
  });

  return effectiveRows.map((compensation) => {
    const employee = employeeMap.get(compensation.employeeId) || {};
    const summary = getEmployeeSummary({ ...employee, ...compensation }, transactions);
    const group = groups.get(find(compensation.employeeId));
    const handledBirds = Number(compensation.handledBirds || 0);
    const ratePerBird = Number(compensation.ratePerBird || 1.5);
    const memberCount = group?.members.length || 1;
    const poolBirds = memberCount > 1 ? group.handledBirds : handledBirds;
    const payableBirds = memberCount > 1 ? poolBirds / memberCount : handledBirds;
    const cycleIncome = payableBirds * ratePerBird;

    return {
      ...employee,
      ...compensation,
      ...summary,
      outstandingAdvance: summary.cashAdvance - summary.reimbursement,
      poolBirds,
      payableBirds,
      memberCount,
      cycleIncome,
      remainingCyclePay: cycleIncome - summary.laborPaid
    };
  });
}

export default function EmployeeManagement({ token, transactions = [], activeBatch, canEditOrDelete = false }) {
  const [employees, setEmployees] = useState([]);
  const [compensations, setCompensations] = useState([]);
  const [compDrafts, setCompDrafts] = useState({});
  const [buildings, setBuildings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const employeeIds = useMemo(() => employees.map((employee) => employee.id), [employees]);

  const compensationRows = useMemo(
    () => getCompensationRows(compensations, employees, transactions, compDrafts),
    [compensations, employees, transactions, compDrafts]
  );

  const totals = useMemo(
    () => compensationRows.reduce((sum, employee) => ({
      cycleIncome: sum.cycleIncome + employee.cycleIncome,
      laborPaid: sum.laborPaid + employee.laborPaid,
      remainingCyclePay: sum.remainingCyclePay + employee.remainingCyclePay,
      outstandingAdvance: sum.outstandingAdvance + employee.outstandingAdvance
    }), {
      cycleIncome: 0,
      laborPaid: 0,
      remainingCyclePay: 0,
      outstandingAdvance: 0
    }),
    [compensationRows]
  );

  const fetchEmployees = async () => {
    if (!token) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load employees.');
        return;
      }

      setEmployees(data);
    } catch (err) {
      console.error(err);
      setError('Cannot connect to the employee sheet.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompensations = async () => {
    if (!token || !activeBatch?.id) {
      setCompensations([]);
      setCompDrafts({});
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/batches/${activeBatch.id}/employee-compensations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load employee batch pay.');
        return;
      }

      setCompensations(data);
      setCompDrafts(data.reduce((drafts, row) => ({
        ...drafts,
        [row.employeeId]: buildCompDraft({
          handledBirds: String(row.handledBirds || ''),
          ratePerBird: String(row.ratePerBird || 1.5),
          poolEmployeeIds: parseCorpoGroupIds(row.corpoGroup)
            .filter((id) => id !== row.employeeId)
            .map(String),
          remarks: row.remarks || ''
        })
      }), {}));
    } catch (err) {
      console.error(err);
      setError('Cannot connect to the batch pay sheet.');
    }
  };

  const fetchBuildings = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/buildings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (response.ok) setBuildings(data);
    } catch (err) {
      console.error('Failed to load employee building options:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchBuildings();
  }, [token]);

  useEffect(() => {
    fetchCompensations();
  }, [token, activeBatch?.id]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateCompDraft = (employeeId, field, value) => {
    setCompDrafts((current) => ({
      ...current,
      [employeeId]: {
        ...buildCompDraft(current[employeeId]),
        [field]: value
      }
    }));
  };

  const updatePoolSelection = (employeeId, otherEmployeeId, isSelected) => {
    setCompDrafts((current) => {
      const next = { ...current };
      const currentGroup = getConnectedPoolIds(employeeId, employeeIds, current);
      const otherGroup = getConnectedPoolIds(otherEmployeeId, employeeIds, current);

      const applyPool = (groupIds) => {
        const normalizedIds = [...new Set(groupIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];

        normalizedIds.forEach((id) => {
          next[id] = buildCompDraft({
            ...(next[id] || {}),
            poolEmployeeIds: normalizedIds
              .filter((otherId) => otherId !== id)
              .map(String)
          });
        });
      };

      if (isSelected) {
        applyPool([...currentGroup, ...otherGroup, Number(employeeId), Number(otherEmployeeId)]);
        return next;
      }

      const remainingGroup = currentGroup.filter((id) => id !== Number(otherEmployeeId));
      applyPool(remainingGroup);
      next[otherEmployeeId] = buildCompDraft({
        ...(next[otherEmployeeId] || {}),
        poolEmployeeIds: []
      });

      return next;
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (editingId && !canEditOrDelete) {
      setError('Only admin.roland can edit employee records.');
      return;
    }

    if (!form.name.trim()) {
      setError('Employee name is required.');
      return;
    }

    try {
      const response = await fetch(
        editingId ? `${API_BASE}/api/employees/${editingId}` : `${API_BASE}/api/employees`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(form)
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save employee.');
        return;
      }

      if (editingId) {
        setEmployees((current) => current.map((employee) => employee.id === editingId ? data : employee));
      } else {
        setEmployees((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
        setCompensations((current) => activeBatch?.id ? [
          ...current,
          {
            employeeId: data.id,
            employeeName: data.name,
            position: data.position,
            assignedBuilding: data.assignedBuilding,
            batchId: activeBatch.id,
            handledBirds: 0,
            ratePerBird: 1.5,
            corpoGroup: '',
            remarks: ''
          }
        ] : current);
        setCompDrafts((current) => ({
          ...current,
          [data.id]: buildCompDraft()
        }));
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setError('Cannot connect to the employee sheet.');
    }
  };

  const handleCompSave = async () => {
    if (!canEditOrDelete) {
      setError('Only admin.roland can edit employee batch pay.');
      return;
    }

    if (!activeBatch?.id) {
      setError('Select an active batch before saving employee batch pay.');
      return;
    }

    const employeeIdsToSave = employees.map((employee) => employee.id);
    const savedRows = [];

    try {
      for (const id of employeeIdsToSave) {
        const draft = buildCompDraft(compDrafts[id]);
        const poolIds = getConnectedPoolIds(id, employeeIdsToSave, compDrafts);
        const response = await fetch(`${API_BASE}/api/batches/${activeBatch.id}/employee-compensations/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            handledBirds: draft.handledBirds,
            ratePerBird: draft.ratePerBird,
            corpoGroup: buildCorpoGroupValue(poolIds),
            remarks: draft.remarks
          })
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to save employee batch pay.');
          return;
        }

        savedRows.push(data);
      }

      const savedByEmployeeId = new Map(savedRows.map((row) => [row.employeeId, row]));

      setCompensations((current) => current.map((row) => savedByEmployeeId.get(row.employeeId) || row));
      setCompDrafts((current) => {
        const next = { ...current };

        savedRows.forEach((row) => {
          next[row.employeeId] = buildCompDraft({
            handledBirds: String(row.handledBirds || ''),
            ratePerBird: String(row.ratePerBird || 1.5),
            poolEmployeeIds: parseCorpoGroupIds(row.corpoGroup)
              .filter((id) => id !== row.employeeId)
              .map(String),
            remarks: row.remarks || ''
          });
        });

        return next;
      });
    } catch (err) {
      console.error(err);
      setError('Cannot connect to the batch pay sheet.');
    }
  };

  const handleEdit = (employee) => {
    if (!canEditOrDelete) return;

    setEditingId(employee.id);
    setForm({
      name: employee.name || '',
      position: employee.position || '',
      hireDate: employee.hireDate || '',
      assignedBuilding: employee.assignedBuilding || '',
      phone: employee.phone || '',
      email: employee.email || '',
      address: employee.address || '',
      notes: employee.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleArchive = async (employee) => {
    if (!canEditOrDelete) return;

    const confirmed = window.confirm(`Archive ${employee.name}? Ledger history will remain intact.`);
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/api/employees/${employee.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to archive employee.');
        return;
      }

      setEmployees((current) => current.filter((item) => item.id !== employee.id));
      setCompensations((current) => current.filter((item) => item.employeeId !== employee.id));
      if (editingId === employee.id) resetForm();
    } catch (err) {
      console.error(err);
      setError('Cannot connect to the employee sheet.');
    }
  };

  return (
    <div className="app-page">
      <div className="mb-6 mt-2">
        <h2 className="text-3xl font-extrabold text-primary tracking-tight">
          Employees
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Employee master sheet and batch pay.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-neutral-border dark:border-gray-700 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cycle Income</p>
          <p className="text-lg font-black mt-1 text-gray-900 dark:text-white">
            {formatMoney(totals.cycleIncome)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-neutral-border dark:border-gray-700 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Remaining Pay</p>
          <p className={`text-lg font-black mt-1 ${totals.remainingCyclePay > 0 ? 'text-semantic-warning' : 'text-semantic-success'}`}>
            {formatMoney(totals.remainingCyclePay)}
          </p>
        </div>
      </div>

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
                className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
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
                className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
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

      <div>
        <div className="flex items-center justify-between mb-3 ml-1">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Batch Pay Sheet
          </h3>
          <span className="text-[10px] text-gray-400">
            {activeBatch?.id ? `Batch ${activeBatch.id}` : 'No active batch'}
          </span>
        </div>

        {isLoading && (
          <p className="text-sm text-gray-500 mb-3">Loading employees...</p>
        )}

        <div className="space-y-3">
          {compensationRows.map((employee) => {
            const draft = buildCompDraft(compDrafts[employee.employeeId]);
            const selectedPoolIds = getDraftPoolIds(draft);
            const selectedPoolNames = employees
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
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-secondary text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive({ ...employee, id: employee.employeeId, name: employee.employeeName })}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-red-100 text-red-600 border border-red-200"
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
                      className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
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
                      className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
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
                        {employees
                          .filter((item) => item.id !== employee.employeeId)
                          .map((item) => (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-200"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPoolIds.includes(item.id)}
                                onChange={(event) => updatePoolSelection(employee.employeeId, item.id, event.target.checked)}
                                disabled={!canEditOrDelete}
                                className="h-4 w-4 accent-primary"
                              />
                              <span className="truncate">{item.name}</span>
                            </label>
                          ))}
                        {employees.length <= 1 && (
                          <p className="text-xs text-gray-400">Add another employee to create a pool.</p>
                        )}
                      </div>
                    </details>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1">Payable Birds</label>
                    <div className="h-10 flex items-center px-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-white font-bold">
                      {formatBirds(employee.payableBirds)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
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
                    <p className="text-gray-400 font-bold uppercase">Balances</p>
                    <p className="font-black text-gray-800 dark:text-white mt-1">{formatMoney(employee.laborPaid)}</p>
                  </div>
                  <div className="bg-neutral-light dark:bg-gray-700 p-2 rounded-lg">
                    <p className="text-gray-400 font-bold uppercase">Remaining</p>
                    <p className={`font-black mt-1 ${employee.remainingCyclePay > 0 ? 'text-semantic-warning' : 'text-semantic-success'}`}>
                      {formatMoney(employee.remainingCyclePay)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={draft.remarks}
                    onChange={(event) => updateCompDraft(employee.employeeId, 'remarks', event.target.value)}
                    disabled={!canEditOrDelete}
                    className="flex-1 p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none text-sm"
                    placeholder="Remarks"
                  />
                  {canEditOrDelete && (
                    <button
                      type="button"
                      onClick={handleCompSave}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white"
                    >
                      Save Pay
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
                  <p className="text-gray-500">Advance: <span className="font-bold">{formatMoney(employee.cashAdvance)}</span></p>
                  <p className="text-gray-500">Repaid: <span className="font-bold">{formatMoney(employee.reimbursement)}</span></p>
                  <p className={employee.outstandingAdvance > 0 ? 'text-semantic-danger' : 'text-semantic-success'}>
                    Balance: <span className="font-bold">{formatMoney(employee.outstandingAdvance)}</span>
                  </p>
                </div>
              </div>
            );
          })}

          {compensationRows.length === 0 && !isLoading && (
            <p className="text-center text-gray-500 text-sm mt-4">
              No employees added yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
