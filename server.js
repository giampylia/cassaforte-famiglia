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
      return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading vault store:', e);
  }
  return { items: [] };
}

function saveVaultStore(data) {
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving vault store:', e);
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

  // Alias icone e manifest standard
  if (reqPath === '/favicon.ico' || reqPath === '/icon-192x192.png') {
    reqPath = '/gpp-icon-192.png';
  } else if (reqPath === '/apple-touch-icon.png') {
    reqPath = '/gpp-icon-512.png';
  } else if (reqPath === '/manifest.json') {
    reqPath = '/manifest.webmanifest';
  }

  // Rotte contabili -> servono public/contabilita.html
  if (CONTABILITA_ROUTES.has(reqPath) || reqPath.startsWith('/contabilita/')) {
    const contFilePath = path.join(PUBLIC_DIR, 'contabilita.html');
    fs.readFile(contFilePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Errore caricamento modulo contabilità');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(data);
    });
    return;
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server App Giampy attivo su porta ${PORT}:`);
  console.log(`- Locale:    http://localhost:${PORT}`);
  console.log(`- Contabilità: http://localhost:${PORT}/avanzamento`);
});
