const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

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
    if (typeof scheduleGitHubBackupPush === 'function') scheduleGitHubBackupPush('data/vault_store.json', data);
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
    if (typeof scheduleGitHubBackupPush === 'function') scheduleGitHubBackupPush('data/acquisti_store.json', data);
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
    if (typeof scheduleGitHubBackupPush === 'function') scheduleGitHubBackupPush('data/lavori_store.json', data);
  } catch (e) {
    console.error('Error saving lavori store:', e);
  }
}

const SPESA_FILE = path.join(__dirname, 'spesa_store.json');
const DEFAULT_SPESA_STORES = ['Eurospin', 'Lidl', 'Maurys', 'Garden 50%', 'Tecnomat'];
const DEFAULT_SPESA_PRODUCTS = [
  'Acqua', 'Affettati', 'Ammorbidente', 'Baguettes', 'Banane', 'Caffè', 'Carne', 'Carta igienica',
  'Chanteclair', 'Coca cola', 'Deodorante', 'Detersivo lavatrice', 'Detersivo piatti',
  'Formaggio', 'Frutta', 'Latte', 'Legumi', 'Olio', 'Pane', 'Pasta', 'Pesce',
  'Pizzette', 'Profiteroles', 'Sapone', 'Scottex', 'Uova', 'Vegano', 'Verdura', 'Wafer',
  'Yogurt', 'Zucchero'
];
const DEFAULT_SPESA_ITEMS = [
  { id: 'sp_1794861438862_661', store: 'Eurospin', product: 'Pizzette', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: false, updatedAt: '2026-11-16T20:37:18.862Z' },
  { id: 'sp_1794861428701_192', store: 'Eurospin', product: 'Yogurt', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: false, updatedAt: '2026-11-16T20:37:08.701Z' },
  { id: 'sp_1794861416805_35', store: 'Eurospin', product: 'Formaggio', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: false, updatedAt: '2026-11-16T20:36:56.806Z' },
  { id: 'sp_1794861410878_375', store: 'Eurospin', product: 'Banane', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: false, updatedAt: '2026-11-16T20:36:50.878Z' },
  { id: 'sp_1794861404414_512', store: 'Eurospin', product: 'Baguettes', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: false, updatedAt: '2026-11-16T20:36:44.414Z' },
  { id: 'sp_init_4', store: 'Eurospin', product: 'legumi', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: false },
  { id: 'sp_init_5', store: 'Eurospin', product: 'olio', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: true },
  { id: 'sp_init_6', store: 'Eurospin', product: 'profiteroles', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: false },
  { id: 'sp_init_7', store: 'Eurospin', product: 'coca cola', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: false },
  { id: 'sp_init_8', store: 'Eurospin', product: 'pane', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: false },
  { id: 'sp_init_9', store: 'Eurospin', product: 'frutta', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: true },
  { id: 'sp_init_10', store: 'Eurospin', product: 'vegano', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: true },
  { id: 'sp_init_11', store: 'Eurospin', product: 'uova', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: true },
  { id: 'sp_init_12', store: 'Eurospin', product: 'wafer', price: '', quantity: 1, total: 0, date: '2026-11-16', checked: false }
];

function getSpesaStore() {
  try {
    if (fs.existsSync(SPESA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SPESA_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          items: Array.isArray(parsed.items) ? parsed.items : DEFAULT_SPESA_ITEMS,
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
          items: Array.isArray(parsed.items) ? parsed.items : DEFAULT_SPESA_ITEMS,
          stores: Array.isArray(parsed.stores) && parsed.stores.length > 0 ? parsed.stores : DEFAULT_SPESA_STORES,
          products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : DEFAULT_SPESA_PRODUCTS
        };
      }
    }
  } catch (e) {
    console.error('Error reading spesa store:', e);
  }
  return { items: DEFAULT_SPESA_ITEMS, stores: DEFAULT_SPESA_STORES, products: DEFAULT_SPESA_PRODUCTS };
}

function saveSpesaStore(data) {
  try {
    if (!data || typeof data !== 'object') return;
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(SPESA_FILE, JSON.stringify(data, null, 2), 'utf8');
    const dataSpesaFile = path.join(__dirname, 'data', 'spesa_store.json');
    fs.writeFileSync(dataSpesaFile, JSON.stringify(data, null, 2), 'utf8');
    if (typeof scheduleGitHubBackupPush === 'function') scheduleGitHubBackupPush('data/spesa_store.json', data);
  } catch (e) {
    console.error('Error saving spesa store:', e);
  }
}

const PARKING_FILE = path.join(__dirname, 'parking.json');
let inMemoryParking = null;

function normalizeParkingUser(u) {
  if (!u) return 'Giampy';
  const s = String(u).trim().toLowerCase();
  if (s === 'giampy' || s === 'giampiero' || s === 'gp') return 'Giampy';
  if (s === 'ty' || s === 'lia') return 'Ty';
  if (s === 'miki' || s === 'michele') return 'Miki';
  return u.charAt(0).toUpperCase() + u.slice(1);
}

