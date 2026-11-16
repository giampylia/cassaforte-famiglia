const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const AUTH_FILE = path.join(__dirname, 'auth_store.json');
const VAULT_FILE = path.join(__dirname, 'vault_store.json');

// In-memory active OTP store
let activeOtp = {
  code: null,
  expires: 0
};

function getAuthStore() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading auth store:', e);
  }
  return {
    singlePassword: '000',
    phoneMasked: '+39 335 ••• •933'
  };
}

function saveAuthStore(data) {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving auth store:', e);
  }
}

function getVaultStore() {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.items)) {
        return parsed;
      }
    }
    const dataVaultFile = path.join(__dirname, 'data', 'vault_store.json');
    if (fs.existsSync(dataVaultFile)) {
      const parsed = JSON.parse(fs.readFileSync(dataVaultFile, 'utf8'));
      if (parsed && Array.isArray(parsed.items)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading vault store:', e);
  }
  return { items: [] };
}

function saveVaultStore(data) {
  try {
    if (!data || !Array.isArray(data.items)) return;
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    if (fs.existsSync(VAULT_FILE)) {
      try {
        const cur = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
        if (cur && Array.isArray(cur.items) && cur.items.length > 0) {
          fs.writeFileSync(path.join(backupDir, `vault_backup_${Date.now()}.json`), JSON.stringify(cur, null, 2), 'utf8');
        }
      } catch (be) {}
    }
    fs.writeFileSync(VAULT_FILE, JSON.stringify(data, null, 2), 'utf8');
    const dataVaultFile = path.join(__dirname, 'data', 'vault_store.json');
    fs.writeFileSync(dataVaultFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving vault store:', e);
  }
}

const ACQUISTI_FILE = path.join(__dirname, 'acquisti_store.json');

function getAcquistiStore() {
  try {
    if (fs.existsSync(ACQUISTI_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ACQUISTI_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.items)) {
        return parsed;
      }
    }
    const dataAcquistiFile = path.join(__dirname, 'data', 'acquisti_store.json');
    if (fs.existsSync(dataAcquistiFile)) {
      const parsed = JSON.parse(fs.readFileSync(dataAcquistiFile, 'utf8'));
      if (parsed && Array.isArray(parsed.items)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading acquisti store:', e);
  }
  return { items: [] };
}

function saveAcquistiStore(data) {
  try {
    if (!data || !Array.isArray(data.items)) return;
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(ACQUISTI_FILE, JSON.stringify(data, null, 2), 'utf8');
    const dataAcquistiFile = path.join(__dirname, 'data', 'acquisti_store.json');
    fs.writeFileSync(dataAcquistiFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving acquisti store:', e);
  }
}

const LAVORI_FILE = path.join(__dirname, 'lavori_store.json');

function getLavoriStore() {
  try {
    if (fs.existsSync(LAVORI_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LAVORI_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.items)) {
        return parsed;
      }
    }
    const dataLavoriFile = path.join(__dirname, 'data', 'lavori_store.json');
    if (fs.existsSync(dataLavoriFile)) {
      const parsed = JSON.parse(fs.readFileSync(dataLavoriFile, 'utf8'));
      if (parsed && Array.isArray(parsed.items)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading lavori store:', e);
  }
  return { items: [] };
}

function saveLavoriStore(data) {
  try {
    if (!data || !Array.isArray(data.items)) return;
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(LAVORI_FILE, JSON.stringify(data, null, 2), 'utf8');
    const dataLavoriFile = path.join(__dirname, 'data', 'lavori_store.json');
    fs.writeFileSync(dataLavoriFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving lavori store:', e);
  }
}

const SPESA_FILE = path.join(__dirname, 'spesa_store.json');
const DEFAULT_SPESA_STORES = ['Eurospin', 'Lidl', 'Maurys'];
const DEFAULT_SPESA_PRODUCTS = [
  'Pane', 'Latte', 'Uova', 'Acqua', 'Pasta', 'Olio EVO', 'Caffè', 'Zucchero',
  'Frutta', 'Verdura', 'Carne', 'Pesce', 'Formaggio', 'Affettati', 'Yogurt',
  'Detersivo lavatrice', 'Detersivo piatti', 'Carta igienica', 'Scottex', 'Sapone'
];

function getSpesaStore() {
  try {
    if (fs.existsSync(SPESA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SPESA_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          items: Array.isArray(parsed.items) ? parsed.items : [],
          stores: Array.isArray(parsed.stores) && parsed.stores.length > 0 ? parsed.stores : DEFAULT_SPESA_STORES,
          products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : DEFAULT_SPESA_PRODUCTS
        };
      }
    }
    const dataSpesaFile = path.join(__dirname, 'data', 'spesa_store.json');
    if (fs.existsSync(dataSpesaFile)) {
      const parsed = JSON.parse(fs.readFileSync(dataSpesaFile, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          items: Array.isArray(parsed.items) ? parsed.items : [],
          stores: Array.isArray(parsed.stores) && parsed.stores.length > 0 ? parsed.stores : DEFAULT_SPESA_STORES,
          products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : DEFAULT_SPESA_PRODUCTS
        };
      }
    }
  } catch (e) {
    console.error('Error reading spesa store:', e);
  }
  return { items: [], stores: DEFAULT_SPESA_STORES, products: DEFAULT_SPESA_PRODUCTS };
}

function saveSpesaStore(data) {
  try {
    if (!data || typeof data !== 'object') return;
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(SPESA_FILE, JSON.stringify(data, null, 2), 'utf8');
    const dataSpesaFile = path.join(__dirname, 'data', 'spesa_store.json');
    fs.writeFileSync(dataSpesaFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving spesa store:', e);
  }
}

const DATA_DIR = path.join(__dirname, 'data');
const CONTABILITA_FILE = path.join(DATA_DIR, 'contabilita.json');
let inMemoryContabilita = null;

function loadContabilita() {
  if (inMemoryContabilita) return inMemoryContabilita;
  try {
    if (fs.existsSync(CONTABILITA_FILE)) {
      const data = fs.readFileSync(CONTABILITA_FILE, 'utf8');
      const parsed = JSON.parse(data || '{}');
      if (parsed && Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
        inMemoryContabilita = parsed;
        return parsed;
      }
    }
    const staticSeedPath = path.join(PUBLIC_DIR, 'contabilita-data.json');
    if (fs.existsSync(staticSeedPath)) {
      const data = fs.readFileSync(staticSeedPath, 'utf8');
      const parsed = JSON.parse(data || '{}');
      inMemoryContabilita = parsed;
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(CONTABILITA_FILE, JSON.stringify(parsed, null, 2), 'utf8');
      } catch (e) {}
      return parsed;
    }
  } catch (err) {
    console.error('[Contabilità] Errore caricamento:', err.message);
  }
  return { accounts: [], journalEntries: [], budgetEntries: [] };
}

function saveContabilita(payload) {
  try {
    if (!payload || typeof payload !== 'object') return false;
    inMemoryContabilita = payload;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONTABILITA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    try {
      fs.writeFileSync(path.join(PUBLIC_DIR, 'contabilita-data.json'), JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {}
    return true;
  } catch (err) {
    console.error('[Contabilità] Errore salvataggio:', err.message);
    return false;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/png'
};

const CONTABILITA_ROUTES = new Set([
  '/avanzamento',
  '/registrazioni',
  '/budget',
  '/piano',
  '/liquidita',
  '/contabilita',
  '/install'
]);

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // Helper per inviare risposte JSON
  const sendJson = (status, obj) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    });
    res.end(JSON.stringify(obj));
  };

  // 1. API Autenticazione & OTP
  if (reqPath.startsWith('/api/auth/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try { if (body) data = JSON.parse(body); } catch (e) {}

      // Verifica Password Singola
      if (reqPath === '/api/auth/verify-pw' && req.method === 'POST') {
        const store = getAuthStore();
        const inputPw = (data.password || '').trim();
        if (inputPw && inputPw === store.singlePassword) {
          return sendJson(200, { success: true, message: 'Password corretta' });
        } else {
          return sendJson(401, { success: false, message: 'Password non corretta' });
        }
      }

      // Richiesta invio OTP al cellulare
      if (reqPath === '/api/auth/request-otp' && req.method === 'POST') {
        const store = getAuthStore();
        const randVal = crypto.randomBytes(4).readUInt32BE(0);
        const code = Math.floor(100000 + (randVal / 0xffffffff) * 900000).toString();
        activeOtp = {
          code: code,
          expires: Date.now() + 5 * 60 * 1000 // 5 minuti
        };
        console.log(`[SICUREZZA GPP] OTP generato per ${store.phoneMasked}: ${code}`);
        return sendJson(200, {
          success: true,
          maskedPhone: store.phoneMasked,
          otpCode: code,
          message: 'Codice OTP generato con successo'
        });
      }

      // Verifica OTP
      if (reqPath === '/api/auth/verify-otp' && req.method === 'POST') {
        const inputOtp = (data.otp || '').trim();
        if (activeOtp.code && activeOtp.code === inputOtp && Date.now() <= activeOtp.expires) {
          return sendJson(200, { success: true, message: 'OTP verificato con successo' });
        } else {
          return sendJson(401, { success: false, message: 'Codice OTP errato o scaduto' });
        }
      }

      // Info stato sicurezza
      if (reqPath === '/api/auth/status') {
        const store = getAuthStore();
        return sendJson(200, {
          maskedPhone: store.phoneMasked
        });
      }

      sendJson(404, { error: 'Endpoint auth non trovato' });
    });
    return;
  }

  // 2. API Cassaforte Password Criptate
  if (reqPath.startsWith('/api/vault/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    if (reqPath === '/api/vault/list' && req.method === 'GET') {
      const v = getVaultStore();
      return sendJson(200, { items: v.items || [] });
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try { if (body) data = JSON.parse(body); } catch (e) {}

      if (reqPath === '/api/vault/save' && req.method === 'POST') {
        if (!Array.isArray(data.items)) {
          return sendJson(400, { success: false, message: 'Formato lista non valido' });
        }
        saveVaultStore({
          items: data.items,
          updatedAt: new Date().toISOString()
        });
        console.log(`[CASSAFORTE GPP] Salvate ${data.items.length} voci crittografate`);
        return sendJson(200, { success: true, count: data.items.length });
      }

      sendJson(404, { error: 'Endpoint vault non trovato' });
    });
    return;
  }

  // 2b. API Acquisti (Lista e salvataggio record acquisti con foto e link)
  if (reqPath.startsWith('/api/acquisti/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    if (reqPath === '/api/acquisti/list' && req.method === 'GET') {
      const a = getAcquistiStore();
      return sendJson(200, { items: a.items || [] });
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try { if (body) data = JSON.parse(body); } catch (e) {}

      if (reqPath === '/api/acquisti/save' && req.method === 'POST') {
        if (!Array.isArray(data.items)) {
          return sendJson(400, { success: false, message: 'Formato lista acquisti non valido' });
        }
        saveAcquistiStore({
          items: data.items,
          updatedAt: new Date().toISOString()
        });
        console.log(`[ACQUISTI GPP] Salvati ${data.items.length} acquisti`);
        return sendJson(200, { success: true, count: data.items.length });
      }

      sendJson(404, { error: 'Endpoint acquisti non trovato' });
    });
    return;
  }

  // 2c. API Lavori (Lista e salvataggio record lavori con foto e link)
  if (reqPath.startsWith('/api/lavori/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    if (reqPath === '/api/lavori/list' && req.method === 'GET') {
      const l = getLavoriStore();
      return sendJson(200, { items: l.items || [] });
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try { if (body) data = JSON.parse(body); } catch (e) {}

      if (reqPath === '/api/lavori/save' && req.method === 'POST') {
        if (!Array.isArray(data.items)) {
          return sendJson(400, { success: false, message: 'Formato lista lavori non valido' });
        }
        saveLavoriStore({
          items: data.items,
          updatedAt: new Date().toISOString()
        });
        console.log(`[LAVORI GPP] Salvati ${data.items.length} lavori`);
        return sendJson(200, { success: true, count: data.items.length });
      }

      sendJson(404, { error: 'Endpoint lavori non trovato' });
    });
    return;
  }

  // 2d. API Spesa (Lista, punti vendita, prodotti e salvataggio)
  if (reqPath.startsWith('/api/spesa/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    if (reqPath === '/api/spesa/list' && req.method === 'GET') {
      const s = getSpesaStore();
      return sendJson(200, s);
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try { if (body) data = JSON.parse(body); } catch (e) {}

      if (reqPath === '/api/spesa/save' && req.method === 'POST') {
        const cur = getSpesaStore();
        const next = {
          items: Array.isArray(data.items) ? data.items : cur.items,
          stores: Array.isArray(data.stores) && data.stores.length > 0 ? data.stores : cur.stores,
          products: Array.isArray(data.products) && data.products.length > 0 ? data.products : cur.products,
          updatedAt: new Date().toISOString()
        };
        saveSpesaStore(next);
        console.log(`[SPESA GPP] Salvati ${next.items.length} prodotti spesa`);
        return sendJson(200, { success: true, count: next.items.length });
      }

      sendJson(404, { error: 'Endpoint spesa non trovato' });
    });
    return;
  }

  // 3. API Contabilità & Bilancio (Persistenza reale registrazioni e conti)
  if (reqPath.startsWith('/api/contabilita')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    if (req.method === 'GET') {
      const data = loadContabilita();
      return sendJson(200, { success: true, data });
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (reqPath === '/api/contabilita/add-entry') {
            const current = loadContabilita();
            const entry = {
              id: payload.id || ('je-spesa-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
              date: payload.date || new Date().toISOString().split('T')[0],
              description: String(payload.description || 'SPESA').trim().toUpperCase(),
              debitAccountCode: String(payload.debitAccountCode || '6110'),
              creditAccountCode: String(payload.creditAccountCode || '4043'),
              amount: Number(payload.amount || 0)
            };
            current.journalEntries = [...(current.journalEntries || []), entry].sort((a, b) => String(a.date).localeCompare(String(b.date)));
            const ok = saveContabilita(current);
            console.log(`[CONTABILITÀ GPP] Registrata spesa automatica: Dare ${entry.debitAccountCode} / Avere ${entry.creditAccountCode} €${entry.amount} (${entry.description})`);
            return sendJson(200, { success: ok, entry, data: current });
          }
          const ok = saveContabilita(payload);
          return sendJson(200, { success: ok });
        } catch (err) {
          return sendJson(400, { success: false, error: err.message });
        }
      });
      return;
    }
  }

  // Alias icone e manifest standard
  if (reqPath === '/favicon.ico' || reqPath === '/icon-192x192.png') {
    reqPath = '/gpp-icon-192.png';
  } else if (reqPath === '/apple-touch-icon.png') {
    reqPath = '/gpp-icon-512.png';
  } else if (reqPath === '/manifest.json') {
    reqPath = '/manifest.webmanifest';
  }

  // Risoluzione prioritaria per asset statici (JS, CSS, PNG, SVG, webmanifest)
  let staticAssetPath = null;
  if (reqPath.includes('/assets/')) {
    const assetSub = reqPath.substring(reqPath.indexOf('/assets/'));
    const candidate = path.join(PUBLIC_DIR, assetSub);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      staticAssetPath = candidate;
    }
  }

  if (!staticAssetPath && (reqPath.endsWith('.js') || reqPath.endsWith('.css') || reqPath.endsWith('.png') || reqPath.endsWith('.svg') || reqPath.endsWith('.webmanifest'))) {
    const baseName = path.basename(reqPath);
    const candidateAsset = path.join(PUBLIC_DIR, 'assets', baseName);
    const candidateRoot = path.join(PUBLIC_DIR, baseName);
    if (fs.existsSync(candidateAsset) && fs.statSync(candidateAsset).isFile()) {
      staticAssetPath = candidateAsset;
    } else if (fs.existsSync(candidateRoot) && fs.statSync(candidateRoot).isFile()) {
      staticAssetPath = candidateRoot;
    }
  }

  if (staticAssetPath) {
    const ext = path.extname(staticAssetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    return fs.readFile(staticAssetPath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Asset non trovato');
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  }

  // Salvaguardia: se un iframe richiede la radice, servi sempre contabilita.html (mai index.html ricorsivo!)
  if (req.headers['sec-fetch-dest'] === 'iframe' && (reqPath === '/' || reqPath === '/index.html')) {
    reqPath = '/registrazioni';
  }

  // Rotte contabili -> servono public/contabilita.html
  if (CONTABILITA_ROUTES.has(reqPath) || reqPath.startsWith('/contabilita/') || reqPath.startsWith('/avanzamento/') || reqPath.startsWith('/registrazioni/')) {
    const contFilePath = path.join(PUBLIC_DIR, 'contabilita.html');
    return fs.readFile(contFilePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Errore caricamento modulo contabilità');
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(data);
    });
  }

  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(PUBLIC_DIR, reqPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
});

const https = require('https');

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server App Giampy attivo su porta ${PORT}:`);
  console.log(`- Locale:    http://localhost:${PORT}`);
  console.log(`- Contabilità: http://localhost:${PORT}/avanzamento`);

  // Keep-Alive automatico ogni 10 minuti per evitare lo spegnimento (spin-down) su Render Free
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://giampylia.onrender.com';
  setInterval(() => {
    try {
      https.get(`${RENDER_URL}/api/auth/status`, (res) => {
        res.resume();
      }).on('error', () => {});
    } catch (e) {}
  }, 10 * 60 * 1000);
});
