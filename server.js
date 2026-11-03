const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { spawn } = require('child_process');

const PORT = process.env.PORT ? Number(process.env.PORT) : 5173;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'cloud-db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sseClients = new Set();
let publicCloudUrl = process.env.PUBLIC_URL || 'https://qu3.onrender.com';

// Memory cache for static files (raw + gzipped) for sub-millisecond response times
const staticCache = new Map();

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

const COMPRESSIBLE_EXTS = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg']);

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
    if (db && Array.isArray(db.profiles)) {
      const has7726 = db.profiles.some(
        (p) => p && (String(p.member_number).trim() === '7726' || p.is_super_admin)
      );
      if (!has7726) {
        db.profiles.unshift({
          id: 'admin-7726',
          member_number: '7726',
          first_name: 'Giampiero',
          last_name: 'Pilia',
          full_name: 'Giampiero Pilia',
          sede: 'Quartu',
          role: 'admin',
          is_super_admin: true,
          is_cd: true,
          roles: ['Amministratore'],
          phone: '070 881234',
          joined_year: 2018,
        });
      } else {
        db.profiles = db.profiles.map((p) => {
          if (
            p &&
            (String(p.member_number).trim() === '7726' ||
              String(p.member_number).trim() === '7796' ||
              p.is_super_admin)
          ) {
            return {
              ...p,
              id: p.id && p.id !== 'admin-7796' ? p.id : 'admin-7726',
              member_number: String(p.member_number).trim() === '7796' ? '7726' : p.member_number || '7726',
              first_name: p.first_name || 'Giampiero',
              last_name: p.last_name || 'Pilia',
              full_name:
                !p.full_name || String(p.full_name).toLowerCase().startsWith('socio tessera')
                  ? 'Giampiero Pilia'
                  : p.full_name,
              role: 'admin',
              is_super_admin: true,
              is_cd: true,
              roles: Array.from(
                new Set(['Amministratore', ...((p.roles || []).filter((r) => r !== 'Socio'))])
              ),
            };
          }
          return p;
        });
      }
    }
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
        const existingDb = loadDb();
        const incomingDb = { ...body.db };

        if (existingDb) {
          // Protezione Anagrafica Soci e Ruoli: non sovrascrivere mai con dati più vecchi o demo (profilesUpdatedAt minore)
          const existingProfTs = Number(existingDb.profilesUpdatedAt || 0);
          const incomingProfTs = Number(incomingDb.profilesUpdatedAt || 0);
          if (existingProfTs > incomingProfTs && Array.isArray(existingDb.profiles)) {
            incomingDb.profiles = existingDb.profiles;
            incomingDb.availableRoles = existingDb.availableRoles || incomingDb.availableRoles;
            incomingDb.profilesUpdatedAt = existingProfTs;
          }

          // Protezione Piccola Cassa: non sovrascrivere mai con dati più vecchi
          const existingCashTs = Number(existingDb.cashUpdatedAt || 0);
          const incomingCashTs = Number(incomingDb.cashUpdatedAt || 0);
          if (existingCashTs > incomingCashTs && Array.isArray(existingDb.cashMovements)) {
            incomingDb.cashMovements = existingDb.cashMovements;
            incomingDb.expenseCategories = existingDb.expenseCategories || incomingDb.expenseCategories;
            incomingDb.cashOpeningBalance =
              typeof existingDb.cashOpeningBalance === 'number'
                ? existingDb.cashOpeningBalance
                : incomingDb.cashOpeningBalance;
            incomingDb.cashUpdatedAt = existingCashTs;
          }

          // Protezione Orario Lezioni: non sovrascrivere mai con dati più vecchi
          const existingLessonsTs = Number(existingDb.lessonsUpdatedAt || 0);
          const incomingLessonsTs = Number(incomingDb.lessonsUpdatedAt || 0);
          if (existingLessonsTs > incomingLessonsTs && Array.isArray(existingDb.lessons)) {
            incomingDb.lessons = existingDb.lessons;
            incomingDb.lessonsUpdatedAt = existingLessonsTs;
          }

          // Protezione Eliminacode: non sovrascrivere mai con dati più vecchi
          const existingQueueTs = Number(existingDb.queueState?.updatedAt || 0);
          const incomingQueueTs = Number(incomingDb.queueState?.updatedAt || 0);
          if (existingQueueTs > incomingQueueTs && existingDb.queueState) {
            incomingDb.queueState = existingDb.queueState;
          }
        }

        // Garantisce che 7726 Giampiero Pilia non venga MAI cancellato dal database del server
        if (Array.isArray(incomingDb.profiles)) {
          const hasSuper = incomingDb.profiles.some(
            (p) =>
              p &&
              (String(p.member_number).trim() === '7726' ||
                String(p.member_number).trim() === '7796' ||
                p.is_super_admin)
          );
          if (!hasSuper) {
            incomingDb.profiles.unshift({
              id: 'admin-7726',
              member_number: '7726',
              first_name: 'Giampiero',
              last_name: 'Pilia',
              full_name: 'Giampiero Pilia',
              sede: 'Quartu',
              role: 'admin',
              is_super_admin: true,
              is_cd: true,
              roles: ['Amministratore'],
              phone: '070 881234',
              joined_year: 2018,
            });
          } else {
            incomingDb.profiles = incomingDb.profiles.map((p) => {
              if (
                p &&
                (String(p.member_number).trim() === '7726' ||
                  String(p.member_number).trim() === '7796' ||
                  p.is_super_admin)
              ) {
                return {
                  ...p,
                  id: p.id && p.id !== 'admin-7796' ? p.id : 'admin-7726',
                  member_number:
                    String(p.member_number).trim() === '7796' ? '7726' : p.member_number || '7726',
                  first_name: p.first_name || 'Giampiero',
                  last_name: p.last_name || 'Pilia',
                  full_name:
                    !p.full_name || String(p.full_name).toLowerCase().startsWith('socio tessera')
                      ? 'Giampiero Pilia'
                      : p.full_name,
                  role: 'admin',
                  is_super_admin: true,
                  is_cd: true,
                  roles: Array.from(
                    new Set(['Amministratore', ...((p.roles || []).filter((r) => r !== 'Socio'))])
                  ),
                };
              }
              return p;
            });
          }
        }

        saveDb(incomingDb);
        broadcastUpdate('STATE_SYNC', {
          db: incomingDb,
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

  // Endpoint ultra-veloce dedicato per il telecomando Eliminacode -> Monitor Sala d'Attesa
  if (parsedUrl === '/api/queue' && req.method === 'GET') {
    const existingDb = loadDb() || {};
    sendJson(res, 200, {
      ok: true,
      queueState: existingDb.queueState || null,
      connectedDevices: sseClients.size,
    });
    return;
  }

  if (parsedUrl === '/api/queue' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (body && body.queueState) {
        const existingDb = loadDb() || {};
        existingDb.queueState = body.queueState;
        existingDb.updatedAt = new Date().toISOString();
        saveDb(existingDb);
        broadcastUpdate('QUEUE_SYNC', {
          queueState: body.queueState,
        });
      }
      sendJson(res, 200, {
        ok: true,
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
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const canGzip = COMPRESSIBLE_EXTS.has(ext) && acceptEncoding.includes('gzip');

    const cacheControl =
      ext === '.html' || ext === '.webmanifest'
        ? 'no-cache'
        : 'public, max-age=86400, stale-while-revalidate=604800';

    const cached = staticCache.get(filePath);
    if (cached && stats && cached.mtimeMs === stats.mtimeMs) {
      if (canGzip && cached.gzipped) {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Encoding': 'gzip',
          'Cache-Control': cacheControl,
        });
        res.end(cached.gzipped);
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      });
      res.end(cached.raw);
      return;
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }
      const mtimeMs = stats ? stats.mtimeMs : Date.now();
      if (COMPRESSIBLE_EXTS.has(ext)) {
        zlib.gzip(content, (gzErr, gzipped) => {
          staticCache.set(filePath, { mtimeMs, raw: content, gzipped: gzErr ? null : gzipped });
          if (canGzip && !gzErr) {
            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Encoding': 'gzip',
              'Cache-Control': cacheControl,
            });
            res.end(gzipped);
          } else {
            res.writeHead(200, {
              'Content-Type': contentType,
              'Cache-Control': cacheControl,
            });
            res.end(content);
          }
        });
      } else {
        staticCache.set(filePath, { mtimeMs, raw: content, gzipped: null });
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
        });
        res.end(content);
      }
    });
  });
});

// Keep-alive self-ping every 10 minutes so Render never puts the server into cold-start sleep
setInterval(() => {
  try {
    https.get('https://qu3.onrender.com/api/state', (res) => {
      res.resume();
    }).on('error', () => {});
  } catch {}
}, 10 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Q3 Cloud Server active on port ${PORT}`);
});
