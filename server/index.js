import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeatherUrl, configuredWeatherFields, normalizeWeather } from './weatherAdapter.js';

// Load the project's .env from its own root, even when the command is started
// with a different current working directory (for example, from the parent folder).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = Number(process.env.PORT || 3001);
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

// Fallback de geocodificação para capitais brasileiras mais pesquisadas.
// É usado somente quando o serviço de geocodificação externo falha ou não encontra resultados.
const BRAZIL_CITY_FALLBACKS = [
  { id: 'br-salvador', name: 'Salvador', region: 'Bahia', country: 'Brasil', latitude: -12.9714, longitude: -38.5014, timezone: 'America/Bahia', aliases: ['salvador'] },
  { id: 'br-sao-paulo', name: 'São Paulo', region: 'São Paulo', country: 'Brasil', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo', aliases: ['sao paulo', 'saopaulo'] },
  { id: 'br-rio-de-janeiro', name: 'Rio de Janeiro', region: 'Rio de Janeiro', country: 'Brasil', latitude: -22.9068, longitude: -43.1729, timezone: 'America/Sao_Paulo', aliases: ['rio', 'rio de janeiro'] },
  { id: 'br-brasilia', name: 'Brasília', region: 'Distrito Federal', country: 'Brasil', latitude: -15.7939, longitude: -47.8828, timezone: 'America/Sao_Paulo', aliases: ['brasilia'] },
  { id: 'br-recife', name: 'Recife', region: 'Pernambuco', country: 'Brasil', latitude: -8.0476, longitude: -34.8770, timezone: 'America/Recife', aliases: ['recife'] },
  { id: 'br-fortaleza', name: 'Fortaleza', region: 'Ceará', country: 'Brasil', latitude: -3.7319, longitude: -38.5267, timezone: 'America/Fortaleza', aliases: ['fortaleza'] },
  { id: 'br-belo-horizonte', name: 'Belo Horizonte', region: 'Minas Gerais', country: 'Brasil', latitude: -19.9167, longitude: -43.9345, timezone: 'America/Sao_Paulo', aliases: ['belo horizonte'] },
  { id: 'br-curitiba', name: 'Curitiba', region: 'Paraná', country: 'Brasil', latitude: -25.4284, longitude: -49.2733, timezone: 'America/Sao_Paulo', aliases: ['curitiba'] },
  { id: 'br-manaus', name: 'Manaus', region: 'Amazonas', country: 'Brasil', latitude: -3.1190, longitude: -60.0217, timezone: 'America/Manaus', aliases: ['manaus'] },
  { id: 'br-porto-alegre', name: 'Porto Alegre', region: 'Rio Grande do Sul', country: 'Brasil', latitude: -30.0346, longitude: -51.2177, timezone: 'America/Sao_Paulo', aliases: ['porto alegre'] }
];

function normalizeSearchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

function fallbackCitySearch(query) {
  const normalized = normalizeSearchText(query);
  return BRAZIL_CITY_FALLBACKS
    .filter((city) => [city.name, ...city.aliases].some((name) => normalizeSearchText(name).startsWith(normalized)))
    .slice(0, 5)
    .map(({ aliases, ...city }) => ({
      ...city,
      displayName: [city.name, city.region, city.country].filter(Boolean).join(', '),
      source: 'local-fallback'
    }));
}

app.disable('x-powered-by');
app.use(express.json({ limit: '30kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    provider: 'APIMETEO',
    providerConfigured: Boolean(process.env.APIMETEO_WEATHER_URL_TEMPLATE),
    mappedFields: configuredWeatherFields()
  });
});

