import { useEffect, useMemo, useState } from 'react';
import { apiClient } from './utils/apiClient';
import { useNotification } from './hooks/useNotification';

const opexCategories = [
  'Feed',
  'DOC',
  'Medicine',
  'Brooding Paper',
  'Dressing Plant Expense',
  'Transport',
  'Miscellaneous'
];

function numberValue(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Number(numberValue(value).toFixed(2));
}

function formatMoney(value) {
  return `PHP ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatNumber(value, digits = 0) {
  return numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function getFinancingAmount(row) {
  if (row.amount !== '' && row.amount !== null && row.amount !== undefined) {
    return numberValue(row.amount);
  }

  if (row.quantity !== '' && row.unitCost !== '') {
    return numberValue(row.quantity) * numberValue(row.unitCost);
  }

  return 0;
}

function calculateSummary(report) {
  const chickenRows = report?.chickenSales || [];
  const byproductRows = report?.byproductSales || [];
  const events = report?.harvestEvents || [];
  const docRate = numberValue(report?.docAddOnRatePerBird, 3);
  const truckingRate = numberValue(report?.truckingFeePerBird, 2.7);

  const perHarvest = [1, 2, 3].map((harvestOrder) => {
    const event = events.find((item) => Number(item.harvestOrder) === harvestOrder) || {};
    const birdsKey = `harvest${harvestOrder}Birds`;
    const kilosKey = `harvest${harvestOrder}Kilos`;
    const qtyKey = `harvest${harvestOrder}Qty`;
    const salesKey = `harvest${harvestOrder}Sales`;
    const birds = chickenRows.reduce((sum, row) => sum + Math.round(numberValue(row[birdsKey])), 0);
    const kilos = chickenRows.reduce((sum, row) => sum + numberValue(row[kilosKey]), 0);
    const chickenSales = chickenRows.reduce((sum, row) => {
      const rate = numberValue(row.finalRate, numberValue(row.basePricePerKg));
      return sum + (numberValue(row[kilosKey]) * rate);
    }, 0);
    const byproductQty = byproductRows.reduce((sum, row) => sum + numberValue(row[qtyKey]), 0);
    const byproductSales = byproductRows.reduce((sum, row) => sum + numberValue(row[salesKey]), 0);
    const grossSales = chickenSales + byproductSales;
    const docAddOn = birds * docRate;
    const truckingFee = birds * truckingRate;
    const permitShipping = numberValue(event.permitShipping);
    const tollingFee = numberValue(event.tollingFee);
    const totalExpenses = permitShipping + tollingFee + docAddOn + truckingFee;
    const netSales = grossSales - totalExpenses;

    return {
      harvestOrder,
      harvestDate: event.harvestDate || '',
      birds,
      kilos,
      chickenSales: roundMoney(chickenSales),
      byproductQty,
      byproductSales: roundMoney(byproductSales),
      grossSales: roundMoney(grossSales),
      permitShipping: roundMoney(permitShipping),
      tollingFee: roundMoney(tollingFee),
      docAddOn: roundMoney(docAddOn),
      truckingFee: roundMoney(truckingFee),
      totalExpenses: roundMoney(totalExpenses),
      netSales: roundMoney(netSales)
    };
  });

  const totals = perHarvest.reduce((sum, row) => ({
    birds: sum.birds + row.birds,
    kilos: sum.kilos + row.kilos,
    chickenSales: sum.chickenSales + row.chickenSales,
    byproductQty: sum.byproductQty + row.byproductQty,
    byproductSales: sum.byproductSales + row.byproductSales,
    grossSales: sum.grossSales + row.grossSales,
    permitShipping: sum.permitShipping + row.permitShipping,
    tollingFee: sum.tollingFee + row.tollingFee,
    docAddOn: sum.docAddOn + row.docAddOn,
    truckingFee: sum.truckingFee + row.truckingFee,
    totalExpenses: sum.totalExpenses + row.totalExpenses,
    netSales: sum.netSales + row.netSales
  }), {
    birds: 0,
    kilos: 0,
    chickenSales: 0,
    byproductQty: 0,
    byproductSales: 0,
    grossSales: 0,
    permitShipping: 0,
    tollingFee: 0,
    docAddOn: 0,
    truckingFee: 0,
    totalExpenses: 0,
    netSales: 0
  });
  const financingTotal = (report?.financingItems || []).reduce((sum, row) => sum + getFinancingAmount(row), 0);
  const netProceeds = totals.netSales - financingTotal;

  return {
    perHarvest,
    totals: {
      ...totals,
      kilos: Number(totals.kilos.toFixed(3)),
      byproductQty: Number(totals.byproductQty.toFixed(3)),
      financingTotal: roundMoney(financingTotal),
      netProceeds: roundMoney(netProceeds),
      netProceedsPerBird: totals.birds > 0 ? Number((netProceeds / totals.birds).toFixed(4)) : 0
    }
  };
}

function inputValue(value) {
  return value === null || value === undefined ? '' : value;
}

function NumberInput({ value, onChange, disabled = false, step = '0.01', min = '0', className = '' }) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={inputValue(value)}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full min-w-20 rounded-xl border border-app-border bg-app-bg px-2 py-1.5 text-right text-app-text outline-none focus:ring-2 focus:ring-app-accent/20 disabled:opacity-40 disabled:cursor-not-allowed font-jetbrains text-sm font-bold ${className}`}
    />
  );
}

