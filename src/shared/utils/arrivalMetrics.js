function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstFiniteNumber(...values) {
  return values.map(toFiniteNumber).find((value) => value !== null);
}

export const ARRIVED_DOC_FIELD_KEYS = [
  'arrivedDoc',
  'arrivedDOC',
  'arrivedDocCount',
  'arrivedDocHeads',
  'arrivedDocInput',
  'docArrived',
  'docArrivedCount',
  'actualDocArrived',
  'actualDocCount',
  'actualChicksArrived',
  'actualChicksLoaded'
];

function hasOwnField(record, key) {
  return Boolean(record && Object.prototype.hasOwnProperty.call(record, key));
}

function getExplicitArrivedDocValue(batch) {
  const hasExplicitField = ARRIVED_DOC_FIELD_KEYS.some((key) => hasOwnField(batch, key));
  if (!hasExplicitField) return { hasExplicitField: false, value: null };

  const value = firstFiniteNumber(...ARRIVED_DOC_FIELD_KEYS.map((key) => batch?.[key]));
  return { hasExplicitField: true, value: value ?? 0 };
}

function sumLoadingField(loadings, keys) {
  return loadings.reduce((sum, loading) => {
    const value = firstFiniteNumber(...keys.map((key) => loading?.[key]));
    return sum + Number(value || 0);
  }, 0);
}

export function getWeightedArrivalSampleWeight(loadings = []) {
  const weightedRows = loadings
    .map((loading) => {
      const arrivedDoc = firstFiniteNumber(loading.chicksLoaded, loading.chicks_loaded) || 0;
      const sampleWeightGrams = firstFiniteNumber(
        loading.sampleWeightGrams,
        loading.arrivalSampleWeightGrams,
        loading.sample_weight_g,
        loading.sampleWeight
      );

      return { arrivedDoc, sampleWeightGrams };
    })
    .filter((row) => row.arrivedDoc > 0 && Number(row.sampleWeightGrams || 0) > 0);

  const sampledHeads = weightedRows.reduce((sum, row) => sum + row.arrivedDoc, 0);
  if (!sampledHeads) return null;

  const weightedTotal = weightedRows.reduce((sum, row) => sum + (row.arrivedDoc * row.sampleWeightGrams), 0);
  return Number((weightedTotal / sampledHeads).toFixed(2));
}

export function getArrivalMetrics(batch, loadings = [], options = {}) {
  const arrivedFromLoadings = sumLoadingField(loadings, ['chicksLoaded', 'chicks_loaded']);
  const doaFromLoadings = sumLoadingField(loadings, ['doaCount', 'doa', 'deadOnArrival', 'deadOnArrivalCount']);
  const requireExplicitArrival = Boolean(options.requireExplicitArrival);
  const explicitArrivedDoc = getExplicitArrivedDocValue(batch);

  const arrivedDoc = requireExplicitArrival
    ? (explicitArrivedDoc.hasExplicitField ? explicitArrivedDoc.value : arrivedFromLoadings)
    : firstFiniteNumber(
      batch?.actualChicksArrived,
      batch?.arrivedDocCount,
      batch?.totalChicksLoaded,
      arrivedFromLoadings
    ) || 0;
  const doaCount = firstFiniteNumber(batch?.doaCount, batch?.doa, doaFromLoadings) || 0;
  const netChicksPlaced = firstFiniteNumber(batch?.netChicksPlaced)
    ?? Math.max(arrivedDoc - doaCount, 0);
  const arrivalSampleWeightGrams = firstFiniteNumber(batch?.arrivalSampleWeightGrams)
    ?? getWeightedArrivalSampleWeight(loadings);

  return {
    arrivedDoc,
    doaCount,
    netChicksPlaced,
    arrivalSampleWeightGrams,
    hasArrivalData: arrivedDoc > 0 || doaCount > 0 || netChicksPlaced > 0 || Number(arrivalSampleWeightGrams || 0) > 0,
    hasConfirmedArrival: arrivedDoc > 0
  };
}
