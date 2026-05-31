import { useEffect, useState, useMemo } from 'react';
import { useSyncStatus } from '../../offline/syncStatus';
import { getAgeDay } from '../utils/broilerTargets';
import { apiClient } from '../utils/apiClient';

const WMO_CODES = {
  0: { label: 'Clear sky', icon: 'wb_sunny', tone: 'text-app-warning' },
  1: { label: 'Mainly clear', icon: 'wb_cloudy', tone: 'text-app-warning' },
  2: { label: 'Partly cloudy', icon: 'wb_cloudy', tone: 'text-app-text-secondary' },
  3: { label: 'Overcast', icon: 'cloud', tone: 'text-app-text-secondary' },
  45: { label: 'Fog', icon: 'foggy', tone: 'text-app-text-secondary' },
  48: { label: 'Rime fog', icon: 'foggy', tone: 'text-app-text-secondary' },
  51: { label: 'Light drizzle', icon: 'water_drop', tone: 'text-app-info' },
  53: { label: 'Drizzle', icon: 'water_drop', tone: 'text-app-info' },
  55: { label: 'Dense drizzle', icon: 'rainy', tone: 'text-app-info' },
  61: { label: 'Slight rain', icon: 'rainy_light', tone: 'text-app-info' },
  63: { label: 'Moderate rain', icon: 'rainy', tone: 'text-app-info' },
  65: { label: 'Heavy rain', icon: 'rainy_heavy', tone: 'text-app-info' },
  80: { label: 'Light showers', icon: 'rainy_light', tone: 'text-app-info' },
  81: { label: 'Showers', icon: 'rainy', tone: 'text-app-info' },
  82: { label: 'Heavy showers', icon: 'rainy_heavy', tone: 'text-app-info' },
  95: { label: 'Thunderstorm', icon: 'thunderstorm', tone: 'text-app-danger' },
  96: { label: 'T-storm + hail', icon: 'thunderstorm', tone: 'text-app-danger' },
  99: { label: 'Severe storm', icon: 'thunderstorm', tone: 'text-app-danger' },
};

