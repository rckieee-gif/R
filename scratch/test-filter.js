const mockTransactions = [
  { id: 1, date: '2026-05-29', building: 'All', type: 'Expense', category: 'Feed', amount: 1500, paidBy: 'Rolly', paidTo: 'Supplier Feed', remarks: '5 bags', status: 'PAID', description: 'Bought Starter Feed' },
];

function getTransactionDateValue(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return '';
  return parsedDate.toISOString().slice(0, 10);
}

const ledgerSearch = '';
const ledgerDateFrom = '';
const ledgerDateTo = '';
const ledgerFundingFilter = 'all';
const ledgerTypeFilter = 'all';
const ledgerBuildingFilter = 'all';
const ledgerCategoryFilter = 'all';

const query = ledgerSearch.trim().toLowerCase();

const res = mockTransactions.filter((tx) => {
  const txDate = getTransactionDateValue(tx.date);

  if (ledgerDateFrom && (!txDate || txDate < ledgerDateFrom)) return false;
  if (ledgerDateTo && (!txDate || txDate > ledgerDateTo)) return false;
  if (ledgerFundingFilter !== 'all' && tx.fundingNature !== ledgerFundingFilter) return false;
  if (ledgerTypeFilter !== 'all' && tx.type !== ledgerTypeFilter) return false;
  if (ledgerBuildingFilter !== 'all' && (tx.building || 'All') !== ledgerBuildingFilter) return false;
  if (ledgerCategoryFilter !== 'all' && tx.category !== ledgerCategoryFilter) return false;

  if (!query) return true;
  return false;
});

console.log('Filtered:', res);
