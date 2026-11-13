export type ClassroomKey =
  | 'verde'
  | 'gialla'
  | 'rossa'
  | 'rocchitta'
  | 'san_benedetto'
  | 'biblioteca'
  | 'ferrini'
  | 'porcu'
  | 'teatro_sinnai'
  | 'polifunzionale'
  | (string & {});

export interface ClassroomInfo {
  key: ClassroomKey;
  name: string;
  fullName: string;
  image: string;
  colorType: 'verde' | 'gialla' | 'rossa' | 'blue';
  bgColor: string;
  badgeColor: string;
  sede: 'Quartu' | 'Soleminis';
  capacity: number;
  locationNote: string;
  isCustom?: boolean;
}

export interface Profile {
  id: string;
  member_number: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  sede: 'Quartu' | 'Soleminis';
  role: 'member' | 'admin';
  is_super_admin?: boolean;
  is_cd?: boolean;
  roles?: string[];
  phone?: string;
  email?: string;
  joined_year?: number;
}

export const DEFAULT_AVAILABLE_ROLES: string[] = [
  'Socio',
  'Segreteria',
  'Amministrativo',
  'Didattica',
  'Viaggi',
  'Biblioteca',
  'Presidenza',
  'LsC',
  'Amministratore',
];

export interface VideoNotice {
  id: string;
  title: string;
  imageUrl: string;
  tickerText: string;
  durationSec: number;
  transition: 'dissolvenza' | 'scorrimento' | 'zoom';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isActive: boolean;
  orderIndex: number;
  createdAt: string;
}

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  genre: string;
  collocation?: string;
  year?: number | string;
  notes?: string;
  available?: boolean;
  createdAt?: string;
}

export function isProtectedSuperAdmin(p?: Partial<Profile> | null): boolean {
  if (!p) return false;
  const num = String(p.member_number || '').trim();
  const full = `${p.first_name || ''} ${p.last_name || ''} ${p.full_name || ''}`.toLowerCase();
  return (
    Boolean(p.is_super_admin) ||
    num === '7726' ||
    num === '7796' ||
    p.id === 'admin-7726' ||
    p.id === 'admin-7796' ||
    (full.includes('giampiero') && full.includes('pilia'))
  );
}

export function isProtectedSegreteriaMember(p?: Partial<Profile> | null): boolean {
  if (!p) return false;
  const num = String(p.member_number || '').trim();
  const full = `${p.first_name || ''} ${p.last_name || ''} ${p.full_name || ''}`.toLowerCase();
  return (
    num === '9999' ||
    num === '9998' ||
    p.id === 'segreteria-9999' ||
    p.id === 'segreteria-9998' ||
    (full.includes('nives') && full.includes('cocco')) ||
    (full.includes('josh') && full.includes('cocco'))
  );
}

export function getMemberParts(p: Profile): {
  firstName: string;
  lastName: string;
  primaryRole: string;
} {
  if (isProtectedSuperAdmin(p)) {
    const customRoles = (p.roles || []).filter((r) => r !== 'Socio');
    const primaryRole = customRoles.length > 0 ? customRoles.join(', ') : 'Amministratore';
    return {
      firstName: 'Giampiero',
      lastName: 'Pilia',
      primaryRole,
    };
  }

  const numTrim = String(p.member_number || '').trim();
  if (numTrim === '9999' || p.id === 'segreteria-9999') {
    return {
      firstName: 'Nives',
      lastName: 'Cocco',
      primaryRole: 'Segreteria',
    };
  }
  if (numTrim === '9998' || p.id === 'segreteria-9998') {
    return {
      firstName: 'Josh Ronald',
      lastName: 'Cocco',
      primaryRole: 'Segreteria',
    };
  }

  let firstName = (p.first_name || '').replace(/\b\d{3,}\b/g, '').trim();
  let lastName = (p.last_name || '').replace(/\b\d{3,}\b/g, '').trim();

  if (!firstName && !lastName && p.full_name) {
    const cleanFull = p.full_name.replace(/\b\d{3,}\b/g, '').trim();
    const parts = cleanFull.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      firstName = parts[0];
      lastName = '';
    } else if (parts.length > 1) {
      // Ultima parola come cognome, precedenti come nome (es. "Maria Bonaria Melis" -> Nome: "Maria Bonaria", Cognome: "Melis")
      lastName = parts[parts.length - 1];
      firstName = parts.slice(0, -1).join(' ');
    }
  }

  let primaryRole = 'Socio';
  if (p.roles && p.roles.length > 0) {
    const nonSocio = p.roles.filter((r) => r !== 'Socio');
    primaryRole = nonSocio.length > 0 ? nonSocio.join(', ') : 'Socio';
  } else if (p.is_cd) {
    primaryRole = 'CD';
  }

  return { firstName, lastName, primaryRole };
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export type CashMovementType = 'spesa' | 'entrata';
export type CashMovementStatus = 'inviato' | 'approvato' | 'pagato';

