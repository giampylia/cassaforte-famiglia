// Test implementation of pure JS AES-256-CTR + SHA256 / PBKDF2
const fs = require('fs');

// S-Box
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
  // keyBytes must be 32 bytes (256 bits)
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
  // input is 16 bytes, out is Uint8Array
  let s0 = (input[0] << 24) | (input[1] << 16) | (input[2] << 8) | input[3];
  let s1 = (input[4] << 24) | (input[5] << 16) | (input[6] << 8) | input[7];
  let s2 = (input[8] << 24) | (input[9] << 16) | (input[10] << 8) | input[11];
  let s3 = (input[12] << 24) | (input[13] << 16) | (input[14] << 8) | input[15];

  s0 ^= roundKeys[0]; s1 ^= roundKeys[1]; s2 ^= roundKeys[2]; s3 ^= roundKeys[3];

  function xtime(x) {
    return ((x << 1) ^ ((x >>> 7) * 0x11b)) & 0xff;
  }

  for (let round = 1; round <= 13; round++) {
    const kOffset = round * 4;
    // SubBytes & ShiftRows
    const b0 = SBOX[(s0 >>> 24) & 0xff], b1 = SBOX[(s1 >>> 16) & 0xff], b2 = SBOX[(s2 >>> 8) & 0xff], b3 = SBOX[s3 & 0xff];
    const b4 = SBOX[(s1 >>> 24) & 0xff], b5 = SBOX[(s2 >>> 16) & 0xff], b6 = SBOX[(s3 >>> 8) & 0xff], b7 = SBOX[s0 & 0xff];
    const b8 = SBOX[(s2 >>> 24) & 0xff], b9 = SBOX[(s3 >>> 16) & 0xff], b10 = SBOX[(s0 >>> 8) & 0xff], b11 = SBOX[s1 & 0xff];
    const b12 = SBOX[(s3 >>> 24) & 0xff], b13 = SBOX[(s0 >>> 16) & 0xff], b14 = SBOX[(s1 >>> 8) & 0xff], b15 = SBOX[s2 & 0xff];

    // MixColumns
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

  // Round 14 (no MixColumns)
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

// AES-CTR Encrypt / Decrypt
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
    // Increment 128-bit counter
    for (let k = 15; k >= 0; k--) {
      counter[k] = (counter[k] + 1) & 0xff;
      if (counter[k] !== 0) break;
    }
  }
  return out;
}

// SHA-256 implementation
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

  // Length in bits big-endian
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

// Simple key derivation from password + salt
function deriveKeys(password, salt) {
  const enc = new TextEncoder();
  let key = enc.encode(password + '::' + salt);
  for (let i = 0; i < 1000; i++) {
    key = sha256(key);
  }
  return key; // 32 bytes
}

// Test
const testPw = 'MioSegreto123';
const salt = 'salt123456';
const key = deriveKeys(testPw, salt);
const iv = new Uint8Array(16);
for (let i = 0; i < 16; i++) iv[i] = i + 1;

const plain = new TextEncoder().encode('Hello Family Vault! IBAN: IT00012345');
const encrypted = aesCtr(plain, key, iv);
const decrypted = aesCtr(encrypted, key, iv);
const decStr = new TextDecoder().decode(decrypted);

console.log('Original:', 'Hello Family Vault! IBAN: IT00012345');
console.log('Decrypted:', decStr);
console.log('MATCH:', decStr === 'Hello Family Vault! IBAN: IT00012345');
