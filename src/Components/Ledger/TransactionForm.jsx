import { useMemo } from 'react';

const TRANSACTION_TYPES = ['Expense', 'Income', 'Adjustment', 'Reimbursement', 'Payment'];

export default function TransactionForm({
  handleSubmit,
  register,
  errors,
  watch,
  setValue,
  buildings,
  fundingNatures,
  categoriesByFunding,
  feedItems,
  payerOptions,
  payeeOptions,
  editingId,
  resetForm,
  handleFundingChange,
  handleCategoryChange,
  hasCalculatedAmount,
  isFeedLedgerRecord,
  feedItemId
}) {
  const selectedFeedItem = useMemo(
    () => feedItems.find((item) => String(item.id) === String(feedItemId)) || null,
    [feedItemId, feedItems]
  );

  const watchFundingNature = watch('fundingNature');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex space-x-3">
        <div className="flex-1">
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Date</label>
          <input
            type="date"
            {...register('date')}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          />
          {errors.date && <p className="text-xs text-app-danger mt-1">{errors.date.message}</p>}
        </div>

        <div className="w-1/3">
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Building</label>
          <select
            {...register('building')}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          >
            {buildings.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          {errors.building && <p className="text-xs text-app-danger mt-1">{errors.building.message}</p>}
        </div>
      </div>

      <div className="flex space-x-3">
        <div className="flex-1">
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Funding Nature</label>
          <select
            {...register('fundingNature')}
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
          {errors.fundingNature && <p className="text-xs text-app-danger mt-1">{errors.fundingNature.message}</p>}
        </div>

        <div className="flex-1">
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Category</label>
          <select
            {...register('category')}
            onChange={handleCategoryChange}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          >
            {(categoriesByFunding[watchFundingNature] || []).length === 0 && (
              <option value="">No categories loaded</option>
            )}
            {(categoriesByFunding[watchFundingNature] || []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          {errors.category && <p className="text-xs text-app-danger mt-1">{errors.category.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Transaction Type</label>
          <select
            {...register('transactionType')}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          >
            {TRANSACTION_TYPES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          {errors.transactionType && <p className="text-xs text-app-danger mt-1">{errors.transactionType.message}</p>}
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Reference</label>
          <input
            type="text"
            {...register('reference')}
            placeholder="OR, invoice, note"
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Description</label>
        <input
          type="text"
          {...register('description')}
          placeholder="e.g. Starter feed"
          className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
        />
        {errors.description && <p className="text-xs text-app-danger mt-1">{errors.description.message}</p>}
      </div>

      {isFeedLedgerRecord && (
        <div className="rounded-xl border border-app-success bg-app-success-bg p-3">
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-success mb-1">
            Feed Inventory Item
          </label>
          <select
            {...register('feedItemId')}
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
          {errors.feedItemId && <p className="text-xs text-app-danger mt-1">{errors.feedItemId.message}</p>}
          <p className="text-[10px] font-semibold text-app-success mt-2">
            Saving this feed delivery adds Stock In to inventory. Daily Logs consume from the same feed item.
            {selectedFeedItem ? ` Current stock: ${Number(selectedFeedItem.currentStock || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selectedFeedItem.unit}.` : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 font-jetbrains">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Quantity</label>
          <input
            type="number"
            step="0.001"
            min="0"
            {...register('quantity')}
            placeholder="0"
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          />
          {errors.quantity && <p className="text-xs text-app-danger mt-1">{errors.quantity.message}</p>}
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Unit Cost</label>
          <input
            type="number"
            step="0.0001"
            min="0"
            {...register('unitCost')}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
          />
          {errors.unitCost && <p className="text-xs text-app-danger mt-1">{errors.unitCost.message}</p>}
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            readOnly={hasCalculatedAmount}
            {...register('amount')}
            placeholder="0.00"
            className={`w-full px-3 py-2 border border-app-border rounded-xl text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all ${
              hasCalculatedAmount
                ? 'bg-app-bg/50 cursor-not-allowed text-app-text font-black'
                : 'bg-app-bg placeholder-app-text-secondary/40'
            }`}
          />
          {errors.amount && <p className="text-xs text-app-danger mt-1">{errors.amount.message}</p>}
        </div>
      </div>

      <div className="flex space-x-3 border-t border-app-border/40 pt-3">
        <div className="flex-1">
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Paid By</label>
          <select
            {...register('paidBy')}
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
          {errors.paidBy && <p className="text-xs text-app-danger mt-1">{errors.paidBy.message}</p>}
        </div>

        <div className="flex-1">
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Paid To</label>
          <select
            {...register('paidTo')}
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
          {errors.paidTo && <p className="text-xs text-app-danger mt-1">{errors.paidTo.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1">Remarks</label>
        <input
          type="text"
          {...register('remarks')}
          placeholder="Optional"
          className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
        />
        {errors.remarks && <p className="text-xs text-app-danger mt-1">{errors.remarks.message}</p>}
      </div>

      <div className="flex space-x-2 mt-4 pt-2">
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="flex-1 bg-app-bg text-app-text border border-app-border px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          className="flex-[2] bg-app-accent text-app-on-accent px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          {editingId ? 'Update Record' : 'Save Record'}
        </button>
      </div>
    </form>
  );
}