export interface CashMovement {
  id: string;
  requester_id: string;
  requester_name: string;       // Fruitore del rimborso / Beneficiario / Versante
  compiled_by_id?: string;      // ID utente autenticato che ha compilato la pratica
  compiled_by_name?: string;    // Nome utente autenticato che ha compilato la pratica
  user_id?: string;
  member_number?: string;
  first_name?: string;
  last_name?: string;
  entry_type: CashMovementType; // 'spesa' = Richiesta Rimborso, 'entrata' = Versamento
  request_date: string;         // YYYY-MM-DD (Data richiesta)
  receipt_date?: string;        // YYYY-MM-DD (Data scontrino)
  receipt_number?: string;      // N° scontrino
  amount_requested: number;     // Importo (€)
  amount_paid?: number | null;  // Importo versato/rimborsato (€)
  category_id?: string | null;
  category_name: string;        // Causale
  custom_category?: string | null;
  description?: string;         // Descrizione / Note
  receipt_image_data?: string;
  receipt_image_url?: string | null;
  payment_date?: string;
  status: CashMovementStatus;   // 'inviato' | 'approvato' | 'pagato'
  signed_by_requester?: boolean;
  signed_by_treasurer?: boolean;
  created_at: string;
}

export interface Lesson {
  id: string;
  classroom: ClassroomKey;
  subject: string;
  teacher: string;
  category: string;
  day_of_week: number; // 0 = Domenica, 1 = Lunedì ... 6 = Sabato
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
}

/**
 * Rileva conflitti e sovrapposizioni d'aula tra lezioni nello stesso giorno e orario:
 * in una stessa aula non possono svolgersi 2 lezioni in contemporanea.
 * Ritorna una Map dove la chiave è l'id della lezione e il valore è la lista di lezioni con cui è in conflitto.
 */
export function findLessonConflicts(allLessons: Lesson[]): Map<string, Lesson[]> {
  const conflictMap = new Map<string, Lesson[]>();
  if (!Array.isArray(allLessons) || allLessons.length < 2) return conflictMap;

  for (let i = 0; i < allLessons.length; i++) {
    const a = allLessons[i];
    const s1 = (a.start_time || '').trim().slice(0, 5);
    const e1 = (a.end_time || '').trim().slice(0, 5);
    if (!s1 || !e1 || s1 >= e1) continue;

    for (let j = i + 1; j < allLessons.length; j++) {
      const b = allLessons[j];
      if (a.classroom !== b.classroom) continue;
      if (Number(a.day_of_week) !== Number(b.day_of_week)) continue;

      const s2 = (b.start_time || '').trim().slice(0, 5);
      const e2 = (b.end_time || '').trim().slice(0, 5);
      if (!s2 || !e2 || s2 >= e2) continue;

      // Sovrapposizione temporale su intervalli [s1, e1) e [s2, e2): s1 < e2 && s2 < e1
      if (s1 < e2 && s2 < e1) {
        if (!conflictMap.has(a.id)) conflictMap.set(a.id, []);
        if (!conflictMap.has(b.id)) conflictMap.set(b.id, []);
        conflictMap.get(a.id)!.push(b);
        conflictMap.get(b.id)!.push(a);
      }
    }
  }

  return conflictMap;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  classroom: ClassroomKey;
  lesson_id: string;
  created_at: string; // ISO string
  rating?: 1 | 2 | 3; // 1 = Da migliorare, 2 = Interessante, 3 = Molto utile e chiara
}

export interface SubjectDidacticNote {
  subject: string;
  didactic_goal: string;
  staff_note: string;
  manual_utility_boost?: number; // -10 to +10
  updated_at: string;
}

export const DAYS_IT = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
];

