#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const AUTH_FILE = path.join(__dirname, 'auth_store.json');

const newPw = process.argv[2];

if (!newPw) {
  console.log('Uso: node set_admin_password.js <nuova_password>');
  console.log('Esempio: node set_admin_password.js MiaPasswordSicura2026');
  process.exit(1);
}

let store = {
  singlePassword: '000',
  phoneMasked: '+39 335 ••• •933',
  updatedAt: new Date().toISOString()
};

if (fs.existsSync(AUTH_FILE)) {
  try {
    store = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  } catch (e) {}
}

store.singlePassword = newPw.trim();
store.updatedAt = new Date().toISOString();

fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), 'utf8');

console.log('--------------------------------------------------');
console.log('✅ PASSWORD AMMINISTRATORE AGGIORNATA CON SUCCESSO');
console.log(`- Nuova Password: ${store.singlePassword}`);
console.log(`- Aggiornato il:  ${store.updatedAt}`);
console.log('--------------------------------------------------');
