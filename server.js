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
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads', 'avvisi');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
    const chunks = [];
    let totalBytes = 0;
    req.on('data', (chunk) => {
      chunks.push(chunk);
      totalBytes += chunk.length;
      if (totalBytes > 25 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sanitizeServerProfiles(profiles) {
  if (!Array.isArray(profiles)) return profiles;
  let foundSuper = false;
  let found9999 = false;
  let found9998 = false;

  const cleaned = profiles.map((p) => {
    if (!p) return p;
    const num = String(p.member_number || '').trim();
    if (num === '7726' || num === '7796' || p.is_super_admin) {
      foundSuper = true;
      const cleanSuperRoles = Array.from(
        new Set(['Amministratore', ...((p.roles || []).filter((r) => r !== 'Socio' && r !== 'CD'))])
      );
      return {
        ...p,
        id: p.id && p.id !== 'admin-7796' ? p.id : 'admin-7726',
        member_number: '7726',
        first_name: 'Giampiero',
        last_name: 'Pilia',
        full_name: 'Giampiero Pilia',
        sede: p.sede || 'Quartu',
        role: 'admin',
        is_super_admin: true,
        is_cd: typeof p.is_cd === 'boolean' ? p.is_cd : true,
        roles: cleanSuperRoles,
      };
    }
    if (num === '9999' || p.id === 'segreteria-9999') {
      found9999 = true;
      return {
        ...p,
        id: p.id || 'segreteria-9999',
        member_number: '9999',
        first_name: 'Nives',
        last_name: 'Cocco',
        full_name: 'Nives Cocco',
        sede: p.sede || 'Quartu',
        role: 'member',
        is_super_admin: false,
        is_cd: false,
        roles: ['Segreteria'],
      };
    }
    if (num === '9998' || p.id === 'segreteria-9998') {
      found9998 = true;
      return {
        ...p,
        id: p.id || 'segreteria-9998',
        member_number: '9998',
        first_name: 'Josh Ronald',
        last_name: 'Cocco',
        full_name: 'Josh Ronald Cocco',
        sede: p.sede || 'Quartu',
        role: 'member',
        is_super_admin: false,
        is_cd: false,
        roles: ['Segreteria'],
      };
    }
    const is_cd = typeof p.is_cd === 'boolean' ? p.is_cd : Boolean(Array.isArray(p.roles) && p.roles.includes('CD'));
    const cleanRoles = Array.isArray(p.roles) ? p.roles.filter((r) => r !== 'CD') : ['Socio'];
    return {
      ...p,
      is_cd,
      roles: cleanRoles.length > 0 ? cleanRoles : ['Socio'],
    };
  });

  if (!foundSuper) {
    cleaned.unshift({
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
  }

  if (!found9999) {
    cleaned.push({
      id: 'segreteria-9999',
      member_number: '9999',
      first_name: 'Nives',
      last_name: 'Cocco',
      full_name: 'Nives Cocco',
      sede: 'Quartu',
      role: 'member',
      is_super_admin: false,
      is_cd: false,
      roles: ['Segreteria'],
      joined_year: 2024,
    });
  }

  if (!found9998) {
    cleaned.push({
      id: 'segreteria-9998',
      member_number: '9998',
      first_name: 'Josh Ronald',
      last_name: 'Cocco',
      full_name: 'Josh Ronald Cocco',
      sede: 'Quartu',
      role: 'member',
      is_super_admin: false,
      is_cd: false,
      roles: ['Segreteria'],
      joined_year: 2024,
    });
  }

  return cleaned;
}

function sanitizeServerQueueState(queueState, profiles) {
  if (!queueState || !Array.isArray(queueState.items)) return queueState;
  const validProfiles = Array.isArray(profiles) ? profiles : [];
  const items = queueState.items.map((item) => {
    if (!item || typeof item.number !== 'number') return item;
    let rawName = String(item.name || '').trim();
    if (/0801021400/i.test(rawName)) {
      return { ...item, name: 'Giampiero Pilia', cardNumber: '7726' };
    }
    const cardCandidate = item.cardNumber ? String(item.cardNumber).trim() : '';
    if (cardCandidate === '7726' || cardCandidate === '7796' || rawName === '7726') {
      return { ...item, name: 'Giampiero Pilia', cardNumber: '7726' };
    }
    if (
      cardCandidate &&
      (!rawName || /^socio\s+sconosciuto$/i.test(rawName)) &&
      validProfiles.length > 0
    ) {
      const match = validProfiles.find(
        (p) =>
          p &&
          p.member_number &&
          (String(p.member_number).trim().toLowerCase() === cardCandidate.toLowerCase() ||
            (/^\d+$/.test(String(p.member_number).trim()) &&
              /^\d+$/.test(cardCandidate) &&
              parseInt(String(p.member_number).trim(), 10) === parseInt(cardCandidate, 10)))
      );
      if (match && match.full_name) {
        return { ...item, name: match.full_name };
      }
    }
    return item;
  });
  return { ...queueState, items };
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
    if (db) {
      if (Array.isArray(db.profiles)) {
        db.profiles = sanitizeServerProfiles(db.profiles);
      }
      if (db.queueState) {
        db.queueState = sanitizeServerQueueState(db.queueState, db.profiles);
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
          // Protezione Anagrafica Soci e Ruoli: non sovrascrivere mai con dati più vecchi o con i 20 soci demo
          const existingProfTs = Number(existingDb.profilesUpdatedAt || 0);
          const incomingProfTs = Number(incomingDb.profilesUpdatedAt || 0);
          const existingCount = Array.isArray(existingDb.profiles) ? existingDb.profiles.length : 0;
          const incomingCount = Array.isArray(incomingDb.profiles) ? incomingDb.profiles.length : 0;
          const incomingLooksDefault = incomingCount <= 20 && existingCount > 20;

          if (
            Array.isArray(existingDb.profiles) &&
            (existingProfTs > incomingProfTs || incomingLooksDefault || !Array.isArray(incomingDb.profiles))
          ) {
            incomingDb.profiles = existingDb.profiles;
            incomingDb.availableRoles = existingDb.availableRoles || incomingDb.availableRoles;
            incomingDb.profilesUpdatedAt = Math.max(existingProfTs, incomingProfTs);
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

          // Protezione Avvisi Video: non sovrascrivere mai con dati più vecchi
          const existingVnTs = Number(existingDb.videoNoticesUpdatedAt || 0);
          const incomingVnTs = Number(incomingDb.videoNoticesUpdatedAt || 0);
          if (existingVnTs > incomingVnTs && Array.isArray(existingDb.videoNotices)) {
            incomingDb.videoNotices = existingDb.videoNotices;
            incomingDb.videoNoticesUpdatedAt = existingVnTs;
          }

          // Protezione Biblioteca Libri: non sovrascrivere mai con dati più vecchi
          const existingLbTs = Number(existingDb.libraryBooksUpdatedAt || 0);
          const incomingLbTs = Number(incomingDb.libraryBooksUpdatedAt || 0);
          if (existingLbTs > incomingLbTs && Array.isArray(existingDb.libraryBooks)) {
            incomingDb.libraryBooks = existingDb.libraryBooks;
            incomingDb.libraryBooksUpdatedAt = existingLbTs;
          }

          // Protezione Eliminacode: non sovrascrivere mai con dati più vecchi
          const existingQueueTs = Number((existingDb.queueState && existingDb.queueState.updatedAt) || 0);
          const incomingQueueTs = Number((incomingDb.queueState && incomingDb.queueState.updatedAt) || 0);
          if (existingQueueTs > incomingQueueTs && existingDb.queueState) {
            incomingDb.queueState = existingDb.queueState;
          }
        }

        if (Array.isArray(incomingDb.profiles)) {
          incomingDb.profiles = sanitizeServerProfiles(incomingDb.profiles);
        }
        if (incomingDb.queueState) {
          incomingDb.queueState = sanitizeServerQueueState(incomingDb.queueState, incomingDb.profiles);
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

  // Endpoint dedicato per il salvataggio immediato e indistruttibile dell'Anagrafica Soci
  if (parsedUrl === '/api/profiles' && req.method === 'GET') {
    const existingDb = loadDb() || {};
    const profiles = Array.isArray(existingDb.profiles)
      ? sanitizeServerProfiles(existingDb.profiles)
      : null;
    sendJson(res, 200, {
      ok: true,
      profiles,
      availableRoles: existingDb.availableRoles || null,
      profilesUpdatedAt: existingDb.profilesUpdatedAt || 0,
    });
    return;
  }

  if (parsedUrl === '/api/profiles' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (body && Array.isArray(body.profiles)) {
        const existingDb = loadDb() || {};
        const existingCount = Array.isArray(existingDb.profiles) ? existingDb.profiles.length : 0;
        const incomingCount = body.profiles.length;
        // Evita che un client non ancora sincronizzato sovrascriva l'archivio soci completo con i 20 soci demo
        if (existingCount > 20 && incomingCount <= 20 && !body.force) {
          sendJson(res, 200, {
            ok: true,
            keptExisting: true,
            profilesCount: existingCount,
          });
          return;
        }
        existingDb.profiles = sanitizeServerProfiles(body.profiles);
        if (Array.isArray(body.availableRoles)) {
          existingDb.availableRoles = body.availableRoles;
        }
        existingDb.profilesUpdatedAt = Number(body.profilesUpdatedAt || Date.now());
        if (existingDb.queueState) {
          existingDb.queueState = sanitizeServerQueueState(existingDb.queueState, existingDb.profiles);
        }
        existingDb.updatedAt = new Date().toISOString();
        saveDb(existingDb);
        broadcastUpdate('PROFILES_SYNC', {
          profiles: existingDb.profiles,
          availableRoles: existingDb.availableRoles,
          profilesUpdatedAt: existingDb.profilesUpdatedAt,
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

  // Endpoint ultra-veloce dedicato per il telecomando Eliminacode -> Monitor Sala d'Attesa
  if (parsedUrl === '/api/queue' && req.method === 'GET') {
    const existingDb = loadDb() || {};
    const queueState = existingDb.queueState
      ? sanitizeServerQueueState(existingDb.queueState, existingDb.profiles)
      : null;
    sendJson(res, 200, {
      ok: true,
      queueState,
      connectedDevices: sseClients.size,
    });
    return;
  }

  if (parsedUrl === '/api/queue' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (body && body.queueState) {
        const existingDb = loadDb() || {};
        const sanitizedQueue = sanitizeServerQueueState(body.queueState, existingDb.profiles);
        existingDb.queueState = sanitizedQueue;
        existingDb.updatedAt = new Date().toISOString();
        saveDb(existingDb);
        broadcastUpdate('QUEUE_SYNC', {
          queueState: sanitizedQueue,
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

  // Endpoint dedicato per il salvataggio immediato e affidabile dell'Orario Lezioni / Calendario
  if (parsedUrl === '/api/lessons' && req.method === 'GET') {
    const existingDb = loadDb() || {};
    sendJson(res, 200, {
      ok: true,
      lessons: Array.isArray(existingDb.lessons) ? existingDb.lessons : null,
      lessonsUpdatedAt: Number(existingDb.lessonsUpdatedAt || 0),
    });
    return;
  }

  if (parsedUrl === '/api/lessons' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (body && Array.isArray(body.lessons)) {
        const existingDb = loadDb() || {};
        const incomingTs = Number(body.lessonsUpdatedAt || Date.now());
        existingDb.lessons = body.lessons;
        existingDb.lessonsUpdatedAt = incomingTs;
        existingDb.updatedAt = new Date().toISOString();
        saveDb(existingDb);
        broadcastUpdate('LESSONS_SYNC', {
          lessons: existingDb.lessons,
          lessonsUpdatedAt: existingDb.lessonsUpdatedAt,
        });
        sendJson(res, 200, {
          ok: true,
          count: existingDb.lessons.length,
          lessonsUpdatedAt: existingDb.lessonsUpdatedAt,
          connectedDevices: sseClients.size,
        });
        return;
      }
      sendJson(res, 400, { ok: false, error: 'Formato lezioni non valido' });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
    }
    return;
  }

  // Upload Immagini / File per Avvisi Video (JPG, PNG, GIF, PDF)
  if (parsedUrl === '/api/upload-avviso' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const fileName = body.fileName || 'avviso.jpg';
      const fileData = body.fileData; // base64 o data:...;base64,...
      if (!fileData) {
        sendJson(res, 400, { ok: false, error: 'Dati file mancanti' });
        return;
      }
      const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
      const rawExt = path.extname(fileName).toLowerCase() || '.jpg';
      const cleanExt = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.webp'].includes(rawExt) ? rawExt : '.jpg';
      const safeName = `avviso_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${cleanExt}`;
      const targetPath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));
      sendJson(res, 200, {
        ok: true,
        url: `/uploads/avvisi/${safeName}`,
        fileName: safeName,
      });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // GET & POST /api/video-notices
  if (parsedUrl === '/api/video-notices' && req.method === 'GET') {
    const db = loadDb() || {};
    sendJson(res, 200, {
      ok: true,
      videoNotices: db.videoNotices || [],
      videoNoticesUpdatedAt: db.videoNoticesUpdatedAt || 0,
    });
    return;
  }

  if (parsedUrl === '/api/video-notices' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (body && Array.isArray(body.videoNotices)) {
        const existingDb = loadDb() || {};
        const incomingTs = Number(body.videoNoticesUpdatedAt || Date.now());
        existingDb.videoNotices = body.videoNotices;
        existingDb.videoNoticesUpdatedAt = incomingTs;
        existingDb.updatedAt = new Date().toISOString();
        saveDb(existingDb);
        broadcastUpdate('VIDEO_NOTICES_SYNC', {
          videoNotices: existingDb.videoNotices,
          videoNoticesUpdatedAt: existingDb.videoNoticesUpdatedAt,
        });
        sendJson(res, 200, {
          ok: true,
          count: existingDb.videoNotices.length,
          videoNoticesUpdatedAt: existingDb.videoNoticesUpdatedAt,
        });
        return;
      }
      sendJson(res, 400, { ok: false, error: 'Formato avvisi video non valido' });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
    }
    return;
  }

  // GET & POST /api/library-books
  if (parsedUrl === '/api/library-books' && req.method === 'GET') {
    const db = loadDb() || {};
    sendJson(res, 200, {
      ok: true,
      libraryBooks: db.libraryBooks || [],
      libraryBooksUpdatedAt: db.libraryBooksUpdatedAt || 0,
    });
    return;
  }

  if (parsedUrl === '/api/library-books' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (body && Array.isArray(body.libraryBooks)) {
        const existingDb = loadDb() || {};
        const incomingTs = Number(body.libraryBooksUpdatedAt || Date.now());
        existingDb.libraryBooks = body.libraryBooks;
        existingDb.libraryBooksUpdatedAt = incomingTs;
        existingDb.updatedAt = new Date().toISOString();
        saveDb(existingDb);
        broadcastUpdate('LIBRARY_BOOKS_SYNC', {
          libraryBooks: existingDb.libraryBooks,
          libraryBooksUpdatedAt: existingDb.libraryBooksUpdatedAt,
        });
        sendJson(res, 200, {
          ok: true,
          count: existingDb.libraryBooks.length,
          libraryBooksUpdatedAt: existingDb.libraryBooksUpdatedAt,
        });
        return;
      }
      sendJson(res, 400, { ok: false, error: 'Formato catalogo libri non valido' });
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
