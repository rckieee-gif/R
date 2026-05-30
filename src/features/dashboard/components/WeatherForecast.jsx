import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../shared/utils/apiClient';

const LATITUDE = 6.1174;
const LONGITUDE = 125.1718;
const LOCATION_NAME = 'Gen. Santos City';
const CACHE_KEY = 'weather_forecast_cache';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const WMO_CODES = {
  0: { label: 'Clear sky', icon: 'clear_day', tone: 'text-dashboard-warning' },
  1: { label: 'Mainly clear', icon: 'partly_cloudy_day', tone: 'text-dashboard-warning' },
  2: { label: 'Partly cloudy', icon: 'partly_cloudy_day', tone: 'text-dashboard-text-secondary' },
  3: { label: 'Overcast', icon: 'cloud', tone: 'text-dashboard-text-secondary' },
  45: { label: 'Fog', icon: 'foggy', tone: 'text-dashboard-text-secondary' },
  48: { label: 'Rime fog', icon: 'foggy', tone: 'text-dashboard-text-secondary' },
  51: { label: 'Light drizzle', icon: 'rainy_light', tone: 'text-dashboard-accent' },
  53: { label: 'Drizzle', icon: 'rainy_light', tone: 'text-dashboard-accent' },
  55: { label: 'Dense drizzle', icon: 'rainy', tone: 'text-dashboard-accent' },
  61: { label: 'Slight rain', icon: 'rainy_light', tone: 'text-dashboard-accent' },
  63: { label: 'Moderate rain', icon: 'rainy', tone: 'text-dashboard-accent' },
  65: { label: 'Heavy rain', icon: 'rainy_heavy', tone: 'text-dashboard-accent' },
  80: { label: 'Light showers', icon: 'rainy_light', tone: 'text-dashboard-accent' },
  81: { label: 'Showers', icon: 'rainy', tone: 'text-dashboard-accent' },
  82: { label: 'Heavy showers', icon: 'rainy_heavy', tone: 'text-dashboard-accent' },
  95: { label: 'Thunderstorm', icon: 'thunderstorm', tone: 'text-dashboard-danger' },
  96: { label: 'T-storm + hail', icon: 'thunderstorm', tone: 'text-dashboard-danger' },
  99: { label: 'Severe storm', icon: 'thunderstorm', tone: 'text-dashboard-danger' },
};

/* De-duplicated legend entries grouped by category */
const LEGEND_GROUPS = [
  {
    title: 'Clear / Cloudy',
    items: [
      { icon: 'clear_day', tone: 'text-dashboard-warning', label: 'Clear sky' },
      { icon: 'partly_cloudy_day', tone: 'text-dashboard-warning', label: 'Mainly clear / Partly cloudy' },
      { icon: 'cloud', tone: 'text-dashboard-text-secondary', label: 'Overcast' },
      { icon: 'foggy', tone: 'text-dashboard-text-secondary', label: 'Fog' },
    ],
  },
  {
    title: 'Rain / Drizzle',
    items: [
      { icon: 'rainy_light', tone: 'text-dashboard-accent', label: 'Light drizzle / rain' },
      { icon: 'rainy', tone: 'text-dashboard-accent', label: 'Moderate rain / showers' },
      { icon: 'rainy_heavy', tone: 'text-dashboard-accent', label: 'Heavy rain / showers' },
    ],
  },
  {
    title: 'Storms',
    items: [
      { icon: 'thunderstorm', tone: 'text-dashboard-danger', label: 'Thunderstorm' },
      { icon: 'thunderstorm', tone: 'text-dashboard-danger', label: 'Severe storm / hail' },
    ],
  },
];

const FORECAST_INSTRUCTIONS = [
  'Use the large card for today: high / low temperature, rainfall, humidity, and max wind.',
  'Use the accent bar in each upcoming day row as a quick rain-volume indicator.',
  'Tap Refresh to clear the cache and pull the latest Open-Meteo forecast.'
];

