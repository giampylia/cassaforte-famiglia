/**
 * CASSAFORTE DI FAMIGLIA - MOTORE CRITTOGRAFICO & LOGICA APPLICATIVA
 * Crittografia End-to-End AES-256-CTR tramite puro JavaScript (senza dipendenze esterne o crypto.subtle)
 * Sezioni: PW, BANCA, INFO CASE, NOTE, CASSAFORTE, MESSAGGI
 * Notifiche Push su Smartphone & Web Badging API (notifiche sull'icona dell'app)
 * Messaggistica istantanea interna 1-click (Invia -> Notifica sullo smartphone -> Apri app e vedi messaggio)
 */

const STATE = {
  masterKey: null,
  isUnlocked: false,
  activeSection: 'grid',
  entries: [],
  currentSender: 'Giampy',
  encryptedVault: null,
  autoLockTimer: null,
  notificationsEnabled: false
};

const VERIFICATION_STRING = 'FAMILY_VAULT_SECURE_TOKEN_OK';

// ==========================================
// 1. MOTORE CRITTOGRAFICO AES-256 PURO JS (100% COMPATIBILE ANCHE SU HTTP E CELLULARI)
// ==========================================

const SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
]);

const RCON = new Uint32Array([
  0x00000000, 0x01000000, 0x02000000, 0x04000000, 0x08000000,
  0x10000000, 0x20000000, 0x40000000, 0x80000000, 0x1b000000, 0x36000000
]);

function subWord(w) {
  return (SBOX[(w >>> 24) & 0xff] << 24) |
         (SBOX[(w >>> 16) & 0xff] << 16) |
         (SBOX[(w >>> 8) & 0xff] << 8) |
         (SBOX[w & 0xff]);
}

function rotWord(w) {
  return (w << 8) | (w >>> 24);
}

function expandKey(keyBytes) {
  const w = new Uint32Array(60);
  for (let i = 0; i < 8; i++) {
    w[i] = (keyBytes[i * 4] << 24) | (keyBytes[i * 4 + 1] << 16) | (keyBytes[i * 4 + 2] << 8) | (keyBytes[i * 4 + 3]);
  }
  for (let i = 8; i < 60; i++) {
    let temp = w[i - 1];
    if (i % 8 === 0) {
      temp = subWord(rotWord(temp)) ^ RCON[i / 8];
    } else if (i % 8 === 4) {
      temp = subWord(temp);
    }
    w[i] = w[i - 8] ^ temp;
  }
  return w;
}

