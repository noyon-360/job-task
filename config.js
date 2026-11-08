// Central configuration for the whole application.
// Only the GATEWAY port is meant to be used by clients.
// The service ports are internal and are hidden behind the gateway.

module.exports = {
  GATEWAY_PORT: 3000,

  JOBS_SERVICE_PORT: 3001,
  APPLICANTS_SERVICE_PORT: 3002,

  // Services listen on localhost only, so they cannot be reached from another machine.
  SERVICE_HOST: '127.0.0.1',

  // Shared secret the gateway adds to every forwarded request.
  // A service rejects any request that does not carry it (403),
  // so even on the same machine a client cannot bypass the gateway.
  GATEWAY_KEY: 'job-portal-gateway-secret-2026',

  // How long the gateway waits for a service before giving up (ms).
  SERVICE_TIMEOUT_MS: 5000
};
