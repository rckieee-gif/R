import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../shared/utils/apiClient';

const EMPTY_TRANSACTION_STATE = { batchId: null, rows: [] };

export default function useTransactions(activeBatchId, token, canViewFinancial) {
  const [transactionState, setTransactionState] = useState(EMPTY_TRANSACTION_STATE);

  const transactions = canViewFinancial && activeBatchId && transactionState.batchId === activeBatchId
    ? transactionState.rows
    : [];

  const setTransactions = useCallback((value) => {
    if (!activeBatchId) return;

    setTransactionState((current) => {
      const currentRows = current.batchId === activeBatchId ? current.rows : [];
      const nextRows = typeof value === 'function' ? value(currentRows) : value;

      return {
        batchId: activeBatchId,
        rows: Array.isArray(nextRows) ? nextRows : []
      };
    });
  }, [activeBatchId]);

  const refreshTransactions = useCallback(async () => {
    if (!token || !activeBatchId || !canViewFinancial) {
      return;
    }

    const requestBatchId = activeBatchId;

    try {
      const data = await apiClient.get(`/api/batches/${requestBatchId}/transactions`, { expectArray: true });
      setTransactionState({ batchId: requestBatchId, rows: data });
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  }, [token, activeBatchId, canViewFinancial]);

  useEffect(() => {
    if (!token || !activeBatchId || !canViewFinancial) {
      return undefined;
    }

    let isCancelled = false;
    const requestBatchId = activeBatchId;

    const fetchTransactions = async () => {
      try {
        const data = await apiClient.get(`/api/batches/${requestBatchId}/transactions`, { expectArray: true });
        if (!isCancelled) {
          setTransactionState({ batchId: requestBatchId, rows: data });
        }
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      }
    };

    fetchTransactions();

    return () => {
      isCancelled = true;
    };
  }, [token, activeBatchId, canViewFinancial]);

  return {
    transactions,
    setTransactions,
    refreshTransactions
  };
}
