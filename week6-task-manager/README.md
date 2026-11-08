# Task Management System — Week 6 Lab (CMS3407)

An API Gateway that routes traffic to two microservices, each with its own JSON No-SQL database.

| Part | Port | Job |
|---|---|---|
| API Gateway | 3000 | Single entry point. `/users` → User Service, `/tasks` → Task Service. Forwards GET/POST/PUT/DELETE and the body. |
| User Service | 3001 | User profiles, stored in `user-service/data/users.json` |
| Task Service | 3002 | Tasks / to-dos, stored in `task-service/data/tasks.json` |

## Folder structure

```
week6-task-manager/
├── package.json          "start" script runs everything
├── start.js              loads the two services + the gateway
├── gateway/gateway.js    API Gateway (port 3000)
├── user-service/
│   ├── server.js         User Service (port 3001)
│   └── data/users.json
├── task-service/
│   ├── server.js         Task Service (port 3002) - full CRUD
│   └── data/tasks.json   JSON No-SQL database
├── curl_tests.txt        Phase 3 test suite
└── diagrams/
    ├── architecture.svg / .png         Task 1.1
    └── sequence-post-task.svg / .png   Task 1.2
```

## Run it

```bash
npm install
npm start
```

Then open http://localhost:3000/tasks or run the commands in `curl_tests.txt`.

To run each part in its own terminal instead (useful for the "service down" test):

```bash
npm run users     # terminal 1
npm run tasks     # terminal 2
npm run gateway   # terminal 3
```

## Endpoints (all through the gateway, port 3000)

| Method | Path | What it does |
|---|---|---|
| GET | `/tasks` | All tasks (`?completed=true` to filter) |
| GET | `/tasks/:id` | One task |
| POST | `/tasks` | Add a task — body `{ "title": "...", "description": "...", "userId": 1 }` |
| PUT | `/tasks/:id` | Update a task — e.g. `{ "completed": true }` |
| DELETE | `/tasks/:id` | Remove a task |
| GET / POST | `/users` | List / create users (`{ "name": "...", "email": "..." }`) |
| GET / PUT / DELETE | `/users/:id` | One user |

## Error handling

| Situation | Response |
|---|---|
| Misspelt route, e.g. `/tassks` | 404 from the gateway, with the list of real routes |
| Task / user id that doesn't exist | 404 from the service |
| POST task without a title | 400 |
| Broken JSON body | 400 from the gateway |
| A service is not running | 503 from the gateway (it does not crash) |

## Deployment (Phase 4)

`package.json` has a `"start"` script and the gateway listens on `process.env.PORT`,
so a host can run the whole system with `npm start`. Only the gateway is public;
the two services stay on localhost inside the same machine.

To deploy: push this folder to GitHub, create a new Node.js web service on your
host from that repo, use `npm install` as the build command and `npm start` as the
start command, then run `curl_tests.txt` against the live URL and take screenshots.
