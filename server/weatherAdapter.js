const FIELD_PATHS = {
  temperature: 'APIMETEO_PATH_TEMPERATURE',
  condition: 'APIMETEO_PATH_CONDITION',
  feelsLike: 'APIMETEO_PATH_FEELS_LIKE',
  humidity: 'APIMETEO_PATH_HUMIDITY',
  windSpeed: 'APIMETEO_PATH_WIND_SPEED',
  windDirection: 'APIMETEO_PATH_WIND_DIRECTION',
  pressure: 'APIMETEO_PATH_PRESSURE',
  uvIndex: 'APIMETEO_PATH_UV_INDEX',
  airQuality: 'APIMETEO_PATH_AIR_QUALITY',
  visibility: 'APIMETEO_PATH_VISIBILITY',
  precipitation: 'APIMETEO_PATH_PRECIPITATION',
  minTemperature: 'APIMETEO_PATH_MIN_TEMPERATURE',
  maxTemperature: 'APIMETEO_PATH_MAX_TEMPERATURE',
  sunrise: 'APIMETEO_PATH_SUNRISE',
  sunset: 'APIMETEO_PATH_SUNSET',
  timezone: 'APIMETEO_PATH_TIMEZONE'
};

const ARRAY_PATHS = {
  hourlyTime: 'APIMETEO_PATH_HOURLY_TIME',
  hourlyTemperature: 'APIMETEO_PATH_HOURLY_TEMPERATURE',
  hourlyCondition: 'APIMETEO_PATH_HOURLY_CONDITION',
  hourlyPrecipitationProbability: 'APIMETEO_PATH_HOURLY_PRECIPITATION_PROBABILITY',
  dailyDate: 'APIMETEO_PATH_DAILY_DATE',
  dailyMinTemperature: 'APIMETEO_PATH_DAILY_MIN_TEMPERATURE',
  dailyMaxTemperature: 'APIMETEO_PATH_DAILY_MAX_TEMPERATURE',
  dailyCondition: 'APIMETEO_PATH_DAILY_CONDITION',
  dailyPrecipitationProbability: 'APIMETEO_PATH_DAILY_PRECIPITATION_PROBABILITY'
};

function readPath(source, path) {
  if (!path) return undefined;
  return path.split('.').reduce((value, part) => {
    if (value === null || value === undefined) return undefined;
    const key = /^\d+$/.test(part) ? Number(part) : part;
    return value[key];
  }, source);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanText(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return null;
  return String(value);
}

// Open-Meteo uses WMO weather interpretation codes (WMO Code Table 4677).
// Translate them so the interface can select the correct Portuguese label and icon.
const WMO_WEATHER_CODES_PT = {
  0: 'Céu limpo',
  1: 'Predominantemente limpo',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Nevoeiro',
  48: 'Nevoeiro com geada',
  51: 'Garoa fraca',
  53: 'Garoa moderada',
  55: 'Garoa intensa',
  56: 'Garoa congelante fraca',
  57: 'Garoa congelante intensa',
  61: 'Chuva fraca',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  66: 'Chuva congelante fraca',
  67: 'Chuva congelante forte',
  71: 'Neve fraca',
  73: 'Neve moderada',
  75: 'Neve forte',
  77: 'Grãos de neve',
  80: 'Pancadas de chuva fracas',
  81: 'Pancadas de chuva moderadas',
  82: 'Pancadas de chuva fortes',
  85: 'Pancadas de neve fracas',
  86: 'Pancadas de neve fortes',
  95: 'Trovoada',
  96: 'Trovoada com granizo fraco',
  97: 'Trovoada forte',
  99: 'Trovoada com granizo forte'
};

function weatherCondition(value) {
  if (value === null || value === undefined || value === '') return null;
  const numericCode = Number(value);
  if (Number.isInteger(numericCode) && Object.hasOwn(WMO_WEATHER_CODES_PT, numericCode)) {
    return WMO_WEATHER_CODES_PT[numericCode];
  }
  return cleanText(value);
}

function currentHourlyIndex(payload) {
  const times = payload?.hourly?.time;
  const currentTime = payload?.current?.time;
  if (!Array.isArray(times) || !currentTime) return 0;

  let latestPastIndex = -1;
  for (let index = 0; index < times.length; index += 1) {
    if (String(times[index]) <= String(currentTime)) latestPastIndex = index;
    else break;
  }
  return latestPastIndex >= 0 ? latestPastIndex : 0;
}

function valueAt(payload, envName, kind = 'number') {
  let value = readPath(payload, process.env[envName]);
  // A few current indicators (UV and visibility) are supplied in Open-Meteo's
  // hourly arrays. Read the value for the current hourly interval, not index 0.
  if (Array.isArray(value)) value = value[currentHourlyIndex(payload)];
  return kind === 'text' ? cleanText(value) : finiteNumber(value);
}

function arrayAt(payload, envName) {
  const value = readPath(payload, process.env[envName]);
  return Array.isArray(value) ? value : [];
}

function zipForecast(payload, config, type) {
  const values = Object.fromEntries(
    Object.entries(config).map(([key, envName]) => [key, arrayAt(payload, envName)])
  );
  const length = Math.max(0, ...Object.values(values).map((array) => array.length));
  const startIndex = type === 'hourly' ? currentHourlyIndex(payload) : 0;
  const available = Math.max(0, length - startIndex);
  const count = Math.min(available, type === 'hourly' ? 24 : 10);
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    const item = {};
    for (const [key, array] of Object.entries(values)) {
      const value = array[index];
      if (key === 'condition') item[key] = weatherCondition(value);
      else if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) item[key] = cleanText(value);
      else item[key] = finiteNumber(value);
    }
    return item;
  }).filter((item) => Object.values(item).some((value) => value !== null));
}

