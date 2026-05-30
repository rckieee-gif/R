import Alert from './Alert';

export default function StockWarning({
  currentStock,
  limit = 10,
  unit = 'units',
  itemName = 'Item',
  className = ''
}) {
  if (currentStock === undefined || currentStock === null) return null;

  const isBelowZero = Number(currentStock) < 0;
  const isLow = Number(currentStock) <= Number(limit);

  if (!isBelowZero && !isLow) return null;

  return (
    <Alert
      variant={isBelowZero ? 'error' : 'warning'}
      title={isBelowZero ? 'Critical Stock Level' : 'Low Stock Warning'}
      className={className}
    >
      {isBelowZero
        ? `${itemName} stock is empty/negative (${Number(currentStock).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit})!`
        : `${itemName} stock is low (${Number(currentStock).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit} remaining, threshold: ${limit} ${unit}).`
      }
    </Alert>
  );
}
