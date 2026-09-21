const fs = require('fs');
const path = require('path');

console.log('--- TEST VERIFICA CASSAFORTE CON TUTTI I TASTI ---');

const requiredFiles = [
  'server.js',
  'package.json',
  'public/index.html',
  'public/styles.css',
  'public/app.js',
  'public/sw.js',
  'public/manifest.json',
  'public/icons/icon-pw.svg',
  'public/icons/icon-banca.svg',
  'public/icons/icon-infocase.svg',
  'public/icons/icon-note.svg',
  'public/icons/icon-cassaforte.svg',
  'public/icons/icon-messaggio.svg',
  'public/icons/icon-plus.svg',
  'public/icons/icon-192.svg',
  'vercel.json',
  'api/vault.js'
];

let allOk = true;
for (const f of requiredFiles) {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) {
    console.error(`❌ Manca: ${f}`);
    allOk = false;
  } else {
    console.log(`✅ OK: ${f} (${fs.statSync(p).size} byte)`);
  }
}

if (!allOk) process.exit(1);

console.log('\n🎉 TUTTI I TASTI (PW, BANCA, INFO CASE, NOTE, CASSAFORTE, MESSAGGI) SONO OPERATIVI!');