function loadParking() {
  if (inMemoryParking) return inMemoryParking;
  let parsed = null;
  try {
    const dataParkingFile = path.join(__dirname, 'data', 'parking.json');
    if (fs.existsSync(dataParkingFile)) {
      parsed = JSON.parse(fs.readFileSync(dataParkingFile, 'utf8'));
    } else if (fs.existsSync(PARKING_FILE)) {
      parsed = JSON.parse(fs.readFileSync(PARKING_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading parking store:', e);
  }
  if (!parsed || typeof parsed !== 'object') {
    parsed = {};
  }
  ['Giampy', 'Ty', 'Miki'].forEach(k => {
    if (!parsed[k]) parsed[k] = { active: null, history: [] };
    if (!Array.isArray(parsed[k].history)) parsed[k].history = [];
  });
  inMemoryParking = parsed;
  return inMemoryParking;
}

function saveParking(data) {
  try {
    if (!data || typeof data !== 'object') return;
    inMemoryParking = data;
    const backupDir = path.join(__dirname, 'data', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(PARKING_FILE, JSON.stringify(data, null, 2), 'utf8');
    const dataParkingFile = path.join(__dirname, 'data', 'parking.json');
    fs.writeFileSync(dataParkingFile, JSON.stringify(data, null, 2), 'utf8');
    if (typeof scheduleGitHubBackupPush === 'function') scheduleGitHubBackupPush('data/parking.json', data);
  } catch (e) {
    console.error('Error saving parking store:', e);
  }
}

function syncParkingWithFamylia(user) {
  return new Promise((resolve) => {
    const u = normalizeParkingUser(user);
    const famUrl = `https://famylia.onrender.com/api/parking?user=${encodeURIComponent(u)}`;
    const req = https.get(famUrl, {
      headers: { 'User-Agent': 'GPPApp/1.0', 'Accept': 'application/json' },
      timeout: 3500
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data && (data.active || Array.isArray(data.history))) {
            const store = loadParking();
            if (!store[u]) store[u] = { active: null, history: [] };

            let changed = false;
            if (data.active) {
              const famTime = new Date(data.active.timestamp || 0).getTime();
              const curTime = store[u].active ? new Date(store[u].active.timestamp || 0).getTime() : 0;
              if (famTime > curTime) {
                if (store[u].active) {
                  store[u].history.unshift(store[u].active);
                }
                store[u].active = data.active;
                changed = true;
                console.log(`[PARKING GPP] Sincronizzato parcheggio attivo da Famylia per ${u}: ${data.active.addressShort}`);
              }
            }

            const seen = new Set();
            const merged = [];
            [...(store[u].history || []), ...(data.history || [])].forEach(it => {
              if (it && it.id && !seen.has(it.id)) {
                seen.add(it.id);
                merged.push(it);
              }
            });
            merged.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
            if (merged.length !== store[u].history.length) {
              store[u].history = merged.slice(0, 500);
              changed = true;
            }

            if (changed) {
              saveParking(store);
            }
          }
        } catch (e) {}
        resolve();
      });
    });
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
  });
}

function fetchJsonWithTimeout(urlStr, timeoutMs = 3500, customHeaders = {}) {
  return new Promise((resolve) => {
    try {
      const parsed = url.parse(urlStr);
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.path,
        method: 'GET',
        headers: Object.assign({
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GPPApp/2.0',
          'Accept': 'application/json'
        }, customHeaders),
        timeout: timeoutMs
      };

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    } catch (e) {
      resolve(null);
    }
  });
}

async function reverseGeocodeServer(lat, lng) {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const fallback = {
    address: `Coordinate GPS (${latNum.toFixed(5)}, ${lngNum.toFixed(5)})`,
    addressShort: `GPS (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`
  };

  if (isNaN(latNum) || isNaN(lngNum) || (latNum === 0 && lngNum === 0)) {
    return { address: 'Posizione non specificata', addressShort: 'Posizione GPS' };
  }

  // 1. TENTATIVO 1: PHOTON (KOMOOT OSM) - Veloce, preciso (via + civico), nessun rate limit o access denied
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${latNum}&lon=${lngNum}`;
    const pData = await fetchJsonWithTimeout(photonUrl, 3500);
    if (pData && pData.features && pData.features.length > 0) {
      const p = pData.features[0].properties;
      const street = p.street || p.name || '';
      const house = p.housenumber ? ' ' + p.housenumber : '';
      const city = p.city || p.locality || p.district || p.town || '';
      if (street) {
        const streetWithHouse = (street + house).trim();
        return {
          addressShort: city ? `${streetWithHouse}, ${city}` : streetWithHouse,
          address: `${streetWithHouse}${city ? ', ' + city : ''}`
        };
      }
    }
  } catch (e) {}

  // 2. TENTATIVO 2: NOMINATIM OPENSTREETMAP
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latNum}&lon=${lngNum}`;
    const nomData = await fetchJsonWithTimeout(nomUrl, 3000, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GPPApp/2.0'
    });
    if (nomData && nomData.address) {
      const a = nomData.address;
      const road = a.road || a.pedestrian || a.street || '';
      const house = a.house_number ? ' ' + a.house_number : '';
      const city = a.city || a.town || a.village || a.municipality || a.suburb || '';
      if (road) {
        const streetWithHouse = (road + house).trim();
        return {
          addressShort: city ? `${streetWithHouse}, ${city}` : streetWithHouse,
          address: `${streetWithHouse}${city ? ', ' + city : ''}`
        };
      } else if (nomData.display_name) {
        const parts = nomData.display_name.split(',');
        const mainLoc = parts[0] ? parts[0].trim() : 'Posizione';
        const locCity = city || (parts[1] ? parts[1].trim() : '');
        return {
          addressShort: locCity && !mainLoc.includes(locCity) ? `${mainLoc}, ${locCity}` : mainLoc,
          address: parts.slice(0, 3).join(', ')
        };
      }
    }
  } catch (e) {}

  // 3. TENTATIVO 3: BIGDATACOLUD (LOCALITY REVERSE GEOCODE)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latNum}&longitude=${lngNum}&localityLanguage=it`;
    const bdcData = await fetchJsonWithTimeout(bdcUrl, 3000);
    if (bdcData && (bdcData.locality || bdcData.city)) {
      const city = bdcData.city || bdcData.locality || '';
      return {
        addressShort: city ? `${city} (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})` : fallback.addressShort,
        address: `${city} - Coordinate (${latNum.toFixed(5)}, ${lngNum.toFixed(5)})`
      };
    }
  } catch (e) {}

  return fallback;
}

