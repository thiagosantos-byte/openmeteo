import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Bookmark, BookmarkCheck, CloudSun, Droplets, Gauge,
  MapPin, Search, ShieldCheck, Sunrise, Sunset, Thermometer,
  Wind, Eye, Sun, RefreshCw, AlertCircle, Cloud, CloudRain, CloudLightning,
  CloudFog, CloudSnow, Sparkles
} from 'lucide-react';
import Atmosphere from './components/Atmosphere';
import SearchBox from './components/SearchBox';
import GlassCard from './components/GlassCard';
import HourlyForecast from './components/HourlyForecast';
import DailyForecast from './components/DailyForecast';
import { getApiHealth, getWeather, searchCities } from './services/api';
import { classifyWeather, getTimePhase, compassDirection, formatHour } from './utils';
import './styles/app.css';

const WEATHER_ICONS = {
  sunny: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
  fog: CloudFog,
  snow: CloudSnow,
  unknown: CloudSun
};

function readSavedCities() {
  try { return JSON.parse(localStorage.getItem('apimeteo:saved-cities') || '[]'); }
  catch { return []; }
}

function MetricCard({ label, value, unit, icon: Icon, note, visual }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <GlassCard eyebrow={label.toUpperCase()} icon={Icon} className="metric-card">
      <div className="metric-card__value">{value}<small>{unit}</small></div>
      {visual}
      {note && <div className="metric-card__note">{note}</div>}
    </GlassCard>
  );
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

function localTime(timezone) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: timezone || undefined,
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  }
}

