import { useEffect, useState } from 'react';
import { getQueue } from './db';

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadInitialCount() {
      try {
        const queue = await getQueue();
        if (active) {
          const pending = queue.filter(item => item.status === 'pending' || item.status === 'syncing' || item.status === 'conflict');
          setPendingCount(pending.length);
        }
      } catch (err) {
        console.warn('Failed to load queue count:', err);
      }
    }

    loadInitialCount();

    const handleOnline = () => {
      setIsOnline(true);
      window.dispatchEvent(new CustomEvent('sync-status-changed'));
    };

    const handleOffline = () => {
      setIsOnline(false);
      window.dispatchEvent(new CustomEvent('sync-status-changed'));
    };

    const handleSyncStatusChanged = async () => {
      if (typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
      }
      try {
        const queue = await getQueue();
        if (active) {
          const pending = queue.filter(item => item.status === 'pending' || item.status === 'syncing' || item.status === 'conflict');
          setPendingCount(pending.length);
        }
      } catch (err) {
        console.warn('Failed to load queue count:', err);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-status-changed', handleSyncStatusChanged);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-status-changed', handleSyncStatusChanged);
    };
  }, []);

  return { isOnline, pendingCount };
}
