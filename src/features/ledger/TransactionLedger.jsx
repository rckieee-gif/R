import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../shared/utils/apiClient';
import OfflineStaleBanner from '../../shared/components/OfflineStaleBanner';
import ConfirmVoidDialog from '../../shared/components/ConfirmVoidDialog';
import { useNotification } from '../../shared/hooks/useNotification';
import {
  Badge,
  Button,
  DataTable,
  FormField,
  Modal,
  PageHeader,
  SearchInput,
  SectionLabel,
  SelectField,
  TextArea,
  TextInput
} from '../../shared/components/OctavioUI';

const DEFAULT_CATEGORY_DATA = [
  { name: 'Feed', fundingNature: 'OPEX' },
  { name: 'DOC', fundingNature: 'OPEX' },
  { name: 'Medicine', fundingNature: 'OPEX' },
  { name: 'Labor', fundingNature: 'OPEX' },
  { name: 'Transport', fundingNature: 'OPEX' },
  { name: 'Utilities', fundingNature: 'OPEX' },
  { name: 'Supplies', fundingNature: 'OPEX' },
  { name: 'Miscellaneous', fundingNature: 'OPEX' },
  { name: 'Other', fundingNature: 'OPEX' },
];

const emptyForm = {
  description: '',
  category: 'Other',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  vendor: '',
  notes: '',
};

function normalizeStakeholderName(name) {
  const cleaned = String(name || '').trim();
  return cleaned === 'Yanyan' ? 'Others' : cleaned;
}

function groupCategories(categories) {
  return categories.reduce((groups, category) => {
    const key = category.fundingNature === 'Other Revenue' ? 'Revenue' : category.fundingNature;
    if (!groups[key]) groups[key] = [];
    groups[key].push(category.name);
    return groups;
  }, {});
}

function isRevenue(tx) {
  return tx?.fundingNature === 'Revenue' || tx?.fundingNature === 'Other Revenue' || tx?.type === 'Income';
}

function getDateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function getSearchText(tx) {
  return [
    tx.description,
    tx.category,
    tx.paidTo,
    tx.date,
    tx.amount,
    tx.remarks,
    tx.reference
  ].join(' ').toLowerCase();
}

function validateExpenseForm(form) {
  const errors = {};

  if (!form.description.trim()) errors.description = 'Description is required.';
  if (!form.category.trim()) errors.category = 'Category is required.';
  if (!form.date) errors.date = 'Date is required.';
  if (form.amount === '' || Number.isNaN(Number(form.amount))) {
    errors.amount = 'Amount is required.';
  } else if (Number(form.amount) <= 0) {
    errors.amount = 'Amount must be greater than zero.';
  }

  return errors;
}

function buildExpenseForm(tx) {
  return {
    description: tx.description || '',
    category: tx.category || 'Other',
    amount: String(tx.amount || ''),
    date: getDateOnly(tx.date) || emptyForm.date,
    vendor: normalizeStakeholderName(tx.paidTo || ''),
    notes: tx.remarks || '',
  };
}

