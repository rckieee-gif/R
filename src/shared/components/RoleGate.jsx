import { hasMinimumRole } from '../utils/roles';

export default function RoleGate({ userRole, minimumRole, children }) {
  if (!hasMinimumRole(userRole, minimumRole)) return null;
  return children;
}
