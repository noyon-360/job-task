// Runs every curl test against the API Gateway and writes the results to
// curl-tests.txt (command, expected status, actual status and response).
//
//   npm test
//
// It resets the JSON data, starts the services itself, and later stops the
// Jobs service on purpose to test how the gateway handles a service that is down.
// Make sure nothing else is using ports 3000-3002 before running it.

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const G = 'http://localhost:3000';
const J = 'Content-Type: application/json';

// ---- Test list ---------------------------------------------------------------
// args = curl arguments; expect = HTTP status we expect.
const sections = [
  {
    title: 'A. GATEWAY BASICS',
    tests: [
      { name: 'Open the web client in the gateway (browser test: http://localhost:3000)', expect: 200, args: [`${G}/`], short: true },
      { name: 'List all available routes', expect: 200, args: [`${G}/api`] },
      { name: 'Health check - both services up', expect: 200, args: [`${G}/health`] }
    ]
  },
  {
    title: 'B. JOBS ROUTE - VALID REQUESTS (GET, POST, PUT)',
    tests: [
      { name: 'GET all jobs', expect: 200, args: [`${G}/jobs`] },
      { name: 'GET one job by id', expect: 200, args: [`${G}/jobs/1`] },
      { name: 'GET jobs filtered by location', expect: 200, args: [`${G}/jobs?location=Dhaka`] },
      { name: 'GET jobs filtered by type', expect: 200, args: [`${G}/jobs?type=Internship`] },
      { name: 'GET only open jobs', expect: 200, args: [`${G}/jobs?status=open`] },
      { name: 'Route names are not case-sensitive (/JOBS still works)', expect: 200, args: [`${G}/JOBS/1`] },
      { name: 'POST create a new job (gets id 4)', expect: 201, args: ['-X', 'POST', `${G}/jobs`, '-H', J, '-d', '{"title":"Backend Engineer","company":"CloudBD","location":"Sylhet","type":"Contract","salary":70000}'] },
      { name: 'PUT update the salary of job 4', expect: 200, args: ['-X', 'PUT', `${G}/jobs/4`, '-H', J, '-d', '{"salary":80000}'] },
      { name: 'PUT close job 2 (status -> closed)', expect: 200, args: ['-X', 'PUT', `${G}/jobs/2`, '-H', J, '-d', '{"status":"closed"}'] }
    ]
  },
  {
    title: 'C. APPLICANTS ROUTE - VALID REQUESTS (GET, POST, PUT)',
    tests: [
      { name: 'GET all applicants', expect: 200, args: [`${G}/applicants`] },
      { name: 'GET one applicant by id', expect: 200, args: [`${G}/applicants/1`] },
      { name: 'GET applicants for job 1', expect: 200, args: [`${G}/applicants?jobId=1`] },
      { name: 'GET applicants by status', expect: 200, args: [`${G}/applicants?status=Shortlisted`] },
      { name: 'POST apply for job 4 (applicants service checks job 4 with the jobs service)', expect: 201, args: ['-X', 'POST', `${G}/applicants`, '-H', J, '-d', '{"name":"Nadia Islam","email":"nadia@example.com","phone":"+8801811000002","jobId":4}'] },
      { name: 'PUT shortlist applicant 3', expect: 200, args: ['-X', 'PUT', `${G}/applicants/3`, '-H', J, '-d', '{"status":"Shortlisted"}'] }
    ]
  },
  {
    title: 'D. MISSPELT OR UNKNOWN ROUTES (untrained user mistakes)',
    tests: [
      { name: 'Misspelt /job instead of /jobs (gateway suggests the right route)', expect: 404, args: [`${G}/job`] },
      { name: 'Misspelt /jbos', expect: 404, args: [`${G}/jbos`] },
      { name: 'Misspelt /aplicants', expect: 404, args: [`${G}/aplicants`] },
      { name: 'Completely unknown route', expect: 404, args: [`${G}/users`] },
      { name: 'Extra path segment after the id', expect: 404, args: [`${G}/jobs/1/details`] }
    ]
  },
  {
    title: 'E. JOBS ROUTE - INVALID REQUESTS',
    tests: [
      { name: 'GET a job that does not exist', expect: 404, args: [`${G}/jobs/999`] },
      { name: 'GET with text instead of a numeric id', expect: 400, args: [`${G}/jobs/abc`] },
      { name: 'GET with a negative id', expect: 400, args: [`${G}/jobs/-1`] },
      { name: 'GET with id 0', expect: 400, args: [`${G}/jobs/0`] },
      { name: 'POST with required fields missing', expect: 400, args: ['-X', 'POST', `${G}/jobs`, '-H', J, '-d', '{"title":"Tester"}'] },
      { name: 'POST with an invalid job type', expect: 400, args: ['-X', 'POST', `${G}/jobs`, '-H', J, '-d', '{"title":"Tester","company":"QA Ltd","location":"Dhaka","type":"Weekend"}'] },
      { name: 'POST with a negative salary', expect: 400, args: ['-X', 'POST', `${G}/jobs`, '-H', J, '-d', '{"title":"Tester","company":"QA Ltd","location":"Dhaka","type":"Full-time","salary":-500}'] },
      { name: 'POST with salary as text', expect: 400, args: ['-X', 'POST', `${G}/jobs`, '-H', J, '-d', '{"title":"Tester","company":"QA Ltd","location":"Dhaka","type":"Full-time","salary":"high"}'] },
      { name: 'POST with an unknown field', expect: 400, args: ['-X', 'POST', `${G}/jobs`, '-H', J, '-d', '{"title":"Tester","company":"QA Ltd","location":"Dhaka","type":"Full-time","bonus":100}'] },
      { name: 'POST with an empty title', expect: 400, args: ['-X', 'POST', `${G}/jobs`, '-H', J, '-d', '{"title":"   ","company":"QA Ltd","location":"Dhaka","type":"Full-time"}'] },
      { name: 'POST with broken JSON (missing closing brace)', expect: 400, args: ['-X', 'POST', `${G}/jobs`, '-H', J, '-d', '{"title":"Tester"'] },
      { name: 'POST with an empty JSON object', expect: 400, args: ['-X', 'POST', `${G}/jobs`, '-H', J, '-d', '{}'] },
      { name: 'POST without the JSON Content-Type header', expect: 415, args: ['-X', 'POST', `${G}/jobs`, '-d', 'title=Tester'] },
      { name: 'PUT a job that does not exist', expect: 404, args: ['-X', 'PUT', `${G}/jobs/999`, '-H', J, '-d', '{"salary":1000}'] },
      { name: 'PUT with an invalid status', expect: 400, args: ['-X', 'PUT', `${G}/jobs/1`, '-H', J, '-d', '{"status":"paused"}'] },
      { name: 'DELETE a job that does not exist', expect: 404, args: ['-X', 'DELETE', `${G}/jobs/999`] },
      { name: 'PATCH is not supported (wrong HTTP verb, see Allow header)', expect: 405, args: ['-i', '-X', 'PATCH', `${G}/jobs/1`, '-H', J, '-d', '{"salary":1}'] },
      { name: 'DELETE on the whole collection is not allowed', expect: 405, args: ['-X', 'DELETE', `${G}/jobs`] },
      { name: 'POST to a single job id is not allowed', expect: 405, args: ['-X', 'POST', `${G}/jobs/1`, '-H', J, '-d', '{"title":"x"}'] }
    ]
  },
  {
    title: 'F. APPLICANTS ROUTE - INVALID REQUESTS',
    tests: [
      { name: 'GET an applicant that does not exist', expect: 404, args: [`${G}/applicants/999`] },
      { name: 'GET applicants with a non-numeric jobId filter', expect: 400, args: [`${G}/applicants?jobId=abc`] },
      { name: 'POST apply for a job that does not exist', expect: 404, args: ['-X', 'POST', `${G}/applicants`, '-H', J, '-d', '{"name":"Sumi Akter","email":"sumi@example.com","jobId":999}'] },
      { name: 'POST apply for a closed job (job 3)', expect: 409, args: ['-X', 'POST', `${G}/applicants`, '-H', J, '-d', '{"name":"Sumi Akter","email":"sumi@example.com","jobId":3}'] },
      { name: 'POST apply twice for the same job with the same email', expect: 409, args: ['-X', 'POST', `${G}/applicants`, '-H', J, '-d', '{"name":"Rahim Uddin","email":"rahim@example.com","jobId":1}'] },
      { name: 'POST with an invalid email address', expect: 400, args: ['-X', 'POST', `${G}/applicants`, '-H', J, '-d', '{"name":"Sumi Akter","email":"sumi-at-mail","jobId":1}'] },
      { name: 'POST with jobId sent as text', expect: 400, args: ['-X', 'POST', `${G}/applicants`, '-H', J, '-d', '{"name":"Sumi Akter","email":"sumi@example.com","jobId":"1"}'] },
      { name: 'POST with an invalid phone number', expect: 400, args: ['-X', 'POST', `${G}/applicants`, '-H', J, '-d', '{"name":"Sumi Akter","email":"sumi@example.com","phone":"12ab","jobId":1}'] },
      { name: 'POST with every field missing', expect: 400, args: ['-X', 'POST', `${G}/applicants`, '-H', J, '-d', '{"age":22}'] },
      { name: 'PUT trying to move an application to another job', expect: 400, args: ['-X', 'PUT', `${G}/applicants/1`, '-H', J, '-d', '{"jobId":2}'] },
      { name: 'PUT with an invalid status', expect: 400, args: ['-X', 'PUT', `${G}/applicants/1`, '-H', J, '-d', '{"status":"Accepted"}'] },
      { name: 'DELETE an applicant that does not exist', expect: 404, args: ['-X', 'DELETE', `${G}/applicants/999`] },
      { name: 'PATCH is not supported on applicants', expect: 405, args: ['-X', 'PATCH', `${G}/applicants/1`] }
    ]
  },
  {
    title: 'G. WRONG ACCESS - TRYING TO BYPASS THE GATEWAY',
    tests: [
      { name: 'Direct call to the internal Jobs service port is refused', expect: 403, args: ['http://localhost:3001/jobs'] },
      { name: 'Direct call to the internal Applicants service port is refused', expect: 403, args: ['http://localhost:3002/applicants'] }
    ]
  },
  {
    title: 'H. DELETE - VALID REQUESTS',
    tests: [
      { name: 'DELETE applicant 3', expect: 200, args: ['-X', 'DELETE', `${G}/applicants/3`] },
      { name: 'GET deleted applicant 3 (now gone)', expect: 404, args: [`${G}/applicants/3`] },
      { name: 'DELETE job 4', expect: 200, args: ['-X', 'DELETE', `${G}/jobs/4`] },
      { name: 'GET deleted job 4 (now gone)', expect: 404, args: [`${G}/jobs/4`] }
    ]
  },
  {
    title: 'I. UNRESPONSIVE SERVICE (Jobs service stopped on purpose)',
    beforeNote: 'Stop the Jobs service (Ctrl+C in its terminal, or run only "npm run applicants" and "npm run gateway").',
    stopJobs: true,
    tests: [
      { name: 'GET jobs while the Jobs service is down', expect: 503, args: [`${G}/jobs`] },
      { name: 'Health check shows which service is down', expect: 503, args: [`${G}/health`] },
      { name: 'Applicants route still works on its own (services are independent)', expect: 200, args: [`${G}/applicants/1`] },
      { name: 'Applying for a job fails safely because the job cannot be checked', expect: 503, args: ['-X', 'POST', `${G}/applicants`, '-H', J, '-d', '{"name":"Sumi Akter","email":"sumi@example.com","jobId":1}'] }
    ]
  }
];

