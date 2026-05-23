import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';
import ChangePassword from './Components/Settings/ChangePassword';
import DataSync from './Components/Settings/DataSync';
import AccountManagement from './Components/Settings/AccountManagement';
import ActivityLogs from './Components/Settings/ActivityLogs';

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
    setTimeout(() => {
      fetchAccounts();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setTimeout(() => {
      fetchActivityLogs();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <ChangePassword
        handlePasswordSubmit={handlePasswordSubmit}
        currentPassword={currentPassword}
        setCurrentPassword={setCurrentPassword}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        passwordMessage={passwordMessage}
        passwordError={passwordError}
        isPasswordSaving={isPasswordSaving}
      />

      {canManageAccounts && (
        <AccountManagement
          accountForm={accountForm}
          updateAccountForm={updateAccountForm}
          handleAccountCreate={handleAccountCreate}
          accounts={accounts}
          isLoadingAccounts={isLoadingAccounts}
          updateAccount={updateAccount}
          disableAccount={disableAccount}
          accountError={accountError}
          accountMessage={accountMessage}
        />
      )}

      {canManageAccounts && (
        <ActivityLogs
          fetchActivityLogs={fetchActivityLogs}
          activityError={activityError}
          isLoadingActivity={isLoadingActivity}
          activitySearch={activitySearch}
          setActivitySearch={setActivitySearch}
          activityActionFilter={activityActionFilter}
          setActivityActionFilter={setActivityActionFilter}
          activityEntityFilter={activityEntityFilter}
          setActivityEntityFilter={setActivityEntityFilter}
          activitySort={activitySort}
          setActivitySort={setActivitySort}
          activityActionOptions={activityActionOptions}
          activityEntityOptions={activityEntityOptions}
          filteredActivityLogs={filteredActivityLogs}
          activityLogs={activityLogs}
        />
      )}

      <DataSync
        exportAllowed={exportAllowed}
        dataset={dataset}
        setDataset={setDataset}
        exportScope={exportScope}
        setExportScope={setExportScope}
        exportError={exportError}
        exportUsesBatch={exportUsesBatch}
        exportHint={exportHint}
        effectiveBatchId={effectiveBatchId}
        handleExport={handleExport}
        isExporting={isExporting}
        importError={importError}
        importMessage={importMessage}
        importType={importType}
        setImportType={setImportType}
        importFile={importFile}
        setImportFile={setImportFile}
        importSummary={importSummary}
        setImportSummary={setImportSummary}
        setImportError={setImportError}
        setImportMessage={setImportMessage}
        handleImport={handleImport}
        isImporting={isImporting}
        archiveError={archiveError}
        archiveScope={archiveScope}
        setArchiveScope={setArchiveScope}
        archiveBatchId={archiveBatchId}
        handleArchiveDownload={handleArchiveDownload}
        isArchiving={isArchiving}
      />

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