function cipherBlock(input, out, offset, roundKeys) {
  let s0 = (input[0] << 24) | (input[1] << 16) | (input[2] << 8) | input[3];
  let s1 = (input[4] << 24) | (input[5] << 16) | (input[6] << 8) | input[7];
  let s2 = (input[8] << 24) | (input[9] << 16) | (input[10] << 8) | input[11];
  let s3 = (input[12] << 24) | (input[13] << 16) | (input[14] << 8) | input[15];

  s0 ^= roundKeys[0]; s1 ^= roundKeys[1]; s2 ^= roundKeys[2]; s3 ^= roundKeys[3];

  function xtime(x) { return ((x << 1) ^ ((x >>> 7) * 0x11b)) & 0xff; }

  for (let round = 1; round <= 13; round++) {
    const kOffset = round * 4;
    const b0 = SBOX[(s0 >>> 24) & 0xff], b1 = SBOX[(s1 >>> 16) & 0xff], b2 = SBOX[(s2 >>> 8) & 0xff], b3 = SBOX[s3 & 0xff];
    const b4 = SBOX[(s1 >>> 24) & 0xff], b5 = SBOX[(s2 >>> 16) & 0xff], b6 = SBOX[(s3 >>> 8) & 0xff], b7 = SBOX[s0 & 0xff];
    const b8 = SBOX[(s2 >>> 24) & 0xff], b9 = SBOX[(s3 >>> 16) & 0xff], b10 = SBOX[(s0 >>> 8) & 0xff], b11 = SBOX[s1 & 0xff];
    const b12 = SBOX[(s3 >>> 24) & 0xff], b13 = SBOX[(s0 >>> 16) & 0xff], b14 = SBOX[(s1 >>> 8) & 0xff], b15 = SBOX[s2 & 0xff];

    s0 = ((xtime(b0) ^ xtime(b1) ^ b1 ^ b2 ^ b3) << 24) |
         ((b0 ^ xtime(b1) ^ xtime(b2) ^ b2 ^ b3) << 16) |
         ((b0 ^ b1 ^ xtime(b2) ^ xtime(b3) ^ b3) << 8) |
         (xtime(b0) ^ b0 ^ b1 ^ b2 ^ xtime(b3)) ^ roundKeys[kOffset];

    s1 = ((xtime(b4) ^ xtime(b5) ^ b5 ^ b6 ^ b7) << 24) |
         ((b4 ^ xtime(b5) ^ xtime(b6) ^ b6 ^ b7) << 16) |
         ((b4 ^ b5 ^ xtime(b6) ^ xtime(b7) ^ b7) << 8) |
         (xtime(b4) ^ b4 ^ b5 ^ b6 ^ xtime(b7)) ^ roundKeys[kOffset + 1];

    s2 = ((xtime(b8) ^ xtime(b9) ^ b9 ^ b10 ^ b11) << 24) |
         ((b8 ^ xtime(b9) ^ xtime(b10) ^ b10 ^ b11) << 16) |
         ((b8 ^ b9 ^ xtime(b10) ^ xtime(b11) ^ b11) << 8) |
         (xtime(b8) ^ b8 ^ b9 ^ b10 ^ xtime(b11)) ^ roundKeys[kOffset + 2];

    s3 = ((xtime(b12) ^ xtime(b13) ^ b13 ^ b14 ^ b15) << 24) |
         ((b12 ^ xtime(b13) ^ xtime(b14) ^ b14 ^ b15) << 16) |
         ((b12 ^ b13 ^ xtime(b14) ^ xtime(b15) ^ b15) << 8) |
         (xtime(b12) ^ b12 ^ b13 ^ b14 ^ xtime(b15)) ^ roundKeys[kOffset + 3];
  }

  const b0 = SBOX[(s0 >>> 24) & 0xff], b1 = SBOX[(s1 >>> 16) & 0xff], b2 = SBOX[(s2 >>> 8) & 0xff], b3 = SBOX[s3 & 0xff];
  const b4 = SBOX[(s1 >>> 24) & 0xff], b5 = SBOX[(s2 >>> 16) & 0xff], b6 = SBOX[(s3 >>> 8) & 0xff], b7 = SBOX[s0 & 0xff];
  const b8 = SBOX[(s2 >>> 24) & 0xff], b9 = SBOX[(s3 >>> 16) & 0xff], b10 = SBOX[(s0 >>> 8) & 0xff], b11 = SBOX[s1 & 0xff];
  const b12 = SBOX[(s3 >>> 24) & 0xff], b13 = SBOX[(s0 >>> 16) & 0xff], b14 = SBOX[(s1 >>> 8) & 0xff], b15 = SBOX[s2 & 0xff];

  const r0 = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) ^ roundKeys[56];
  const r1 = ((b4 << 24) | (b5 << 16) | (b6 << 8) | b7) ^ roundKeys[57];
  const r2 = ((b8 << 24) | (b9 << 16) | (b10 << 8) | b11) ^ roundKeys[58];
  const r3 = ((b12 << 24) | (b13 << 16) | (b14 << 8) | b15) ^ roundKeys[59];

  out[offset] = (r0 >>> 24) & 0xff; out[offset + 1] = (r0 >>> 16) & 0xff; out[offset + 2] = (r0 >>> 8) & 0xff; out[offset + 3] = r0 & 0xff;
  out[offset + 4] = (r1 >>> 24) & 0xff; out[offset + 5] = (r1 >>> 16) & 0xff; out[offset + 6] = (r1 >>> 8) & 0xff; out[offset + 7] = r1 & 0xff;
  out[offset + 8] = (r2 >>> 24) & 0xff; out[offset + 9] = (r2 >>> 16) & 0xff; out[offset + 10] = (r2 >>> 8) & 0xff; out[offset + 11] = r2 & 0xff;
  out[offset + 12] = (r3 >>> 24) & 0xff; out[offset + 13] = (r3 >>> 16) & 0xff; out[offset + 14] = (r3 >>> 8) & 0xff; out[offset + 15] = r3 & 0xff;
}

function aesCtr(dataBytes, keyBytes, ivBytes) {
  const roundKeys = expandKey(keyBytes);
  const out = new Uint8Array(dataBytes.length);
  const counter = new Uint8Array(16);
  counter.set(ivBytes.subarray(0, 16));

  const block = new Uint8Array(16);
  for (let i = 0; i < dataBytes.length; i += 16) {
    cipherBlock(counter, block, 0, roundKeys);
    const len = Math.min(16, dataBytes.length - i);
    for (let j = 0; j < len; j++) {
      out[i + j] = dataBytes[i + j] ^ block[j];
    }
    for (let k = 15; k >= 0; k--) {
      counter[k] = (counter[k] + 1) & 0xff;
      if (counter[k] !== 0) break;
    }
  }
  return out;
}

function sha256(bytes) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = (len % 64 < 56) ? (56 - len % 64) : (120 - len % 64);
  const totalLen = len + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(bytes);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 4, bitLen & 0xffffffff);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000));

  const w = new Uint32Array(64);
  for (let i = 0; i < totalLen; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = (rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10)) >>> 0;
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0); outView.setUint32(4, h1); outView.setUint32(8, h2); outView.setUint32(12, h3);
  outView.setUint32(16, h4); outView.setUint32(20, h5); outView.setUint32(24, h6); outView.setUint32(28, h7);
  return out;
}

