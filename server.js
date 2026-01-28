// Minimal Spotify proxy for frontend
// Uses Node >=18 (global fetch)
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, 'build');
const app = express();

// Allow JSON bodies for non-GET methods
app.use(express.json({ limit: '1mb' }));

// Serve static files from the build directory
app.use(express.static(buildDir));

// CORS: allow GH Pages and local dev; can override via ALLOWED_ORIGINS
const defaultOrigins = [
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://127.0.0.1'
];
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
const origins = ALLOWED.length ? ALLOWED : defaultOrigins;

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow same-origin/non-browser
    if (origins.includes(origin) || origin.endsWith('.github.io')) return cb(null, true);
    return cb(null, true); // loosen for now; tighten by removing this line
  },
  credentials: false
}));

app.use(morgan('tiny'));

app.get('/health', (_, res) => res.json({ ok: true }));

// Proxy any Spotify API request: /api/spotify/<path>
app.all('/api/spotify/*', async (req, res) => {
  try {
    const spPath = req.params[0] || '';
    const url = `https://api.spotify.com/v1/${spPath}`;

    // Forward Authorization header if present
    const headers = new Headers();
    if (req.headers.authorization) headers.set('authorization', req.headers.authorization);
    headers.set('content-type', 'application/json');

    const fetchOptions = {
      method: req.method,
      headers
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : undefined;
    }

    const r = await fetch(url, fetchOptions);
    const contentType = r.headers.get('content-type') || '';
    res.status(r.status);
    if (contentType.includes('application/json')) {
      const data = await r.json();
      res.json(data);
    } else {
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('content-type', contentType);
      res.send(buf);
    }
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error', message: err?.message || String(err) });
  }
});

// Serve index.html for SPA routing (must be after API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Proxy listening on ${PORT}`));