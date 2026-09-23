const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'memos.json');
const VAULT_FILE = path.join(__dirname, 'data', 'vault.json');
const PARKING_FILE = path.join(__dirname, 'data', 'parking.json');
const CONTABILITA_FILE = path.join(__dirname, 'data', 'contabilita.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function loadParking() {
  try {
    if (!fs.existsSync(PARKING_FILE)) {
      const initial = {
        Giampy: { active: null, history: [] },
        Ty: { active: null, history: [] },
        Miki: { active: null, history: [] }
      };
      fs.writeFileSync(PARKING_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const data = fs.readFileSync(PARKING_FILE, 'utf8');
    return JSON.parse(data || '{}');
  } catch (err) {
    console.error('Errore lettura parking.json:', err.message);
    return {
      Giampy: { active: null, history: [] },
      Ty: { active: null, history: [] },
      Miki: { active: null, history: [] }
    };
  }
}

function saveParking(data) {
  try {
    fs.writeFileSync(PARKING_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Errore salvataggio parking.json:', err.message);
    return false;
  }
}

function resolveUser(paramUser, paramPin) {
  const u = (paramUser || '').toString().toLowerCase().trim();
  const p = (paramPin || '').toString().trim();
  if (p === '240961' || u === 'giampy' || u === 'papà' || u === 'papa') return 'Giampy';
  if (p === '040663' || u === 'ty' || u === 'mamma') return 'Ty';
  if (p === '240696' || u === 'miki' || u === 'figlio') return 'Miki';
  if (paramUser && (paramUser === 'Giampy' || paramUser === 'Ty' || paramUser === 'Miki')) return paramUser;
  return null;
}

function reverseGeocodeServer(lat, lng) {
  return new Promise((resolve) => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const fallback = {
      address: `Coordinate GPS (${latNum.toFixed(5)}, ${lngNum.toFixed(5)})`,
      addressShort: `GPS (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`
    };

    if (isNaN(latNum) || isNaN(lngNum)) {
      return resolve({ address: 'Posizione non specificata', addressShort: 'Posizione GPS' });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latNum}&lon=${lngNum}`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'FamyliaApp/1.0 (contact: giampylia@gmail.com)',
        'Accept': 'application/json'
      },
      timeout: 4000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.address) {
            const a = json.address;
            const road = a.road || a.pedestrian || a.street || '';
            const house = a.house_number ? ' ' + a.house_number : '';
            const city = a.city || a.town || a.village || a.suburb || '';
            if (road) {
              return resolve({
                addressShort: road + house,
                address: `${road}${house}${city ? ', ' + city : ''}`
              });
            } else if (json.display_name) {
              const parts = json.display_name.split(',');
              return resolve({
                addressShort: parts[0],
                address: parts.slice(0, 3).join(',')
              });
            }
          }
        } catch (e) {}
        resolve(fallback);
      });
    });

    req.on('error', () => resolve(fallback));
    req.on('timeout', () => {
      req.destroy();
      resolve(fallback);
    });
  });
}


let inMemoryVault = null;

function loadVault() {
  if (inMemoryVault && inMemoryVault.salt && inMemoryVault.data) {
    return inMemoryVault;
  }
  try {
    if (!fs.existsSync(VAULT_FILE)) return null;
    const data = fs.readFileSync(VAULT_FILE, 'utf8');
    const parsed = JSON.parse(data || '{}');
    if (parsed && parsed.salt && parsed.data) {
      inMemoryVault = parsed;
      return parsed;
    }
    return null;
  } catch (err) {
    return inMemoryVault;
  }
}

function saveVault(vaultData) {
  try {
    if (!vaultData || !vaultData.salt || !vaultData.data || !vaultData.check) {
      console.warn('[Vault] Payload vault non valido, salvataggio rifiutato');
      return false;
    }

    inMemoryVault = vaultData;

    // Salva un backup del vault precedente prima di sovrascrivere
    if (fs.existsSync(VAULT_FILE)) {
      try {
        const backupDir = path.join(__dirname, 'data', 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const backupFile = path.join(backupDir, `vault_${Date.now()}.json`);
        fs.copyFileSync(VAULT_FILE, backupFile);

        // Mantieni solo gli ultimi 20 backup
        const files = fs.readdirSync(backupDir).filter(f => f.startsWith('vault_')).sort();
        if (files.length > 20) {
          for (let i = 0; i < files.length - 20; i++) {
            try { fs.unlinkSync(path.join(backupDir, files[i])); } catch (e) {}
          }
        }
      } catch (bErr) {}
    }
    fs.writeFileSync(VAULT_FILE, JSON.stringify(vaultData, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

// --- CONTABILITA (GIAMPYCASH) DATA MANAGEMENT ---
let inMemoryContabilita = null;

function getInitialContabilita() {
  const seedFile = path.join(__dirname, 'data', 'initial_contabilita_seed.json');
  if (fs.existsSync(seedFile)) {
    try {
      return JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    } catch (e) {}
  }
  return { accounts: [], budgetEntries: [], journalEntries: [] };
}

function loadContabilita() {
  if (inMemoryContabilita && inMemoryContabilita.accounts && inMemoryContabilita.accounts.length > 0) {
    return inMemoryContabilita;
  }
  try {
    if (!fs.existsSync(CONTABILITA_FILE)) {
      const initial = getInitialContabilita();
      fs.writeFileSync(CONTABILITA_FILE, JSON.stringify(initial, null, 2), 'utf8');
      inMemoryContabilita = initial;
      return initial;
    }
    const data = fs.readFileSync(CONTABILITA_FILE, 'utf8');
    const parsed = JSON.parse(data || '{}');
    if (!parsed.accounts || !Array.isArray(parsed.accounts) || parsed.accounts.length === 0) {
      parsed.accounts = getInitialContabilita().accounts;
    }
    if (!parsed.journalEntries || !Array.isArray(parsed.journalEntries)) {
      parsed.journalEntries = [];
    }
    if (!parsed.budgetEntries || !Array.isArray(parsed.budgetEntries)) {
      parsed.budgetEntries = [];
    }
    inMemoryContabilita = parsed;
    return parsed;
  } catch (err) {
    console.error('Errore lettura contabilita.json:', err.message);
    return getInitialContabilita();
  }
}

function saveContabilita(data) {
  try {
    if (!data || typeof data !== 'object') return false;
    inMemoryContabilita = data;
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    // Salva un backup prima di sovrascrivere
    if (fs.existsSync(CONTABILITA_FILE)) {
      try {
        const backupFile = path.join(backupDir, `contabilita_${Date.now()}.json`);
        fs.copyFileSync(CONTABILITA_FILE, backupFile);
        const files = fs.readdirSync(backupDir).filter(f => f.startsWith('contabilita_')).sort();
        if (files.length > 20) {
          for (let i = 0; i < files.length - 20; i++) {
            try { fs.unlinkSync(path.join(backupDir, files[i])); } catch (e) {}
          }
        }
      } catch (be) {}
    }

    const tmp = CONTABILITA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, CONTABILITA_FILE);
    return true;
  } catch (err) {
    console.error('Errore salvataggio contabilita.json:', err.message);
    return false;
  }
}

// --- WEB PUSH NOTIFICATIONS CONFIGURATION ---
const webpush = require('web-push');
const VAPID_FILE = path.join(__dirname, 'data', 'vapid.json');
const SUBS_FILE = path.join(__dirname, 'data', 'subscriptions.json');

let vapid = {
  publicKey: "BEBapV0Fizqvs0ZP5QyqltL2JxVpiyCWuAAdChJFhCQOXEn8ke3r75Z6SIbinUsZK0J7u2CL12QlrqqCh71_xOQ",
  privateKey: "gphMXDuW55G9yYQz_qociW7FB-_MZXYgQDFJmkMfP9I",
  email: "giampylia@gmail.com"
};

try {
  if (fs.existsSync(VAPID_FILE)) {
    vapid = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
  }
} catch (e) {}

try {
  webpush.setVapidDetails(
    `mailto:${vapid.email}`,
    vapid.publicKey,
    vapid.privateKey
  );
} catch (err) {
  console.error('Errore configurazione VAPID:', err.message);
}

function loadSubscriptions() {
  try {
    if (!fs.existsSync(SUBS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}

function saveSubscriptions(subs) {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

let activePort = PORT;

// Helper: Trova IP locale sulla rete Wi-Fi / LAN
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Salta IPv6 e indirizzi interni (127.0.0.1)
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Helper: Leggi Memos da file
function loadMemos() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf8');
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Errore lettura memos.json:', err.message);
    return [];
  }
}

// Helper: Salva Memos su file
function saveMemos(memos) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(memos, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Errore salvataggio memos.json:', err.message);
    return false;
  }
}

// Helper: parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2 * 1024 * 1024) { // 2MB max
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Helper risposta JSON
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(JSON.stringify(data));
}

async function handleRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- API ROUTES ---
  if (pathname.startsWith('/api/')) {
    // GET /api/info (restituisce IP locale per il QR code)
    if (pathname === '/api/info' && req.method === 'GET') {
      const localIP = getLocalIP();
      return sendJSON(res, 200, {
        ip: localIP,
        port: activePort,
        localUrl: `http://localhost:${activePort}`,
        networkUrl: `http://${localIP}:${activePort}`
      });
    }

    // GET /api/vault (restituisce vault cifrato)
    if (pathname === '/api/vault' && req.method === 'GET') {
      const vault = loadVault();
      return sendJSON(res, 200, vault || {});
    }

    // GET /api/backups (elenco punti di ripristino sul server)
    if (pathname === '/api/backups' && req.method === 'GET') {
      const backupDir = path.join(__dirname, 'data', 'backups');
      const list = [];
      if (fs.existsSync(backupDir)) {
        try {
          const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
          for (const file of files) {
            try {
              const fPath = path.join(backupDir, file);
              const stat = fs.statSync(fPath);
              let dateStr = stat.mtime.toISOString();
              const tsMatch = file.match(/vault_(\d+)\.json/);
              if (tsMatch) {
                dateStr = new Date(parseInt(tsMatch[1], 10)).toISOString();
              }
              list.push({
                filename: file,
                size: stat.size,
                date: dateStr
              });
            } catch (fe) {}
          }
        } catch (dirErr) {}
      }
      return sendJSON(res, 200, { backups: list });
    }

    // POST /api/backups/restore (ripristina un punto di ripristino o un vault caricato)
    if (pathname === '/api/backups/restore' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        let targetVault = null;

        if (body && body.filename) {
          const safeFilename = path.basename(body.filename);
          const fPath = path.join(__dirname, 'data', 'backups', safeFilename);
          if (!fs.existsSync(fPath)) {
            return sendJSON(res, 404, { error: 'File di backup non trovato sul server' });
          }
          targetVault = JSON.parse(fs.readFileSync(fPath, 'utf8'));
        } else if (body && body.vaultData) {
          targetVault = body.vaultData;
        }

        if (!targetVault || !targetVault.salt || !targetVault.data || !targetVault.check) {
          return sendJSON(res, 400, { error: 'Dati di backup non validi o incompleti' });
        }

        const ok = saveVault(targetVault);
        if (!ok) {
          return sendJSON(res, 500, { error: 'Errore durante il salvataggio del backup' });
        }

        return sendJSON(res, 200, {
          success: true,
          message: 'Punto di ripristino caricato con successo!',
          vault: targetVault
        });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    // POST /api/backups/create (crea un punto di ripristino istantaneo)
    if (pathname === '/api/backups/create' && req.method === 'POST') {
      try {
        const current = loadVault();
        if (!current || !current.salt) {
          return sendJSON(res, 400, { error: 'Nessun archivio valido da salvare' });
        }
        const backupDir = path.join(__dirname, 'data', 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const filename = `vault_${Date.now()}.json`;
        fs.writeFileSync(path.join(backupDir, filename), JSON.stringify(current, null, 2), 'utf8');
        return sendJSON(res, 200, { success: true, filename, message: 'Nuovo punto di ripristino creato' });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    // POST /api/vault (salva vault cifrato)
    if (pathname === '/api/vault' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        saveVault(body);
        return sendJSON(res, 200, { success: true });
      } catch (err) {
        return sendJSON(res, 400, { error: err.message });
      }
    }

    // GET /api/contabilita (restituisce stato contabilità GiampyCash)
    if (pathname === '/api/contabilita' && req.method === 'GET') {
      const data = loadContabilita();
      return sendJSON(res, 200, { success: true, data });
    }

    // POST /api/contabilita (salva stato contabilità)
    if (pathname === '/api/contabilita' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (body && typeof body === 'object') {
          saveContabilita(body);
          return sendJSON(res, 200, { success: true });
        }
        return sendJSON(res, 400, { error: 'Payload contabilità non valido' });
      } catch (err) {
        return sendJSON(res, 400, { error: err.message });
      }
    }

    // POST /api/contabilita/import-csv (importa registrazioni da CSV)
    if (pathname === '/api/contabilita/import-csv' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const csvContent = body.csv || '';
        if (!csvContent) {
          return sendJSON(res, 400, { error: 'CSV vuoto' });
        }
        const state = loadContabilita();
        const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          if (cols.length >= 7) {
            const [dare, avere, dDare, dAvere, dateStr, impStr, desc] = cols;
            const dateParts = dateStr.split('/');
            let isoDate = dateStr;
            if (dateParts.length === 3) {
              isoDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
            }
            const amount = parseFloat(impStr.replace(',', '.'));
            if (!isNaN(amount) && dare && avere) {
              const cleanDesc = (desc || '').toUpperCase();
              const exists = state.journalEntries.some(e =>
                e.date === isoDate &&
                e.debitAccountCode === dare &&
                e.creditAccountCode === avere &&
                Math.abs(e.amount - amount) < 0.001 &&
                e.description === cleanDesc
              );
              if (!exists) {
                state.journalEntries.push({
                  id: 'csv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
                  date: isoDate,
                  description: cleanDesc,
                  debitAccountCode: dare,
                  creditAccountCode: avere,
                  amount: amount
                });
                imported++;
              }
            }
          }
        }
        state.journalEntries.sort((a, b) => b.date.localeCompare(a.date));
        saveContabilita(state);
        return sendJSON(res, 200, { success: true, imported, total: state.journalEntries.length });
      } catch (err) {
        return sendJSON(res, 400, { error: err.message });
      }
    }

    // GET /api/push-public-key (chiave pubblica VAPID)
    if (pathname === '/api/push-public-key' && req.method === 'GET') {
      return sendJSON(res, 200, { publicKey: vapid.publicKey });
    }

    // GET /api/push-status (diagnostica registrazioni attive)
    if (pathname === '/api/push-status' && req.method === 'GET') {
      const subs = loadSubscriptions();
      return sendJSON(res, 200, {
        count: subs.length,
        devices: subs.map(s => ({ user: s.user, device: s.device, updatedAt: s.updatedAt }))
      });
    }

    // POST /api/push-subscribe (registrazione endpoint smartphone)
    if (pathname === '/api/push-subscribe' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (!body.subscription || !body.subscription.endpoint) {
          return sendJSON(res, 400, { error: 'Sottoscrizione non valida' });
        }
        const subs = loadSubscriptions();
        const index = subs.findIndex(s => s.subscription.endpoint === body.subscription.endpoint);
        const entry = {
          subscription: body.subscription,
          user: body.user || 'Famiglia',
          device: body.device || '',
          updatedAt: new Date().toISOString()
        };
        if (index >= 0) {
          subs[index] = entry;
        } else {
          subs.push(entry);
        }
        saveSubscriptions(subs);
        console.log(`[Push] Dispositivo registrato per ${entry.user}. Totale: ${subs.length}`);
        return sendJSON(res, 200, { success: true, count: subs.length });
      } catch (err) {
        return sendJSON(res, 400, { error: err.message });
      }
    }

    // POST /api/send-push (invia notifica a tutti gli smartphone registrati)
    if (pathname === '/api/send-push' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const title = body.title || 'Famylia';
        const msgText = body.body || 'Nuovo messaggio di famiglia';
        const subs = loadSubscriptions();

        const payload = JSON.stringify({
          title: title,
          body: msgText,
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
          url: '/'
        });

        const activeSubs = [];
        let sentCount = 0;

        await Promise.all(subs.map(async (subItem) => {
          try {
            await webpush.sendNotification(subItem.subscription, payload);
            activeSubs.push(subItem);
            sentCount++;
          } catch (err) {
            console.warn('[Push] Errore invio:', err.statusCode, err.message);
            // Se l'endpoint è scaduto (410 Gone o 404), viene rimosso
            if (err.statusCode !== 410 && err.statusCode !== 404) {
              activeSubs.push(subItem);
            }
          }
        }));

        saveSubscriptions(activeSubs);
        console.log(`[Push] Inviate ${sentCount}/${subs.length} notifiche push.`);
        return sendJSON(res, 200, { success: true, sent: sentCount, total: activeSubs.length });
      } catch (err) {
        return sendJSON(res, 400, { error: err.message });
      }
    }

    // GET /api/memos
    if (pathname === '/api/memos' && req.method === 'GET') {
      let memos = loadMemos();
      const recipient = parsedUrl.searchParams.get('recipient');
      if (recipient && recipient !== 'tutti') {
        memos = memos.filter(m => m.recipient === recipient || m.recipient === 'famiglia');
      }
      return sendJSON(res, 200, memos);
    }

    // POST /api/memos (creazione nuovo memo)
    if (pathname === '/api/memos' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (!body.title || !body.recipient) {
          return sendJSON(res, 400, { error: 'Titolo e Destinatario sono obbligatori' });
        }

        const memos = loadMemos();
        const newMemo = {
          id: 'memo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          recipient: body.recipient, // 'figlio', 'moglie', 'famiglia'
          title: body.title.trim(),
          content: (body.content || '').trim(),
          items: Array.isArray(body.items) ? body.items.map((it, idx) => ({
            id: it.id || `item-${Date.now()}-${idx}`,
            text: (it.text || '').trim(),
            done: Boolean(it.done)
          })) : [],
          category: body.category || 'promemoria', // 'affetto', 'compiti', 'spesa', 'importante', 'idee'
          color: body.color || 'yellow', // 'yellow', 'pink', 'blue', 'green', 'purple'
          pinned: Boolean(body.pinned),
          done: Boolean(body.done),
          author: body.author || 'Papà',
          createdAt: new Date().toISOString(),
          dueDate: body.dueDate || ''
        };

        memos.unshift(newMemo);
        saveMemos(memos);
        return sendJSON(res, 201, newMemo);
      } catch (err) {
        return sendJSON(res, 400, { error: 'Dati non validi: ' + err.message });
      }
    }

    // PUT /api/memos/:id (aggiornamento memo)
    if (pathname.startsWith('/api/memos/') && req.method === 'PUT') {
      const id = pathname.replace('/api/memos/', '');
      try {
        const body = await parseJsonBody(req);
        const memos = loadMemos();
        const index = memos.findIndex(m => m.id === id);
        if (index === -1) {
          return sendJSON(res, 404, { error: 'Memo non trovato' });
        }

        // Aggiorna i campi consentiti
        memos[index] = {
          ...memos[index],
          ...body,
          id: memos[index].id, // preserva l'ID originale
          updatedAt: new Date().toISOString()
        };

        saveMemos(memos);
        return sendJSON(res, 200, memos[index]);
      } catch (err) {
        return sendJSON(res, 400, { error: 'Errore aggiornamento: ' + err.message });
      }
    }

    // DELETE /api/memos/:id (eliminazione memo)
    if (pathname.startsWith('/api/memos/') && req.method === 'DELETE') {
      const id = pathname.replace('/api/memos/', '');
      let memos = loadMemos();
      const initialLength = memos.length;
      memos = memos.filter(m => m.id !== id);

      if (memos.length === initialLength) {
        return sendJSON(res, 404, { error: 'Memo non trovato' });
      }

      saveMemos(memos);
      return sendJSON(res, 200, { success: true, id });
    }

    // GET or POST /api/auto-park (Webhook background automatico / disconnessione Bluetooth)
    if (pathname === '/api/auto-park' && (req.method === 'GET' || req.method === 'POST')) {
      try {
        let body = {};
        if (req.method === 'POST') {
          try { body = await parseJsonBody(req); } catch (e) {}
        }

        const rawUser = parsedUrl.searchParams.get('user') || body.user;
        const rawPin = parsedUrl.searchParams.get('pin') || body.pin;
        const user = resolveUser(rawUser, rawPin);

        if (!user) {
          return sendJSON(res, 400, {
            error: 'Utente o PIN non valido. Specifica ?user=Giampy (o Ty / Miki) oppure ?pin=240961 (o 040663 / 240696)'
          });
        }

        const rawLat = parsedUrl.searchParams.get('lat') || body.lat;
        const rawLng = parsedUrl.searchParams.get('lng') || parsedUrl.searchParams.get('lon') || body.lng || body.lon;

        if (!rawLat || !rawLng) {
          return sendJSON(res, 400, { error: 'Coordinate lat e lng mancanti.' });
        }

        const lat = parseFloat(rawLat);
        const lng = parseFloat(rawLng);
        if (isNaN(lat) || isNaN(lng)) {
          return sendJSON(res, 400, { error: 'Coordinate lat e lng numeriche non valide.' });
        }

        const accuracy = Math.round(parseFloat(parsedUrl.searchParams.get('accuracy') || body.accuracy || 5));
        const trigger = parsedUrl.searchParams.get('trigger') || body.trigger || 'bluetooth_auto';
        const notes = (parsedUrl.searchParams.get('notes') || body.notes || '').trim();

        const geo = await reverseGeocodeServer(lat, lng);
        const parkingStore = loadParking();
        if (!parkingStore[user]) {
          parkingStore[user] = { active: null, history: [] };
        }
        if (!Array.isArray(parkingStore[user].history)) {
          parkingStore[user].history = [];
        }

        // Se c'era già un parcheggio attivo, archivialo nello storico
        if (parkingStore[user].active) {
          parkingStore[user].history.unshift(parkingStore[user].active);
          if (parkingStore[user].history.length > 50) {
            parkingStore[user].history = parkingStore[user].history.slice(0, 50);
          }
        }

        const newParking = {
          id: 'park-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          section: 'parking',
          user: user,
          owner: user,
          lat: lat,
          lng: lng,
          accuracy: accuracy,
          address: geo.address,
          addressShort: geo.addressShort,
          timestamp: new Date().toISOString(),
          trigger: trigger,
          notes: notes
        };

        parkingStore[user].active = newParking;
        saveParking(parkingStore);
        console.log(`[Parking] Auto parcheggiata salvata per ${user}: ${geo.addressShort} (trigger: ${trigger})`);

        // Invia notifica Push immediata al telefono di quell'utente
        try {
          const subs = loadSubscriptions();
          const timeStr = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
          const payload = JSON.stringify({
            title: `🚗 Auto Parcheggiata (${user})`,
            body: `📍 ${geo.addressShort} (${timeStr})`,
            icon: '/icons/icon-192.svg',
            badge: '/icons/icon-192.svg',
            url: '/?section=parking'
          });
          subs.filter(s => s.user === user || s.user === 'Famiglia').forEach(subItem => {
            webpush.sendNotification(subItem.subscription, payload).catch(() => {});
          });
        } catch (pushErr) {}

        if (parsedUrl.searchParams.get('format') === 'html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(`
            <!DOCTYPE html>
            <html lang="it">
            <head><meta charset="utf-8"><title>Auto Parcheggiata</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:#0f172a; color:#fff; text-align:center; padding:40px 20px;">
              <div style="font-size:3.5rem; margin-bottom:12px;">🚗</div>
              <h2 style="color:#10b981; margin:0 0 10px 0; font-size:1.4rem;">Posizione Auto Salvata!</h2>
              <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px; max-width:360px; margin:0 auto 24px auto;">
                <div style="font-weight:700; font-size:1.15rem; color:#f8fafc; margin-bottom:6px;">${geo.addressShort}</div>
                <div style="font-size:0.85rem; color:#94a3b8; line-height:1.4;">${geo.address}</div>
                <div style="margin-top:12px; font-size:0.8rem; color:#10b981; font-weight:600;">Auto di ${user}</div>
              </div>
              <a href="/" style="display:inline-block; background:#10b981; color:#0f172a; font-weight:700; padding:12px 28px; border-radius:12px; text-decoration:none;">Apri Famylia</a>
            </body>
            </html>
          `);
        }

        return sendJSON(res, 200, {
          success: true,
          user: user,
          active: newParking
        });
      } catch (err) {
        console.error('[Parking] Errore auto-park:', err);
        return sendJSON(res, 500, { error: err.message });
      }
    }

    // GET /api/parking (restituisce parcheggio attivo e storico dell'utente autenticato)
    if (pathname === '/api/parking' && req.method === 'GET') {
      const user = resolveUser(parsedUrl.searchParams.get('user'), parsedUrl.searchParams.get('pin'));
      if (!user) {
        return sendJSON(res, 400, { error: 'Utente o PIN obbligatorio per visualizzare il parcheggio personale.' });
      }
      const parkingStore = loadParking();
      const userData = parkingStore[user] || { active: null, history: [] };
      return sendJSON(res, 200, {
        user: user,
        active: userData.active || null,
        history: userData.history || []
      });
    }

    // POST /api/parking/release (rimuove il parcheggio attivo - "Ho ripreso l'auto")
    if (pathname === '/api/parking/release' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const user = resolveUser(body.user, body.pin);
        if (!user) {
          return sendJSON(res, 400, { error: 'Utente o PIN non valido.' });
        }
        const parkingStore = loadParking();
        if (parkingStore[user] && parkingStore[user].active) {
          parkingStore[user].active.releasedAt = new Date().toISOString();
          parkingStore[user].history.unshift(parkingStore[user].active);
          parkingStore[user].active = null;
          saveParking(parkingStore);
        }
        return sendJSON(res, 200, { success: true });
      } catch (err) {
        return sendJSON(res, 400, { error: err.message });
      }
    }

    // POST /api/parking/clear-history (svuota storico parcheggi dell'utente)
    if (pathname === '/api/parking/clear-history' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const user = resolveUser(body.user, body.pin);
        if (!user) {
          return sendJSON(res, 400, { error: 'Utente o PIN non valido.' });
        }
        const parkingStore = loadParking();
        if (parkingStore[user]) {
          parkingStore[user].history = [];
          saveParking(parkingStore);
        }
        return sendJSON(res, 200, { success: true });
      } catch (err) {
        return sendJSON(res, 400, { error: err.message });
      }
    }

    // POST /api/parking/note (aggiorna la nota del parcheggio attivo)
    if (pathname === '/api/parking/note' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const user = resolveUser(body.user, body.pin);
        if (!user) {
          return sendJSON(res, 400, { error: 'Utente o PIN non valido.' });
        }
        const parkingStore = loadParking();
        if (parkingStore[user] && parkingStore[user].active) {
          parkingStore[user].active.notes = (body.note || '').trim();
          saveParking(parkingStore);
        }
        return sendJSON(res, 200, { success: true });
      } catch (err) {
        return sendJSON(res, 400, { error: err.message });
      }
    }

    return sendJSON(res, 404, { error: 'Endpoint API non trovato' });
  }

  // --- STATIC FILES SERVING ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Prevenzione Directory Traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Accesso Negato');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Se il file non esiste, fallback su index.html per SPA/PWA se non è un file con estensione
      if (!path.extname(pathname)) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Gestione cache: no-cache per html, js, css e service worker così su cellulare è sempre aggiornato
    const headers = { 'Content-Type': contentType };
    if (ext === '.html' || ext === '.js' || ext === '.css' || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    } else {
      headers['Cache-Control'] = 'public, max-age=86400';
    }

    res.writeHead(200, headers);
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
}

function startServer(portToTry) {
  const srv = http.createServer(handleRequest);

  srv.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Porta ${portToTry} occupata, provo ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Errore avvio server:', err);
    }
  });

  srv.listen(portToTry, '0.0.0.0', () => {
    activePort = portToTry;
    const localIP = getLocalIP();
    console.log('='.repeat(65));
    console.log('   🏠 NOTE DI FAMIGLIA (FamilyMemo) - WebApp Online!');
    console.log('='.repeat(65));
    console.log(`\n💻 Sul tuo computer:`);
    console.log(`   👉 http://localhost:${activePort}`);
    console.log(`\n📱 Sui telefoni di tua moglie e tuo figlio (stesso Wi-Fi):`);
    console.log(`   👉 http://${localIP}:${activePort}`);
    console.log(`\n🔗 Link diretti per schermata Home:`);
    console.log(`   👦 Figlio:  http://${localIP}:${activePort}/#figlio`);
    console.log(`   👩 Moglie:  http://${localIP}:${activePort}/#moglie`);
    console.log('='.repeat(65));
  });
}

startServer(PORT);