function getWeatherInfo(code) {
  return WMO_CODES[code] || { label: 'Unknown', icon: 'help', tone: 'text-dashboard-text-secondary' };
}

function formatDayShort(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tmrw';
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function formatDayLong(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() === today.getTime()) return 'Today';
  return date.toLocaleDateString(undefined, { weekday: 'long' });
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

/* ── Stat pill used in the Today hero card ── */
function StatChip({ icon, value, unit, iconColor }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/[0.06] rounded-lg px-2.5 py-1.5">
      <span className={`material-symbols-outlined text-sm ${iconColor}`}>{icon}</span>
      <span className="text-[11px] font-bold font-jetbrains text-dashboard-text">
        {value}<span className="text-[9px] font-normal text-dashboard-text-secondary ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

/* ── Single upcoming-day row ── */
function ForecastRow({ day }) {
  const weather = getWeatherInfo(day.weatherCode);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
      {/* Day name */}
      <span className="text-[11px] font-bold font-jetbrains text-dashboard-text-secondary w-10 shrink-0 uppercase tracking-wide">
        {formatDayShort(day.date)}
      </span>

      {/* Icon */}
      <span className={`material-symbols-outlined text-xl ${weather.tone} shrink-0`}>
        {weather.icon}
      </span>

      {/* Rain bar — visual precipitation indicator */}
      <div className="flex-1 mx-1">
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-dashboard-accent/70 transition-all duration-500"
            style={{ width: `${Math.min((day.precipitation / 30) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Precipitation value */}
      <span className="text-[10px] font-bold font-jetbrains text-dashboard-accent w-11 text-right shrink-0">
        {day.precipitation.toFixed(1)}<span className="text-[8px] font-normal ml-0.5">mm</span>
      </span>

      {/* Temperature range */}
      <div className="flex items-baseline gap-1 shrink-0 w-16 justify-end">
        <span className="text-[12px] font-black font-jetbrains text-dashboard-text">
          {Math.round(day.tempMax)}°
        </span>
        <span className="text-[10px] font-semibold font-jetbrains text-dashboard-text-secondary">
          {Math.round(day.tempMin)}°
        </span>
      </div>
    </div>
  );
}

export default function WeatherForecast() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLegend, setShowLegend] = useState(false);

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
      const data = await apiClient.get(url);

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
    const timeoutId = setTimeout(() => {
      fetchWeather();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [fetchWeather]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="mb-6">
        <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-dashboard-text-secondary animate-spin text-2xl">progress_activity</span>
          <p className="text-xs text-dashboard-text-secondary mt-2 font-inter">Fetching weather…</p>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="mb-6">
        <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-6 text-center">
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
      </div>
    );
  }

  if (!forecast) return null;

  const today = forecast[0];
  const upcoming = forecast.slice(1);
  const todayWeather = getWeatherInfo(today.weatherCode);

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-dashboard-text-secondary font-bold tracking-widest uppercase text-xs font-jetbrains">
            Weather Forecast
          </h3>
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            className={`h-6 w-6 rounded-full flex items-center justify-center cursor-pointer transition-all border ${
              showLegend
                ? 'bg-dashboard-accent text-dashboard-on-accent border-dashboard-accent'
                : 'bg-transparent text-dashboard-text-secondary border-dashboard-text-secondary/20 hover:border-dashboard-text-secondary/50 hover:bg-white/[0.04]'
            }`}
            title="Weather legend and instructions"
            aria-label="Weather legend and instructions"
            aria-expanded={showLegend}
          >
            <span className="material-symbols-outlined text-[16px] leading-none">info</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => { localStorage.removeItem(CACHE_KEY); fetchWeather(); }}
          className="text-[10px] font-bold text-dashboard-accent bg-dashboard-accent/15 px-2 py-1 rounded-lg hover:bg-dashboard-accent/25 transition-colors font-jetbrains cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {/* Legend panel */}
      {showLegend && (
        <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-4 mb-3 animate-[fadeIn_0.15s_ease-out]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dashboard-text-secondary font-jetbrains">
              Weather Legend & Instructions
            </p>
            <button
              type="button"
              onClick={() => setShowLegend(false)}
              className="material-symbols-outlined text-dashboard-text-secondary hover:text-dashboard-text text-sm cursor-pointer transition-colors"
            >
              close
            </button>
          </div>
          <div className="mb-4 rounded-lg border border-dashboard-border/60 bg-white/[0.03] p-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-dashboard-text-secondary/70 font-jetbrains">
              How to read this forecast
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {FORECAST_INSTRUCTIONS.map((instruction) => (
                <p key={instruction} className="text-[11px] font-semibold leading-snug text-dashboard-text-secondary font-inter">
                  {instruction}
                </p>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LEGEND_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-[9px] font-bold uppercase tracking-wider text-dashboard-text-secondary/60 font-jetbrains mb-1.5">
                  {group.title}
                </p>
                <div className="space-y-1">
                  {group.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-0.5">
                      <span className={`material-symbols-outlined text-base ${item.tone}`}>{item.icon}</span>
                      <span className="text-[11px] text-dashboard-text font-inter">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-dashboard-text-secondary/50 font-inter mt-3 text-right">
            Data by Open-Meteo · WMO weather codes
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-3">

        {/* ── TODAY hero card ── */}
        <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-5 relative overflow-hidden group hover:border-dashboard-accent transition-colors">
          {/* Decorative bg icon */}
          <div className="absolute -top-4 -right-4 opacity-[0.06] group-hover:opacity-[0.10] transition-opacity duration-500 pointer-events-none">
            <span className={`material-symbols-outlined text-[120px] ${todayWeather.tone}`}>
              {todayWeather.icon}
            </span>
          </div>

          {/* Top row: location + day */}
          <div className="relative z-10 flex items-center justify-between mb-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-dashboard-text-secondary font-jetbrains">
                {formatDayLong(today.date)}
              </p>
              <p className="text-[10px] text-dashboard-text-secondary/60 font-inter mt-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">location_on</span>
                {LOCATION_NAME}
              </p>
            </div>
          </div>

          {/* Main temperature + icon + condition */}
          <div className="relative z-10 flex items-center gap-4 mb-4">
            <span className={`material-symbols-outlined text-5xl ${todayWeather.tone} drop-shadow-lg`}>
              {todayWeather.icon}
            </span>
            <div>
              <p className="text-4xl font-black font-jetbrains text-dashboard-text leading-none">
                {Math.round(today.tempMax)}°
                <span className="text-lg font-semibold text-dashboard-text-secondary ml-1">
                  / {Math.round(today.tempMin)}°
                </span>
              </p>
              <p className="text-xs text-dashboard-text-secondary font-inter mt-1 font-medium">
                {todayWeather.label}
              </p>
            </div>
          </div>

          {/* Stats chips */}
          <div className="relative z-10 flex flex-wrap gap-2">
            <StatChip icon="water_drop" value={today.precipitation.toFixed(1)} unit="mm" iconColor="text-dashboard-accent" />
            <StatChip icon="humidity_percentage" value={today.humidity} unit="%" iconColor="text-dashboard-success" />
            <StatChip icon="air" value={today.windSpeed.toFixed(0)} unit="km/h" iconColor="text-dashboard-text-secondary" />
          </div>
        </div>

        {/* ── UPCOMING days list ── */}
        <div className="bg-dashboard-card border border-dashboard-border rounded-xl py-2 px-1 hover:border-dashboard-accent transition-colors">
          <div className="px-3 pt-2 pb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-dashboard-text-secondary font-jetbrains">
              Next {upcoming.length} Days
            </p>
          </div>

          <div className="divide-y divide-dashboard-border/40">
            {upcoming.map((day) => (
              <ForecastRow key={day.date} day={day} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