export function normalizeWeather(payload, city) {
  const current = {};
  for (const [key, envName] of Object.entries(FIELD_PATHS)) {
    if (key === 'condition') current[key] = weatherCondition(readPath(payload, process.env[envName]));
    else {
      const value = valueAt(payload, envName, key === 'sunrise' || key === 'sunset' || key === 'timezone' ? 'text' : 'number');
      current[key] = key === 'visibility' && value !== null ? value / 1000 : value;
    }
  }

  const hourly = zipForecast(payload, {
    time: ARRAY_PATHS.hourlyTime,
    temperature: ARRAY_PATHS.hourlyTemperature,
    condition: ARRAY_PATHS.hourlyCondition,
    precipitationProbability: ARRAY_PATHS.hourlyPrecipitationProbability
  }, 'hourly');

  const daily = zipForecast(payload, {
    date: ARRAY_PATHS.dailyDate,
    minTemperature: ARRAY_PATHS.dailyMinTemperature,
    maxTemperature: ARRAY_PATHS.dailyMaxTemperature,
    condition: ARRAY_PATHS.dailyCondition,
    precipitationProbability: ARRAY_PATHS.dailyPrecipitationProbability
  }, 'daily');

  return {
    location: {
      name: city.name,
      region: city.region || null,
      country: city.country || null,
      latitude: city.latitude,
      longitude: city.longitude
    },
    current,
    hourly,
    daily,
    updatedAt: new Date().toISOString(),
    source: 'APIMETEO'
  };
}

export function configuredWeatherFields() {
  return Object.entries(FIELD_PATHS)
    .filter(([, envName]) => Boolean(process.env[envName]))
    .map(([key]) => key);
}

export function buildWeatherUrl(city) {
  const template = process.env.APIMETEO_WEATHER_URL_TEMPLATE;
  if (!template) {
    const error = new Error('A URL do serviço APIMETEO ainda não foi configurada.');
    error.status = 503;
    throw error;
  }

  const replacements = {
    lat: encodeURIComponent(city.latitude),
    lon: encodeURIComponent(city.longitude),
    city: encodeURIComponent(city.name),
    region: encodeURIComponent(city.region || ''),
    country: encodeURIComponent(city.country || ''),
    timezone: encodeURIComponent(process.env.APIMETEO_REQUEST_TIMEZONE || '')
  };
  const url = template.replace(/\{(lat|lon|city|region|country|timezone)\}/g, (_, key) => replacements[key]);
  try {
    new URL(url);
  } catch {
    const error = new Error('APIMETEO_WEATHER_URL_TEMPLATE precisa ser uma URL absoluta válida.');
    error.status = 500;
    throw error;
  }
  return url;
}
