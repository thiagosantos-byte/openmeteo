# APIMETEO — experiência meteorológica imersiva

Aplicação React + Vite com servidor Express e Docker. A interface foi desenhada para três experiências responsivas: desktop com navegação lateral, tablet com cartões em grade e celular com pesquisa flutuante e rolagem vertical.

## O que já está implementado

- Pesquisa de cidades pelo endpoint oficial Open-Meteo Geocoding API (`geocoding-api.open-meteo.com/v1/search`).
- Consulta meteorológica pelo endpoint público oficial da Open-Meteo, identificada como fonte de dados na página de referência do professor.
- Camada de integração isolada em `server/weatherAdapter.js`.
- Chave da API mantida no backend, nunca no React.
- Interface em português brasileiro, temperatura em °C, vento em km/h e relógio de 24 horas.
- Previsão horária e diária renderizadas somente quando os respectivos campos estiverem configurados e vierem na resposta.
- Cartões de detalhes omitidos quando a API não disponibiliza os dados.
- Cidades salvas no navegador.
- Fundos atmosféricos em CSS para céu limpo, parcialmente nublado, nublado, chuva, tempestade, neblina, neve e noite.
- Dockerfile, Docker Compose e comandos PowerShell.

## Fonte meteorológica identificada na referência do professor

Na captura enviada, a própria página de referência informa **“Dados atualizados pela Open-Meteo”** e o painel Network mostra consultas de busca e previsão concluídas com HTTP 200. Por isso, esta configuração usa a API pública oficial **Open-Meteo Forecast API**, cujo endpoint documentado é `https://api.open-meteo.com/v1/forecast`. A documentação oficial descreve os parâmetros `latitude`, `longitude`, `current`, `hourly`, `daily`, `timezone`, `temperature_unit` e `wind_speed_unit`.

A consulta meteorológica não exige chave de API no endpoint público. O nome APIMETEO foi mantido no projeto por ser o nome da atividade/interface, mas a fonte de dados climáticos configurada é Open-Meteo, conforme a identificação visível no site de referência. A busca de cidades também usa a Open-Meteo Geocoding API (`https://geocoding-api.open-meteo.com/v1/search`), que converte o nome digitado em latitude/longitude. A interface identifica a Open-Meteo como fonte dos dados. O endpoint público gratuito destina-se a uso não comercial e deve respeitar os termos/licença do serviço.

O adaptador também converte os códigos meteorológicos WMO retornados pela Open-Meteo em descrições em português, inicia a previsão horária a partir do horário atual informado pela API e seleciona o indicador horário de UV/visibilidade correspondente ao período atual. A visibilidade retornada em metros é convertida para quilômetros antes de ser exibida.

Os campos de qualidade do ar, UV atual e visibilidade atual ficam ocultos nesta configuração porque não são retornados como campos atuais pelo conjunto de variáveis solicitado. Não são preenchidos com valores inventados.

### Configurar a integração

1. Copie `.env.example` para `.env`.
2. O arquivo `.env.example` já contém o endpoint e os caminhos JSON da Open-Meteo identificados na referência. Ao copiar o arquivo, essas configurações já estarão preenchidas.
3. Não informe chave de API: o endpoint público usado não exige autenticação.
4. Se alterar o conjunto de variáveis solicitadas na URL, mantenha os caminhos `APIMETEO_PATH_*` compatíveis com o JSON retornado.
5. Salve o `.env` e reinicie o servidor/contêiner.

### Variáveis principais

| Variável | Finalidade |
|---|---|
| `APIMETEO_WEATHER_URL_TEMPLATE` | URL completa do endpoint oficial |
| `APIMETEO_API_KEY` | Não necessária para o endpoint público Open-Meteo configurado |
| `APIMETEO_AUTH_HEADER` | Nome do cabeçalho de autenticação |
| `APIMETEO_AUTH_PREFIX` | Prefixo como `Bearer`; deixe vazio se não houver |
| `APIMETEO_API_KEY_QUERY_PARAM` | Nome do parâmetro de query se a documentação exigir chave na URL |
| `APIMETEO_PATH_*` | Caminhos JSON para as condições atuais |
| `APIMETEO_PATH_HOURLY_*` | Caminhos para arrays da previsão por hora |
| `APIMETEO_PATH_DAILY_*` | Caminhos para arrays da previsão diária |

## Executar no Windows — desenvolvimento

Requisitos: Node.js 20 ou superior e npm.

No PowerShell, abra o terminal na pasta do projeto (a mesma pasta que contém `package.json`):

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

No Git Bash, dentro da pasta do projeto (a mesma pasta que contém `package.json`):

```bash
cp -f .env.example .env
npm install
npm run dev
```

Abra `http://localhost:5173`.

O Vite roda na porta 5173 e encaminha `/api` para o servidor Express na porta 3001.

## Executar com Docker

Requisitos: Docker Desktop iniciado.

```powershell
Copy-Item .env.example .env
# Edite o .env com os dados reais da APIMETEO antes de consultar o clima.
docker compose up --build -d
```

Abra `http://localhost:3000`.

Comandos úteis:

```powershell
# Ver estado dos contêineres
docker compose ps

# Acompanhar logs
docker compose logs -f apimeteo

# Parar os contêineres
docker compose down

# Recriar após alterar código ou configuração
docker compose up --build -d
```

## Conferir configuração

Com o servidor ligado, acesse `http://localhost:3001/api/health` em desenvolvimento ou `http://localhost:3000/api/health` com Docker. O endpoint informa se a URL APIMETEO está definida e quais campos atuais foram mapeados; não expõe a chave.

## Estrutura

```text
apimeteo-immersive/
├── server/
│   ├── index.js
│   └── weatherAdapter.js
├── src/
│   ├── components/
│   ├── services/api.js
│   ├── styles/
│   ├── App.jsx
│   ├── main.jsx
│   └── utils.js
├── .dockerignore
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── index.html
├── package.json
└── vite.config.js
```


## Diagnóstico da busca de cidades

A busca exibe mensagens diretamente abaixo do campo quando o backend ou o serviço de geocodificação falha. O servidor também registra a causa no terminal com o prefixo `[APIMETEO]`.

Se a Open-Meteo Geocoding API estiver indisponível, o sistema possui uma lista local de capitais brasileiras (incluindo Salvador) para permitir selecionar uma cidade e testar a consulta meteorológica. A previsão em si continua dependendo da Forecast API da Open-Meteo e de conexão com a internet.

Execute `npm run dev` na pasta que contém `package.json`. O frontend usa `http://localhost:5173` e o backend `http://localhost:3001`.
