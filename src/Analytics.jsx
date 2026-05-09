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
} from './broilerTargets';

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

function buildFeedCurve(logs, activeBatch) {
  if (!activeBatch?.startDate || !activeBatch?.totalChicksLoaded) return [];

  const lastTargetDay = getLastBroilerTargetDay();
  const todayDay = getAgeDay(activeBatch.startDate, new Date().toISOString().split('T')[0]) || 1;
  const maxLoggedDay = logs.reduce((maxDay, log) => {
    const ageDay = getAgeDay(activeBatch.startDate, log.date);
    return ageDay ? Math.max(maxDay, ageDay) : maxDay;
  }, 0);
  const maxDay = Math.min(lastTargetDay, Math.max(todayDay, maxLoggedDay, 1));
  const feedByDay = new Map();
  const mortalityByDay = new Map();
  const weightsByDay = new Map();

  logs.forEach((log) => {
    const ageDay = getAgeDay(activeBatch.startDate, log.date);
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

    const target = calculateTargetFeedForHeads(activeBatch.totalChicksLoaded, day);
    const weights = weightsByDay.get(day) || [];
    const averageWeightGrams = weights.length
      ? weights.reduce((sum, weight) => sum + weight, 0) / weights.length
      : null;
    const actualFeedKg = cumulativeFeedBags * BAG_WEIGHT_KG;
    const liveHeads = Math.max(Number(activeBatch.totalChicksLoaded || 0) - cumulativeMortality, 0);
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

export default function Analytics({ transactions = [], logs = [], activeBatch }) {
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

  const dateMap = {};
  transactions.forEach((tx) => {
    const dateObj = new Date(tx.date);
    const shortDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

    if (!dateMap[tx.date]) {
      dateMap[tx.date] = { date: tx.date, shortDate, expense: 0, income: 0 };
    }

    if (tx.fundingNature === 'Revenue') {
      dateMap[tx.date].income += Number(tx.amount || 0);
    } else if (tx.fundingNature === 'OPEX' || tx.fundingNature === 'CAPEX') {
      dateMap[tx.date].expense += Number(tx.amount || 0);
    }
  });

  const trendData = Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  const feedCurve = buildFeedCurve(logs, activeBatch);
  const latestFeedPoint = feedCurve[feedCurve.length - 1] || null;
  const latestWeightPoint = [...feedCurve].reverse().find((point) => point.actualWeightGrams);
  const totalMortality = logs.reduce((sum, log) => sum + Number(log.mortality || 0), 0);

  return (
    <div className="print-container report-page">
      <div className="mb-6 mt-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="print-title text-3xl font-extrabold text-primary tracking-tight">Analytics</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Financials and production target tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print px-3 py-2 rounded-xl bg-primary text-white text-xs font-black shadow-sm"
          >
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="print-card bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Net Profit</p>
          <p className={`text-2xl font-black mt-1 ${netProfit >= 0 ? 'text-semantic-success' : 'text-semantic-danger'}`}>
            {formatMoney(netProfit)}
          </p>
        </div>

        <div className="print-card bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Profit Margin</p>
          <p className={`text-2xl font-black mt-1 ${profitMargin >= 15 ? 'text-primary' : 'text-semantic-warning'}`}>
            {profitMargin}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="print-card bg-white dark:bg-gray-800 p-4 rounded-xl border border-neutral-border dark:border-gray-700 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Feed Target Var.</p>
          <p className={`text-lg font-black mt-1 ${(latestFeedPoint?.varianceKg || 0) > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
            {latestFeedPoint ? `${latestFeedPoint.varianceKg > 0 ? '+' : ''}${formatNumber(latestFeedPoint.varianceKg, 0)} kg` : '--'}
          </p>
        </div>

        <div className="print-card bg-white dark:bg-gray-800 p-4 rounded-xl border border-neutral-border dark:border-gray-700 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Mortality</p>
          <p className={`text-lg font-black mt-1 ${totalMortality > 0 ? 'text-semantic-danger' : 'text-semantic-success'}`}>
            {Number(totalMortality || 0).toLocaleString()} hd
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
            <tr>
              <td>Net Profit</td>
              <td className="numeric">{formatMoney(netProfit)}</td>
              <td>Revenue less OPEX and CAPEX</td>
            </tr>
            <tr>
              <td>Profit Margin</td>
              <td className="numeric">{profitMargin}%</td>
              <td>Net profit divided by revenue</td>
            </tr>
            <tr>
              <td>Feed Variance</td>
              <td className="numeric">
                {latestFeedPoint ? `${latestFeedPoint.varianceKg > 0 ? '+' : ''}${formatNumber(latestFeedPoint.varianceKg, 0)} kg` : '--'}
              </td>
              <td>Actual feed compared with target curve</td>
            </tr>
            <tr>
              <td>Mortality</td>
              <td className="numeric">{Number(totalMortality || 0).toLocaleString()} heads</td>
              <td>Total from daily logs</td>
            </tr>
          </tbody>
        </table>

        {financialData.length > 0 && (
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
                  <td className="numeric">{formatMoney(item.income)}</td>
                  <td className="numeric">{formatMoney(item.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="screen-only grid gap-6 xl:grid-cols-2">
      <div className="print-card bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300">Feed Target Curve</h3>
          <span className="text-[10px] font-bold text-gray-400">
            50 kg bags
          </span>
        </div>
        <div className="h-64 w-full">
          {feedCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={feedCurve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E6EB" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value, name) => [`${formatNumber(value, 2)} bags`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="targetBags" name="Target" stroke="#C9A84C" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="actualBags" name="Actual" stroke="#16A34A" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm font-medium">
              No active batch target data.
            </div>
          )}
        </div>
      </div>

      <div className="print-card bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300">Weight and FCR</h3>
          <span className="text-[10px] font-bold text-gray-400">
            {latestWeightPoint ? `Last weigh D${latestWeightPoint.day}` : 'No actual weight'}
          </span>
        </div>
        <div className="h-64 w-full">
          {feedCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={feedCurve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E6EB" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value, name) => [formatNumber(value, 2), name]}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="targetFcr" name="Target FCR" stroke="#C9A84C" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="actualFcr" name="Actual FCR" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm font-medium">
              No FCR data to display.
            </div>
          )}
        </div>
      </div>

      <div className="print-card bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-4">Cash Flow Timeline</h3>
        <div className="h-64 w-full">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E6EB" vertical={false} />
                <XAxis dataKey="shortDate" tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(value) => `PHP ${value >= 1000 ? `${value / 1000}k` : value}`} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value) => formatMoney(value)} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="income" name="Daily Income" stroke="#16A34A" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="expense" name="Daily Expense" stroke="#DC2626" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm font-medium">No ledger data to display.</div>
          )}
        </div>
      </div>

      <div className="print-card bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
        <h3 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-4">Expense & Revenue Breakdown</h3>
        <div className="h-64 w-full">
          {financialData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E6EB" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(value) => `PHP ${value >= 1000 ? `${value / 1000}k` : value}`} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '10px' }} formatter={(value) => formatMoney(value)} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="income" name="Income" fill="#16A34A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#C9A84C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm font-medium">No ledger data to display.</div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
