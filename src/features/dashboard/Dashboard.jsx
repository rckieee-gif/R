import { useEffect, useMemo, useState } from 'react';
import {
  BAG_WEIGHT_KG,
  calculateTargetFeedForHeads,
  getAgeDay
} from '../../shared/utils/broilerTargets';
import { getQueue } from '../../offline/db';
import { apiClient } from '../../shared/utils/apiClient';
import OfflineStaleBanner from '../../shared/components/OfflineStaleBanner';
import { AlertCard, Card, MetricCard, PageHeader } from '../../shared/components/OctavioUI';
import { getArrivalMetrics } from '../../shared/utils/arrivalMetrics';

function todayInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function getDateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function getOperationalHeadCount(arrivalMetrics) {
  const arrivedDoc = Number(arrivalMetrics?.arrivedDoc || 0);
  const doaCount = Number(arrivalMetrics?.doaCount || 0);
  const netChicksPlaced = Number(arrivalMetrics?.netChicksPlaced || 0);

  if (arrivedDoc > 0) {
    if (netChicksPlaced > 0 || doaCount > 0) return Math.max(netChicksPlaced, 0);
    return arrivedDoc;
  }

  return 0;
}

function isRevenue(tx) {
  return tx?.fundingNature === 'Revenue' || tx?.fundingNature === 'Other Revenue' || tx?.type === 'Income';
}

function isLowStock(item) {
  const currentStock = Number(item.currentStock || item.stock || 0);
  const reorderLevel = Number(item.reorderLevel || item.reorderAt || 0);
  return reorderLevel > 0 && currentStock <= reorderLevel;
}

function ListItems({ items, empty }) {
  if (!items.length) return <p className="text-sm text-app-text-secondary">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.slice(0, 3).map((item) => (
        <li key={item} className="truncate">{item}</li>
      ))}
    </ul>
  );
}

