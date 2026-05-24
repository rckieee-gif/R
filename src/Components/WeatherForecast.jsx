import { useState, useEffect, useCallback } from 'react';

const LATITUDE = 6.1174;
const LONGITUDE = 125.1718;
const LOCATION_NAME = 'Gen. Santos City';
const CACHE_KEY = 'weather_forecast_cache';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const WMO_CODES = {
  0: { label: 'Clear sky', icon: 'clear_day', tone: 'text-yellow-400' },
  1: { label: 'Mainly clear', icon: 'partly_cloudy_day', tone: 'text-yellow-300' },
  2: { label: 'Partly cloudy', icon: 'partly_cloudy_day', tone: 'text-slate-300' },
  3: { label: 'Overcast', icon: 'cloud', tone: 'text-slate-400' },
  45: { label: 'Fog', icon: 'foggy', tone: 'text-slate-400' },
  48: { label: 'Depositing rime fog', icon: 'foggy', tone: 'text-slate-400' },
  51: { label: 'Light drizzle', icon: 'rainy_light', tone: 'text-blue-300' },
  53: { label: 'Moderate drizzle', icon: 'rainy_light', tone: 'text-blue-400' },
  55: { label: 'Dense drizzle', icon: 'rainy', tone: 'text-blue-400' },
  61: { label: 'Slight rain', icon: 'rainy_light', tone: 'text-blue-300' },
  63: { label: 'Moderate rain', icon: 'rainy', tone: 'text-blue-400' },
  65: { label: 'Heavy rain', icon: 'rainy_heavy', tone: 'text-blue-500' },
  80: { label: 'Slight showers', icon: 'rainy_light', tone: 'text-blue-300' },
  81: { label: 'Moderate showers', icon: 'rainy', tone: 'text-blue-400' },
  82: { label: 'Violent showers', icon: 'rainy_heavy', tone: 'text-blue-500' },
  95: { label: 'Thunderstorm', icon: 'thunderstorm', tone: 'text-purple-400' },
  96: { label: 'Thunderstorm w/ hail', icon: 'thunderstorm', tone: 'text-purple-500' },
  99: { label: 'Thunderstorm w/ heavy hail', icon: 'thunderstorm', tone: 'text-purple-500' },
};

function getWeatherInfo(code) {
  return WMO_CODES[code] || { label: 'Unknown', icon: 'help', tone: 'text-slate-400' };
}

function formatDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function getCachedData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_DURATION_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function setCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch { /* ignore quota errors */ }
}

export default function WeatherForecast() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWeather = useCallback(async () => {
    const cached = getCachedData();
    if (cached) {
      setForecast(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,wind_speed_10m_max,relative_humidity_2m_max&timezone=Asia/Manila&forecast_days=5`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const days = data.daily.time.map((date, i) => ({
        date,
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        precipitation: data.daily.precipitation_sum[i],
        weatherCode: data.daily.weather_code[i],
        windSpeed: data.daily.wind_speed_10m_max[i],
        humidity: data.daily.relative_humidity_2m_max[i],
      }));

      setForecast(days);
      setCachedData(days);
    } catch (err) {
      setError(err.message || 'Failed to load weather');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-dashboard-text-secondary font-bold tracking-widest uppercase text-xs font-jetbrains">
            Weather Forecast
          </h3>
          <span className="text-[10px] text-dashboard-text-secondary/70 font-inter">
            {LOCATION_NAME}
          </span>
        </div>
        <button
          type="button"
          onClick={() => { localStorage.removeItem(CACHE_KEY); fetchWeather(); }}
          className="text-[10px] font-bold text-dashboard-accent bg-dashboard-accent/15 px-2 py-1 rounded-lg hover:bg-dashboard-accent/25 transition-colors font-jetbrains cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-dashboard-text-secondary animate-spin text-2xl">progress_activity</span>
          <p className="text-xs text-dashboard-text-secondary mt-2 font-inter">Loading forecast...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-5 text-center">
          <span className="material-symbols-outlined text-dashboard-danger text-2xl">cloud_off</span>
          <p className="text-xs text-dashboard-text-secondary mt-2 font-inter">{error}</p>
          <button
            type="button"
            onClick={() => { localStorage.removeItem(CACHE_KEY); fetchWeather(); }}
            className="mt-3 text-xs font-bold text-dashboard-accent hover:underline cursor-pointer font-jetbrains"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && forecast && (
        <div className="grid grid-cols-5 gap-2">
          {forecast.map((day) => {
            const weather = getWeatherInfo(day.weatherCode);
            const isHeavyRain = day.precipitation > 20;
            const isRainy = day.precipitation > 5;

            return (
              <div
                key={day.date}
                className={`bg-dashboard-card border rounded-xl p-3 sm:p-4 transition-colors hover:border-dashboard-accent relative overflow-hidden group ${
                  isHeavyRain
                    ? 'border-blue-500/40'
                    : isRainy
                    ? 'border-blue-400/20'
                    : 'border-dashboard-border'
                }`}
              >
                {/* Day label */}
                <p className="text-[9px] sm:text-[10px] font-bold text-dashboard-text-secondary uppercase tracking-wide font-jetbrains truncate">
                  {formatDay(day.date)}
                </p>

                {/* Weather icon */}
                <div className="flex justify-center my-2 sm:my-3">
                  <span className={`material-symbols-outlined text-3xl sm:text-4xl ${weather.tone} drop-shadow-sm`}>
                    {weather.icon}
                  </span>
                </div>

                {/* Weather label */}
                <p className="text-[8px] sm:text-[9px] text-center text-dashboard-text-secondary font-inter leading-tight truncate mb-2">
                  {weather.label}
                </p>

                {/* Temperature */}
                <div className="text-center mb-2">
                  <span className="text-sm sm:text-base font-black font-jetbrains text-dashboard-text">
                    {Math.round(day.tempMax)}°
                  </span>
                  <span className="text-[10px] sm:text-xs text-dashboard-text-secondary font-jetbrains ml-1">
                    {Math.round(day.tempMin)}°
                  </span>
                </div>

                {/* Stats */}
                <div className="space-y-1 border-t border-dashboard-border/50 pt-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="material-symbols-outlined text-blue-400 text-xs">water_drop</span>
                    <span className="text-[9px] sm:text-[10px] font-bold font-jetbrains text-dashboard-text-secondary">
                      {day.precipitation.toFixed(1)}<span className="text-[7px] font-normal ml-0.5">mm</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="material-symbols-outlined text-teal-400 text-xs">humidity_percentage</span>
                    <span className="text-[9px] sm:text-[10px] font-bold font-jetbrains text-dashboard-text-secondary">
                      {day.humidity}<span className="text-[7px] font-normal ml-0.5">%</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="material-symbols-outlined text-slate-400 text-xs">air</span>
                    <span className="text-[9px] sm:text-[10px] font-bold font-jetbrains text-dashboard-text-secondary">
                      {day.windSpeed.toFixed(0)}<span className="text-[7px] font-normal ml-0.5">km/h</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