export default function App() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedCity, setSelectedCity] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [error, setError] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [savedCities, setSavedCities] = useState(readSavedCities);
  const [apiHealth, setApiHealth] = useState(null);
  const [clockTick, setClockTick] = useState(Date.now());
  const requestNumber = useRef(0);
  const searchTimer = useRef(null);
  const searchSequence = useRef(0);

  useEffect(() => {
    getApiHealth().then(setApiHealth).catch(() => setApiHealth(null));
    const clock = window.setInterval(() => setClockTick(Date.now()), 60_000);
    return () => { clearTimeout(searchTimer.current); window.clearInterval(clock); };
  }, []);

  useEffect(() => {
    localStorage.setItem('apimeteo:saved-cities', JSON.stringify(savedCities));
  }, [savedCities]);

  useEffect(() => {
    const cleanQuery = query.trim();
    const currentSearch = ++searchSequence.current;
    if (cleanQuery.length < 2) {
      setSuggestions([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    setSearchError('');
    setSearching(true);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchCities(cleanQuery);
        if (currentSearch === searchSequence.current) setSuggestions(results);
      } catch (requestError) {
        if (currentSearch === searchSequence.current) {
          setSuggestions([]);
          const detail = requestError.detail ? ` ${requestError.detail}` : '';
          setSearchError(`${requestError.message || 'Falha na busca de cidades.'}${detail}`);
        }
      } finally {
        if (currentSearch === searchSequence.current) setSearching(false);
      }
    }, 420);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  const loadCity = useCallback(async (city) => {
    const currentRequest = ++requestNumber.current;
    setSelectedCity(city);
    setQuery('');
    setSuggestions([]);
    setWeather(null);
    setError('');
    setErrorDetail('');
    setLoadingWeather(true);
    try {
      const result = await getWeather(city);
      if (currentRequest === requestNumber.current) setWeather(result);
    } catch (requestError) {
      if (currentRequest === requestNumber.current) {
        setError(requestError.message || 'Não foi possível consultar a previsão.');
        setErrorDetail(requestError.detail || 'Verifique a conexão e a configuração da integração APIMETEO.');
      }
    } finally {
      if (currentRequest === requestNumber.current) setLoadingWeather(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => { setSuggestions([]); setSearchError(''); }, []);
  const condition = weather?.current?.condition || '';
  const weatherState = classifyWeather(condition);
  const phase = useMemo(() => getTimePhase(weather?.current?.timezone), [weather?.current?.timezone, clockTick]);
  const WeatherIcon = WEATHER_ICONS[weatherState] || CloudSun;
  const current = weather?.current || {};
  const isSaved = selectedCity && savedCities.some((city) => city.id === selectedCity.id || (city.latitude === selectedCity.latitude && city.longitude === selectedCity.longitude));
  const citySubtitle = selectedCity ? [selectedCity.region, selectedCity.country].filter(Boolean).join(' · ') : 'Consulte uma cidade para começar';

  const toggleSaved = () => {
    if (!selectedCity) return;
    if (isSaved) {
      setSavedCities((items) => items.filter((city) => !(city.id === selectedCity.id || (city.latitude === selectedCity.latitude && city.longitude === selectedCity.longitude))));
    } else {
      setSavedCities((items) => [selectedCity, ...items].slice(0, 8));
    }
  };

  const updatedLabel = useMemo(() => {
    if (!weather?.updatedAt) return null;
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(weather.updatedAt));
  }, [weather?.updatedAt]);

  const extraMetrics = [
    { key: 'feelsLike', label: 'Sensação térmica', icon: Thermometer, value: formatNumber(current.feelsLike), unit: current.feelsLike == null ? '' : '°', note: 'Temperatura percebida' },
    { key: 'humidity', label: 'Umidade', icon: Droplets, value: formatNumber(current.humidity), unit: current.humidity == null ? '' : '%', note: 'Umidade relativa do ar' },
    { key: 'windSpeed', label: 'Vento', icon: Wind, value: formatNumber(current.windSpeed, 1), unit: current.windSpeed == null ? '' : ' km/h', note: current.windDirection == null ? 'Velocidade do vento' : `Direção ${compassDirection(current.windDirection) || `${current.windDirection}°`}` },
    { key: 'uvIndex', label: 'Índice UV', icon: Sun, value: formatNumber(current.uvIndex, 1), unit: '', note: 'Radiação ultravioleta' },
    { key: 'airQuality', label: 'Qualidade do ar', icon: Activity, value: formatNumber(current.airQuality, 0), unit: ' AQI', note: 'Índice informado pela APIMETEO' },
    { key: 'pressure', label: 'Pressão', icon: Gauge, value: formatNumber(current.pressure, 0), unit: current.pressure == null ? '' : ' hPa', note: 'Pressão atmosférica' },
    { key: 'visibility', label: 'Visibilidade', icon: Eye, value: formatNumber(current.visibility, 1), unit: current.visibility == null ? '' : ' km', note: 'Alcance de visibilidade' },
    { key: 'precipitation', label: 'Precipitação', icon: Droplets, value: formatNumber(current.precipitation, 1), unit: current.precipitation == null ? '' : ' mm', note: 'Volume informado pela API' }
  ].filter((item) => item.value !== null);

  return (
    <main className={`weather-app weather-app--${weatherState} weather-app--${phase}`}>
      <Atmosphere weather={weatherState} phase={phase} />
      <div className="ambient-grain" aria-hidden="true" />

      <div className="app-shell">
        <aside className="sidebar glass-shell">
          <div className="brand-lockup">
            <div className="brand-mark"><CloudSun size={21} strokeWidth={1.6} /></div>
            <div><strong>APIMETEO</strong><span>CLIMA EM OUTRA PERSPECTIVA</span></div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-heading">LOCALIZAR CIDADE</div>
            <SearchBox value={query} onChange={setQuery} results={suggestions} loading={searching} onSelect={loadCity} onSubmit={() => suggestions[0] && loadCity(suggestions[0])} onClear={clearSuggestions} errorMessage={searchError} />
            <p className="search-hint"><MapPin size={12} /> Pesquise pelo nome de uma cidade</p>
          </div>

          {selectedCity && (
            <div className="selected-city-mini">
              <div className="selected-city-mini__top"><span>LOCAL SELECIONADO</span><span className="live-dot" /></div>
              <strong>{selectedCity.name}</strong>
              <small>{citySubtitle}</small>
              <div className="selected-city-mini__weather">
                <WeatherIcon size={28} strokeWidth={1.5} />
                <b>{current.temperature == null ? '—°' : `${Math.round(current.temperature)}°`}</b>
              </div>
              <span className="muted-small">{condition || (loadingWeather ? 'Consultando condições...' : 'Condição não informada')}</span>
            </div>
          )}

          <div className="sidebar-section saved-section">
            <div className="sidebar-heading saved-heading"><span>CIDADES SALVAS</span><span>{savedCities.length}/8</span></div>
            {savedCities.length ? savedCities.map((city) => (
              <button className={`saved-city ${selectedCity?.id === city.id ? 'is-active' : ''}`} key={city.id || `${city.latitude}-${city.longitude}`} onClick={() => loadCity(city)}>
                <MapPin size={15} /><span>{city.name}<small>{city.region || city.country}</small></span><span className="saved-city__arrow">↗</span>
              </button>
            )) : <p className="empty-saved">Suas cidades favoritas aparecerão aqui.</p>}
          </div>

          <div className="sidebar-footnote"><ShieldCheck size={14} /><span>Dados meteorológicos consultados pela APIMETEO</span></div>
        </aside>

        <section className="main-stage">
          <header className="topbar">
            <div className="mobile-search"><SearchBox value={query} onChange={setQuery} results={suggestions} loading={searching} onSelect={loadCity} onSubmit={() => suggestions[0] && loadCity(suggestions[0])} onClear={clearSuggestions} errorMessage={searchError} compact /></div>
            {savedCities.length > 0 && <div className="mobile-saved-cities">{savedCities.map((city) => <button key={city.id || `${city.latitude}-${city.longitude}`} onClick={() => loadCity(city)}>{city.name}</button>)}</div>}
            <div className="topbar__context"><span className="topbar-dot" /> EXPERIÊNCIA METEOROLÓGICA</div>
            <div className="topbar__right">
              {weather && <span className="updated-at"><RefreshCw size={12} /> Atualizado às {updatedLabel}</span>}
              <div className="source-pill"><span /> Open-Meteo</div>
            </div>
          </header>

          <section className="weather-hero">
            <div className="weather-hero__copy">
              <div className="hero-kicker"><span /> CONDIÇÕES ATUAIS</div>
              <div className="hero-location"><MapPin size={15} /> {selectedCity ? citySubtitle : 'SUA JANELA PARA O TEMPO'}</div>
              <h1>{selectedCity?.name || 'O céu da sua cidade'}</h1>
              <div className="hero-mainline">
                <div className="hero-temperature">{current.temperature == null ? '—' : Math.round(current.temperature)}<span>°</span></div>
                {weather && <WeatherIcon className="hero-weather-icon" size={62} strokeWidth={1.15} />}
              </div>
              <p className="hero-condition">{condition || (loadingWeather ? 'Buscando informações meteorológicas' : 'Descubra as condições em tempo real')}</p>
              {weather && (current.minTemperature != null || current.maxTemperature != null) && (
                <div className="hero-range">Máx. {current.maxTemperature == null ? '—' : `${Math.round(current.maxTemperature)}°`} <span>·</span> Mín. {current.minTemperature == null ? '—' : `${Math.round(current.minTemperature)}°`}</div>
              )}
              {weather && current.feelsLike != null && <div className="hero-feels">Sensação térmica de {Math.round(current.feelsLike)}°</div>}
              {!selectedCity && <div className="hero-prompt"><Sparkles size={15} /> Pesquise uma cidade para revelar sua atmosfera</div>}
            </div>
            <div className="hero-time"><span>{selectedCity ? 'HORÁRIO DA CIDADE' : 'TEMPO E ATMOSFERA'}</span><strong>{selectedCity && current.timezone ? localTime(current.timezone) : '—:—'}</strong><small>{selectedCity && !current.timezone ? 'Fuso não informado pela API' : phase === 'night' ? 'Céu noturno' : phase === 'sunset' ? 'Entardecer' : phase === 'morning' ? 'Manhã' : 'Durante o dia'}</small></div>
            {selectedCity && <button className={`save-current ${isSaved ? 'is-saved' : ''}`} onClick={toggleSaved} aria-label={isSaved ? 'Remover cidade salva' : 'Salvar cidade'} title={isSaved ? 'Remover cidade salva' : 'Salvar cidade'}>{isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}<span>{isSaved ? 'Salva' : 'Salvar cidade'}</span></button>}
          </section>

          {loadingWeather && <div className="loading-banner"><span className="loader-orbit" /><div><strong>Consultando a atmosfera...</strong><small>Buscando dados meteorológicos na APIMETEO</small></div></div>}

          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={19} /><div><strong>{error}</strong><small>{errorDetail}</small></div>
              <button className="icon-button" onClick={() => selectedCity && loadCity(selectedCity)} aria-label="Tentar novamente"><RefreshCw size={15} /></button>
            </div>
          )}

          {!apiHealth?.providerConfigured && !error && (
            <div className="setup-note"><AlertCircle size={16} /><span><strong>Integração pendente:</strong> configure o endpoint oficial e os campos da APIMETEO no arquivo <code>.env</code>. A interface está pronta, mas não exibirá dados inventados.</span></div>
          )}

          {weather && (
            <div className="forecast-layout">
              <HourlyForecast items={weather.hourly} />
              <DailyForecast items={weather.daily} />
              {extraMetrics.length > 0 && (
                <div className="metrics-grid">
                  {extraMetrics.map((metric) => <MetricCard key={metric.key} {...metric} />)}
                  {(current.sunrise || current.sunset) && (
                    <GlassCard eyebrow="SOL E LUZ" icon={Sunrise} className="sun-card">
                      <div className="sun-times">
                        {current.sunrise && <div><Sunrise size={20} /><span>NASCER DO SOL</span><strong>{formatHour(current.sunrise)}</strong></div>}
                        {current.sunset && <div><Sunset size={20} /><span>PÔR DO SOL</span><strong>{formatHour(current.sunset)}</strong></div>}
                      </div>
                      <div className="sun-path"><span /></div>
                    </GlassCard>
                  )}
                </div>
              )}
            </div>
          )}

          {!weather && !loadingWeather && !error && (
            <div className="empty-weather-state">
              <div className="empty-orbit"><span /><CloudSun size={36} strokeWidth={1.25} /></div>
              <span className="empty-eyebrow">SUA EXPERIÊNCIA COMEÇA AQUI</span>
              <h2>Em qual céu você quer estar?</h2>
              <p>Busque uma cidade para consultar temperatura, previsão horária e condições meteorológicas diretamente pela APIMETEO.</p>
              <button className="explore-button" onClick={() => { const selector = window.matchMedia('(max-width: 560px)').matches ? '.mobile-search .search-box input' : '.sidebar .search-box input'; document.querySelector(selector)?.focus(); }}><Search size={16} /> Pesquisar cidade</button>
            </div>
          )}

          <footer className="app-footer"><span>APIMETEO <i>·</i> Dados meteorológicos: Open-Meteo</span><span>Temperaturas em °C <i>·</i> Vento em km/h</span></footer>
        </section>
      </div>
    </main>
  );
}
