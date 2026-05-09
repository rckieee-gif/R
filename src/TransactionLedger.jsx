import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';

const TRANSACTION_TYPES = ['Expense', 'Income', 'Adjustment', 'Reimbursement', 'Payment'];

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
  if (/deficit|adjust/i.test(category)) return 'Adjustment';
  if (/reimburse/i.test(category)) return 'Reimbursement';
  if (/payment|paid/i.test(category)) return 'Payment';
  return 'Expense';
}

function normalizeStakeholderName(name) {
  return name === 'Yanyan' ? 'Others' : name;
}

function uniqueStakeholders(stakeholders) {
  const seen = new Set();
  return stakeholders.reduce((list, stakeholder) => {
    const name = normalizeStakeholderName(stakeholder.name);
    if (seen.has(name)) return list;
    seen.add(name);
    list.push({ ...stakeholder, name });
    return list;
  }, []);
}

export default function TransactionLedger({ transactions, setTransactions, activeBatch, token }) {
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
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);

  const fundingNatures = useMemo(
    () => Object.keys(categoriesByFunding),
    [categoriesByFunding]
  );

  const payerOptions = useMemo(
    () => stakeholders.map((stakeholder) => stakeholder.name),
    [stakeholders]
  );

  const payeeOptions = payerOptions;

  const hasCalculatedAmount = quantity !== '' && unitCost !== '';
  const calculatedAmount = hasCalculatedAmount
    ? Number((Number(quantity || 0) * Number(unitCost || 0)).toFixed(2))
    : null;
  const displayedAmount = hasCalculatedAmount ? calculatedAmount.toFixed(2) : amount;
  const isFeedLedgerRecord = category === 'Feed'
    && ['OPEX', 'CAPEX', 'CAPEX-Recoverable'].includes(fundingNature)
    && transactionType === 'Expense';
  const selectedFeedItem = useMemo(
    () => feedItems.find((item) => String(item.id) === String(feedItemId)) || null,
    [feedItemId, feedItems]
  );

  useEffect(() => {
    if (!token) {
      setError('Please sign in again so the ledger can load dropdown data.');
      return;
    }

    const fetchMasterData = async () => {
      setIsLoadingMasters(true);
      setError('');

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [buildingResponse, categoryResponse, stakeholderResponse, feedResponse] = await Promise.all([
          fetch(`${API_BASE}/api/buildings`, { headers }),
          fetch(`${API_BASE}/api/categories`, { headers }),
          fetch(`${API_BASE}/api/stakeholders`, { headers }),
          fetch(`${API_BASE}/api/inventory/items?category=Feed`, { headers })
        ]);

        if (!buildingResponse.ok || !categoryResponse.ok || !stakeholderResponse.ok || !feedResponse.ok) {
          throw new Error('Failed to load ledger dropdown data.');
        }

        const [buildingData, categoryData, stakeholderData, feedData] = await Promise.all([
          buildingResponse.json(),
          categoryResponse.json(),
          stakeholderResponse.json(),
          feedResponse.json()
        ]);

        const nextBuildings = ['All', ...buildingData.map((item) => item.name)];
        const nextCategories = groupCategories(categoryData);
        const nextFundingNature = nextCategories.OPEX ? 'OPEX' : Object.keys(nextCategories)[0] || '';
        const nextStakeholders = uniqueStakeholders(stakeholderData);
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
        setError('Could not load ledger dropdowns from the server.');
      } finally {
        setIsLoadingMasters(false);
      }
    };

    fetchMasterData();
  }, [token]);

  useEffect(() => {
    const categories = categoriesByFunding[fundingNature] || [];
    if (!categories.includes(category)) {
      const nextCategory = categories[0] || '';
      setCategory(nextCategory);
      setTransactionType(suggestTransactionType(fundingNature, nextCategory));
    }
  }, [fundingNature, categoriesByFunding, category]);

  useEffect(() => {
    if (isFeedLedgerRecord && !feedItemId && feedItems[0]?.id) {
      setFeedItemId(String(feedItems[0].id));
    }
  }, [feedItemId, feedItems, isFeedLedgerRecord]);

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

  const resetForm = () => {
    setEditingId(null);
    setDescription('');
    setQuantity('');
    setUnitCost('');
    setAmount('');
    setPaidTo('');
    setReference('');
    setRemarks('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!activeBatch?.id) {
      setError('Please select an active batch before saving a ledger record.');
      return;
    }

    if (!fundingNature || !category) {
      setError('Funding nature and category are required.');
      return;
    }

    if (isFeedLedgerRecord && (!feedItemId || Number(quantity || 0) <= 0)) {
      setError('Feed delivery entries need a feed inventory item and quantity in sacks.');
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
      feedItemId: isFeedLedgerRecord ? feedItemId : null
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

      if (editingId) {
        setTransactions(transactions.map((tx) => tx.id === editingId ? data : tx));
      } else {
        setTransactions([data, ...transactions]);
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save transaction:', err);
      setError('Cannot connect to server.');
    }
  };

  const handleEditClick = (tx) => {
    setEditingId(tx.id);
    setDate(new Date(tx.date).toISOString().split('T')[0]);
    setBuilding(tx.building || 'All');
    setTransactionType(tx.type || suggestTransactionType(tx.fundingNature, tx.category));
    setFundingNature(tx.fundingNature);
    setCategory(tx.category);
    setFeedItemId(tx.feedItemId ? String(tx.feedItemId) : (feedItems[0]?.id ? String(feedItems[0].id) : ''));
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

  const handleDeleteTransaction = async (idToDelete) => {
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
            <h2 className="print-title text-3xl font-extrabold text-primary tracking-tight">
              Ledger Entry
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {activeBatch?.id ? `Batch ${activeBatch.id}` : 'Select a batch before saving records.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print px-3 py-2 rounded-xl bg-primary text-white text-xs font-black shadow-sm"
          >
            Print
          </button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(360px,480px)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className={`no-print bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border-2 transition-colors duration-300 mb-6 lg:sticky lg:top-24 lg:mb-0 ${editingId ? 'border-secondary' : 'border-neutral-border dark:border-gray-700'}`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 border-b pb-2 ${editingId ? 'text-secondary border-secondary/30' : 'text-gray-400 dark:text-gray-500 border-gray-100 dark:border-gray-700'}`}>
          {editingId ? 'Editing Record' : 'New Finance Record'}
        </h3>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
            {error}
          </div>
        )}

        {isLoadingMasters && (
          <p className="text-xs text-gray-500 mb-4">Loading dropdowns...</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div className="w-1/3">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Building</label>
              <select
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                {buildings.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex space-x-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Funding Nature</label>
              <select
                value={fundingNature}
                onChange={handleFundingChange}
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                {fundingNatures.length === 0 && (
                  <option value="">No funding types loaded</option>
                )}
                {fundingNatures.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Category</label>
              <select
                value={category}
                onChange={handleCategoryChange}
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                {(categoriesByFunding[fundingNature] || []).length === 0 && (
                  <option value="">No categories loaded</option>
                )}
                {(categoriesByFunding[fundingNature] || []).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Transaction Type</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                {TRANSACTION_TYPES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="OR, invoice, note"
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Description</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Starter feed"
              className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          {isFeedLedgerRecord && (
            <div className="rounded-xl border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/10 p-3">
              <label className="block text-xs font-bold text-green-800 dark:text-green-300 mb-1">
                Feed Inventory Item
              </label>
              <select
                required
                value={feedItemId}
                onChange={(e) => setFeedItemId(e.target.value)}
                className="w-full p-2 border border-green-200 dark:border-green-800/50 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                {feedItems.length === 0 && (
                  <option value="">No feed items loaded</option>
                )}
                {feedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {Number(item.currentStock || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
                  </option>
                ))}
              </select>
              <p className="text-[10px] font-semibold text-green-700 dark:text-green-300 mt-2">
                Saving this feed delivery adds Stock In to inventory. Daily Logs consume from the same feed item.
                {selectedFeedItem ? ` Current stock: ${Number(selectedFeedItem.currentStock || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selectedFeedItem.unit}.` : ''}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Quantity</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Unit Cost</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                readOnly={hasCalculatedAmount}
                value={displayedAmount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none ${
                  hasCalculatedAmount
                    ? 'bg-gray-100 dark:bg-gray-900 font-bold'
                    : 'bg-neutral-light dark:bg-gray-700'
                }`}
              />
            </div>
          </div>

          <div className="flex space-x-3 border-t border-gray-100 dark:border-gray-700 pt-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Paid By</label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value="">-- Select --</option>
                {payerOptions.length === 0 && (
                  <option value="" disabled>No stakeholders loaded</option>
                )}
                {payerOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Paid To</label>
              <select
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value="">-- Select --</option>
                {payeeOptions.length === 0 && (
                  <option value="" disabled>No stakeholders loaded</option>
                )}
                {payeeOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional"
              className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          <div className="flex space-x-2 mt-4 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 p-3 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all active:scale-95 shadow-sm"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              className={`flex-[2] text-white p-3 rounded-xl font-bold transition-all active:scale-95 shadow-md ${editingId ? 'bg-secondary hover:bg-opacity-90' : 'bg-primary hover:bg-opacity-90'}`}
            >
              {editingId ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>

      <div className="screen-only min-w-0">
        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1">
          Recent Records
        </h3>

        <div className="grid gap-3 2xl:grid-cols-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className={`print-card bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border flex flex-col relative overflow-hidden group transition-colors ${editingId === tx.id ? 'border-secondary bg-yellow-50/30 dark:bg-yellow-900/10' : 'border-neutral-border dark:border-gray-700'}`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${tx.fundingNature === 'Revenue' ? 'bg-semantic-success' : 'bg-secondary'}`}></div>

              <div className="flex justify-between items-start mb-1 pl-2">
                <div>
                  <p className="font-bold text-gray-800 dark:text-white text-sm">{tx.description}</p>
                  <p className="text-xs font-medium text-primary mt-0.5">{tx.category} - Bldg {tx.building}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {tx.type} {tx.reference ? `- Ref: ${tx.reference}` : ''}
                  </p>
                  {tx.quantity != null && tx.unitCost != null && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {Number(tx.quantity).toLocaleString()} x PHP {Number(tx.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </p>
                  )}
                  {tx.feedItemName && (
                    <p className="text-[10px] text-green-700 dark:text-green-300 font-bold mt-1">
                      Inventory: {tx.feedItemName}
                    </p>
                  )}
                </div>
                <div className={`font-black ${tx.fundingNature === 'Revenue' ? 'text-semantic-success' : 'text-gray-800 dark:text-white'}`}>
                  PHP {parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 pl-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                    {new Date(tx.date).toLocaleDateString()} - {tx.fundingNature}
                  </p>
                  {tx.paidBy && (
                    <p className="text-[10px] font-bold px-2 py-1 rounded border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700/50">
                      By: {tx.paidBy}
                    </p>
                  )}
                </div>

                <div className="no-print flex space-x-2">
                  <button
                    onClick={() => handleEditClick(tx)}
                    className="text-xs font-bold text-gray-400 hover:text-secondary transition-colors"
                    title="Edit Transaction"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTransaction(tx.id)}
                    className="text-xs font-bold text-gray-400 hover:text-semantic-danger transition-colors"
                    title="Void Transaction"
                  >
                    Void
                  </button>
                </div>
              </div>
            </div>
          ))}

          {transactions.length === 0 && (
            <p className="text-center text-gray-500 text-sm mt-4">
              No transactions logged yet.
            </p>
          )}
        </div>
      </div>
      </div>

      <div className="print-only">
        <table className="print-simple-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Building</th>
              <th>Type</th>
              <th>Funding</th>
              <th>Category</th>
              <th>Description</th>
              <th>Paid By</th>
              <th>Paid To</th>
              <th className="numeric">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td>{new Date(tx.date).toLocaleDateString()}</td>
                <td>{tx.building || 'All'}</td>
                <td>{tx.type}</td>
                <td>{tx.fundingNature}</td>
                <td>{tx.category}</td>
                <td>{tx.description}</td>
                <td>{tx.paidBy || '--'}</td>
                <td>{tx.paidTo || '--'}</td>
                <td className="numeric">
                  PHP {Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan="9">No transactions logged yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
