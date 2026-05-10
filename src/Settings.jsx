import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';

const exportDatasets = [
  { value: 'transactions', label: 'Ledger Transactions' },
  { value: 'daily_logs', label: 'Daily Logs' },
  { value: 'inventory', label: 'Inventory Movements' },
  { value: 'employees', label: 'Employees' },
  { value: 'batches', label: 'Batches' }
];
const importDatasets = [
  { value: 'transactions', label: 'Ledger Transactions', accept: '.csv,text/csv' },
  { value: 'daily_logs', label: 'Daily Logs', accept: '.csv,text/csv' },
  { value: 'inventory', label: 'Inventory Movements', accept: '.csv,text/csv' },
  { value: 'employees', label: 'Employees', accept: '.csv,text/csv' },
  { value: 'batch_archive', label: 'Single Batch Archive', accept: '.json,application/json' }
];
const roleOptions = ['AdminOwner', 'OperationManager', 'DataEntry', 'Viewer'];
const stakeholderTypeOptions = ['Owner', 'Employee', 'Supplier', 'Buyer', 'Dressing Plant', 'Other'];
const allFilterValue = 'all';

const emptyAccountForm = {
  email: '',
  username: '',
  password: '',
  role: 'DataEntry',
  stakeholderName: '',
  stakeholderType: 'Employee'
};

function canExport(role) {
  return role === 'AdminOwner' || role === 'OperationManager' || role === 'Admin';
}

function getFilename(response, fallback) {
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  return match?.[1] || fallback;
}

function getImportTotals(summary) {
  return Object.values(summary || {}).reduce((totals, item) => ({
    rowsRead: totals.rowsRead + Number(item.rowsRead || 0),
    created: totals.created + Number(item.created || 0),
    updated: totals.updated + Number(item.updated || 0),
    skipped: totals.skipped + Number(item.skipped || 0)
  }), { rowsRead: 0, created: 0, updated: 0, skipped: 0 });
}

