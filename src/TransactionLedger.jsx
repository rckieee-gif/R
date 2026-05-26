import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { API_BASE } from './api';
import QuickEntryBox from './Components/Ledger/QuickEntryBox';
import TransactionForm from './Components/Ledger/TransactionForm';
import TransactionTable from './Components/Ledger/TransactionTable';
import { useStore, useVisibleTransactions, useVisibleActiveBatch, usePermissions } from './useStore';

const transactionSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  building: z.string().min(1, 'Building is required'),
  fundingNature: z.string().min(1, 'Funding nature is required'),
  category: z.string().min(1, 'Category is required'),
  transactionType: z.enum(['Expense', 'Income', 'Adjustment', 'Reimbursement', 'Payment']),
  reference: z.string().optional().or(z.literal('')),
  description: z.string().trim().min(1, 'Description is required'),
  feedItemId: z.string().optional().or(z.literal('')),
  quantity: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().nonnegative('Quantity must be non-negative').optional()
  ),
  unitCost: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().nonnegative('Unit cost must be non-negative').optional()
  ),
  amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().positive('Amount must be positive')
  ),
  paidBy: z.string().min(1, 'Paid by is required'),
  paidTo: z.string().optional().or(z.literal('')),
  remarks: z.string().optional().or(z.literal('')),
});


function groupCategories(categories) {
  return categories.reduce((groups, category) => {
    const key = category.fundingNature;
    if (!groups[key]) groups[key] = [];
    groups[key].push(category.name);
    return groups;
  }, {});
}

function suggestTransactionType(fundingNature, category = '') {
  if (fundingNature === 'Revenue') return 'Income';
  if (/deficit|adjust|advance/i.test(category)) return 'Adjustment';
  if (/reimburse/i.test(category)) return 'Reimbursement';
  if (/payment|paid/i.test(category)) return 'Payment';
  return 'Expense';
}

function normalizeStakeholderName(name) {
  const cleaned = String(name || '').trim();
  return cleaned === 'Yanyan' ? 'Others' : cleaned;
}

function normalizeSearchValue(value) {
  return String(value ?? '').toLowerCase();
}

function getTransactionDateValue(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return '';
  return parsedDate.toISOString().slice(0, 10);
}

