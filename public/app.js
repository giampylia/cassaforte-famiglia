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
  currentUser: 'Giampy', // 'Giampy', 'Ty', 'Miki'
  currentPin: '240961',
  activeSection: 'grid',
  entries: [],
  customSections: [],
  currentSender: 'Giampy',
  currentRecipient: 'Tutti',
  phonebook: { Giampy: '', Ty: '', Miki: '' },
  encryptedVault: null,
  autoLockTimer: null,
  notificationsEnabled: false,
  serverParking: { active: null, history: [] }
};

const FAMILY_CREDENTIALS = {
  '240961': { id: 'Giampy', name: 'Giampy', icon: '👨' },
  '040663': { id: 'Ty', name: 'Ty', icon: '👩' },
  '240696': { id: 'Miki', name: 'Miki', icon: '👦' }
};

const FAMILY_MASTER_SECRET = 'Famylia-Secret-Key-Giampy-Ty-Miki-2026!';
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
  initCustomBackground();
  checkNotificationStatus();
  await loadVaultFromStorage();
  updateAuthScreenUI();
  initAutoSync();
  await tryAutoUnlock();
  checkPushSubscriptionStatus();
  checkUrlParkingAction();
  fetchServerParking(true);
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Se c'è un worker in attesa, forziamo l'aggiornamento
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    }).catch((err) => {
      console.warn('[SW] Errore registrazione:', err);
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

function checkNotificationStatus() {
  if ('Notification' in window) {
    STATE.notificationsEnabled = Notification.permission === 'granted';
  }
}

// ==========================================
// GESTIONE NOTIFICHE PUSH REAL-TIME (SERVER VAPID)
// ==========================================

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function checkPushSubscriptionStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      updatePushStatusUI(true);
      // Mantieni sincronizzato il server con la sottoscrizione attuale
      fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          user: STATE.currentSender || 'Famiglia',
          device: /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : (/Android/.test(navigator.userAgent) ? 'Android' : 'Computer')
        })
      }).catch(() => {});
    }
  } catch (e) {}
}

async function subscribeToPushNotifications() {
  const btn = document.getElementById('btnEnablePush');
  if (btn) {
    btn.innerHTML = '⏳ Attivazione in corso...';
    btn.disabled = true;
  }

  if (!('serviceWorker' in navigator)) {
    alert('I Service Worker non sono supportati in questo browser.');
    if (btn) { btn.disabled = false; updatePushStatusUI(false); }
    return false;
  }

  if (!('PushManager' in window)) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      alert('Su iPhone per attivare le Notifiche Push devi prima salvare l\'app sulla schermata Home:\n1. In Safari tocca il tasto Condividi (⎋ in basso)\n2. Tocca "Aggiungi alla schermata Home"\n3. Apri Famylia dalla nuova icona creata!');
    } else {
      alert('Le notifiche push non sono supportate da questo browser.');
    }
    if (btn) { btn.disabled = false; updatePushStatusUI(false); }
    return false;
  }

  try {
    let perm = Notification.permission;
    if (perm !== 'granted') {
      perm = await Notification.requestPermission();
    }
    if (perm !== 'granted') {
      showToast('⚠️ Permesso notifiche non concesso nel browser.');
      if (btn) { btn.disabled = false; updatePushStatusUI(false); }
      return false;
    }

    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    // Recupera la chiave pubblica VAPID dal server
    const keyRes = await fetch('/api/push-public-key');
    if (!keyRes.ok) throw new Error('Impossibile ottenere la chiave push dal server');
    const keyData = await keyRes.json();
    const vapidKey = keyData.publicKey;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    }

    let devName = 'Computer';
    if (/iPhone/.test(navigator.userAgent)) devName = 'iPhone';
    else if (/iPad/.test(navigator.userAgent)) devName = 'iPad';
    else if (/Android/.test(navigator.userAgent)) devName = 'Android';

    // Registra questo smartphone sul server per ricevere le notifiche
    const subRes = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub,
        user: STATE.currentSender || 'Famiglia',
        device: devName
      })
    });

    const resData = await subRes.json();
    if (subRes.ok && resData.success) {
      STATE.notificationsEnabled = true;
      updatePushStatusUI(true);
      showToast('🔔 Notifiche attivate con successo su questo telefono!');
      return true;
    } else {
      throw new Error(resData.error || 'Errore durante la registrazione sul server');
    }
  } catch (err) {
    console.error('Errore attivazione push:', err);
    showToast('Errore attivazione: ' + err.message);
    if (btn) {
      btn.disabled = false;
      updatePushStatusUI(false);
    }
    return false;
  }
}

async function sendTestPushNotification() {
  try {
    showToast('Invio notifica push di prova...');
    const res = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🔔 Prova Notifica Famylia',
        body: 'Le notifiche push funzionano al 100% su questo smartphone!'
      })
    });
    const data = await res.json();
    if (data.success) {
      if (data.sent > 0) {
        showToast(`✅ Notifica inviata a ${data.sent} dispositivo/i! Controlla se vibra.`);
      } else {
        showToast('⚠️ 0 telefoni registrati. Clicca prima su "Attiva su questo Telefono"!');
      }
    } else {
      showToast('Errore invio: ' + (data.error || 'sconosciuto'));
    }
  } catch (err) {
    showToast('Errore: ' + err.message);
  }
}

function updatePushStatusUI(isActive) {
  const btn = document.getElementById('btnEnablePush');
  if (btn) {
    btn.disabled = false;
    if (isActive) {
      btn.innerHTML = '🔔 Notifiche Attive ✅';
      btn.style.background = 'rgba(46, 204, 113, 0.25)';
      btn.style.borderColor = 'rgba(46, 204, 113, 0.6)';
    } else {
      btn.innerHTML = 'Attiva su questo Telefono';
      btn.style.background = '';
      btn.style.borderColor = '';
    }
  }
}

// ==========================================
// GESTIONE SFONDO PERSONALIZZABILE
// ==========================================

function initCustomBackground() {
  const savedBg = localStorage.getItem('famylia_custom_bg');
  if (savedBg) {
    applyCustomBackground(savedBg);
  }
}

