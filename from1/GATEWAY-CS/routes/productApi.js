
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DB_FILE = path.join(__dirname, '..', 'data', 'products.json');

// Read products from the JSON file
function readData() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Save products to the JSON file
function writeData(data) {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(data, null, 2),
        'utf8'
    );
}

// GET - Retrieve all products
router.get('/products', (req, res) => {
    const data = readData();
    res.json(data);
});

// GET - Retrieve one product by ID
router.get('/products/:id', (req, res) => {
    const data = readData();

    const product = data.find(
        p => p.id === parseInt(req.params.id)
    );

    if (product) {
        res.json(product);
    } else {
        res.status(404).json({
            message: 'Product not found'
        });
    }
});

// POST - Add a new product
router.post('/products', (req, res) => {
    const data = readData();

    const newProduct = {
        id: data.length
            ? Math.max(...data.map(p => p.id)) + 1
            : 1,
        desc: req.body.desc,
        price: req.body.price
    };

    data.push(newProduct);
    writeData(data);

    res.status(201).json(newProduct);
});

// PUT - Update an existing product
router.put('/products/:id', (req, res) => {
    const data = readData();

    const index = data.findIndex(
        p => p.id === parseInt(req.params.id)
    );

    if (index !== -1) {
        data[index] = {
            ...data[index],
            ...req.body,
            id: data[index].id
        };

        writeData(data);
        res.json(data[index]);
    } else {
        res.status(404).json({
            message: 'Product not found'
        });
    }
});

// DELETE - Remove a product
router.delete('/products/:id', (req, res) => {
    const data = readData();

    const index = data.findIndex(
        p => p.id === parseInt(req.params.id)
    );

    if (index !== -1) {
        const deletedProduct = data.splice(index, 1);

        writeData(data);
        res.json(deletedProduct);
    } else {
        res.status(404).json({
            message: 'Product not found'
        });
    }
});

module.exports = router;
