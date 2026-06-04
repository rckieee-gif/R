function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstFiniteNumber(...values) {
  return values.map(toFiniteNumber).find((value) => value !== null);
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

export function getArrivalMetrics(batch, loadings = []) {
  const arrivedFromLoadings = sumLoadingField(loadings, ['chicksLoaded', 'chicks_loaded']);
  const doaFromLoadings = sumLoadingField(loadings, ['doaCount', 'doa', 'deadOnArrival', 'deadOnArrivalCount']);

  const arrivedDoc = firstFiniteNumber(
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
    hasArrivalData: arrivedDoc > 0 || doaCount > 0 || netChicksPlaced > 0 || Number(arrivalSampleWeightGrams || 0) > 0
  };
}
