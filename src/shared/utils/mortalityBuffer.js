/**
 * Calculate how many extra buffer birds an employee has from the DOC supplier extras.
 * Buffer = proportional share of (buildingChicksLoaded - totalBuildingHandledBirds).
 */
export function calculateMortalityBuffer(buildingChicksLoaded, employeeHandledBirds, totalBuildingHandledBirds) {
  const loaded = Number(buildingChicksLoaded || 0);
  const handled = Number(employeeHandledBirds || 0);
  const totalHandled = Number(totalBuildingHandledBirds || 0);
  if (!loaded || !handled || !totalHandled || loaded <= totalHandled) return 0;
  const employeeShare = handled / totalHandled;
  return Math.max(0, Math.floor(loaded * employeeShare) - handled);
}

/**
 * Apply the mortality buffer: only mortality beyond the buffer counts against pay.
 */
export function applyMortalityBuffer(mortality, buffer) {
  return Math.max(0, Number(mortality || 0) - Number(buffer || 0));
}
