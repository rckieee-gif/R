import { useEffect, useState, useMemo } from 'react';
import { useSyncStatus } from '../../offline/syncStatus';
import { getAgeDay } from '../utils/broilerTargets';
import { apiClient } from '../utils/apiClient';

const WMO_CODES = {
  0: { label: 'Clear sky', icon: 'wb_sunny', tone: 'text-amber-500' },
  1: { label: 'Mainly clear', icon: 'wb_cloudy', tone: 'text-amber-400' },
  2: { label: 'Partly cloudy', icon: 'wb_cloudy', tone: 'text-slate-400' },
  3: { label: 'Overcast', icon: 'cloud', tone: 'text-slate-500' },
  45: { label: 'Fog', icon: 'foggy', tone: 'text-slate-400' },
  48: { label: 'Rime fog', icon: 'foggy', tone: 'text-slate-400' },
  51: { label: 'Light drizzle', icon: 'water_drop', tone: 'text-sky-400' },
  53: { label: 'Drizzle', icon: 'water_drop', tone: 'text-sky-400' },
  55: { label: 'Dense drizzle', icon: 'rainy', tone: 'text-sky-500' },
  61: { label: 'Slight rain', icon: 'rainy_light', tone: 'text-sky-400' },
  63: { label: 'Moderate rain', icon: 'rainy', tone: 'text-sky-500' },
  65: { label: 'Heavy rain', icon: 'rainy_heavy', tone: 'text-sky-600' },
  80: { label: 'Light showers', icon: 'rainy_light', tone: 'text-sky-400' },
  81: { label: 'Showers', icon: 'rainy', tone: 'text-sky-500' },
  82: { label: 'Heavy showers', icon: 'rainy_heavy', tone: 'text-sky-600' },
  95: { label: 'Thunderstorm', icon: 'thunderstorm', tone: 'text-rose-500' },
  96: { label: 'T-storm + hail', icon: 'thunderstorm', tone: 'text-rose-500' },
  99: { label: 'Severe storm', icon: 'thunderstorm', tone: 'text-rose-600' },
};

export default function StatusBar({ activeBatch }) {
  const { isOnline, pendingCount } = useSyncStatus();
  const [buildings, setBuildings] = useState([]);
  const [weatherText, setWeatherText] = useState('Fetching weather…');
  const [weatherIcon, setWeatherIcon] = useState('cloud');
  const [weatherTone, setWeatherTone] = useState('text-slate-400');

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
          const w = WMO_CODES[todayForecast.weatherCode] || { label: 'Clear', icon: 'wb_sunny', tone: 'text-amber-500' };
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
        const w = WMO_CODES[code] || { label: 'Clear', icon: 'wb_sunny', tone: 'text-amber-500' };

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
          setWeatherTone('text-slate-400');
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
          <span className="material-symbols-outlined text-[13px] text-app-accent leading-none">layers</span>
          <span className="text-app-text font-black">
            {activeBatch?.id ? `Batch #${activeBatch.id}` : 'No Active Batch'}
          </span>
        </div>

        <span className="text-app-border/40 select-none">·</span>

        {/* Flock Age */}
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] text-emerald-500 leading-none">calendar_today</span>
          <span>
            {ageDay !== null ? `Day ${ageDay}` : 'Day --'}
          </span>
        </div>

        <span className="text-app-border/40 select-none">·</span>

        {/* Building List */}
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] text-indigo-400 leading-none">apartment</span>
          <span>{buildingString}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Online / Offline Status */}
        <div className="flex items-center gap-1">
          <span 
            className={`w-1.5 h-1.5 rounded-full ${
              isOnline ? 'bg-emerald-400 shadow-[0_0_6px_#10B981]' : 'bg-amber-400 animate-pulse shadow-[0_0_6px_#F59E0B]'
            }`}
          />
          <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Sync Status / Pending Items */}
        {pendingCount > 0 && (
          <>
            <span className="text-app-border/40 select-none">·</span>
            <div className="flex items-center gap-1 text-sky-400 animate-pulse">
              <span className="material-symbols-outlined text-[13px] leading-none">sync</span>
              <span>{pendingCount} pending</span>
            </div>
          </>
        )}

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
