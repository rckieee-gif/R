import { useMemo } from 'react';
import QuantityInput from '../../../shared/components/QuantityInput';
import MoneyInput from '../../../shared/components/MoneyInput';

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
          <label htmlFor="tx-date" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Date</label>
          <input
            id="tx-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          />
        </div>

        <div className="w-1/3">
          <label htmlFor="tx-building" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Building</label>
          <select
            id="tx-building"
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          >
            {buildings.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex space-x-3">
        <div className="flex-1">
          <label htmlFor="tx-funding-nature" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Funding Nature</label>
          <select
            id="tx-funding-nature"
            value={fundingNature}
            onChange={handleFundingChange}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
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
          <label htmlFor="tx-category" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Category</label>
          <select
            id="tx-category"
            value={category}
            onChange={handleCategoryChange}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
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
          <label htmlFor="tx-type" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Transaction Type</label>
          <select
            id="tx-type"
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          >
            {TRANSACTION_TYPES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tx-reference" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Reference</label>
          <input
            id="tx-reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="OR, invoice, note"
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
          />
        </div>
      </div>

      <div>
        <label htmlFor="tx-description" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Description</label>
        <input
          id="tx-description"
          type="text"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Starter feed"
          className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
        />
      </div>

      {isFeedLedgerRecord && (
        <div className="rounded-xl border border-app-success bg-app-success-bg p-3">
          <label htmlFor="tx-feed-item" className="block text-[10px] font-black uppercase tracking-wider text-app-success mb-1">
            Feed Inventory Item
          </label>
          <select
            id="tx-feed-item"
            required
            value={feedItemId}
            onChange={(e) => setFeedItemId(e.target.value)}
            className="w-full px-3 py-2 border border-app-success/30 rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-success/20"
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
          <p className="text-[10px] font-semibold text-app-success mt-2">
            Saving this feed delivery adds Stock In to inventory. Daily Logs consume from the same feed item.
            {selectedFeedItem ? ` Current stock: ${Number(selectedFeedItem.currentStock || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selectedFeedItem.unit}.` : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <QuantityInput
          id="tx-quantity"
          label="Quantity"
          value={quantity}
          onChange={setQuantity}
          unit={selectedFeedItem?.unit || 'units'}
          step="0.001"
        />

        <MoneyInput
          id="tx-unit-cost"
          label="Unit Cost"
          value={unitCost}
          onChange={setUnitCost}
          min={0}
        />

        <MoneyInput
          id="tx-amount"
          label="Amount"
          value={displayedAmount}
          onChange={setAmount}
          required
          readOnly={hasCalculatedAmount}
          min={0}
        />
      </div>

      <div className="flex space-x-3 border-t border-app-border/40 pt-3">
        <div className="flex-1">
          <label htmlFor="tx-paid-by" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Paid By</label>
          <select
            id="tx-paid-by"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
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
          <label htmlFor="tx-paid-to" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Paid To</label>
          <select
            id="tx-paid-to"
            value={paidTo}
            onChange={(e) => setPaidTo(e.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
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
        <label htmlFor="tx-remarks" className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Remarks</label>
        <input
          id="tx-remarks"
          type="text"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Optional"
          className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
        />
      </div>

      <div className="flex gap-2.5 pt-4">
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="flex-1 bg-app-bg text-app-text border border-app-border px-3 h-11 md:h-10 flex items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          className="flex-[2] bg-app-accent text-app-on-accent px-3 h-11 md:h-10 flex items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          {editingId ? 'Update Record' : 'Save Record'}
        </button>
      </div>
    </form>
  );
}