export default function Dashboard({ setActiveScreen, logs = [], activeBatch }) {
  const today = todayInput();
  const currentAgeDays = activeBatch?.startDate ? getAgeDay(activeBatch.startDate, today) : null;
  const [feedItems, setFeedItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadings, setLoadings] = useState([]);
  const [queueItems, setQueueItems] = useState([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [feedData, transactionData, loadingData, queueData] = await Promise.all([
          apiClient.get('/api/inventory/items?category=Feed', { expectArray: true }).catch(() => []),
          activeBatch?.id
            ? apiClient.get(`/api/batches/${activeBatch.id}/transactions`, { expectArray: true }).catch(() => [])
            : Promise.resolve([]),
          activeBatch?.id
            ? apiClient.get(`/api/batches/${activeBatch.id}/loadings`, { expectArray: true }).catch(() => [])
            : Promise.resolve([]),
          getQueue().catch(() => [])
        ]);

        if (!active) return;
        setFeedItems(feedData);
        setTransactions(transactionData);
        setLoadings(loadingData);
        setQueueItems(queueData);
      } catch (err) {
        console.error('Failed to load dashboard summary:', err);
      }
    };

    loadData();
    const handleSyncChange = () => loadData();
    window.addEventListener('sync-status-changed', handleSyncChange);

    return () => {
      active = false;
      window.removeEventListener('sync-status-changed', handleSyncChange);
    };
  }, [activeBatch?.id]);

  const arrivalMetrics = getArrivalMetrics(activeBatch, loadings, { requireExplicitArrival: true });
  const hasConfirmedArrival = Boolean(arrivalMetrics.hasConfirmedArrival);
  const arrivedDoc = Number(arrivalMetrics.arrivedDoc || 0);
  const plannedFlock = Number(activeBatch?.plannedFlock || 0);
  const operationalHeads = getOperationalHeadCount(arrivalMetrics);
  const totalMortality = logs.reduce((sum, log) => sum + Number(log.mortality || 0), 0);
  const liveBirds = hasConfirmedArrival ? Math.max(operationalHeads - totalMortality, 0) : null;
  const totalFeedBags = logs.reduce((sum, log) => sum + Number(log.feed || 0), 0);
  const feedTarget = calculateTargetFeedForHeads(operationalHeads, currentAgeDays);
  const varianceKg = feedTarget ? totalFeedBags * BAG_WEIGHT_KG - feedTarget.targetKg : null;
  const variancePercent = feedTarget?.targetKg ? (varianceKg / feedTarget.targetKg) * 100 : null;
  const configuredMortalityAllowance = Number(activeBatch?.mortalityAllowance || 0);
  const mortalityLimit = configuredMortalityAllowance > 0
    ? configuredMortalityAllowance
    : Math.max(5, Math.ceil(operationalHeads * 0.005));
  const mortalityLabel = configuredMortalityAllowance > 0 ? 'Allowance Used' : 'Warning Limit Used';
  const mortalityToneClass = !hasConfirmedArrival
    ? 'text-dashboard-text'
    : totalMortality <= mortalityLimit
      ? 'text-dashboard-success'
      : totalMortality <= mortalityLimit * 2
        ? 'text-dashboard-warning'
        : 'text-dashboard-danger';
  const mortalityDetail = !hasConfirmedArrival
    ? 'Record arrived DOC to track mortality allowance.'
    : totalMortality <= mortalityLimit
      ? `${formatNumber(mortalityLimit - totalMortality)} heads remaining`
      : 'Allowance exceeded';

  const activeLoadingRows = hasConfirmedArrival
    ? loadings.filter((loading) => Number(loading.chicksLoaded || loading.chicks_loaded || 0) > 0)
    : [];
  const todaysLogs = logs.filter((log) => log.date === today);
  const missingLogBuildings = activeLoadingRows
    .filter((loading) => !todaysLogs.some((log) => String(log.building || '').toUpperCase() === String(loading.building || '').toUpperCase()))
    .map((loading) => loading.building || loading.buildingName || 'Building');

  const lowStockItems = feedItems.filter(isLowStock);
  const revenueTransactions = transactions.filter(isRevenue);
  const expenseTransactions = transactions.filter((tx) => !isRevenue(tx));
  const totalSales = revenueTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const totalExpenses = expenseTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const estimatedProfit = totalSales - totalExpenses;
  const pendingTasks = queueItems.filter((item) => item.status !== 'failed').length + missingLogBuildings.length;
  const failedQueueItems = queueItems.filter((item) => item.status === 'failed');
  const upcomingHarvests = activeBatch?.targetHarvestDate ? 1 : 0;

  const warnings = useMemo(() => {
    const list = [];

    if (hasConfirmedArrival && plannedFlock > 0 && arrivedDoc !== plannedFlock) {
      const diff = Math.abs(arrivedDoc - plannedFlock);
      list.push(`Arrival variance: actual arrival is ${diff} ${arrivedDoc > plannedFlock ? 'above' : 'below'} planned flock.`);
    }

    if (hasConfirmedArrival && totalMortality > mortalityLimit) {
      list.push(`High cumulative mortality: ${formatNumber(totalMortality)} heads vs ${formatNumber(mortalityLimit)} limit.`);
    }

    if (variancePercent !== null && Math.abs(variancePercent) >= 25) {
      list.push(`Feed variance is ${variancePercent > 0 ? '+' : ''}${formatNumber(variancePercent, 1)}% vs target.`);
    }

    if (!list.length) {
      list.push(hasConfirmedArrival ? 'Operations are inside the current warning guardrails.' : 'Record arrived DOC to unlock active operations warnings.');
    }

    return list;
  }, [arrivedDoc, hasConfirmedArrival, mortalityLimit, plannedFlock, totalMortality, variancePercent]);

  const harvestRows = activeLoadingRows.length
    ? activeLoadingRows.slice(0, 3).map((loading) => ({
      id: `${activeBatch?.id}-${loading.building || loading.buildingName}`,
      batch: activeBatch?.id || 'Batch',
      building: loading.building || loading.buildingName || 'All',
      employee: loading.employeeName || loading.employee || 'Assigned team',
      date: getDateOnly(activeBatch?.targetHarvestDate)
    }))
    : activeBatch?.targetHarvestDate
      ? [{
        id: activeBatch.id,
        batch: activeBatch.id,
        building: 'All buildings',
        employee: 'Assigned team',
        date: getDateOnly(activeBatch.targetHarvestDate)
      }]
      : [];

  const metricCards = [
    {
      label: 'Active Batch',
      value: activeBatch?.id ? '1' : '0',
      detail: activeBatch?.id || 'No active batch',
      icon: 'psychiatry',
      tone: 'success'
    },
    {
      label: 'Pending Tasks',
      value: formatNumber(pendingTasks),
      detail: `${missingLogBuildings.length} daily logs due`,
      icon: 'checklist',
      tone: 'warning'
    },
    {
      label: 'Low-stock Items',
      value: formatNumber(lowStockItems.length),
      detail: 'At or below reorder level',
      icon: 'inventory_2',
      tone: lowStockItems.length ? 'danger' : 'success'
    },
    {
      label: 'Upcoming Harvests',
      value: formatNumber(upcomingHarvests),
      detail: 'Next 30 days',
      icon: 'agriculture',
      tone: 'warning'
    },
    {
      label: 'Total Sales',
      value: formatCurrency(totalSales),
      detail: `${revenueTransactions.length} revenue records`,
      icon: 'payments',
      tone: 'success'
    },
    {
      label: 'Total Expenses',
      value: formatCurrency(totalExpenses),
      detail: `${expenseTransactions.length} expense records`,
      icon: 'receipt_long',
      tone: 'beige'
    },
    {
      label: 'Estimated Profit',
      value: formatCurrency(estimatedProfit),
      detail: estimatedProfit >= 0 ? 'Surplus' : 'Deficit',
      icon: 'trending_up',
      tone: estimatedProfit >= 0 ? 'success' : 'danger'
    },
    {
      label: 'Live Birds',
      value: hasConfirmedArrival ? formatNumber(liveBirds) : '--',
      detail: hasConfirmedArrival && plannedFlock > 0 ? `${formatNumber((liveBirds / plannedFlock) * 100, 1)}% of plan` : 'Awaiting arrived DOC',
      icon: 'eco',
      tone: 'beige'
    },
    {
      label: mortalityLabel,
      value: hasConfirmedArrival ? `${formatNumber(totalMortality)} / ${formatNumber(mortalityLimit)}` : `-- / ${formatNumber(mortalityLimit)}`,
      detail: mortalityDetail,
      icon: 'warning',
      tone: totalMortality > mortalityLimit ? 'danger' : 'success',
      valueClassName: mortalityToneClass
    },
    {
      label: 'Feed Variance',
      value: variancePercent === null ? '--' : `${variancePercent > 0 ? '+' : ''}${formatNumber(variancePercent, 1)}%`,
      detail: feedTarget ? `${formatNumber(totalFeedBags, 1)} bags used` : 'Awaiting active feed target',
      icon: 'monitoring',
      tone: variancePercent === null || Math.abs(variancePercent) < 15 ? 'success' : 'warning'
    }
  ];

  return (
    <div className="octavio-wide-page">
      <PageHeader
        title="Welcome back, Octavio 🌱"
        subtitle="Here's what's happening around Octavio Farms today."
      />

      <OfflineStaleBanner data={[feedItems, transactions, loadings]} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <AlertCard title="Low stock alerts" icon="warning" tone={lowStockItems.length ? 'danger' : 'success'}>
          <ListItems
            items={lowStockItems.map((item) => `${item.name} — ${formatNumber(item.currentStock || 0)} ${item.unit || ''}`)}
            empty="No low stock alerts right now."
          />
        </AlertCard>

        <AlertCard title="Overdue tasks" icon="event_busy" tone={missingLogBuildings.length || failedQueueItems.length ? 'warning' : 'success'}>
          <ListItems
            items={[
              ...missingLogBuildings.map((building) => `Daily log needed for ${building}`),
              ...failedQueueItems.map((item) => `Sync retry needed: ${item.type || 'queued item'}`)
            ]}
            empty="No overdue tasks right now."
          />
        </AlertCard>

        <AlertCard title="Other alerts" icon="notifications" tone={warnings.length > 1 || warnings[0]?.startsWith('High') ? 'info' : 'success'}>
          <ListItems items={warnings} empty="No active alerts." />
        </AlertCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="octavio-serif text-xl font-bold">Harvest calendar</h2>
            <button
              type="button"
              onClick={() => setActiveScreen?.('harvest')}
              className="text-xs font-semibold text-app-accent hover:underline cursor-pointer"
            >
              View all →
            </button>
          </div>

          <div className="space-y-3">
            {harvestRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 border-b border-app-border pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-bold text-app-text truncate">{row.batch} — {row.building}</p>
                  <p className="text-xs text-app-text-secondary truncate">{row.employee}</p>
                </div>
                <span className="rounded-full bg-[#f1dfbd] px-3 py-1 text-xs font-bold text-app-text">
                  {row.date || '--'}
                </span>
              </div>
            ))}
            {harvestRows.length === 0 && (
              <p className="text-sm text-app-text-secondary">No harvest dates scheduled yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="octavio-serif text-xl font-bold">Recent sales</h2>
            <button
              type="button"
              onClick={() => setActiveScreen?.('ledger')}
              className="text-xs font-semibold text-app-accent hover:underline cursor-pointer"
            >
              View all →
            </button>
          </div>

          <div className="space-y-3">
            {revenueTransactions.slice(0, 3).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-4 border-b border-app-border pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-bold text-app-text truncate">{tx.description || tx.category || 'Sale'}</p>
                  <p className="text-xs text-app-text-secondary truncate">{tx.paidTo || tx.reference || 'Customer'} · {getDateOnly(tx.date)}</p>
                </div>
                <p className="font-bold text-app-text">{formatCurrency(tx.amount)}</p>
              </div>
            ))}
            {revenueTransactions.length === 0 && (
              <p className="text-sm text-app-text-secondary">No recent sales recorded.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
