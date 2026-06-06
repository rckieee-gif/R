import { getArrivalMetrics } from './arrivalMetrics';

export const MORTALITY_WARNING_RATE = 0.005;
export const MORTALITY_WARNING_HEADS = 5;

export function formatSignalNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatPercent(value) {
  const numberValue = Number(value || 0);
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(2);
}

export function getArrivalVarianceMeta(actualChicks, plannedChicks, options = {}) {
  const actual = Number(actualChicks || 0);
  const planned = Number(plannedChicks || 0);
  const hasArrivalData = options.hasArrivalData ?? actual > 0;

  if (planned <= 0) {
    return {
      value: '--',
      detail: 'Set planned flock to track variance.',
      severity: 'neutral',
      toneClass: 'border-app-border bg-app-bg text-app-text',
      hasWarning: false,
      variance: null,
      percent: null
    };
  }

  if (!hasArrivalData || actual <= 0) {
    return {
      value: '--',
      detail: 'Enter building chick counts when the delivery arrives.',
      severity: 'neutral',
      toneClass: 'border-app-border bg-app-bg text-app-text',
      hasWarning: false,
      variance: null,
      percent: null
    };
  }

  const variance = actual - planned;
  const percent = (variance / planned) * 100;

  if (variance === 0) {
    return {
      value: 'On plan',
      detail: `${formatSignalNumber(actual)} arrived, matching planned flock.`,
      severity: 'success',
      toneClass: 'border-app-success/30 bg-app-success-bg text-app-success',
      hasWarning: false,
      variance,
      percent
    };
  }

  return {
    value: `${variance > 0 ? '+' : ''}${formatSignalNumber(variance)}`,
    detail: `${formatSignalNumber(Math.abs(variance))} ${variance > 0 ? 'above' : 'below'} planned flock (${variance > 0 ? '+' : ''}${formatPercent(percent)}%).`,
    severity: variance < 0 ? 'warning' : 'info',
    toneClass: variance < 0
      ? 'border-app-warning/30 bg-app-warning-bg text-app-warning'
      : 'border-app-accent/30 bg-app-accent/10 text-app-accent',
    hasWarning: variance < 0,
    variance,
    percent
  };
}

export function getMortalityAllowanceMeta(batch, logs = [], loadings = []) {
  const totalMortality = logs.reduce((sum, log) => sum + Number(log.mortality || 0), 0);
  const arrivalMetrics = getArrivalMetrics(batch, loadings);
  const loadedBirds = Number(arrivalMetrics.arrivedDoc || 0);
  const configuredAllowance = Number(batch?.mortalityAllowance || 0);
  const allowanceLimit = configuredAllowance > 0
    ? configuredAllowance
    : Math.max(MORTALITY_WARNING_HEADS, Math.ceil(loadedBirds * MORTALITY_WARNING_RATE));
  const label = configuredAllowance > 0 ? 'Mortality allowance' : 'Mortality warning limit';

  if (loadedBirds <= 0) {
    return {
      label,
      value: `-- / ${formatSignalNumber(allowanceLimit)}`,
      detail: 'Record arrived DOC to track mortality allowance.',
      severity: 'neutral',
      hasWarning: false,
      totalMortality,
      configuredAllowance,
      allowanceLimit,
      usedPercent: 0,
      remaining: allowanceLimit,
      mortalityRate: null
    };
  }

  const usedPercent = allowanceLimit > 0
    ? Math.min(100, (totalMortality / allowanceLimit) * 100)
    : 0;
  const remaining = Math.max(allowanceLimit - totalMortality, 0);
  const mortalityRate = loadedBirds > 0 ? (totalMortality / loadedBirds) * 100 : 0;
  const severity = totalMortality <= allowanceLimit
    ? 'success'
    : totalMortality <= allowanceLimit * 2
      ? 'warning'
      : 'danger';
  const detail = remaining > 0
    ? `${formatSignalNumber(remaining)} heads remaining before alert.`
    : `${configuredAllowance > 0 ? 'Allowance' : 'Warning limit'} exceeded.`;

  return {
    label,
    value: `${formatSignalNumber(totalMortality)} / ${formatSignalNumber(allowanceLimit)}`,
    detail,
    severity,
    hasWarning: totalMortality > allowanceLimit,
    totalMortality,
    configuredAllowance,
    allowanceLimit,
    usedPercent,
    remaining,
    mortalityRate
  };
}

export function getBatchWarningSignals(batch, logs = [], loadings = []) {
  const arrivalMetrics = getArrivalMetrics(batch, loadings);
  const arrival = getArrivalVarianceMeta(arrivalMetrics.arrivedDoc, batch?.plannedFlock, {
    hasArrivalData: arrivalMetrics.arrivedDoc > 0
  });
  const mortality = getMortalityAllowanceMeta(batch, logs, loadings);
  const warnings = [];

  if (arrival.hasWarning) {
    warnings.push({
      key: 'arrival-variance',
      label: 'Arrival variance',
      severity: 'warning',
      title: 'Actual arrival is below plan',
      detail: `${formatSignalNumber(Math.abs(arrival.variance))} fewer chicks arrived than the planned flock of ${formatSignalNumber(batch?.plannedFlock)}.`
    });
  }

  if (mortality.hasWarning) {
    warnings.push({
      key: 'mortality-allowance',
      label: 'Mortality allowance',
      severity: mortality.severity === 'danger' ? 'danger' : 'warning',
      title: 'Cumulative mortality is above allowance',
      detail: `${formatSignalNumber(mortality.totalMortality)} total mortality recorded; allowance is ${formatSignalNumber(mortality.allowanceLimit)} heads.`
    });
  }

  return {
    arrival,
    arrivalMetrics,
    mortality,
    warnings
  };
}
