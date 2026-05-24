import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';

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

const categories = ['Feed', 'Medicine', 'Supplies', 'Equipment', 'Chicks'];
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
  return `PHP ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function getStockWarningType(item) {
  if (['low-stock', 'needed-stock', 'ok'].includes(item.warningType)) {
    return item.warningType;
  }

  const currentStock = Number(item.currentStock || 0);
  const targetQuantity = Number(item.targetQuantity || 0);
  const reorderLevel = Number(item.reorderLevel || 0);

  if (reorderLevel > 0 && currentStock < reorderLevel) return 'low-stock';
  if (targetQuantity > 0 && currentStock < targetQuantity) return 'needed-stock';
  return 'ok';
}

function getStockWarningMeta(type) {
  if (type === 'low-stock') {
    return {
      label: 'Low alert',
      border: 'border-app-danger bg-app-danger-bg',
      valueText: 'text-app-danger',
      badgeText: 'text-app-danger'
    };
  }

  if (type === 'needed-stock') {
    return {
      label: 'Needed stock gap',
      border: 'border-app-warning bg-app-warning-bg',
      valueText: 'text-app-warning',
      badgeText: 'text-app-warning'
    };
  }

  return {
    label: 'Stock met',
    border: 'border-app-border',
    valueText: 'text-app-success',
    badgeText: 'text-app-success'
  };
}

function formatWarningNames(items) {
  return `${items.slice(0, 3).map((item) => item.name).join(', ')}${items.length > 3 ? ` +${items.length - 3} more` : ''}`;
}

function getMovementTone(type) {
  if (type === 'Stock In') return 'text-app-success';
  if (type === 'Stock Out') return 'text-app-danger';
  return 'text-app-text-secondary';
}

function normalizeStakeholderName(name) {
  return name === 'Yanyan' ? 'Others' : name;
}

function uniqueStakeholders(stakeholders) {
  const seen = new Set();
  return stakeholders.reduce((list, stakeholder) => {
    const name = normalizeStakeholderName(stakeholder.name);
    if (seen.has(name)) return list;
    seen.add(name);
    list.push({ ...stakeholder, name });
    return list;
  }, []);
}

export default function InventoryManagement({ token, activeBatch, readOnly = false, canEditOrDelete = false, previewData = null }) {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [buildings, setBuildings] = useState(['All']);
  const [stakeholders, setStakeholders] = useState([]);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [editingItemId, setEditingItemId] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const lowStockItems = useMemo(
    () => items.filter((item) => getStockWarningType(item) === 'low-stock'),
    [items]
  );

  const neededStockItems = useMemo(
    () => items.filter((item) => getStockWarningType(item) === 'needed-stock'),
    [items]
  );

  const feedStock = useMemo(
    () => items
      .filter((item) => item.category === 'Feed')
      .reduce((sum, item) => sum + Number(item.currentStock || 0), 0),
    [items]
  );

  const movementAmount = movementForm.unitCost && movementForm.quantity
    ? Number(movementForm.quantity || 0) * Number(movementForm.unitCost || 0)
    : 0;

  const fetchInventory = async () => {
    if (!token) return;

    setIsLoading(true);
    setError('');

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [itemResponse, movementResponse, buildingResponse, stakeholderResponse] = await Promise.all([
        fetch(`${API_BASE}/api/inventory/items`, { headers }),
        fetch(`${API_BASE}/api/inventory/movements${activeBatch?.id ? `?batchId=${activeBatch.id}` : ''}`, { headers }),
        fetch(`${API_BASE}/api/buildings`, { headers }),
        fetch(`${API_BASE}/api/stakeholders`, { headers })
      ]);

      const [itemData, movementData, buildingData, stakeholderData] = await Promise.all([
        itemResponse.json(),
        movementResponse.json(),
        buildingResponse.json(),
        stakeholderResponse.json()
      ]);

      if (!itemResponse.ok || !movementResponse.ok) {
        setError(itemData.error || movementData.error || 'Failed to load inventory.');
        return;
      }

      setItems(itemData);
      setMovements(movementData);
      if (buildingResponse.ok) setBuildings(['All', ...buildingData.map((building) => building.name)]);
      const nextStakeholders = uniqueStakeholders(stakeholderData);
      if (stakeholderResponse.ok) setStakeholders(nextStakeholders);

      setMovementForm((current) => ({
        ...current,
        itemId: current.itemId || itemData[0]?.id || '',
        paidBy: normalizeStakeholderName(current.paidBy) || nextStakeholders.find((item) => item.name === 'Rolly')?.name || nextStakeholders[0]?.name || '',
        paidTo: normalizeStakeholderName(current.paidTo) || nextStakeholders[0]?.name || ''
      }));
    } catch (err) {
      console.error(err);
      setError('Cannot connect to inventory.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token && previewData) {
      setTimeout(() => {
        setItems(previewData.inventoryItems || []);
        setMovements(previewData.inventoryMovements || []);
        setBuildings(['All', ...(previewData.buildings || []).map((building) => building.name)]);
        setStakeholders(previewData.stakeholders || []);
        setError('');
        setIsLoading(false);
      }, 0);
      return;
    }

    setTimeout(() => {
      fetchInventory();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeBatch?.id, previewData]);

  const updateItemForm = (field, value) => {
    setItemForm((current) => ({ ...current, [field]: value }));
  };

  const updateMovementForm = (field, value) => {
    setMovementForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'itemId') {
        const item = items.find((entry) => String(entry.id) === String(value));
        if (item) next.ledgerCategory = item.category === 'Feed' ? 'Feed' : item.category;
      }

      return next;
    });
  };

  const resetItemForm = () => {
    setEditingItemId(null);
    setItemForm(emptyItemForm);
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
      setError('Only admin.roland can edit inventory items.');
      return;
    }

    try {
      const response = await fetch(
        editingItemId ? `${API_BASE}/api/inventory/items/${editingItemId}` : `${API_BASE}/api/inventory/items`,
        {
          method: editingItemId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(itemForm)
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save inventory item.');
        return;
      }

      await fetchInventory();
      resetItemForm();
    } catch (err) {
      console.error(err);
      setError('Cannot save inventory item.');
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

    try {
      const response = await fetch(`${API_BASE}/api/inventory/movements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...movementForm,
          batchId: activeBatch?.id || null,
          amount: movementAmount || undefined,
          createLedger: movementForm.createLedger && movementForm.movementType === 'Stock In'
        })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save inventory movement.');
        return;
      }

      setMovementForm((current) => ({
        ...emptyMovementForm,
        itemId: current.itemId,
        paidBy: current.paidBy,
        paidTo: current.paidTo
      }));
      await fetchInventory();
    } catch (err) {
      console.error(err);
      setError('Cannot save inventory movement.');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-page">
      <div className="mb-6 mt-2">
        <h2 className="text-3xl font-extrabold text-app-text tracking-tight font-hanken">Inventory</h2>
        <p className="text-app-text-secondary text-sm mt-1">
          {activeBatch?.id ? `Batch ${activeBatch.id}` : 'Farm stock tracker'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Low Alerts</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${lowStockItems.length ? 'text-app-danger' : 'text-app-success'}`}>
            {lowStockItems.length}
          </p>
        </div>

        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Need Gaps</p>
          <p className={`text-lg font-black mt-1 font-jetbrains ${neededStockItems.length ? 'text-app-warning' : 'text-app-success'}`}>
            {neededStockItems.length}
          </p>
        </div>

        <div className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm col-span-2 lg:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Feed Stock</p>
          <p className="text-lg font-black mt-1 text-app-text font-jetbrains">
            {formatQuantity(feedStock)} sacks
          </p>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-app-danger-bg border border-app-danger rounded-xl p-3 mb-6">
          <p className="text-xs font-black uppercase tracking-wider text-app-danger">Low Stock Warning</p>
          <p className="text-sm font-bold text-app-danger mt-1">
            {formatWarningNames(lowStockItems)}
          </p>
        </div>
      )}

      {neededStockItems.length > 0 && (
        <div className="bg-app-warning-bg border border-app-warning rounded-xl p-3 mb-6">
          <p className="text-xs font-black uppercase tracking-wider text-app-warning">Needed Stock Gap</p>
          <p className="text-sm font-bold text-app-warning mt-1">
            {formatWarningNames(neededStockItems)}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-app-danger-bg text-app-danger p-3 rounded-xl text-sm font-bold mb-4 border border-app-danger">
          {error}
        </div>
      )}

      {readOnly && (
        <div className="bg-app-success-bg border border-app-accent rounded-xl p-3 mb-6">
          <p className="text-xs font-black uppercase tracking-wider text-app-accent">Read-only access</p>
          <p className="text-sm font-bold text-app-text-secondary mt-1">
            You can review stock levels and movement history. Inventory changes are restricted to operation managers and owners.
          </p>
        </div>
      )}

      {!readOnly && (
      <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-app-text-secondary font-hanken">
            {editingItemId ? 'Edit Item' : 'New Item'}
          </h3>
          {editingItemId && (
            <button type="button" onClick={resetItemForm} className="text-xs font-bold text-app-text-secondary hover:text-app-text transition-colors">
              Cancel
            </button>
          )}
        </div>

        <form onSubmit={handleItemSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-app-text-secondary mb-1">Item Name</label>
            <input
              type="text"
              required
              value={itemForm.name}
              onChange={(event) => updateItemForm('name', event.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
              placeholder="e.g. Starter Feed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1">Category</label>
              <select
                value={itemForm.category}
                onChange={(event) => updateItemForm('category', event.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all font-bold"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1">Unit</label>
              <select
                value={itemForm.unit}
                onChange={(event) => updateItemForm('unit', event.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all font-bold"
              >
                {units.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1">Needed Qty</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={itemForm.targetQuantity}
                onChange={(event) => updateItemForm('targetQuantity', event.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-jetbrains transition-all"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1">Low Alert</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={itemForm.reorderLevel}
                onChange={(event) => updateItemForm('reorderLevel', event.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-jetbrains transition-all"
                placeholder="0"
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-app-accent text-app-on-accent p-3 rounded-xl font-bold shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer">
            {editingItemId ? 'Update Item' : 'Save Item'}
          </button>
        </form>
      </div>
      )}

      {!readOnly && (
      <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-app-text-secondary mb-4 font-hanken">
          Stock Movement
        </h3>

        <form onSubmit={handleMovementSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1">Date</label>
              <input
                type="date"
                required
                value={movementForm.movementDate}
                onChange={(event) => updateMovementForm('movementDate', event.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-bold transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1">Type</label>
              <select
                value={movementForm.movementType}
                onChange={(event) => updateMovementForm('movementType', event.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-bold transition-all"
              >
                {movementTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text-secondary mb-1">Item</label>
            <select
              required
              value={movementForm.itemId}
              onChange={(event) => updateMovementForm('itemId', event.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-bold transition-all"
            >
              {items.length === 0 && <option value="">No inventory items</option>}
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({formatQuantity(item.currentStock)} {item.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1">Qty</label>
              <input
                type="number"
                step="0.001"
                required
                value={movementForm.quantity}
                onChange={(event) => updateMovementForm('quantity', event.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-jetbrains transition-all"
                placeholder={movementForm.movementType === 'Adjustment' ? '+/-' : '0'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1">Unit Cost</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={movementForm.unitCost}
                onChange={(event) => updateMovementForm('unitCost', event.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-jetbrains transition-all"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text-secondary mb-1">Building</label>
              <select
                value={movementForm.building}
                onChange={(event) => updateMovementForm('building', event.target.value)}
                className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent font-bold transition-all"
              >
                {buildings.map((building) => (
                  <option key={building} value={building}>{building}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-app-text-secondary mb-1">Remarks</label>
            <input
              type="text"
              value={movementForm.remarks}
              onChange={(event) => updateMovementForm('remarks', event.target.value)}
              className="w-full p-3 border border-app-border rounded-xl bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
              placeholder="Optional"
            />
          </div>

          {movementForm.movementType === 'Stock In' && (
            <div className="rounded-xl border border-app-border p-3 space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-app-text-secondary">
                <input
                  type="checkbox"
                  checked={movementForm.createLedger}
                  onChange={(event) => updateMovementForm('createLedger', event.target.checked)}
                  className="h-4 w-4 accent-app-accent"
                />
                Add purchase to ledger
              </label>

              {movementForm.createLedger && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-app-text-secondary mb-1">Funding</label>
                      <select
                        value={movementForm.fundingNature}
                        onChange={(event) => updateMovementForm('fundingNature', event.target.value)}
                        className="w-full p-2 border border-app-border rounded-lg bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
                      >
                        {ledgerFunding.map((funding) => (
                          <option key={funding} value={funding}>{funding}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-app-text-secondary mb-1">Category</label>
                      <input
                        type="text"
                        value={movementForm.ledgerCategory}
                        onChange={(event) => updateMovementForm('ledgerCategory', event.target.value)}
                        className="w-full p-2 border border-app-border rounded-lg bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-app-text-secondary mb-1">Paid By</label>
                      <select
                        value={movementForm.paidBy}
                        onChange={(event) => updateMovementForm('paidBy', event.target.value)}
                        className="w-full p-2 border border-app-border rounded-lg bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
                      >
                        <option value="">-- Select --</option>
                        {stakeholders.map((stakeholder) => (
                          <option key={stakeholder.id} value={stakeholder.name}>{stakeholder.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-app-text-secondary mb-1">Paid To</label>
                      <select
                        value={movementForm.paidTo}
                        onChange={(event) => updateMovementForm('paidTo', event.target.value)}
                        className="w-full p-2 border border-app-border rounded-lg bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
                      >
                        <option value="">-- Select --</option>
                        {stakeholders.map((stakeholder) => (
                          <option key={stakeholder.id} value={stakeholder.name}>{stakeholder.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={movementForm.reference}
                    onChange={(event) => updateMovementForm('reference', event.target.value)}
                    className="w-full p-2 border border-app-border rounded-lg bg-app-bg text-app-text outline-none focus:ring-2 focus:ring-app-accent transition-all"
                    placeholder="Invoice or OR reference"
                  />

                  <div className="text-right text-xs font-black text-app-text-secondary font-jetbrains">
                    Ledger amount: {formatMoney(movementAmount)}
                  </div>
                </>
              )}
            </div>
          )}

          <button type="submit" className="w-full bg-app-accent text-app-on-accent p-3 rounded-xl font-bold shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer">
            Save Movement
          </button>
        </form>
      </div>
      )}

      {isLoading && (
        <p className="text-sm text-app-text-secondary mb-3">Loading inventory...</p>
      )}

      <div className="mb-6">
        <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider mb-3 ml-1">
          Current Stock
        </h3>
        <div className="space-y-3">
          {items.map((item) => {
            const warningType = getStockWarningType(item);
            const warningMeta = getStockWarningMeta(warningType);

            return (
              <div key={item.id} className={`bg-app-card p-4 rounded-xl border shadow-sm ${warningMeta.border}`}>
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-app-text truncate">{item.name}</p>
                    <p className="text-xs text-app-text-secondary font-bold uppercase mt-1">{item.category}</p>
                    {warningType !== 'ok' && (
                      <p className={`text-[10px] font-black uppercase tracking-wider mt-1 ${warningMeta.badgeText}`}>
                        {warningMeta.label}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black font-jetbrains ${warningMeta.valueText}`}>
                      {formatQuantity(item.currentStock)}
                    </p>
                    <p className="text-xs text-app-text-secondary">{item.unit}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
                  <p className={`${warningType === 'needed-stock' ? 'bg-app-warning-bg text-app-warning' : 'bg-app-bg text-app-text-secondary'} rounded-lg p-2 font-bold`}>
                    Need <span className="font-black font-jetbrains">{formatQuantity(item.targetQuantity)}</span>
                  </p>
                  <p className={`${warningType === 'low-stock' ? 'bg-app-danger-bg text-app-danger' : 'bg-app-bg text-app-text-secondary'} rounded-lg p-2 font-bold`}>
                    Alert <span className="font-black font-jetbrains">{formatQuantity(item.reorderLevel)}</span>
                  </p>
                  {readOnly || !canEditOrDelete ? (
                    <p className="bg-app-bg rounded-lg p-2 text-app-text-secondary font-black text-center">
                      View only
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEditItem(item)}
                      className="bg-app-accent/10 text-app-accent border border-app-accent/20 hover:bg-app-accent/20 rounded-lg p-2 font-black transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-app-text-secondary uppercase tracking-wider mb-3 ml-1">
          Recent Movements
        </h3>
        <div className="space-y-3">
          {movements.map((movement) => (
            <div key={movement.id} className="bg-app-card p-4 rounded-xl border border-app-border shadow-sm">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-app-text truncate">{movement.itemName}</p>
                  <p className="text-xs text-app-text-secondary font-bold mt-1">
                    {movement.movementDate} - Bldg {movement.building}
                  </p>
                  {movement.linkedTransactionId && (
                    <p className="text-[10px] text-app-accent font-bold mt-1">Ledger {movement.linkedTransactionId}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black ${getMovementTone(movement.movementType)}`}>{movement.movementType}</p>
                  <p className="text-lg font-black text-app-text font-jetbrains">
                    {formatQuantity(movement.quantity)} {movement.unit}
                  </p>
                </div>
              </div>
              {movement.remarks && (
                <p className="text-xs text-app-text-secondary italic mt-2 truncate">"{movement.remarks}"</p>
              )}
            </div>
          ))}

          {movements.length === 0 && (
            <p className="text-center text-app-text-secondary text-sm mt-4">No inventory movements yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
