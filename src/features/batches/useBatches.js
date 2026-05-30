import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../shared/utils/apiClient';

function getBatchPreferenceKey(user) {
  const identifier = user?.username || user?.email || user?.role || 'member';
  return `octavioActiveBatchId:${identifier}`;
}

function isCurrentBatch(batch) {
  const status = String(batch?.status || '').trim().toLowerCase();
  return status === 'ongoing' || status === 'active';
}

function pickPreferredBatch(batches, user) {
  const list = Array.isArray(batches) ? batches : [];
  const savedBatchId = localStorage.getItem(getBatchPreferenceKey(user));

  return (
    list.find((batch) => String(batch.id) === String(savedBatchId)) ||
    list.find(isCurrentBatch) ||
    list[0] ||
    null
  );
}

export default function useBatches(token, user, viewerSnapshot) {
  const isPublicViewer = Boolean(user?.isPublicViewer);

  const [activeBatch, setActiveBatch] = useState(null);
  const [batchesState, setBatchesState] = useState([]);
  const [isBatchListLoading, setIsBatchListLoading] = useState(false);
  const [batchListError, setBatchListError] = useState('');

  const batches = useMemo(() => {
    if (isPublicViewer && viewerSnapshot?.batches) {
      return viewerSnapshot.batches;
    }
    return batchesState;
  }, [isPublicViewer, viewerSnapshot, batchesState]);

  const visibleActiveBatch = useMemo(() => {
    if (isPublicViewer) {
      return viewerSnapshot?.batch || viewerSnapshot?.batches?.[0] || null;
    }
    return activeBatch;
  }, [isPublicViewer, viewerSnapshot, activeBatch]);

  const selectActiveBatch = useCallback((batch) => {
    setActiveBatch(batch || null);

    if (!isPublicViewer && batch?.id) {
      localStorage.setItem(getBatchPreferenceKey(user), String(batch.id));
    }
  }, [isPublicViewer, user]);

  const handleBatchSelectorChange = useCallback((event) => {
    const nextBatch = batches.find((batch) => String(batch.id) === event.target.value) || null;
    selectActiveBatch(nextBatch);
  }, [batches, selectActiveBatch]);

  const refreshBatches = useCallback(async () => {
    if (isPublicViewer || !token) {
      return;
    }

    setIsBatchListLoading(true);
    setBatchListError('');

    try {
      const data = await apiClient.get('/api/batches', { expectArray: true });
      const nextBatches = Array.isArray(data) ? data : [];

      setBatchesState(nextBatches);
      setActiveBatch((currentBatch) => {
        const currentMatch = nextBatches.find((batch) => String(batch.id) === String(currentBatch?.id));
        const nextBatch = currentMatch || pickPreferredBatch(nextBatches, user);

        if (nextBatch?.id) {
          localStorage.setItem(getBatchPreferenceKey(user), String(nextBatch.id));
        }

        return nextBatch;
      });
    } catch (error) {
      console.error("Failed to fetch batches:", error);
      setBatchesState([]);
      setActiveBatch(null);
      setBatchListError('Batch list is unavailable. Try refreshing or open Batches after the connection recovers.');
    } finally {
      setIsBatchListLoading(false);
    }
  }, [isPublicViewer, token, user]);

  useEffect(() => {
    if (isPublicViewer || !token) {
      return undefined;
    }

    let isCancelled = false;

    const fetchBatches = async () => {
      setIsBatchListLoading(true);
      setBatchListError('');

      try {
        const data = await apiClient.get('/api/batches', { expectArray: true });
        if (isCancelled) return;

        setBatchesState(data);
        setActiveBatch((currentBatch) => {
          const currentMatch = data.find((batch) => String(batch.id) === String(currentBatch?.id));
          const nextBatch = currentMatch || pickPreferredBatch(data, user);

          if (nextBatch?.id) {
            localStorage.setItem(getBatchPreferenceKey(user), String(nextBatch.id));
          }

          return nextBatch;
        });
      } catch (error) {
        if (isCancelled) return;
        console.error("Failed to fetch batches:", error);
        setBatchesState([]);
        setActiveBatch(null);
        setBatchListError('Batch list is unavailable. Try refreshing or open Batches after the connection recovers.');
      } finally {
        if (!isCancelled) {
          setIsBatchListLoading(false);
        }
      }
    };

    fetchBatches();

    return () => {
      isCancelled = true;
    };
  }, [token, isPublicViewer, user]);

  return {
    activeBatch,
    visibleActiveBatch,
    batches,
    isBatchListLoading,
    batchListError,
    refreshBatches,
    selectActiveBatch,
    handleBatchSelectorChange
  };
}