export const CLASSROOMS: ClassroomInfo[] = [
  {
    key: 'verde',
    name: 'Verde',
    fullName: 'Aula Verde',
    image: '/assets/aula-verde.png',
    colorType: 'verde',
    bgColor: '#15803d',
    badgeColor: '#16a34a',
    sede: 'Quartu',
    capacity: 45,
    locationNote: 'Piano Terra · Ingresso Principale',
  },
  {
    key: 'gialla',
    name: 'Gialla',
    fullName: 'Aula Gialla',
    image: '/assets/aula-gialla.png',
    colorType: 'gialla',
    bgColor: '#ca8a04',
    badgeColor: '#eab308',
    sede: 'Quartu',
    capacity: 38,
    locationNote: 'Piano Terra · Ala Est',
  },
  {
    key: 'rossa',
    name: 'Rossa',
    fullName: 'Aula Rossa',
    image: '/assets/aula-rossa.png',
    colorType: 'rossa',
    bgColor: '#b91c1c',
    badgeColor: '#dc2626',
    sede: 'Quartu',
    capacity: 50,
    locationNote: 'Piano Terra · Sala Conferenze',
  },
  {
    key: 'rocchitta',
    name: 'Rocchitta',
    fullName: 'Aula Rocchitta',
    image: '/assets/aula-rocchitta.png',
    colorType: 'blue',
    bgColor: '#1d4ed8',
    badgeColor: '#2563eb',
    sede: 'Quartu',
    capacity: 35,
    locationNote: 'Sede Via Rocchitta · Quartu',
  },
  {
    key: 'san_benedetto',
    name: 'S. Benedetto',
    fullName: 'Aula San Benedetto',
    image: '/assets/aula-san-benedetto.png',
    colorType: 'blue',
    bgColor: '#1e40af',
    badgeColor: '#3b82f6',
    sede: 'Quartu',
    capacity: 42,
    locationNote: 'Polo San Benedetto · Quartu',
  },
  {
    key: 'biblioteca',
    name: 'Biblioteca',
    fullName: 'Aula Biblioteca',
    image: '/assets/aula-biblioteca.png',
    colorType: 'blue',
    bgColor: '#0f766e',
    badgeColor: '#14b8a6',
    sede: 'Quartu',
    capacity: 28,
    locationNote: 'Sala Lettura & Studi · Quartu',
  },
  {
    key: 'ferrini',
    name: 'Ferrini',
    fullName: 'Aula Ferrini',
    image: '/assets/aula-ferrini.png',
    colorType: 'blue',
    bgColor: '#4338ca',
    badgeColor: '#6366f1',
    sede: 'Quartu',
    capacity: 40,
    locationNote: 'Complesso Ferrini · Quartu',
  },
  {
    key: 'porcu',
    name: 'Via Porcu',
    fullName: 'Via Eligio Porcu 116 (2° P.)',
    image: '/assets/aula-verde.png',
    colorType: 'verde',
    bgColor: '#059669',
    badgeColor: '#10b981',
    sede: 'Quartu',
    capacity: 30,
    locationNote: 'Via Eligio Porcu 116 2° piano · Quartu',
  },
  {
    key: 'teatro_sinnai',
    name: 'Teatro Sinnai',
    fullName: 'Teatro Civico di Sinnai',
    image: '/assets/aula-san-benedetto.png',
    colorType: 'blue',
    bgColor: '#c2410c',
    badgeColor: '#ea580c',
    sede: 'Quartu',
    capacity: 100,
    locationNote: 'Teatro di Sinnai · Lab. Teatrale',
  },
  {
    key: 'polifunzionale',
    name: 'Polifunzionale',
    fullName: 'Aula Polifunzionale',
    image: '/assets/aula-polifunzionale.png',
    colorType: 'blue',
    bgColor: '#6d28d9',
    badgeColor: '#8b5cf6',
    sede: 'Soleminis',
    capacity: 45,
    locationNote: 'Centro Culturale · Sede di Soleminis',
  },
];

export const DEFAULT_CLASSROOMS = CLASSROOMS;

export const CLASSROOM_LABELS: Record<ClassroomKey, string> = {
  verde: 'Aula Verde',
  gialla: 'Aula Gialla',
  rossa: 'Aula Rossa',
  rocchitta: 'Aula Rocchitta',
  san_benedetto: 'Aula S. Benedetto',
  biblioteca: 'Aula Biblioteca',
  ferrini: 'Aula Ferrini',
  porcu: 'Via Porcu 116',
  teatro_sinnai: 'Teatro di Sinnai',
  polifunzionale: 'Aula Polifunzionale',
};

export interface SubjectMeta {
  emoji: string;
  category: string;
  shortDesc: string;
}

export function getSubjectMeta(subject: string): SubjectMeta {
  const s = subject.toLowerCase();
  if (s.includes('informatica') || s.includes('smartphone') || s.includes('digitale')) {
    return { emoji: '📱', category: 'Competenze Digitali', shortDesc: 'Uso pratico di smartphone, SPID e internet sicuro' };
  }
  if (s.includes('inglese') || s.includes('spagnolo') || s.includes('francese') || s.includes('lingua')) {
    return { emoji: '🗣️', category: 'Lingue Straniere', shortDesc: 'Conversazione, ascolto e memoria linguistica attiva' };
  }
  if (s.includes('ginnastica') || s.includes('posturale') || s.includes('motoria') || s.includes('ballo') || s.includes('yoga')) {
    return { emoji: '🧘', category: 'Benessere & Movimento', shortDesc: 'Mobilità articolare, equilibrio e socializzazione motoria' };
  }
  if (s.includes('storia') || s.includes('sardegna') || s.includes('archeologia') || s.includes('sarda')) {
    return { emoji: '🏛️', category: 'Storia e Cultura Sarda', shortDesc: 'Radici storiche, identità culturale e territorio' };
  }
  if (s.includes('arte') || s.includes('pittura') || s.includes('disegno') || s.includes('fotografia')) {
    return { emoji: '🎨', category: 'Arte e Creatività', shortDesc: 'Espressione artistica, storia dei capolavori e manualità' };
  }
  if (s.includes('letteratura') || s.includes('poesia') || s.includes('scrittura') || s.includes('filosofia')) {
    return { emoji: '📚', category: 'Umanistica e Lettere', shortDesc: 'Lettura critica, dibattito culturale e memoria storica' };
  }
  if (s.includes('psicologia') || s.includes('medicina') || s.includes('salute') || s.includes('nutrizione') || s.includes('mente')) {
    return { emoji: '🩺', category: 'Salute e Prevenzione', shortDesc: 'Invecchiamento attivo, memoria e benessere psicofisico' };
  }
  if (s.includes('teatro') || s.includes('coro') || s.includes('musica') || s.includes('canto')) {
    return { emoji: '🎭', category: 'Musica e Spettacolo', shortDesc: 'Espressione vocale, recitazione e lavoro di gruppo' };
  }
  return { emoji: '🎓', category: 'Cultura Generale', shortDesc: 'Approfondimento interdisciplinare e partecipazione attiva' };
}

