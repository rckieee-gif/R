import { useEffect, useState } from 'react';

export default function OfflineStaleBanner({ data }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    const refreshNow = () => setNow(Date.now());
    const initialTimer = setTimeout(refreshNow, 0);
    const intervalTimer = setInterval(refreshNow, 30000); // update every 30s
    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, []);

  // Find if any of the passed data has cache metadata
  const dataArray = Array.isArray(data) ? data : [data];
  const cachedItem = dataArray.find(item => item && item._cacheMeta);

  if (!cachedItem) return null;

  const { timestamp, isStale } = cachedItem._cacheMeta;
  const ageMs = (now ?? timestamp) - timestamp;
  
  const formatAge = (ms) => {
    const diffSecs = Math.floor(ms / 1000);
    if (diffSecs < 60) return 'just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const ageStr = formatAge(ageMs);

  if (isStale) {
    return (
      <div className="no-print mx-4 mt-4 mb-2 rounded-xl border border-app-danger/30 bg-app-danger-bg px-4 py-3 text-xs font-bold text-app-danger flex items-center gap-2 animate-fade-in font-jetbrains">
        <span className="material-symbols-outlined text-[16px] leading-none animate-pulse">warning</span>
        <span>Warning: Viewing stale offline data loaded {ageStr} (limit: 15m). Connect to internet to update.</span>
      </div>
    );
  }

  return (
    <div className="no-print mx-4 mt-4 mb-2 rounded-xl border border-app-info/30 bg-app-info-bg px-4 py-3 text-xs font-bold text-app-info flex items-center gap-2 animate-fade-in font-jetbrains">
      <span className="material-symbols-outlined text-[16px] leading-none">cloud_off</span>
      <span>Offline Mode: Showing cached data from {ageStr}.</span>
    </div>
  );
}
