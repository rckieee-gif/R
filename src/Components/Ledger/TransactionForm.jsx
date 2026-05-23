import { useMemo } from 'react';

const TRANSACTION_TYPES = ['Expense', 'Income', 'Adjustment', 'Reimbursement', 'Payment'];

export default function TransactionForm({
  handleSubmit,
  date,
  setDate,
  building,
  setBuilding,
  buildings,
  fundingNature,
  handleFundingChange,
  fundingNatures,
  category,
  handleCategoryChange,
  categoriesByFunding,
  transactionType,
  setTransactionType,
  reference,
  setReference,
  description,
  setDescription,
  isFeedLedgerRecord,
  feedItemId,
  setFeedItemId,
  feedItems,
  quantity,
  setQuantity,
  unitCost,
  setUnitCost,
  displayedAmount,
  setAmount,
  hasCalculatedAmount,
  paidBy,
  setPaidBy,
  paidTo,
  setPaidTo,
  payerOptions,
  payeeOptions,
  remarks,
  setRemarks,
  editingId,
  resetForm
}) {
  const selectedFeedItem = useMemo(
    () => feedItems.find((item) => String(item.id) === String(feedItemId)) || null,
    [feedItemId, feedItems]
  );

  return (
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
  );
}
