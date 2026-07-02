import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../shared/utils/apiClient';
import { inventoryItemSchema, inventoryMovementSchema } from './inventorySchemas';
import OfflineStaleBanner from '../../shared/components/OfflineStaleBanner';
import {
  Badge,
  Button,
  DataTable,
  FormField,
  Modal,
  PageHeader,
  SearchInput,
  SectionLabel,
  SelectField,
  TextInput
} from '../../shared/components/OctavioUI';

const emptyItemForm = {
  name: '',
  category: 'Feed',
  unit: 'sacks',
  targetQuantity: '',
  reorderLevel: ''
};

const emptyMovementForm = {
  itemId: '',
  movementDate: new Date().toISOString().split('T')[0],
  movementType: 'Stock In',
  quantity: '',
  unitCost: '',
  building: 'All',
  remarks: '',
  createLedger: false,
  fundingNature: 'OPEX',
  ledgerCategory: 'Feed',
  paidBy: '',
  paidTo: '',
  reference: ''
};

const categories = ['Feed', 'Medicine', 'Supplies', 'Equipment', 'Chicks', 'Seeds', 'Tools'];
const units = ['sacks', 'kg', 'heads', 'pcs', 'bottle', 'pack', 'dose', 'sack', 'liter', 'gallon'];
const movementTypes = ['Stock In', 'Stock Out', 'Adjustment', 'Transfer'];
const ledgerFunding = ['OPEX', 'CAPEX', 'CAPEX-Recoverable'];

function formatQuantity(value, digits = 2) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : digits,
    maximumFractionDigits: digits
  });
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function getStockWarningType(item) {
  if (['low-stock', 'needed-stock', 'ok'].includes(item.warningType)) return item.warningType;

  const currentStock = Number(item.currentStock || 0);
  const targetQuantity = Number(item.targetQuantity || 0);
  const reorderLevel = Number(item.reorderLevel || 0);

  if (reorderLevel > 0 && currentStock < reorderLevel) return 'low-stock';
  if (targetQuantity > 0 && currentStock < targetQuantity) return 'needed-stock';
  return 'ok';
}

function normalizeStakeholderName(name) {
  return name === 'Yanyan' ? 'Others' : String(name || '').trim();
}

function uniqueStakeholders(stakeholders) {
  const seen = new Set();
  return stakeholders.reduce((list, stakeholder) => {
    const name = normalizeStakeholderName(stakeholder.name);
    if (!name || seen.has(name)) return list;
    seen.add(name);
    list.push({ ...stakeholder, name });
    return list;
  }, []);
}

async function readInventoryData({ activeBatchId, signal }) {
  const [itemData, movementData, buildingData, stakeholderData] = await Promise.all([
    apiClient.get('/api/inventory/items', { expectArray: true, signal }),
    apiClient.get(`/api/inventory/movements${activeBatchId ? `?batchId=${activeBatchId}` : ''}`, { expectArray: true, signal }),
    apiClient.get('/api/buildings', { expectArray: true, signal }).catch(() => null),
    apiClient.get('/api/stakeholders', { expectArray: true, signal }).catch(() => null)
  ]);

  return {
    items: itemData,
    movements: movementData,
    buildings: Array.isArray(buildingData) ? ['All', ...buildingData.map((building) => building.name)] : null,
    stakeholders: Array.isArray(stakeholderData) ? uniqueStakeholders(stakeholderData) : null
  };
}

