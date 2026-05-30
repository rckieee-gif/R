import { lazy } from 'react';

export const TodayOperations = lazy(() => import('../features/dailyLogs/TodayOperations'));
export const BatchManagement = lazy(() => import('../features/batches/BatchManagement'));
export const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));
export const EmployeeManagement = lazy(() => import('../features/employees/EmployeeManagement'));
export const EmployeePaySummary = lazy(() => import('../features/employees/EmployeePaySummary'));
export const TransactionLedger = lazy(() => import('../features/ledger/TransactionLedger'));
export const HarvestRecording = lazy(() => import('../features/harvest/HarvestRecording'));
export const DailyLog = lazy(() => import('../features/dailyLogs/DailyLog'));
export const InventoryManagement = lazy(() => import('../features/inventory/InventoryManagement'));
export const Analytics = lazy(() => import('../features/analytics/Analytics'));
export const FinancialStatement = lazy(() => import('../features/ledger/FinancialStatement'));
export const Settings = lazy(() => import('../features/settings/Settings'));
