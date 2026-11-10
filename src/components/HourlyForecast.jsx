import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { weatherIconName, formatHour } from '../utils';
import { CloudLightning, CloudSnow, CloudRain, CloudFog, Cloud, CloudSun, Sun } from 'lucide-react';
import GlassCard from './GlassCard';

function WeatherGlyph({ condition }) {
  const name = weatherIconName(condition);
  const Glyph = ({ 'cloud-lightning': CloudLightning, 'cloud-snow': CloudSnow, 'cloud-rain': CloudRain, 'cloud-fog': CloudFog, cloud: Cloud, 'cloud-sun': CloudSun, sun: Sun })[name] || CloudSun;
  return <Glyph size={21} strokeWidth={1.55} className="forecast-weather-icon" />;
}

export default function HourlyForecast({ items }) {
  const scroller = useRef(null);
  if (!items?.length) return null;
  const move = (direction) => scroller.current?.scrollBy({ left: direction * 260, behavior: 'smooth' });

  return (
    <GlassCard eyebrow="PREVISÃO POR HORA" icon={Clock3} className="hourly-card" action={
      <div className="forecast-arrows"><button className="icon-button" onClick={() => move(-1)} aria-label="Horários anteriores"><ChevronLeft size={16} /></button><button className="icon-button" onClick={() => move(1)} aria-label="Próximos horários"><ChevronRight size={16} /></button></div>
    }>
      <div className="hourly-scroll" ref={scroller}>
        {items.map((item, index) => (
          <div className="hour-item" key={`${item.time || 'hour'}-${index}`}>
            <span className="hour-item__time">{index === 0 ? 'Agora' : formatHour(item.time)}</span>
            <WeatherGlyph condition={item.condition} />
            {item.precipitationProbability !== null && item.precipitationProbability !== undefined && <span className="hour-item__rain">{Math.round(item.precipitationProbability)}%</span>}
            <strong>{item.temperature === null ? '—' : `${Math.round(item.temperature)}°`}</strong>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