function rotr(x, n) {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function strToBuffer(str) {
  return new TextEncoder().encode(str);
}

function bufferToStr(buf) {
  return new TextDecoder().decode(buf);
}

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getRandomBytes(len) {
  const bytes = new Uint8Array(len);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

async function deriveKey(password, salt) {
  const saltStr = typeof salt === 'string' ? salt : bufferToBase64(salt);
  let key = strToBuffer(password + '::' + saltStr);
  for (let i = 0; i < 2000; i++) {
    key = sha256(key);
  }
  return key; // 32 bytes (AES-256)
}

async function encryptData(plainText, keyBytes) {
  const iv = getRandomBytes(16);
  const plainBytes = strToBuffer(plainText);
  const cipherBytes = aesCtr(plainBytes, keyBytes, iv);
  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(cipherBytes)
  };
}

async function decryptData(cipherData, keyBytes) {
  const iv = base64ToBuffer(cipherData.iv);
  const cipherBytes = base64ToBuffer(cipherData.ciphertext);
  const decryptedBytes = aesCtr(cipherBytes, keyBytes, iv);
  return bufferToStr(decryptedBytes);
}

// ==========================================
// 2. INIZIALIZZAZIONE & SBLOCCO CASSAFORTE
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  initServiceWorker();
  checkNotificationStatus();
  await loadVaultFromStorage();
  updateAuthScreenUI();
  initAutoSync();
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

function checkNotificationStatus() {
  if ('Notification' in window) {
    STATE.notificationsEnabled = Notification.permission === 'granted';
  }
}

async function requestNotificationAccess() {
  if (!('Notification' in window)) {
    return;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      STATE.notificationsEnabled = true;
      showToast('Notifiche attivate! 🔔');
      const banner = document.getElementById('notifBanner');
      if (banner) banner.style.display = 'none';
      updateAppIconBadge();
    }
  } catch (e) {
    console.warn('Errore permessi notifiche:', e);
  }
}

async function loadVaultFromStorage() {
  try {
    const res = await fetch('/api/vault');
    if (res.ok) {
      const data = await res.json();
      if (data && data.ciphertext) {
        STATE.encryptedVault = data;
        localStorage.setItem('family_vault_encrypted', JSON.stringify(data));
        return;
      }
    }
  } catch (e) {}

  const local = localStorage.getItem('family_vault_encrypted');
  if (local) {
    try {
      STATE.encryptedVault = JSON.parse(local);
    } catch (e) {}
  }
}

function updateAuthScreenUI() {
  const title = document.querySelector('.auth-title');
  const subtitle = document.querySelector('.auth-subtitle');
  const btn = document.getElementById('unlockSubmitBtn');

  if (!STATE.encryptedVault) {
    if (title) title.textContent = 'Imposta Cassaforte';
    if (subtitle) subtitle.textContent = 'Scegli la Master Password di famiglia che conoscerete solo tu, tua moglie e tuo figlio.';
    if (btn) btn.textContent = 'Crea Cassaforte Cifrata';
  } else {
    if (title) title.textContent = 'Cassaforte di Famiglia';
    if (subtitle) subtitle.textContent = 'Inserisci la Master Password per accedere alle informazioni vitali.';
    if (btn) btn.textContent = 'Sblocca Cassaforte';
  }
}

async function handleUnlock(e) {
  e.preventDefault();
  const password = document.getElementById('masterPasswordInput').value.trim();
  const errorEl = document.getElementById('authError');
  const btn = document.getElementById('unlockSubmitBtn');
  if (errorEl) errorEl.textContent = '';

  if (!password) return;

  btn.disabled = true;
  btn.textContent = 'Verifica in corso...';

  try {
    if (!STATE.encryptedVault) {
      const salt = getRandomBytes(16);
      const key = await deriveKey(password, salt);
      STATE.masterKey = key;

      const initialEntries = [
        {
          id: 'ent-1',
          section: 'banca',
          title: 'Conto Corrente Principale',
          iban: 'IT60X0542811101000000123456',
          intestatario: 'Giampiero Rossi',
          saldo: 'Accesso con app cellulare o credenziali',
          notes: 'Cartella con libretto assegni e contratti nel secondo cassetto dello studio a Cagliari.'
        },
        {
          id: 'ent-2',
          section: 'pw',
          title: 'SPID / PosteID',
          username: 'giampiero.rossi@email.it',
          password: 'PasswordEsempio123!',
          notes: 'Utilizzato per INPS, Agenzia delle Entrate e Fascicolo Sanitario.'
        },
        {
          id: 'ent-3',
          section: 'info_case',
          title: 'Utenza Luce Cagliari',
          indirizzo: 'Enel Energia - Casa Cagliari',
          codiceCliente: 'POD IT001E12345678',
          pagamento: 'Addebito RID automatico su conto corrente',
          notes: 'Bollette digitali via email. Numero verde guasti: 803.500.'
        },
        {
          id: 'ent-4',
          section: 'cassaforte',
          title: 'Cassaforte a Muro Casa',
          combinazione: '24 - 58 - 12 (Rotazione dx-sx-dx)',
          posizione: 'Nello studio dietro il mobile libreria. Chiavi di riserva nella cassetta metallica.',
          notes: 'Contiene i doppi delle chiavi auto, documenti di proprietà e contanti di emergenza.'
        },
        {
          id: 'ent-5',
          section: 'note',
          title: 'Documenti e Contatti di Fiducia',
          notes: 'Commercialista: Dott. Mario Bianchi (Tel. 070.123456). Notaio: Studio Rossi a Cagliari. Tutti i rogiti e atti notarili sono nel faldone blu nello studio.'
        },
        {
          id: 'ent-6',
          section: 'messaggio',
          title: 'Messaggio di benvenuto',
          mittente: 'Giampy',
          notes: 'Questa è la nostra bacheca messaggi di famiglia. Se scrivi un messaggio qui e premi INVIA, apparirà subito la notifica con il badge sull\'icona dell\'app!',
          createdAt: new Date().toISOString()
        }
      ];

      STATE.entries = initialEntries;
      await saveEncryptedVault(salt);
      unlockSuccess();
    } else {
      const salt = base64ToBuffer(STATE.encryptedVault.salt);
      const key = await deriveKey(password, new Uint8Array(salt));

      try {
        const checkToken = await decryptData(STATE.encryptedVault.check, key);
        if (checkToken !== VERIFICATION_STRING) {
          throw new Error('Token non corrispondente');
        }
      } catch (err) {
        if (errorEl) errorEl.textContent = 'Password non corretta. Riprova.';
        btn.disabled = false;
        btn.textContent = 'Sblocca Cassaforte';
        return;
      }

      const decryptedJson = await decryptData(STATE.encryptedVault.data, key);
      try {
        const parsed = JSON.parse(decryptedJson || '[]');
        if (Array.isArray(parsed)) {
          STATE.entries = parsed;
        } else if (parsed && typeof parsed === 'object') {
          STATE.entries = parsed.entries || [];
        }
      } catch (e) {
        STATE.entries = [];
      }

      STATE.masterKey = key;
      unlockSuccess();
    }
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Errore durante la decifratura: ' + err.message;
    btn.disabled = false;
    btn.textContent = 'Sblocca Cassaforte';
  }
}

