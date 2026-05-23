// We now receive the live 'transactions' from the App
export default function FinancialStatement({ transactions = [], activeBatch }) {
  
  // 1. DYNAMIC REVENUE CALCULATION
  const netMeatSale = transactions
    .filter(tx => tx.category === 'Net Meat Sale')
    .reduce((sum, tx) => sum + tx.amount, 0);
     
  const emptySackSale = transactions
    .filter(tx => tx.category === 'Empty Sack Sale')
    .reduce((sum, tx) => sum + tx.amount, 0);

  // 2. DYNAMIC CAPEX CALCULATION
  const capex = transactions
    .filter(tx => tx.fundingNature === 'CAPEX')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const previousDeficit = transactions
    .filter(tx => tx.fundingNature === 'Payable' && tx.category === 'Previous Deficit')
    .reduce((sum, tx) => sum + tx.amount, 0);

  // 3. DYNAMIC OPEX CALCULATION
  // Create an empty template
  const dynamicOpex = {
    'Feed': 0, 'DOC': 0, 'Medicine': 0, 'Brooding Paper': 0, 'Charcoal': 0,
    'Labor': 0, 'Food Expense': 0, 'Utilities': 0, 'Supplies': 0, 'Minor Repair': 0,
    'Transport': 0, 'Cleaning & Janitorial': 0, 'Dressing Plant Expense': 0, 'Miscellaneous': 0
  };

  // Loop through all OPEX transactions and add their amounts to the right category
  transactions.filter(tx => tx.fundingNature === 'OPEX').forEach(tx => {
    if (dynamicOpex[tx.category] !== undefined) {
      dynamicOpex[tx.category] += tx.amount;
    }
  });

  const batch = {
    id: activeBatch?.id || 'No active batch',
    netMeatSale: netMeatSale,
    emptySackSale: emptySackSale,
    opexBreakdown: dynamicOpex,
    shareA: 0.4286,
    shareB: 0.2241,
    shareC: 0.3473,
    previousDeficit,
    capex: capex
  };

  // --- AUTOMATED MATH CALCULATIONS (Unchanged) ---
  const totalGrossRevenue = batch.netMeatSale + batch.emptySackSale;
  const totalOpex = Object.values(batch.opexBreakdown).reduce((sum, amount) => sum + amount, 0);
  const netBatchRevenue = totalGrossRevenue - totalOpex;
  const distribution70 = netBatchRevenue * 0.70;

  const buildingA_Gross = distribution70 * batch.shareA;
  const buildingB_Gross = distribution70 * batch.shareB;
  const buildingC_Gross = distribution70 * batch.shareC;

  const rollyTotalA = buildingA_Gross;
  const jojitTotalB = buildingB_Gross - batch.emptySackSale; 
  
  const corpoRollyShare = buildingC_Gross * 0.50;
  const corpoJojitShare = buildingC_Gross * 0.50;
  const buildingC_Net = buildingC_Gross - batch.previousDeficit - batch.capex;

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
  };

  return (
    <div className="print-container app-page">
      <div className="no-print flex justify-end mb-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-black shadow-sm"
        >
          Print
        </button>
      </div>
      
      {/* HEADER */}
      <div className="statement-print-header bg-primary text-white p-4 rounded-t-2xl shadow-sm mt-2 text-center">
        <h2 className="print-title text-xl font-extrabold tracking-widest uppercase">Batch Financial Summary</h2>
        <p className="text-sm opacity-90 mt-1">Batch ID: {batch.id}</p>
      </div>

      <div className="print-card bg-white dark:bg-gray-800 p-5 rounded-b-2xl shadow-sm border-x border-b border-neutral-border dark:border-gray-700 space-y-6">
        
        {/* REVENUE SECTION */}
        <section>
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 pb-1 mb-2">Revenue</h3>
          <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-1">
            <span>Net Meat Sale</span>
            <span>{formatMoney(batch.netMeatSale)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-2">
            <span className="ml-4 text-gray-500">Empty Sack Sale</span>
            <span>{formatMoney(batch.emptySackSale)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 dark:text-white bg-neutral-light dark:bg-gray-700 p-2 rounded">
            <span>Total Gross Revenue</span>
            <span>{formatMoney(totalGrossRevenue)}</span>
          </div>
        </section>

        {/* OPEX SECTION */}
        <section>
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 pb-1 mb-2">Operating Expenses</h3>
          
          <div className="space-y-1 mb-3">
            {Object.entries(batch.opexBreakdown)
              .filter(([, amount]) => amount > 0)
              .map(([category, amount]) => (
              <div key={category} className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span className="ml-2">{category}</span>
                <span>{formatMoney(amount)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between font-bold text-semantic-danger bg-red-50 dark:bg-red-900/20 p-2 rounded">
            <span>Total Operating Expenses</span>
            <span>- {formatMoney(totalOpex)}</span>
          </div>
        </section>

        {/* NET REVENUE & DISTRIBUTION */}
        <section>
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 pb-1 mb-2">Net Batch Revenue</h3>
          <div className="flex justify-between text-lg font-black text-semantic-success mb-4">
            <span>Net Revenue</span>
            <span>{formatMoney(netBatchRevenue)}</span>
          </div>
          
          <div className="flex justify-between font-bold text-gray-900 dark:text-white bg-neutral-light dark:bg-gray-700 p-2 rounded">
            <span>70% Distribution Share</span>
            <span>{formatMoney(distribution70)}</span>
          </div>
        </section>

        {/* OWNER DISTRIBUTION SECTIONS (Unchanged layout) */}
        <section className="border border-neutral-border dark:border-gray-600 rounded-lg p-3">
          <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Building A (Rolly)</h4>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Share (42.86%)</span>
            <span>{formatMoney(buildingA_Gross)}</span>
          </div>
          <div className="flex justify-between font-bold text-primary border-t border-gray-200 dark:border-gray-600 mt-2 pt-2">
            <span>Total</span>
            <span>{formatMoney(rollyTotalA)}</span>
          </div>
        </section>

        <section className="border border-neutral-border dark:border-gray-600 rounded-lg p-3">
          <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Building B (Jojit)</h4>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Share (22.41%)</span>
            <span>{formatMoney(buildingB_Gross)}</span>
          </div>
          <div className="flex justify-between text-sm text-semantic-danger mb-1">
            <span className="ml-4">Less: Empty Sack Purchase</span>
            <span>- {formatMoney(batch.emptySackSale)}</span>
          </div>
          <div className="flex justify-between font-bold text-primary border-t border-gray-200 dark:border-gray-600 mt-2 pt-2">
            <span>Total</span>
            <span>{formatMoney(jojitTotalB)}</span>
          </div>
        </section>

        <section className="border border-neutral-border dark:border-gray-600 rounded-lg p-3">
          <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Building C (Corpo)</h4>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Corpo Share (34.73%)</span>
            <span>{formatMoney(buildingC_Gross)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
            <span className="ml-4">Rolly Share (50%)</span>
            <span>{formatMoney(corpoRollyShare)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
            <span className="ml-4">Jojit Share (50%)</span>
            <span>{formatMoney(corpoJojitShare)}</span>
          </div>
          {batch.previousDeficit > 0 && (
            <div className="flex justify-between text-sm text-semantic-danger mb-1 mt-2">
              <span className="ml-4">Less: Previous Deficit (Ledger)</span>
              <span>- {formatMoney(batch.previousDeficit)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-semantic-danger mb-1">
            <span className="ml-4">Less: CAPEX</span>
            <span>- {formatMoney(batch.capex)}</span>
          </div>
          <div className="flex justify-between font-bold text-semantic-danger border-t border-gray-200 dark:border-gray-600 mt-2 pt-2">
            <span>Total</span>
            <span>{formatMoney(buildingC_Net)}</span>
          </div>
        </section>

      </div>
    </div>
  );
}
