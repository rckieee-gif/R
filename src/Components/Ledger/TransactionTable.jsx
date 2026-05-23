export default function TransactionTable({
  transactions,
  editingId,
  readOnly,
  canEditOrDelete,
  handleEditClick,
  handleDeleteTransaction
}) {
  return (
    <>
      {/* SCREEN VERSION */}
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

                {!readOnly && canEditOrDelete && (
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
                )}
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

      {/* PRINT VERSION */}
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
    </>
  );
}