function unlockSuccess() {
  STATE.isUnlocked = true;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appHeader').style.display = 'flex';
  document.getElementById('vaultScreen').style.display = 'flex';
  
  resetAutoLockTimer();
  updateTileCounts();
  updateAppIconBadge();
  showToast('Cassaforte sbloccata');

  // Chiedi permessi notifiche in modo non invasivo se non ancora concessi
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') updateAppIconBadge();
    });
  }
}

function lockVault() {
  STATE.isUnlocked = false;
  STATE.masterKey = null;
  STATE.entries = [];
  
  document.getElementById('masterPasswordInput').value = '';
  document.getElementById('vaultScreen').style.display = 'none';
  document.getElementById('sectionView').style.display = 'none';
  document.getElementById('appHeader').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';

  updateAuthScreenUI();
  showToast('Cassaforte bloccata');
}

function resetAutoLockTimer() {
  if (STATE.autoLockTimer) clearTimeout(STATE.autoLockTimer);
  STATE.autoLockTimer = setTimeout(() => {
    if (STATE.isUnlocked) {
      lockVault();
    }
  }, 10 * 60 * 1000);
}

document.addEventListener('touchstart', resetAutoLockTimer, { passive: true });
document.addEventListener('click', resetAutoLockTimer, { passive: true });

// ==========================================
// 3. SALVATAGGIO CRITTOGRAFATO (END-TO-END)
// ==========================================

async function saveEncryptedVault(existingSalt = null) {
  if (!STATE.masterKey) return;

  const saltBuffer = existingSalt || (STATE.encryptedVault ? base64ToBuffer(STATE.encryptedVault.salt) : getRandomBytes(16));
  
  const encryptedCheck = await encryptData(VERIFICATION_STRING, STATE.masterKey);
  const encryptedEntries = await encryptData(JSON.stringify(STATE.entries), STATE.masterKey);

  const payload = {
    salt: bufferToBase64(saltBuffer),
    check: encryptedCheck,
    data: encryptedEntries,
    updatedAt: new Date().toISOString()
  };

  STATE.encryptedVault = payload;
  localStorage.setItem('family_vault_encrypted', JSON.stringify(payload));

  try {
    await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}

  updateTileCounts();
  updateAppIconBadge();
}

// ==========================================
// 4. NAVIGAZIONE TASTI & DETTAGLI SEZIONI
// ==========================================

function updateTileCounts() {
  const countPw = STATE.entries.filter(e => e.section === 'pw').length;
  const countBanca = STATE.entries.filter(e => e.section === 'banca').length;
  const countInfo = STATE.entries.filter(e => e.section === 'info_case').length;
  const countNote = STATE.entries.filter(e => e.section === 'note').length;
  const countCassaforte = STATE.entries.filter(e => e.section === 'cassaforte').length;
  const countMessaggi = STATE.entries.filter(e => e.section === 'messaggio').length;

  const elPw = document.getElementById('countPw');
  const elBanca = document.getElementById('countBanca');
  const elInfo = document.getElementById('countInfoCase');
  const elNote = document.getElementById('countNote');
  const elCassaforte = document.getElementById('countCassaforte');
  const elMessaggi = document.getElementById('countMessaggi');

  if (elPw) elPw.textContent = countPw;
  if (elBanca) elBanca.textContent = countBanca;
  if (elInfo) elInfo.textContent = countInfo;
  if (elNote) elNote.textContent = countNote;
  if (elCassaforte) elCassaforte.textContent = countCassaforte;
  if (elMessaggi) elMessaggi.textContent = countMessaggi;
}

