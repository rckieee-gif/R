import { useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function useNavigation({ canManageOperations, isPublicViewer, user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentScreen = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/today')) return 'today';
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/batches')) return 'batches';
    if (path.startsWith('/employees')) return 'employees';
    if (path.startsWith('/pay-summary')) return 'paySummary';
    if (path.startsWith('/ledger')) return 'ledger';
    if (path.startsWith('/harvest')) return 'harvest';
    if (path.startsWith('/daily-log')) return 'dailyLog';
    if (path.startsWith('/inventory')) return 'inventory';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.startsWith('/statement')) return 'statement';
    if (path.startsWith('/settings')) return 'settings';
    return 'today';
  }, [location.pathname]);

  const setActiveScreen = (screenId) => {
    const routeMap = {
      today: '/today',
      dashboard: '/dashboard',
      batches: '/batches',
      employees: '/employees',
      paySummary: '/pay-summary',
      ledger: '/ledger',
      harvest: '/harvest',
      dailyLog: '/daily-log',
      inventory: '/inventory',
      analytics: '/analytics',
      statement: '/statement',
      settings: '/settings',
    };
    const route = routeMap[screenId];
    if (route) {
      navigate(route);
    }
  };

  const allowedScreens = useMemo(() => {
    if (isPublicViewer) {
      return ['today', 'dashboard'];
    }

    return [
      'today',
      'dashboard',
      'batches',
      'dailyLog',
      'paySummary',
      'inventory',
      'analytics',
      'settings',
      ...(canManageOperations ? ['employees', 'ledger', 'harvest', 'statement'] : []),
    ];
  }, [canManageOperations, isPublicViewer]);

  const screensMeta = useMemo(() => [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'batches', label: 'Batches', icon: 'layers' },
    { id: 'employees', label: 'Employees', icon: 'group' },
    { id: 'paySummary', label: 'Pay Summary', icon: 'payments' },
    { id: 'ledger', label: 'Ledger', icon: 'receipt_long' },
    { id: 'harvest', label: 'Harvest', icon: 'agriculture' },
    { id: 'dailyLog', label: 'Daily Logs', icon: 'edit_note' },
    { id: 'inventory', label: 'Inventory', icon: 'inventory' },
    { id: 'analytics', label: 'Analytics', icon: 'monitoring' },
    { id: 'statement', label: 'Statement', icon: 'description' },
  ], []);

  const visibleNavItems = useMemo(() => {
    return screensMeta.filter((item) => allowedScreens.includes(item.id));
  }, [allowedScreens, screensMeta]);

  // Route guard: Redirect if trying to access unauthorized screen
  useEffect(() => {
    const routeToScreen = {
      '/today': 'today',
      '/dashboard': 'dashboard',
      '/batches': 'batches',
      '/inventory': 'inventory',
      '/ledger': 'ledger',
      '/harvest': 'harvest',
      '/employees': 'employees',
      '/pay-summary': 'paySummary',
      '/daily-log': 'dailyLog',
      '/analytics': 'analytics',
      '/statement': 'statement',
      '/settings': 'settings',
    };
    
    const path = location.pathname;
    let screen = null;
    for (const [route, screenId] of Object.entries(routeToScreen)) {
      if (path.startsWith(route)) {
        screen = screenId;
        break;
      }
    }
    
    // Only guard if user is logged in
    if (user && screen && !allowedScreens.includes(screen)) {
      navigate('/today', { replace: true });
    }
  }, [location.pathname, allowedScreens, navigate, user]);

  return { currentScreen, setActiveScreen, allowedScreens, screensMeta, visibleNavItems };
}
