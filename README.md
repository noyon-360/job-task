# Job Portal: API Gateway with two microservices

A Node.js web client-server application. Every request goes through one **API Gateway**, which forwards it to one of two internal services. Each service stores its data in a **JSON file** used as a NoSQL database.

```
Client (browser / curl)
        |
        v
API Gateway  :3000  (public, the only port clients use)
   |-- /jobs        -> Jobs service        :3001 (internal) -> jobs.json
   `-- /applicants  -> Applicants service  :3002 (internal) -> applicants.json
                              |
                              `-- checks the job exists and is open by calling the Jobs service
```

## Run it
```bash
npm install
npm start          # starts the Jobs service, the Applicants service and the gateway
```
Open **http://localhost:3000** in a browser for the web client.

To run each part in its own terminal instead:
```bash
npm run jobs
npm run applicants
npm run gateway
```

## Routes (all on port 3000)
| Method | Route | Description |
|---|---|---|
| GET | /jobs | All jobs (filters: `?location=`, `?type=`, `?status=`) |
| GET | /jobs/:id | One job |
| POST | /jobs | Create a job |
| PUT | /jobs/:id | Update a job |
| DELETE | /jobs/:id | Delete a job |
| GET | /applicants | All applicants (filters: `?jobId=`, `?status=`) |
| GET | /applicants/:id | One applicant |
| POST | /applicants | Apply for a job |
| PUT | /applicants/:id | Update an applicant (for example, status) |
| DELETE | /applicants/:id | Delete an applicant |
| GET | /api | List of routes |
| GET | /health | Status of each service |

## How the ports are masked
- The services listen on `127.0.0.1` only, so they can't be reached from another machine.
- The gateway adds a secret `x-gateway-key` header to every forwarded request. A service returns **403** to any request without it, so even on the same machine the services can't be called directly.

## Tests
- `curl-tests.txt` has 65 curl tests with the expected and actual results.
- `npm test` runs them all again and regenerates the file. It starts and stops the services itself, so stop `npm start` first.
- `npm run reset` restores the starting data in both JSON files.

## Status codes used
200 OK · 201 Created · 400 Bad request/validation · 403 Direct access refused · 404 Not found · 405 Method not allowed · 409 Conflict (closed job / duplicate application) · 413 Body too large · 415 Not JSON · 503 Service down · 504 Service timeout

## Project structure
```
job-portal/
├── gateway/gateway.js            API Gateway (port 3000)
├── jobs-service/server.js        Jobs microservice (port 3001)
├── jobs-service/jobs.json        Jobs database
├── applicants-service/server.js  Applicants microservice (port 3002)
├── applicants-service/applicants.json
├── shared/jsonDb.js              JSON-file NoSQL helper (safe, queued writes)
├── shared/http.js                Shared error handling and validation helpers
├── public/index.html             Web client
├── config.js                     Ports and gateway key
├── start-all.js                  Starts everything with one command
├── reset-data.js                 Restores the starting data
├── tests/run-curl-tests.js       Runs the curl tests and writes curl-tests.txt
└── curl-tests.txt                The curl test file for submission
```
