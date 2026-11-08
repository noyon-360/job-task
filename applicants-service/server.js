// APPLICANTS SERVICE (internal, port 3002)
// Owns job applications and stores them in applicants.json.
// Before saving an application it asks the Jobs service whether the job
// exists and is still open (service-to-service communication).

const path = require('path');
const express = require('express');
const config = require('../config');
const JsonDb = require('../shared/jsonDb');
const {
  HttpError, sendError, asyncHandler, methodNotAllowed, requireJsonBody, parseId, errorHandler
} = require('../shared/http');

const app = express();
app.disable('x-powered-by');
const db = new JsonDb(path.join(__dirname, 'applicants.json'));

const STATUSES = ['Pending', 'Shortlisted', 'Rejected', 'Hired'];
const CREATE_FIELDS = ['name', 'email', 'phone', 'jobId'];
const UPDATE_FIELDS = ['name', 'email', 'phone', 'status'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{7,15}$/;

const JOBS_URL = `http://${config.SERVICE_HOST}:${config.JOBS_SERVICE_PORT}`;

// --- Access control: reject anything that did not come through the gateway ---
app.use((req, res, next) => {
  if (req.get('x-gateway-key') !== config.GATEWAY_KEY) {
    return sendError(res, 403, 'Direct access to this service is forbidden. Use the API Gateway on port ' + config.GATEWAY_PORT);
  }
  next();
});

app.use(express.json({ limit: '10kb' }));

// --- Talk to the Jobs service ------------------------------------------
async function getJob(jobId) {
  let response;
  try {
    response = await fetch(`${JOBS_URL}/jobs/${jobId}`, {
      headers: { 'x-gateway-key': config.GATEWAY_KEY },
      signal: AbortSignal.timeout(config.SERVICE_TIMEOUT_MS)
    });
  } catch {
    throw new HttpError(503, 'Jobs service is unavailable, so the job cannot be checked. Try again later');
  }
  if (response.status === 404) throw new HttpError(404, `Job with id ${jobId} does not exist`);
  if (!response.ok) throw new HttpError(502, 'Jobs service returned an unexpected error');
  const body = await response.json();
  return body.data;
}

// --- Validation ---------------------------------------------------------
function validateApplicant(body, partial) {
  const allowed = partial ? UPDATE_FIELDS : CREATE_FIELDS;
  const errors = [];

  if (partial && body.jobId !== undefined) errors.push('"jobId" cannot be changed. Delete this application and apply again');
  const unknown = Object.keys(body).filter((k) => !allowed.includes(k) && !(partial && k === 'jobId'));
  if (unknown.length) errors.push(`Unknown field(s): ${unknown.join(', ')}`);

  if (body.name === undefined) {
    if (!partial) errors.push('"name" is required');
  } else if (typeof body.name !== 'string' || body.name.trim() === '') {
    errors.push('"name" must be a non-empty text value');
  }

  if (body.email === undefined) {
    if (!partial) errors.push('"email" is required');
  } else if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email)) {
    errors.push('"email" must be a valid email address, e.g. name@example.com');
  }

  if (body.phone !== undefined && (typeof body.phone !== 'string' || !PHONE_RE.test(body.phone))) {
    errors.push('"phone" must contain 7 to 15 digits, optionally starting with +');
  }

  if (!partial) {
    if (body.jobId === undefined) errors.push('"jobId" is required');
    else if (!Number.isInteger(body.jobId) || body.jobId < 1) errors.push('"jobId" must be a positive whole number');
  }

  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    errors.push(`"status" must be one of: ${STATUSES.join(', ')}`);
  }

  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
}

// --- Routes -------------------------------------------------------------

// GET /applicants  (optional filters: ?jobId=1&status=Pending)
// POST /applicants
app.route('/applicants')
  .get(asyncHandler(async (req, res) => {
    let applicants = await db.readAll();
    const { jobId, status } = req.query;
    if (jobId !== undefined) {
      const id = parseId(String(jobId));
      applicants = applicants.filter((a) => a.jobId === id);
    }
    if (status) applicants = applicants.filter((a) => a.status.toLowerCase() === String(status).toLowerCase());
    res.json({ success: true, count: applicants.length, data: applicants });
  }))
  .post(requireJsonBody, asyncHandler(async (req, res) => {
    validateApplicant(req.body, false);
    const job = await getJob(req.body.jobId);
    if (job.status !== 'open') {
      throw new HttpError(409, `Job ${job.id} ("${job.title}") is closed and no longer accepts applications`);
    }

    const email = req.body.email.trim().toLowerCase();
    const applicant = await db.update((applicants) => {
      const duplicate = applicants.find((a) => a.jobId === job.id && a.email === email);
      if (duplicate) {
        throw new HttpError(409, `${email} has already applied for job ${job.id} (application id ${duplicate.id})`);
      }
      const created = {
        id: JsonDb.nextId(applicants),
        name: req.body.name.trim(),
        email,
        phone: req.body.phone || null,
        jobId: job.id,
        jobTitle: job.title,
        status: 'Pending',
        appliedAt: new Date().toISOString()
      };
      applicants.push(created);
      return created;
    });
    res.status(201).json({ success: true, message: 'Application submitted', data: applicant });
  }))
  .all(methodNotAllowed(['GET', 'POST']));

// GET / PUT / DELETE /applicants/:id
app.route('/applicants/:id')
  .get(asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const applicant = await db.findById(id);
    if (!applicant) throw new HttpError(404, `Applicant with id ${id} not found`);
    res.json({ success: true, data: applicant });
  }))
  .put(requireJsonBody, asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    validateApplicant(req.body, true);
    const applicant = await db.update((applicants) => {
      const existing = applicants.find((a) => a.id === id);
      if (!existing) throw new HttpError(404, `Applicant with id ${id} not found`);
      if (req.body.name !== undefined) existing.name = req.body.name.trim();
      if (req.body.email !== undefined) {
        const email = req.body.email.trim().toLowerCase();
        const clash = applicants.find((a) => a.id !== id && a.jobId === existing.jobId && a.email === email);
        if (clash) throw new HttpError(409, `${email} has already applied for job ${existing.jobId} (application id ${clash.id})`);
        existing.email = email;
      }
      if (req.body.phone !== undefined) existing.phone = req.body.phone;
      if (req.body.status !== undefined) existing.status = req.body.status;
      existing.updatedAt = new Date().toISOString();
      return existing;
    });
    res.json({ success: true, message: 'Applicant updated', data: applicant });
  }))
  .delete(asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const removed = await db.update((applicants) => {
      const index = applicants.findIndex((a) => a.id === id);
      if (index === -1) throw new HttpError(404, `Applicant with id ${id} not found`);
      return applicants.splice(index, 1)[0];
    });
    res.json({ success: true, message: `Applicant ${id} deleted`, data: removed });
  }))
  .all(methodNotAllowed(['GET', 'PUT', 'DELETE']));

app.use((req, res) => sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found in Applicants service`));
app.use(errorHandler);

app.listen(config.APPLICANTS_SERVICE_PORT, config.SERVICE_HOST, () => {
  console.log(`[applicants-service] running on http://${config.SERVICE_HOST}:${config.APPLICANTS_SERVICE_PORT} (internal only)`);
});
