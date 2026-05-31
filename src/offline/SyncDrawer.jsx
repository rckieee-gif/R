import { useState, useEffect, useCallback, useRef } from 'react';
import { openDatabase, removeFromQueue, updateQueueStatus, getQueue } from './db';
import { processSyncQueue } from './syncQueue';
import { apiClient } from '../shared/utils/apiClient';

function formatLedgerMoney(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '₱0.00';
  return `₱${Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function getQueueItemLabel(item) {
  const p = item.payload || {};
  switch (item.type) {
    case 'CREATE_DAILY_LOG':
    case 'UPDATE_DAILY_LOG':
      return `Daily log for Building ${p.building || '?'}`;
    case 'SAVE_INVENTORY_ITEM':
      return `Inventory item: ${p.name || '?'}`;
    case 'SAVE_INVENTORY_MOVEMENT':
      return `Feed movement: ${p.feedName || p.itemName || 'Feed'} ${p.bags || p.quantity || 0} sacks`;
    case 'SAVE_TRANSACTION':
      return `${p.type || 'Transaction'}: ${p.description || p.category || 'Record'} ${formatLedgerMoney(p.amount || p.totalPrice)}`;
    case 'VOID_TRANSACTION':
      return `Void transaction #${p.transactionId || '?'}`;
    case 'SAVE_HARVEST_REPORT':
      return `Harvest report: Batch #${p.batchId || '?'}`;
    case 'SAVE_EMPLOYEE':
      return `Employee record: ${p.name || '?'}`;
    default:
      return `${item.type.replace(/_/g, ' ').toLowerCase()}`;
  }
}

