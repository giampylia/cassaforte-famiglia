const https = require('https');

const SUPABASE_URL = "https://ptdcobhaefbsqyzqcksh.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0ZGNvYmhhZWZic3F5enFja3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzY2NjgsImV4cCI6MjA5MDY1MjY2OH0.4v7FWAXNTpKniwECWg2Ae0OFKkG_0p2u1qNGHA7fGcA";
const BACKEND_EMAIL = "famylia_backend@gmail.com";
const BACKEND_PASS = "FamyliaPassword2026!";

let cachedToken = null;
let tokenExpiresAt = 0;
let cachedUserId = "0bc8c89d-3dca-4c8b-843e-e2f17825a8f9";

function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${path}`);
    const headers = {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (method === 'POST') headers['Prefer'] = 'return=representation';

    const req = https.request(url, { method, headers, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Supabase request timeout'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function getAuthToken() {
  const now = Date.now();
  if (cachedToken && now < (tokenExpiresAt - 60000)) {
    return { token: cachedToken, userId: cachedUserId };
  }

  try {
    const res = await request('/auth/v1/token?grant_type=password', 'POST', {
      email: BACKEND_EMAIL,
      password: BACKEND_PASS
    });

    if (res.data && res.data.access_token) {
      cachedToken = res.data.access_token;
      tokenExpiresAt = (res.data.expires_at ? res.data.expires_at * 1000 : (now + 3600000));
      if (res.data.user && res.data.user.id) {
        cachedUserId = res.data.user.id;
      }
      return { token: cachedToken, userId: cachedUserId };
    }
  } catch (err) {
    console.warn('[CloudDB] Errore autenticazione Supabase:', err.message);
  }
  return { token: cachedToken, userId: cachedUserId };
}

// Assicura che esista il conto di sistema 9999 per la persistenza cloud
async function ensureSystemAccount(token, userId) {
  try {
    await request('/rest/v1/accounts', 'POST', {
      code: '9999',
      name: 'CLOUD_STORAGE_PERSISTENCE',
      type: 'attivo',
      user_id: userId
    }, token);
  } catch (e) {}
}

/**
 * Salva un evento di parcheggio sul database cloud persistente
 */
async function persistParkingToCloud(user, parking, isRelease = false) {
  try {
    const { token, userId } = await getAuthToken();
    if (!token) return false;

    await ensureSystemAccount(token, userId);

    const payload = {
      type: isRelease ? 'PARKING_RELEASE' : 'PARKING_ACTIVE',
      user: user,
      parking: parking,
      savedAt: new Date().toISOString()
    };

    const res = await request('/rest/v1/journal_entries', 'POST', {
      date: new Date().toISOString().split('T')[0],
      description: JSON.stringify(payload),
      debit_account_code: '9999',
      credit_account_code: '9999',
      amount: 0,
      user_id: userId
    }, token);

    if (res.status === 201) {
      console.log(`[CloudDB] Parcheggio salvato in cloud per ${user}: ${parking ? (parking.addressShort || parking.address) : 'rilasciato'}`);
      return true;
    }
  } catch (err) {
    console.warn('[CloudDB] Errore salvataggio parcheggio su cloud:', err.message);
  }
  return false;
}

/**
 * Recupera l'ultimo stato dei parcheggi dal cloud
 */
async function loadParkingFromCloud() {
  try {
    const { token } = await getAuthToken();
    if (!token) return null;

    const res = await request('/rest/v1/journal_entries?debit_account_code=eq.9999&order=created_at.desc&limit=100', 'GET', null, token);
    if (res.data && Array.isArray(res.data)) {
      const store = {
        Giampy: { active: null, history: [] },
        Ty: { active: null, history: [] },
        Miki: { active: null, history: [] }
      };

      const seenHistIds = { Giampy: new Set(), Ty: new Set(), Miki: new Set() };

      for (const entry of res.data) {
        try {
          if (!entry.description) continue;
          const parsed = JSON.parse(entry.description);
          const u = parsed.user || 'Giampy';
          if (!store[u]) store[u] = { active: null, history: [] };

          if (parsed.type === 'PARKING_ACTIVE' && parsed.parking) {
            // Se non abbiamo ancora un attivo per questo utente, ed è il più recente incontrato
            if (!store[u].active) {
              store[u].active = parsed.parking;
            } else if (!seenHistIds[u].has(parsed.parking.id) && parsed.parking.id !== store[u].active.id) {
              seenHistIds[u].add(parsed.parking.id);
              store[u].history.push(parsed.parking);
            }
          } else if (parsed.type === 'PARKING_RELEASE') {
            // L'utente aveva rilasciato l'auto
            if (store[u].active && parsed.parking && store[u].active.id === parsed.parking.id) {
              store[u].active = null;
            }
          }
        } catch (pe) {}
      }

      console.log('[CloudDB] Parcheggi recuperati da Supabase con successo!');
      return store;
    }
  } catch (err) {
    console.warn('[CloudDB] Errore caricamento parcheggi da cloud:', err.message);
  }
  return null;
}

/**
 * Salva una sottoscrizione push su Supabase
 */
async function persistSubscriptionToCloud(sub) {
  try {
    const { token, userId } = await getAuthToken();
    if (!token || !sub || !sub.subscription) return false;

    await ensureSystemAccount(token, userId);

    const payload = {
      type: 'PUSH_SUBSCRIPTION',
      sub: sub,
      savedAt: new Date().toISOString()
    };

    await request('/rest/v1/journal_entries', 'POST', {
      date: new Date().toISOString().split('T')[0],
      description: JSON.stringify(payload),
      debit_account_code: '9998',
      credit_account_code: '9998',
      amount: 0,
      user_id: userId
    }, token);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Carica tutte le sottoscrizioni push dal cloud
 */
async function loadSubscriptionsFromCloud() {
  try {
    const { token } = await getAuthToken();
    if (!token) return [];

    const res = await request('/rest/v1/journal_entries?debit_account_code=eq.9998&order=created_at.desc&limit=50', 'GET', null, token);
    if (res.data && Array.isArray(res.data)) {
      const subs = [];
      const seenEndpoints = new Set();
      for (const entry of res.data) {
        try {
          const parsed = JSON.parse(entry.description);
          if (parsed.type === 'PUSH_SUBSCRIPTION' && parsed.sub && parsed.sub.subscription && parsed.sub.subscription.endpoint) {
            if (!seenEndpoints.has(parsed.sub.subscription.endpoint)) {
              seenEndpoints.add(parsed.sub.subscription.endpoint);
              subs.push(parsed.sub);
            }
          }
        } catch (e) {}
      }
      return subs;
    }
  } catch (err) {
    console.warn('[CloudDB] Errore caricamento sottoscrizioni:', err.message);
  }
  return [];
}

module.exports = {
  persistParkingToCloud,
  loadParkingFromCloud,
  persistSubscriptionToCloud,
  loadSubscriptionsFromCloud
};
