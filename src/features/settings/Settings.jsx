import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../shared/utils/apiClient';
import { useNotification } from '../../shared/hooks/useNotification';
import ChangePassword from './components/ChangePassword';
import DataSync from './components/DataSync';
import AccountManagement from './components/AccountManagement';
import ActivityLogs from './components/ActivityLogs';


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

export default function Settings({ user, token, activeBatch, isZeroGravity, setIsZeroGravity }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dataset, setDataset] = useState('transactions');
  const [exportScope, setExportScope] = useState('active');
  const [importType, setImportType] = useState('transactions');
  const [importFile, setImportFile] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [archiveScope, setArchiveScope] = useState('active');
  const [accounts, setAccounts] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const { success, error: toastError, confirm } = useNotification();

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

  const fetchAccounts = async () => {
    if (!canManageAccounts) return;

    setIsLoadingAccounts(true);

    try {
      const data = await apiClient.get('/api/admin/users', { expectArray: true });
      setAccounts(data);
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot connect to account manager.');
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

    try {
      const data = await apiClient.get('/api/admin/audit-logs?limit=150', { expectArray: true });
      setActivityLogs(data);
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot connect to activity logs.');
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

    if (newPassword !== confirmPassword) {
      toastError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      toastError('Use at least 8 characters for the new password.');
      return;
    }

    setIsPasswordSaving(true);

    try {
      const data = await apiClient.post('/api/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      success(data.message || 'Password changed successfully.');
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot connect to password settings.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleExport = async () => {
    if (!exportAllowed) {
      toastError('Your role cannot export farm files.');
      return;
    }

    if (exportUsesBatch && exportScope === 'active' && !activeBatch?.id) {
      toastError('Select or create an active batch first, or switch scope to all batches.');
      return;
    }

    setIsExporting(true);

    try {
      const params = new URLSearchParams({ dataset });
      if (effectiveBatchId) params.set('batchId', effectiveBatchId);

      const response = await apiClient.get(`/api/settings/export?${params.toString()}`, { returnResponse: true });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFilename(response, `octavio-${dataset}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success('CSV exported successfully!');
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot connect to export service.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleArchiveDownload = async () => {
    if (!exportAllowed) {
      toastError('Your role cannot download archive files.');
      return;
    }

    if (archiveScope === 'active' && !activeBatch?.id) {
      toastError('Select or create an active batch first, or archive all batches.');
      return;
    }

    setIsArchiving(true);

    try {
      const params = new URLSearchParams();
      if (archiveBatchId) params.set('batchId', archiveBatchId);

      const response = await apiClient.get(`/api/settings/archive?${params.toString()}`, { returnResponse: true });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFilename(response, `octavio-archive${archiveBatchId ? `-${archiveBatchId}` : ''}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      success('Archive JSON downloaded successfully!');
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot connect to archive service.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleImport = async () => {
    setImportSummary(null);

    if (!exportAllowed) {
      toastError('Your role cannot import farm files.');
      return;
    }

    if (!importFile) {
      toastError('Choose a file first.');
      return;
    }

    const confirmed = await confirm({
      title: 'Import Database File',
      message: 'Are you sure you want to import this file into the farm database? This will overwrite or add records.',
      confirmText: 'Import',
      danger: true
    });
    if (!confirmed) return;

    setIsImporting(true);

    try {
      const content = await importFile.text();
      const data = await apiClient.post('/api/settings/import', {
        importType,
        filename: importFile.name,
        content
      });

      setImportSummary(data.summary || null);
      const totals = getImportTotals(data.summary);
      success(`Imported ${totals.created} new and ${totals.updated} updated records.`);
      setImportFile(null);
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot connect to import service.');
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

    try {
      await apiClient.post('/api/admin/users', accountForm);
      setAccountForm(emptyAccountForm);
      success('Account created successfully.');
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot create account right now.');
    }
  };

  const updateAccount = async (accountId, patch) => {
    try {
      await apiClient.patch(`/api/admin/users/${accountId}`, patch);
      success('Account updated successfully.');
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot update account right now.');
    }
  };

  const disableAccount = async (accountId) => {
    const confirmed = await confirm({
      title: 'Disable Account',
      message: 'Are you sure you want to disable this user account?',
      confirmText: 'Disable',
      danger: true
    });
    if (!confirmed) return;

    try {
      const data = await apiClient.delete(`/api/admin/users/${accountId}`);
      success(data.message || 'Account disabled successfully.');
      await fetchAccounts();
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot disable account right now.');
    }
  };

  const toggleZeroGravity = () => {
    setIsZeroGravity((current) => {
      const next = !current;
      success(next ? 'Zero gravity physics enabled!' : 'Zero gravity physics disabled.');
      return next;
    });
  };

  return (
    <div className="app-page font-hanken">
      <div className="mb-6 mt-2">
        <h2 className="text-3xl font-extrabold text-app-text tracking-tight">Settings</h2>
        <p className="text-app-text-secondary text-sm mt-1">
          Account, interface options, data exports, and audit logging utilities
        </p>
      </div>

      <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-4">Account Profile</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-app-bg rounded-xl p-3 min-w-0 border border-app-border/40">
            <p className="text-[10px] font-black uppercase text-app-text-secondary">Signed In</p>
            <p className="font-black text-app-text truncate mt-1 font-jetbrains">{user?.email}</p>
          </div>
          <div className="bg-app-bg rounded-xl p-3 border border-app-border/40">
            <p className="text-[10px] font-black uppercase text-app-text-secondary">System Role</p>
            <p className="font-black text-app-text mt-1 font-jetbrains">{user?.role}</p>
          </div>
        </div>
      </div>

      <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-4">Interface Options</h3>
        <div className="flex items-center justify-between gap-4 bg-app-bg rounded-xl p-4 border border-app-border/40">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-app-text uppercase tracking-wide">Zero-Gravity Interface Physics</h4>
            <p className="text-xs text-app-text-secondary mt-1">
              Enable floating elements, low-gravity hover translations, and particle effects throughout the deck.
            </p>
          </div>
          <button
            onClick={toggleZeroGravity}
            className={`no-float relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-app-accent/30 ${
              isZeroGravity ? 'bg-app-accent' : 'bg-app-text-secondary/30'
            }`}
            role="switch"
            aria-checked={isZeroGravity}
            aria-label="Toggle zero-gravity interface physics"
          >
            <span
              className={`no-float pointer-events-none inline-block h-5 w-5 transform rounded-full bg-app-card shadow ring-0 transition duration-200 ease-in-out ${
                isZeroGravity ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
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
        />
      )}

      {canManageAccounts && (
        <ActivityLogs
          fetchActivityLogs={fetchActivityLogs}
          isLoadingActivity={isLoadingActivity}
          activityLogs={activityLogs}
        />
      )}

      <DataSync
        exportAllowed={exportAllowed}
        dataset={dataset}
        setDataset={setDataset}
        exportScope={exportScope}
        setExportScope={setExportScope}
        exportUsesBatch={exportUsesBatch}
        exportHint={exportHint}
        effectiveBatchId={effectiveBatchId}
        handleExport={handleExport}
        isExporting={isExporting}
        importType={importType}
        setImportType={setImportType}
        importFile={importFile}
        setImportFile={setImportFile}
        importSummary={importSummary}
        setImportSummary={setImportSummary}
        handleImport={handleImport}
        isImporting={isImporting}
        archiveScope={archiveScope}
        setArchiveScope={setArchiveScope}
        archiveBatchId={archiveBatchId}
        handleArchiveDownload={handleArchiveDownload}
        isArchiving={isArchiving}
      />

      <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-3">Build Notes</h3>
        <div className="space-y-2 text-sm text-app-text-secondary">
          <p>Exports are generated from the database, including ledger, daily log, inventory, employee, and batch records.</p>
          <p>Spreadsheet templates and direct Google Sheets sync can sit here later without changing the daily workflow screens.</p>
        </div>
      </div>
    </div>
  );
}
