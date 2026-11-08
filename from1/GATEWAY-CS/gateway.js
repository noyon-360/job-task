
const express = require('express');

const app = express();
const PORT = 3000;

// Middleware to read JSON requests
app.use(express.json());

// Import the main router
const routes = require('./routes');

// Connect all routes
app.use('/', routes);

// Start the API Gateway
app.listen(PORT, () => {
    console.log(`API Gateway is running on http://localhost:${PORT}`);
});