// ---- Helpers -----------------------------------------------------------------------

// Show each command the way it is typed in Windows Command Prompt (also works in bash).
function displayCommand(args) {
  const quote = (a) => (/[\s"{}&?|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
  return 'curl ' + args.map(quote).join(' ');
}

function runCurl(args) {
  const out = execFileSync('curl', ['-s', ...args, '-w', '\n__STATUS__%{http_code}'], { encoding: 'utf8' });
  const [body, status] = out.split('\n__STATUS__');
  return { body: body.trim(), status: Number(status) };
}

function pretty(body, short) {
  if (short) return body.split('\n')[0].slice(0, 80) + ' ... (HTML page of the web client)';
  // With -i the body starts with headers; keep them, pretty-print the JSON part.
  const i = body.indexOf('{');
  if (i === -1) return body;
  try {
    return body.slice(0, i) + JSON.stringify(JSON.parse(body.slice(i)), null, 2);
  } catch {
    return body;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function start(file) {
  return spawn(process.execPath, [path.join(ROOT, file)], { stdio: 'ignore' });
}

// ---- Main ----------------------------------------------------------------------------
(async () => {
  execFileSync(process.execPath, [path.join(ROOT, 'reset-data.js')], { stdio: 'ignore' });

  const jobs = start('jobs-service/server.js');
  const applicants = start('applicants-service/server.js');
  const gateway = start('gateway/gateway.js');
  await sleep(1500);

  const lines = [];
  const line = (s = '') => lines.push(s);
  let n = 0, passed = 0;

  line('='.repeat(78));
  line('JOB PORTAL - CURL TEST FILE');
  line('API Gateway: http://localhost:3000   (the ONLY port a client uses)');
  line('Routes:      /jobs  -> Jobs service        (internal)');
  line('             /applicants -> Applicants service (internal)');
  line('='.repeat(78));
  line();
  line('HOW TO RUN');
  line('  1. npm install');
  line('  2. npm run reset      (restore the starting data so ids match this file)');
  line('  3. npm start          (starts both services and the gateway)');
  line('  4. Open a second Command Prompt and run the commands below in order.');
  line('     Add -i to any command to also see the HTTP status line and headers.');
  line('     In PowerShell type curl.exe instead of curl.');
  line();
  line('Starting data: jobs 1-3 (job 3 is closed), applicants 1-2.');
  line('Every error response has the same shape:');
  line('  { "success": false, "error": { "status": <code>, "message": "...", "details": ... } }');
  line();

  for (const section of sections) {
    if (section.stopJobs) {
      jobs.kill();
      await sleep(800);
    }
    line('#'.repeat(78));
    line(section.title);
    if (section.beforeNote) line('NOTE: ' + section.beforeNote);
    line('#'.repeat(78));
    line();
    for (const t of section.tests) {
      n++;
      const r = runCurl(t.args);
      const ok = r.status === t.expect;
      if (ok) passed++;
      line(`TEST ${n}: ${t.name}`);
      line(`Command : ${displayCommand(t.args)}`);
      line(`Expected: HTTP ${t.expect}`);
      line(`Actual  : HTTP ${r.status}  ${ok ? 'PASS' : 'FAIL'}`);
      line('Response:');
      line(pretty(r.body, t.short).split('\n').map((l) => '  ' + l).join('\n'));
      line('-'.repeat(78));
      line();
    }
  }

  line('='.repeat(78));
  line(`SUMMARY: ${passed} of ${n} tests passed`);
  line('='.repeat(78));

  fs.writeFileSync(path.join(ROOT, 'curl-tests.txt'), lines.join('\n') + '\n');
  console.log(`curl-tests.txt written - ${passed}/${n} tests passed`);

  [applicants, gateway, jobs].forEach((p) => p.kill());
  execFileSync(process.execPath, [path.join(ROOT, 'reset-data.js')], { stdio: 'ignore' });
  process.exit(passed === n ? 0 : 1);
})();
