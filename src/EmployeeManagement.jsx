import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';
import EmployeeList from './Components/Employee/EmployeeList';
import CompensationForm from './Components/Employee/CompensationForm';
import { useStore, useVisibleActiveBatch, useVisibleLogs, useVisibleTransactions, usePermissions } from './useStore';

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
const EMPTY_COMPENSATION_STATE = { batchId: null, rows: [], drafts: {} };

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

function isPaySheetEmployee(employee) {
  const normalizedName = String(employee?.displayName || employee?.name || employee?.employeeName || '')
    .trim()
    .toLowerCase();

  return Boolean(normalizedName) && !['others', 'viewer', 'viewers'].includes(normalizedName);
}

function getEmployeeMortality(employeeId, dailyLogs = []) {
  return dailyLogs.reduce((sum, log) => (
    Number(log.employeeId) === Number(employeeId)
      ? sum + Number(log.mortality || 0)
      : sum
  ), 0);
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

function getCompensationRows(compensations, employees, transactions, compDrafts = {}, dailyLogs = []) {
  const employeeMap = new Map(employees.filter(isPaySheetEmployee).map((employee) => [employee.id, employee]));
  const parent = new Map();
  const effectiveRows = compensations.filter((compensation) => employeeMap.has(compensation.employeeId)).map((compensation) => {
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

    group.handledBirds += Math.max(Number(compensation.handledBirds || 0) - getEmployeeMortality(compensation.employeeId, dailyLogs), 0);
    group.members.push(compensation.employeeId);
    groups.set(key, group);
  });

  return effectiveRows.map((compensation) => {
    const employee = employeeMap.get(compensation.employeeId) || {};
    const summary = getEmployeeSummary({ ...employee, ...compensation }, transactions);
    const group = groups.get(find(compensation.employeeId));
    const handledBirds = Number(compensation.handledBirds || 0);
    const mortality = getEmployeeMortality(compensation.employeeId, dailyLogs);
    const netHandledBirds = Math.max(handledBirds - mortality, 0);
    const ratePerBird = Number(compensation.ratePerBird || 1.5);
    const memberCount = group?.members.length || 1;
    const poolBirds = memberCount > 1 ? group.handledBirds : netHandledBirds;
    const payableBirds = memberCount > 1 ? poolBirds / memberCount : netHandledBirds;
    const cycleIncome = payableBirds * ratePerBird;
    const outstandingAdvance = summary.cashAdvance - summary.reimbursement;
    const remainingCyclePay = cycleIncome - summary.laborPaid;
    const netPayable = remainingCyclePay - outstandingAdvance;

    return {
      ...employee,
      ...compensation,
      ...summary,
      grossHandledBirds: handledBirds,
      mortality,
      netHandledBirds,
      outstandingAdvance,
      poolBirds,
      payableBirds,
      memberCount,
      cycleIncome,
      remainingCyclePay,
      netPayable
    };
  });
}

export default function EmployeeManagement() {
  const token = useStore((state) => state.token);
  const activeBatch = useVisibleActiveBatch();
  const transactions = useVisibleTransactions();
  const dailyLogs = useVisibleLogs();
  const { canEditOrDelete } = usePermissions();
  const [employees, setEmployees] = useState([]);
  const [compensationState, setCompensationState] = useState(EMPTY_COMPENSATION_STATE);
  const [buildings, setBuildings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const activeBatchId = activeBatch?.id ?? null;
  const hasActiveCompensations = Boolean(token && activeBatchId);
  const currentCompensationState = hasActiveCompensations && compensationState.batchId === activeBatchId
    ? compensationState
    : EMPTY_COMPENSATION_STATE;
  const compensations = currentCompensationState.rows;
  const compDrafts = currentCompensationState.drafts;
  const paySheetEmployees = useMemo(() => employees.filter(isPaySheetEmployee), [employees]);
  const employeeIds = useMemo(() => paySheetEmployees.map((employee) => employee.id), [paySheetEmployees]);

  const compensationRows = useMemo(
    () => getCompensationRows(compensations, paySheetEmployees, transactions, compDrafts, dailyLogs),
    [compensations, paySheetEmployees, transactions, compDrafts, dailyLogs]
  );

  const totals = useMemo(
    () => compensationRows.reduce((sum, employee) => ({
      cycleIncome: sum.cycleIncome + employee.cycleIncome,
      laborPaid: sum.laborPaid + employee.laborPaid,
      mortality: sum.mortality + employee.mortality,
      remainingCyclePay: sum.remainingCyclePay + employee.remainingCyclePay,
      outstandingAdvance: sum.outstandingAdvance + employee.outstandingAdvance,
      netPayable: sum.netPayable + employee.netPayable
    }), {
      cycleIncome: 0,
      laborPaid: 0,
      mortality: 0,
      remainingCyclePay: 0,
      outstandingAdvance: 0,
      netPayable: 0
    }),
    [compensationRows]
  );

  const updateActiveCompensationState = (updater) => {
    if (!activeBatchId) return;

    setCompensationState((current) => {
      const base = current.batchId === activeBatchId
        ? current
        : { batchId: activeBatchId, rows: [], drafts: {} };
      const next = updater(base);

      return {
        batchId: activeBatchId,
        rows: next.rows ?? base.rows,
        drafts: next.drafts ?? base.drafts
      };
    });
  };

  useEffect(() => {
    if (!token) return undefined;

    let isCancelled = false;

    const fetchEmployeeSheet = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [employeeResponse, buildingResponse] = await Promise.all([
          fetch(`${API_BASE}/api/employees`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_BASE}/api/buildings`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const employeeData = await employeeResponse.json();

        if (isCancelled) return;

        if (!employeeResponse.ok) {
          setError(employeeData.error || 'Failed to load employees.');
          return;
        }

        setEmployees(employeeData.filter(isPaySheetEmployee));

        if (buildingResponse.ok) {
          const buildingData = await buildingResponse.json();
          if (!isCancelled) setBuildings(buildingData);
        }
      } catch (err) {
        if (isCancelled) return;
        console.error(err);
        setError('Cannot connect to the employee sheet.');
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchEmployeeSheet();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !activeBatchId) return undefined;

    let isCancelled = false;
    const requestBatchId = activeBatchId;

    const fetchCompensations = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/batches/${requestBatchId}/employee-compensations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();

        if (isCancelled) return;

        if (!response.ok) {
          setError(data.error || 'Failed to load employee batch pay.');
          return;
        }

        setCompensationState({
          batchId: requestBatchId,
          rows: data,
          drafts: data.reduce((drafts, row) => ({
            ...drafts,
            [row.employeeId]: buildCompDraft({
              handledBirds: String(row.handledBirds || ''),
              ratePerBird: String(row.ratePerBird || 1.5),
              poolEmployeeIds: parseCorpoGroupIds(row.corpoGroup)
                .filter((id) => id !== row.employeeId)
                .map(String),
              remarks: row.remarks || ''
            })
          }), {})
        });
      } catch (err) {
        if (isCancelled) return;
        console.error(err);
        setError('Cannot connect to the batch pay sheet.');
      }
    };

    fetchCompensations();

    return () => {
      isCancelled = true;
    };
  }, [token, activeBatchId]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateCompDraft = (employeeId, field, value) => {
    updateActiveCompensationState(({ drafts }) => ({
      drafts: {
        ...drafts,
        [employeeId]: {
          ...buildCompDraft(drafts[employeeId]),
          [field]: value
        }
      }
    }));
  };

  const updatePoolSelection = (employeeId, otherEmployeeId, isSelected) => {
    updateActiveCompensationState(({ drafts }) => {
      const next = { ...drafts };
      const currentGroup = getConnectedPoolIds(employeeId, employeeIds, drafts);
      const otherGroup = getConnectedPoolIds(otherEmployeeId, employeeIds, drafts);

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
        return { drafts: next };
      }

      const remainingGroup = currentGroup.filter((id) => id !== Number(otherEmployeeId));
      applyPool(remainingGroup);
      next[otherEmployeeId] = buildCompDraft({
        ...(next[otherEmployeeId] || {}),
        poolEmployeeIds: []
      });

      return { drafts: next };
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
        if (activeBatchId) {
          updateActiveCompensationState(({ rows, drafts }) => ({
            rows: [
              ...rows,
              {
                employeeId: data.id,
                employeeName: data.name,
                position: data.position,
                assignedBuilding: data.assignedBuilding,
                batchId: activeBatchId,
                handledBirds: 0,
                ratePerBird: 1.5,
                corpoGroup: '',
                remarks: ''
              }
            ],
            drafts: {
              ...drafts,
              [data.id]: buildCompDraft()
            }
          }));
        }
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

    if (!activeBatchId) {
      setError('Select an active batch before saving employee batch pay.');
      return;
    }

    const employeeIdsToSave = paySheetEmployees.map((employee) => employee.id);
    const savedRows = [];

    try {
      for (const id of employeeIdsToSave) {
        const draft = buildCompDraft(compDrafts[id]);
        const poolIds = getConnectedPoolIds(id, employeeIdsToSave, compDrafts);
        const response = await fetch(`${API_BASE}/api/batches/${activeBatchId}/employee-compensations/${id}`, {
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

      updateActiveCompensationState(({ rows, drafts }) => {
        const nextDrafts = { ...drafts };

        savedRows.forEach((row) => {
          nextDrafts[row.employeeId] = buildCompDraft({
            handledBirds: String(row.handledBirds || ''),
            ratePerBird: String(row.ratePerBird || 1.5),
            poolEmployeeIds: parseCorpoGroupIds(row.corpoGroup)
              .filter((id) => id !== row.employeeId)
              .map(String),
            remarks: row.remarks || ''
          });
        });

        return {
          rows: rows.map((row) => savedByEmployeeId.get(row.employeeId) || row),
          drafts: nextDrafts
        };
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
      updateActiveCompensationState(({ rows, drafts }) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[employee.id];

        return {
          rows: rows.filter((item) => item.employeeId !== employee.id),
          drafts: nextDrafts
        };
      });
      if (editingId === employee.id) resetForm();
    } catch (err) {
      console.error(err);
      setError('Cannot connect to the employee sheet.');
    }
  };

  return (
    <div className="app-page">
      <div className="mb-6 mt-2">
        <h2 className="text-3xl font-extrabold text-app-text tracking-tight font-hanken">
          Employees
        </h2>
        <p className="text-app-text-secondary text-sm mt-1">
          Employee master sheet and batch pay.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Cycle Income</p>
          <p className="text-lg font-black mt-1 text-app-text font-jetbrains">
            {formatMoney(totals.cycleIncome)}
          </p>
        </div>

        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Mortality Deducted</p>
          <p className="text-lg font-black mt-1 text-app-danger font-jetbrains">
            {formatBirds(totals.mortality)}
          </p>
        </div>

        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Advance Balance</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${totals.outstandingAdvance > 0 ? 'text-app-danger' : 'text-app-success'}`}>
            {formatMoney(totals.outstandingAdvance)}
          </p>
        </div>

        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Net Payable</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${totals.netPayable > 0 ? 'text-app-warning' : 'text-app-success'}`}>
            {formatMoney(totals.netPayable)}
          </p>
        </div>
      </div>

      <EmployeeList
        form={form}
        updateForm={updateForm}
        handleSubmit={handleSubmit}
        editingId={editingId}
        resetForm={resetForm}
        buildings={buildings}
        error={error}
      />

      <CompensationForm
        compensationRows={compensationRows}
        paySheetEmployees={paySheetEmployees}
        employeeIds={employeeIds}
        compDrafts={compDrafts}
        updateCompDraft={updateCompDraft}
        updatePoolSelection={updatePoolSelection}
        canEditOrDelete={canEditOrDelete}
        handleEdit={handleEdit}
        handleArchive={handleArchive}
        handleCompSave={handleCompSave}
        isLoading={isLoading}
        activeBatch={activeBatch}
        transactions={transactions}
      />
    </div>
  );
}
