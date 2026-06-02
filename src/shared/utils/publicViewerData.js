function dateOffset(daysFromToday) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const startDate = dateOffset(-19);
const targetHarvestDate = dateOffset(13);

export const publicViewerUser = {
  id: 'public-viewer',
  username: 'viewer.preview',
  email: 'viewer@octavio.preview',
  role: 'Viewer',
  isPrimaryOwner: false,
  isPublicViewer: true
};

export const publicViewerBatch = {
  id: 'PUBLIC-DEMO-20',
  status: 'ONGOING',
  startDate,
  targetHarvestDate,
  totalChicksLoaded: 38500,
  plannedFlock: 40000,
  mortalityAllowance: 200,
  targetFeedKg: 0,
  notes: 'Read-only preview data'
};

export const publicViewerLoadings = [
  { building: 'A', owner: 'Rolly', chicksLoaded: 16500, loadingSharePct: 42.8571, remarks: 'Preview loading' },
  { building: 'B', owner: 'Rodney', chicksLoaded: 8600, loadingSharePct: 22.3377, remarks: 'Preview loading' },
  { building: 'C', owner: 'Rolly + Rodney', chicksLoaded: 13400, loadingSharePct: 34.8052, remarks: 'Preview loading' }
];

export const publicViewerAssignments = [
  { id: 'preview-assignment-a', employeeId: 'preview-employee-a', employeeName: 'Rodel', assignedBuilding: 'A', handledBirds: 16500 },
  { id: 'preview-assignment-b', employeeId: 'preview-employee-b', employeeName: 'Manny', assignedBuilding: 'B', handledBirds: 8600 },
  { id: 'preview-assignment-c', employeeId: 'preview-employee-c', employeeName: 'Jomar', assignedBuilding: 'C', handledBirds: 13400 }
];

const logRows = [
  { offset: 0, building: 'A', employeeId: 'preview-employee-a', employeeName: 'Rodel', handledBirds: 16500, feed: 89, mortality: 4, averageWeightGrams: 795, remarks: 'Preview today log' },
  { offset: 0, building: 'B', employeeId: 'preview-employee-b', employeeName: 'Manny', handledBirds: 8600, feed: 46, mortality: 1, averageWeightGrams: 810, remarks: 'Preview today log' },
  { offset: 0, building: 'C', employeeId: 'preview-employee-c', employeeName: 'Jomar', handledBirds: 13400, feed: 72, mortality: 3, averageWeightGrams: 805, remarks: 'Preview today log' },
  { offset: -1, building: 'A', employeeId: 'preview-employee-a', employeeName: 'Rodel', handledBirds: 16500, feed: 84, mortality: 3, averageWeightGrams: 760, remarks: 'Normal appetite' },
  { offset: -1, building: 'B', employeeId: 'preview-employee-b', employeeName: 'Manny', handledBirds: 8600, feed: 44, mortality: 2, averageWeightGrams: 772, remarks: 'Clean drinker lines' },
  { offset: -1, building: 'C', employeeId: 'preview-employee-c', employeeName: 'Jomar', handledBirds: 13400, feed: 68, mortality: 2, averageWeightGrams: 768, remarks: 'Ventilation adjusted' },
  { offset: -2, building: 'A', employeeId: 'preview-employee-a', employeeName: 'Rodel', handledBirds: 16500, feed: 79, mortality: 2, averageWeightGrams: 720, remarks: '' },
  { offset: -2, building: 'B', employeeId: 'preview-employee-b', employeeName: 'Manny', handledBirds: 8600, feed: 41, mortality: 1, averageWeightGrams: 730, remarks: '' },
  { offset: -2, building: 'C', employeeId: 'preview-employee-c', employeeName: 'Jomar', handledBirds: 13400, feed: 64, mortality: 2, averageWeightGrams: 725, remarks: '' },
  { offset: -3, building: 'A', employeeId: 'preview-employee-a', employeeName: 'Rodel', handledBirds: 16500, feed: 74, mortality: 3, averageWeightGrams: 685, remarks: '' },
  { offset: -3, building: 'B', employeeId: 'preview-employee-b', employeeName: 'Manny', handledBirds: 8600, feed: 38, mortality: 1, averageWeightGrams: 690, remarks: '' },
  { offset: -3, building: 'C', employeeId: 'preview-employee-c', employeeName: 'Jomar', handledBirds: 13400, feed: 60, mortality: 2, averageWeightGrams: 688, remarks: '' }
];

export const publicViewerLogs = logRows.map((log, index) => ({
  ...log,
  id: `preview-log-${index + 1}`,
  batchId: publicViewerBatch.id,
  date: dateOffset(log.offset),
  feedItemId: 'preview-feed-grower'
}));

export const publicViewerInventoryItems = [
  {
    id: 'preview-feed-grower',
    name: 'Grower Feed',
    category: 'Feed',
    unit: 'sacks',
    currentStock: 980,
    targetQuantity: 800,
    reorderLevel: 180,
    warningType: 'ok'
  },
  {
    id: 'preview-vitamins',
    name: 'Water Vitamins',
    category: 'Medicine',
    unit: 'bottle',
    currentStock: 14,
    targetQuantity: 20,
    reorderLevel: 8,
    warningType: 'needed-stock'
  },
  {
    id: 'preview-disinfectant',
    name: 'Disinfectant',
    category: 'Supplies',
    unit: 'gallon',
    currentStock: 5,
    targetQuantity: 10,
    reorderLevel: 6,
    warningType: 'low-stock'
  }
];

export const publicViewerInventoryMovements = [
  {
    id: 'preview-movement-1',
    itemName: 'Grower Feed',
    movementDate: dateOffset(-1),
    building: 'All',
    movementType: 'Stock In',
    quantity: 240,
    unit: 'sacks',
    linkedTransactionId: null,
    remarks: 'Delivery received'
  },
  {
    id: 'preview-movement-2',
    itemName: 'Water Vitamins',
    movementDate: dateOffset(-2),
    building: 'B',
    movementType: 'Stock Out',
    quantity: 2,
    unit: 'bottle',
    linkedTransactionId: null,
    remarks: 'Routine water support'
  }
];

export const publicViewerBuildings = [
  { id: 'preview-building-a', name: 'A' },
  { id: 'preview-building-b', name: 'B' },
  { id: 'preview-building-c', name: 'C' }
];

export const publicViewerStakeholders = [
  { id: 'preview-stakeholder-1', name: 'Rolly' },
  { id: 'preview-stakeholder-2', name: 'Rodney' },
  { id: 'preview-stakeholder-3', name: 'Gomez' }
];

export const publicViewerBatches = [
  publicViewerBatch,
  {
    id: 'PUBLIC-CLOSED-19',
    status: 'CLOSED',
    startDate: dateOffset(-56),
    targetHarvestDate: dateOffset(-23),
    totalChicksLoaded: 37200,
    plannedFlock: 38000,
    targetFeedKg: 0,
    notes: 'Previous preview cycle'
  }
];

export const publicViewerData = {
  batches: publicViewerBatches,
  buildings: publicViewerBuildings,
  loadings: publicViewerLoadings,
  assignments: publicViewerAssignments,
  feedItems: publicViewerInventoryItems.filter((item) => item.category === 'Feed'),
  inventoryItems: publicViewerInventoryItems,
  inventoryMovements: publicViewerInventoryMovements,
  stakeholders: publicViewerStakeholders
};
