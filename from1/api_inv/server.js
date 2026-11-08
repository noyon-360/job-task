
const express = require('express');

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/api_inv', (req, res) => {
    console.log('Request received by api_inv');
    res.send('Hello from api_inv microservice');
});

app.get('/api_inv_2', (req, res) => {
    console.log('Request received by api_inv_2');
    res.send('Hello from api_inv_2 microservice');
});

app.get('/api_inv_3', (req, res) => {
    console.log('Request received by api_inv_3');
    res.send('Hello from api_inv_3 microservice');
});

app.listen(PORT, () => {
    console.log(`api_inv server running on port ${PORT}`);
});