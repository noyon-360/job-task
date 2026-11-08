// API GATEWAY (public, port 3000)
// The ONLY entry point for clients. It:
//   1. serves the web client (GET /)
//   2. checks the request (valid JSON, known route)
//   3. forwards it to the right internal service
//   4. sends the service's answer back to the client
// Clients never see or use the internal service ports (3001, 3002).

const path = require('path');
const express = require('express');
const config = require('../config');
const { sendError, errorHandler } = require('../shared/http');

const app = express();
app.disable('x-powered-by');

// Route table: public path prefix -> internal service.
const SERVICES = {
  jobs: { name: 'Jobs service', url: `http://${config.SERVICE_HOST}:${config.JOBS_SERVICE_PORT}` },
  applicants: { name: 'Applicants service', url: `http://${config.SERVICE_HOST}:${config.APPLICANTS_SERVICE_PORT}` }
};

const ROUTES = [
  'GET    /jobs                (filters: ?location= &type= &status=)',
  'GET    /jobs/:id',
  'POST   /jobs',
  'PUT    /jobs/:id',
  'DELETE /jobs/:id',
  'GET    /applicants          (filters: ?jobId= &status=)',
  'GET    /applicants/:id',
  'POST   /applicants',
  'PUT    /applicants/:id',
  'DELETE /applicants/:id',
  'GET    /api                 (this list)',
  'GET    /health              (status of each service)'
];

// --- Request logging --------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[gateway] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// --- Web client -------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(express.json({ limit: '10kb' }));

// --- Gateway's own endpoints ------------------------------------------------
app.get('/api', (req, res) => {
  res.json({ success: true, gateway: `http://localhost:${config.GATEWAY_PORT}`, routes: ROUTES });
});

app.get('/health', async (req, res) => {
  const checks = await Promise.all(
    Object.entries(SERVICES).map(async ([key, service]) => {
      try {
        await fetch(`${service.url}/${key}`, {
          headers: { 'x-gateway-key': config.GATEWAY_KEY },
          signal: AbortSignal.timeout(2000)
        });
        return [key, 'up'];
      } catch {
        return [key, 'down'];
      }
    })
  );
  const services = Object.fromEntries(checks);
  const allUp = Object.values(services).every((s) => s === 'up');
  res.status(allUp ? 200 : 503).json({ success: allUp, gateway: 'up', services });
});

// --- Forwarding ---------------------------------------------------------------
async function forward(req, res, serviceKey) {
  const service = SERVICES[serviceKey];
  const target = service.url + req.originalUrl;

  const headers = { 'x-gateway-key': config.GATEWAY_KEY, accept: 'application/json' };
  const options = { method: req.method, headers, signal: AbortSignal.timeout(config.SERVICE_TIMEOUT_MS) };

  // Re-send the body for methods that carry one.
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (req.get('content-type')) headers['content-type'] = req.get('content-type');
    if (req.is('application/json')) options.body = JSON.stringify(req.body ?? {});
  }

  let response;
  try {
    response = await fetch(target, options);
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return sendError(res, 504, `${service.name} did not respond in time`);
    }
    return sendError(res, 503, `${service.name} is currently unavailable. Please try again later`);
  }

  // Pass the service's answer straight back to the client.
  const allow = response.headers.get('allow');
  if (allow) res.set('Allow', allow);
  const text = await response.text();
  res.status(response.status).type('application/json').send(text);
}

app.use('/jobs', (req, res) => forward(req, res, 'jobs'));
app.use('/applicants', (req, res) => forward(req, res, 'applicants'));

// --- Unknown routes (misspelt or wrong paths) -----------------------------------
// Suggest the closest real route so an untrained user can fix the typo.
function distance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

app.use((req, res) => {
  const first = (req.path.split('/')[1] || '').toLowerCase();
  const candidates = ['jobs', 'applicants', 'api', 'health'];
  const best = candidates
    .map((c) => ({ c, d: distance(first, c) }))
    .sort((x, y) => x.d - y.d)[0];

  const details = { availableRoutes: ROUTES };
  if (first && best.d <= 3) details.didYouMean = '/' + best.c;
  return sendError(res, 404, `Route ${req.method} ${req.originalUrl} does not exist on the API Gateway`, details);
});

app.use(errorHandler);

app.listen(config.GATEWAY_PORT, () => {
  console.log(`[gateway] API Gateway running on http://localhost:${config.GATEWAY_PORT}`);
  console.log(`[gateway] /jobs       -> ${SERVICES.jobs.name}`);
  console.log(`[gateway] /applicants -> ${SERVICES.applicants.name}`);
});