function applyCustomBackground(dataUrl) {
  // Sfondo visibile e luminoso: gradient leggerissimo per contrasto del testo bianco lasciando la foto chiara e vivida
  document.body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.28)), url('${dataUrl}')`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundAttachment = 'fixed';
  document.body.classList.add('has-custom-bg');
}

function triggerBgUpload() {
  const fileInput = document.getElementById('bgImageInput');
  if (fileInput) fileInput.click();
}

function handleBgUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Seleziona un file immagine valido (JPG, PNG, WebP)');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    compressAndSaveBg(dataUrl);
  };
  reader.readAsDataURL(file);
}

function compressAndSaveBg(dataUrl) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    const MAX_DIM = 1280;
    let width = img.width;
    let height = img.height;
    if (width > height && width > MAX_DIM) {
      height = Math.round((height * MAX_DIM) / width);
      width = MAX_DIM;
    } else if (height > MAX_DIM) {
      width = Math.round((width * MAX_DIM) / height);
      height = MAX_DIM;
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    const compressedUrl = canvas.toDataURL('image/jpeg', 0.82);
    try {
      localStorage.setItem('famylia_custom_bg', compressedUrl);
      applyCustomBackground(compressedUrl);
      showToast('Sfondo personalizzato applicato! 🖼️');
    } catch (e) {
      showToast('Immagine troppo pesante per il dispositivo');
    }
  };
  img.src = dataUrl;
}

function resetCustomBackground() {
  localStorage.removeItem('famylia_custom_bg');
  document.body.style.backgroundImage = '';
  document.body.classList.remove('has-custom-bg');
  showToast('Ripristinato lo sfondo originale');
}

async function loadVaultFromStorage() {
  const cachedPhonebook = localStorage.getItem('famylia_phonebook');
  if (cachedPhonebook) {
    try { STATE.phonebook = Object.assign({ Giampy: '', Ty: '', Miki: '' }, JSON.parse(cachedPhonebook)); } catch (e) {}
  }

  const local = localStorage.getItem('family_vault_encrypted');
  if (local) {
    try {
      STATE.encryptedVault = JSON.parse(local);
    } catch (e) {}
  }

  try {
    const res = await fetch('/api/vault?t=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.salt && (data.data || data.ciphertext)) {
        STATE.encryptedVault = data;
        localStorage.setItem('family_vault_encrypted', JSON.stringify(data));
        return;
      }
    }
  } catch (e) {}
}

function updateAuthScreenUI() {
  const title = document.querySelector('.auth-title');
  const subtitle = document.getElementById('authSubtitle') || document.querySelector('.auth-subtitle');
  const btn = document.getElementById('unlockSubmitBtn');
  const inp = document.getElementById('masterPasswordInput');

  if (title) title.textContent = 'Famylia';
  if (subtitle) subtitle.textContent = 'Inserisci il tuo PIN personale (Giampy, Ty o Miki).';
  if (btn) btn.textContent = 'Accedi a Famylia';
  if (inp) {
    inp.placeholder = 'Il tuo PIN personale (6 cifre)';
    inp.inputMode = 'numeric';
    inp.pattern = '[0-9]*';
  }
}

async function handleUnlock(e) {
  e.preventDefault();
  const password = document.getElementById('masterPasswordInput').value.trim();
  const errorEl = document.getElementById('authError');
  const btn = document.getElementById('unlockSubmitBtn');
  const migrationBox = document.getElementById('migrationBox');
  if (errorEl) errorEl.textContent = '';
  if (migrationBox) migrationBox.style.display = 'none';

  if (!password) return;

  const rememberCb = document.getElementById('rememberSessionCheckbox');
  const shouldRemember = rememberCb ? rememberCb.checked : true;

  btn.disabled = true;
  btn.textContent = 'Verifica in corso...';

  try {
    if (!STATE.encryptedVault) {
      try {
        const retryRes = await fetch('/api/vault?t=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          if (retryData && retryData.salt && (retryData.data || retryData.ciphertext)) {
            STATE.encryptedVault = retryData;
            localStorage.setItem('family_vault_encrypted', JSON.stringify(retryData));
          }
        }
      } catch (err) {}
    }

    const isFamilyPin = !!FAMILY_CREDENTIALS[password];

    if (!STATE.encryptedVault) {
      const activeUser = isFamilyPin ? FAMILY_CREDENTIALS[password].id : 'Giampy';
      STATE.currentUser = activeUser;
      STATE.currentSender = activeUser;

      const salt = getRandomBytes(16);
      const key = await deriveKey(FAMILY_MASTER_SECRET, salt);
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
          mittente: activeUser,
          destinatario: 'Tutti',
          notes: 'Questa è la nostra bacheca messaggi di famiglia. Se scrivi un messaggio qui e premi INVIA, apparirà subito la notifica con il badge sull\'icona dell\'app!',
          createdAt: new Date().toISOString()
        }
      ];

      STATE.entries = initialEntries;
      await saveEncryptedVault(salt);

      if (shouldRemember) {
        try {
          localStorage.setItem('famylia_auto_pass', btoa(unescape(encodeURIComponent(password))));
          localStorage.setItem('famylia_current_user', activeUser);
        } catch (e) {}
      } else {
        localStorage.removeItem('famylia_auto_pass');
        localStorage.removeItem('famylia_current_user');
      }

      STATE.currentPassword = password;
      unlockSuccess();
      return;
    }

    if (isFamilyPin) {
      STATE.currentUser = FAMILY_CREDENTIALS[password].id;
      STATE.currentSender = STATE.currentUser;

      let salt = base64ToBuffer(STATE.encryptedVault.salt);
      let key = await deriveKey(FAMILY_MASTER_SECRET, new Uint8Array(salt));
      let checkToken = null;
      try {
        checkToken = await decryptData(STATE.encryptedVault.check, key);
      } catch (err) {}

      if (checkToken !== VERIFICATION_STRING) {
        try {
          const freshRes = await fetch('/api/vault?t=' + Date.now(), { cache: 'no-store' });
          if (freshRes.ok) {
            const freshVault = await freshRes.json();
            if (freshVault && freshVault.salt) {
              const freshSalt = base64ToBuffer(freshVault.salt);
              const freshKey = await deriveKey(FAMILY_MASTER_SECRET, new Uint8Array(freshSalt));
              const freshCheck = await decryptData(freshVault.check, freshKey);
              if (freshCheck === VERIFICATION_STRING) {
                STATE.encryptedVault = freshVault;
                localStorage.setItem('family_vault_encrypted', JSON.stringify(freshVault));
                salt = freshSalt;
                key = freshKey;
                checkToken = freshCheck;
              }
            }
          }
        } catch (recoveryErr) {}
      }

      if (checkToken === VERIFICATION_STRING) {
        const decryptedJson = await decryptData(STATE.encryptedVault.data, key);
        try {
          const parsed = JSON.parse(decryptedJson || '[]');
          if (Array.isArray(parsed)) {
            STATE.entries = parsed;
            STATE.customSections = [];
          } else if (parsed && typeof parsed === 'object') {
            STATE.entries = parsed.entries || [];
            STATE.customSections = parsed.customSections || [];
            if (parsed.phonebook) {
              STATE.phonebook = Object.assign({ Giampy: '', Ty: '', Miki: '' }, parsed.phonebook);
              localStorage.setItem('famylia_phonebook', JSON.stringify(STATE.phonebook));
            }
          }
        } catch (e) {
          STATE.entries = [];
          STATE.customSections = [];
        }

        STATE.masterKey = key;
        STATE.currentPassword = password;

        if (shouldRemember) {
          try {
            localStorage.setItem('famylia_auto_pass', btoa(unescape(encodeURIComponent(password))));
            localStorage.setItem('famylia_current_user', STATE.currentUser);
          } catch (e) {}
        } else {
          localStorage.removeItem('famylia_auto_pass');
          localStorage.removeItem('famylia_current_user');
        }

        unlockSuccess();
        return;
      } else {
        if (migrationBox) migrationBox.style.display = 'block';
        if (errorEl) errorEl.textContent = 'La cassaforte su cloud usa ancora la vecchia password. Inseriscila qui sotto per aggiornarla:';
        btn.disabled = false;
        btn.textContent = 'Accedi a Famylia';
        return;
      }
    } else {
      let salt = base64ToBuffer(STATE.encryptedVault.salt);
      let key = await deriveKey(password, new Uint8Array(salt));
      let checkToken = null;
      try {
        checkToken = await decryptData(STATE.encryptedVault.check, key);
      } catch (err) {}

      if (checkToken === VERIFICATION_STRING) {
        const decryptedJson = await decryptData(STATE.encryptedVault.data, key);
        const parsed = JSON.parse(decryptedJson || '[]');
        if (Array.isArray(parsed)) {
          STATE.entries = parsed;
          STATE.customSections = [];
        } else if (parsed && typeof parsed === 'object') {
          STATE.entries = parsed.entries || [];
          STATE.customSections = parsed.customSections || [];
          if (parsed.phonebook) {
            STATE.phonebook = Object.assign({ Giampy: '', Ty: '', Miki: '' }, parsed.phonebook);
            localStorage.setItem('famylia_phonebook', JSON.stringify(STATE.phonebook));
          }
        }

        STATE.currentUser = 'Giampy';
        STATE.currentSender = 'Giampy';
        const newSalt = getRandomBytes(16);
        const newKey = await deriveKey(FAMILY_MASTER_SECRET, newSalt);
        STATE.masterKey = newKey;
        await saveEncryptedVault(newSalt);

        if (shouldRemember) {
          try {
            localStorage.setItem('famylia_auto_pass', btoa(unescape(encodeURIComponent('240961'))));
            localStorage.setItem('famylia_current_user', 'Giampy');
          } catch (e) {}
        }

        STATE.currentPassword = '240961';
        unlockSuccess();
        showToast('🎉 Cassaforte aggiornata ai nuovi PIN per Giampy, Ty e Miki!');
        return;
      } else {
        if (errorEl) errorEl.textContent = 'PIN non riconosciuto. Inserisci 240961 (Giampy), 040663 (Ty) o 240696 (Miki).';
        btn.disabled = false;
        btn.textContent = 'Accedi a Famylia';
        return;
      }
    }
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Errore durante la decifratura: ' + err.message;
    btn.disabled = false;
    btn.textContent = 'Accedi a Famylia';
  }
}

async function handleMigrateWithLegacyPassword() {
  const inputEl = document.getElementById('legacyPasswordInput');
  const legacyPass = inputEl ? inputEl.value.trim() : '';
  const errorEl = document.getElementById('authError');
  const box = document.getElementById('migrationBox');
  if (!legacyPass) {
    if (errorEl) errorEl.textContent = 'Inserisci la vecchia password per procedere alla conversione.';
    return;
  }

  if (errorEl) errorEl.textContent = 'Conversione cassaforte in corso...';

  try {
    let salt = base64ToBuffer(STATE.encryptedVault.salt);
    let key = await deriveKey(legacyPass, new Uint8Array(salt));
    let checkToken = null;
    try {
      checkToken = await decryptData(STATE.encryptedVault.check, key);
    } catch (e) {}

    if (checkToken !== VERIFICATION_STRING) {
      const freshRes = await fetch('/api/vault?t=' + Date.now(), { cache: 'no-store' });
      if (freshRes.ok) {
        const freshVault = await freshRes.json();
        if (freshVault && freshVault.salt) {
          salt = base64ToBuffer(freshVault.salt);
          key = await deriveKey(legacyPass, new Uint8Array(salt));
          checkToken = await decryptData(freshVault.check, key);
          if (checkToken === VERIFICATION_STRING) {
            STATE.encryptedVault = freshVault;
          }
        }
      }
    }

    if (checkToken !== VERIFICATION_STRING) {
      if (errorEl) errorEl.textContent = 'Vecchia password errata. Impossibile convertire la cassaforte.';
      return;
    }

    const decryptedJson = await decryptData(STATE.encryptedVault.data, key);
    const parsed = JSON.parse(decryptedJson || '[]');
    if (Array.isArray(parsed)) {
      STATE.entries = parsed;
      STATE.customSections = [];
    } else if (parsed && typeof parsed === 'object') {
      STATE.entries = parsed.entries || [];
      STATE.customSections = parsed.customSections || [];
      if (parsed.phonebook) {
        STATE.phonebook = Object.assign({ Giampy: '', Ty: '', Miki: '' }, parsed.phonebook);
        localStorage.setItem('famylia_phonebook', JSON.stringify(STATE.phonebook));
      }
    }

    const newSalt = getRandomBytes(16);
    const newKey = await deriveKey(FAMILY_MASTER_SECRET, newSalt);
    STATE.masterKey = newKey;
    await saveEncryptedVault(newSalt);

    const enteredPin = document.getElementById('masterPasswordInput').value.trim();
    const validPin = FAMILY_CREDENTIALS[enteredPin] ? enteredPin : '240961';
    STATE.currentUser = FAMILY_CREDENTIALS[validPin].id;
    STATE.currentSender = STATE.currentUser;
    STATE.currentPassword = validPin;

    const rememberCb = document.getElementById('rememberSessionCheckbox');
    if (!rememberCb || rememberCb.checked) {
      localStorage.setItem('famylia_auto_pass', btoa(unescape(encodeURIComponent(validPin))));
      localStorage.setItem('famylia_current_user', STATE.currentUser);
    }

    if (box) box.style.display = 'none';
    unlockSuccess();
    showToast('🎉 Cassaforte convertita con successo ai nuovi PIN per tutta la famiglia!');
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Errore durante la conversione: ' + err.message;
  }
}

async function handleForceNewPinVault() {
  if (!confirm('Vuoi davvero creare un nuovo archivio protetto con i nuovi PIN? I dati precedenti verranno azzerati.')) return;

  const enteredPin = document.getElementById('masterPasswordInput').value.trim();
  const validPin = FAMILY_CREDENTIALS[enteredPin] ? enteredPin : '240961';
  STATE.currentUser = FAMILY_CREDENTIALS[validPin].id;
  STATE.currentSender = STATE.currentUser;
  STATE.currentPassword = validPin;

  const newSalt = getRandomBytes(16);
  const newKey = await deriveKey(FAMILY_MASTER_SECRET, newSalt);
  STATE.masterKey = newKey;

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
      mittente: STATE.currentUser,
      destinatario: 'Tutti',
      notes: 'Benvenuti nella nostra bacheca protetta da PIN personale!',
      createdAt: new Date().toISOString()
    }
  ];

  STATE.entries = initialEntries;
  await saveEncryptedVault(newSalt);

  const rememberCb = document.getElementById('rememberSessionCheckbox');
  if (!rememberCb || rememberCb.checked) {
    localStorage.setItem('famylia_auto_pass', btoa(unescape(encodeURIComponent(validPin))));
    localStorage.setItem('famylia_current_user', STATE.currentUser);
  }

  const box = document.getElementById('migrationBox');
  if (box) box.style.display = 'none';
  unlockSuccess();
}

async function tryAutoUnlock() {
  const saved = localStorage.getItem('famylia_auto_pass');
  if (!saved || !STATE.encryptedVault) return;

  try {
    const password = decodeURIComponent(escape(atob(saved)));
    if (!password) return;

    const btn = document.getElementById('unlockSubmitBtn');
    if (btn) btn.textContent = 'Accesso automatico...';

    let salt = base64ToBuffer(STATE.encryptedVault.salt);
    let key = null;
    let checkToken = null;

    if (FAMILY_CREDENTIALS[password]) {
      STATE.currentUser = FAMILY_CREDENTIALS[password].id;
      STATE.currentSender = STATE.currentUser;
      key = await deriveKey(FAMILY_MASTER_SECRET, new Uint8Array(salt));
      try {
        checkToken = await decryptData(STATE.encryptedVault.check, key);
      } catch (e) {}
    } else {
      key = await deriveKey(password, new Uint8Array(salt));
      try {
        checkToken = await decryptData(STATE.encryptedVault.check, key);
      } catch (e) {}
      if (checkToken === VERIFICATION_STRING) {
        STATE.currentUser = 'Giampy';
        STATE.currentSender = 'Giampy';
        const dec = await decryptData(STATE.encryptedVault.data, key);
        const parsed = JSON.parse(dec || '[]');
        STATE.entries = Array.isArray(parsed) ? parsed : (parsed.entries || []);
        STATE.customSections = parsed.customSections || [];
        if (parsed.phonebook) STATE.phonebook = parsed.phonebook;

        const newSalt = getRandomBytes(16);
        const newKey = await deriveKey(FAMILY_MASTER_SECRET, newSalt);
        STATE.masterKey = newKey;
        await saveEncryptedVault(newSalt);

        localStorage.setItem('famylia_auto_pass', btoa(unescape(encodeURIComponent('240961'))));
        localStorage.setItem('famylia_current_user', 'Giampy');
        STATE.currentPassword = '240961';
        unlockSuccess();
        return;
      }
    }

    if (checkToken !== VERIFICATION_STRING) {
      try {
        const freshRes = await fetch('/api/vault?t=' + Date.now(), { cache: 'no-store' });
        if (freshRes.ok) {
          const freshVault = await freshRes.json();
          if (freshVault && freshVault.salt) {
            const freshSalt = base64ToBuffer(freshVault.salt);
            const useSecret = FAMILY_CREDENTIALS[password] ? FAMILY_MASTER_SECRET : password;
            const freshKey = await deriveKey(useSecret, new Uint8Array(freshSalt));
            const freshCheck = await decryptData(freshVault.check, freshKey);
            if (freshCheck === VERIFICATION_STRING) {
              STATE.encryptedVault = freshVault;
              localStorage.setItem('family_vault_encrypted', JSON.stringify(freshVault));
              salt = freshSalt;
              key = freshKey;
              checkToken = freshCheck;
            }
          }
        }
      } catch (err) {}
    }

    if (checkToken !== VERIFICATION_STRING) {
      localStorage.removeItem('famylia_auto_pass');
      localStorage.removeItem('famylia_current_user');
      updateAuthScreenUI();
      return;
    }

    const decryptedJson = await decryptData(STATE.encryptedVault.data, key);
    try {
      const parsed = JSON.parse(decryptedJson || '[]');
      if (Array.isArray(parsed)) {
        STATE.entries = parsed;
        STATE.customSections = [];
      } else if (parsed && typeof parsed === 'object') {
        STATE.entries = parsed.entries || [];
        STATE.customSections = parsed.customSections || [];
        if (parsed.phonebook) {
          STATE.phonebook = Object.assign({ Giampy: '', Ty: '', Miki: '' }, parsed.phonebook);
          localStorage.setItem('famylia_phonebook', JSON.stringify(STATE.phonebook));
        }
      }
    } catch (e) {
      STATE.entries = [];
      STATE.customSections = [];
    }

    STATE.masterKey = key;
    STATE.currentPassword = password;
    unlockSuccess();
  } catch (e) {
    console.warn('Auto-unlock error:', e);
    localStorage.removeItem('famylia_auto_pass');
    localStorage.removeItem('famylia_current_user');
    updateAuthScreenUI();
  }
}

function unlockSuccess() {
  STATE.isUnlocked = true;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appHeader').style.display = 'flex';
  document.getElementById('vaultScreen').style.display = 'flex';
  
  const userCred = Object.values(FAMILY_CREDENTIALS).find(c => c.id === STATE.currentUser) || { name: STATE.currentUser || 'Giampy', icon: '👨' };
  const badge = document.getElementById('currentUserBadge');
  if (badge) {
    badge.innerHTML = `${userCred.icon} ${userCred.name}`;
  }

  // Notifica la registrazione push con l'utente autenticato
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      if (reg.pushManager) {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) {
            fetch('/api/push-subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscription: sub,
                user: STATE.currentUser,
                device: /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : (/Android/.test(navigator.userAgent) ? 'Android' : 'Computer')
              })
            }).catch(() => {});
          }
        });
      }
    }).catch(() => {});
  }

  resetAutoLockTimer();
  updateTileCounts();
  fetchServerParking(true);
  updateAppIconBadge();
  updateSessionDescUI();
  showToast(`Benvenuto ${userCred.name} in Famylia! 🛡️`);

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') updateAppIconBadge();
    });
  }

  if (window._pendingAutoPark) {
    window._pendingAutoPark = false;
    setTimeout(() => {
      openSection('parking');
      saveManualParking(true);
    }, 600);
  }
}

function handleDashboardRememberToggle(e) {
  const isChecked = e.target.checked;
  const descEl = document.getElementById('sessionStatusDesc');
  if (isChecked) {
    if (STATE.currentPassword) {
      try {
        localStorage.setItem('famylia_auto_pass', btoa(unescape(encodeURIComponent(STATE.currentPassword))));
        localStorage.setItem('famylia_current_user', STATE.currentUser || 'Giampy');
      } catch (err) {}
    }
    if (descEl) descEl.textContent = 'Accesso immediato senza password attivo';
    showToast('⚡ Accesso automatico ATTIVATO su questo telefono!');
  } else {
    localStorage.removeItem('famylia_auto_pass');
    localStorage.removeItem('famylia_current_user');
    if (descEl) descEl.textContent = 'Richiederà il PIN alla prossima apertura';
    showToast('🔒 Accesso automatico DISATTIVATO.');
  }
}

function updateSessionDescUI() {
  const toggle = document.getElementById('dashboardRememberToggle');
  const descEl = document.getElementById('sessionStatusDesc');
  const hasSaved = !!localStorage.getItem('famylia_auto_pass');
  if (toggle) toggle.checked = hasSaved;
  if (descEl) {
    descEl.textContent = hasSaved
      ? 'Accesso immediato senza password attivo'
      : 'Richiederà il PIN alla prossima apertura';
  }
}

async function logoutVault() {
  localStorage.removeItem('famylia_auto_pass');
  localStorage.removeItem('famylia_current_user');
  localStorage.removeItem('family_vault_encrypted');
  STATE.currentPassword = null;
  STATE.currentUser = 'Giampy';
  STATE.currentSender = 'Giampy';
  lockVault();
  await loadVaultFromStorage();
  updateAuthScreenUI();
  showToast('Disconnesso da Famylia. Inserisci il tuo PIN.');
}

function lockVault() {
  STATE.isUnlocked = false;
  STATE.masterKey = null;
  STATE.currentPassword = null;
  STATE.entries = [];
  
  document.getElementById('masterPasswordInput').value = '';
  document.getElementById('vaultScreen').style.display = 'none';
  document.getElementById('sectionView').style.display = 'none';
  document.getElementById('appHeader').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';

  updateAuthScreenUI();
  showToast('Famylia bloccata');
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
  const vaultPayload = {
    entries: STATE.entries,
    phonebook: STATE.phonebook,
    customSections: STATE.customSections || []
  };
  const encryptedEntries = await encryptData(JSON.stringify(vaultPayload), STATE.masterKey);

  const payload = {
    salt: bufferToBase64(saltBuffer),
    check: encryptedCheck,
    data: encryptedEntries,
    updatedAt: new Date().toISOString()
  };

  STATE.encryptedVault = payload;
  localStorage.setItem('family_vault_encrypted', JSON.stringify(payload));
  if (STATE.phonebook) {
    localStorage.setItem('famylia_phonebook', JSON.stringify(STATE.phonebook));
  }

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
  const countDebiti = STATE.entries.filter(e => e.section === 'debiti').length;

  const elPw = document.getElementById('countPw');
  const elBanca = document.getElementById('countBanca');
  const elInfo = document.getElementById('countInfoCase');
  const elNote = document.getElementById('countNote');
  const elCassaforte = document.getElementById('countCassaforte');
  const elMessaggi = document.getElementById('countMessaggi');
  const elDebiti = document.getElementById('countDebiti');

  if (elPw) elPw.textContent = countPw;
  if (elBanca) elBanca.textContent = countBanca;
  if (elInfo) elInfo.textContent = countInfo;
  if (elNote) elNote.textContent = countNote;
  if (elCassaforte) elCassaforte.textContent = countCassaforte;
  if (elMessaggi) elMessaggi.textContent = countMessaggi;
  if (elDebiti) elDebiti.textContent = countDebiti;

  const serverActive = STATE.serverParking && STATE.serverParking.active;
  const userParkingEntries = STATE.entries.filter(e => e.section === 'parking' && (e.utente === STATE.currentUser || e.owner === STATE.currentUser));
  const latestParking = serverActive || (userParkingEntries.length > 0 ? userParkingEntries[0] : null);
  const elParking = document.getElementById('subParking');
  if (elParking) {
    if (latestParking) {
      const placeShort = latestParking.addressShort || latestParking.address || 'Parcheggiata';
      elParking.textContent = placeShort.length > 16 ? placeShort.slice(0, 14) + '...' : placeShort;
    } else {
      elParking.textContent = 'Auto & GPS';
    }
  }

  renderDynamicTiles();
  populateSectionSelectDropdown();
}

function renderDynamicTiles() {
  const container = document.getElementById('dynamicCustomTilesContainer');
  if (!container) return;

  if (!STATE.customSections || STATE.customSections.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = STATE.customSections.map(sec => {
    const count = STATE.entries.filter(e => e.section === sec.id).length;
    const iconDisplay = sec.icon ? `<span style="font-size: 26px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${escapeHTML(sec.icon)}</span>` : `
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
    `;

    return `
      <button type="button" class="dash-tile" onclick="openSection('${escapeAttr(sec.id)}')" aria-label="${escapeAttr(sec.name)}">
        <div class="dash-tile-icon">
          ${iconDisplay}
        </div>
        <span class="dash-tile-title">${escapeHTML(sec.name)}</span>
        <span class="dash-tile-sub">${count} voci</span>
      </button>
    `;
  }).join('');
}

function populateSectionSelectDropdown() {
  const select = document.getElementById('entrySectionSelect');
  if (!select) return;

  const currentVal = select.value;
  const standardOptions = [
    { val: 'pw', label: '🔑 Password & Credenziali' },
    { val: 'banca', label: '🏛️ Banca & Conti Correnti' },
    { val: 'info_case', label: '🏠 Info Case & Utenze' },
    { val: 'note', label: '📝 Note & Disposizioni' },
    { val: 'cassaforte', label: '🛡️ Cassaforte & Valori' },
    { val: 'debiti', label: '💳 Debiti & Finanziamenti' },
    { val: 'parking', label: '🚗 Parking & Posizione Auto' },
    { val: 'messaggio', label: '💬 Messaggio con Notifica' }
  ];

  let html = standardOptions.map(opt => `<option value="${opt.val}">${opt.label}</option>`).join('');

  if (STATE.customSections && STATE.customSections.length > 0) {
    html += STATE.customSections.map(sec => {
      const icon = sec.icon || '📁';
      return `<option value="${escapeAttr(sec.id)}">${icon} ${escapeHTML(sec.name)}</option>`;
    }).join('');
  }

  select.innerHTML = html;
  if (currentVal) {
    select.value = currentVal;
  }
}

function openSection(sectionKey) {
  STATE.activeSection = sectionKey;
  if (sectionKey === 'parking') {
    fetchServerParking(true);
  }
  document.getElementById('vaultScreen').style.display = 'none';
  document.getElementById('sectionView').style.display = 'flex';

  const titleMap = {
    pw: 'Password',
    banca: 'Banca',
    info_case: 'Info Case',
    note: 'Note',
    cassaforte: 'Cassaforte',
    messaggio: 'Messaggi',
    debiti: 'Debiti',
    parking: 'Parking & Auto'
  };

  let title = titleMap[sectionKey];
  const isCustom = !title;
  if (isCustom) {
    const customSec = (STATE.customSections || []).find(s => s.id === sectionKey);
    title = customSec ? (customSec.icon ? `${customSec.icon} ${customSec.name}` : customSec.name) : 'Dettagli';
  }

  document.getElementById('sectionTitle').textContent = title || 'Dettagli';

  const btnDeleteCustom = document.getElementById('btnDeleteCustomSection');
  if (btnDeleteCustom) {
    btnDeleteCustom.style.display = isCustom ? 'inline-flex' : 'none';
  }

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

async function handleDeleteCurrentCustomSection() {
  const customSec = (STATE.customSections || []).find(s => s.id === STATE.activeSection);
  if (!customSec) return;

  if (!confirm(`Vuoi davvero eliminare il tasto "${customSec.name}" e tutte le voci salvate al suo interno?`)) {
    return;
  }

  STATE.customSections = STATE.customSections.filter(s => s.id !== customSec.id);
  STATE.entries = STATE.entries.filter(e => e.section !== customSec.id);
  await saveEncryptedVault();
  showToast(`Tasto "${customSec.name}" eliminato`);
  backToGrid();
}

// GESTIONE MODALE CREAZIONE NUOVO TASTO
function openCreateCustomSectionModal() {
  const modal = document.getElementById('createSectionModalOverlay');
  const form = document.getElementById('createSectionForm');
  if (form) form.reset();
  selectCustomIcon('📑');
  if (modal) modal.style.display = 'flex';
  const nameInput = document.getElementById('customSectionNameInput');
  if (nameInput) setTimeout(() => nameInput.focus(), 100);
}

function closeCreateCustomSectionModal() {
  const modal = document.getElementById('createSectionModalOverlay');
  if (modal) modal.style.display = 'none';
}

function closeCreateSectionModalOnOverlay(e) {
  if (e.target.id === 'createSectionModalOverlay') closeCreateCustomSectionModal();
}

function selectCustomIcon(iconChar) {
  const input = document.getElementById('customSectionIconInput');
  if (input) input.value = iconChar;
  const chips = document.querySelectorAll('#customIconSelector .icon-chip');
  chips.forEach(c => {
    c.classList.toggle('active', c.textContent.trim() === iconChar);
  });
}

async function handleCreateCustomSection(e) {
  e.preventDefault();
  const nameInput = document.getElementById('customSectionNameInput');
  const subInput = document.getElementById('customSectionSubInput');
  const iconInput = document.getElementById('customSectionIconInput');

  const name = nameInput ? nameInput.value.trim() : '';
  const subtitle = subInput ? subInput.value.trim() : '';
  const icon = iconInput ? iconInput.value.trim() : '📁';

  if (!name) return;

  const id = `sec_${Date.now()}`;
  if (!STATE.customSections) STATE.customSections = [];

  STATE.customSections.push({
    id,
    name,
    subtitle,
    icon,
    createdAt: new Date().toISOString()
  });

  closeCreateCustomSectionModal();
  await saveEncryptedVault();
  updateTileCounts();
  showToast(`Tasto "${name}" creato! 🎉`);
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
  // Il mittente è fisso e blindato sull'utente attualmente autenticato col proprio PIN
  STATE.currentSender = STATE.currentUser || 'Giampy';
}

function selectRecipient(name) {
  STATE.currentRecipient = name;
  const chips = document.querySelectorAll('.dest-chip');
  chips.forEach(chip => {
    chip.classList.toggle('active', chip.dataset.person === name);
  });
}

function togglePhonebookCollapse() {
  const content = document.getElementById('phonebookContent');
  const icon = document.getElementById('phonebookToggleIcon');
  if (!content) return;
  const isHidden = content.style.display === 'none';
  content.style.display = isHidden ? 'block' : 'none';
  if (icon) {
    icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  }
}

async function savePhonebook(showToastMsg = true) {
  const inputGiampy = document.getElementById('phoneGiampy');
  const inputTy = document.getElementById('phoneTy');
  const inputMiki = document.getElementById('phoneMiki');

  if (!STATE.phonebook) {
    STATE.phonebook = { Giampy: '', Ty: '', Miki: '' };
  }

  const gVal = inputGiampy ? inputGiampy.value.trim() : (STATE.phonebook.Giampy || '');
  const tVal = inputTy ? inputTy.value.trim() : (STATE.phonebook.Ty || '');
  const mVal = inputMiki ? inputMiki.value.trim() : (STATE.phonebook.Miki || '');

  const changed = (gVal !== (STATE.phonebook.Giampy || '') ||
                   tVal !== (STATE.phonebook.Ty || '') ||
                   mVal !== (STATE.phonebook.Miki || ''));

  STATE.phonebook.Giampy = gVal;
  STATE.phonebook.Ty = tVal;
  STATE.phonebook.Miki = mVal;
  localStorage.setItem('famylia_phonebook', JSON.stringify(STATE.phonebook));

  if (changed || showToastMsg) {
    await saveEncryptedVault();
    if (showToastMsg) {
      showToast('Rubrica salvata e sincronizzata! 📞');
    }
  }
}

function callPerson(name) {
  const input = document.getElementById(`phone${name}`);
  const phone = (input && input.value.trim()) || (STATE.phonebook && STATE.phonebook[name]);
  if (!phone) {
    showToast(`Inserisci prima il numero di ${name} nella rubrica!`);
    return;
  }
  window.location.href = `tel:${phone}`;
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

  // Mittente verificato e blindato: chi è loggato firma automaticamente il messaggio
  const sender = STATE.currentUser || 'Giampy';
  STATE.currentSender = sender;
  const recipient = STATE.currentRecipient || 'Tutti';

  const newEntry = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    section: 'messaggio',
    title: `Messaggio da ${sender} a ${recipient}`,
    mittente: sender,
    destinatario: recipient,
    notes: text,
    createdAt: new Date().toISOString()
  };

  STATE.entries.unshift(newEntry);
  textarea.value = '';

  await saveEncryptedVault();

  // 1. Invia notifica Push remota a TUTTI gli smartphone registrati della famiglia tramite il server
  try {
    fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `💬 Da ${sender} a ${recipient}`,
        body: text,
        sender: sender,
        recipient: recipient
      })
    }).then(res => res.json()).then(data => {
      console.log('[Push] Risposta invio push:', data);
    }).catch(err => {
      console.warn('[Push] Errore chiamata push:', err);
    });
  } catch (e) {}

  // 2. Notifica locale e badge
  triggerPhoneNotification(`💬 Da ${sender} a ${recipient}`, text);

  // 3. Aggiorna interfaccia
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
    document.title = `(${msgCount}) Famylia`;
  } else {
    document.title = `Famylia`;
  }
}

// ==========================================
// 6. RENDERING LISTE & SEZIONE PARKING AUTO
// ==========================================

let ACTIVE_BT_DEVICE = null;

async function fetchServerParking(silent = false) {
  try {
    const user = STATE.currentUser || 'Giampy';
    const pin = STATE.currentPin || (user === 'Giampy' ? '240961' : (user === 'Ty' ? '040663' : '240696'));
    const res = await fetch(`/api/parking?user=${encodeURIComponent(user)}&pin=${encodeURIComponent(pin)}`);
    if (res.ok) {
      const data = await res.json();
      STATE.serverParking = data;
      if (STATE.activeSection === 'parking') {
        const container = document.getElementById('sectionList');
        if (container) renderParkingSection(container);
      } else {
        updateTileCounts();
      }
    }
  } catch (err) {
    if (!silent) console.warn('[Parking] Errore fetchServerParking:', err);
  }
}

function renderParkingSection(container) {
  // RIGOROSO ISOLAMENTO PERSONALE: ognuno vede solo ed esclusivamente il proprio parcheggio
  const userCred = Object.values(FAMILY_CREDENTIALS).find(c => c.id === STATE.currentUser) || { name: STATE.currentUser || 'Giampy', icon: '👨' };
  
  const serverActive = (STATE.serverParking && STATE.serverParking.active) || null;
  const serverHistory = (STATE.serverParking && STATE.serverParking.history) || [];
  const localParkings = STATE.entries.filter(e => e.section === 'parking' && (e.utente === STATE.currentUser || e.owner === STATE.currentUser));

  // Determina il parcheggio attivo più recente
  let activeParking = null;
  if (serverActive && localParkings.length > 0) {
    const sTime = new Date(serverActive.timestamp).getTime();
    const lTime = new Date(localParkings[0].timestamp).getTime();
    activeParking = sTime >= lTime ? serverActive : localParkings[0];
  } else {
    activeParking = serverActive || (localParkings.length > 0 ? localParkings[0] : null);
  }

  // Costruisci storico senza duplicati
  const seenIds = new Set();
  if (activeParking && activeParking.id) seenIds.add(activeParking.id);
  const myHistory = [];
  [...serverHistory, ...localParkings].forEach(item => {
    if (item && item.id && !seenIds.has(item.id)) {
      seenIds.add(item.id);
      myHistory.push(item);
    }
  });
  myHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const originUrl = window.location.origin;
  const webhookUrl = `${originUrl}/api/auto-park?user=${encodeURIComponent(STATE.currentUser || 'Giampy')}`;

  container.innerHTML = `
    <!-- SCHEDA PRINCIPALE PARCHEGGIO ATTUALE -->
    <div class="parking-hero-card">
      <div class="parking-hero-header">
        <div class="parking-user-title">
          <span style="font-size: 1.4rem;">🚗</span>
          <span>Auto di ${escapeHTML(userCred.name)}</span>
        </div>
        ${activeParking ? '<span class="parking-status-tag">📍 Parcheggiata</span>' : '<span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Nessuna posizione salvata</span>'}
      </div>

      ${activeParking ? `
        <div class="parking-address-box">
          <div class="parking-address-title">${escapeHTML(activeParking.addressShort || activeParking.address || 'Posizione salvata')}</div>
          <div style="font-size: 0.82rem; color: #94a3b8; margin-bottom: 8px; line-height: 1.35;">${escapeHTML(activeParking.address || '')}</div>
          <div class="parking-meta-row">
            <span>🕒 ${formatTimeAgo(activeParking.timestamp)} (${formatTimeAndDate(activeParking.timestamp)})</span>
            <span>🎯 Precisione: ±${activeParking.accuracy || 5}m</span>
            <span>⚡ ${activeParking.trigger === 'bluetooth_auto' ? 'Spegnimento Motore (Bluetooth Auto)' : (activeParking.trigger === 'ios_shortcut' ? 'Automazione iPhone' : 'Salvataggio rapido')}</span>
          </div>
          ${activeParking.notes ? `<div style="margin-top: 8px; font-size: 0.82rem; color: #ffffff; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">📝 <strong>Nota:</strong> ${escapeHTML(activeParking.notes)}</div>` : ''}
        </div>

        <div style="display: flex; gap: 8px; flex-direction: column;">
          <button type="button" class="btn-nav-primary" onclick="openMapsNavigation(${activeParking.lat}, ${activeParking.lng})">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            <span>🧭 Portami all'Auto (Navigatore a Piedi)</span>
          </button>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="neu-btn-primary" style="flex: 1; font-size: 0.82rem; padding: 10px;" onclick="addNoteToActiveParking('${activeParking.id}')">
              ✏️ Nota / Piano
            </button>
            <button type="button" class="neu-btn-primary" style="flex: 1; font-size: 0.82rem; padding: 10px; background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.4); color: #fca5a5;" onclick="releaseCurrentParking('${activeParking.id}')">
              ✅ Ho ripreso l'auto
            </button>
          </div>
        </div>
      ` : `
        <div style="text-align: center; padding: 16px 0 8px 0; color: var(--text-muted); font-size: 0.85rem; line-height: 1.45;">
          Nessuna posizione memorizzata per <strong>${escapeHTML(userCred.name)}</strong>.<br>
          Quando spegni il motore e scendi dall'auto, la posizione viene registrata qui <strong>in automatico</strong>.
        </div>
      `}

      <!-- PULSANTE MANUALE RAPIDO DI BACKUP -->
      <button type="button" class="btn-park-now" onclick="saveManualParking()" id="btnSaveParkingNow">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        <span id="btnSaveParkingText">📍 Salva Posizione ORA (Backup 1-Click)</span>
      </button>
    </div>

    <!-- SCHEDA SPIEGAZIONE AUTOMAZIONE SENZA MANI -->
    <div class="parking-automation-card">
      <div class="parking-aut-header">
        <span style="font-size: 1.4rem;">⚡</span>
        <div>
          <div style="font-weight: 800; font-size: 0.92rem; color: #ffffff;">Rilevamento 100% Senza Mani (Zero-Click)</div>
          <div style="font-size: 0.74rem; color: #38bdf8;">Non devi mai aprire l'app quando sali in macchina</div>
        </div>
      </div>
      <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.45; margin: 10px 0 12px 0;">
        Al volante sei di fretta: il tuo telefono si collega al vivavoce Bluetooth da solo. Quando spegni il motore e scendi, lo smartphone memorizza la posizione a schermo spento in borsa o in tasca.
      </p>
      
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="neu-btn-primary" style="flex: 1; padding: 10px; font-size: 0.78rem; background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;" onclick="showParkingAutomationModal('ios')">
          🍏 Guida iPhone (Ty & Miki)
        </button>
        <button type="button" class="neu-btn-primary" style="flex: 1; padding: 10px; font-size: 0.78rem; background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #34d399;" onclick="showParkingAutomationModal('android')">
          🤖 Guida Android (Giampy)
        </button>
      </div>

      <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.12); border-radius: 10px;">
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 4px;">Tuo link personale di registrazione automatica:</div>
        <div class="entry-row" style="margin-bottom: 0;">
          <span class="entry-value" style="font-size: 0.72rem; color: #38bdf8;">${webhookUrl}</span>
          <button type="button" class="btn-copy" onclick="copyToClipboard('${webhookUrl}')">Copia</button>
        </div>
      </div>
    </div>

    <!-- STORICO PARCHEGGI (SOLO DI QUESTO UTENTE) -->
    <div class="parking-history-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="font-weight: 800; font-size: 0.88rem; color: #ffffff; display: flex; align-items: center; gap: 6px;">
          <span>📜 Storico Parcheggi di ${escapeHTML(userCred.name)}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">(${myHistory.length})</span>
        </div>
        ${myHistory.length > 0 ? `
          <button type="button" style="background: none; border: none; color: #ef4444; font-size: 0.75rem; cursor: pointer; text-decoration: underline;" onclick="clearParkingHistory()">
            Svuota storico
          </button>
        ` : ''}
      </div>

      ${myHistory.length === 0 ? `
        <p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 14px 0;">
          Nessun parcheggio registrato ancora per ${escapeHTML(userCred.name)}.
        </p>
      ` : `
        <div class="parking-history-list">
          ${myHistory.map((p, idx) => `
            <div class="parking-history-item">
              <div style="flex: 1;">
                <div style="font-size: 0.84rem; font-weight: 700; color: #ffffff;">${escapeHTML(p.addressShort || p.address)}</div>
                <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">
                  ${formatTimeAndDate(p.timestamp)}
                </div>
                ${p.notes ? `<div style="font-size: 0.74rem; color: #cbd5e1; margin-top: 2px;">📝 ${escapeHTML(p.notes)}</div>` : ''}
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <button type="button" class="btn-copy" onclick="openMapsNavigation(${p.lat}, ${p.lng})" title="Apri navigatore">🧭 Mappa</button>
                <button type="button" class="entry-action-btn delete" onclick="deleteLocalOrServerParking('${p.id}')" title="Elimina voce">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

async function connectCarBluetooth() {
  if (!navigator.bluetooth) {
    showParkingAutomationModal('ios');
    return;
  }

  try {
    showToast("Seleziona il Bluetooth dell'auto...");
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true
    });

    if (!device) return;

    ACTIVE_BT_DEVICE = device;
    try {
      localStorage.setItem(`famylia_car_bt_${STATE.currentUser}`, device.name || 'Bluetooth Auto');
    } catch (e) {}

    device.addEventListener('gattserverdisconnected', onCarBluetoothDisconnected);

    if (device.gatt) {
      try {
        await device.gatt.connect();
      } catch (e) {}
    }

    showToast(`🟢 Connesso a ${device.name || 'Bluetooth Auto'}!`);
    renderSectionList();
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      showToast("Errore Bluetooth: " + err.message);
    }
  }
}