const DATA_DIR = path.join(__dirname, 'data');
const CONTABILITA_FILE = path.join(DATA_DIR, 'contabilita.json');
const CONTABILITA_DELETED_FILE = path.join(DATA_DIR, 'deleted_journal_ids.json');
let inMemoryContabilita = null;
let deletedJournalIds = new Set();

const GITHUB_OWNER = 'giampylia';
const GITHUB_REPO = 'cassaforte-famiglia';
const GITHUB_BACKUP_BRANCH = 'backups';
let githubRestorePromise = null;
const githubPushTimers = {};

function loadDeletedIds() {
  try {
    if (fs.existsSync(CONTABILITA_DELETED_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONTABILITA_DELETED_FILE, 'utf8') || '[]');
      if (Array.isArray(data)) deletedJournalIds = new Set(data.map(String));
    }
  } catch (e) {}
}
loadDeletedIds();

function saveDeletedIds() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const list = Array.from(deletedJournalIds);
    fs.writeFileSync(CONTABILITA_DELETED_FILE, JSON.stringify(list), 'utf8');
    scheduleGitHubBackupPush('data/deleted_journal_ids.json', list);
  } catch (e) {}
}

function mergeContabilitaPayload(existing, incoming) {
  if (!existing || typeof existing !== 'object') {
    existing = { accounts: [], budgetEntries: [], journalEntries: [] };
  }
  if (!incoming || typeof incoming !== 'object') return existing;

  // 1. Accounts merge (mantiene codici esistenti e aggiunge nuovi)
  const accountMap = new Map();
  (existing.accounts || []).forEach(a => { if (a && a.code) accountMap.set(String(a.code), a); });
  (incoming.accounts || []).forEach(a => { if (a && a.code) accountMap.set(String(a.code), a); });
  const mergedAccounts = Array.from(accountMap.values()).sort((a, b) => String(a.code).localeCompare(String(b.code)));

  // 2. Budgets merge
  const budgetMap = new Map();
  (existing.budgetEntries || []).forEach(b => { if (b && b.accountCode) budgetMap.set(String(b.accountCode), b); });
  (incoming.budgetEntries || []).forEach(b => { if (b && b.accountCode) budgetMap.set(String(b.accountCode), b); });
  const mergedBudgets = Array.from(budgetMap.values());

  // 3. Journal Entries merge (preserva sempre tutte le registrazioni e protegge modifiche più recenti via updatedAt)
  const journalMap = new Map();
  (existing.journalEntries || []).forEach(e => {
    if (e && e.id && !deletedJournalIds.has(String(e.id))) {
      journalMap.set(String(e.id), e);
    }
  });
  (incoming.journalEntries || []).forEach(e => {
    if (e && e.id && !deletedJournalIds.has(String(e.id))) {
      const id = String(e.id);
      const prev = journalMap.get(id);
      if (!prev) {
        journalMap.set(id, e);
      } else {
        const prevTs = Number(prev.updatedAt || 0);
        const incTs = Number(e.updatedAt || 0);
        if (prevTs > incTs) {
          // Non permettere che una sync vecchia o senza timestamp sovrascriva una modifica più recente
          journalMap.set(id, prev);
        } else {
          journalMap.set(id, { ...prev, ...e });
        }
      }
    }
  });

  const mergedJournal = Array.from(journalMap.values()).sort((a, b) => {
    const da = String(a.date || '');
    const db = String(b.date || '');
    return da.localeCompare(db);
  });

  return {
    accounts: mergedAccounts.length > 0 ? mergedAccounts : (existing.accounts || []),
    budgetEntries: mergedBudgets.length > 0 ? mergedBudgets : (existing.budgetEntries || []),
    journalEntries: mergedJournal.length === 0 && (existing.journalEntries || []).length > 0
      ? existing.journalEntries
      : mergedJournal
  };
}

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