export const INITIAL_PROFILES: Profile[] = [
  { id: 'admin-7726', member_number: '7726', first_name: 'Giampiero', last_name: 'Pilia', full_name: 'Giampiero Pilia', sede: 'Quartu', role: 'admin', is_super_admin: true, is_cd: true, roles: ['Amministratore'], phone: '070 881234', email: 'giampiero.lia@gmail.com', joined_year: 2018 },
  { id: 'u-cd-sotgiu', member_number: 'CD-SOTGIU', first_name: 'Maria Giovanna', last_name: 'Sotgiu', full_name: 'Maria Giovanna Sotgiu', sede: 'Quartu', role: 'member', is_super_admin: false, is_cd: true, roles: ['Socio'], phone: '', email: 'mariagiovanna.sotgiu@gmail.com', joined_year: 2024 },
  { id: 'u-6128', member_number: '6128', first_name: 'Docente Didattica', last_name: 'QU3', full_name: 'Docente Didattica QU3', sede: 'Quartu', role: 'member', is_super_admin: false, is_cd: true, roles: ['Didattica'], phone: '070 881234', email: 'didattica@univerquartu.it', joined_year: 2020 },
  { id: 'segreteria-9999', member_number: '9999', first_name: 'Nives', last_name: 'Cocco', full_name: 'Nives Cocco', sede: 'Quartu', role: 'member', is_super_admin: false, is_cd: false, roles: ['Segreteria'], phone: '', email: 'nives.cocco@gmail.com', joined_year: 2024 },
  { id: 'segreteria-9998', member_number: '9998', first_name: 'Josh Ronald', last_name: 'Cocco', full_name: 'Josh Ronald Cocco', sede: 'Quartu', role: 'member', is_super_admin: false, is_cd: false, roles: ['Segreteria'], phone: '', email: 'josh.cocco@gmail.com', joined_year: 2024 },
  { id: 'admin-1', member_number: '000', first_name: 'Ufficio', last_name: 'Presenze QU3', full_name: 'Ufficio Presenze QU3', sede: 'Quartu', role: 'admin', is_super_admin: false, is_cd: false, roles: ['Didattica'], phone: '070 881234', email: 'segreteria@univerquartu.it', joined_year: 2018 },
  { id: 'u-101', member_number: '101', first_name: 'Maria Bonaria', last_name: 'Melis', full_name: 'Maria Bonaria Melis', sede: 'Quartu', role: 'member', is_cd: true, roles: ['Amministrativo'], phone: '347 1122334', joined_year: 2021 },
  { id: 'u-102', member_number: '102', first_name: 'Efisio', last_name: 'Piras', full_name: 'Efisio Piras', sede: 'Quartu', role: 'member', is_cd: true, roles: ['Amministrativo'], phone: '348 2233445', joined_year: 2020 },
  { id: 'u-103', member_number: '103', first_name: 'Anna Rita', last_name: 'Cao', full_name: 'Anna Rita Cao', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Socio'], phone: '349 3344556', joined_year: 2022 },
  { id: 'u-104', member_number: '104', first_name: 'Giampaolo', last_name: 'Sanna', full_name: 'Giampaolo Sanna', sede: 'Quartu', role: 'member', is_cd: true, roles: ['Viaggi'], phone: '340 4455667', joined_year: 2019 },
  { id: 'u-105', member_number: '105', first_name: 'Rosalba', last_name: 'Atzeni', full_name: 'Rosalba Atzeni', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Socio'], phone: '333 5566778', joined_year: 2023 },
  { id: 'u-106', member_number: '106', first_name: 'Salvatore', last_name: 'Palmas', full_name: 'Salvatore Palmas', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Socio'], phone: '335 6677889', joined_year: 2021 },
  { id: 'u-107', member_number: '107', first_name: 'Graziella', last_name: 'Lai', full_name: 'Graziella Lai', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Didattica'], phone: '338 7788990', joined_year: 2022 },
  { id: 'u-108', member_number: '108', first_name: 'Antonio Luigi', last_name: 'Deiana', full_name: 'Antonio Luigi Deiana', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Socio'], phone: '339 8899001', joined_year: 2020 },
  { id: 'u-109', member_number: '109', first_name: 'Franca', last_name: 'Murgia', full_name: 'Franca Murgia', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Socio'], phone: '328 9900112', joined_year: 2024 },
  { id: 'u-110', member_number: '110', first_name: 'Vincenzo', last_name: 'Fadda', full_name: 'Vincenzo Fadda', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Socio'], phone: '329 1011121', joined_year: 2021 },
  { id: 'u-111', member_number: '111', first_name: 'Lucia', last_name: 'Serra', full_name: 'Lucia Serra', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Socio'], phone: '347 2021223', joined_year: 2023 },
  { id: 'u-112', member_number: '112', first_name: 'Raimondo', last_name: 'Vacca', full_name: 'Raimondo Vacca', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Socio'], phone: '348 3031324', joined_year: 2022 },
  { id: 'u-113', member_number: '113', first_name: 'Teresa', last_name: 'Usai', full_name: 'Teresa Usai', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Socio'], phone: '349 4041425', joined_year: 2020 },
  { id: 'u-114', member_number: '114', first_name: 'Pietro Paolo', last_name: 'Loi', full_name: 'Pietro Paolo Loi', sede: 'Quartu', role: 'member', is_cd: false, roles: ['Socio'], phone: '340 5051526', joined_year: 2024 },
  { id: 'u-201', member_number: '201', first_name: 'Assunta', last_name: 'Corda', full_name: 'Assunta Corda', sede: 'Soleminis', role: 'member', is_cd: false, roles: ['Socio'], phone: '333 6061627', joined_year: 2022 },
  { id: 'u-202', member_number: '202', first_name: 'Ignazio', last_name: 'Spiga', full_name: 'Ignazio Spiga', sede: 'Soleminis', role: 'member', is_cd: false, roles: ['Socio'], phone: '338 7071728', joined_year: 2021 },
  { id: 'u-203', member_number: '203', first_name: 'Caterina', last_name: 'Mura', full_name: 'Caterina Mura', sede: 'Soleminis', role: 'member', is_cd: false, roles: ['Socio'], phone: '347 8081829', joined_year: 2023 },
  { id: 'u-204', member_number: '204', first_name: 'Gavino', last_name: 'Carta', full_name: 'Gavino Carta', sede: 'Soleminis', role: 'member', is_cd: false, roles: ['Socio'], phone: '349 9091920', joined_year: 2022 },
];

export const INITIAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-1', name: 'Cancelleria e Stampati', description: 'Carta, toner, cartellette, materiale segreteria', is_active: true },
  { id: 'cat-2', name: 'Materiale Didattico e Corsi', description: 'Dispense, attrezzature aule, supporti per docenti', is_active: true },
  { id: 'cat-3', name: 'Pulizia e Igiene Aule', description: 'Prodotti sanificazione e pulizia sedi Quartu e Soleminis', is_active: true },
  { id: 'cat-4', name: 'Rinfreschi, Eventi e Convegni', description: 'Inaugurazione anno accademico, incontri culturali', is_active: true },
  { id: 'cat-5', name: 'Manutenzione e Piccole Riparazioni', description: 'Interventi tecnici, lampadine, microfoni, chiavi', is_active: true },
  { id: 'cat-6', name: 'Spese Postali, Bolli e Segreteria', description: 'Francobolli, raccomandate, marche da bollo', is_active: true },
  { id: 'cat-7', name: 'Trasferte, Viaggi ed Escursioni', description: 'Rimborsi organizzazione uscite culturali e visite guidate', is_active: true },
  { id: 'cat-8', name: 'Quote e Versamenti Soci', description: 'Versamento quote associative o contributi in cassa', is_active: true },
  { id: 'cat-9', name: 'Contributi ed Erogazioni', description: 'Entrate e versamenti straordinari in piccola cassa', is_active: true },
  { id: 'cat-10', name: 'Abbonamenti', description: 'Licenze software, Photoshop e abbonamenti digitali', is_active: true },
  { id: 'cat-11', name: 'Per dispositivi badge', description: 'SIM Tim, apparati hardware e lettori presenze', is_active: true },
  { id: 'cat-12', name: 'Duplicazione chiavi', description: 'Duplicazione chiavi sedi e ferramenta', is_active: true },
  { id: 'cat-13', name: 'Materiale pulizie', description: 'Detergenti, igiene e pulizia locali', is_active: true },
  { id: 'cat-14', name: 'caramelle accoglienza', description: 'Caramelle e accoglienza soci', is_active: true },
  { id: 'cat-15', name: 'Parcheggio', description: 'Ticket sosta riunioni istituzionali e consulta', is_active: true },
  { id: 'cat-16', name: 'Omaggi Eventi', description: 'Omaggi docenti, relatori, musicisti e ospiti convegni', is_active: true },
  { id: 'cat-17', name: 'Quote Lezioni sul campo', description: 'Quote ingressi musei ed escursioni didattiche sul campo', is_active: true },
  { id: 'cat-18', name: 'Cancelleria', description: 'Timbri, carta e forniture cancelleria', is_active: true },
  { id: 'cat-19', name: 'Stampa Locandine', description: 'Stampe promozionali concerti e conferenze', is_active: true },
  { id: 'cat-20', name: 'Carte Carburanti', description: 'Rifornimenti carburante soci volontari CD', is_active: true },
  { id: 'cat-21', name: 'Anticipazione pagamento Contratto Enel via Pizzetti', description: 'Anticipazioni spese contrattuali e utenze', is_active: true },
];

import historicalCashMovementsData from './historicalCashMovements.json';

export const INITIAL_CASH_MOVEMENTS: CashMovement[] = historicalCashMovementsData as CashMovement[];

import parsedLessonsData from './parsedLessons.json';

export const INITIAL_LESSONS: Lesson[] = parsedLessonsData as Lesson[];

export const INITIAL_VIDEO_NOTICES: VideoNotice[] = [
  {
    id: 'vn-1',
    title: 'Benvenuti all\'Università della Terza Età',
    imageUrl: '/assets/aula-verde.png',
    tickerText: '★ Benvenuti all\'Università della Terza Età di Quartu Sant\'Elena — Anno Accademico 2026/2027 — Segreteria aperta dal Lunedì al Venerdì ore 09:00 - 12:00 e 16:00 - 18:30',
    durationSec: 7,
    transition: 'dissolvenza',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
    orderIndex: 0,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'vn-2',
    title: 'Avviso Iscrizione Laboratori e Corsi',
    imageUrl: '/assets/aula-san-benedetto.png',
    tickerText: '★ Sono aperte le iscrizioni ai nuovi laboratori culturali e artistici. Rivolgersi allo sportello segreteria o consultare il registro corsi.',
    durationSec: 7,
    transition: 'dissolvenza',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
    orderIndex: 1,
    createdAt: '2026-10-01T08:00:00.000Z',
  },
];

export const INITIAL_LIBRARY_BOOKS: LibraryBook[] = [
  {
    id: 'book-1',
    title: 'Canne al vento',
    author: 'Grazia Deledda',
    genre: 'Narrativa Sarda',
    collocation: 'SARD-01',
    year: 1913,
    notes: 'Capolavoro del Premio Nobel per la Letteratura',
    available: true,
  },
  {
    id: 'book-2',
    title: 'Un anno sull\'Altipiano',
    author: 'Emilio Lussu',
    genre: 'Storia & Memorialistica',
    collocation: 'STOR-14',
    year: 1938,
    notes: 'Memoria storica della Brigata Sassari',
    available: true,
  },
  {
    id: 'book-3',
    title: 'La Divina Commedia',
    author: 'Dante Alighieri',
    genre: 'Poesia Classica',
    collocation: 'POES-05',
    year: 1321,
    notes: 'Edizione integrale commentata',
    available: true,
  },
  {
    id: 'book-4',
    title: 'Il barone rampante',
    author: 'Italo Calvino',
    genre: 'Narrativa Italiana',
    collocation: 'NARR-22',
    year: 1957,
    notes: 'Trilogia de I nostri antenati',
    available: true,
  },
  {
    id: 'book-5',
    title: 'Il giorno del giudizio',
    author: 'Salvatore Satta',
    genre: 'Narrativa Sarda',
    collocation: 'SARD-03',
    year: 1979,
    notes: 'Romanzo corale ambientato a Nuoro',
    available: true,
  },
  {
    id: 'book-6',
    title: 'Storia dei Sardi e della Sardegna',
    author: 'Massimo Pittau',
    genre: 'Saggistica Sarda',
    collocation: 'SAG-08',
    year: 1984,
    notes: 'Origini della civiltà nuragica e lingua sarda',
    available: true,
  },
  {
    id: 'book-7',
    title: 'I promessi sposi',
    author: 'Alessandro Manzoni',
    genre: 'Romanzo Storico',
    collocation: 'CLASS-02',
    year: 1840,
    notes: 'Edizione con illustrazioni e note storiche',
    available: true,
  },
  {
    id: 'book-8',
    title: 'Se questo è un uomo',
    author: 'Primo Levi',
    genre: 'Testimonianza Storica',
    collocation: 'STOR-09',
    year: 1947,
    notes: 'Testimonianza fondamentale del Novecento',
    available: true,
  },
];

export const INITIAL_SUBJECT_NOTES: SubjectDidacticNote[] = [
  {
    subject: 'Smartphone e Servizi Digitali (SPID/FSE)',
    didactic_goal: 'Autonomia digitale dei soci nell\'uso di SPID, Fascicolo Sanitario Elettronico, WhatsApp e prenotazioni CUP.',
    staff_note: 'Corso ad altissima utilità pratica. I soci chiedono esercitazioni pratiche individuali passo-passo.',
    manual_utility_boost: 8,
    updated_at: '2026-10-18',
  },
  {
    subject: 'Ginnastica Dolce e Posturale',
    didactic_goal: 'Prevenzione cadute, mantenimento mobilità articolare e socializzazione attiva.',
    staff_note: 'Affluenza sempre vicina alla capienza massima dell\'Aula S. Benedetto. Ottima costanza.',
    manual_utility_boost: 7,
    updated_at: '2026-10-19',
  },
  {
    subject: 'Storia e Archeologia della Sardegna',
    didactic_goal: 'Conoscenza approfondita del patrimonio nuragico, giudicale e storico del Campidano.',
    staff_note: 'Molto seguito; consigliato abbinare uscite didattiche mensili ai siti archeologici.',
    manual_utility_boost: 6,
    updated_at: '2026-10-15',
  },
  {
    subject: 'Psicologia e Memoria Attiva',
    didactic_goal: 'Training cognitivo, esercizi di memoria e benessere emotivo nella terza età.',
    staff_note: 'Eccellente riscontro qualitativo nei questionari soci. Altissima fidelizzazione.',
    manual_utility_boost: 9,
    updated_at: '2026-10-20',
  },
  {
    subject: 'Inglese Base per Viaggiare',
    didactic_goal: 'Apprendimento di frasi chiave per viaggi, ascolto e stimolazione cognitiva linguistica.',
    staff_note: 'Buona partecipazione; utile fornire dispense cartacee con caratteri grandi (16pt).',
    manual_utility_boost: 4,
    updated_at: '2026-10-14',
  },
  {
    subject: 'Medicina Preventiva e Longevità',
    didactic_goal: 'Educazione sanitaria, corretta alimentazione e prevenzione cardiovascolare.',
    staff_note: 'Lezioni molto apprezzate per la chiarezza divulgativa del medico relatore.',
    manual_utility_boost: 8,
    updated_at: '2026-10-17',
  },
  {
    subject: 'Fotografia con lo Smartphone',
    didactic_goal: 'Imparare a scattare, archiviare e condividere foto dei nipoti e del territorio.',
    staff_note: 'Orario pomeridiano meno frequentato nei mesi autunnali; valutare spostamento al mattino.',
    manual_utility_boost: 0,
    updated_at: '2026-10-12',
  },
];

export function generateInitialAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const memberIdsQuartu = INITIAL_PROFILES.filter((p) => p.role === 'member' && p.sede === 'Quartu').map((p) => p.id);
  const memberIdsSoleminis = INITIAL_PROFILES.filter((p) => p.role === 'member' && p.sede === 'Soleminis').map((p) => p.id);

  // Presenze di OGGI (per mostrare subito i contatori attivi nelle aule!)
  const quartuSampleLessons = INITIAL_LESSONS.filter((l) => l.classroom !== 'polifunzionale').slice(0, 6);
  const todayLessons = quartuSampleLessons.map((l, idx) => ({
    lessonId: l.id,
    classroom: l.classroom,
    count: 8 + (idx % 6),
    ratingBias: 3 as const,
  }));

  todayLessons.forEach((tl, groupIdx) => {
    for (let i = 0; i < Math.min(tl.count, memberIdsQuartu.length); i++) {
      const uid = memberIdsQuartu[(i + groupIdx * 2) % memberIdsQuartu.length];
      // Evita di pre-timbrare il socio 101 in tutte le aule così l'utente può testare subito la timbratura con 101!
      if (uid === 'u-101') continue;
      const minuteOffset = (i * 3) % 45;
      const dt = new Date(`${todayStr}T09:${String(10 + minuteOffset).padStart(2, '0')}:00`);
      records.push({
        id: `att-today-${tl.lessonId}-${i}`,
        user_id: uid,
        classroom: tl.classroom,
        lesson_id: tl.lessonId,
        created_at: dt.toISOString(),
        rating: i % 5 === 0 ? 2 : tl.ratingBias,
      });
    }
  });

  // Presenze Soleminis oggi
  const solLesson = INITIAL_LESSONS.find((l) => l.classroom === 'polifunzionale');
  const solLessonId = solLesson ? solLesson.id : 'les-sol-1';
  memberIdsSoleminis.slice(1).forEach((uid, idx) => {
    records.push({
      id: `att-today-soleminis-${idx}`,
      user_id: uid,
      classroom: 'polifunzionale',
      lesson_id: solLessonId,
      created_at: new Date(`${todayStr}T09:${String(15 + idx * 4).padStart(2, '0')}:00`).toISOString(),
      rating: 3,
    });
  });

  // Storico ultime 4 settimane per analisi trend, assiduità soci ed efficacia materie
  const historicalSpec: { lessonId: string; classroom: ClassroomKey; daysAgo: number; attendees: number; avgRating: 1 | 2 | 3 }[] = [
    { lessonId: 'les-mon-1', classroom: 'verde', daysAgo: 3, attendees: 14, avgRating: 3 },
    { lessonId: 'les-mon-1', classroom: 'verde', daysAgo: 10, attendees: 13, avgRating: 3 },
    { lessonId: 'les-mon-1', classroom: 'verde', daysAgo: 17, attendees: 12, avgRating: 3 },
    { lessonId: 'les-mon-2', classroom: 'rossa', daysAgo: 3, attendees: 12, avgRating: 3 },
    { lessonId: 'les-mon-2', classroom: 'rossa', daysAgo: 10, attendees: 11, avgRating: 3 },
    { lessonId: 'les-mon-3', classroom: 'gialla', daysAgo: 3, attendees: 9, avgRating: 2 },
    { lessonId: 'les-mon-3', classroom: 'gialla', daysAgo: 10, attendees: 10, avgRating: 3 },
    { lessonId: 'les-mon-4', classroom: 'san_benedetto', daysAgo: 3, attendees: 14, avgRating: 3 },
    { lessonId: 'les-mon-4', classroom: 'san_benedetto', daysAgo: 10, attendees: 14, avgRating: 3 },
    { lessonId: 'les-tue-1', classroom: 'rossa', daysAgo: 2, attendees: 13, avgRating: 3 },
    { lessonId: 'les-tue-1', classroom: 'rossa', daysAgo: 9, attendees: 12, avgRating: 3 },
    { lessonId: 'les-tue-2', classroom: 'gialla', daysAgo: 2, attendees: 8, avgRating: 2 },
    { lessonId: 'les-tue-3', classroom: 'rocchitta', daysAgo: 2, attendees: 10, avgRating: 3 },
    { lessonId: 'les-tue-4', classroom: 'biblioteca', daysAgo: 2, attendees: 9, avgRating: 3 },
    { lessonId: 'les-tue-5', classroom: 'ferrini', daysAgo: 2, attendees: 7, avgRating: 2 },
    { lessonId: 'les-wed-1', classroom: 'verde', daysAgo: 1, attendees: 14, avgRating: 3 },
    { lessonId: 'les-wed-2', classroom: 'san_benedetto', daysAgo: 1, attendees: 13, avgRating: 3 },
    { lessonId: 'les-wed-3', classroom: 'rossa', daysAgo: 1, attendees: 11, avgRating: 3 },
    { lessonId: 'les-wed-5', classroom: 'ferrini', daysAgo: 1, attendees: 10, avgRating: 3 },
    { lessonId: 'les-thu-7', classroom: 'ferrini', daysAgo: 7, attendees: 4, avgRating: 2 },
    { lessonId: 'les-thu-7', classroom: 'ferrini', daysAgo: 14, attendees: 6, avgRating: 2 },
    { lessonId: 'les-fri-4', classroom: 'biblioteca', daysAgo: 6, attendees: 5, avgRating: 2 },
  ];

  historicalSpec.forEach((h, hIdx) => {
    const d = new Date(now);
    d.setDate(d.getDate() - h.daysAgo);
    const datePart = d.toISOString().slice(0, 10);
    for (let i = 0; i < Math.min(h.attendees, memberIdsQuartu.length); i++) {
      const uid = memberIdsQuartu[(i + hIdx) % memberIdsQuartu.length];
      records.push({
        id: `att-hist-${hIdx}-${i}`,
        user_id: uid,
        classroom: h.classroom,
        lesson_id: h.lessonId,
        created_at: new Date(`${datePart}T10:${String(5 + (i * 3) % 50).padStart(2, '0')}:00`).toISOString(),
        rating: i % 6 === 0 ? 2 : h.avgRating,
      });
    }
  });

  return sanitizeSimultaneousAttendance(records, INITIAL_LESSONS);
}

/**
 * Restituisce true se due lezioni hanno orari che si sovrappongono (stessa fascia oraria)
 */
export function doLessonsOverlap(a: Lesson, b: Lesson): boolean {
  if (a.id === b.id) return true;
  const toMinutes = (t: string) => {
    const [h, m] = (t || '00:00').slice(0, 5).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const startA = toMinutes(a.start_time);
  const endA = toMinutes(a.end_time);
  const startB = toMinutes(b.start_time);
  const endB = toMinutes(b.end_time);
  return startA < endB && startB < endA;
}

/**
 * Rimuove eventuali doppie presenze dello stesso socio nello stesso giorno in lezioni con orario sovrapposto,
 * mantenendo solo la timbratura più recente.
 */
export function sanitizeSimultaneousAttendance(
  records: AttendanceRecord[],
  lessonsList: Lesson[]
): AttendanceRecord[] {
  const lessonMap = new Map<string, Lesson>();
  lessonsList.forEach((l) => lessonMap.set(l.id, l));

  // Ordina dalla più recente alla meno recente così teniamo l'ultima timbratura valida
  const sorted = [...records].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const keptByUserDay = new Map<string, AttendanceRecord[]>();
  const validIds = new Set<string>();

  for (const rec of sorted) {
    const dayKey = `${rec.user_id}__${rec.created_at.slice(0, 10)}`;
    const existingForDay = keptByUserDay.get(dayKey) || [];
    const recLesson = lessonMap.get(rec.lesson_id);

    const hasConflict = existingForDay.some((kept) => {
      if (kept.lesson_id === rec.lesson_id) return true;
      const keptLesson = lessonMap.get(kept.lesson_id);
      if (recLesson && keptLesson) {
        return doLessonsOverlap(recLesson, keptLesson);
      }
      // Se due timbrature sono avvenute a meno di 90 minuti l'una dall'altra nello stesso giorno
      const diffMinutes =
        Math.abs(new Date(kept.created_at).getTime() - new Date(rec.created_at).getTime()) / 60000;
      return diffMinutes < 90;
    });

    if (!hasConflict) {
      existingForDay.push(rec);
      keptByUserDay.set(dayKey, existingForDay);
      validIds.add(rec.id);
    }
  }

  return records.filter((r) => validIds.has(r.id));
}

