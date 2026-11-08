// Starts the two services and the gateway in one terminal: `npm start`.
// Each one runs as its own Node process, just like separate microservices.
// You can also start them one by one in separate terminals:
//   npm run jobs    npm run applicants    npm run gateway

const { spawn } = require('child_process');
const path = require('path');

const processes = [
  { name: 'jobs', file: 'jobs-service/server.js' },
  { name: 'applicants', file: 'applicants-service/server.js' },
  { name: 'gateway', file: 'gateway/gateway.js' }
];

const children = processes.map(({ name, file }) => {
  const child = spawn(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  child.on('exit', (code) => console.log(`[${name}] stopped (exit code ${code})`));
  return child;
});

// Ctrl+C stops everything.
process.on('SIGINT', () => {
  children.forEach((c) => c.kill('SIGINT'));
  process.exit(0);
});
