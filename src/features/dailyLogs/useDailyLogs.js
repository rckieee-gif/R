import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../shared/utils/apiClient';

const EMPTY_LOG_STATE = { batchId: null, rows: [] };

export default function useDailyLogs(activeBatchId, token, isPublicViewer, viewerPreviewData) {
  const [logState, setLogState] = useState(EMPTY_LOG_STATE);

  const visibleLogs = useMemo(() => {
    if (isPublicViewer) {
      return viewerPreviewData?.logs || [];
    }
    return activeBatchId && logState.batchId === activeBatchId ? logState.rows : [];
  }, [isPublicViewer, viewerPreviewData, activeBatchId, logState]);

  const setLogs = useCallback((value) => {
    if (!activeBatchId) return;

    setLogState((current) => {
      const currentRows = current.batchId === activeBatchId ? current.rows : [];
      const nextRows = typeof value === 'function' ? value(currentRows) : value;

      return {
        batchId: activeBatchId,
        rows: Array.isArray(nextRows) ? nextRows : []
      };
    });
  }, [activeBatchId]);

  useEffect(() => {
    if (isPublicViewer) {
      return undefined;
    }

    if (!token || !activeBatchId) {
      return undefined;
    }

    const requestBatchId = activeBatchId;

    const fetchLogs = async () => {
      try {
        const data = await apiClient.get(`/api/logs?batchId=${requestBatchId}`, { expectArray: true });
        setLogState({ batchId: requestBatchId, rows: data });
      } catch (error) {
        console.error("Failed to fetch logs:", error);
      }
    };

    fetchLogs();
  }, [token, activeBatchId, isPublicViewer]);

  return {
    logs: visibleLogs,
    setLogs
  };
}