export default function Settings({ user, token, activeBatch }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [dataset, setDataset] = useState('transactions');
  const [exportScope, setExportScope] = useState('active');
  const [exportError, setExportError] = useState('');
  const [importType, setImportType] = useState('transactions');
  const [importFile, setImportFile] = useState(null);
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [archiveScope, setArchiveScope] = useState('active');
  const [archiveError, setArchiveError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityActionFilter, setActivityActionFilter] = useState(allFilterValue);
  const [activityEntityFilter, setActivityEntityFilter] = useState(allFilterValue);
  const [activitySort, setActivitySort] = useState('newest');
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [accountError, setAccountError] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [activityError, setActivityError] = useState('');
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const exportAllowed = canExport(user?.role);
  const selectedImportDataset = importDatasets.find((option) => option.value === importType) || importDatasets[0];
  const canManageAccounts = Boolean(user?.isPrimaryOwner);
  const exportUsesBatch = dataset !== 'batches';
  const effectiveBatchId = exportUsesBatch && exportScope === 'active' ? activeBatch?.id : null;
  const archiveBatchId = archiveScope === 'active' ? activeBatch?.id : null;

  const exportHint = useMemo(() => {
    if (!exportAllowed) return 'Exports are available to owners and operation managers.';
    if (exportUsesBatch && exportScope === 'active' && !activeBatch?.id) {
      return 'Select or create an active batch before exporting a batch-only file.';
    }
    return 'CSV files open directly in Excel and Google Sheets.';
  }, [activeBatch?.id, exportAllowed, exportScope, exportUsesBatch]);

  const activityActionOptions = useMemo(() => {
    return [...new Set(activityLogs.map((log) => log.action).filter(Boolean))].sort();
  }, [activityLogs]);

  const activityEntityOptions = useMemo(() => {
    return [...new Set(activityLogs.map((log) => log.entityType).filter(Boolean))].sort();
  }, [activityLogs]);

  const filteredActivityLogs = useMemo(() => {
    const search = activitySearch.trim().toLowerCase();

    return activityLogs
      .filter((log) => {
        const matchesAction = activityActionFilter === allFilterValue || log.action === activityActionFilter;
        const matchesEntity = activityEntityFilter === allFilterValue || log.entityType === activityEntityFilter;

        if (!matchesAction || !matchesEntity) return false;
        if (!search) return true;

        const searchableText = [
          log.action,
          log.entityType,
          log.entityId,
          log.actorUsername,
          log.actorEmail,
          log.batchId,
          log.createdAt
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(search);
      })
      .sort((a, b) => {
        const first = new Date(a.createdAt).getTime();
        const second = new Date(b.createdAt).getTime();
        return activitySort === 'oldest' ? first - second : second - first;
      });
  }, [activityActionFilter, activityEntityFilter, activityLogs, activitySearch, activitySort]);

  const fetchAccounts = async () => {
    if (!canManageAccounts) return;

    setIsLoadingAccounts(true);
    setAccountError('');

    try {
      const response = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setAccountError(data.error || 'Failed to load user accounts.');
        return;
      }

      setAccounts(data);
    } catch (err) {
      console.error(err);
      setAccountError('Cannot connect to account manager.');
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [canManageAccounts, token]);

  const fetchActivityLogs = async () => {
    if (!canManageAccounts) return;

    setIsLoadingActivity(true);
    setActivityError('');

    try {
      const response = await fetch(`${API_BASE}/api/admin/audit-logs?limit=150`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setActivityError(data.error || 'Failed to load activity logs.');
        return;
      }

      setActivityLogs(data);
    } catch (err) {
      console.error(err);
      setActivityError('Cannot connect to activity logs.');
    } finally {
      setIsLoadingActivity(false);
    }
  };

  useEffect(() => {
    fetchActivityLogs();
  }, [canManageAccounts, token]);

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Use at least 8 characters for the new password.');
      return;
    }

    setIsPasswordSaving(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.error || 'Failed to change password.');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(data.message || 'Password changed successfully.');
    } catch (err) {
      console.error(err);
      setPasswordError('Cannot connect to password settings.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleExport = async () => {
    setExportError('');

    if (!exportAllowed) {
      setExportError('Your role cannot export farm files.');
      return;
    }

    if (exportUsesBatch && exportScope === 'active' && !activeBatch?.id) {
      setExportError('Select or create an active batch first, or switch scope to all batches.');
      return;
    }

    setIsExporting(true);

    try {
      const params = new URLSearchParams({ dataset });
      if (effectiveBatchId) params.set('batchId', effectiveBatchId);

      const response = await fetch(`${API_BASE}/api/settings/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setExportError(data.error || 'Failed to export file.');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFilename(response, `octavio-${dataset}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setExportError('Cannot connect to export service.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleArchiveDownload = async () => {
    setArchiveError('');

    if (!exportAllowed) {
      setArchiveError('Your role cannot download archive files.');
      return;
    }

    if (archiveScope === 'active' && !activeBatch?.id) {
      setArchiveError('Select or create an active batch first, or archive all batches.');
      return;
    }

    setIsArchiving(true);

    try {
      const params = new URLSearchParams();
      if (archiveBatchId) params.set('batchId', archiveBatchId);

      const response = await fetch(`${API_BASE}/api/settings/archive?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setArchiveError(data.error || 'Failed to create archive.');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFilename(response, `octavio-archive${archiveBatchId ? `-${archiveBatchId}` : ''}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setArchiveError('Cannot connect to archive service.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleImport = async () => {
    setImportError('');
    setImportMessage('');
    setImportSummary(null);

    if (!exportAllowed) {
      setImportError('Your role cannot import farm files.');
      return;
    }

    if (!importFile) {
      setImportError('Choose a file first.');
      return;
    }

    const confirmed = window.confirm('Import this file into the farm database?');
    if (!confirmed) return;

    setIsImporting(true);

    try {
      const content = await importFile.text();
      const response = await fetch(`${API_BASE}/api/settings/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          importType,
          filename: importFile.name,
          content
        })
      });
      const data = await response.json();

      if (!response.ok) {
        setImportError(data.error || 'Failed to import file.');
        return;
      }

      setImportSummary(data.summary || null);
      const totals = getImportTotals(data.summary);
      setImportMessage(`Imported ${totals.created} new and ${totals.updated} updated records.`);
      setImportFile(null);
    } catch (err) {
      console.error(err);
      setImportError('Cannot connect to import service.');
    } finally {
      setIsImporting(false);
    }
  };

  const updateAccountForm = (field, value) => {
    setAccountForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'role' && value === 'Viewer' ? { stakeholderType: 'Other' } : {})
    }));
  };

  const handleAccountCreate = async (event) => {
    event.preventDefault();
    setAccountError('');
    setAccountMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(accountForm)
      });
      const data = await response.json();

      if (!response.ok) {
        setAccountError(data.error || 'Failed to create account.');
        return;
      }

      setAccountForm(emptyAccountForm);
      setAccountMessage('Account created.');
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      setAccountError('Cannot create account right now.');
    }
  };

  const updateAccount = async (accountId, patch) => {
    setAccountError('');
    setAccountMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${accountId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(patch)
      });
      const data = await response.json();

      if (!response.ok) {
        setAccountError(data.error || 'Failed to update account.');
        return;
      }

      setAccountMessage('Account updated.');
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      setAccountError('Cannot update account right now.');
    }
  };

  const disableAccount = async (accountId) => {
    const confirmed = window.confirm('Disable this user account?');
    if (!confirmed) return;

    setAccountError('');
    setAccountMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${accountId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        setAccountError(data.error || 'Failed to disable account.');
        return;
      }

      setAccountMessage(data.message || 'Account disabled.');
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      setAccountError('Cannot disable account right now.');
    }
  };

  return (
    <div className="app-page">
      <div className="mb-6 mt-2">
        <h2 className="text-3xl font-extrabold text-primary tracking-tight">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Account, exports, and app utilities
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Account</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-neutral-light dark:bg-gray-900 rounded-xl p-3 min-w-0">
            <p className="text-[10px] font-bold uppercase text-gray-400">Signed In</p>
            <p className="font-black text-gray-900 dark:text-white truncate mt-1">{user?.email}</p>
          </div>
          <div className="bg-neutral-light dark:bg-gray-900 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase text-gray-400">Role</p>
            <p className="font-black text-gray-900 dark:text-white mt-1">{user?.role}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Change Password</h3>

        {passwordError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
            {passwordError}
          </div>
        )}
        {passwordMessage && (
          <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm font-bold mb-4 border border-green-200">
            {passwordMessage}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPasswordSaving}
            className="w-full bg-primary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all disabled:opacity-60"
          >
            {isPasswordSaving ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>

      {canManageAccounts && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">User Accounts</h3>

          {accountError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
              {accountError}
            </div>
          )}
          {accountMessage && (
            <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm font-bold mb-4 border border-green-200">
              {accountMessage}
            </div>
          )}

          <form onSubmit={handleAccountCreate} className="space-y-3 mb-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={accountForm.email}
                  onChange={(event) => updateAccountForm('email', event.target.value)}
                  className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
                  placeholder="name@octavio.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={accountForm.username}
                  onChange={(event) => updateAccountForm('username', event.target.value)}
                  className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Temp Password</label>
                <input
                  type="text"
                  required
                  value={accountForm.password}
                  onChange={(event) => updateAccountForm('password', event.target.value)}
                  className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
                  placeholder="temporary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Role</label>
                <select
                  value={accountForm.role}
                  onChange={(event) => updateAccountForm('role', event.target.value)}
                  className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Person/Entity</label>
                <input
                  type="text"
                  value={accountForm.stakeholderName}
                  onChange={(event) => updateAccountForm('stakeholderName', event.target.value)}
                  className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Type</label>
                <select
                  value={accountForm.stakeholderType}
                  onChange={(event) => updateAccountForm('stakeholderType', event.target.value)}
                  className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
                >
                  {stakeholderTypeOptions.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="w-full bg-secondary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all">
              Create Account
            </button>
          </form>

          {isLoadingAccounts && (
            <p className="text-xs text-gray-500 mb-3">Loading accounts...</p>
          )}

          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className={`rounded-xl border p-3 ${account.isActive ? 'border-neutral-border dark:border-gray-700 bg-neutral-light dark:bg-gray-900' : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10'}`}>
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-gray-900 dark:text-white truncate">{account.username || account.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{account.email}</p>
                    {account.isPrimaryOwner && (
                      <p className="text-[10px] text-primary font-black mt-1">Primary Owner</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full h-fit ${account.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {account.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <select
                    value={account.role}
                    onChange={(event) => updateAccount(account.id, { role: event.target.value })}
                    disabled={account.isPrimaryOwner}
                    className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-60"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => updateAccount(account.id, { password: '123' })}
                    className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-neutral-border dark:border-gray-600 text-xs font-black text-gray-600 dark:text-gray-200"
                  >
                    Reset 123
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => updateAccount(account.id, { isActive: true })}
                    disabled={account.isActive}
                    className="p-2 rounded-lg bg-green-100 text-green-700 text-xs font-black disabled:opacity-50"
                  >
                    Reactivate
                  </button>
                  <button
                    type="button"
                    onClick={() => disableAccount(account.id)}
                    disabled={account.isPrimaryOwner || !account.isActive}
                    className="p-2 rounded-lg bg-red-100 text-red-700 text-xs font-black disabled:opacity-50"
                  >
                    Disable
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canManageAccounts && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Activity Logs</h3>
              <p className="text-[10px] font-bold text-gray-400 mt-1">
                Showing {filteredActivityLogs.length} of {activityLogs.length}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchActivityLogs}
              className="text-xs font-black text-primary"
            >
              Refresh
            </button>
          </div>

          {activityError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
              {activityError}
            </div>
          )}

          {isLoadingActivity && (
            <p className="text-xs text-gray-500 mb-3">Loading activity logs...</p>
          )}

          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_180px_140px] mb-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Search</label>
              <input
                type="search"
                value={activitySearch}
                onChange={(event) => setActivitySearch(event.target.value)}
                placeholder="User, action, batch, ref"
                className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Action</label>
              <select
                value={activityActionFilter}
                onChange={(event) => setActivityActionFilter(event.target.value)}
                className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              >
                <option value={allFilterValue}>All actions</option>
                {activityActionOptions.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Record Type</label>
              <select
                value={activityEntityFilter}
                onChange={(event) => setActivityEntityFilter(event.target.value)}
                className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              >
                <option value={allFilterValue}>All types</option>
                {activityEntityOptions.map((entityType) => (
                  <option key={entityType} value={entityType}>{entityType}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Sort</label>
              <select
                value={activitySort}
                onChange={(event) => setActivitySort(event.target.value)}
                className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>

          {(activitySearch || activityActionFilter !== allFilterValue || activityEntityFilter !== allFilterValue || activitySort !== 'newest') && (
            <button
              type="button"
              onClick={() => {
                setActivitySearch('');
                setActivityActionFilter(allFilterValue);
                setActivityEntityFilter(allFilterValue);
                setActivitySort('newest');
              }}
              className="mb-4 text-xs font-black text-gray-500 dark:text-gray-300 bg-neutral-light dark:bg-gray-700 border border-neutral-border dark:border-gray-600 rounded-lg px-3 py-2"
            >
              Clear filters
            </button>
          )}

          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
            {filteredActivityLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-neutral-border dark:border-gray-700 bg-neutral-light dark:bg-gray-900 p-3">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">
                      {log.action} {log.entityType}
                    </p>
                    <p className="text-[10px] font-bold text-primary mt-1">
                      {(log.actorUsername || log.actorEmail || 'System')} {log.batchId ? `- Batch ${log.batchId}` : ''}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-400 text-right shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">
                  Ref: {log.entityId || 'n/a'}
                </p>
              </div>
            ))}

            {activityLogs.length === 0 && !isLoadingActivity && (
              <p className="text-center text-gray-500 text-sm">No activity logs yet.</p>
            )}
            {activityLogs.length > 0 && filteredActivityLogs.length === 0 && !isLoadingActivity && (
              <p className="text-center text-gray-500 text-sm">No activity logs match those filters.</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Export Files</h3>

        {exportError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
            {exportError}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">File</label>
            <select
              value={dataset}
              onChange={(event) => setDataset(event.target.value)}
              disabled={!exportAllowed}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none disabled:opacity-60"
            >
              {exportDatasets.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {exportUsesBatch && (
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Scope</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExportScope('active')}
                  disabled={!exportAllowed}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all disabled:opacity-60 ${
                    exportScope === 'active'
                      ? 'bg-secondary text-white border-secondary'
                      : 'bg-neutral-light dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-neutral-border dark:border-gray-600'
                  }`}
                >
                  Active Batch
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  disabled={!exportAllowed}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all disabled:opacity-60 ${
                    exportScope === 'all'
                      ? 'bg-secondary text-white border-secondary'
                      : 'bg-neutral-light dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-neutral-border dark:border-gray-600'
                  }`}
                >
                  All Batches
                </button>
              </div>
            </div>
          )}

          <div className="bg-neutral-light dark:bg-gray-900 rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{exportHint}</p>
            {effectiveBatchId && (
              <p className="text-[10px] text-primary font-black mt-1">Batch {effectiveBatchId}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={!exportAllowed || isExporting}
            className="w-full bg-secondary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all disabled:opacity-60"
          >
            {isExporting ? 'Preparing...' : 'Download CSV'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Import Files</h3>

        {importError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
            {importError}
          </div>
        )}
        {importMessage && (
          <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm font-bold mb-4 border border-green-200">
            {importMessage}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Import Type</label>
            <select
              value={importType}
              onChange={(event) => {
                setImportType(event.target.value);
                setImportFile(null);
                setImportSummary(null);
                setImportError('');
                setImportMessage('');
              }}
              disabled={!exportAllowed}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none disabled:opacity-60"
            >
              {importDatasets.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">File</label>
            <input
              type="file"
              accept={selectedImportDataset.accept}
              disabled={!exportAllowed}
              onChange={(event) => {
                setImportFile(event.target.files?.[0] || null);
                setImportSummary(null);
                setImportError('');
                setImportMessage('');
              }}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none disabled:opacity-60 text-sm"
            />
          </div>

          {importFile && (
            <div className="bg-neutral-light dark:bg-gray-900 rounded-xl p-3">
              <p className="text-xs font-black text-gray-700 dark:text-gray-200 truncate">{importFile.name}</p>
              <p className="text-[10px] font-bold text-gray-400 mt-1">
                {(importFile.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB
              </p>
            </div>
          )}

          {importSummary && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(importSummary).map(([key, item]) => (
                <div key={key} className="rounded-xl bg-neutral-light dark:bg-gray-900 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{item.label || key}</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white mt-1">
                    +{item.created || 0} / {item.updated || 0}
                  </p>
                  {item.skipped > 0 && (
                    <p className="text-[10px] font-bold text-semantic-warning mt-1">
                      {item.skipped} skipped
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleImport}
            disabled={!exportAllowed || !importFile || isImporting}
            className="w-full bg-primary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all disabled:opacity-60"
          >
            {isImporting ? 'Importing...' : 'Import File'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Archive System</h3>

        {archiveError && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
            {archiveError}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Archive Scope</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setArchiveScope('active')}
                disabled={!exportAllowed}
                className={`p-3 rounded-xl border text-sm font-bold transition-all disabled:opacity-60 ${
                  archiveScope === 'active'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-neutral-light dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-neutral-border dark:border-gray-600'
                }`}
              >
                Active Batch
              </button>
              <button
                type="button"
                onClick={() => setArchiveScope('all')}
                disabled={!exportAllowed}
                className={`p-3 rounded-xl border text-sm font-bold transition-all disabled:opacity-60 ${
                  archiveScope === 'all'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-neutral-light dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-neutral-border dark:border-gray-600'
                }`}
              >
                All Batches
              </button>
            </div>
          </div>

          <div className="bg-neutral-light dark:bg-gray-900 rounded-xl p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
              Archive downloads include batch records, loadings, ledger entries, daily logs, inventory, and employee compensation data.
            </p>
            {archiveBatchId && (
              <p className="text-[10px] text-primary font-black mt-1">Batch {archiveBatchId}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleArchiveDownload}
            disabled={!exportAllowed || isArchiving}
            className="w-full bg-primary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all disabled:opacity-60"
          >
            {isArchiving ? 'Preparing Archive...' : 'Download Archive JSON'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Build Notes</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <p>Exports are generated from the database, including ledger, daily log, inventory, employee, and batch records.</p>
          <p>Spreadsheet templates and direct Google Sheets sync can sit here later without changing the daily workflow screens.</p>
        </div>
      </div>
    </div>
  );
}
