
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;

const routes = require('./routes');

app.use(express.json());

app.use('/', routes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
