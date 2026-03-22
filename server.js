const express = require('express');
const fs = require('fs');
const WebSocket = require('ws');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

app.get('/api/characters', (req, res) => {
    fs.readFile('data/characters.json', 'utf8', (err, data) => {
        if (err) return res.status(500).send(err);
        res.send(JSON.parse(data));
    });
});

app.put('/api/characters', (req, res) => {
    fs.writeFile('data/characters.json', JSON.stringify(req.body), (err) => {
        if (err) return res.status(500).send(err);
        res.sendStatus(204);
    });
});

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
        // Add your logic to handle incoming messages here
    });

    // Broadcast function
    const broadcast = (data) => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    };

    // Example placeholders for character updates
    ws.on('characters:update', (data) => broadcast({ type: 'characters:update', data }));
    ws.on('characters:state', (data) => broadcast({ type: 'characters:state', data }));
    ws.on('combat:update', (data) => broadcast({ type: 'combat:update', data }));
    ws.on('combat:state', (data) => broadcast({ type: 'combat:state', data }));
});
