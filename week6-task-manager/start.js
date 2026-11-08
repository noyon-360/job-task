// Starts the whole system with one command: npm start
// A cloud host only runs ONE start command, so this file loads
// the two microservices and the API Gateway in the same process.
// Each one still listens on its own port.

require('./user-service/server');   // port 3001
require('./task-service/server');   // port 3002
require('./gateway/gateway');       // port 3000 (or the host's PORT)
