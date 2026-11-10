async function request(url) {
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (cause) {
    const error = new Error('Não foi possível conectar ao servidor da APIMETEO. Confirme se o backend está ativo na porta 3001.');
    error.cause = cause;
    throw error;
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `O servidor respondeu com HTTP ${response.status}.`);
    error.status = response.status;
    error.detail = body.detail || 'Verifique o terminal do servidor para ver o erro completo.';
    throw error;
  }
  return body;
}

export async function searchCities(query) {
  const params = new URLSearchParams({ q: query });
  const data = await request(`/api/locations?${params}`);
  return data.results || [];
}

export async function getWeather(city) {
  const params = new URLSearchParams({
    city: city.name,
    region: city.region || '',
    country: city.country || '',
    lat: String(city.latitude),
    lon: String(city.longitude)
  });
  return request(`/api/weather?${params}`);
}

export async function getApiHealth() {
  return request('/api/health');
}