function onCarBluetoothDisconnected(event) {
  console.log('[Bluetooth] Auto disconnessa! Quadro spento. Rilevo posizione GPS...');
  showToast("🚗 Quadro auto spento (Bluetooth disconnesso): salvo posizione...");
  saveManualParking(true, 'bluetooth_auto');
}

async function saveManualParking(silent = false, triggerType = 'manuale') {
  if (!('geolocation' in navigator)) {
    alert("La geolocalizzazione GPS non è supportata da questo browser.");
    return;
  }

  const btn = document.getElementById('btnSaveParkingNow');
  const btnTxt = document.getElementById('btnSaveParkingText');
  if (btn) btn.disabled = true;
  if (btnTxt) btnTxt.textContent = "📡 Rilevamento GPS in corso...";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 0);

        let address = `Coordinate GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        let addressShort = `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
            headers: { 'Accept': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.address) {
              const a = data.address;
              const road = a.road || a.pedestrian || a.street || '';
              const house = a.house_number ? ' ' + a.house_number : '';
              const city = a.city || a.town || a.village || a.suburb || '';
              if (road) {
                addressShort = road + house;
                address = `${road}${house}${city ? ', ' + city : ''}`;
              } else if (data.display_name) {
                const parts = data.display_name.split(',');
                addressShort = parts[0];
                address = parts.slice(0, 3).join(',');
              }
            }
          }
        } catch (geoErr) {
          console.warn('[Parking] Geocoding error:', geoErr);
        }

        const newEntry = {
          id: `park-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          section: 'parking',
          title: `Auto ${STATE.currentUser}`,
          utente: STATE.currentUser,
          owner: STATE.currentUser,
          lat: lat,
          lng: lng,
          accuracy: accuracy,
          address: address,
          addressShort: addressShort,
          timestamp: new Date().toISOString(),
          trigger: triggerType,
          notes: ''
        };

        STATE.entries.unshift(newEntry);
        await saveEncryptedVault();

        // Sincronizza anche con il server per webhook e notifiche cross-device
        try {
          await fetch('/api/auto-park', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user: STATE.currentUser,
              pin: STATE.currentPin,
              lat: lat,
              lng: lng,
              accuracy: accuracy,
              trigger: triggerType,
              notes: ''
            })
          });
          await fetchServerParking(true);
        } catch (srvErr) {}

        if (btn) btn.disabled = false;
        if (btnTxt) btnTxt.textContent = "📍 Salva Posizione ORA (Backup 1-Click)";

        triggerPhoneNotification("🚗 Auto Parcheggiata!", `Posizione: ${addressShort}`);
        showToast(`🚗 Auto parcheggiata in: ${addressShort}!`);

        if (STATE.activeSection === 'parking') {
          renderSectionList();
        } else {
          updateTileCounts();
        }
      } catch (err) {
        if (btn) btn.disabled = false;
        if (btnTxt) btnTxt.textContent = "📍 Salva Posizione ORA (Backup 1-Click)";
        showToast("Errore salvataggio: " + err.message);
      }
    },
    (err) => {
      if (btn) btn.disabled = false;
      if (btnTxt) btnTxt.textContent = "📍 Salva Posizione ORA (Backup 1-Click)";
      let msg = "Impossibile rilevare la posizione.";
      if (err.code === 1) msg = "Accesso GPS negato. Autorizza la posizione nelle impostazioni del browser/telefono.";
      else if (err.code === 2) msg = "Posizione non disponibile (segnale GPS assente).";
      else if (err.code === 3) msg = "Timeout richiesta GPS. Riprova.";
      alert("⚠️ " + msg);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function openMapsNavigation(lat, lng) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    window.open(`https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`, '_blank');
  }
}

async function addNoteToActiveParking(id) {
  const serverActive = STATE.serverParking && STATE.serverParking.active;
  const localItem = STATE.entries.find(e => e.id === id);
  const currentNote = (serverActive && serverActive.notes) || (localItem && localItem.notes) || '';
  const note = prompt("Aggiungi nota al parcheggio (es. Piano -2, Posto 45, Scadenza ticket ore 18:30):", currentNote);
  if (note !== null) {
    const trimmed = note.trim();
    try {
      await fetch('/api/parking/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: STATE.currentUser, pin: STATE.currentPin, note: trimmed })
      });
    } catch (e) {}

    if (serverActive) serverActive.notes = trimmed;
    if (localItem) {
      localItem.notes = trimmed;
      await saveEncryptedVault();
    }
    renderSectionList();
    showToast("Nota parcheggio salvata!");
  }
}

async function releaseCurrentParking(id) {
  if (!confirm("Hai ripreso l'auto? Rimuovere la posizione dal parcheggio attivo?")) return;
  try {
    await fetch('/api/parking/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: STATE.currentUser, pin: STATE.currentPin })
    });
  } catch (e) {}

  if (id) {
    STATE.entries = STATE.entries.filter(e => e.id !== id);
    await saveEncryptedVault();
  }
  if (STATE.serverParking) {
    STATE.serverParking.active = null;
  }
  renderSectionList();
  updateTileCounts();
  showToast("Posizione auto rimossa.");
}

async function clearParkingHistory() {
  if (!confirm("Vuoi cancellare tutto lo storico dei tuoi parcheggi precedenti?")) return;
  try {
    await fetch('/api/parking/clear-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: STATE.currentUser, pin: STATE.currentPin })
    });
  } catch (e) {}

  STATE.entries = STATE.entries.filter(e => !(e.section === 'parking' && (e.utente === STATE.currentUser || e.owner === STATE.currentUser)));
  await saveEncryptedVault();
  if (STATE.serverParking) {
    STATE.serverParking.history = [];
  }
  renderSectionList();
  updateTileCounts();
  showToast("Storico parcheggi svuotato.");
}

async function deleteLocalOrServerParking(id) {
  if (!confirm("Vuoi eliminare questa voce dallo storico?")) return;
  STATE.entries = STATE.entries.filter(e => e.id !== id);
  await saveEncryptedVault();

  if (STATE.serverParking && STATE.serverParking.history) {
    STATE.serverParking.history = STATE.serverParking.history.filter(h => h.id !== id);
  }
  if (STATE.serverParking && STATE.serverParking.active && STATE.serverParking.active.id === id) {
    STATE.serverParking.active = null;
    try {
      await fetch('/api/parking/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: STATE.currentUser, pin: STATE.currentPin })
      });
    } catch (e) {}
  }
  renderSectionList();
  updateTileCounts();
  showToast("Elemento rimosso.");
}

function showParkingAutomationModal(tab = 'ios') {
  const modal = document.getElementById('parkingAutomationModalOverlay');
  if (!modal) return;
  switchParkingModalTab(tab);
  modal.style.display = 'flex';
}

function closeParkingAutomationModal() {
  const modal = document.getElementById('parkingAutomationModalOverlay');
  if (modal) modal.style.display = 'none';
}

function closeParkingAutomationModalOnOverlay(event) {
  if (event.target && event.target.id === 'parkingAutomationModalOverlay') {
    closeParkingAutomationModal();
  }
}

function switchParkingModalTab(tab) {
  const tabIOS = document.getElementById('parkingTabIOS');
  const tabAndroid = document.getElementById('parkingTabAndroid');
  const btnIOS = document.getElementById('btnTabIOS');
  const btnAndroid = document.getElementById('btnTabAndroid');

  if (tab === 'ios') {
    if (tabIOS) tabIOS.style.display = 'block';
    if (tabAndroid) tabAndroid.style.display = 'none';
    if (btnIOS) btnIOS.classList.add('active');
    if (btnAndroid) btnAndroid.classList.remove('active');
  } else {
    if (tabIOS) tabIOS.style.display = 'none';
    if (tabAndroid) tabAndroid.style.display = 'block';
    if (btnIOS) btnIOS.classList.remove('active');
    if (btnAndroid) btnAndroid.classList.add('active');
  }

  const user = STATE.currentUser || 'Giampy';
  const host = window.location.origin;

  const iosLink = document.getElementById('iosWebhookLink');
  if (iosLink) {
    iosLink.textContent = `${host}/api/auto-park?user=${encodeURIComponent(user)}`;
  }

  const androidLink = document.getElementById('androidWebhookLink');
  if (androidLink) {
    androidLink.textContent = `${host}/api/auto-park?user=${encodeURIComponent(user)}`;
  }
}

function copyIosWebhook() {
  const user = STATE.currentUser || 'Giampy';
  const host = window.location.origin;
  const link = `${host}/api/auto-park?user=${encodeURIComponent(user)}`;
  copyToClipboard(link);
}

function copyAndroidWebhook() {
  const user = STATE.currentUser || 'Giampy';
  const host = window.location.origin;
  const link = `${host}/api/auto-park?user=${encodeURIComponent(user)}`;
  copyToClipboard(link);
}

function formatTimeAndDate(isoString) {
  try {
    const d = new Date(isoString);
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ore ${hours}:${mins}`;
  } catch (e) {
    return '';
  }
}

