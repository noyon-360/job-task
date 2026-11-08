const express = require('express');
const router = express.Router();

// Import the Product API
const productApi = require('./productApi');

// Connect the Product API routes
router.use('/api', productApi);

module.exports = router;