function saveContabilita(payload, forceOverwrite = false) {
  try {
    if (!payload || typeof payload !== 'object') return false;
    let toSave = payload;
    if (!forceOverwrite) {
      const current = loadContabilita();
      toSave = mergeContabilitaPayload(current, payload);
    }
    inMemoryContabilita = toSave;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const serialized = JSON.stringify(toSave, null, 2);
    fs.writeFileSync(CONTABILITA_FILE, serialized, 'utf8');
    try {
      fs.writeFileSync(path.join(PUBLIC_DIR, 'contabilita-data.json'), serialized, 'utf8');
      const backupDir = path.join(DATA_DIR, 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, 'contabilita_latest.json'), serialized, 'utf8');
    } catch (e) {}
    scheduleGitHubBackupPush('data/contabilita.json', toSave);
    return toSave;
  } catch (err) {
    console.error('[Contabilità] Errore salvataggio:', err.message);
    return false;
  }
}

function fetchRawGitHubJson(relPath, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BACKUP_BRANCH}/${relPath}?_t=${Date.now()}`;
    const req = https.get(rawUrl, {
      headers: { 'User-Agent': 'GPPApp-Recovery/1.0', 'Accept': 'application/json' },
      timeout: timeoutMs
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function mergeSimpleItemsById(existingItems, backupItems) {
  const map = new Map();
  (existingItems || []).forEach(it => { if (it && it.id) map.set(String(it.id), it); });
  (backupItems || []).forEach(it => {
    if (it && it.id) {
      const key = String(it.id);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, it);
      } else {
        const prevTs = new Date(prev.updatedAt || prev.timestamp || 0).getTime() || 0;
        const bkpTs = new Date(it.updatedAt || it.timestamp || 0).getTime() || 0;
        if (bkpTs > prevTs) map.set(key, { ...prev, ...it });
      }
    }
  });
  return Array.from(map.values());
}

function restoreFromGitHubBackupsOnce() {
  if (githubRestorePromise) return githubRestorePromise;
  githubRestorePromise = (async () => {
    try {
      const [delIds, remoteCont, remoteVault, remoteAcq, remoteLav, remoteSpesa, remotePark] = await Promise.all([
        fetchRawGitHubJson('data/deleted_journal_ids.json'),
        fetchRawGitHubJson('data/contabilita.json'),
        fetchRawGitHubJson('data/vault_store.json'),
        fetchRawGitHubJson('data/acquisti_store.json'),
        fetchRawGitHubJson('data/lavori_store.json'),
        fetchRawGitHubJson('data/spesa_store.json'),
        fetchRawGitHubJson('data/parking.json')
      ]);

      if (Array.isArray(delIds) && delIds.length > 0) {
        let changedDel = false;
        delIds.forEach(id => {
          const s = String(id);
          if (!deletedJournalIds.has(s)) {
            deletedJournalIds.add(s);
            changedDel = true;
          }
        });
        if (changedDel) saveDeletedIds();
      }

      if (remoteCont && Array.isArray(remoteCont.journalEntries) && remoteCont.journalEntries.length > 0) {
        const current = loadContabilita();
        const curIds = new Set((current.journalEntries || []).map(e => String(e.id)));
        const hasNew = remoteCont.journalEntries.some(e => e && e.id && !deletedJournalIds.has(String(e.id)) && !curIds.has(String(e.id)));
        if (hasNew || deletedJournalIds.size > 0) {
          const merged = mergeContabilitaPayload(current, remoteCont);
          if (merged.journalEntries.length !== (current.journalEntries || []).length || hasNew) {
            inMemoryContabilita = merged;
            fs.mkdirSync(DATA_DIR, { recursive: true });
            fs.writeFileSync(CONTABILITA_FILE, JSON.stringify(merged, null, 2), 'utf8');
            try { fs.writeFileSync(path.join(PUBLIC_DIR, 'contabilita-data.json'), JSON.stringify(merged, null, 2), 'utf8'); } catch (e) {}
            console.log(`[GITHUB RECOVERY] Ripristinata contabilità da branch backups: ${merged.journalEntries.length} movimenti`);
          }
        }
      }

      if (remoteVault && Array.isArray(remoteVault.items) && remoteVault.items.length > 0) {
        const curV = getVaultStore();
        const mergedV = mergeSimpleItemsById(curV.items, remoteVault.items);
        if (mergedV.length > (curV.items || []).length) {
          saveVaultStore({ items: mergedV, updatedAt: new Date().toISOString() });
        }
      }

      if (remoteAcq && Array.isArray(remoteAcq.items) && remoteAcq.items.length > 0) {
        const curA = getAcquistiStore();
        const mergedA = mergeSimpleItemsById(curA.items, remoteAcq.items);
        if (mergedA.length > (curA.items || []).length) {
          saveAcquistiStore({ items: mergedA });
        }
      }

      if (remoteLav && Array.isArray(remoteLav.items) && remoteLav.items.length > 0) {
        const curL = getLavoriStore();
        const mergedL = mergeSimpleItemsById(curL.items, remoteLav.items);
        if (mergedL.length > (curL.items || []).length) {
          saveLavoriStore({ items: mergedL });
        }
      }

      if (remoteSpesa && Array.isArray(remoteSpesa.items) && remoteSpesa.items.length > 0) {
        const curS = getSpesaStore();
        const mergedS = mergeSimpleItemsById(curS.items, remoteSpesa.items);
        if (mergedS.length > (curS.items || []).length) {
          saveSpesaStore({ ...curS, items: mergedS });
        }
      }

      if (remotePark && typeof remotePark === 'object') {
        const curP = loadParking();
        let changedP = false;
        Object.keys(remotePark).forEach(u => {
          const rUser = remotePark[u];
          if (!rUser || typeof rUser !== 'object') return;
          if (!curP[u]) curP[u] = { active: null, history: [] };
          if (rUser.active) {
            const rTs = new Date(rUser.active.timestamp || 0).getTime();
            const cTs = curP[u].active ? new Date(curP[u].active.timestamp || 0).getTime() : 0;
            if (rTs > cTs) {
              if (curP[u].active) curP[u].history.unshift(curP[u].active);
              curP[u].active = rUser.active;
              changedP = true;
            }
          }
          const combinedH = mergeSimpleItemsById(curP[u].history, rUser.history || []);
          if (combinedH.length > curP[u].history.length) {
            combinedH.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
            curP[u].history = combinedH.slice(0, 500);
            changedP = true;
          }
        });
        if (changedP) saveParking(curP);
      }
    } catch (err) {
      console.warn('[GITHUB RECOVERY] Avviso ripristino:', err.message);
    }
  })();
  return githubRestorePromise;
}

function githubApiRequest(apiPath, method = 'GET', bodyObj = null) {
  return new Promise((resolve) => {
    const token = process.env.GITHUB_TOKEN || process.env.GH_BACKUP_TOKEN;
    if (!token) return resolve({ status: 0, skipped: true });
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const headers = {
      'User-Agent': 'GPPApp-Backup/1.0',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json'
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers,
      timeout: 8000
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', () => resolve({ status: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0 }); });
    if (body) req.write(body);
    req.end();
  });
}

async function pushFileToGitHubBackupBranch(relPath, dataObj) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_BACKUP_TOKEN;
  if (!token) return;
  try {
    const apiPath = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${relPath}`;
    const existing = await githubApiRequest(`${apiPath}?ref=${GITHUB_BACKUP_BRANCH}`, 'GET');
    const contentB64 = Buffer.from(JSON.stringify(dataObj, null, 2), 'utf8').toString('base64');
    const payload = {
      message: `auto-backup(${relPath}): ${new Date().toISOString()}`,
      content: contentB64,
      branch: GITHUB_BACKUP_BRANCH
    };
    if (existing.status === 200 && existing.data && existing.data.sha) {
      payload.sha = existing.data.sha;
    }
    const putRes = await githubApiRequest(apiPath, 'PUT', payload);
    if (putRes.status === 200 || putRes.status === 201) {
      console.log(`[GITHUB BACKUP] Salvato in tempo reale su branch ${GITHUB_BACKUP_BRANCH}: ${relPath}`);
    }
  } catch (err) {
    console.warn('[GITHUB BACKUP] Errore push:', err.message);
  }
}