function openSection(sectionKey) {
  STATE.activeSection = sectionKey;
  document.getElementById('vaultScreen').style.display = 'none';
  document.getElementById('sectionView').style.display = 'flex';

  const titleMap = {
    pw: 'Password',
    banca: 'Banca',
    info_case: 'Info Case',
    note: 'Note',
    cassaforte: 'Cassaforte',
    messaggio: 'Messaggi'
  };

  document.getElementById('sectionTitle').textContent = titleMap[sectionKey] || 'Dettagli';

  const notifBanner = document.getElementById('notifBanner');
  if (notifBanner) {
    if (sectionKey === 'messaggio' && (!('Notification' in window) || Notification.permission !== 'granted')) {
      notifBanner.style.display = 'flex';
    } else {
      notifBanner.style.display = 'none';
    }
  }

  renderSectionList();
}

function backToGrid() {
  STATE.activeSection = 'grid';
  document.getElementById('sectionView').style.display = 'none';
  document.getElementById('vaultScreen').style.display = 'flex';
  updateTileCounts();
}

function handlePlaceholderClick(index) {
  showToast(`Slot #${index} pronto per future sezioni`);
}

// ==========================================
// 5. GESTIONE MESSAGGI: 1-CLICK INVIA & NOTIFICA SULL'ICONA
// ==========================================

function selectSender(name) {
  STATE.currentSender = name;
  const chips = document.querySelectorAll('.sender-chip');
  chips.forEach(chip => {
    chip.classList.toggle('active', chip.textContent.includes(name));
  });
}

async function sendQuickFamilyMessage() {
  const textarea = document.getElementById('quickMsgText');
  if (!textarea) return;
  const text = textarea.value.trim();

  if (!text) {
    showToast('Scrivi prima il messaggio!');
    textarea.focus();
    return;
  }

  const newEntry = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    section: 'messaggio',
    title: `Messaggio da ${STATE.currentSender}`,
    mittente: STATE.currentSender,
    notes: text,
    createdAt: new Date().toISOString()
  };

  STATE.entries.unshift(newEntry);
  textarea.value = '';

  await saveEncryptedVault();

  // 1. Notifica su smartphone & Badge sull'icona
  triggerPhoneNotification(`💬 Messaggio da ${STATE.currentSender}`, text);

  // 2. Aggiorna interfaccia
  renderSectionList();
  showToast('Messaggio inviato e notificato! 🔔');
}

function triggerPhoneNotification(title, body) {
  const count = STATE.entries.filter(e => e.section === 'messaggio').length;

  // Imposta il badge sull'icona dell'app sullo schermo dello smartphone
  updateAppIconBadge(count);

  // Genera notifica di sistema sullo smartphone
  if ('Notification' in window && Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIF',
        title: title,
        body: body,
        badge: count
      });
    } else {
      new Notification(title, {
        body: body,
        icon: '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg'
      });
    }
  }

  if ('vibrate' in navigator) {
    try { navigator.vibrate([200, 100, 200]); } catch (e) {}
  }
}

function updateAppIconBadge(count) {
  const msgCount = count !== undefined ? count : STATE.entries.filter(e => e.section === 'messaggio').length;

  // Web Badging API nativa per PWA installata su Home screen (Android / iOS)
  if ('setAppBadge' in navigator) {
    if (msgCount > 0) {
      navigator.setAppBadge(msgCount).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }

  // Notifica al Service Worker per mantenere il badge attivo
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'UPDATE_BADGE',
      count: msgCount
    });
  }

  // Indicatore nel titolo del browser
  if (msgCount > 0) {
    document.title = `(${msgCount}) Cassaforte`;
  } else {
    document.title = `Cassaforte`;
  }
}

// ==========================================
// 6. RENDERING LISTE
// ==========================================