export default function InventoryManagement({ token, activeBatch, readOnly = false, canEditOrDelete = false, previewData = null }) {
  const activeBatchId = activeBatch?.id;
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [buildings, setBuildings] = useState(['All']);
  const [stakeholders, setStakeholders] = useState([]);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [editingItemId, setEditingItemId] = useState(null);
  const [modalMode, setModalMode] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isPreviewMode = !token && Boolean(previewData);

  const visibleItems = useMemo(
    () => isPreviewMode ? previewData.inventoryItems || [] : items,
    [isPreviewMode, items, previewData]
  );
  const visibleMovements = useMemo(
    () => isPreviewMode ? previewData.inventoryMovements || [] : movements,
    [isPreviewMode, movements, previewData]
  );
  const visibleBuildings = useMemo(
    () => isPreviewMode ? ['All', ...(previewData.buildings || []).map((building) => building.name)] : buildings,
    [buildings, isPreviewMode, previewData]
  );
  const visibleStakeholders = useMemo(
    () => isPreviewMode ? previewData.stakeholders || [] : stakeholders,
    [isPreviewMode, previewData, stakeholders]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return visibleItems;
    return visibleItems.filter((item) => [
      item.name,
      item.category,
      item.unit,
      item.currentStock,
      item.reorderLevel
    ].join(' ').toLowerCase().includes(query));
  }, [search, visibleItems]);

  const selectedMovementItem = useMemo(
    () => visibleItems.find((item) => String(item.id) === String(movementForm.itemId)) || null,
    [movementForm.itemId, visibleItems]
  );

  const movementAmount = movementForm.unitCost && movementForm.quantity
    ? Number(movementForm.quantity || 0) * Number(movementForm.unitCost || 0)
    : 0;

  const fetchInventory = useCallback(async (signal) => {
    if (!token) return;

    setIsLoading(true);
    setError('');

    try {
      const inventoryData = await readInventoryData({ activeBatchId, signal });
      if (signal?.aborted) return;

      setItems(inventoryData.items);
      setMovements(inventoryData.movements);
      if (inventoryData.buildings) setBuildings(inventoryData.buildings);
      if (inventoryData.stakeholders) setStakeholders(inventoryData.stakeholders);

      setMovementForm((current) => ({
        ...current,
        itemId: current.itemId || inventoryData.items[0]?.id || '',
        paidBy: normalizeStakeholderName(current.paidBy) || inventoryData.stakeholders?.find((item) => item.name === 'Rolly')?.name || inventoryData.stakeholders?.[0]?.name || '',
        paidTo: normalizeStakeholderName(current.paidTo) || inventoryData.stakeholders?.[0]?.name || ''
      }));
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError(err.message || 'Cannot connect to inventory.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [activeBatchId, token]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    const loadInventory = async () => {
      await Promise.resolve();
      if (!controller.signal.aborted) {
        fetchInventory(controller.signal);
      }
    };

    loadInventory();
    return () => controller.abort();
  }, [fetchInventory, token]);

  const updateItemForm = (field, value) => {
    setItemForm((current) => ({ ...current, [field]: value }));
  };

  const updateMovementForm = (field, value) => {
    setMovementForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'itemId') {
        const item = visibleItems.find((entry) => String(entry.id) === String(value));
        if (item) next.ledgerCategory = item.category === 'Feed' ? 'Feed' : item.category;
      }

      return next;
    });
  };

  const openNewItemModal = () => {
    setEditingItemId(null);
    setItemForm(emptyItemForm);
    setError('');
    setModalMode('item');
  };

  const openMovementModal = () => {
    setError('');
    setMovementForm((current) => ({
      ...current,
      itemId: current.itemId || visibleItems[0]?.id || ''
    }));
    setModalMode('movement');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingItemId(null);
    setError('');
  };

  const handleItemSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (readOnly) {
      setError('Your role can view inventory but cannot change stock records.');
      return;
    }

    if (editingItemId && !canEditOrDelete) {
      setError('Only owners can edit inventory items.');
      return;
    }

    const result = inventoryItemSchema.safeParse(itemForm);
    if (!result.success) {
      setError(result.error.errors.map((err) => err.message).join('. '));
      return;
    }

    try {
      if (editingItemId) {
        await apiClient.patch(`/api/inventory/items/${editingItemId}`, itemForm);
      } else {
        await apiClient.post('/api/inventory/items', itemForm);
      }
      await fetchInventory();
      closeModal();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Cannot save inventory item.');
    }
  };

  const handleMovementSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (readOnly) {
      setError('Your role can view inventory but cannot add stock movements.');
      return;
    }

    if (!movementForm.itemId) {
      setError('Select an inventory item first.');
      return;
    }

    if (movementForm.createLedger && movementForm.movementType === 'Stock In' && !activeBatch?.id) {
      setError('Select an active batch before adding this stock purchase to the ledger.');
      return;
    }

    if (
      movementForm.movementType === 'Stock Out' &&
      selectedMovementItem &&
      Number(movementForm.quantity || 0) > Number(selectedMovementItem.currentStock || 0)
    ) {
      setError(`${selectedMovementItem.name} cannot go below zero stock.`);
      return;
    }

    const payload = {
      ...movementForm,
      batchId: activeBatch?.id || null,
      amount: movementAmount || undefined,
      createLedger: movementForm.createLedger && movementForm.movementType === 'Stock In'
    };

    const result = inventoryMovementSchema.safeParse(payload);
    if (!result.success) {
      setError(result.error.errors.map((err) => err.message).join('. '));
      return;
    }

    try {
      await apiClient.post('/api/inventory/movements', payload);
      setMovementForm((current) => ({
        ...emptyMovementForm,
        itemId: current.itemId,
        paidBy: current.paidBy,
        paidTo: current.paidTo
      }));
      await fetchInventory();
      closeModal();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Cannot save inventory movement.');
    }
  };

  const handleEditItem = (item) => {
    if (!canEditOrDelete) return;

    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      targetQuantity: String(item.targetQuantity || ''),
      reorderLevel: String(item.reorderLevel || '')
    });
    setModalMode('item');
  };

  const exportToCSV = () => {
    const headers = ['Item', 'Category', 'In Stock', 'Unit', 'Reorder At', 'Status'];
    const rows = filteredItems.map((item) => [
      item.name,
      item.category,
      item.currentStock,
      item.unit,
      item.reorderLevel,
      getStockWarningType(item) === 'ok' ? 'OK' : 'Low stock'
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    {
      key: 'item',
      header: 'Item',
      render: (item) => (
        <div>
          <p className="font-semibold text-app-text">{item.name}</p>
          <p className="text-xs text-app-text-secondary">{item.category}</p>
        </div>
      )
    },
    {
      key: 'currentStock',
      header: 'In Stock',
      render: (item) => `${formatQuantity(item.currentStock)} ${item.unit || ''}`
    },
    {
      key: 'reorderLevel',
      header: 'Reorder At',
      render: (item) => `${formatQuantity(item.reorderLevel)} ${item.unit || ''}`
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => {
        const type = getStockWarningType(item);
        if (type === 'ok') return <Badge tone="success">OK</Badge>;
        return <Badge tone="danger">Low stock</Badge>;
      }
    },
    {
      key: 'actions',
      header: '',
      cellClassName: 'w-20',
      render: (item) => (
        <div className="no-print flex items-center gap-3">
          {canEditOrDelete && !readOnly ? (
            <button
              type="button"
              onClick={() => handleEditItem(item)}
              className="text-app-text hover:text-app-accent cursor-pointer"
              aria-label={`Edit ${item.name}`}
              title="Edit"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
          ) : null}
          <button
            type="button"
            disabled
            className="text-app-danger/70 disabled:cursor-not-allowed"
            aria-label={`Delete ${item.name}`}
            title="Delete is not available for inventory items yet"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      )
    }
  ];

  const movementColumns = [
    {
      key: 'itemName',
      header: 'Item',
      render: (movement) => movement.itemName || movement.item_name || 'Item'
    },
    {
      key: 'usedFor',
      header: 'Used For',
      render: (movement) => movement.remarks || `${movement.movementType || 'Movement'} ${movement.building ? `(${movement.building})` : ''}`
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (movement) => `${formatQuantity(movement.quantity)} ${movement.unit || ''}`
    },
    {
      key: 'date',
      header: 'Date',
      render: (movement) => movement.movementDate || movement.movement_date || ''
    }
  ];

  return (
    <div className="octavio-wide-page">
      <PageHeader title="Inventory" subtitle="Seeds, feed, tools, medicine and supplies." />

      <OfflineStaleBanner data={[items, movements]} />

      {error && (
        <div className="mb-4 rounded-2xl border border-app-danger bg-app-danger-bg p-4 text-sm font-semibold text-app-danger">
          {error}
        </div>
      )}

      {readOnly && (
        <div className="mb-5 rounded-2xl border border-app-accent bg-app-success-bg p-4 text-sm text-app-text">
          <p className="text-xs font-bold uppercase tracking-wide text-app-accent">Read-only access</p>
          <p className="mt-1">You can review stock levels and movement history. Inventory changes are restricted to operation managers and owners.</p>
        </div>
      )}

      <div className="no-print mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search items..."
        />
        <Button variant="secondary" onClick={exportToCSV}>
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export CSV
        </Button>
        {!readOnly && (
          <Button variant="secondary" onClick={openMovementModal}>
            <span className="material-symbols-outlined text-[18px]">swap_vert</span>
            Log Movement
          </Button>
        )}
        {!readOnly && (
          <Button onClick={openNewItemModal}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Item
          </Button>
        )}
      </div>

      {isLoading && <p className="mb-3 text-sm text-app-text-secondary">Loading inventory...</p>}

      <DataTable
        columns={columns}
        rows={filteredItems}
        emptyMessage={search ? 'No items match your search.' : 'No inventory items yet.'}
      />

      <h2 className="octavio-serif mt-8 mb-4 text-xl font-bold text-app-text">Usage history</h2>
      <DataTable
        columns={movementColumns}
        rows={visibleMovements.slice(0, 8)}
        emptyMessage="No inventory movements yet."
      />

      <Modal
        open={modalMode === 'item'}
        title={editingItemId ? 'Edit Item' : 'New Item'}
        helperText="Track feed, supplies, medicine, tools, and reorder levels."
        onClose={closeModal}
        footer={(
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleItemSubmit}>{editingItemId ? 'Update item' : 'Add item'}</Button>
          </>
        )}
      >
        <form onSubmit={handleItemSubmit}>
          <SectionLabel>Item</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Item Name" required>
              <TextInput
                required
                value={itemForm.name}
                onChange={(event) => updateItemForm('name', event.target.value)}
                placeholder="e.g. Starter Feed"
              />
            </FormField>
            <FormField label="Category" required>
              <SelectField
                value={itemForm.category}
                onChange={(event) => updateItemForm('category', event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </SelectField>
            </FormField>
            <FormField label="Unit" required>
              <SelectField
                value={itemForm.unit}
                onChange={(event) => updateItemForm('unit', event.target.value)}
              >
                {units.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </SelectField>
            </FormField>
            <FormField label="Needed Qty">
              <TextInput
                type="number"
                step="0.001"
                min="0"
                value={itemForm.targetQuantity}
                onChange={(event) => updateItemForm('targetQuantity', event.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label="Reorder At">
              <TextInput
                type="number"
                step="0.001"
                min="0"
                value={itemForm.reorderLevel}
                onChange={(event) => updateItemForm('reorderLevel', event.target.value)}
                placeholder="0"
              />
            </FormField>
          </div>
          <button type="submit" className="hidden">Submit item</button>
        </form>
      </Modal>

      <Modal
        open={modalMode === 'movement'}
        title="Log Movement"
        helperText="Record stock in, stock out, adjustments, and transfers."
        onClose={closeModal}
        footer={(
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleMovementSubmit}>Save movement</Button>
          </>
        )}
      >
        <form onSubmit={handleMovementSubmit}>
          <SectionLabel>Movement</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Date" required>
              <TextInput
                type="date"
                required
                value={movementForm.movementDate}
                onChange={(event) => updateMovementForm('movementDate', event.target.value)}
              />
            </FormField>
            <FormField label="Type" required>
              <SelectField
                value={movementForm.movementType}
                onChange={(event) => updateMovementForm('movementType', event.target.value)}
              >
                {movementTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </SelectField>
            </FormField>
            <FormField label="Item" required className="sm:col-span-2">
              <SelectField
                required
                value={movementForm.itemId}
                onChange={(event) => updateMovementForm('itemId', event.target.value)}
              >
                {visibleItems.length === 0 && <option value="">No inventory items</option>}
                {visibleItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({formatQuantity(item.currentStock)} {item.unit})
                  </option>
                ))}
              </SelectField>
            </FormField>
            <FormField label="Qty" required>
              <TextInput
                type="number"
                step="0.001"
                required
                value={movementForm.quantity}
                onChange={(event) => updateMovementForm('quantity', event.target.value)}
                placeholder={movementForm.movementType === 'Adjustment' ? '+/-' : '0'}
              />
            </FormField>
            <FormField label="Unit Cost">
              <TextInput
                type="number"
                step="0.0001"
                min="0"
                value={movementForm.unitCost}
                onChange={(event) => updateMovementForm('unitCost', event.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label="Building">
              <SelectField
                value={movementForm.building}
                onChange={(event) => updateMovementForm('building', event.target.value)}
              >
                {visibleBuildings.map((building) => (
                  <option key={building} value={building}>{building}</option>
                ))}
              </SelectField>
            </FormField>
            <FormField label="Remarks" className="sm:col-span-2">
              <TextInput
                value={movementForm.remarks}
                onChange={(event) => updateMovementForm('remarks', event.target.value)}
                placeholder="Optional"
              />
            </FormField>
          </div>

          {movementForm.movementType === 'Stock In' && (
            <div className="mt-4 rounded-2xl border border-app-border bg-app-card/70 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-app-text-secondary">
                <input
                  type="checkbox"
                  checked={movementForm.createLedger}
                  onChange={(event) => updateMovementForm('createLedger', event.target.checked)}
                  className="h-4 w-4 accent-app-accent"
                />
                Add purchase to expenses
              </label>

              {movementForm.createLedger && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <FormField label="Funding">
                    <SelectField
                      value={movementForm.fundingNature}
                      onChange={(event) => updateMovementForm('fundingNature', event.target.value)}
                    >
                      {ledgerFunding.map((funding) => (
                        <option key={funding} value={funding}>{funding}</option>
                      ))}
                    </SelectField>
                  </FormField>
                  <FormField label="Category">
                    <TextInput
                      value={movementForm.ledgerCategory}
                      onChange={(event) => updateMovementForm('ledgerCategory', event.target.value)}
                    />
                  </FormField>
                  <FormField label="Paid By">
                    <SelectField
                      value={movementForm.paidBy}
                      onChange={(event) => updateMovementForm('paidBy', event.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {visibleStakeholders.map((stakeholder) => (
                        <option key={stakeholder.id} value={stakeholder.name}>{stakeholder.name}</option>
                      ))}
                    </SelectField>
                  </FormField>
                  <FormField label="Paid To">
                    <SelectField
                      value={movementForm.paidTo}
                      onChange={(event) => updateMovementForm('paidTo', event.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {visibleStakeholders.map((stakeholder) => (
                        <option key={stakeholder.id} value={stakeholder.name}>{stakeholder.name}</option>
                      ))}
                    </SelectField>
                  </FormField>
                  <FormField label="Reference" className="sm:col-span-2">
                    <TextInput
                      value={movementForm.reference}
                      onChange={(event) => updateMovementForm('reference', event.target.value)}
                      placeholder="Invoice or OR reference"
                    />
                  </FormField>
                  <p className="sm:col-span-2 text-right text-sm font-bold text-app-text-secondary">
                    Expense amount: {formatMoney(movementAmount)}
                  </p>
                </div>
              )}
            </div>
          )}
          <button type="submit" className="hidden">Submit movement</button>
        </form>
      </Modal>
    </div>
  );
}
