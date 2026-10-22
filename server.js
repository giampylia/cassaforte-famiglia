const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PORT = process.env.PORT ? Number(process.env.PORT) : 5173;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'cloud-db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sseClients = new Set();
let publicCloudUrl = process.env.PUBLIC_URL || null;

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading DB:', e);
  }
  return null;
}

function saveDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving DB:', e);
  }
}

function broadcastUpdate(type, payload) {
  const message = `data: ${JSON.stringify({
    type,
    payload,
    publicUrl: publicCloudUrl,
    timestamp: new Date().toISOString(),
  })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(message);
    } catch {
      sseClients.delete(res);
    }
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const parsedUrl = (req.url || '/').split('?')[0];

  if (parsedUrl === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(
      `data: ${JSON.stringify({
        type: 'CONNECTED',
        connectedClients: sseClients.size + 1,
        publicUrl: publicCloudUrl,
      })}\n\n`
    );
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (parsedUrl === '/api/state' && req.method === 'GET') {
    const db = loadDb();
    sendJson(res, 200, {
      ok: true,
      db,
      publicUrl: publicCloudUrl,
      connectedDevices: sseClients.size,
      serverTime: new Date().toISOString(),
    });
    return;
  }

  if (parsedUrl === '/api/state' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (body && body.db) {
        saveDb(body.db);
        broadcastUpdate('STATE_SYNC', {
          db: body.db,
          eventLabel: body.eventLabel || null,
        });
      }
      sendJson(res, 200, {
        ok: true,
        publicUrl: publicCloudUrl,
        connectedDevices: sseClients.size,
      });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
    }
    return;
  }

  let filePath = path.join(PUBLIC_DIR, parsedUrl === '/' ? 'index.html' : parsedUrl);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    });
  });
});

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function startCloudflareTunnel() {
  const cfPath = path.join(__dirname, 'cloudflared');
  if (!fs.existsSync(cfPath)) return;

  try {
    const child = spawn(cfPath, ['tunnel', '--url', `http://localhost:${PORT}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const extractUrl = (chunk) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && match[0] && match[0] !== publicCloudUrl) {
        publicCloudUrl = match[0];
        console.log('============================================================');
        console.log(`  🌍 LINK PUBBLICO CLOUD (4G/5G OVUNQUE): ${publicCloudUrl}`);
        console.log('============================================================\n');
        broadcastUpdate('PUBLIC_URL', { publicUrl: publicCloudUrl });
      }
    };

    child.stdout.on('data', extractUrl);
    child.stderr.on('data', extractUrl);
  } catch (e) {
    console.error('Could not start cloudflared tunnel:', e.message);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log('\n============================================================');
  console.log('  🎓 QUARTimbra Cloud & Real-Time Server — QU3 Quartu S. Elena');
  console.log('============================================================');
  console.log(`  ▶ Ufficio / Computer:   http://localhost:${PORT}`);
  console.log(`  ▶ Rete Wi-Fi Locale:    http://${ip}:${PORT}`);
  console.log('============================================================\n');
  startCloudflareTunnel();
});
