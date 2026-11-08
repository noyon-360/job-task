// Small helpers shared by the gateway and the services so every
// error response has the same JSON shape:
// { "success": false, "error": { "status": 404, "message": "..." } }

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Send a consistent error body.
function sendError(res, status, message, details) {
  const body = { success: false, error: { status, message } };
  if (details) body.error.details = details;
  return res.status(status).json(body);
}

// Wrap async route handlers so thrown errors reach the error middleware.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 405 handler for a route: lists which methods ARE allowed.
const methodNotAllowed = (allowed) => (req, res) => {
  res.set('Allow', allowed.join(', '));
  return sendError(res, 405, `Method ${req.method} is not allowed on ${req.baseUrl || ''}${req.path}`, {
    allowedMethods: allowed
  });
};

// For POST/PUT: require a JSON content type and a non-empty JSON object body.
function requireJsonBody(req, res, next) {
  if (!req.is('application/json')) {
    return sendError(res, 415, 'Content-Type must be application/json');
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length === 0) {
    return sendError(res, 400, 'Request body must be a non-empty JSON object');
  }
  next();
}

// Turn ":id" into a positive integer or reject it with 400.
function parseId(raw) {
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new HttpError(400, `Invalid id "${raw}". The id must be a positive whole number`);
  }
  return Number(raw);
}

// Error middleware for JSON parse errors, size limits and anything unexpected.
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return sendError(res, err.status, err.message, err.details);
  if (err.type === 'entity.parse.failed') return sendError(res, 400, 'Malformed JSON in request body');
  if (err.type === 'entity.too.large') return sendError(res, 413, 'Request body is too large (max 10kb)');
  console.error(err);
  return sendError(res, 500, 'Internal server error');
}

module.exports = { HttpError, sendError, asyncHandler, methodNotAllowed, requireJsonBody, parseId, errorHandler };
