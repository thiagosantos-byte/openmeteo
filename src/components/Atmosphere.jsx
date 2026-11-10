import { useMemo } from 'react';

export default function Atmosphere({ weather = 'unknown', phase = 'afternoon' }) {
  const isNight = phase === 'night';
  const isRain = weather === 'rain' || weather === 'storm';
  const isSnow = weather === 'snow';
  const stars = useMemo(() => Array.from({ length: 34 }, (_, index) => ({
    id: index,
    left: `${(index * 37 + 11) % 100}%`,
    top: `${(index * 19 + 7) % 70}%`,
    delay: `${(index % 8) * -0.7}s`,
    size: `${index % 4 === 0 ? 3 : 2}px`
  })), []);

  return (
    <div className={`atmosphere atmosphere--${weather} atmosphere--${phase}`} aria-hidden="true">
      <div className="atmosphere__glow" />
      {isNight && <div className="star-field">{stars.map((star) => <i key={star.id} style={{ left: star.left, top: star.top, animationDelay: star.delay, width: star.size, height: star.size }} />)}</div>}
      <div className="cloud cloud--one" />
      <div className="cloud cloud--two" />
      <div className="cloud cloud--three" />
      {(isRain || isSnow) && <div className={`precipitation precipitation--${isSnow ? 'snow' : 'rain'}`} />}
      {weather === 'storm' && <div className="lightning-flash" />}
      <div className="atmosphere__horizon" />
    </div>
  );
}
