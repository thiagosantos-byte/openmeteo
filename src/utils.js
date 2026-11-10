export function classifyWeather(condition = '') {
  const value = String(condition).toLocaleLowerCase('pt-BR');
  if (/tempest|trovo|thunder|storm|raio/.test(value)) return 'storm';
  if (/neve|snow|granizo|hail/.test(value)) return 'snow';
  if (/chuva|garoa|rain|drizzle|precipita/.test(value)) return 'rain';
  if (/neblina|nevoeiro|fog|mist/.test(value)) return 'fog';
  if (/nublado|encoberto|overcast|cloud/.test(value)) {
    return /parcial|poucas|scattered|partly/.test(value) ? 'partly' : 'cloudy';
  }
  if (/sol|ensolarado|limpo|clear|sunny/.test(value)) return 'sunny';
  return 'unknown';
}

export function weatherIconName(condition = '') {
  const state = classifyWeather(condition);
  return ({
    storm: 'cloud-lightning',
    snow: 'cloud-snow',
    rain: 'cloud-rain',
    fog: 'cloud-fog',
    cloudy: 'cloud',
    partly: 'cloud-sun',
    sunny: 'sun',
    unknown: 'cloud-sun'
  })[state];
}

export function getTimePhase(timezone) {
  let hour = new Date().getHours();
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit', hourCycle: 'h23', timeZone: timezone
      }).formatToParts(new Date());
      hour = Number(parts.find((part) => part.type === 'hour')?.value ?? hour);
    } catch {
      // Fallback to the browser's local time when the provider timezone is invalid.
    }
  }
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'night';
}

export function formatHour(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatDay(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '');
}

export function compassDirection(value) {
  const angle = Number(value);
  if (!Number.isFinite(angle)) return null;
  const directions = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  return directions[Math.round(((angle % 360) + 360) % 360 / 45) % 8];
}
