import { CalendarDays } from 'lucide-react';
import { CloudLightning, CloudSnow, CloudRain, CloudFog, Cloud, CloudSun, Sun } from 'lucide-react';
import GlassCard from './GlassCard';
import { weatherIconName, formatDay } from '../utils';

function WeatherGlyph({ condition }) {
  const name = weatherIconName(condition);
  const Glyph = ({ 'cloud-lightning': CloudLightning, 'cloud-snow': CloudSnow, 'cloud-rain': CloudRain, 'cloud-fog': CloudFog, cloud: Cloud, 'cloud-sun': CloudSun, sun: Sun })[name] || CloudSun;
  return <Glyph size={20} strokeWidth={1.6} />;
}

export default function DailyForecast({ items }) {
  if (!items?.length) return null;
  const mins = items.map((item) => item.minTemperature).filter((value) => value !== null);
  const maxs = items.map((item) => item.maxTemperature).filter((value) => value !== null);
  const globalMin = mins.length ? Math.min(...mins) : 0;
  const globalMax = maxs.length ? Math.max(...maxs) : 1;
  const range = Math.max(1, globalMax - globalMin);

  return (
    <GlassCard eyebrow="PRÓXIMOS DIAS" icon={CalendarDays} className="daily-card">
      <div className="daily-list">
        {items.map((item, index) => {
          const start = item.minTemperature === null ? 0 : ((item.minTemperature - globalMin) / range) * 100;
          const width = item.minTemperature === null || item.maxTemperature === null ? 0 : ((item.maxTemperature - item.minTemperature) / range) * 100;
          return (
            <div className="daily-row" key={`${item.date || 'day'}-${index}`}>
              <span className="daily-day">{index === 0 ? 'Hoje' : formatDay(item.date)}</span>
              <WeatherGlyph condition={item.condition} />
              {item.precipitationProbability !== null && item.precipitationProbability !== undefined && <span className="daily-rain">{Math.round(item.precipitationProbability)}%</span>}
              <span className="daily-temp daily-temp--min">{item.minTemperature === null ? '—' : `${Math.round(item.minTemperature)}°`}</span>
              <div className="temperature-track"><span style={{ left: `${start}%`, width: `${Math.max(4, width)}%` }} /></div>
              <span className="daily-temp">{item.maxTemperature === null ? '—' : `${Math.round(item.maxTemperature)}°`}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
