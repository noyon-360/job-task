// USER SERVICE (Port 3001)
// Manages user profiles.
// Database: data/users.json (a JSON No-SQL database read and written with "fs")

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

const DB_FILE = path.join(__dirname, 'data', 'users.json');

app.use(express.json());

function readData() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeData(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET - All users
app.get('/users', (req, res) => {
    res.json(readData());
});

// GET - One user by id
app.get('/users/:id', (req, res) => {
    const user = readData().find(u => u.id === parseInt(req.params.id));

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
});

// POST - Create a user profile
app.post('/users', (req, res) => {
    if (!req.body || !req.body.name || !req.body.email) {
        return res.status(400).json({ error: 'A user must have a name and an email' });
    }

    const users = readData();

    const newUser = {
        id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
        name: req.body.name,
        email: req.body.email
    };

    users.push(newUser);
    writeData(users);

    res.status(201).json(newUser);
});

// PUT - Update a user profile
app.put('/users/:id', (req, res) => {
    const users = readData();
    const index = users.findIndex(u => u.id === parseInt(req.params.id));

    if (index === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    users[index] = { ...users[index], ...req.body, id: users[index].id };
    writeData(users);

    res.json(users[index]);
});

// DELETE - Remove a user profile
app.delete('/users/:id', (req, res) => {
    const users = readData();
    const index = users.findIndex(u => u.id === parseInt(req.params.id));

    if (index === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    const deleted = users.splice(index, 1)[0];
    writeData(users);

    res.json({ message: 'User deleted', user: deleted });
});

app.listen(PORT, () => {
    console.log(`User Service running on port ${PORT}`);
});
