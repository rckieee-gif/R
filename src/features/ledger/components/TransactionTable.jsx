export default function TransactionTable({
  transactions,
  editingId,
  readOnly,
  canEditOrDelete,
  handleEditClick,
  handleDeleteTransaction,
  heading = 'Recent Expenses',
  emptyMessage = 'No expenses logged yet.'
}) {
  return (
    <>
      {/* SCREEN VERSION */}
      <div className="screen-only min-w-0">
        <h3 className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider mb-3 ml-1">
          {heading}
        </h3>

        <div className="grid gap-3 2xl:grid-cols-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className={`print-card bg-app-card p-4 rounded-xl border flex flex-col relative overflow-hidden group transition-all duration-300 hover:shadow-sm ${editingId === tx.id ? 'border-app-accent bg-app-accent/5' : 'border-app-border'}`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${tx.fundingNature === 'Revenue' ? 'bg-app-success' : 'bg-app-accent/60'}`}></div>

              <div className="flex justify-between items-start mb-1 pl-2">
                <div>
                  <p className="font-black text-app-text text-sm">{tx.description}</p>
                  <p className="text-xs font-bold text-app-accent mt-0.5">{tx.category} &bull; Bldg {tx.building}</p>
                  <p className="text-[10px] text-app-text-secondary mt-1">
                    {tx.type} {tx.reference ? `&bull; Ref: ${tx.reference}` : ''}
                  </p>
                  {tx.quantity != null && tx.unitCost != null && (
                    <p className="text-[10px] text-app-text-secondary mt-1 font-jetbrains">
                      {Number(tx.quantity).toLocaleString()} x PHP {Number(tx.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </p>
                  )}
                  {tx.feedItemName && (
                    <p className="text-[10px] text-app-success font-black mt-1 font-jetbrains">
                      Inventory: {tx.feedItemName}
                    </p>
                  )}
                </div>
                <div className={`font-jetbrains font-black text-base whitespace-nowrap ${tx.fundingNature === 'Revenue' ? 'text-app-success' : 'text-app-text'}`}>
                  PHP {parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex justify-between items-center mt-2 pt-2 border-t border-app-border/40 pl-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] text-app-text-secondary font-black uppercase tracking-wide font-jetbrains">
                    {new Date(tx.date).toLocaleDateString()} &bull; {tx.fundingNature}
                  </p>
                  {tx.paidBy && (
                    <p className="text-[9px] font-black px-2 py-0.5 rounded-full border bg-app-warning-bg text-app-warning border-app-warning/20 font-jetbrains">
                      By: {tx.paidBy}
                    </p>
                  )}
                </div>

                {!readOnly && canEditOrDelete && (
                  <div className="no-print flex space-x-3">
                    <button
                      onClick={() => handleEditClick(tx)}
                      className="text-xs font-black uppercase tracking-wider text-app-text-secondary hover:text-app-accent transition-colors cursor-pointer"
                      title="Edit Transaction"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTransaction(tx.id)}
                      className="text-xs font-black uppercase tracking-wider text-app-text-secondary hover:text-app-danger transition-colors cursor-pointer"
                      title="Void Transaction"
                    >
                      Void
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {transactions.length === 0 && (
            <p className="text-center text-app-text-secondary text-sm mt-4 font-bold col-span-full">
              {emptyMessage}
            </p>
          )}
        </div>
      </div>

      {/* PRINT VERSION */}
      <div className="print-only">
        <table className="print-simple-table w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-app-border">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Building</th>
              <th className="text-left py-2">Type</th>
              <th className="text-left py-2">Funding</th>
              <th className="text-left py-2">Category</th>
              <th className="text-left py-2">Description</th>
              <th className="text-left py-2">Paid By</th>
              <th className="text-left py-2">Paid To</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-app-border/40">
                <td className="py-2 font-jetbrains">{new Date(tx.date).toLocaleDateString()}</td>
                <td className="py-2">{tx.building || 'All'}</td>
                <td className="py-2">{tx.type}</td>
                <td className="py-2">{tx.fundingNature}</td>
                <td className="py-2">{tx.category}</td>
                <td className="py-2">{tx.description}</td>
                <td className="py-2">{tx.paidBy || '--'}</td>
                <td className="py-2">{tx.paidTo || '--'}</td>
                <td className="py-2 text-right font-jetbrains">
                  PHP {Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan="9" className="text-center py-4">{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