function TextInput({ value, onChange, disabled = false, className = '' }) {
  return (
    <input
      type="text"
      value={inputValue(value)}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full min-w-28 rounded-xl border border-app-border bg-app-bg px-2 py-1.5 text-app-text outline-none focus:ring-2 focus:ring-app-accent/20 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold ${className}`}
    />
  );
}

function KpiCard({ label, value, tone = 'default' }) {
  const toneClass = tone === 'good'
    ? 'text-app-success'
    : tone === 'bad'
      ? 'text-app-danger'
      : 'text-app-text';

  return (
    <div className="rounded-xl border border-app-border bg-app-card p-4 shadow-sm font-hanken">
      <p className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">{label}</p>
      <p className={`mt-1 text-lg font-black font-jetbrains ${toneClass}`}>{value}</p>
    </div>
  );
}

export default function HarvestRecording({ activeBatch, token, readOnly = false, onLedgerPosted, onBatchesChanged }) {
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const { success, error: toastError, confirm } = useNotification();

  const summary = useMemo(() => calculateSummary(report), [report]);
  const isLocked = readOnly || report?.status === 'Posted';

  useEffect(() => {
    if (!token || !activeBatch?.id) {
      setTimeout(() => {
        setReport(null);
      }, 0);
      return;
    }

    const fetchReport = async () => {
      setIsLoading(true);

      try {
        const data = await apiClient.get(`/api/batches/${activeBatch.id}/harvest-report`);
        setReport(data);
      } catch (err) {
        console.error(err);
        toastError(err.message || 'Cannot connect to harvest recording.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [activeBatch?.id, token, toastError]);

  const updateReportField = (field, value) => {
    setReport((current) => ({ ...current, [field]: value }));
  };

  const updateRow = (collection, index, field, value) => {
    setReport((current) => ({
      ...current,
      [collection]: current[collection].map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: value } : row
      ))
    }));
  };

  const addRow = (collection, row) => {
    setReport((current) => ({
      ...current,
      [collection]: [...current[collection], { ...row, sortOrder: current[collection].length + 1 }]
    }));
  };

  const removeRow = (collection, index) => {
    setReport((current) => ({
      ...current,
      [collection]: current[collection].filter((_, rowIndex) => rowIndex !== index)
    }));
  };

  const saveReport = async () => {
    if (!report || isLocked) return;

    setIsSaving(true);

    try {
      const data = await apiClient.put(`/api/batches/${activeBatch.id}/harvest-report`, report);
      setReport(data);
      success('Harvest report saved successfully!');
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot save harvest report right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const postSummaryToLedger = async () => {
    if (!report || isLocked) return;

    const confirmed = await confirm({
      title: 'Post Harvest Summary',
      message: 'Are you sure you want to post this harvest summary to the ledger? This will lock the harvest report.',
      confirmText: 'Post Summary',
      danger: false
    });
    if (!confirmed) return;

    setIsPosting(true);

    try {
      const data = await apiClient.post(`/api/batches/${activeBatch.id}/harvest-report/post-ledger`);
      setReport(data);
      success('Harvest summary posted to the ledger.');
      onBatchesChanged?.();
      onLedgerPosted?.();
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Cannot post harvest summary right now.');
    } finally {
      setIsPosting(false);
    }
  };

  if (!activeBatch?.id) {
    return (
      <div className="app-page font-hanken">
        <div className="rounded-xl border border-app-border bg-app-card p-5">
          <h2 className="text-2xl font-black text-app-text">Harvest Recording</h2>
          <p className="mt-2 text-sm font-bold text-app-text-secondary">Select a batch before recording harvest details.</p>
        </div>
      </div>
    );
  }

  if (isLoading || !report) {
    return (
      <div className="app-page font-hanken">
        <div className="rounded-xl border border-app-border bg-app-card p-5">
          <p className="text-sm font-bold text-app-text-secondary">Loading harvest recording...</p>
        </div>
      </div>
    );
  }

  const exportToCSV = () => {
    if (!report) return;
    const headers = ['Harvest Order', 'Date', 'Birds', 'Gross Sales', 'Permit Shipping', 'Tolling Fee', 'DOC Add-on', 'Trucking', 'Expenses', 'Net Sales'];
    const rows = summary.perHarvest.map((row, index) => [
      `${row.harvestOrder} Harvest`,
      report.harvestEvents[index]?.harvestDate || '--',
      row.birds,
      row.grossSales,
      report.harvestEvents[index]?.permitShipping || 0,
      report.harvestEvents[index]?.tollingFee || 0,
      row.docAddOn,
      row.trucking,
      row.expenses,
      row.netSales
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `harvest_report_${activeBatch?.id}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-page space-y-6 font-hanken">
      <div className="mb-2 mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-app-text">Harvest Recording</h2>
          <p className="mt-1 text-sm text-app-text-secondary">
            Batch <span className="font-bold font-jetbrains">{activeBatch.id}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-wider font-jetbrains ${
            report.status === 'Posted'
              ? 'bg-app-success-bg text-app-success border-app-success/20'
              : 'bg-app-warning-bg text-app-warning border-app-warning/20'
          }`}>
            {report.status}
          </span>
          <button
            type="button"
            onClick={exportToCSV}
            className="rounded-xl bg-app-card text-app-text border border-app-border px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={saveReport}
            disabled={isLocked || isSaving}
            className="rounded-xl bg-app-bg text-app-text border border-app-border px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={postSummaryToLedger}
            disabled={isLocked || isPosting}
            className="rounded-xl bg-app-accent text-app-on-accent px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPosting ? 'Posting...' : 'Post Summary'}
          </button>
        </div>
      </div>

      {!isLocked && (
        <div className="bg-app-accent/5 border border-app-accent/20 p-4.5 rounded-2xl text-xs space-y-2.5 shadow-sm animate-toast-in text-app-text-secondary">
          <p className="font-extrabold text-app-accent flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">menu_book</span>
            Guided Harvest Workflow Checklist
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1 leading-normal">
            <div className="flex gap-2">
              <span className="h-5 w-5 bg-app-accent/10 text-app-accent border border-app-accent/20 rounded-full flex items-center justify-center shrink-0 font-jetbrains font-bold text-[10px]">1</span>
              <div>
                <p className="font-extrabold text-app-text">Setup Settings</p>
                <p className="text-[11px] mt-0.5">Enter source filename, DOC add-on, and trucking fee rates per bird.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="h-5 w-5 bg-app-accent/10 text-app-accent border border-app-accent/20 rounded-full flex items-center justify-center shrink-0 font-jetbrains font-bold text-[10px]">2</span>
              <div>
                <p className="font-extrabold text-app-text">Event Dates & Permits</p>
                <p className="text-[11px] mt-0.5">Define dates for each harvest event, tolling fees, and permit records.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="h-5 w-5 bg-app-accent/10 text-app-accent border border-app-accent/20 rounded-full flex items-center justify-center shrink-0 font-jetbrains font-bold text-[10px]">3</span>
              <div>
                <p className="font-extrabold text-app-text">Post & Lock Summary</p>
                <p className="text-[11px] mt-0.5">Review gross sales and net proceeds, then click "Post Summary" to link to the finance ledger.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total Birds" value={`${formatNumber(summary.totals.birds)} hd`} />
        <KpiCard label="Total Kilos" value={`${formatNumber(summary.totals.kilos, 1)} kg`} />
        <KpiCard label="Gross Sales" value={formatMoney(summary.totals.grossSales)} />
        <KpiCard label="Harvest Expenses" value={formatMoney(summary.totals.totalExpenses)} tone="bad" />
        <KpiCard
          label="Net Proceeds"
          value={formatMoney(summary.totals.netProceeds)}
          tone={summary.totals.netProceeds >= 0 ? 'good' : 'bad'}
        />
      </div>

      <section className="rounded-xl border border-app-border bg-app-card p-5 shadow-sm">
        <h3 className="mb-4 text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Report Setup</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Source File</span>
            <TextInput value={report.sourceFilename} disabled={isLocked} onChange={(value) => updateReportField('sourceFilename', value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">DOC Add-on / Bird</span>
            <NumberInput value={report.docAddOnRatePerBird} disabled={isLocked} onChange={(value) => updateReportField('docAddOnRatePerBird', value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Trucking / Bird</span>
            <NumberInput value={report.truckingFeePerBird} disabled={isLocked} onChange={(value) => updateReportField('truckingFeePerBird', value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Notes</span>
            <TextInput value={report.notes} disabled={isLocked} onChange={(value) => updateReportField('notes', value)} />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-app-border bg-app-card p-5 shadow-sm">
        <h3 className="mb-4 text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Harvest Net Summary</h3>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-xs">
            <thead>
              <tr className="text-left text-app-text-secondary text-[10px] font-black uppercase tracking-wider">
                <th className="p-2">Harvest</th>
                <th className="p-2">Date</th>
                <th className="p-2 text-right">Birds</th>
                <th className="p-2 text-right">Gross Sales</th>
                <th className="p-2 text-right">Permit</th>
                <th className="p-2 text-right">Tolling</th>
                <th className="p-2 text-right">DOC Add-on</th>
                <th className="p-2 text-right">Trucking</th>
                <th className="p-2 text-right">Expenses</th>
                <th className="p-2 text-right">Net Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40 text-app-text">
              {summary.perHarvest.map((row, index) => (
                <tr key={row.harvestOrder}>
                  <td className="p-2 font-black text-app-text">{row.harvestOrder} Harvest</td>
                  <td className="p-2">
                    <input
                      type="date"
                      value={report.harvestEvents[index]?.harvestDate || ''}
                      disabled={isLocked}
                      onChange={(event) => updateRow('harvestEvents', index, 'harvestDate', event.target.value)}
                      className="w-full rounded-xl border border-app-border bg-app-bg px-2 py-1.5 text-app-text outline-none focus:ring-2 focus:ring-app-accent/20 disabled:opacity-40 font-jetbrains text-sm font-bold"
                    />
                  </td>
                  <td className="p-2 text-right font-black font-jetbrains">{formatNumber(row.birds)}</td>
                  <td className="p-2 text-right font-jetbrains">{formatMoney(row.grossSales)}</td>
                  <td className="p-2"><NumberInput value={report.harvestEvents[index]?.permitShipping} disabled={isLocked} onChange={(value) => updateRow('harvestEvents', index, 'permitShipping', value)} /></td>
                  <td className="p-2"><NumberInput value={report.harvestEvents[index]?.tollingFee} disabled={isLocked} onChange={(value) => updateRow('harvestEvents', index, 'tollingFee', value)} /></td>
                  <td className="p-2 text-right font-jetbrains">{formatMoney(row.docAddOn)}</td>
                  <td className="p-2 text-right font-jetbrains">{formatMoney(row.truckingFee)}</td>
                  <td className="p-2 text-right font-black text-app-danger font-jetbrains">{formatMoney(row.totalExpenses)}</td>
                  <td className={`p-2 text-right font-black font-jetbrains ${row.netSales >= 0 ? 'text-app-success' : 'text-app-danger'}`}>{formatMoney(row.netSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-app-border bg-app-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Chicken Sales</h3>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => addRow('chickenSales', { item: '', basePricePerKg: '', harvest1Birds: '', harvest1Kilos: '', harvest2Birds: '', harvest2Kilos: '', harvest3Birds: '', harvest3Kilos: '', finalRate: '', notes: '' })}
            className="rounded-xl border border-app-border bg-app-bg px-3 py-1.5 text-xs font-black text-app-text-secondary hover:border-app-accent hover:text-app-accent hover:bg-app-accent/5 transition-all cursor-pointer disabled:opacity-40"
          >
            Add Row
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1320px] w-full text-xs">
            <thead>
              <tr className="text-left text-app-text-secondary text-[10px] font-black uppercase tracking-wider">
                <th className="p-2">Item</th>
                <th className="p-2 text-right">Base Rate</th>
                <th className="p-2 text-right">1st Birds</th>
                <th className="p-2 text-right">1st Kg</th>
                <th className="p-2 text-right">1st Sales</th>
                <th className="p-2 text-right">2nd Birds</th>
                <th className="p-2 text-right">2nd Kg</th>
                <th className="p-2 text-right">2nd Sales</th>
                <th className="p-2 text-right">3rd Birds</th>
                <th className="p-2 text-right">3rd Kg</th>
                <th className="p-2 text-right">3rd Sales</th>
                <th className="p-2 text-right">Total Birds</th>
                <th className="p-2 text-right">Total Kg</th>
                <th className="p-2 text-right">Final Rate</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40 text-app-text">
              {report.chickenSales.map((row, index) => {
                const finalRate = numberValue(row.finalRate, numberValue(row.basePricePerKg));
                const harvest1Sales = numberValue(row.harvest1Kilos) * finalRate;
                const harvest2Sales = numberValue(row.harvest2Kilos) * finalRate;
                const harvest3Sales = numberValue(row.harvest3Kilos) * finalRate;
                const totalBirds = numberValue(row.harvest1Birds) + numberValue(row.harvest2Birds) + numberValue(row.harvest3Birds);
                const totalKilos = numberValue(row.harvest1Kilos) + numberValue(row.harvest2Kilos) + numberValue(row.harvest3Kilos);

                return (
                  <tr key={`${row.item}-${index}`}>
                    <td className="p-2"><TextInput value={row.item} disabled={isLocked} onChange={(value) => updateRow('chickenSales', index, 'item', value)} /></td>
                    <td className="p-2"><NumberInput value={row.basePricePerKg} disabled={isLocked} onChange={(value) => updateRow('chickenSales', index, 'basePricePerKg', value)} /></td>
                    <td className="p-2"><NumberInput step="1" value={row.harvest1Birds} disabled={isLocked} onChange={(value) => updateRow('chickenSales', index, 'harvest1Birds', value)} /></td>
                    <td className="p-2"><NumberInput value={row.harvest1Kilos} disabled={isLocked} onChange={(value) => updateRow('chickenSales', index, 'harvest1Kilos', value)} /></td>
                    <td className="p-2 text-right font-jetbrains">{formatMoney(harvest1Sales)}</td>
                    <td className="p-2"><NumberInput step="1" value={row.harvest2Birds} disabled={isLocked} onChange={(value) => updateRow('chickenSales', index, 'harvest2Birds', value)} /></td>
                    <td className="p-2"><NumberInput value={row.harvest2Kilos} disabled={isLocked} onChange={(value) => updateRow('chickenSales', index, 'harvest2Kilos', value)} /></td>
                    <td className="p-2 text-right font-jetbrains">{formatMoney(harvest2Sales)}</td>
                    <td className="p-2"><NumberInput step="1" value={row.harvest3Birds} disabled={isLocked} onChange={(value) => updateRow('chickenSales', index, 'harvest3Birds', value)} /></td>
                    <td className="p-2"><NumberInput value={row.harvest3Kilos} disabled={isLocked} onChange={(value) => updateRow('chickenSales', index, 'harvest3Kilos', value)} /></td>
                    <td className="p-2 text-right font-jetbrains">{formatMoney(harvest3Sales)}</td>
                    <td className="p-2 text-right font-black font-jetbrains">{formatNumber(totalBirds)}</td>
                    <td className="p-2 text-right font-black font-jetbrains">{formatNumber(totalKilos, 1)}</td>
                    <td className="p-2"><NumberInput value={row.finalRate} disabled={isLocked} onChange={(value) => updateRow('chickenSales', index, 'finalRate', value)} /></td>
                    <td className="p-2 text-right">
                      <button type="button" disabled={isLocked} onClick={() => removeRow('chickenSales', index)} className="text-xs font-black uppercase tracking-wider text-app-text-secondary hover:text-app-danger transition-colors cursor-pointer disabled:opacity-40">Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-app-border bg-app-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">By-products</h3>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => addRow('byproductSales', { item: '', originalRate: '', harvest1Qty: '', harvest1Sales: '', harvest2Qty: '', harvest2Sales: '', harvest3Qty: '', harvest3Sales: '', finalRate: '', notes: '' })}
            className="rounded-xl border border-app-border bg-app-bg px-3 py-1.5 text-xs font-black text-app-text-secondary hover:border-app-accent hover:text-app-accent hover:bg-app-accent/5 transition-all cursor-pointer disabled:opacity-40"
          >
            Add Row
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-xs">
            <thead>
              <tr className="text-left text-app-text-secondary text-[10px] font-black uppercase tracking-wider">
                <th className="p-2">Item</th>
                <th className="p-2 text-right">Original Rate</th>
                <th className="p-2 text-right">1st Qty</th>
                <th className="p-2 text-right">1st Sales</th>
                <th className="p-2 text-right">2nd Qty</th>
                <th className="p-2 text-right">2nd Sales</th>
                <th className="p-2 text-right">3rd Qty</th>
                <th className="p-2 text-right">3rd Sales</th>
                <th className="p-2 text-right">Total Qty</th>
                <th className="p-2 text-right">Final Rate</th>
                <th className="p-2 text-right">Final Amount</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40 text-app-text">
              {report.byproductSales.map((row, index) => {
                const totalQty = numberValue(row.harvest1Qty) + numberValue(row.harvest2Qty) + numberValue(row.harvest3Qty);
                const finalAmount = totalQty * numberValue(row.finalRate, numberValue(row.originalRate));

                return (
                  <tr key={`${row.item}-${index}`}>
                    <td className="p-2"><TextInput value={row.item} disabled={isLocked} onChange={(value) => updateRow('byproductSales', index, 'item', value)} /></td>
                    <td className="p-2"><NumberInput value={row.originalRate} disabled={isLocked} onChange={(value) => updateRow('byproductSales', index, 'originalRate', value)} /></td>
                    <td className="p-2"><NumberInput value={row.harvest1Qty} disabled={isLocked} onChange={(value) => updateRow('byproductSales', index, 'harvest1Qty', value)} /></td>
                    <td className="p-2"><NumberInput value={row.harvest1Sales} disabled={isLocked} onChange={(value) => updateRow('byproductSales', index, 'harvest1Sales', value)} /></td>
                    <td className="p-2"><NumberInput value={row.harvest2Qty} disabled={isLocked} onChange={(value) => updateRow('byproductSales', index, 'harvest2Qty', value)} /></td>
                    <td className="p-2"><NumberInput value={row.harvest2Sales} disabled={isLocked} onChange={(value) => updateRow('byproductSales', index, 'harvest2Sales', value)} /></td>
                    <td className="p-2"><NumberInput value={row.harvest3Qty} disabled={isLocked} onChange={(value) => updateRow('byproductSales', index, 'harvest3Qty', value)} /></td>
                    <td className="p-2"><NumberInput value={row.harvest3Sales} disabled={isLocked} onChange={(value) => updateRow('byproductSales', index, 'harvest3Sales', value)} /></td>
                    <td className="p-2 text-right font-black font-jetbrains">{formatNumber(totalQty, 1)}</td>
                    <td className="p-2"><NumberInput value={row.finalRate} disabled={isLocked} onChange={(value) => updateRow('byproductSales', index, 'finalRate', value)} /></td>
                    <td className="p-2 text-right font-black font-jetbrains">{formatMoney(finalAmount)}</td>
                    <td className="p-2 text-right">
                      <button type="button" disabled={isLocked} onClick={() => removeRow('byproductSales', index)} className="text-xs font-black uppercase tracking-wider text-app-text-secondary hover:text-app-danger transition-colors cursor-pointer disabled:opacity-40">Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-app-border bg-app-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">Financing / Actual Expenses</h3>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => addRow('financingItems', { item: '', category: 'Miscellaneous', quantity: '', unitCost: '', amount: '', notes: '' })}
            className="rounded-xl border border-app-border bg-app-bg px-3 py-1.5 text-xs font-black text-app-text-secondary hover:border-app-accent hover:text-app-accent hover:bg-app-accent/5 transition-all cursor-pointer disabled:opacity-40"
          >
            Add Row
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-xs">
            <thead>
              <tr className="text-left text-app-text-secondary text-[10px] font-black uppercase tracking-wider">
                <th className="p-2">Item</th>
                <th className="p-2">Ledger Category</th>
                <th className="p-2 text-right">Quantity</th>
                <th className="p-2 text-right">Unit Cost</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2">Notes</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40 text-app-text">
              {report.financingItems.map((row, index) => (
                <tr key={`${row.item}-${index}`}>
                  <td className="p-2"><TextInput value={row.item} disabled={isLocked} onChange={(value) => updateRow('financingItems', index, 'item', value)} /></td>
                  <td className="p-2">
                    <select
                      value={row.category || 'Miscellaneous'}
                      disabled={isLocked}
                      onChange={(event) => updateRow('financingItems', index, 'category', event.target.value)}
                      className="w-full min-w-36 rounded-xl border border-app-border bg-app-bg px-2 py-1.5 text-app-text outline-none focus:ring-2 focus:ring-app-accent/20 disabled:opacity-40 font-bold text-sm"
                    >
                      {opexCategories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2"><NumberInput value={row.quantity} disabled={isLocked} onChange={(value) => updateRow('financingItems', index, 'quantity', value)} /></td>
                  <td className="p-2"><NumberInput value={row.unitCost} disabled={isLocked} onChange={(value) => updateRow('financingItems', index, 'unitCost', value)} /></td>
                  <td className="p-2"><NumberInput value={row.amount} disabled={isLocked} onChange={(value) => updateRow('financingItems', index, 'amount', value)} /></td>
                  <td className="p-2"><TextInput value={row.notes} disabled={isLocked} onChange={(value) => updateRow('financingItems', index, 'notes', value)} /></td>
                  <td className="p-2 text-right">
                    <button type="button" disabled={isLocked} onClick={() => removeRow('financingItems', index)} className="text-xs font-black uppercase tracking-wider text-app-text-secondary hover:text-app-danger transition-colors cursor-pointer disabled:opacity-40">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-app-border/40 text-right font-black text-app-text">
                <td className="p-2" colSpan={4}>Total Financing</td>
                <td className="p-2 font-jetbrains">{formatMoney(summary.totals.financingTotal)}</td>
                <td className="p-2" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Net Sales" value={formatMoney(summary.totals.netSales)} />
        <KpiCard label="Less Financing" value={formatMoney(summary.totals.financingTotal)} tone="bad" />
        <KpiCard label="Net / Bird" value={formatMoney(summary.totals.netProceedsPerBird)} tone={summary.totals.netProceedsPerBird >= 0 ? 'good' : 'bad'} />
        <KpiCard label="Ledger Entries" value={report.ledgerTransactionIds?.length || 0} />
      </div>
    </div>
  );
}
