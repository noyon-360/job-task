// Restores both JSON databases to their starting data: `npm run reset`.
// Useful before running the curl tests so the ids match the expected results.
const fs = require('fs');
const path = require('path');

const pairs = [
  ['jobs-service/jobs.seed.json', 'jobs-service/jobs.json'],
  ['applicants-service/applicants.seed.json', 'applicants-service/applicants.json']
];

for (const [seed, target] of pairs) {
  fs.copyFileSync(path.join(__dirname, seed), path.join(__dirname, target));
  console.log(`Reset ${target}`);
}