app.get('/api/locations', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.json({ results: [] });

  const key = `geo:${query.toLocaleLowerCase('pt-BR')}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return res.json({ results: cached.value });

  try {
    // Geocodificação oficial Open-Meteo.
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', query);
    url.searchParams.set('count', '10');
    url.searchParams.set('language', 'pt');
    url.searchParams.set('format', 'json');

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const reason = body.reason || `HTTP ${response.status}`;
      const fallbackResults = fallbackCitySearch(query);
      if (fallbackResults.length) {
        cache.set(key, { value: fallbackResults, expiresAt: Date.now() + 60 * 60 * 1000 });
        return res.json({ results: fallbackResults, source: 'local-fallback', notice: 'Busca local temporária.' });
      }
      throw new Error(`Geocodificação Open-Meteo: ${reason}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.reason || 'A Open-Meteo recusou os parâmetros da busca.');
    const results = (data.results || []).map((item) => {
      const name = item.name || query;
      const region = item.admin1 || item.admin2 || null;
      const country = item.country || null;
      return {
        id: item.id,
        name,
        region,
        country,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        timezone: item.timezone || null,
        displayName: [name, region, country].filter(Boolean).join(', ')
      };
    }).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

    // Se o catálogo externo retornar vazio, tenta as capitais cadastradas localmente.
    const finalResults = results.length ? results : fallbackCitySearch(query);
    cache.set(key, { value: finalResults, expiresAt: Date.now() + (results.length ? 6 : 1) * 60 * 60 * 1000 });
    res.json({ results: finalResults, source: results.length ? 'open-meteo' : 'local-fallback' });
  } catch (error) {
    console.error(`[APIMETEO] Falha ao pesquisar a cidade "${query}":`, error);
    const fallbackResults = fallbackCitySearch(query);
    if (fallbackResults.length) {
      cache.set(key, { value: fallbackResults, expiresAt: Date.now() + 60 * 60 * 1000 });
      return res.json({ results: fallbackResults, source: 'local-fallback', notice: 'Busca local temporária.' });
    }
    res.status(502).json({
      error: 'Não foi possível pesquisar cidades no serviço Open-Meteo.',
      detail: error.cause?.code ? `${error.cause.code}: ${error.message}` : error.message
    });
  }
});

app.get('/api/weather', async (req, res) => {
  const city = {
    name: String(req.query.city || '').trim(),
    region: String(req.query.region || '').trim(),
    country: String(req.query.country || '').trim(),
    latitude: Number(req.query.lat),
    longitude: Number(req.query.lon)
  };

  if (!city.name || !Number.isFinite(city.latitude) || !Number.isFinite(city.longitude)) {
    return res.status(400).json({ error: 'Selecione uma cidade válida antes de consultar a previsão.' });
  }

  const cacheKey = `weather:${city.latitude.toFixed(4)}:${city.longitude.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);

  try {
    const url = buildWeatherUrl(city);
    const headers = { Accept: 'application/json' };
    const apiKey = process.env.APIMETEO_API_KEY;
    const authHeader = process.env.APIMETEO_AUTH_HEADER || 'Authorization';
    const authPrefix = process.env.APIMETEO_AUTH_PREFIX ?? 'Bearer';
    if (apiKey && !process.env.APIMETEO_API_KEY_QUERY_PARAM) headers[authHeader] = authPrefix ? `${authPrefix} ${apiKey}` : apiKey;

    const finalUrl = new URL(url);
    if (apiKey && process.env.APIMETEO_API_KEY_QUERY_PARAM) {
      finalUrl.searchParams.set(process.env.APIMETEO_API_KEY_QUERY_PARAM, apiKey);
    }

    const response = await fetch(finalUrl, { headers, signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      const error = new Error(`A APIMETEO respondeu com status HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    const payload = await response.json();
    const normalized = normalizeWeather(payload, city);
    const hasMappedData = Object.entries(normalized.current).some(([key, value]) => key !== 'timezone' && value !== null)
      || normalized.hourly.length > 0 || normalized.daily.length > 0;
    if (!hasMappedData) {
      return res.status(422).json({
        error: 'A resposta chegou da APIMETEO, mas os caminhos dos campos ainda não foram mapeados.',
        detail: 'Confira os nomes dos campos no JSON da API e preencha as variáveis APIMETEO_PATH_* no arquivo .env.'
      });
    }
    cache.set(cacheKey, { value: normalized, expiresAt: Date.now() + CACHE_TTL });
    res.json(normalized);
  } catch (error) {
    const status = error.status || 502;
    res.status(status).json({
      error: error.message || 'Não foi possível consultar a APIMETEO.',
      detail: status === 503 ? 'Configure APIMETEO_WEATHER_URL_TEMPLATE no arquivo .env.' : undefined
    });
  }
});

const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error) res.status(404).send('Aplicação ainda não compilada. Execute npm run build.');
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`APIMETEO disponível em http://localhost:${PORT}`);
  if (!process.env.APIMETEO_WEATHER_URL_TEMPLATE) {
    console.warn('APIMETEO ainda não configurada: adicione o endpoint oficial ao arquivo .env.');
  }
});
