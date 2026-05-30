export function resolveConflict(queueItem, serverError) {
  console.warn('Sync conflict detected for item:', queueItem.id, 'Error:', serverError);
  
  const status = serverError.status;

  if (status === 409) {
    // Conflict - item probably already saved or duplicate submission.
    // Server Wins/Duplicate Prevention: discard duplicate.
    return { action: 'discard', reason: 'Duplicate / Conflict on server' };
  }

  if (status === 400 || status === 422) {
    // Validation failure or bad request: cannot be resolved by standard retries.
    // Flag for user review in panel.
    return { action: 'flag', reason: serverError.message || 'Validation error' };
  }

  // Temporary network/server issues: retry later
  return { action: 'retry' };
}
