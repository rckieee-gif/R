import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../shared/utils/apiClient';
import QuickEntryBox from './components/QuickEntryBox';
import TransactionForm from './components/TransactionForm';
import TransactionTable from './components/TransactionTable';
import { useNotification } from '../../shared/hooks/useNotification';
import { transactionSchema } from './transactionSchemas';
import ConfirmVoidDialog from '../../shared/components/ConfirmVoidDialog';


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

async function fetchStakeholders() {
  const data = await apiClient.get('/api/stakeholders', { expectArray: true });
  return uniqueStakeholders(data);
}

export default function TransactionLedger({ transactions, setTransactions, activeBatch, token, readOnly = false, canEditOrDelete = false }) {
  const { success, error: toastError, confirm } = useNotification();

  const [buildings, setBuildings] = useState(['All']);
  const [categoriesByFunding, setCategoriesByFunding] = useState({});
  const [stakeholders, setStakeholders] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [building, setBuilding] = useState('All');
  const [transactionType, setTransactionType] = useState('Expense');
  const [fundingNature, setFundingNature] = useState('');
  const [category, setCategory] = useState('');
  const [feedItemId, setFeedItemId] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [quickEntryText, setQuickEntryText] = useState('');
  const [quickEntryStatus, setQuickEntryStatus] = useState('');
  const [pendingQuickEntry, setPendingQuickEntry] = useState(null);
  const [isParsingQuickEntry, setIsParsingQuickEntry] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFundingFilter, setLedgerFundingFilter] = useState('all');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all');
  const [ledgerBuildingFilter, setLedgerBuildingFilter] = useState('all');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('all');
  const [ledgerDateFrom, setLedgerDateFrom] = useState('');
  const [ledgerDateTo, setLedgerDateTo] = useState('');
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [transactionToVoid, setTransactionToVoid] = useState(null);
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

  const hasCalculatedAmount = quantity !== '' && unitCost !== '';
  const calculatedAmount = hasCalculatedAmount
    ? Number((Number(quantity || 0) * Number(unitCost || 0)).toFixed(2))
    : null;
  const displayedAmount = hasCalculatedAmount ? calculatedAmount.toFixed(2) : amount;
  const isFeedLedgerRecord = category === 'Feed'
    && ['OPEX', 'CAPEX', 'CAPEX-Recoverable'].includes(fundingNature)
    && transactionType === 'Expense';
  const selectedFeedItemId = isFeedLedgerRecord
    ? (feedItemId || (feedItems[0]?.id ? String(feedItems[0].id) : ''))
    : feedItemId;

  const ledgerFilterOptions = useMemo(() => ({
    buildings: getUniqueOptions(transactions.map((tx) => tx.building || 'All')),
    categories: getUniqueOptions(transactions.map((tx) => tx.category)),
    fundingNatures: getUniqueOptions(transactions.map((tx) => tx.fundingNature)),
    types: getUniqueOptions(transactions.map((tx) => tx.type))
  }), [transactions]);

  const filteredTransactions = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase();

    const res = transactions.filter((tx) => {
      const txDate = getTransactionDateValue(tx.date);

      if (ledgerDateFrom && (!txDate || txDate < ledgerDateFrom)) return false;
      if (ledgerDateTo && (!txDate || txDate > ledgerDateTo)) return false;
      if (ledgerFundingFilter !== 'all' && tx.fundingNature !== ledgerFundingFilter) return false;
      if (ledgerTypeFilter !== 'all' && tx.type !== ledgerTypeFilter) return false;
      if (ledgerBuildingFilter !== 'all' && (tx.building || 'All') !== ledgerBuildingFilter) return false;
      if (ledgerCategoryFilter !== 'all' && tx.category !== ledgerCategoryFilter) return false;

      if (!query) return true;

      const result = [
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
      return result;
    });
    return res;
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

      try {
        const [buildingData, categoryData, nextStakeholders, feedData] = await Promise.all([
          apiClient.get('/api/buildings', { expectArray: true }),
          apiClient.get('/api/categories', { expectArray: true }),
          fetchStakeholders(),
          apiClient.get('/api/inventory/items?category=Feed', { expectArray: true })
        ]);

        const nextBuildings = ['All', ...buildingData.map((item) => item.name)];
        const nextCategories = groupCategories(categoryData);
        const nextFundingNature = nextCategories.OPEX ? 'OPEX' : Object.keys(nextCategories)[0] || '';
        const rolly = nextStakeholders.find((item) => item.name === 'Rolly');

        setBuildings(nextBuildings);
        setCategoriesByFunding(nextCategories);
        setStakeholders(nextStakeholders);
        setFeedItems(feedData);
        setBuilding((current) => nextBuildings.includes(current) ? current : 'All');
        setFundingNature((current) => current && nextCategories[current] ? current : nextFundingNature);
        setCategory((current) => {
          if (current && Object.values(nextCategories).some((items) => items.includes(current))) return current;
          return nextCategories[nextFundingNature]?.[0] || '';
        });
        setFeedItemId((current) => current || (feedData[0]?.id ? String(feedData[0].id) : ''));
        setPaidBy((current) => normalizeStakeholderName(current) || rolly?.name || nextStakeholders[0]?.name || '');
        setPaidTo((current) => normalizeStakeholderName(current));
      } catch (err) {
        console.error(err);
        toastError('Could not load ledger dropdowns from the server.');
      } finally {
        setIsLoadingMasters(false);
      }
    };

    fetchMasterData();
  }, [token, toastError]);

  const handleFundingChange = (e) => {
    const newNature = e.target.value;
    const nextCategory = categoriesByFunding[newNature]?.[0] || '';
    setFundingNature(newNature);
    setCategory(nextCategory);
    setTransactionType(suggestTransactionType(newNature, nextCategory));
  };

  const handleCategoryChange = (e) => {
    const nextCategory = e.target.value;
    setCategory(nextCategory);
    setTransactionType(suggestTransactionType(fundingNature, nextCategory));
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

    setDate(next.date);
    setBuilding(next.building);
    setFundingNature(next.fundingNature);
    setCategory(next.category);
    setTransactionType(next.transactionType);
    setDescription(next.description);
    setQuantity(next.quantity);
    setUnitCost(next.unitCost);
    setAmount(next.amount);
    setPaidBy(next.paidBy);
    setPaidTo(next.paidTo);
    setReference(next.reference);
    setRemarks(next.remarks);
  };

  const refreshStakeholders = async (fallbackNames = []) => {
    const names = fallbackNames.map(normalizeStakeholderName).filter(Boolean);
    if (names.length > 0) {
      setStakeholders((current) => mergeStakeholderNames(current, names));
    }

    try {
      const nextStakeholders = await fetchStakeholders();
      setStakeholders(mergeStakeholderNames(nextStakeholders, names));
    } catch (err) {
      console.warn('Failed to refresh stakeholder dropdown data:', err);
      if (names.length > 0) {
        setStakeholders((current) => mergeStakeholderNames(current, names));
      }
    }
  };

  const confirmApplyQuickEntry = async () => {
    if (!pendingQuickEntry?.parsed) return;

    const replacementRows = getQuickEntryReplacementRows(pendingQuickEntry.parsed);
    const rundown = replacementRows.length
      ? replacementRows.map((row) => `${row.label}: ${row.from} -> ${row.to}`).join('\n')
      : 'No ledger fields will change.';
    
    const confirmed = await confirm({
      title: 'Apply Quick Entry',
      message: `Send this parsed entry to the ledger form?\n\n${rundown}`
    });

    if (!confirmed) return;

    applyParsedQuickEntry(pendingQuickEntry.parsed);
    setQuickEntryStatus('Parsed entry sent to the ledger form. Review it, then save the record.');
    setPendingQuickEntry(null);
  };

  const handleQuickEntryParse = async () => {
    setQuickEntryStatus('');
    setPendingQuickEntry(null);

    if (!quickEntryText.trim()) {
      setQuickEntryStatus('Enter transaction text first.');
      return;
    }

    setIsParsingQuickEntry(true);

    try {
      const data = await apiClient.post('/api/quick-entry', {
        text: quickEntryText,
        today: date,
        building,
        paidBy
      });

      setPendingQuickEntry(data);
      setQuickEntryStatus(
        `${data.parserMode === 'gemini' ? 'Gemini AI' : data.parserMode === 'openai' ? 'OpenAI' : 'Rules'} parsed with ${Math.round(Number(data.parsed.confidence || 0) * 100)}% confidence${data.needsReview ? ' - review before sending to the form' : ''}.`
      );
    } catch (err) {
      console.error('Failed to parse quick entry:', err);
      setQuickEntryStatus(err.message || 'Cannot connect to quick-entry parser.');
    } finally {
      setIsParsingQuickEntry(false);
    }
  };

  const resetForm = ({ stakeholderNames = [] } = {}) => {
    if (stakeholderNames.length > 0) {
      setStakeholders((current) => mergeStakeholderNames(current, stakeholderNames));
    }
    setEditingId(null);
    setDescription('');
    setQuantity('');
    setUnitCost('');
    setAmount('');
    setPaidTo('');
    setReference('');
    setRemarks('');
    setQuickEntryStatus('');
    setPendingQuickEntry(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (readOnly) {
      toastError('Your role can view ledger records but cannot save changes.');
      return;
    }

    if (editingId && !canEditOrDelete) {
      toastError('Only admin.roland can edit existing ledger records.');
      return;
    }

    if (!activeBatch?.id) {
      toastError('Please select an active batch before saving a ledger record.');
      return;
    }

    if (!fundingNature || !category) {
      toastError('Funding nature and category are required.');
      return;
    }

    if (isFeedLedgerRecord && (!feedItemId || Number(quantity || 0) <= 0)) {
      toastError('Feed delivery entries need a feed inventory item and quantity in sacks.');
      return;
    }

    const newTxData = {
      batchId: activeBatch.id,
      date,
      building,
      type: transactionType,
      fundingNature,
      category,
      description,
      quantity: quantity === '' ? undefined : parseFloat(quantity),
      unitCost: unitCost === '' ? undefined : parseFloat(unitCost),
      amount: hasCalculatedAmount ? calculatedAmount : parseFloat(amount),
      paidBy,
      paidTo,
      reference,
      remarks,
      feedItemId: isFeedLedgerRecord ? selectedFeedItemId : null
    };

    const result = transactionSchema.safeParse(newTxData);
    if (!result.success) {
      const errorMsg = result.error.errors.map(err => err.message).join('. ');
      toastError(errorMsg);
      return;
    }

    try {
      const url = editingId
        ? `/api/batches/${activeBatch.id}/transactions/${editingId}`
        : `/api/batches/${activeBatch.id}/transactions`;

      const data = editingId
        ? await apiClient.patch(url, newTxData)
        : await apiClient.post(url, newTxData);

      const savedStakeholderNames = [
        newTxData.paidBy,
        newTxData.paidTo,
        data.paidBy,
        data.paidTo
      ];

      if (editingId) {
        setTransactions((currentTransactions) => currentTransactions.map((tx) => tx.id === editingId ? data : tx));
        success('Transaction updated successfully.');
      } else {
        setTransactions((currentTransactions) => [data, ...currentTransactions]);
        success('Transaction created successfully.');
      }
      resetForm({ stakeholderNames: savedStakeholderNames });
      refreshStakeholders(savedStakeholderNames);
    } catch (err) {
      console.error('Failed to save transaction:', err);
      toastError(err.message || 'Cannot connect to server.');
    }
  };

  const handleEditClick = (tx) => {
    if (!canEditOrDelete) return;

    setEditingId(tx.id);
    setDate(new Date(tx.date).toISOString().split('T')[0]);
    setBuilding(tx.building || 'All');
    setTransactionType(tx.type || suggestTransactionType(tx.fundingNature, tx.category));
    setFundingNature(tx.fundingNature);
    setCategory(tx.category);
    setFeedItemId(tx.feedItemId ? String(tx.feedItemId) : '');
    setDescription(tx.description);
    setQuantity(tx.quantity == null ? '' : String(tx.quantity));
    setUnitCost(tx.unitCost == null ? '' : String(tx.unitCost));
    setAmount(tx.amount.toString());
    setPaidBy(normalizeStakeholderName(tx.paidBy || ''));
    setPaidTo(normalizeStakeholderName(tx.paidTo || ''));
    setReference(tx.reference || '');
    setRemarks(tx.remarks || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTransaction = (idToDelete) => {
    if (readOnly || !canEditOrDelete) return;
    setTransactionToVoid(idToDelete);
    setVoidDialogOpen(true);
  };

  const confirmVoid = async (reason) => {
    if (!transactionToVoid) return;
    try {
      await apiClient.post(`/api/batches/${activeBatch.id}/transactions/${transactionToVoid}/void`, { reason });

      setTransactions(transactions.filter((tx) => tx.id !== transactionToVoid));
      if (editingId === transactionToVoid) resetForm();
      success('Transaction voided successfully.');
    } catch (err) {
      console.error('Failed to void transaction:', err);
      toastError(err.message || 'Cannot connect to server.');
    } finally {
      setVoidDialogOpen(false);
      setTransactionToVoid(null);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Building', 'Type', 'Funding Nature', 'Category', 'Description', 'Paid By', 'Paid To', 'Reference', 'Remarks', 'Amount (PHP)'];
    
    const rows = filteredTransactions.map((tx) => [
      new Date(tx.date).toLocaleDateString(),
      tx.building || 'All',
      tx.type,
      tx.fundingNature,
      tx.category,
      `"${String(tx.description || '').replace(/"/g, '""')}"`,
      `"${String(tx.paidBy || '').replace(/"/g, '""')}"`,
      `"${String(tx.paidTo || '').replace(/"/g, '""')}"`,
      `"${String(tx.reference || '').replace(/"/g, '""')}"`,
      `"${String(tx.remarks || '').replace(/"/g, '""')}"`,
      tx.amount
    ]);
    
    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledger_export_${activeBatch?.id || 'all'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <div className="flex gap-2 no-print">
            <button
              type="button"
              onClick={exportToCSV}
              className="px-3 py-2 rounded-xl bg-app-card border border-app-border text-app-text text-xs font-black shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl bg-app-accent text-app-on-accent text-xs font-black shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              Print
            </button>
          </div>
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
                handleSubmit={handleSubmit}
                date={date}
                setDate={setDate}
                building={building}
                setBuilding={setBuilding}
                buildings={buildings}
                fundingNature={fundingNature}
                handleFundingChange={handleFundingChange}
                fundingNatures={fundingNatures}
                category={category}
                handleCategoryChange={handleCategoryChange}
                categoriesByFunding={categoriesByFunding}
                transactionType={transactionType}
                setTransactionType={setTransactionType}
                reference={reference}
                setReference={setReference}
                description={description}
                setDescription={setDescription}
                isFeedLedgerRecord={isFeedLedgerRecord}
                feedItemId={selectedFeedItemId}
                setFeedItemId={setFeedItemId}
                feedItems={feedItems}
                quantity={quantity}
                setQuantity={setQuantity}
                unitCost={unitCost}
                setUnitCost={setUnitCost}
                displayedAmount={displayedAmount}
                setAmount={setAmount}
                hasCalculatedAmount={hasCalculatedAmount}
                paidBy={paidBy}
                setPaidBy={setPaidBy}
                paidTo={paidTo}
                setPaidTo={setPaidTo}
                payerOptions={payerOptions}
                payeeOptions={payeeOptions}
                remarks={remarks}
                setRemarks={setRemarks}
                editingId={editingId}
                resetForm={resetForm}
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