function formatLedgerMoney(amount) {
  return `PHP ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function getUniqueOptions(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function uniqueStakeholders(stakeholders) {
  const seen = new Set();
  return stakeholders.reduce((list, stakeholder) => {
    const name = normalizeStakeholderName(stakeholder.name);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return list;
    seen.add(key);
    list.push({ ...stakeholder, name });
    return list;
  }, []);
}

function mergeStakeholderNames(stakeholders, names) {
  const merged = uniqueStakeholders(stakeholders);
  const seen = new Set(merged.map((stakeholder) => stakeholder.name.toLowerCase()));

  names
    .map(normalizeStakeholderName)
    .filter(Boolean)
    .forEach((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({ id: `saved-${key}`, name, type: 'Other' });
    });

  return merged;
}

async function fetchStakeholders(headers) {
  const response = await fetch(`${API_BASE}/api/stakeholders`, { headers });
  if (!response.ok) {
    throw new Error('Failed to load stakeholder data.');
  }

  return uniqueStakeholders(await response.json());
}

export default function TransactionLedger() {
  const token = useStore((state) => state.token);
  const activeBatch = useVisibleActiveBatch();
  const transactions = useVisibleTransactions();
  const setTransactionState = useStore((state) => state.setTransactionState);
  const { canManageOperations, canEditOrDelete } = usePermissions();
  const readOnly = !canManageOperations;

  const setTransactions = (value) => {
    if (!activeBatch?.id) return;
    const currentRows = useStore.getState().transactionState.rows;
    const nextRows = typeof value === 'function' ? value(currentRows) : value;
    setTransactionState({
      batchId: activeBatch.id,
      rows: Array.isArray(nextRows) ? nextRows : []
    });
  };
  const [buildings, setBuildings] = useState(['All']);
  const [categoriesByFunding, setCategoriesByFunding] = useState({});
  const [stakeholders, setStakeholders] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const { register, handleSubmit: hookSubmit, watch, control, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      building: 'All',
      fundingNature: '',
      category: '',
      transactionType: 'Expense',
      reference: '',
      description: '',
      feedItemId: '',
      quantity: '',
      unitCost: '',
      amount: '',
      paidBy: '',
      paidTo: '',
      remarks: ''
    }
  });

  const watchedValues = useWatch({ control }) || {};
  const date = watchedValues.date;
  const building = watchedValues.building;
  const transactionType = watchedValues.transactionType;
  const fundingNature = watchedValues.fundingNature;
  const category = watchedValues.category;
  const feedItemId = watchedValues.feedItemId;
  const description = watchedValues.description;
  const quantity = watchedValues.quantity;
  const unitCost = watchedValues.unitCost;
  const amount = watchedValues.amount;
  const paidBy = watchedValues.paidBy;
  const paidTo = watchedValues.paidTo;
  const reference = watchedValues.reference;
  const remarks = watchedValues.remarks;

  const [quickEntryText, setQuickEntryText] = useState('');
  const [quickEntryStatus, setQuickEntryStatus] = useState('');
  const [pendingQuickEntry, setPendingQuickEntry] = useState(null);
  const [isParsingQuickEntry, setIsParsingQuickEntry] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFundingFilter, setLedgerFundingFilter] = useState('all');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all');
  const [ledgerBuildingFilter, setLedgerBuildingFilter] = useState('all');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('all');
  const [ledgerDateFrom, setLedgerDateFrom] = useState('');
  const [ledgerDateTo, setLedgerDateTo] = useState('');
  const signedOutLedgerMessage = !token
    ? 'Please sign in again so the ledger can load dropdown data.'
    : '';

  const fundingNatures = useMemo(
    () => Object.keys(categoriesByFunding),
    [categoriesByFunding]
  );

  const payerOptions = useMemo(() => {
    const list = stakeholders.map((stakeholder) => stakeholder.name);
    if (paidBy && !list.includes(paidBy)) {
      list.push(paidBy);
    }
    return list;
  }, [stakeholders, paidBy]);

  const payeeOptions = useMemo(() => {
    const list = stakeholders.map((stakeholder) => stakeholder.name);
    if (paidTo && !list.includes(paidTo)) {
      list.push(paidTo);
    }
    return list;
  }, [stakeholders, paidTo]);

  const hasCalculatedAmount = quantity !== '' && quantity !== undefined && unitCost !== '' && unitCost !== undefined;
  const calculatedAmount = useMemo(() => {
    if (!hasCalculatedAmount) return null;
    return Number((Number(quantity || 0) * Number(unitCost || 0)).toFixed(2));
  }, [hasCalculatedAmount, quantity, unitCost]);

  const isFeedLedgerRecord = category === 'Feed'
    && ['OPEX', 'CAPEX', 'CAPEX-Recoverable'].includes(fundingNature)
    && transactionType === 'Expense';
  const selectedFeedItemId = isFeedLedgerRecord
    ? (feedItemId || (feedItems[0]?.id ? String(feedItems[0].id) : ''))
    : feedItemId;

  useEffect(() => {
    if (calculatedAmount !== null) {
      setValue('amount', String(calculatedAmount), { shouldValidate: true });
    }
  }, [calculatedAmount, setValue]);

  const ledgerFilterOptions = useMemo(() => ({
    buildings: getUniqueOptions(transactions.map((tx) => tx.building || 'All')),
    categories: getUniqueOptions(transactions.map((tx) => tx.category)),
    fundingNatures: getUniqueOptions(transactions.map((tx) => tx.fundingNature)),
    types: getUniqueOptions(transactions.map((tx) => tx.type))
  }), [transactions]);

  const filteredTransactions = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase();

    return transactions.filter((tx) => {
      const txDate = getTransactionDateValue(tx.date);

      if (ledgerDateFrom && (!txDate || txDate < ledgerDateFrom)) return false;
      if (ledgerDateTo && (!txDate || txDate > ledgerDateTo)) return false;
      if (ledgerFundingFilter !== 'all' && tx.fundingNature !== ledgerFundingFilter) return false;
      if (ledgerTypeFilter !== 'all' && tx.type !== ledgerTypeFilter) return false;
      if (ledgerBuildingFilter !== 'all' && (tx.building || 'All') !== ledgerBuildingFilter) return false;
      if (ledgerCategoryFilter !== 'all' && tx.category !== ledgerCategoryFilter) return false;

      if (!query) return true;

      return [
        tx.id,
        tx.date,
        tx.building,
        tx.type,
        tx.fundingNature,
        tx.category,
        tx.description,
        tx.paidBy,
        tx.paidTo,
        tx.reference,
        tx.remarks,
        tx.feedItemName,
        Number(tx.amount || 0).toFixed(2)
      ].some((value) => normalizeSearchValue(value).includes(query));
    });
  }, [
    transactions,
    ledgerSearch,
    ledgerDateFrom,
    ledgerDateTo,
    ledgerFundingFilter,
    ledgerTypeFilter,
    ledgerBuildingFilter,
    ledgerCategoryFilter
  ]);

  const ledgerSummary = useMemo(() => {
    return filteredTransactions.reduce((summary, tx) => {
      const amountValue = Number(tx.amount || 0);
      if (tx.fundingNature === 'Revenue') {
        summary.revenue += amountValue;
      } else {
        summary.outflow += amountValue;
      }
      summary.entryCount += 1;
      return summary;
    }, { entryCount: 0, revenue: 0, outflow: 0 });
  }, [filteredTransactions]);

  const ledgerNetTotal = ledgerSummary.revenue - ledgerSummary.outflow;
  const hasLedgerFilters = Boolean(
    ledgerSearch.trim()
    || ledgerFundingFilter !== 'all'
    || ledgerTypeFilter !== 'all'
    || ledgerBuildingFilter !== 'all'
    || ledgerCategoryFilter !== 'all'
    || ledgerDateFrom
    || ledgerDateTo
  );

  const resetLedgerFilters = () => {
    setLedgerSearch('');
    setLedgerFundingFilter('all');
    setLedgerTypeFilter('all');
    setLedgerBuildingFilter('all');
    setLedgerCategoryFilter('all');
    setLedgerDateFrom('');
    setLedgerDateTo('');
  };


  useEffect(() => {
    if (!token) {
      return;
    }

    const fetchMasterData = async () => {
      setIsLoadingMasters(true);
      setError('');

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [buildingResponse, categoryResponse, nextStakeholders, feedResponse] = await Promise.all([
          fetch(`${API_BASE}/api/buildings`, { headers }),
          fetch(`${API_BASE}/api/categories`, { headers }),
          fetchStakeholders(headers),
          fetch(`${API_BASE}/api/inventory/items?category=Feed`, { headers })
        ]);

        if (!buildingResponse.ok || !categoryResponse.ok || !feedResponse.ok) {
          throw new Error('Failed to load ledger dropdown data.');
        }

        const [buildingData, categoryData, feedData] = await Promise.all([
          buildingResponse.json(),
          categoryResponse.json(),
          feedResponse.json()
        ]);

        const nextBuildings = ['All', ...buildingData.map((item) => item.name)];
        const nextCategories = groupCategories(categoryData);
        const nextFundingNature = nextCategories.OPEX ? 'OPEX' : Object.keys(nextCategories)[0] || '';
        const rolly = nextStakeholders.find((item) => item.name === 'Rolly');

        setBuildings(nextBuildings);
        setCategoriesByFunding(nextCategories);
        setStakeholders(nextStakeholders);
        setFeedItems(feedData);
        if (!editingId) {
          setValue('building', 'All');
          setValue('fundingNature', nextFundingNature);
          setValue('category', nextCategories[nextFundingNature]?.[0] || '');
          setValue('feedItemId', feedData[0]?.id ? String(feedData[0].id) : '');
          setValue('paidBy', rolly?.name || nextStakeholders[0]?.name || '');
          setValue('paidTo', '');
        }
      } catch (err) {
        console.error(err);
        setError('Could not load ledger dropdowns from the server.');
      } finally {
        setIsLoadingMasters(false);
      }
    };

    fetchMasterData();
  }, [token, editingId, setValue]);

  const handleFundingChange = (e) => {
    const newNature = e.target.value;
    const nextCategory = categoriesByFunding[newNature]?.[0] || '';
    setValue('fundingNature', newNature, { shouldValidate: true });
    setValue('category', nextCategory, { shouldValidate: true });
    setValue('transactionType', suggestTransactionType(newNature, nextCategory), { shouldValidate: true });
  };

  const handleCategoryChange = (e) => {
    const nextCategory = e.target.value;
    setValue('category', nextCategory, { shouldValidate: true });
    setValue('transactionType', suggestTransactionType(fundingNature, nextCategory), { shouldValidate: true });
  };

  const buildLedgerDraftFromQuickEntry = (parsed) => {
    const nextFundingNature = parsed.fundingNature || fundingNature;
    const availableCategories = categoriesByFunding[nextFundingNature] || [];
    const nextCategory = availableCategories.includes(parsed.category)
      ? parsed.category
      : availableCategories[0] || parsed.category || '';

    return {
      date: parsed.date || date,
      building: parsed.building || 'All',
      fundingNature: nextFundingNature,
      category: nextCategory,
      transactionType: parsed.type || suggestTransactionType(nextFundingNature, nextCategory),
      description: parsed.description || '',
      quantity: parsed.amountSource === 'quantity_x_unit_price' && parsed.quantity != null ? String(parsed.quantity) : '',
      unitCost: parsed.amountSource === 'quantity_x_unit_price' && parsed.unitPrice != null ? String(parsed.unitPrice) : '',
      amount: parsed.amount == null ? '' : String(parsed.amount),
      paidBy: normalizeStakeholderName(parsed.paidBy || paidBy),
      paidTo: normalizeStakeholderName(parsed.paidTo || paidTo),
      reference: parsed.reference || '',
      remarks: parsed.remarks || `Quick entry: ${parsed.originalText || quickEntryText}`,
    };
  };

  const getCurrentLedgerDraft = () => ({
    date,
    building,
    fundingNature,
    category,
    transactionType,
    description,
    quantity,
    unitCost,
    amount,
    paidBy,
    paidTo,
    reference,
    remarks,
  });

  const getQuickEntryReplacementRows = (parsed) => {
    const current = getCurrentLedgerDraft();
    const next = buildLedgerDraftFromQuickEntry(parsed);
    const labels = {
      date: 'Date',
      building: 'Building',
      fundingNature: 'Funding Nature',
      category: 'Category',
      transactionType: 'Transaction Type',
      description: 'Description',
      quantity: 'Quantity',
      unitCost: 'Unit Cost',
      amount: 'Amount',
      paidBy: 'Paid By',
      paidTo: 'Paid To',
      reference: 'Reference',
      remarks: 'Remarks',
    };

    return Object.keys(labels)
      .map((key) => ({
        key,
        label: labels[key],
        from: current[key] || '--',
        to: next[key] || '--',
      }))
      .filter((row) => row.from !== row.to);
  };

  const applyParsedQuickEntry = (parsed) => {
    const next = buildLedgerDraftFromQuickEntry(parsed);

    setValue('date', next.date, { shouldValidate: true });
    setValue('building', next.building, { shouldValidate: true });
    setValue('fundingNature', next.fundingNature, { shouldValidate: true });
    setValue('category', next.category, { shouldValidate: true });
    setValue('transactionType', next.transactionType, { shouldValidate: true });
    setValue('description', next.description, { shouldValidate: true });
    setValue('quantity', next.quantity, { shouldValidate: true });
    setValue('unitCost', next.unitCost, { shouldValidate: true });
    setValue('amount', next.amount, { shouldValidate: true });
    setValue('paidBy', next.paidBy, { shouldValidate: true });
    setValue('paidTo', next.paidTo, { shouldValidate: true });
    setValue('reference', next.reference, { shouldValidate: true });
    setValue('remarks', next.remarks, { shouldValidate: true });
  };

  const refreshStakeholders = async (fallbackNames = []) => {
    const names = fallbackNames.map(normalizeStakeholderName).filter(Boolean);
    if (names.length > 0) {
      setStakeholders((current) => mergeStakeholderNames(current, names));
    }

    try {
      const nextStakeholders = await fetchStakeholders({ Authorization: `Bearer ${token}` });
      setStakeholders(mergeStakeholderNames(nextStakeholders, names));
    } catch (err) {
      console.warn('Failed to refresh stakeholder dropdown data:', err);
      if (names.length > 0) {
        setStakeholders((current) => mergeStakeholderNames(current, names));
      }
    }
  };

  const confirmApplyQuickEntry = () => {
    if (!pendingQuickEntry?.parsed) return;

    const replacementRows = getQuickEntryReplacementRows(pendingQuickEntry.parsed);
    const rundown = replacementRows.length
      ? replacementRows.map((row) => `${row.label}: ${row.from} -> ${row.to}`).join('\n')
      : 'No ledger fields will change.';
    const confirmed = window.confirm(`Send this parsed entry to the ledger form?\n\n${rundown}`);

    if (!confirmed) return;

    applyParsedQuickEntry(pendingQuickEntry.parsed);
    setQuickEntryStatus('Parsed entry sent to the ledger form. Review it, then save the record.');
    setPendingQuickEntry(null);
  };

  const handleQuickEntryParse = async () => {
    setError('');
    setQuickEntryStatus('');
    setPendingQuickEntry(null);

    if (!quickEntryText.trim()) {
      setQuickEntryStatus('Enter transaction text first.');
      return;
    }

    setIsParsingQuickEntry(true);

    try {
      const response = await fetch(`${API_BASE}/api/quick-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: quickEntryText,
          today: date,
          building,
          paidBy
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setQuickEntryStatus(data.error || 'Could not parse quick entry.');
        return;
      }

      setPendingQuickEntry(data);
      setQuickEntryStatus(
        `${data.parserMode === 'gemini' ? 'Gemini AI' : data.parserMode === 'openai' ? 'OpenAI' : 'Rules'} parsed with ${Math.round(Number(data.parsed.confidence || 0) * 100)}% confidence${data.needsReview ? ' - review before sending to the form' : ''}.`
      );
    } catch (err) {
      console.error('Failed to parse quick entry:', err);
      setQuickEntryStatus('Cannot connect to quick-entry parser.');
    } finally {
      setIsParsingQuickEntry(false);
    }
  };

  const resetForm = ({ stakeholderNames = [] } = {}) => {
    if (stakeholderNames.length > 0) {
      setStakeholders((current) => mergeStakeholderNames(current, stakeholderNames));
    }
    setEditingId(null);
    reset({
      date: new Date().toISOString().split('T')[0],
      building: 'All',
      fundingNature: fundingNatures[0] || '',
      category: categoriesByFunding[fundingNatures[0]]?.[0] || '',
      transactionType: 'Expense',
      reference: '',
      description: '',
      feedItemId: feedItems[0]?.id ? String(feedItems[0].id) : '',
      quantity: '',
      unitCost: '',
      amount: '',
      paidBy: stakeholders[0]?.name || '',
      paidTo: '',
      remarks: ''
    });
    setQuickEntryStatus('');
    setPendingQuickEntry(null);
    setError('');
  };

  const onSave = async (formData) => {
    setError('');

    if (readOnly) {
      setError('Your role can view ledger records but cannot save changes.');
      return;
    }

    if (editingId && !canEditOrDelete) {
      setError('Only admin.roland can edit existing ledger records.');
      return;
    }

    if (!activeBatch?.id) {
      setError('Please select an active batch before saving a ledger record.');
      return;
    }

    if (isFeedLedgerRecord && (!formData.feedItemId || Number(formData.quantity || 0) <= 0)) {
      setError('Feed delivery entries need a feed inventory item and quantity in sacks.');
      return;
    }

    const newTxData = {
      batchId: activeBatch.id,
      date: formData.date,
      building: formData.building,
      type: formData.transactionType,
      fundingNature: formData.fundingNature,
      category: formData.category,
      description: formData.description,
      quantity: formData.quantity === '' || formData.quantity === undefined ? undefined : parseFloat(formData.quantity),
      unitCost: formData.unitCost === '' || formData.unitCost === undefined ? undefined : parseFloat(formData.unitCost),
      amount: hasCalculatedAmount ? (calculatedAmount != null ? calculatedAmount : 0) : parseFloat(formData.amount),
      paidBy: formData.paidBy,
      paidTo: formData.paidTo || '',
      reference: formData.reference || '',
      remarks: formData.remarks || '',
      feedItemId: isFeedLedgerRecord ? selectedFeedItemId : null
    };

    try {
      const url = editingId
        ? `${API_BASE}/api/batches/${activeBatch.id}/transactions/${editingId}`
        : `${API_BASE}/api/batches/${activeBatch.id}/transactions`;

      const response = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newTxData)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save transaction.');
        return;
      }

      const savedStakeholderNames = [
        newTxData.paidBy,
        newTxData.paidTo,
        data.paidBy,
        data.paidTo
      ];

      if (editingId) {
        setTransactions((currentTransactions) => currentTransactions.map((tx) => tx.id === editingId ? data : tx));
      } else {
        setTransactions((currentTransactions) => [data, ...currentTransactions]);
      }
      resetForm({ stakeholderNames: savedStakeholderNames });
      refreshStakeholders(savedStakeholderNames);
    } catch (err) {
      console.error('Failed to save transaction:', err);
      setError('Cannot connect to server.');
    }
  };

  const handleEditClick = (tx) => {
    if (!canEditOrDelete) return;

    setEditingId(tx.id);
    reset({
      date: new Date(tx.date).toISOString().split('T')[0],
      building: tx.building || 'All',
      fundingNature: tx.fundingNature,
      category: tx.category,
      transactionType: tx.type || suggestTransactionType(tx.fundingNature, tx.category),
      feedItemId: tx.feedItemId ? String(tx.feedItemId) : '',
      description: tx.description,
      quantity: tx.quantity == null ? '' : String(tx.quantity),
      unitCost: tx.unitCost == null ? '' : String(tx.unitCost),
      amount: tx.amount.toString(),
      paidBy: normalizeStakeholderName(tx.paidBy || ''),
      paidTo: normalizeStakeholderName(tx.paidTo || ''),
      reference: tx.reference || '',
      remarks: tx.remarks || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTransaction = async (idToDelete) => {
    if (readOnly || !canEditOrDelete) return;

    const reason = window.prompt('Reason for voiding this transaction?');

    if (!reason) return;

    try {
      const response = await fetch(`${API_BASE}/api/batches/${activeBatch.id}/transactions/${idToDelete}/void`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to void transaction.');
        return;
      }

      setTransactions(transactions.filter((tx) => tx.id !== idToDelete));
      if (editingId === idToDelete) resetForm();
    } catch (err) {
      console.error('Failed to void transaction:', err);
      setError('Cannot connect to server.');
    }
  };

  return (
    <div className="print-container report-page">
      <div className="mb-6 mt-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="print-title text-3xl font-extrabold text-app-text tracking-tight font-hanken">
              Ledger Entry
            </h2>
            <p className="text-app-text-secondary text-sm mt-1">
              {activeBatch?.id ? `Batch ${activeBatch.id}` : 'Select a batch before saving records.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print px-3 py-2 rounded-xl bg-app-accent text-app-on-accent text-xs font-black shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
          >
            Print
          </button>
        </div>
      </div>

      {signedOutLedgerMessage && (
        <div className="bg-app-danger-bg text-app-danger p-3 rounded-xl text-sm font-bold mb-4 border border-app-danger">
          {signedOutLedgerMessage}
        </div>
      )}

      {readOnly && (
        <div className="no-print bg-app-success-bg border border-app-accent rounded-xl p-3 mb-6">
          <p className="text-xs font-black uppercase tracking-wider text-app-accent">Read-only access</p>
          <p className="text-sm font-bold text-app-text-secondary mt-1">
            You can review ledger records. Changes are restricted to operation managers and owners.
          </p>
        </div>
      )}

      <div className={`${readOnly ? '' : 'lg:grid lg:grid-cols-[minmax(360px,480px)_minmax(0,1fr)] lg:items-start lg:gap-6'}`}>
        {!readOnly && (
          <div className={`no-print bg-app-card p-5 rounded-2xl shadow-sm border-2 transition-colors duration-300 mb-6 lg:sticky lg:top-24 lg:mb-0 ${editingId ? 'border-app-accent' : 'border-app-border'}`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 border-b pb-2 ${editingId ? 'text-app-accent border-app-accent/30' : 'text-app-text-secondary border-app-border/40'}`}>
              {editingId ? 'Editing Record' : 'New Finance Record'}
            </h3>

            {error && (
              <div className="bg-app-danger-bg text-app-danger p-3 rounded-xl text-sm font-bold mb-4 border border-app-danger">
                {error}
              </div>
            )}

            {isLoadingMasters && (
              <p className="text-xs text-app-text-secondary mb-4">Loading dropdowns...</p>
            )}

            <div className="space-y-4">
              <QuickEntryBox
                quickEntryText={quickEntryText}
                setQuickEntryText={setQuickEntryText}
                quickEntryStatus={quickEntryStatus}
                setQuickEntryStatus={setQuickEntryStatus}
                pendingQuickEntry={pendingQuickEntry}
                setPendingQuickEntry={setPendingQuickEntry}
                isParsingQuickEntry={isParsingQuickEntry}
                handleQuickEntryParse={handleQuickEntryParse}
                confirmApplyQuickEntry={confirmApplyQuickEntry}
                getQuickEntryReplacementRows={getQuickEntryReplacementRows}
              />

              <TransactionForm
                handleSubmit={hookSubmit(onSave)}
                register={register}
                errors={errors}
                watch={watch}
                buildings={buildings}
                fundingNatures={fundingNatures}
                categoriesByFunding={categoriesByFunding}
                feedItems={feedItems}
                payerOptions={payerOptions}
                payeeOptions={payeeOptions}
                editingId={editingId}
                resetForm={resetForm}
                handleFundingChange={handleFundingChange}
                handleCategoryChange={handleCategoryChange}
                hasCalculatedAmount={hasCalculatedAmount}
                isFeedLedgerRecord={isFeedLedgerRecord}
                feedItemId={selectedFeedItemId}
              />
            </div>
          </div>
        )}

        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="bg-app-card border border-app-border rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Visible Entries</p>
              <p className="mt-2 text-2xl font-black text-app-text font-jetbrains">
                {ledgerSummary.entryCount.toLocaleString()}
              </p>
              <p className="text-[11px] font-bold text-app-text-secondary font-jetbrains">
                of {transactions.length.toLocaleString()} total
              </p>
            </div>
            <div className="bg-app-card border border-app-border rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Revenue</p>
              <p className="mt-2 text-lg font-black text-app-success font-jetbrains">
                {formatLedgerMoney(ledgerSummary.revenue)}
              </p>
            </div>
            <div className="bg-app-card border border-app-border rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Outflow</p>
              <p className="mt-2 text-lg font-black text-app-danger font-jetbrains">
                {formatLedgerMoney(ledgerSummary.outflow)}
              </p>
            </div>
            <div className="bg-app-card border border-app-border rounded-xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Net</p>
              <p className={`mt-2 text-lg font-black font-jetbrains ${ledgerNetTotal >= 0 ? 'text-app-success' : 'text-app-danger'}`}>
                {formatLedgerMoney(ledgerNetTotal)}
              </p>
            </div>
          </div>

          <div className="no-print bg-app-card border border-app-border rounded-xl p-4 shadow-sm">
            <div className="grid gap-3 xl:grid-cols-[minmax(240px,1.2fr)_repeat(3,minmax(140px,0.7fr))]">
              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">
                  Entry Search
                </span>
                <input
                  type="search"
                  value={ledgerSearch}
                  onChange={(event) => setLedgerSearch(event.target.value)}
                  placeholder="Search description, ref, payee, amount..."
                  className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-bg text-sm font-bold text-app-text outline-none focus:ring-2 focus:ring-app-accent/20"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">
                  Funding
                </span>
                <select
                  value={ledgerFundingFilter}
                  onChange={(event) => setLedgerFundingFilter(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-bg text-sm font-bold text-app-text outline-none focus:ring-2 focus:ring-app-accent/20"
                >
                  <option value="all">All funding</option>
                  {ledgerFilterOptions.fundingNatures.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">
                  Type
                </span>
                <select
                  value={ledgerTypeFilter}
                  onChange={(event) => setLedgerTypeFilter(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-bg text-sm font-bold text-app-text outline-none focus:ring-2 focus:ring-app-accent/20"
                >
                  <option value="all">All types</option>
                  {ledgerFilterOptions.types.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">
                  Building
                </span>
                <select
                  value={ledgerBuildingFilter}
                  onChange={(event) => setLedgerBuildingFilter(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-bg text-sm font-bold text-app-text outline-none focus:ring-2 focus:ring-app-accent/20"
                >
                  <option value="all">All buildings</option>
                  {ledgerFilterOptions.buildings.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(140px,0.7fr))_auto] xl:items-end">
              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">
                  Category
                </span>
                <select
                  value={ledgerCategoryFilter}
                  onChange={(event) => setLedgerCategoryFilter(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-bg text-sm font-bold text-app-text outline-none focus:ring-2 focus:ring-app-accent/20"
                >
                  <option value="all">All categories</option>
                  {ledgerFilterOptions.categories.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">
                  From
                </span>
                <input
                  type="date"
                  value={ledgerDateFrom}
                  onChange={(event) => setLedgerDateFrom(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-bg text-sm font-bold text-app-text outline-none focus:ring-2 focus:ring-app-accent/20"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">
                  To
                </span>
                <input
                  type="date"
                  value={ledgerDateTo}
                  onChange={(event) => setLedgerDateTo(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-bg text-sm font-bold text-app-text outline-none focus:ring-2 focus:ring-app-accent/20"
                />
              </label>

              <button
                type="button"
                onClick={resetLedgerFilters}
                disabled={!hasLedgerFilters}
                className="h-10 px-4 rounded-lg bg-app-accent text-app-on-accent text-xs font-black uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          <TransactionTable
            transactions={filteredTransactions}
            editingId={editingId}
            readOnly={readOnly}
            canEditOrDelete={canEditOrDelete}
            handleEditClick={handleEditClick}
            handleDeleteTransaction={handleDeleteTransaction}
            heading="Ledger Records"
            emptyMessage={hasLedgerFilters ? 'No ledger entries match your search or filters.' : 'No transactions logged yet.'}
          />
        </div>
      </div>
    </div>
  );
}
