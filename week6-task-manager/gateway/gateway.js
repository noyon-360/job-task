// API GATEWAY (Port 3000)
// The single entry point for the client.
//   /users  -> User Service (port 3001)
//   /tasks  -> Task Service (port 3002)
// Every HTTP method (GET, POST, PUT, DELETE) and the request body
// are forwarded to the right service, and the service's answer is sent back.

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Service registry: which path goes to which microservice
const services = {
    users: 'http://localhost:3001',
    tasks: 'http://localhost:3002'
};

app.use(express.json());

// Log every request that reaches the gateway
app.use((req, res, next) => {
    console.log(`[gateway] ${req.method} ${req.originalUrl}`);
    next();
});

// Forward the request to a microservice and return its response
async function forward(req, res, serviceName) {
    const url = services[serviceName] + req.originalUrl;

    try {
        const response = await axios({
            method: req.method,
            url: url,
            data: req.body,
            // Do not throw on 4xx/5xx - pass the service's own error back to the client
            validateStatus: () => true
        });

        res.status(response.status).json(response.data);
    } catch (error) {
        // The service is not running or did not answer
        console.log(`[gateway] ${serviceName} service error:`, error.message);
        res.status(503).json({
            error: `The ${serviceName} service is unavailable. Please try again later.`
        });
    }
}

// Routes
app.use('/users', (req, res) => forward(req, res, 'users'));
app.use('/tasks', (req, res) => forward(req, res, 'tasks'));

// Home route - shows what the gateway offers
app.get('/', (req, res) => {
    res.json({
        message: 'Task Management System - API Gateway',
        routes: ['/users', '/users/:id', '/tasks', '/tasks/:id']
    });
});

// Unknown or misspelt route (e.g. /tassks)
app.use((req, res) => {
    res.status(404).json({
        error: `Route ${req.method} ${req.originalUrl} not found on the API Gateway`,
        availableRoutes: ['/users', '/users/:id', '/tasks', '/tasks/:id']
    });
});

// Bad JSON in the request body
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    console.log('[gateway] error:', err.message);
    res.status(500).json({ error: 'Internal gateway error' });
});

app.listen(PORT, () => {
    console.log(`API Gateway is running on http://localhost:${PORT}`);
});