async function updateQueuePayload(id, nextPayload) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.payload = nextPayload;
        item.status = 'pending';
        item.error = null;
        const putReq = store.put(item);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export default function SyncDrawer({ isOpen, onClose }) {
  const [queueItems, setQueueItems] = useState([]);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // JSON payload editor states
  const [editingItem, setEditingItem] = useState(null);
  const [editPayloadStr, setEditPayloadStr] = useState('');
  const [editError, setEditError] = useState('');

  // Accidental close protection (double clicks, click propagation, mouseup mismatch)
  const openTimeRef = useRef(0);
  const prevIsOpenRef = useRef(isOpen);

  if (isOpen && !prevIsOpenRef.current) {
    openTimeRef.current = Date.now();
  }
  prevIsOpenRef.current = isOpen;

  const handleBackdropClick = (e) => {
    if (Date.now() - openTimeRef.current < 300) {
      return;
    }
    onClose();
  };

  const reloadQueue = useCallback(async () => {
    try {
      const items = await getQueue();
      setQueueItems(items);
    } catch (err) {
      console.warn('Failed to load sync queue items in drawer:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      Promise.resolve().then(() => {
        reloadQueue();
      });
    }
  }, [isOpen, reloadQueue]);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      Promise.resolve().then(() => {
        setIsOnline(navigator.onLine);
      });
    }
    const handleSyncChange = () => {
      reloadQueue();
      if (typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
      }
    };
    window.addEventListener('sync-status-changed', handleSyncChange);
    return () => {
      window.removeEventListener('sync-status-changed', handleSyncChange);
    };
  }, [reloadQueue]);

  // Sync Queue handlers
  const handleRetryQueueItem = async (id) => {
    try {
      await updateQueueStatus(id, 'pending');
      window.dispatchEvent(new CustomEvent('sync-status-changed'));
      await processSyncQueue(apiClient);
    } catch (err) {
      console.error('Failed to retry sync queue item:', err);
    }
  };

  const handleDiscardQueueItem = async (id) => {
    try {
      await removeFromQueue(id);
      window.dispatchEvent(new CustomEvent('sync-status-changed'));
    } catch (err) {
      console.error('Failed to discard sync queue item:', err);
    }
  };

  const handleEditClick = (item) => {
    setEditingItem(item);
    setEditPayloadStr(JSON.stringify(item.payload, null, 2));
    setEditError('');
  };

  const handleSaveEdit = async () => {
    try {
      const parsed = JSON.parse(editPayloadStr);
      await updateQueuePayload(editingItem.id, parsed);
      setEditingItem(null);
      window.dispatchEvent(new CustomEvent('sync-status-changed'));
      await processSyncQueue(apiClient);
    } catch (err) {
      setEditError(err.message || 'Invalid JSON format');
    }
  };

  if (!isOpen) return null;

  // Sync Queue Separation
  const pendingQueue = queueItems.filter(item => item.status === 'pending' || item.status === 'syncing');
  const failedQueue = queueItems.filter(item => item.status === 'conflict');

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity duration-300 animate-fade-in"
        onClick={handleBackdropClick}
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-app-card border-l border-app-border z-50 shadow-2xl flex flex-col animate-slide-in text-app-text">
        {/* Drawer Header */}
        <div className="p-4 border-b border-app-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold font-hanken">Sync Queue</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-app-success shadow-[0_0_6px_var(--app-success)]' : 'bg-app-warning animate-pulse shadow-[0_0_6px_var(--app-warning)]'}`} />
              <span className="text-[10px] font-bold text-app-text-secondary font-jetbrains uppercase tracking-wider">
                {isOnline ? 'Online' : 'Offline'} • {queueItems.length} items
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-app-bg flex items-center justify-center text-app-text-secondary hover:text-app-text cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {queueItems.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-app-success-bg/20 flex items-center justify-center text-app-success">
                <span className="material-symbols-outlined text-4xl font-bold">cloud_done</span>
              </div>
              <div>
                <h4 className="text-sm font-bold font-hanken uppercase tracking-wider">All Synced</h4>
                <p className="text-xs text-app-text-secondary mt-1.5 leading-relaxed font-inter">
                  Your local database is fully up to date. All operational logs and transactions are saved securely to the cloud.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Pending Section */}
              {pendingQueue.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-app-text-secondary uppercase tracking-widest font-jetbrains mb-2">
                    Pending ({pendingQueue.length})
                  </h4>
                  <ul className="space-y-2">
                    {pendingQueue.map(item => (
                      <li 
                        key={item.id} 
                        className="bg-app-bg border border-app-border/60 p-3 rounded-xl flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate leading-snug">
                            {getQueueItemLabel(item)}
                          </p>
                          <p className="text-[9px] text-app-text-secondary font-jetbrains mt-0.5 uppercase">
                            Created: {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className="shrink-0 flex items-center gap-1 text-app-info text-[9px] font-bold bg-app-info/10 px-2 py-0.5 rounded border border-app-info/20">
                          <span className="material-symbols-outlined text-[10px] animate-spin">sync</span>
                          {item.status === 'syncing' ? 'Syncing' : 'Pending'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Failed Section */}
              {failedQueue.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-app-danger uppercase tracking-widest font-jetbrains mb-2">
                    Failed ({failedQueue.length})
                  </h4>
                  <ul className="space-y-3">
                    {failedQueue.map(item => (
                      <li 
                        key={item.id} 
                        className="bg-app-card border border-app-danger/30 p-3.5 rounded-xl flex flex-col gap-2 relative shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-app-text leading-snug">
                              {getQueueItemLabel(item)}
                            </p>
                            {item.error && (
                              <p className="text-[10px] text-app-danger font-jetbrains mt-1 bg-app-danger-bg border border-app-danger/10 p-2 rounded leading-relaxed">
                                Error: {item.error}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-app-danger text-[9px] font-bold bg-app-danger-bg px-2 py-0.5 rounded border border-app-danger/20 uppercase">
                            Failed
                          </span>
                        </div>

                        {/* Inline Actions */}
                        <div className="flex flex-wrap items-center gap-2 mt-1 border-t border-app-border/40 pt-2.5 text-[10px] font-bold font-jetbrains">
                          <button
                            type="button"
                            onClick={() => handleRetryQueueItem(item.id)}
                            className="px-3 py-1.5 rounded bg-app-accent text-app-on-accent hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs font-bold">replay</span> Retry
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditClick(item)}
                            className="px-3 py-1.5 rounded bg-app-card border border-app-border hover:bg-app-bg active:scale-95 transition-all cursor-pointer text-app-text flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">edit</span> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDiscardQueueItem(item.id)}
                            className="px-3 py-1.5 rounded bg-app-danger-bg text-app-danger hover:bg-app-danger hover:text-white active:scale-95 transition-all cursor-pointer flex items-center gap-1 border border-app-danger/10"
                          >
                            <span className="material-symbols-outlined text-xs font-bold">delete</span> Discard
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* JSON Payload Editor Modal overlaying the drawer */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-app-card border border-app-border w-full max-w-lg rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <div>
                <h3 className="text-lg font-bold font-hanken">Edit Queue Payload</h3>
                <p className="text-[10px] text-app-text-secondary font-jetbrains mt-0.5">
                  ID: {editingItem.id} ({editingItem.type})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-app-text-secondary hover:text-app-text cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest font-jetbrains">
                Payload JSON
              </label>
              <textarea
                value={editPayloadStr}
                onChange={(e) => setEditPayloadStr(e.target.value)}
                rows="10"
                className="w-full bg-app-bg border border-app-border rounded-xl p-3 font-jetbrains text-xs text-app-text focus:outline-none focus:border-app-accent resize-none leading-relaxed shadow-inner"
              />
              {editError && (
                <p className="text-xs text-app-danger font-bold mt-1 bg-app-danger-bg border border-app-danger/25 p-2 rounded font-jetbrains">
                  Error: {editError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-2 border-t border-app-border pt-4">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-sm font-extrabold font-hanken rounded-xl border border-app-border hover:bg-app-bg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm font-extrabold font-hanken rounded-xl bg-app-accent text-app-on-accent hover:opacity-90 cursor-pointer shadow-md transition-all active:scale-95"
              >
                Save & Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
