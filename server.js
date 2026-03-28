'use strict';

const express   = require('express');
const fs        = require('fs');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Data file setup ──────────────────────────────────────────────── */

const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'appdata.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '{}', 'utf8');
}

/* ── Middleware ───────────────────────────────────────────────────── */

app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: '10mb' }));

/* ── Rate limiter (120 requests / minute per IP) ─────────────────── */

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max:      120,
    standardHeaders: true,
    legacyHeaders:   false
});

/* ── API routes ───────────────────────────────────────────────────── */

// Return all persisted app data
app.get('/api/data', apiLimiter, (req, res) => {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        res.json(JSON.parse(raw || '{}'));
    } catch (e) {
        console.error('[server] GET /api/data failed', e);
        res.status(500).json({ error: 'Could not read data file' });
    }
});

// Persist all app data sent by the client
app.post('/api/data', apiLimiter, (req, res) => {
    fs.writeFile(DATA_FILE, JSON.stringify(req.body), 'utf8', (err) => {
        if (err) {
            console.error('[server] POST /api/data failed', err);
            return res.status(500).json({ error: 'Could not write data file' });
        }
        res.sendStatus(204);
    });
});

/* ── Health check ─────────────────────────────────────────────────── */

// Lightweight endpoint used by the CI smoke test and container health checks.
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

/* ── Start ────────────────────────────────────────────────────────── */

app.listen(PORT, () => {
    console.log(`Godbound Toolkit server running on http://localhost:${PORT}`);
});