export default function TransactionLedger({ transactions = [], setTransactions = () => {}, activeBatch, token, readOnly = false, canEditOrDelete = false }) {
  const { success, error: toastError } = useNotification();
  const [categoriesByFunding, setCategoriesByFunding] = useState(groupCategories(DEFAULT_CATEGORY_DATA));
  const [stakeholders, setStakeholders] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [transactionToVoid, setTransactionToVoid] = useState(null);

  const categoryOptions = useMemo(() => {
    const opexCategories = categoriesByFunding.OPEX || [];
    const unique = Array.from(new Set([...opexCategories, form.category, 'Other'].filter(Boolean)));
    return unique.sort((left, right) => left.localeCompare(right));
  }, [categoriesByFunding, form.category]);

  const payerName = useMemo(() => {
    const rolly = stakeholders.find((item) => item.name === 'Rolly');
    return rolly?.name || stakeholders[0]?.name || '';
  }, [stakeholders]);

  const expenseTransactions = useMemo(
    () => transactions.filter((tx) => !isRevenue(tx) && !tx.isVoid),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return expenseTransactions;
    return expenseTransactions.filter((tx) => getSearchText(tx).includes(query));
  }, [expenseTransactions, search]);

  useEffect(() => {
    if (!token) return;

    const fetchMasterData = async () => {
      try {
        const [categoryData, stakeholderData, feedData] = await Promise.all([
          apiClient.get('/api/categories', { expectArray: true }).catch(() => DEFAULT_CATEGORY_DATA),
          apiClient.get('/api/stakeholders', { expectArray: true }).catch(() => []),
          apiClient.get('/api/inventory/items?category=Feed', { expectArray: true }).catch(() => [])
        ]);

        setCategoriesByFunding(groupCategories(categoryData.length ? categoryData : DEFAULT_CATEGORY_DATA));
        setStakeholders(stakeholderData.map((stakeholder) => ({
          ...stakeholder,
          name: normalizeStakeholderName(stakeholder.name)
        })));
        setFeedItems(feedData);
      } catch (err) {
        console.error('Could not load expense dropdown data:', err);
      }
    };

    fetchMasterData();
  }, [token]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const openNewExpense = () => {
    setEditingId(null);
    setForm({ ...emptyForm, category: categoryOptions.includes('Other') ? 'Other' : categoryOptions[0] || 'Other' });
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditExpense = (tx) => {
    if (!canEditOrDelete) return;
    setEditingId(tx.id);
    setForm(buildExpenseForm(tx));
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditingId(null);
    setFormErrors({});
  };

  const buildPayload = () => ({
    batchId: activeBatch.id,
    date: form.date,
    building: 'All',
    type: 'Expense',
    fundingNature: 'OPEX',
    category: form.category,
    description: form.description.trim(),
    amount: Number(form.amount),
    paidBy: payerName,
    paidTo: form.vendor.trim(),
    reference: '',
    remarks: form.notes.trim(),
    quantity: undefined,
    unitCost: undefined,
    feedItemId: null,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (readOnly) {
      toastError('Your role can view expenses but cannot save changes.');
      return;
    }

    if (!activeBatch?.id) {
      toastError('Select an active batch before saving an expense.');
      return;
    }

    if (editingId && !canEditOrDelete) {
      toastError('Only owners can edit existing expenses.');
      return;
    }

    const errors = validateExpenseForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = buildPayload();
    setIsSaving(true);

    try {
      const saved = editingId
        ? await apiClient.patch(`/api/batches/${activeBatch.id}/transactions/${editingId}`, payload)
        : await apiClient.post(`/api/batches/${activeBatch.id}/transactions`, payload);

      setTransactions((current) => editingId
        ? current.map((tx) => String(tx.id) === String(editingId) ? saved : tx)
        : [saved, ...current]);
      success(editingId ? 'Expense updated successfully.' : 'Expense added successfully.');
      setModalOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
    } catch (err) {
      console.error('Failed to save expense:', err);
      toastError(err.message || 'Cannot save expense right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = (idToDelete) => {
    if (readOnly || !canEditOrDelete) return;
    setTransactionToVoid(idToDelete);
    setVoidDialogOpen(true);
  };

  const confirmVoid = async (reason) => {
    if (!transactionToVoid || !activeBatch?.id) return;

    try {
      await apiClient.post(`/api/batches/${activeBatch.id}/transactions/${transactionToVoid}/void`, { reason });
      setTransactions((current) => current.filter((tx) => String(tx.id) !== String(transactionToVoid)));
      success('Expense deleted successfully.');
    } catch (err) {
      console.error('Failed to delete expense:', err);
      toastError(err.message || 'Cannot delete expense right now.');
    } finally {
      setVoidDialogOpen(false);
      setTransactionToVoid(null);
    }
  };

  const exportToCSV = () => {
    const headers = ['Description', 'Category', 'Vendor', 'Date', 'Amount', 'Notes'];
    const rows = filteredTransactions.map((tx) => [
      tx.description || '',
      tx.category || '',
      normalizeStakeholderName(tx.paidTo || '') || '--',
      getDateOnly(tx.date),
      Number(tx.amount || 0).toFixed(2),
      tx.remarks || ''
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = `expenses_${activeBatch?.id || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    {
      key: 'description',
      header: 'Description',
      render: (tx) => <span className="font-medium text-app-text">{tx.description}</span>
    },
    {
      key: 'category',
      header: 'Category',
      render: (tx) => <Badge>{tx.category || 'Other'}</Badge>
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (tx) => normalizeStakeholderName(tx.paidTo || '') || '—'
    },
    {
      key: 'date',
      header: 'Date',
      render: (tx) => getDateOnly(tx.date)
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (tx) => <span className="font-bold text-app-text">{formatMoney(tx.amount)}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      cellClassName: 'w-24',
      render: (tx) => (
        <div className="no-print flex items-center gap-3">
          {canEditOrDelete && !readOnly ? (
            <>
              <button
                type="button"
                onClick={() => openEditExpense(tx)}
                className="text-app-text hover:text-app-accent cursor-pointer"
                aria-label={`Edit ${tx.description}`}
                title="Edit"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTransaction(tx.id)}
                className="text-app-danger hover:text-[#a72824] cursor-pointer"
                aria-label={`Delete ${tx.description}`}
                title="Delete"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </>
          ) : (
            <span className="text-xs text-app-text-secondary">View</span>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="octavio-wide-page">
      <PageHeader
        title="Expenses"
        subtitle="Every cost, categorized."
      />

      <OfflineStaleBanner data={[transactions, stakeholders, feedItems]} />

      {readOnly && (
        <div className="mb-5 rounded-2xl border border-app-accent bg-app-success-bg p-4 text-sm text-app-text">
          <p className="text-xs font-bold uppercase tracking-wide text-app-accent">Read-only access</p>
          <p className="mt-1">You can review expenses. Changes are restricted to operation managers and owners.</p>
        </div>
      )}

      <div className="no-print mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search expenses..."
        />
        <Button variant="secondary" onClick={exportToCSV}>
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export CSV
        </Button>
        {!readOnly && (
          <Button onClick={openNewExpense}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Expense
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filteredTransactions}
        emptyMessage={search ? 'No expenses match your search.' : 'No expenses logged yet.'}
      />

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit Expense' : 'New Expense'}
        helperText="Fill in the details below. Required fields are marked with *."
        onClose={closeModal}
        footer={(
          <>
            <Button variant="ghost" onClick={closeModal} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingId ? 'Update expense' : 'Add expense'}
            </Button>
          </>
        )}
      >
        <form onSubmit={handleSubmit}>
          <SectionLabel>Expense</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Description" required error={formErrors.description}>
              <TextInput
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                aria-invalid={Boolean(formErrors.description)}
              />
            </FormField>
            <FormField label="Category" required error={formErrors.category}>
              <SelectField
                value={form.category}
                onChange={(event) => updateForm('category', event.target.value)}
                aria-invalid={Boolean(formErrors.category)}
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectField>
            </FormField>
          </div>

          <SectionLabel>Amount</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Amount" required error={formErrors.amount}>
              <TextInput
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateForm('amount', event.target.value)}
                aria-invalid={Boolean(formErrors.amount)}
              />
            </FormField>
            <FormField label="Date" required error={formErrors.date}>
              <TextInput
                type="date"
                value={form.date}
                onChange={(event) => updateForm('date', event.target.value)}
                aria-invalid={Boolean(formErrors.date)}
              />
            </FormField>
            <FormField label="Vendor">
              <TextInput
                value={form.vendor}
                onChange={(event) => updateForm('vendor', event.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Notes" className="mt-3">
            <TextArea
              value={form.notes}
              onChange={(event) => updateForm('notes', event.target.value)}
            />
          </FormField>
          <button type="submit" className="hidden">Submit expense</button>
        </form>
      </Modal>

      <ConfirmVoidDialog
        isOpen={voidDialogOpen}
        onConfirm={confirmVoid}
        onCancel={() => {
          setVoidDialogOpen(false);
          setTransactionToVoid(null);
        }}
      />
    </div>
  );
}
