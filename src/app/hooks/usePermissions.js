import { useMemo } from 'react';
import { hasMinimumRole } from '../../shared/utils/roles';

export default function usePermissions(user) {
  const canEnterDaily = useMemo(() => hasMinimumRole(user?.role, 'DataEntry'), [user]);
  const canManageOperations = useMemo(() => hasMinimumRole(user?.role, 'OperationManager'), [user]);
  const canViewFinancial = canManageOperations;
  const canEditOrDelete = useMemo(() => Boolean(user?.isPrimaryOwner), [user]);

  return { canEnterDaily, canManageOperations, canViewFinancial, canEditOrDelete };
}
