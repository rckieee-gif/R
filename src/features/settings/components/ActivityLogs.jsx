import AuditTrailPanel from '../../../shared/components/AuditTrailPanel';

export default function ActivityLogs({
  fetchActivityLogs,
  isLoadingActivity,
  activityLogs
}) {
  return (
    <AuditTrailPanel
      logs={activityLogs}
      isLoading={isLoadingActivity}
      onRefresh={fetchActivityLogs}
    />
  );
}
