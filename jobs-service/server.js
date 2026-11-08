// JOBS SERVICE (internal, port 3001)
// Owns the job listings and stores them in jobs.json.
// It is only reachable through the API Gateway.

const path = require('path');
const express = require('express');
const config = require('../config');
const JsonDb = require('../shared/jsonDb');
const {
  HttpError, sendError, asyncHandler, methodNotAllowed, requireJsonBody, parseId, errorHandler
} = require('../shared/http');

const app = express();
app.disable('x-powered-by');
const db = new JsonDb(path.join(__dirname, 'jobs.json'));

const JOB_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Remote'];
const JOB_STATUSES = ['open', 'closed'];
const FIELDS = ['title', 'company', 'location', 'type', 'salary', 'status'];

// --- Access control: reject anything that did not come through the gateway ---
app.use((req, res, next) => {
  if (req.get('x-gateway-key') !== config.GATEWAY_KEY) {
    return sendError(res, 403, 'Direct access to this service is forbidden. Use the API Gateway on port ' + config.GATEWAY_PORT);
  }
  next();
});

app.use(express.json({ limit: '10kb' }));

// --- Validation ---------------------------------------------------------
// `partial` = true for PUT (only the fields sent are checked).
function validateJob(body, partial) {
  const errors = [];

  const unknown = Object.keys(body).filter((k) => !FIELDS.includes(k));
  if (unknown.length) errors.push(`Unknown field(s): ${unknown.join(', ')}`);

  for (const field of ['title', 'company', 'location']) {
    if (body[field] === undefined) {
      if (!partial) errors.push(`"${field}" is required`);
    } else if (typeof body[field] !== 'string' || body[field].trim() === '') {
      errors.push(`"${field}" must be a non-empty text value`);
    }
  }

  if (body.type === undefined) {
    if (!partial) errors.push('"type" is required');
  } else if (!JOB_TYPES.includes(body.type)) {
    errors.push(`"type" must be one of: ${JOB_TYPES.join(', ')}`);
  }

  if (body.salary !== undefined && (typeof body.salary !== 'number' || body.salary < 0)) {
    errors.push('"salary" must be a number of 0 or more');
  }

  if (body.status !== undefined && !JOB_STATUSES.includes(body.status)) {
    errors.push(`"status" must be one of: ${JOB_STATUSES.join(', ')}`);
  }

  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
}

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

// --- Routes -------------------------------------------------------------

// GET /jobs  (optional filters: ?location=Dhaka&type=Remote&status=open)
// POST /jobs
app.route('/jobs')
  .get(asyncHandler(async (req, res) => {
    let jobs = await db.readAll();
    const { location, type, status } = req.query;
    if (location) jobs = jobs.filter((j) => j.location.toLowerCase() === String(location).toLowerCase());
    if (type) jobs = jobs.filter((j) => j.type.toLowerCase() === String(type).toLowerCase());
    if (status) jobs = jobs.filter((j) => j.status === String(status).toLowerCase());
    res.json({ success: true, count: jobs.length, data: jobs });
  }))
  .post(requireJsonBody, asyncHandler(async (req, res) => {
    validateJob(req.body, false);
    const job = await db.update((jobs) => {
      const newJob = {
        id: JsonDb.nextId(jobs),
        title: clean(req.body.title),
        company: clean(req.body.company),
        location: clean(req.body.location),
        type: req.body.type,
        salary: req.body.salary ?? null,
        status: req.body.status || 'open',
        postedAt: new Date().toISOString()
      };
      jobs.push(newJob);
      return newJob;
    });
    res.status(201).json({ success: true, message: 'Job created', data: job });
  }))
  .all(methodNotAllowed(['GET', 'POST']));

// GET / PUT / DELETE /jobs/:id
app.route('/jobs/:id')
  .get(asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const job = await db.findById(id);
    if (!job) throw new HttpError(404, `Job with id ${id} not found`);
    res.json({ success: true, data: job });
  }))
  .put(requireJsonBody, asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    validateJob(req.body, true);
    const job = await db.update((jobs) => {
      const existing = jobs.find((j) => j.id === id);
      if (!existing) throw new HttpError(404, `Job with id ${id} not found`);
      for (const field of FIELDS) {
        if (req.body[field] !== undefined) existing[field] = clean(req.body[field]);
      }
      existing.updatedAt = new Date().toISOString();
      return existing;
    });
    res.json({ success: true, message: 'Job updated', data: job });
  }))
  .delete(asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const removed = await db.update((jobs) => {
      const index = jobs.findIndex((j) => j.id === id);
      if (index === -1) throw new HttpError(404, `Job with id ${id} not found`);
      return jobs.splice(index, 1)[0];
    });
    res.json({ success: true, message: `Job ${id} deleted`, data: removed });
  }))
  .all(methodNotAllowed(['GET', 'PUT', 'DELETE']));

// Unknown route inside this service
app.use((req, res) => sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found in Jobs service`));
app.use(errorHandler);

app.listen(config.JOBS_SERVICE_PORT, config.SERVICE_HOST, () => {
  console.log(`[jobs-service] running on http://${config.SERVICE_HOST}:${config.JOBS_SERVICE_PORT} (internal only)`);
});