function formatTimeDateOnly(isoString) {
  try {
    const d = new Date(isoString);
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `ore ${hours}:${mins}`;
  } catch (e) {
    return '';
  }
}

function checkUrlParkingAction() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'park' || params.get('parking') === '1') {
    window.history.replaceState({}, document.title, window.location.pathname);
    if (STATE.isUnlocked) {
      openSection('parking');
      saveManualParking(true, 'url_automation');
    } else {
      window._pendingAutoPark = true;
    }
  }
}

function renderSectionList() {
  const container = document.getElementById('sectionList');
  if (!container) return;

  // Se siamo nella sezione PARKING: vista dedicata con isolamento personale rigoroso
  if (STATE.activeSection === 'parking') {
    renderParkingSection(container);
    return;
  }

  const items = STATE.entries.filter(e => e.section === STATE.activeSection);

  // Se siamo nella sezione MESSAGGI: mostra Rubrica Telefonica + Compositore DA/A
  let extraHTML = '';
  if (STATE.activeSection === 'messaggio') {
    const pb = STATE.phonebook || { Giampy: '', Ty: '', Miki: '' };
    const curSender = STATE.currentUser || 'Giampy';
    STATE.currentSender = curSender;
    const senderIcon = getPersonIcon(curSender);

    const possibleRecipients = [
      { id: 'Tutti', label: '👨‍👩‍👧 Tutti' },
      { id: 'Giampy', label: '👨 Giampy' },
      { id: 'Ty', label: '👩 Ty' },
      { id: 'Miki', label: '👦 Miki' }
    ].filter(r => r.id !== curSender);

    if (STATE.currentRecipient === curSender || !possibleRecipients.some(r => r.id === STATE.currentRecipient)) {
      STATE.currentRecipient = 'Tutti';
    }
    const curDest = STATE.currentRecipient || 'Tutti';

    extraHTML = `
      <!-- RUBRICA TELEFONICA FAMYLIA -->
      <div class="rubrica-phone-card">
        <div class="rubrica-phone-header" onclick="togglePhonebookCollapse()" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
            <span style="font-weight: 700; font-size: 1rem;">Rubrica Telefonica Famylia</span>
          </div>
          <span id="phonebookToggleIcon" style="transition: transform 0.2s ease;">▼</span>
        </div>

        <div id="phonebookContent" style="margin-top: 14px;">
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">
            Inserisci i numeri di cellulare di Giampy, Ty e Miki. Vengono salvati crittografati nella cassaforte.
          </p>

          <div class="phone-entry-row">
            <div class="phone-person-name">👨 Giampy</div>
            <input type="tel" id="phoneGiampy" class="phone-input" placeholder="Es. 3331234567" value="${escapeAttr(pb.Giampy || '')}" onchange="savePhonebook(false)" onblur="savePhonebook(false)">
            <button type="button" class="btn-call" onclick="callPerson('Giampy')" title="Chiama Giampy">📞 Chiama</button>
          </div>

          <div class="phone-entry-row">
            <div class="phone-person-name">👩 Ty</div>
            <input type="tel" id="phoneTy" class="phone-input" placeholder="Es. 3331234567" value="${escapeAttr(pb.Ty || '')}" onchange="savePhonebook(false)" onblur="savePhonebook(false)">
            <button type="button" class="btn-call" onclick="callPerson('Ty')" title="Chiama Ty">📞 Chiama</button>
          </div>

          <div class="phone-entry-row">
            <div class="phone-person-name">👦 Miki</div>
            <input type="tel" id="phoneMiki" class="phone-input" placeholder="Es. 3331234567" value="${escapeAttr(pb.Miki || '')}" onchange="savePhonebook(false)" onblur="savePhonebook(false)">
            <button type="button" class="btn-call" onclick="callPerson('Miki')" title="Chiama Miki">📞 Chiama</button>
          </div>

          <div style="margin-top: 14px; text-align: right;">
            <button type="button" class="btn-save-phonebook" onclick="savePhonebook(true)" style="padding: 9px 18px; border-radius: 10px; background: var(--color-primary); color: #fff; font-weight: 700; font-size: 0.85rem; border: none; cursor: pointer; box-shadow: var(--shadow-sm);">
              💾 Salva Numeri
            </button>
          </div>
        </div>
      </div>

      <!-- COMPOSITORE MESSAGGIO CON SCELTA MITTENTE E DESTINATARIO -->
      <div class="msg-composer">
        <div class="msg-composer-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span>Scrivi Messaggio Famylia</span>
        </div>

        <!-- DA (CHI SCRIVE) - BLINDATO SULL'UTENTE AUTENTICATO -->
        <div class="selector-group">
          <span class="selector-label">DA (Mittente verificato):</span>
          <div class="sender-fixed-card">
            <span style="font-size: 1.25rem;">${senderIcon}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 800; font-size: 0.95rem; color: #ffffff;">${escapeHTML(curSender)} (Tu)</span>
              <span style="font-size: 0.72rem; color: var(--accent-green); font-weight: 600;">🔒 Autenticato con PIN ${escapeHTML(curSender)}</span>
            </div>
          </div>
        </div>

        <!-- SELETTORE A (A CHI INVIARE) -->
        <div class="selector-group">
          <span class="selector-label">A (A chi inviare):</span>
          <div class="dest-selector">
            ${possibleRecipients.map(r => `
              <button type="button" data-person="${r.id}" class="dest-chip ${curDest === r.id ? 'active' : ''}" onclick="selectRecipient('${r.id}')">${r.label}</button>
            `).join('')}
          </div>
        </div>

        <textarea id="quickMsgText" class="msg-textarea" placeholder="Scrivi qui il messaggio..." rows="3"></textarea>

        <button type="button" class="btn-send-message" onclick="sendQuickFamilyMessage()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          <span>INVIA</span>
        </button>
      </div>
    `;
  }

  if (items.length === 0) {
    const emptyLabels = {
      debiti: 'Nessun debito o finanziamento inserito.',
      cassaforte: 'Nessun valore o combinazione inserita in cassaforte.',
      pw: 'Nessuna password salvata.',
      banca: 'Nessun conto bancario salvato.',
      info_case: 'Nessuna informazione casa o utenza salvata.',
      note: 'Nessuna nota presente.',
      messaggio: 'Nessun messaggio presente.'
    };
    const emptyText = emptyLabels[STATE.activeSection] || 'Nessun dato presente in questa sezione.';

    container.innerHTML = extraHTML + `
      <div style="text-align: center; padding: 28px 16px; color: var(--text-muted);">
        <p style="font-size: 0.95rem; margin-bottom: 8px; color: #ffffff; font-weight: 600;">${emptyText}</p>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">Tocca <strong>+ Nuova</strong> in alto a destra per aggiungere una voce.</p>
        ${STATE.activeSection !== 'messaggio' ? `
          <button type="button" class="neu-btn-primary" onclick="openAddModalForCurrentSection('${STATE.activeSection}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; font-size: 0.85rem; margin: 0 auto;">
            <span>➕ Aggiungi Informazione</span>
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = extraHTML + items.map(item => createEntryCardHTML(item)).join('');
}

function getPersonIcon(name) {
  if (!name) return '👤';
  if (name.includes('Ty')) return '👩';
  if (name.includes('Miki')) return '👦';
  if (name.includes('Giampy')) return '👨';
  if (name.includes('Tutti')) return '👨‍👩‍👧';
  return '👤';
}

function createEntryCardHTML(item) {
  if (item.section === 'messaggio') {
    const senderIcon = getPersonIcon(item.mittente);
    const destIcon = getPersonIcon(item.destinatario);
    const dateStr = item.createdAt ? formatTimeAgo(item.createdAt) : '';
    const mittenteText = item.mittente || 'Giampy';
    const destText = item.destinatario || 'Tutti';

    return `
      <article class="msg-item-card" id="card-${item.id}">
        <div class="msg-item-header">
          <span class="msg-item-sender">
            ${senderIcon} <strong>${escapeHTML(mittenteText)}</strong> ➔ ${destIcon} <strong>${escapeHTML(destText)}</strong>
          </span>
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
  } else if (item.section === 'debiti') {
    detailsHTML = `
      ${item.rata ? `
        <div class="entry-row">
          <span class="entry-label">Rata / Importo</span>
          <span class="entry-value" style="font-weight: 700; color: #ffffff;">${escapeHTML(item.rata)}</span>
          <button type="button" class="btn-copy" onclick="copyToClipboard('${escapeAttr(item.rata)}')">Copia</button>
        </div>
      ` : ''}
      ${item.scadenza ? `
        <div class="entry-row">
          <span class="entry-label">Scadenza</span>
          <span class="entry-value">${escapeHTML(item.scadenza)}</span>
        </div>
      ` : ''}
      ${item.creditore ? `
        <div class="entry-row">
          <span class="entry-label">Creditore / Banca</span>
          <span class="entry-value">${escapeHTML(item.creditore)}</span>
        </div>
      ` : ''}
    `;
  } else if (!['pw', 'banca', 'info_case', 'cassaforte', 'messaggio', 'note'].includes(item.section)) {
    detailsHTML = `
      ${item.valore ? `
        <div class="entry-row">
          <span class="entry-label">Dettaglio</span>
          <span class="entry-value">${escapeHTML(item.valore)}</span>
          <button type="button" class="btn-copy" onclick="copyToClipboard('${escapeAttr(item.valore)}')">Copia</button>
        </div>
      ` : ''}
      ${item.riferimento ? `
        <div class="entry-row">
          <span class="entry-label">Riferimento</span>
          <span class="entry-value">${escapeHTML(item.riferimento)}</span>
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
  openAddModalForCurrentSection(STATE.activeSection !== 'grid' && STATE.activeSection !== 'messaggio' && STATE.activeSection !== 'parking' ? STATE.activeSection : 'pw');
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

  if (section === 'parking') {
    saveManualParking();
    return;
  }

  const modal = document.getElementById('modalOverlay');
  const form = document.getElementById('entryForm');
  document.getElementById('modalHeading').textContent = 'Nuova Informazione';
  form.reset();
  document.getElementById('entryId').value = '';
  populateSectionSelectDropdown();
  document.getElementById('entrySectionSelect').value = section;
  const mittenteInput = document.getElementById('entryMittenteInput');
  if (mittenteInput) {
    mittenteInput.value = STATE.currentUser || 'Giampy';
  }
  adaptFormFields();
  modal.style.display = 'flex';
}

function openEditModal(id) {
  const item = STATE.entries.find(e => e.id === id);
  if (!item) return;

  const modal = document.getElementById('modalOverlay');
  document.getElementById('modalHeading').textContent = 'Modifica Informazione';
  document.getElementById('entryId').value = item.id;
  populateSectionSelectDropdown();
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

  // Debiti fields
  const elRata = document.getElementById('entryDebitoRataInput');
  const elScad = document.getElementById('entryDebitoScadenzaInput');
  const elCred = document.getElementById('entryDebitoCreditoreInput');
  if (elRata) elRata.value = item.rata || '';
  if (elScad) elScad.value = item.scadenza || '';
  if (elCred) elCred.value = item.creditore || '';

  // Custom fields
  const elValore = document.getElementById('entryCustomValoreInput');
  const elRif = document.getElementById('entryCustomRifInput');
  if (elValore) elValore.value = item.valore || '';
  if (elRif) elRif.value = item.riferimento || '';

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

  const fieldsDebiti = document.getElementById('fieldsDebiti');
  if (fieldsDebiti) fieldsDebiti.style.display = section === 'debiti' ? 'block' : 'none';

  const isCustom = !['pw', 'banca', 'info_case', 'cassaforte', 'messaggio', 'note', 'debiti'].includes(section);
  const fieldsCustom = document.getElementById('fieldsCustom');
  if (fieldsCustom) fieldsCustom.style.display = isCustom ? 'block' : 'none';

  const labelTitle = document.getElementById('labelTitle');
  if (section === 'messaggio') {
    labelTitle.textContent = 'Oggetto del Messaggio *';
  } else if (section === 'cassaforte') {
    labelTitle.textContent = 'Nome / Identificativo Cassaforte *';
  } else if (section === 'note') {
    labelTitle.textContent = 'Titolo della Nota / Disposizione *';
  } else if (section === 'debiti') {
    labelTitle.textContent = 'Nome Debito / Finanziamento / Rata *';
  } else if (isCustom) {
    const customSec = (STATE.customSections || []).find(s => s.id === section);
    labelTitle.textContent = customSec ? `Titolo ${customSec.name} *` : 'Titolo *';
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
    entryData.mittente = STATE.currentUser || 'Giampy';
    triggerPhoneNotification(`💬 Messaggio da ${entryData.mittente}`, notes || title);
  } else if (section === 'debiti') {
    const elRata = document.getElementById('entryDebitoRataInput');
    const elScad = document.getElementById('entryDebitoScadenzaInput');
    const elCred = document.getElementById('entryDebitoCreditoreInput');
    entryData.rata = elRata ? elRata.value.trim() : '';
    entryData.scadenza = elScad ? elScad.value.trim() : '';
    entryData.creditore = elCred ? elCred.value.trim() : '';
  } else {
    // Custom section
    const elValore = document.getElementById('entryCustomValoreInput');
    const elRif = document.getElementById('entryCustomRifInput');
    entryData.valore = elValore ? elValore.value.trim() : '';
    entryData.riferimento = elRif ? elRif.value.trim() : '';
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
    const res = await fetch('/api/vault?t=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (!res.ok) return;
    const remoteVault = await res.json();
    if (!remoteVault || !remoteVault.updatedAt) return;

    if (STATE.encryptedVault && remoteVault.updatedAt === STATE.encryptedVault.updatedAt) {
      return; // Nessun nuovo dato
    }

    const decryptedJson = await decryptData(remoteVault.data, STATE.masterKey);
    const parsed = JSON.parse(decryptedJson || '[]');
    const newEntries = Array.isArray(parsed) ? parsed : (parsed.entries || []);
    
    if (parsed && typeof parsed === 'object') {
      if (parsed.customSections) {
        STATE.customSections = parsed.customSections;
      }
      if (parsed.phonebook) {
        STATE.phonebook = Object.assign({ Giampy: '', Ty: '', Miki: '' }, parsed.phonebook);
        localStorage.setItem('famylia_phonebook', JSON.stringify(STATE.phonebook));

        const inpG = document.getElementById('phoneGiampy');
        const inpT = document.getElementById('phoneTy');
        const inpM = document.getElementById('phoneMiki');
        if (inpG && document.activeElement !== inpG) inpG.value = STATE.phonebook.Giampy || '';
        if (inpT && document.activeElement !== inpT) inpT.value = STATE.phonebook.Ty || '';
        if (inpM && document.activeElement !== inpM) inpM.value = STATE.phonebook.Miki || '';
      }
    }

    const oldMsgIds = new Set(STATE.entries.filter(e => e.section === 'messaggio').map(e => e.id));
    const newlyAdded = newEntries.filter(e => e.section === 'messaggio' && !oldMsgIds.has(e.id));

    STATE.encryptedVault = remoteVault;
    STATE.entries = newEntries;
    localStorage.setItem('family_vault_encrypted', JSON.stringify(remoteVault));

    updateTileCounts();
    updateAppIconBadge();

    // Se l'utente è attualmente in una schermata di dettaglio, aggiorna la vista per mostrare i dati freschi
    if (STATE.activeSection && STATE.activeSection !== 'grid') {
      const activeEl = document.activeElement;
      const isUserTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (!isUserTyping) {
        renderSectionList();
      }
    }

    // Se un altro membro della famiglia ha scritto un nuovo messaggio, fai suonare la notifica
    if (newlyAdded.length > 0) {
      const latest = newlyAdded[0];
      if (latest.mittente !== STATE.currentUser) {
        triggerPhoneNotification(`💬 Messaggio da ${latest.mittente || 'Famiglia'}`, latest.notes || latest.title);
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
