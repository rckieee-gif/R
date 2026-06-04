import { getArrivalMetrics } from '../../shared/utils/arrivalMetrics';

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
  const arrivalMetrics = getArrivalMetrics(activeBatch);

  const formatMoney = (amount) => {
    return `PHP ${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatNumber = (amount, digits = 0) => {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '--';
    return Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  };

  return (
    <div className="print-container app-page">
      <div className="no-print flex justify-end mb-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print px-3 py-2 rounded-xl bg-app-accent text-app-on-accent text-xs font-black shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        >
          Print Statement
        </button>
      </div>
      
      {/* HEADER */}
      <div className="statement-print-header bg-app-accent text-app-on-accent p-5 rounded-t-2xl shadow-sm mt-2 text-center font-hanken">
        <h2 className="print-title text-xl font-black tracking-widest uppercase">Batch Financial Summary</h2>
        <p className="text-xs opacity-90 mt-1 font-jetbrains">Batch ID: {batch.id}</p>
      </div>

      <div className="print-card bg-app-card p-6 rounded-b-2xl shadow-sm border-x border-b border-app-border space-y-6 font-hanken">
        <section>
          <h3 className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider border-b border-app-border/40 pb-1 mb-2.5">Arrival Summary</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-app-border/40 bg-app-bg p-2.5">
              <p className="text-[10px] font-black uppercase text-app-text-secondary">Arrived DOC</p>
              <p className="mt-1 font-black text-app-text font-jetbrains">{formatNumber(arrivalMetrics.arrivedDoc)}</p>
            </div>
            <div className="rounded-xl border border-app-border/40 bg-app-bg p-2.5">
              <p className="text-[10px] font-black uppercase text-app-text-secondary">DOA</p>
              <p className="mt-1 font-black text-app-danger font-jetbrains">{formatNumber(arrivalMetrics.doaCount)}</p>
            </div>
            <div className="rounded-xl border border-app-border/40 bg-app-bg p-2.5">
              <p className="text-[10px] font-black uppercase text-app-text-secondary">Net placed</p>
              <p className="mt-1 font-black text-app-success font-jetbrains">{formatNumber(arrivalMetrics.netChicksPlaced)}</p>
            </div>
            <div className="rounded-xl border border-app-border/40 bg-app-bg p-2.5">
              <p className="text-[10px] font-black uppercase text-app-text-secondary">Sample wt</p>
              <p className="mt-1 font-black text-app-text font-jetbrains">
                {arrivalMetrics.arrivalSampleWeightGrams ? `${formatNumber(arrivalMetrics.arrivalSampleWeightGrams, 1)} g` : '--'}
              </p>
            </div>
          </div>
        </section>
        
        {/* REVENUE SECTION */}
        <section>
          <h3 className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider border-b border-app-border/40 pb-1 mb-2.5">Revenue</h3>
          <div className="flex justify-between text-sm text-app-text mb-1.5 font-jetbrains">
            <span>Net Meat Sale</span>
            <span>{formatMoney(batch.netMeatSale)}</span>
          </div>
          <div className="flex justify-between text-sm text-app-text mb-2.5 font-jetbrains">
            <span className="ml-4 text-app-text-secondary">Empty Sack Sale</span>
            <span>{formatMoney(batch.emptySackSale)}</span>
          </div>
          <div className="flex justify-between font-black text-app-text bg-app-bg p-2.5 rounded-xl border border-app-border/40 font-jetbrains">
            <span>Total Gross Revenue</span>
            <span>{formatMoney(totalGrossRevenue)}</span>
          </div>
        </section>

        {/* OPEX SECTION */}
        <section>
          <h3 className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider border-b border-app-border/40 pb-1 mb-2.5">Operating Expenses</h3>
          
          <div className="space-y-1.5 mb-3 font-jetbrains">
            {Object.entries(batch.opexBreakdown)
              .filter(([, amount]) => amount > 0)
              .map(([category, amount]) => (
              <div key={category} className="flex justify-between text-sm text-app-text-secondary">
                <span className="ml-2">{category}</span>
                <span>{formatMoney(amount)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between font-black text-app-danger bg-app-danger-bg p-2.5 rounded-xl border border-app-danger/20 font-jetbrains">
            <span>Total Operating Expenses</span>
            <span>- {formatMoney(totalOpex)}</span>
          </div>
        </section>

        {/* NET REVENUE & DISTRIBUTION */}
        <section>
          <h3 className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider border-b border-app-border/40 pb-1 mb-2.5">Net Batch Revenue</h3>
          <div className="flex justify-between text-lg font-black text-app-success mb-4 font-jetbrains">
            <span>Net Revenue</span>
            <span>{formatMoney(netBatchRevenue)}</span>
          </div>
          
          <div className="flex justify-between font-black text-app-text bg-app-bg p-2.5 rounded-xl border border-app-border/40 font-jetbrains">
            <span>70% Distribution Share</span>
            <span>{formatMoney(distribution70)}</span>
          </div>
        </section>

        {/* OWNER DISTRIBUTION SECTIONS */}
        <section className="border border-app-border rounded-xl p-4 bg-app-bg/30">
          <h4 className="font-black text-app-text mb-2">Building A (Rolly)</h4>
          <div className="flex justify-between text-sm text-app-text-secondary mb-1.5 font-jetbrains">
            <span>Share (42.86%)</span>
            <span>{formatMoney(buildingA_Gross)}</span>
          </div>
          <div className="flex justify-between font-black text-app-accent border-t border-app-border/40 mt-2.5 pt-2 font-jetbrains">
            <span>Total</span>
            <span>{formatMoney(rollyTotalA)}</span>
          </div>
        </section>

        <section className="border border-app-border rounded-xl p-4 bg-app-bg/30">
          <h4 className="font-black text-app-text mb-2">Building B (Jojit)</h4>
          <div className="flex justify-between text-sm text-app-text-secondary mb-1.5 font-jetbrains">
            <span>Share (22.41%)</span>
            <span>{formatMoney(buildingB_Gross)}</span>
          </div>
          <div className="flex justify-between text-sm text-app-danger mb-1.5 font-jetbrains">
            <span className="ml-4">Less: Empty Sack Purchase</span>
            <span>- {formatMoney(batch.emptySackSale)}</span>
          </div>
          <div className="flex justify-between font-black text-app-accent border-t border-app-border/40 mt-2.5 pt-2 font-jetbrains">
            <span>Total</span>
            <span>{formatMoney(jojitTotalB)}</span>
          </div>
        </section>

        <section className="border border-app-border rounded-xl p-4 bg-app-bg/30">
          <h4 className="font-black text-app-text mb-2">Building C (Corpo)</h4>
          <div className="flex justify-between text-sm text-app-text-secondary mb-1.5 font-jetbrains">
            <span>Corpo Share (34.73%)</span>
            <span>{formatMoney(buildingC_Gross)}</span>
          </div>
          <div className="flex justify-between text-sm text-app-text-secondary mb-1.5 font-jetbrains">
            <span className="ml-4">Rolly Share (50%)</span>
            <span>{formatMoney(corpoRollyShare)}</span>
          </div>
          <div className="flex justify-between text-sm text-app-text-secondary mb-1.5 font-jetbrains">
            <span className="ml-4">Jojit Share (50%)</span>
            <span>{formatMoney(corpoJojitShare)}</span>
          </div>
          {batch.previousDeficit > 0 && (
            <div className="flex justify-between text-sm text-app-danger mb-1.5 mt-2 font-jetbrains">
              <span className="ml-4">Less: Previous Deficit (Ledger)</span>
              <span>- {formatMoney(batch.previousDeficit)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-app-danger mb-1.5 font-jetbrains">
            <span className="ml-4">Less: CAPEX</span>
            <span>- {formatMoney(batch.capex)}</span>
          </div>
          <div className={`flex justify-between font-black border-t border-app-border/40 mt-2.5 pt-2 font-jetbrains ${buildingC_Net >= 0 ? 'text-app-success' : 'text-app-danger'}`}>
            <span>Total</span>
            <span>{formatMoney(buildingC_Net)}</span>
          </div>
        </section>

      </div>
    </div>
  );
}