export default function StatusBar({ activeBatch }) {
  const { isOnline, pendingCount } = useSyncStatus();
  const [buildings, setBuildings] = useState([]);
  const [weatherText, setWeatherText] = useState('Fetching weather…');
  const [weatherIcon, setWeatherIcon] = useState('cloud');
  const [weatherTone, setWeatherTone] = useState('text-app-text-secondary');

  // Age Day calculation
  const activeBatchStartDate = activeBatch?.startDate;
  const ageDay = useMemo(() => {
    if (!activeBatchStartDate) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    return getAgeDay(activeBatchStartDate, todayStr);
  }, [activeBatchStartDate]);

  // Load buildings in active batch
  useEffect(() => {
    if (!activeBatch?.id) {
      setTimeout(() => {
        setBuildings([]);
      }, 0);
      return;
    }

    let active = true;
    apiClient.get(`/api/batches/${activeBatch.id}/loadings`, { expectArray: true })
      .then(data => {
        if (!active) return;
        const names = Array.from(new Set(data.map(item => item.building || item.buildingName)))
          .filter(Boolean)
          .sort();
        setBuildings(names.length ? names : ['A', 'B', 'C']);
      })
      .catch(err => {
        console.warn('Failed to load buildings for status bar:', err);
        if (active) setBuildings(['A', 'B', 'C']);
      });

    return () => {
      active = false;
    };
  }, [activeBatch?.id]);

  // Fetch weather forecast
  useEffect(() => {
    let active = true;
    const cached = localStorage.getItem('weather_forecast_cache');

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const todayForecast = parsed.data?.[0];
        if (todayForecast && active) {
          const w = WMO_CODES[todayForecast.weatherCode] || { label: 'Clear', icon: 'wb_sunny', tone: 'text-app-warning' };
          setTimeout(() => {
            setWeatherText(`${Math.round(todayForecast.tempMax)}°/${Math.round(todayForecast.tempMin)}° · ${w.label}`);
            setWeatherIcon(w.icon);
            setWeatherTone(w.tone);
          }, 0);
          return;
        }
      } catch (e) {
        console.warn('Failed to parse weather cache in status bar:', e);
      }
    }

    // Fallback/direct fetch
    const LATITUDE = 6.1174;
    const LONGITUDE = 125.1718;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max,relative_humidity_2m_max&timezone=Asia/Manila&forecast_days=5`;

    apiClient.get(url)
      .then(data => {
        if (!active) return;
        const tempMax = data.daily.temperature_2m_max[0];
        const tempMin = data.daily.temperature_2m_min[0];
        const code = data.daily.weather_code[0];
        const w = WMO_CODES[code] || { label: 'Clear', icon: 'wb_sunny', tone: 'text-app-warning' };

        setWeatherText(`${Math.round(tempMax)}°/${Math.round(tempMin)}° · ${w.label}`);
        setWeatherIcon(w.icon);
        setWeatherTone(w.tone);

        // Cache the weather forecast
        const days = data.daily.time.map((date, i) => ({
          date,
          tempMax: data.daily.temperature_2m_max[i],
          tempMin: data.daily.temperature_2m_min[i],
          precipitation: data.daily.precipitation_sum[i],
          weatherCode: data.daily.weather_code[i],
          windSpeed: data.daily.wind_speed_10m_max[i],
          humidity: data.daily.relative_humidity_2m_max[i],
        }));
        localStorage.setItem('weather_forecast_cache', JSON.stringify({ timestamp: Date.now(), data: days }));
      })
      .catch(err => {
        console.warn('Failed to fetch weather for status bar:', err);
        if (active) {
          setWeatherText('Weather forecast unavailable');
          setWeatherIcon('cloud_off');
          setWeatherTone('text-app-text-secondary');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const buildingString = buildings.length ? `Building ${buildings.join('/')}` : 'Building A/B/C';

  return (
    <div className="no-print w-full bg-app-card/40 dark:bg-black/20 border-b border-app-border px-4 py-2 flex items-center justify-between text-[11px] font-bold text-app-text-secondary select-none font-jetbrains backdrop-blur-md transition-colors duration-300">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
        {/* Batch Info */}
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] text-app-text-secondary leading-none">layers</span>
          <span className="text-app-text font-black">
            {activeBatch?.id ? `Batch #${activeBatch.id}` : 'No Active Batch'}
          </span>
        </div>

        <span className="text-app-border/40 select-none">·</span>

        {/* Flock Age */}
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] text-app-text-secondary leading-none">calendar_today</span>
          <span>
            {ageDay !== null ? `Day ${ageDay}` : 'Day --'}
          </span>
        </div>

        <span className="text-app-border/40 select-none">·</span>

        {/* Building List */}
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] text-app-text-secondary leading-none">apartment</span>
          <span>{buildingString}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Online / Offline Status */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('open-sync-drawer'));
          }}
          className="flex items-center gap-1 hover:text-app-text cursor-pointer transition-colors duration-200"
          title="Open Sync Queue"
        >
          <span 
            className={`w-1.5 h-1.5 rounded-full ${
              isOnline ? 'bg-app-success shadow-[0_0_6px_var(--app-success)]' : 'bg-app-warning animate-pulse shadow-[0_0_6px_var(--app-warning)]'
            }`}
          />
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </button>

        <span className="text-app-border/40 select-none">·</span>

        {/* Sync Status / Pending Items */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('open-sync-drawer'));
          }}
          className={`flex items-center gap-1 hover:text-app-text cursor-pointer transition-all duration-200 ${
            pendingCount > 0 ? 'text-app-info animate-pulse' : 'text-app-text-secondary'
          }`}
          title="Open Sync Queue"
        >
          <span className="material-symbols-outlined text-[13px] leading-none">sync</span>
          <span>Queue ({pendingCount})</span>
        </button>

        <span className="text-app-border/40 select-none">·</span>

        {/* Weather Forecast */}
        <div className="flex items-center gap-1" title="Gen. Santos City Weather">
          <span className={`material-symbols-outlined text-[14px] leading-none ${weatherTone}`}>
            {weatherIcon}
          </span>
          <span className="font-semibold">{weatherText}</span>
        </div>
      </div>
    </div>
  );
}
