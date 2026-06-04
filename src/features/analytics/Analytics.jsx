import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  BAG_WEIGHT_KG,
  calculateActualFcr,
  calculateTargetFeedForHeads,
  getAgeDay,
  getLastBroilerTargetDay
} from '../../shared/utils/broilerTargets';
import { getArrivalMetrics } from '../../shared/utils/arrivalMetrics';

const CHART_HEIGHT = 256;
const CHART_INITIAL_DIMENSION = { width: 640, height: CHART_HEIGHT };
const MORTALITY_WARNING_RATE = 0.005;
const MORTALITY_WARNING_HEADS = 5;

function formatMoney(amount) {
  return `PHP ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatNumber(amount, digits = 2) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '--';

  return Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatSignedNumber(amount, digits = 0) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '--';
  return `${Number(amount) > 0 ? '+' : ''}${formatNumber(amount, digits)}`;
}

function formatGrams(amount, digits = 1) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '--';
  return `${formatNumber(amount, digits)} g`;
}

function getCurveMaxDay(logs, startDate) {
  const lastTargetDay = getLastBroilerTargetDay();
  const todayDay = getAgeDay(startDate, new Date().toISOString().split('T')[0]) || 1;
  const maxLoggedDay = logs.reduce((maxDay, log) => {
    const ageDay = getAgeDay(startDate, log.date);
    return ageDay ? Math.max(maxDay, ageDay) : maxDay;
  }, 0);

  return Math.min(lastTargetDay, Math.max(todayDay, maxLoggedDay, 1));
}

function buildFeedCurveForHeads(logs, startDate, headCount) {
  if (!startDate || !headCount) return [];

  const maxDay = getCurveMaxDay(logs, startDate);
  const feedByDay = new Map();
  const mortalityByDay = new Map();
  const weightsByDay = new Map();

  logs.forEach((log) => {
    const ageDay = getAgeDay(startDate, log.date);
    if (!ageDay || ageDay > maxDay) return;

    feedByDay.set(ageDay, (feedByDay.get(ageDay) || 0) + Number(log.feed || 0));
    mortalityByDay.set(ageDay, (mortalityByDay.get(ageDay) || 0) + Number(log.mortality || 0));

    if (log.averageWeightGrams != null && Number(log.averageWeightGrams) > 0) {
      const current = weightsByDay.get(ageDay) || [];
      current.push(Number(log.averageWeightGrams));
      weightsByDay.set(ageDay, current);
    }
  });

  let cumulativeFeedBags = 0;
  let cumulativeMortality = 0;

  return Array.from({ length: maxDay }, (_, index) => {
    const day = index + 1;
    cumulativeFeedBags += feedByDay.get(day) || 0;
    cumulativeMortality += mortalityByDay.get(day) || 0;

    const target = calculateTargetFeedForHeads(headCount, day);
    const weights = weightsByDay.get(day) || [];
    const averageWeightGrams = weights.length
      ? weights.reduce((sum, weight) => sum + weight, 0) / weights.length
      : null;
    const actualFeedKg = cumulativeFeedBags * BAG_WEIGHT_KG;
    const liveHeads = Math.max(Number(headCount || 0) - cumulativeMortality, 0);
    const actualFcrValue = averageWeightGrams
      ? calculateActualFcr(actualFeedKg, liveHeads, averageWeightGrams)
      : null;

    return {
      day,
      dayLabel: `D${day}`,
      actualBags: Number(cumulativeFeedBags.toFixed(2)),
      targetBags: target ? Number(target.targetBags.toFixed(2)) : null,
      actualKg: Number(actualFeedKg.toFixed(2)),
      targetKg: target ? Number(target.targetKg.toFixed(2)) : null,
      varianceKg: target ? Number((actualFeedKg - target.targetKg).toFixed(2)) : null,
      targetFcr: target?.fcr ?? null,
      actualFcr: actualFcrValue == null ? null : Number(actualFcrValue.toFixed(2)),
      targetWeightGrams: target?.weightGrams ?? null,
      actualWeightGrams: averageWeightGrams
    };
  });
}

function buildFeedCurve(logs, activeBatch) {
  if (!activeBatch?.startDate || !activeBatch?.totalChicksLoaded) return [];

  return buildFeedCurveForHeads(logs, activeBatch.startDate, activeBatch.totalChicksLoaded);
}

function buildEmployeeFeedCurves(logs, activeBatch) {
  if (!activeBatch?.startDate) return [];

  const employees = new Map();

  logs.forEach((log) => {
    const hasEmployee = log.employeeId || log.employeeName;
    if (!hasEmployee) return;

    const employeeKey = String(log.employeeId || `name:${log.employeeName}`);
    const current = employees.get(employeeKey) || {
      employeeKey,
      employeeName: log.employeeName || 'Unassigned employee',
      handledBirds: 0,
      logs: []
    };

    current.employeeName = log.employeeName || current.employeeName;
    current.handledBirds = Math.max(current.handledBirds, Number(log.handledBirds || 0));
    current.logs.push(log);
    employees.set(employeeKey, current);
  });

  return Array.from(employees.values())
    .filter((employee) => employee.handledBirds > 0)
    .map((employee) => ({
      ...employee,
      curve: buildFeedCurveForHeads(employee.logs, activeBatch.startDate, employee.handledBirds)
    }))
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName));
}

function StableChartContainer({ children }) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={1}
      minHeight={CHART_HEIGHT}
      initialDimension={CHART_INITIAL_DIMENSION}
      debounce={50}
    >
      {children}
    </ResponsiveContainer>
  );
}

export default function Analytics({ transactions = [], logs = [], activeBatch, showFinancials = true }) {
  const [selectedEmployeeFeedKey, setSelectedEmployeeFeedKey] = useState('');

  const totalIncome = transactions
    .filter((tx) => tx.fundingNature === 'Revenue')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const totalExpense = transactions
    .filter((tx) => tx.fundingNature === 'OPEX' || tx.fundingNature === 'CAPEX')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;

  const categoryMap = {};
  transactions.forEach((tx) => {
    if (!categoryMap[tx.category]) {
      categoryMap[tx.category] = { category: tx.category, expense: 0, income: 0 };
    }

    if (tx.fundingNature === 'Revenue') {
      categoryMap[tx.category].income += Number(tx.amount || 0);
    } else if (tx.fundingNature === 'OPEX' || tx.fundingNature === 'CAPEX') {
      categoryMap[tx.category].expense += Number(tx.amount || 0);
    }
  });

  const financialData = Object.values(categoryMap)
    .filter((item) => item.expense > 0 || item.income > 0)
    .sort((a, b) => (b.expense + b.income) - (a.expense + a.income));

  const feedCurve = buildFeedCurve(logs, activeBatch);
  const employeeFeedCurves = buildEmployeeFeedCurves(logs, activeBatch);
  const selectedEmployeeFeed = employeeFeedCurves.find((employee) => employee.employeeKey === selectedEmployeeFeedKey)
    || employeeFeedCurves[0]
    || null;
  const selectedEmployeeFeedPoint = selectedEmployeeFeed?.curve[selectedEmployeeFeed.curve.length - 1] || null;
  const latestFeedPoint = feedCurve[feedCurve.length - 1] || null;
  const latestWeightPoint = [...feedCurve].reverse().find((point) => point.actualWeightGrams);
  const totalMortality = logs.reduce((sum, log) => sum + Number(log.mortality || 0), 0);
  const arrivalMetrics = getArrivalMetrics(activeBatch);
  const actualLoaded = Number(arrivalMetrics.arrivedDoc || activeBatch?.totalChicksLoaded || 0);
  const plannedFlock = Number(activeBatch?.plannedFlock || 0);
  const arrivalVariance = actualLoaded - plannedFlock;
  const hasArrivalPlan = plannedFlock > 0 && actualLoaded > 0;
  const arrivalVarianceTone = hasArrivalPlan && arrivalVariance < 0 ? 'text-app-warning' : 'text-app-success';
  const arrivalVarianceDetail = !hasArrivalPlan
    ? 'Set planned and loaded flock counts.'
    : arrivalVariance < 0
      ? `${formatNumber(Math.abs(arrivalVariance), 0)} fewer than planned.`
      : arrivalVariance > 0
        ? `${formatNumber(arrivalVariance, 0)} above planned.`
        : 'Actual arrival matches planned flock.';
  const configuredMortalityAllowance = Number(activeBatch?.mortalityAllowance || 0);
  const batchThreshold = configuredMortalityAllowance > 0
    ? configuredMortalityAllowance
    : Math.max(MORTALITY_WARNING_HEADS, Math.ceil(actualLoaded * MORTALITY_WARNING_RATE));
  const mortalityAllowanceUsedPercent = batchThreshold > 0
    ? Math.min(100, (totalMortality / batchThreshold) * 100)
    : 0;
  const mortalityAllowanceRemaining = Math.max(batchThreshold - totalMortality, 0);
  const mortalityAllowanceLabel = configuredMortalityAllowance > 0 ? 'Mortality Allowance' : 'Warning Limit Used';
  const mortalityToneClass = totalMortality <= batchThreshold ? 'text-app-success' :
    totalMortality <= batchThreshold * 2 ? 'text-app-warning' : 'text-app-danger';
  const mortalityBarClass = totalMortality <= batchThreshold ? 'bg-app-success' :
    totalMortality <= batchThreshold * 2 ? 'bg-app-warning' : 'bg-app-danger';
  const mortalityAllowanceDetail = mortalityAllowanceRemaining > 0
    ? `${formatNumber(mortalityAllowanceRemaining, 0)} heads remaining.`
    : `${configuredMortalityAllowance > 0 ? 'Allowance' : 'Limit'} exceeded.`;

  return (
    <div className="print-container report-page">
      <div className="mb-6 mt-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="print-title text-3xl font-extrabold text-app-text tracking-tight font-hanken">Reports</h2>
            <p className="text-app-text-secondary text-sm mt-1">
              {showFinancials ? 'Financials and production target tracking.' : 'Production target tracking.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print px-3 py-2 rounded-xl bg-app-accent text-app-on-accent text-xs font-black shadow-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            Print
          </button>
        </div>
      </div>

      {showFinancials && (
      <div className="screen-only grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="min-w-0 bg-app-card p-4 rounded-2xl shadow-sm border border-app-border">
          <p className="text-xs font-bold text-app-text-secondary uppercase tracking-wider">Net Profit</p>
          <p className={`text-2xl font-black mt-1 font-jetbrains ${netProfit >= 0 ? 'text-app-success' : 'text-app-danger'}`}>
            {formatMoney(netProfit)}
          </p>
        </div>

        <div className="min-w-0 bg-app-card p-4 rounded-2xl shadow-sm border border-app-border">
          <p className="text-xs font-bold text-app-text-secondary uppercase tracking-wider">Profit Margin</p>
          <p className={`text-2xl font-black mt-1 font-jetbrains ${profitMargin >= 15 ? 'text-app-accent' : 'text-app-warning'}`}>
            {profitMargin}%
          </p>
        </div>
      </div>
      )}

      <div className="screen-only grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <div className="min-w-0 bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Feed Target Var.</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${(latestFeedPoint?.varianceKg || 0) > 0 ? 'text-app-danger' : 'text-app-success'}`}>
            {latestFeedPoint ? `${formatSignedNumber(latestFeedPoint.varianceKg, 0)} kg` : '--'}
          </p>
        </div>

        <div className="min-w-0 bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Mortality</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${mortalityToneClass}`}>
            {Number(totalMortality || 0).toLocaleString()} hd
          </p>
        </div>

        <div className="min-w-0 bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Arrival DOA</p>
          <p className="text-lg font-black mt-1 font-jetbrains text-app-danger">
            {formatNumber(arrivalMetrics.doaCount, 0)}
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-snug text-app-text-secondary">
            Dead on arrival from DOC entry.
          </p>
        </div>

        <div className="min-w-0 bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Net Placed</p>
          <p className="text-lg font-black mt-1 font-jetbrains text-app-success">
            {formatNumber(arrivalMetrics.netChicksPlaced, 0)}
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-snug text-app-text-secondary">
            Arrived DOC less DOA.
          </p>
        </div>

        <div className="min-w-0 bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Arrival Sample Wt</p>
          <p className="text-lg font-black mt-1 font-jetbrains text-app-text">
            {formatGrams(arrivalMetrics.arrivalSampleWeightGrams)}
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-snug text-app-text-secondary">
            Weighted by arrived DOC.
          </p>
        </div>

        <div className="min-w-0 bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Arrival Variance</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${hasArrivalPlan ? arrivalVarianceTone : 'text-app-text'}`}>
            {hasArrivalPlan ? formatSignedNumber(arrivalVariance, 0) : '--'}
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-snug text-app-text-secondary">
            {arrivalVarianceDetail}
          </p>
        </div>

        <div className="min-w-0 bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">{mortalityAllowanceLabel}</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${mortalityToneClass}`}>
            {formatNumber(totalMortality, 0)} / {formatNumber(batchThreshold, 0)}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-app-border/40">
            <div
              className={`h-full rounded-full ${mortalityBarClass}`}
              style={{ width: `${mortalityAllowanceUsedPercent}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] font-semibold leading-snug text-app-text-secondary">
            {mortalityAllowanceDetail}
          </p>
        </div>
      </div>

      <div className="print-only mb-6">
        <table className="print-simple-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="numeric">Value</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {showFinancials && (
              <>
                <tr>
                  <td>Net Profit</td>
                  <td className="numeric font-jetbrains">{formatMoney(netProfit)}</td>
                  <td>Revenue less OPEX and CAPEX</td>
                </tr>
                <tr>
                  <td>Profit Margin</td>
                  <td className="numeric font-jetbrains">{profitMargin}%</td>
                  <td>Net profit divided by revenue</td>
                </tr>
              </>
            )}
            <tr>
              <td>Feed Variance</td>
              <td className="numeric font-jetbrains">
                {latestFeedPoint ? `${formatSignedNumber(latestFeedPoint.varianceKg, 0)} kg` : '--'}
              </td>
              <td>Actual feed compared with target curve</td>
            </tr>
            <tr>
              <td>Mortality</td>
              <td className="numeric font-jetbrains">{Number(totalMortality || 0).toLocaleString()} heads</td>
              <td>Total from daily logs</td>
            </tr>
            <tr>
              <td>Arrival Variance</td>
              <td className="numeric font-jetbrains">{hasArrivalPlan ? formatSignedNumber(arrivalVariance, 0) : '--'}</td>
              <td>{arrivalVarianceDetail}</td>
            </tr>
            <tr>
              <td>Arrival DOA</td>
              <td className="numeric font-jetbrains">{formatNumber(arrivalMetrics.doaCount, 0)} heads</td>
              <td>Dead on arrival from DOC quick-entry</td>
            </tr>
            <tr>
              <td>Net Chicks Placed</td>
              <td className="numeric font-jetbrains">{formatNumber(arrivalMetrics.netChicksPlaced, 0)} heads</td>
              <td>Arrived DOC less DOA</td>
            </tr>
            <tr>
              <td>Arrival Sample Weight</td>
              <td className="numeric font-jetbrains">{formatGrams(arrivalMetrics.arrivalSampleWeightGrams)}</td>
              <td>Weighted by arrived DOC per building</td>
            </tr>
            <tr>
              <td>{mortalityAllowanceLabel}</td>
              <td className="numeric font-jetbrains">
                {formatNumber(totalMortality, 0)} / {formatNumber(batchThreshold, 0)}
              </td>
              <td>{mortalityAllowanceDetail}</td>
            </tr>
          </tbody>
        </table>

        {showFinancials && financialData.length > 0 && (
          <table className="print-simple-table mt-4">
            <thead>
              <tr>
                <th>Category</th>
                <th className="numeric">Income</th>
                <th className="numeric">Expense</th>
              </tr>
            </thead>
            <tbody>
              {financialData.map((item) => (
                <tr key={item.category}>
                  <td>{item.category}</td>
                  <td className="numeric font-jetbrains">{formatMoney(item.income)}</td>
                  <td className="numeric font-jetbrains">{formatMoney(item.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="screen-only grid min-w-0 gap-6 xl:grid-cols-2">
      <div className="print-card min-w-0 bg-app-card p-4 rounded-2xl shadow-sm border border-app-border mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-app-text font-hanken">Feed Target Curve</h3>
          <span className="text-[10px] font-bold text-app-text-secondary">
            50 kg bags
          </span>
        </div>
        <div className="h-64 min-h-64 w-full min-w-0">
          {feedCurve.length > 0 ? (
            <StableChartContainer>
              <LineChart data={feedCurve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-app-border/20" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-app-text-secondary" />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-app-text-secondary" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    backgroundColor: 'var(--app-card)',
                    color: 'var(--app-text)'
                  }}
                  itemStyle={{ color: 'var(--app-text)' }}
                  labelStyle={{ color: 'var(--app-text-secondary)', fontWeight: 'bold' }}
                  formatter={(value, name) => [`${formatNumber(value, 2)} bags`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} className="text-app-text-secondary" />
                <Line type="monotone" dataKey="targetBags" name="Target" stroke="var(--app-chart-target)" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="actualBags" name="Actual" stroke="var(--app-chart-actual)" strokeWidth={3} dot={{ r: 3, fill: 'var(--app-chart-actual)', strokeWidth: 0 }} />
              </LineChart>
            </StableChartContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-app-text-secondary text-sm font-medium">
              No active batch target data.
            </div>
          )}
        </div>
      </div>

      <div className="print-card min-w-0 bg-app-card p-4 rounded-2xl shadow-sm border border-app-border mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-app-text font-hanken">Weight and FCR</h3>
          <span className="text-[10px] font-bold text-app-text-secondary">
            {latestWeightPoint ? `Last weigh D${latestWeightPoint.day}` : 'No actual weight'}
          </span>
        </div>
        <div className="h-64 min-h-64 w-full min-w-0">
          {feedCurve.length > 0 ? (
            <StableChartContainer>
              <LineChart data={feedCurve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-app-border/20" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-app-text-secondary" />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-app-text-secondary" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    backgroundColor: 'var(--app-card)',
                    color: 'var(--app-text)'
                  }}
                  itemStyle={{ color: 'var(--app-text)' }}
                  labelStyle={{ color: 'var(--app-text-secondary)', fontWeight: 'bold' }}
                  formatter={(value, name) => [formatNumber(value, 2), name]}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} className="text-app-text-secondary" />
                <Line type="monotone" dataKey="targetFcr" name="Target FCR" stroke="var(--app-chart-target)" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="actualFcr" name="Actual FCR" stroke="var(--app-chart-compare)" strokeWidth={3} dot={{ r: 4, fill: 'var(--app-chart-compare)', strokeWidth: 0 }} connectNulls={false} />
              </LineChart>
            </StableChartContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-app-text-secondary text-sm font-medium">
              No FCR data to display.
            </div>
          )}
        </div>
      </div>

      <div className="print-card min-w-0 bg-app-card p-4 rounded-2xl shadow-sm border border-app-border mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-app-text font-hanken">Employee Feed Target</h3>
            <p className="text-[10px] font-bold text-app-text-secondary mt-1">
              {selectedEmployeeFeedPoint
                ? `${selectedEmployeeFeedPoint.varianceKg > 0 ? '+' : ''}${formatNumber(selectedEmployeeFeedPoint.varianceKg, 0)} kg variance`
                : 'No employee curve'}
            </p>
          </div>
          <select
            value={selectedEmployeeFeed?.employeeKey || ''}
            onChange={(event) => setSelectedEmployeeFeedKey(event.target.value)}
            className="max-w-40 rounded-xl border border-app-border bg-app-card px-3 py-2 text-xs font-bold text-app-text outline-none focus:ring-2 focus:ring-app-accent"
            disabled={employeeFeedCurves.length === 0}
          >
            {employeeFeedCurves.length === 0 && <option value="">No employees</option>}
            {employeeFeedCurves.map((employee) => (
              <option key={employee.employeeKey} value={employee.employeeKey}>
                {employee.employeeName}
              </option>
            ))}
          </select>
        </div>
        <div className="h-64 min-h-64 w-full min-w-0">
          {selectedEmployeeFeed?.curve.length > 0 ? (
            <StableChartContainer>
              <LineChart data={selectedEmployeeFeed.curve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-app-border/20" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-app-text-secondary" />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-app-text-secondary" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    backgroundColor: 'var(--app-card)',
                    color: 'var(--app-text)'
                  }}
                  itemStyle={{ color: 'var(--app-text)' }}
                  labelStyle={{ color: 'var(--app-text-secondary)', fontWeight: 'bold' }}
                  formatter={(value, name) => [`${formatNumber(value, 2)} bags`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} className="text-app-text-secondary" />
                <Line type="monotone" dataKey="targetBags" name="Target" stroke="var(--app-chart-target)" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="actualBags" name="Actual" stroke="var(--app-chart-actual)" strokeWidth={3} dot={{ r: 3, fill: 'var(--app-chart-actual)', strokeWidth: 0 }} />
              </LineChart>
            </StableChartContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-app-text-secondary text-sm font-medium">
              No employee feed logs yet.
            </div>
          )}
        </div>
      </div>

      {showFinancials && (
      <div className="print-card min-w-0 bg-app-card p-4 rounded-2xl shadow-sm border border-app-border mb-6">
        <h3 className="text-sm font-bold text-app-text font-hanken mb-4">Expense & Revenue Breakdown</h3>
        <div className="h-64 min-h-64 w-full min-w-0">
          {financialData.length > 0 ? (
            <StableChartContainer>
              <BarChart data={financialData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-app-border/20" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-app-text-secondary" />
                <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} className="text-app-text-secondary" tickFormatter={(value) => `PHP ${value >= 1000 ? `${value / 1000}k` : value}`} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    backgroundColor: 'var(--app-card)',
                    color: 'var(--app-text)'
                  }}
                  itemStyle={{ color: 'var(--app-text)' }}
                  labelStyle={{ color: 'var(--app-text-secondary)', fontWeight: 'bold' }}
                  formatter={(value) => formatMoney(value)}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} className="text-app-text-secondary" />
                <Bar dataKey="income" name="Income" fill="var(--app-success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="var(--app-chart-expense)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </StableChartContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-app-text-secondary text-sm font-medium">No ledger data to display.</div>
          )}
        </div>
      </div>
      )}
      </div>
    </div>
  );
}