function renderSectionList() {
  const container = document.getElementById('sectionList');
  if (!container) return;

  const items = STATE.entries.filter(e => e.section === STATE.activeSection);

  // Se siamo nella sezione MESSAGGI: mostra direttamente il compositore in-page con il tasto INVIA
  let composerHTML = '';
  if (STATE.activeSection === 'messaggio') {
    composerHTML = `
      <div class="msg-composer">
        <div class="msg-composer-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span>Scrivi Messaggio di Famiglia</span>
        </div>

        <div class="sender-selector">
          <button type="button" class="sender-chip ${STATE.currentSender === 'Giampy' ? 'active' : ''}" onclick="selectSender('Giampy')">👨 Giampy (Papà)</button>
          <button type="button" class="sender-chip ${STATE.currentSender === 'Ty' ? 'active' : ''}" onclick="selectSender('Ty')">👩 Ty (Mamma)</button>
          <button type="button" class="sender-chip ${STATE.currentSender === 'Miki' ? 'active' : ''}" onclick="selectSender('Miki')">👦 Miki (Figlio)</button>
        </div>

        <textarea id="quickMsgText" class="msg-textarea" placeholder="Scrivi qui il messaggio per la famiglia..." rows="3"></textarea>

        <button type="button" class="btn-send-message" onclick="sendQuickFamilyMessage()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          <span>INVIA</span>
        </button>
      </div>
    `;
  }

  if (items.length === 0) {
    container.innerHTML = composerHTML + `
      <div style="text-align: center; padding: 24px 16px; color: var(--text-muted);">
        <p style="font-size: 0.9rem; margin-bottom: 12px;">Nessun messaggio presente.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = composerHTML + items.map(item => createEntryCardHTML(item)).join('');
}

function createEntryCardHTML(item) {
  if (item.section === 'messaggio') {
    const senderIcon = (item.mittente && (item.mittente.includes('Ty') || item.mittente === 'Mamma')) ? '👩' : ((item.mittente && (item.mittente.includes('Miki') || item.mittente === 'Figlio')) ? '👦' : '👨');
    const dateStr = item.createdAt ? formatTimeAgo(item.createdAt) : '';

    return `
      <article class="msg-item-card" id="card-${item.id}">
        <div class="msg-item-header">
          <span class="msg-item-sender">${senderIcon} ${escapeHTML(item.mittente || 'Giampy')}</span>
          <span class="msg-item-date">${escapeHTML(dateStr)}</span>
        </div>
        <p class="msg-item-body">${escapeHTML(item.notes || item.title)}</p>
        <div class="msg-item-actions">
          <button type="button" class="entry-action-btn delete" onclick="deleteEntry('${item.id}')">Elimina</button>
        </div>
      </article>
    `;
  }

  let detailsHTML = '';

  if (item.section === 'pw') {
    detailsHTML = `
      ${item.username ? `
        <div class="entry-row">
          <span class="entry-label">Utente</span>
          <span class="entry-value">${escapeHTML(item.username)}</span>
          <button type="button" class="btn-copy" onclick="copyToClipboard('${escapeAttr(item.username)}')">Copia</button>
        </div>
      ` : ''}
      ${item.password ? `
        <div class="entry-row">
          <span class="entry-label">Password</span>
          <span class="entry-value masked" id="pw-val-${item.id}" data-pw="${escapeAttr(item.password)}">••••••••</span>
          <button type="button" class="btn-copy" onclick="togglePasswordVisibility('${item.id}')" style="margin-right: 4px;">Mostra</button>
          <button type="button" class="btn-copy" onclick="copyToClipboard('${escapeAttr(item.password)}')">Copia</button>
        </div>
      ` : ''}
    `;
  } else if (item.section === 'banca') {
    detailsHTML = `
      ${item.iban ? `
        <div class="entry-row">
          <span class="entry-label">IBAN</span>
          <span class="entry-value">${escapeHTML(item.iban)}</span>
          <button type="button" class="btn-copy" onclick="copyToClipboard('${escapeAttr(item.iban)}')">Copia</button>
        </div>
      ` : ''}
      ${item.intestatario ? `
        <div class="entry-row">
          <span class="entry-label">Intestato</span>
          <span class="entry-value">${escapeHTML(item.intestatario)}</span>
        </div>
      ` : ''}
      ${item.saldo ? `
        <div class="entry-row">
          <span class="entry-label">Accesso</span>
          <span class="entry-value">${escapeHTML(item.saldo)}</span>
        </div>
      ` : ''}
    `;
  } else if (item.section === 'info_case') {
    detailsHTML = `
      ${item.indirizzo ? `
        <div class="entry-row">
          <span class="entry-label">Rif.</span>
          <span class="entry-value">${escapeHTML(item.indirizzo)}</span>
        </div>
      ` : ''}
      ${item.codiceCliente ? `
        <div class="entry-row">
          <span class="entry-label">Codice</span>
          <span class="entry-value">${escapeHTML(item.codiceCliente)}</span>
          <button type="button" class="btn-copy" onclick="copyToClipboard('${escapeAttr(item.codiceCliente)}')">Copia</button>
        </div>
      ` : ''}
      ${item.pagamento ? `
        <div class="entry-row">
          <span class="entry-label">Pagamento</span>
          <span class="entry-value">${escapeHTML(item.pagamento)}</span>
        </div>
      ` : ''}
    `;
  } else if (item.section === 'cassaforte') {
    detailsHTML = `
      ${item.combinazione ? `
        <div class="entry-row">
          <span class="entry-label">Codice</span>
          <span class="entry-value">${escapeHTML(item.combinazione)}</span>
          <button type="button" class="btn-copy" onclick="copyToClipboard('${escapeAttr(item.combinazione)}')">Copia</button>
        </div>
      ` : ''}
      ${item.posizione ? `
        <div class="entry-row">
          <span class="entry-label">Posizione / Chiavi</span>
          <span class="entry-value">${escapeHTML(item.posizione)}</span>
        </div>
      ` : ''}
    `;
  }

  return `
    <article class="entry-card" id="card-${item.id}">
      <div class="entry-card-header">
        <h3 class="entry-title">${escapeHTML(item.title)}</h3>
      </div>

      ${detailsHTML}

      ${item.notes ? `<p class="entry-notes">${escapeHTML(item.notes)}</p>` : ''}

      <div class="entry-actions">
        <button type="button" class="entry-action-btn" onclick="openEditModal('${item.id}')">Modifica</button>
        <button type="button" class="entry-action-btn delete" onclick="deleteEntry('${item.id}')">Elimina</button>
      </div>
    </article>
  `;
}

function formatTimeAgo(isoString) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMin = Math.floor((now - date) / 60000);
    if (diffMin < 1) return 'Adesso';
    if (diffMin < 60) return `${diffMin} min fa`;
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `Oggi ${hours}:${mins}`;
  } catch (e) {
    return '';
  }
}

function togglePasswordVisibility(id) {
  const el = document.getElementById(`pw-val-${id}`);
  if (!el) return;
  const pw = el.dataset.pw;
  if (el.classList.contains('masked')) {
    el.textContent = pw;
    el.classList.remove('masked');
  } else {
    el.textContent = '••••••••';
    el.classList.add('masked');
  }
}

// ==========================================
// 7. MODALE AGGIUNTA / MODIFICA (PER PW, BANCA, INFO CASE, CASSAFORTE, NOTE)
// ==========================================

function openAddModal() {
  openAddModalForCurrentSection(STATE.activeSection !== 'grid' && STATE.activeSection !== 'messaggio' ? STATE.activeSection : 'pw');
}

function openAddModalForCurrentSection(section = 'pw') {
  if (section === 'messaggio') {
    // Se siamo in messaggi, porta il focus direttamente sul compositore in-page
    const txt = document.getElementById('quickMsgText');
    if (txt) {
      txt.focus();
      return;
    }
  }

  const modal = document.getElementById('modalOverlay');
  const form = document.getElementById('entryForm');
  document.getElementById('modalHeading').textContent = 'Nuova Informazione';
  form.reset();
  document.getElementById('entryId').value = '';
  document.getElementById('entrySectionSelect').value = section;
  adaptFormFields();
  modal.style.display = 'flex';
}

function openEditModal(id) {
  const item = STATE.entries.find(e => e.id === id);
  if (!item) return;

  const modal = document.getElementById('modalOverlay');
  document.getElementById('modalHeading').textContent = 'Modifica Informazione';
  document.getElementById('entryId').value = item.id;
  document.getElementById('entrySectionSelect').value = item.section;
  document.getElementById('entryTitleInput').value = item.title || '';

  // Password fields
  document.getElementById('entryUsernameInput').value = item.username || '';
  document.getElementById('entryPasswordInput').value = item.password || '';

  // Banca fields
  document.getElementById('entryIbanInput').value = item.iban || '';
  document.getElementById('entryIntestatarioInput').value = item.intestatario || '';
  document.getElementById('entrySaldoInput').value = item.saldo || '';

  // Info case fields
  document.getElementById('entryCasaIndirizzoInput').value = item.indirizzo || '';
  document.getElementById('entryCodiceClienteInput').value = item.codiceCliente || '';
  document.getElementById('entryPagamentoInput').value = item.pagamento || '';

  // Cassaforte fields
  document.getElementById('entryCombinazioneInput').value = item.combinazione || '';
  document.getElementById('entryPosizioneInput').value = item.posizione || '';

  // Messaggio fields
  document.getElementById('entryMittenteInput').value = item.mittente || '';

  // Notes
  document.getElementById('entryNotesInput').value = item.notes || '';

  adaptFormFields();
  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

function closeModalOnOverlay(e) {
  if (e.target.id === 'modalOverlay') closeModal();
}

function adaptFormFields() {
  const section = document.getElementById('entrySectionSelect').value;
  document.getElementById('fieldsPw').style.display = section === 'pw' ? 'block' : 'none';
  document.getElementById('fieldsBanca').style.display = section === 'banca' ? 'block' : 'none';
  document.getElementById('fieldsInfoCase').style.display = section === 'info_case' ? 'block' : 'none';
  document.getElementById('fieldsCassaforte').style.display = section === 'cassaforte' ? 'block' : 'none';
  document.getElementById('fieldsMessaggio').style.display = section === 'messaggio' ? 'block' : 'none';

  const labelTitle = document.getElementById('labelTitle');
  if (section === 'messaggio') {
    labelTitle.textContent = 'Oggetto del Messaggio *';
  } else if (section === 'cassaforte') {
    labelTitle.textContent = 'Nome / Identificativo Cassaforte *';
  } else if (section === 'note') {
    labelTitle.textContent = 'Titolo della Nota / Disposizione *';
  } else {
    labelTitle.textContent = 'Titolo / Servizio *';
  }
}

async function handleSaveEntry(e) {
  e.preventDefault();
  const id = document.getElementById('entryId').value;
  const section = document.getElementById('entrySectionSelect').value;
  const title = document.getElementById('entryTitleInput').value.trim();
  const notes = document.getElementById('entryNotesInput').value.trim();

  const entryData = {
    id: id || `ent-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    section,
    title,
    notes,
    updatedAt: new Date().toISOString()
  };

  if (section === 'pw') {
    entryData.username = document.getElementById('entryUsernameInput').value.trim();
    entryData.password = document.getElementById('entryPasswordInput').value.trim();
  } else if (section === 'banca') {
    entryData.iban = document.getElementById('entryIbanInput').value.trim();
    entryData.intestatario = document.getElementById('entryIntestatarioInput').value.trim();
    entryData.saldo = document.getElementById('entrySaldoInput').value.trim();
  } else if (section === 'info_case') {
    entryData.indirizzo = document.getElementById('entryCasaIndirizzoInput').value.trim();
    entryData.codiceCliente = document.getElementById('entryCodiceClienteInput').value.trim();
    entryData.pagamento = document.getElementById('entryPagamentoInput').value.trim();
  } else if (section === 'cassaforte') {
    entryData.combinazione = document.getElementById('entryCombinazioneInput').value.trim();
    entryData.posizione = document.getElementById('entryPosizioneInput').value.trim();
  } else if (section === 'messaggio') {
    entryData.mittente = document.getElementById('entryMittenteInput').value.trim() || 'Famiglia';
    triggerPhoneNotification(`💬 Messaggio da ${entryData.mittente}`, notes || title);
  }

  const btn = document.getElementById('saveEntrySubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Cifratura...';

  if (id) {
    const idx = STATE.entries.findIndex(it => it.id === id);
    if (idx !== -1) STATE.entries[idx] = entryData;
  } else {
    STATE.entries.unshift(entryData);
  }

  await saveEncryptedVault();

  btn.disabled = false;
  btn.textContent = 'Salva Cifrato';
  closeModal();

  if (STATE.activeSection !== 'grid') {
    renderSectionList();
  } else {
    updateTileCounts();
  }

  updateAppIconBadge();
  showToast('Informazione salvata e crittografata');
}

async function deleteEntry(id) {
  if (!confirm('Vuoi davvero eliminare questa voce?')) return;

  STATE.entries = STATE.entries.filter(e => e.id !== id);
  await saveEncryptedVault();
  renderSectionList();
  updateTileCounts();
  updateAppIconBadge();
  showToast('Elemento eliminato');
}

// ==========================================
// 8. SINCRONIZZAZIONE AUTOMATICA REAL-TIME TRA SMARTPHONE
// ==========================================

function initAutoSync() {
  // Verifica aggiornamenti dal server ogni 6 secondi (o al cambio tab)
  setInterval(checkForRemoteUpdates, 6000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForRemoteUpdates();
    }
  });
}