function scheduleGitHubBackupPush(relPath, dataObj) {
  if (!process.env.GITHUB_TOKEN && !process.env.GH_BACKUP_TOKEN) return;
  if (githubPushTimers[relPath]) clearTimeout(githubPushTimers[relPath]);
  githubPushTimers[relPath] = setTimeout(() => {
    pushFileToGitHubBackupBranch(relPath, dataObj);
  }, 2000);
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

const server = http.createServer(async (req, res) => {
  let reqPath = req.url.split('?')[0];

  // Helper per inviare risposte JSON (con GZIP e ETag opzionale per ridurre la banda)
  const sendJson = (status, obj, opts = {}) => {
    const jsonStr = JSON.stringify(obj);
    if (opts && opts.etag) {
      const clientTag = req.headers['if-none-match'];
      if (clientTag && clientTag === opts.etag) {
        res.writeHead(304, {
          'ETag': opts.etag,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        res.end();
        return;
      }
    }
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': opts && opts.etag ? 'no-cache' : 'no-store, no-cache, must-revalidate, max-age=0'
    };
    if (opts && opts.etag) headers['ETag'] = opts.etag;

    const acceptEnc = String(req.headers['accept-encoding'] || '');
    if (jsonStr.length > 1024 && acceptEnc.includes('gzip')) {
      try {
        const gz = zlib.gzipSync(jsonStr);
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(status, headers);
        res.end(gz);
        return;
      } catch (e) {}
    }
    res.writeHead(status, headers);
    res.end(jsonStr);
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
      await restoreFromGitHubBackupsOnce();
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
      await restoreFromGitHubBackupsOnce();
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
      await restoreFromGitHubBackupsOnce();
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
      await restoreFromGitHubBackupsOnce();
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

  // 3. API PARKING & AUTO-PARK (Compatibilità totale MacroDroid, Comandi Rapidi iOS, Webhook e App)
  if (reqPath === '/api/auto-park' || reqPath === '/api/parking/auto-park' || reqPath.startsWith('/api/parking')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const query = parsedUrl.query || {};

    // 1. GET /api/parking (Restituisce parcheggio attivo e storico dell'utente, sincronizzando da Famylia)
    if (reqPath === '/api/parking' && req.method === 'GET') {
      await restoreFromGitHubBackupsOnce();
      const user = normalizeParkingUser(query.user || 'Giampy');
      syncParkingWithFamylia(user).finally(() => {
        const store = loadParking();
        const userData = store[user] || { active: null, history: [] };
        return sendJson(200, {
          user: user,
          active: userData.active || null,
          history: userData.history || []
        });
      });
      return;
    }

    // 1b. GET /api/parking/resolve-geo (Risoluzione geocodifica inversa via Photon/OSM per qualsiasi coordinata)
    if (reqPath === '/api/parking/resolve-geo' && req.method === 'GET') {
      const qLat = query.lat || query.latitude;
      const qLng = query.lng || query.lon || query.longitude;
      const geo = await reverseGeocodeServer(qLat, qLng);
      return sendJson(200, geo);
    }

    // 2. GET o POST /api/auto-park (Compatibile al 100% con MacroDroid, Scorciatoie iOS, Webhook)
    if ((reqPath === '/api/auto-park' || reqPath === '/api/parking/auto-park') && (req.method === 'GET' || req.method === 'POST')) {
      const handleAutoPark = async (body) => {
        try {
          const rawUser = query.user || body.user;
          const rawPin = query.pin || body.pin;
          const user = normalizeParkingUser(rawUser || rawPin || 'Giampy');

          let rawLat = query.lat || query.latitude || body.lat || body.latitude;
          let rawLng = query.lng || query.lon || query.longitude || body.lng || body.lon;
          const rawLoc = query.loc || query.location || body.loc || body.location;

          // Se rawLat e rawLng sono presenti entrambi, converti l'eventuale virgola decimale (es. 39,225 inviato da MacroDroid italiano) in punto
          if (rawLat && rawLng) {
            rawLat = String(rawLat).trim().replace(',', '.');
            rawLng = String(rawLng).trim().replace(',', '.');
          } else if ((!rawLat || !rawLng) && rawLoc && typeof rawLoc === 'string' && rawLoc.includes(',')) {
            const parts = rawLoc.split(',');
            if (parts.length === 4) {
              // Caso loc="39,2252,9,1289"
              rawLat = `${parts[0].trim()}.${parts[1].trim()}`;
              rawLng = `${parts[2].trim()}.${parts[3].trim()}`;
            } else {
              rawLat = parts[0].trim().replace(',', '.');
              rawLng = parts[1].trim().replace(',', '.');
            }
          } else if (rawLat && typeof rawLat === 'string' && rawLat.includes(',') && !rawLng) {
            const parts = rawLat.split(',');
            rawLat = parts[0].trim();
            rawLng = parts[1].trim();
          }

          // Pulisci eventuali placeholder non risolti da MacroDroid (es. "[last_loc_lat]", "0.0", "null")
          const isPlaceholder = (v) => !v || v.includes('[') || v.includes('{') || v === 'null' || v === 'undefined' || v === '0' || v === '0.0';

          let lat = isPlaceholder(rawLat) ? NaN : parseFloat(rawLat);
          let lng = isPlaceholder(rawLng) ? NaN : parseFloat(rawLng);
          if (lat === 0 && lng === 0) {
            lat = NaN;
            lng = NaN;
          }

          const accuracy = Math.round(parseFloat(String(query.accuracy || body.accuracy || 5).replace(',', '.')) || 5);
          const trigger = query.trigger || body.trigger || 'bluetooth_auto';
          const notes = (query.notes || body.notes || '').trim();

          const parkingStore = loadParking();
          if (!parkingStore[user]) parkingStore[user] = { active: null, history: [] };
          if (!Array.isArray(parkingStore[user].history)) parkingStore[user].history = [];

          let geo;
          if (isNaN(lat) || isNaN(lng)) {
            const lastKnown = parkingStore[user].active || (parkingStore[user].history.length > 0 ? parkingStore[user].history[0] : null);
            if (lastKnown && lastKnown.lat && lastKnown.lng) {
              lat = lastKnown.lat;
              lng = lastKnown.lng;
              geo = {
                addressShort: lastKnown.addressShort || 'Ultima posizione nota',
                address: lastKnown.address || 'Posizione precedente'
              };
            } else {
              lat = 0;
              lng = 0;
              geo = {
                addressShort: 'Parcheggio registrato',
                address: 'Motore spento rilevato - Attiva il GPS per la via esatta'
              };
            }
          } else {
            geo = await reverseGeocodeServer(lat, lng);
          }

          // Debounce: se è arrivata una richiesta identica/ripetuta entro 35 secondi, non creare 25 duplicati nello storico
          const isRecentDuplicate = parkingStore[user].active &&
            parkingStore[user].active.lat &&
            (Date.now() - new Date(parkingStore[user].active.timestamp).getTime() < 35000);

          if (parkingStore[user].active && !isRecentDuplicate) {
            parkingStore[user].history.unshift(parkingStore[user].active);
            if (parkingStore[user].history.length > 500) {
              parkingStore[user].history = parkingStore[user].history.slice(0, 500);
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
          console.log(`[PARKING GPP] Auto parcheggiata salvata per ${user}: ${geo.addressShort} (trigger: ${trigger})`);

          // Mirroring verso famylia.onrender.com per allineamento totale bidirezionale
          try {
            const famMirrorUrl = `https://famylia.onrender.com/api/auto-park?user=${encodeURIComponent(user)}&lat=${lat}&lng=${lng}&accuracy=${accuracy}&trigger=${encodeURIComponent(trigger)}&notes=${encodeURIComponent(notes)}`;
            https.get(famMirrorUrl, { timeout: 4000 }, () => {}).on('error', () => {});
          } catch (e) {}

          if (query.format === 'html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(`
              <!DOCTYPE html>
              <html lang="it">
              <head><meta charset="utf-8"><title>Auto Parcheggiata</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
              <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:#061120; color:#fff; text-align:center; padding:40px 20px;">
                <div style="font-size:3.5rem; margin-bottom:12px;">🚗</div>
                <h2 style="color:#fbbf24; margin:0 0 10px 0; font-size:1.4rem;">Posizione Auto Salvata!</h2>
                <div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:16px; padding:20px; max-width:360px; margin:0 auto 24px auto;">
                  <div style="font-weight:700; font-size:1.15rem; color:#f8fafc; margin-bottom:6px;">${geo.addressShort}</div>
                  <div style="font-size:0.85rem; color:#94a3b8; line-height:1.4;">${geo.address}</div>
                  <div style="margin-top:12px; font-size:0.8rem; color:#38bdf8; font-weight:600;">Auto di ${user}</div>
                </div>
                <a href="/" style="display:inline-block; background:#fbbf24; color:#061120; font-weight:700; padding:12px 28px; border-radius:12px; text-decoration:none;">Apri App Giampy</a>
              </body>
              </html>
            `);
          }

          return sendJson(200, { success: true, user, active: newParking });
        } catch (err) {
          console.error('[PARKING GPP] Errore auto-park:', err);
          return sendJson(500, { error: err.message });
        }
      };

      if (req.method === 'POST') {
        let rawBody = '';
        req.on('data', chunk => { rawBody += chunk; });
        req.on('end', () => {
          let bodyData = {};
          try { if (rawBody) bodyData = JSON.parse(rawBody); } catch (e) {}
          handleAutoPark(bodyData);
        });
        return;
      } else {
        return handleAutoPark({});
      }
    }

    // 3. POST endpoints per azioni dal client: manual, release, note, delete-item, clear-history, restore
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let data = {};
      try { if (body) data = JSON.parse(body); } catch (e) {}
      const user = normalizeParkingUser(data.user || query.user || 'Giampy');
      const parkingStore = loadParking();
      if (!parkingStore[user]) parkingStore[user] = { active: null, history: [] };

      if (reqPath === '/api/parking/manual' && req.method === 'POST') {
        let entry = data.entry || data;
        if (entry.lat && entry.lng && (!entry.address || entry.address.startsWith('Coordinate GPS') || entry.address.startsWith('GPS ('))) {
          try {
            const geo = await reverseGeocodeServer(entry.lat, entry.lng);
            if (geo && geo.addressShort && geo.addressShort !== 'Posizione GPS') {
              entry.addressShort = geo.addressShort;
              entry.address = geo.address;
            }
          } catch (e) {}
        }
        if (parkingStore[user].active) {
          parkingStore[user].history.unshift(parkingStore[user].active);
          if (parkingStore[user].history.length > 500) {
            parkingStore[user].history = parkingStore[user].history.slice(0, 500);
          }
        }
        parkingStore[user].active = entry;
        saveParking(parkingStore);
        return sendJson(200, { success: true, active: entry });
      }

      if (reqPath === '/api/parking/update-address' && req.method === 'POST') {
        const { id, address, addressShort, lat, lng } = data;
        if (parkingStore[user].active && (!id || parkingStore[user].active.id === id)) {
          if (address) parkingStore[user].active.address = address;
          if (addressShort) parkingStore[user].active.addressShort = addressShort;
          if (lat && lng) {
            parkingStore[user].active.lat = parseFloat(lat);
            parkingStore[user].active.lng = parseFloat(lng);
          }
          saveParking(parkingStore);
          return sendJson(200, { success: true, active: parkingStore[user].active });
        }
        return sendJson(200, { success: false, message: 'Nessun parcheggio attivo' });
      }

      if (reqPath === '/api/parking/release' && req.method === 'POST') {
        if (parkingStore[user].active) {
          parkingStore[user].active.releasedAt = new Date().toISOString();
          parkingStore[user].history.unshift(parkingStore[user].active);
          if (parkingStore[user].history.length > 500) {
            parkingStore[user].history = parkingStore[user].history.slice(0, 500);
          }
          parkingStore[user].active = null;
          saveParking(parkingStore);
        }
        return sendJson(200, { success: true });
      }

      if (reqPath === '/api/parking/note' && req.method === 'POST') {
        if (parkingStore[user].active) {
          parkingStore[user].active.notes = (data.note || '').trim();
          saveParking(parkingStore);
        }
        return sendJson(200, { success: true });
      }

      if (reqPath === '/api/parking/delete-item' && req.method === 'POST') {
        const idToDelete = data.id;
        parkingStore[user].history = parkingStore[user].history.filter(h => h.id !== idToDelete);
        if (parkingStore[user].active && parkingStore[user].active.id === idToDelete) {
          parkingStore[user].active = null;
        }
        saveParking(parkingStore);
        return sendJson(200, { success: true });
      }

      if (reqPath === '/api/parking/clear-history' && req.method === 'POST') {
        parkingStore[user].history = [];
        saveParking(parkingStore);
        return sendJson(200, { success: true });
      }

      if (reqPath === '/api/parking/restore' && req.method === 'POST') {
        if (data.parking) {
          const clientTime = new Date(data.parking.timestamp || 0).getTime();
          const serverTime = parkingStore[user].active ? new Date(parkingStore[user].active.timestamp || 0).getTime() : 0;
          if (!parkingStore[user].active || clientTime >= serverTime) {
            parkingStore[user].active = data.parking;
            saveParking(parkingStore);
          }
        }
        return sendJson(200, { success: true, active: parkingStore[user].active });
      }

      return sendJson(404, { error: 'Endpoint parcheggio non trovato' });
    });
    return;
  }

  // 4. API Contabilità & Bilancio (Persistenza reale registrazioni e conti)
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

    await restoreFromGitHubBackupsOnce();

    if (reqPath === '/api/contabilita/deleted-ids' && req.method === 'GET') {
      return sendJson(200, { success: true, deletedIds: Array.from(deletedJournalIds) });
    }

    if (req.method === 'GET') {
      const data = loadContabilita();
      const deletedIds = Array.from(deletedJournalIds);
      const etagHash = crypto
        .createHash('sha1')
        .update(JSON.stringify({ len: (data.journalEntries || []).length, j: data.journalEntries, del: deletedIds }))
        .digest('hex')
        .slice(0, 16);
      return sendJson(200, { success: true, data, deletedIds }, { etag: `W/"cont_${etagHash}"` });
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (reqPath === '/api/contabilita/add-entry') {
            const src = payload.entry || payload;
            const entry = {
              id: src.id || ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
              })),
              date: src.date || new Date().toISOString().split('T')[0],
              description: String(src.description || 'SPESA').trim().toUpperCase(),
              debitAccountCode: String(src.debitAccountCode || '6110'),
              creditAccountCode: String(src.creditAccountCode || '4043'),
              amount: Number(src.amount || 0),
              updatedAt: Number(src.updatedAt || Date.now())
            };
            const saved = saveContabilita({ journalEntries: [entry] }, false);
            console.log(`[CONTABILITÀ GPP] Registrato movimento: Dare ${entry.debitAccountCode} / Avere ${entry.creditAccountCode} €${entry.amount} (${entry.description})`);
            return sendJson(200, { success: !!saved, entry, data: saved, deletedIds: Array.from(deletedJournalIds) });
          }
          if (reqPath === '/api/contabilita/update-entry') {
            const src = payload.entry || payload;
            if (!src || !src.id) {
              return sendJson(400, { success: false, error: 'ID mancante' });
            }
            const entry = {
              id: String(src.id),
              date: src.date || new Date().toISOString().split('T')[0],
              description: String(src.description || '').trim().toUpperCase(),
              debitAccountCode: String(src.debitAccountCode || ''),
              creditAccountCode: String(src.creditAccountCode || ''),
              amount: Number(src.amount || 0),
              updatedAt: Number(src.updatedAt || Date.now())
            };
            if (deletedJournalIds.has(entry.id)) {
              deletedJournalIds.delete(entry.id);
              saveDeletedIds();
            }
            const saved = saveContabilita({ journalEntries: [entry] }, false);
            console.log(`[CONTABILITÀ GPP] Aggiornata registrazione ${entry.id}: €${entry.amount} (${entry.description})`);
            return sendJson(200, { success: !!saved, entry, data: saved, deletedIds: Array.from(deletedJournalIds) });
          }
          if (reqPath === '/api/contabilita/delete-entry') {
            const current = loadContabilita();
            const ids = Array.isArray(payload.ids) ? payload.ids : (payload.id ? [payload.id] : []);
            const idSet = new Set(ids.map(String));
            if (idSet.size > 0) {
              idSet.forEach(id => deletedJournalIds.add(id));
              saveDeletedIds();
              current.journalEntries = (current.journalEntries || []).filter(e => !idSet.has(String(e.id)));
              saveContabilita(current, true);
              console.log(`[CONTABILITÀ GPP] Eliminate registrazioni ID: ${Array.from(idSet).join(', ')}`);
            }
            return sendJson(200, { success: true, data: current, deletedIds: Array.from(deletedJournalIds) });
          }
          if (reqPath === '/api/contabilita/sync-merge') {
            const saved = saveContabilita(payload, false);
            const count = saved && Array.isArray(saved.journalEntries) ? saved.journalEntries.length : 0;
            console.log(`[CONTABILITÀ GPP] Sincronizzazione bi-direzionale smartphone/PC completata. Totale registrazioni unite: ${count}`);
            return sendJson(200, { success: !!saved, data: saved, totalEntries: count, deletedIds: Array.from(deletedJournalIds) });
          }
          const saved = saveContabilita(payload, false);
          return sendJson(200, { success: !!saved, data: saved, deletedIds: Array.from(deletedJournalIds) });
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server App Giampy attivo su porta ${PORT}:`);
  console.log(`- Locale:    http://localhost:${PORT}`);
  console.log(`- Contabilità: http://localhost:${PORT}/avanzamento`);

  restoreFromGitHubBackupsOnce();

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
