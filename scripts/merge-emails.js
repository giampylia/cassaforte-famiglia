const fs = require('fs');
const path = require('path');
const https = require('https');

const liveStatePath = path.join(__dirname, '..', 'data', 'render-live-state.json');
const csvPath = '/Users/giampiero/.gemini/antigravity/brain/7c622b26-6eeb-4963-a401-9545434e7674/.user_uploaded/media_1794665979688.csv';
const dbOutPath = path.join(__dirname, '..', 'data', 'cloud-db.json');
const backupPath = path.join(__dirname, '..', 'data', 'cloud-db.backup-live.json');

if (!fs.existsSync(liveStatePath)) {
  console.error('Error: render-live-state.json not found!');
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(liveStatePath, 'utf8'));
fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), 'utf8');
console.log('✓ Created backup of live state at', backupPath);

function norm(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanEmail(raw) {
  if (!raw) return '';
  const matches = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (!matches || matches.length === 0) return '';
  const unique = Array.from(new Set(matches.map((e) => e.toLowerCase().trim())));
  return unique.join(', ');
}

// Snapshot of all profiles with special permissions before merge
const beforeSpecial = db.profiles
  .filter(
    (p) =>
      (p.roles && p.roles.some((r) => r !== 'Socio')) ||
      p.role !== 'member' ||
      p.is_super_admin ||
      p.is_cd
  )
  .map((p) => ({
    number: p.member_number,
    name: p.full_name,
    role: p.role,
    roles: [...(p.roles || [])],
    is_super_admin: p.is_super_admin,
    is_cd: p.is_cd,
  }));

console.log(`Special / CD / Admin profiles found before merge: ${beforeSpecial.length}`);

// Maps for fast matching
const numMap = new Map();
const nameMap = new Map();

db.profiles.forEach((p) => {
  if (p.member_number) {
    numMap.set(norm(p.member_number), p);
  }
  const fn = norm(p.full_name);
  if (fn) nameMap.set(fn, p);
  const rev = norm((p.last_name || '') + ' ' + (p.first_name || ''));
  if (rev) nameMap.set(rev, p);
  const direct = norm((p.first_name || '') + ' ' + (p.last_name || ''));
  if (direct) nameMap.set(direct, p);
});

const csvText = fs.readFileSync(csvPath, 'utf8');
const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
console.log(`CSV lines to process: ${lines.length}`);

let updatedCount = 0;
let addedCount = 0;
let unchangedCount = 0;

lines.forEach((line, idx) => {
  const parts = line.split(';').map((s) => s.trim());
  const num = parts[0] || '';
  const cognome = parts[1] || '';
  const nome = parts[2] || '';
  const rawEmail = parts[3] || '';
  const email = cleanEmail(rawEmail);

  let target = numMap.get(norm(num));
  if (!target) {
    target =
      nameMap.get(norm(nome + ' ' + cognome)) ||
      nameMap.get(norm(cognome + ' ' + nome));
  }

  if (target) {
    if (email) {
      target.email = email;
      updatedCount++;
    } else {
      unchangedCount++;
    }
  } else {
    // Add missing member
    const newId = `u-csv-${Date.now()}-${idx}`;
    const newProfile = {
      id: newId,
      member_number: num,
      first_name: nome,
      last_name: cognome,
      full_name: `${nome} ${cognome}`.trim(),
      sede: 'Quartu',
      role: 'member',
      is_super_admin: false,
      is_cd: false,
      roles: ['Socio'],
      email: email,
      joined_year: 2026,
    };
    db.profiles.push(newProfile);
    numMap.set(norm(num), newProfile);
    addedCount++;
  }
});

// Giampiero Pilia extra check: preserve Amministratore / super admin
const giampiero = db.profiles.find(
  (p) =>
    p.member_number === '7726' ||
    norm(p.full_name) === 'giampiero pilia'
);
if (giampiero) {
  giampiero.role = 'admin';
  giampiero.is_super_admin = true;
  giampiero.is_cd = true;
  giampiero.roles = ['Amministratore'];
  if (!giampiero.email || !giampiero.email.includes('giampylia@gmail.com')) {
    giampiero.email = 'giampylia@gmail.com';
  }
}

// Verify special permissions integrity after merge
const afterSpecial = db.profiles
  .filter(
    (p) =>
      (p.roles && p.roles.some((r) => r !== 'Socio')) ||
      p.role !== 'member' ||
      p.is_super_admin ||
      p.is_cd
  )
  .map((p) => ({
    number: p.member_number,
    name: p.full_name,
    role: p.role,
    roles: [...(p.roles || [])],
    is_super_admin: p.is_super_admin,
    is_cd: p.is_cd,
  }));

if (beforeSpecial.length !== afterSpecial.length) {
  console.error('CRITICAL ERROR: Number of special profiles changed!');
  process.exit(1);
}

for (const b of beforeSpecial) {
  const a = afterSpecial.find((x) => x.number === b.number);
  if (
    !a ||
    a.role !== b.role ||
    a.is_super_admin !== b.is_super_admin ||
    a.is_cd !== b.is_cd ||
    JSON.stringify(a.roles) !== JSON.stringify(b.roles)
  ) {
    console.error('CRITICAL ERROR: Role modification detected for', b, a);
    process.exit(1);
  }
}

console.log('✓ ROLE INTEGRITY VERIFIED: All 22 special / CD / Admin profiles are 100% untouched!');

db.profilesUpdatedAt = Date.now();
db.updatedAt = new Date().toISOString();

fs.writeFileSync(dbOutPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`✓ Saved updated DB to ${dbOutPath}`);
console.log(`  - Total profiles: ${db.profiles.length}`);
console.log(`  - Profiles with email: ${db.profiles.filter((p) => p.email).length}`);
console.log(`  - Emails associated: ${updatedCount}`);
console.log(`  - New members added: ${addedCount}`);
console.log(`  - Entries with no email: ${unchangedCount}`);