async function checkForRemoteUpdates() {
  if (!STATE.isUnlocked || !STATE.masterKey) return;

  try {
    const res = await fetch('/api/vault');
    if (!res.ok) return;
    const remoteVault = await res.json();
    if (!remoteVault || !remoteVault.updatedAt) return;

    if (STATE.encryptedVault && remoteVault.updatedAt === STATE.encryptedVault.updatedAt) {
      return; // Nessun nuovo dato
    }

    const decryptedJson = await decryptData(remoteVault.data, STATE.masterKey);
    const parsed = JSON.parse(decryptedJson || '[]');
    const newEntries = Array.isArray(parsed) ? parsed : (parsed.entries || []);

    const oldMsgIds = new Set(STATE.entries.filter(e => e.section === 'messaggio').map(e => e.id));
    const newlyAdded = newEntries.filter(e => e.section === 'messaggio' && !oldMsgIds.has(e.id));

    STATE.encryptedVault = remoteVault;
    STATE.entries = newEntries;
    localStorage.setItem('family_vault_encrypted', JSON.stringify(remoteVault));

    updateTileCounts();
    updateAppIconBadge();

    // Se un altro membro della famiglia ha scritto un nuovo messaggio, fai suonare la notifica
    if (newlyAdded.length > 0) {
      const latest = newlyAdded[0];
      triggerPhoneNotification(`💬 Messaggio da ${latest.mittente || 'Famiglia'}`, latest.notes || latest.title);
      if (STATE.activeSection === 'messaggio') {
        renderSectionList();
      }
    }
  } catch (e) {}
}

// ==========================================
// 9. UTILITÀ: COPIA & TOAST NOTIFICA
// ==========================================

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copiato negli appunti!');
  }).catch(() => {
    prompt('Copia questo valore:', text);
  });
}

function showToast(msg) {
  const toast = document.getElementById('toastNotice');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function exportEncryptedVault() {
  if (!STATE.encryptedVault) {
    alert('Nessun dato salvato da esportare.');
    return;
  }
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(STATE.encryptedVault, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `cassaforte_famiglia_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function openQrModal() {
  const modal = document.getElementById('qrModalOverlay');
  if (modal) modal.style.display = 'flex';
}

function closeQrModal() {
  const modal = document.getElementById('qrModalOverlay');
  if (modal) modal.style.display = 'none';
}

function closeQrModalOnOverlay(e) {
  if (e.target.id === 'qrModalOverlay') closeQrModal();
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
