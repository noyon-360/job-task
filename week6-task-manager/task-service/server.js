// TASK SERVICE (Port 3002)
// Manages tasks / to-do items.
// Database: data/tasks.json (a JSON No-SQL database read and written with "fs")

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3002;

const DB_FILE = path.join(__dirname, 'data', 'tasks.json');

app.use(express.json());

// Read all tasks from the JSON file
function readData() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Save all tasks to the JSON file
function writeData(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// GET - Read and return all tasks
// Optional filter: /tasks?completed=true
app.get('/tasks', (req, res) => {
    let tasks = readData();

    if (req.query.completed !== undefined) {
        const wanted = req.query.completed === 'true';
        tasks = tasks.filter(t => t.completed === wanted);
    }

    res.json(tasks);
});

// GET - Read one task by id
app.get('/tasks/:id', (req, res) => {
    const tasks = readData();
    const task = tasks.find(t => t.id === parseInt(req.params.id));

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
});

// POST - Add a new task to the JSON file
app.post('/tasks', (req, res) => {
    if (!req.body || !req.body.title) {
        return res.status(400).json({ error: 'A task must have a title' });
    }

    const tasks = readData();

    const newTask = {
        id: tasks.length ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
        title: req.body.title,
        description: req.body.description || '',
        userId: req.body.userId || null,
        completed: false
    };

    tasks.push(newTask);
    writeData(tasks);

    res.status(201).json(newTask);
});

// PUT - Update an existing task (e.g. mark it as complete)
app.put('/tasks/:id', (req, res) => {
    const tasks = readData();
    const index = tasks.findIndex(t => t.id === parseInt(req.params.id));

    if (index === -1) {
        return res.status(404).json({ error: 'Task not found' });
    }

    tasks[index] = {
        ...tasks[index],
        ...req.body,
        id: tasks[index].id // the id can never be changed
    };

    writeData(tasks);
    res.json(tasks[index]);
});

// DELETE - Remove a task from the JSON file
app.delete('/tasks/:id', (req, res) => {
    const tasks = readData();
    const index = tasks.findIndex(t => t.id === parseInt(req.params.id));

    if (index === -1) {
        return res.status(404).json({ error: 'Task not found' });
    }

    const deleted = tasks.splice(index, 1)[0];
    writeData(tasks);

    res.json({ message: 'Task deleted', task: deleted });
});

app.listen(PORT, () => {
    console.log(`Task Service running on port ${PORT}`);
});
