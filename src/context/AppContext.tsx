import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import {
  AttendanceRecord,
  CashMovement,
  CLASSROOM_LABELS,
  ClassroomKey,
  DEFAULT_AVAILABLE_ROLES,
  doLessonsOverlap,
  ExpenseCategory,
  generateInitialAttendance,
  INITIAL_CASH_MOVEMENTS,
  INITIAL_EXPENSE_CATEGORIES,
  INITIAL_LESSONS,
  INITIAL_PROFILES,
  INITIAL_SUBJECT_NOTES,
  isProtectedSegreteriaMember,
  isProtectedSuperAdmin,
  Lesson,
  Profile,
  sanitizeSimultaneousAttendance,
  SubjectDidacticNote,
  getSubjectMeta,
} from '../data/initialData';
import { playSuccessSound } from '../utils/soundAndPdf';

export type FontScale = 'normal' | 'large' | 'xlarge';
export type AppSection = 'presenze' | 'piccola_cassa' | 'admin_dashboard' | 'anagrafica_soci' | 'eliminacode';

export interface QueueItem {
  number: number;
  name: string;
  cardNumber?: string;
  notes?: string;
}

export interface QueueState {
  title: string;
  currentNumber: number;
  items: QueueItem[];
  callPulse: number;
  updatedAt: number;
  pdfFileName?: string;
  standbyMode?: 'none' | 'waiting' | 'paused' | 'closed';
  standbyMessage?: string;
}

export interface ImportedMemberRow {
  member_number: string;
  first_name: string;
  last_name: string;
  sede: 'Quartu' | 'Soleminis';
  roleName: string;
}

export interface LiveFeedEvent {
  id: string;
  timestamp: string;
  memberNumber: string;
  memberName: string;
  classroom: ClassroomKey;
  subject: string;
  action: 'stamp' | 'cancel' | 'assisted';
}

interface CloudDbSnapshot {
  profiles: Profile[];
  availableRoles?: string[];
  profilesUpdatedAt?: number;
  expenseCategories?: ExpenseCategory[];
  cashMovements?: CashMovement[];
  cashOpeningBalance?: number;
  cashUpdatedAt?: number;
  lessons: Lesson[];
  lessonsUpdatedAt?: number;
  attendance: AttendanceRecord[];
  subjectNotes: SubjectDidacticNote[];
  visualHeadcounts: Record<ClassroomKey, number>;
  liveFeed: LiveFeedEvent[];
  queueState?: QueueState;
  updatedAt: string;
}

interface AppContextType {
  currentUser: Profile | null;
  isSuperAdmin: boolean;
  isCDMember: boolean;
  isDidatticaMember: boolean;
  isSegreteriaMember: boolean;
  activeSection: AppSection;
  setActiveSection: (sec: AppSection) => void;
  profiles: Profile[];
  availableRoles: string[];
  addCustomRole: (roleName: string) => { ok: boolean; message?: string };
  toggleMemberCD: (userId: string, isCd: boolean) => void;
  toggleMemberRole: (userId: string, roleName: string) => void;
  importMembersBatch: (rows: ImportedMemberRow[]) => { added: number; updated: number };
  expenseCategories: ExpenseCategory[];
  addExpenseCategory: (name: string, description?: string) => void;
  updateExpenseCategory: (id: string, data: Partial<ExpenseCategory>) => void;
  deleteExpenseCategory: (id: string) => void;
  cashMovements: CashMovement[];
  cashOpeningBalance: number;
  setCashOpeningBalance: (amount: number) => void;
  addCashMovement: (movement: Omit<CashMovement, 'id' | 'created_at'>) => CashMovement;
  updateCashMovement: (id: string, data: Partial<CashMovement>) => void;
  deleteCashMovement: (id: string) => void;
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  subjectNotes: SubjectDidacticNote[];
  visualHeadcounts: Record<ClassroomKey, number>;
  liveFeed: LiveFeedEvent[];
  queueState: QueueState;
  updateQueueState: (updater: (prev: QueueState) => QueueState) => void;
  cloudConnected: boolean;
  connectedDevices: number;
  lastCloudSync: string | null;
  publicUrl: string | null;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  lightTheme: boolean;
  setLightTheme: (val: boolean) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (val: boolean) => void;
  // Time simulator for testing any day/time
  isSimulatingTime: boolean;
  setIsSimulatingTime: (val: boolean) => void;
  effectiveDay: number;
  setSimulatedDay: (day: number) => void;
  effectiveTime: string;
  setSimulatedTime: (time: string) => void;
  // Active lessons right now
  activeLessons: Lesson[];
  getActiveLessonForRoom: (room: ClassroomKey) => Lesson | null;
  getTodayAttendanceCountForLesson: (lessonId: string) => number;
  getTodayAttendancesForRoom: (room: ClassroomKey) => AttendanceRecord[];
  myTodayAttendance: AttendanceRecord[];
  // Auth
  signInMember: (memberCardNumber: string) => { error: string | null };
  signInAdmin: (secretCode: string) => { error: string | null };
  signOut: () => void;
  // Member actions
  registerAttendance: (room: ClassroomKey) => { ok: boolean; message: string; attendanceId?: string; lesson?: Lesson };
  registerAssistedAttendance: (room: ClassroomKey, memberCardNumber: string) => { ok: boolean; message: string };
  cancelAttendance: (attendanceId: string) => void;
  rateAttendance: (attendanceId: string, rating: 1 | 2 | 3) => void;
  // Live Classroom Headcount
  setRoomVisualHeadcount: (room: ClassroomKey, count: number) => void;
  // Admin actions
  addMember: (member_number: string, full_name: string, sede: 'Quartu' | 'Soleminis', phone?: string, is_cd?: boolean, roles?: string[]) => { ok: boolean; message?: string };
  updateMember: (id: string, data: Partial<Profile>) => void;
  deleteMember: (id: string) => void;
  deleteMembersBatch: (ids: string[]) => void;
  addLesson: (lesson: Omit<Lesson, 'id'>) => void;
  updateLesson: (id: string, data: Partial<Lesson>) => void;
  deleteLesson: (id: string) => void;
  importLessonsBatch: (newLessons: Omit<Lesson, 'id'>[], mode: 'replace' | 'append') => { count: number };
  saveSubjectNote: (note: SubjectDidacticNote) => void;
  resetDemoData: () => void;
}

const STORAGE_KEYS = {
  USER: 'quartimbra_current_user_v4',
  PROFILES: 'quartimbra_profiles_v4',
  ROLES: 'quartimbra_available_roles_v4',
  PROFILES_TS: 'quartimbra_profiles_updated_at_v4',
  PROTECTED_ANAGRAFICA: 'quartimbra_protected_anagrafica_backup_v1',
  ADMIN_DELETED_SEGRETERIA: 'quartimbra_admin_deleted_segreteria_v1',
  CATEGORIES: 'quartimbra_expense_categories_v4',
  CASH_MOVEMENTS: 'quartimbra_cash_movements_v4',
  CASH_BALANCE: 'quartimbra_cash_opening_balance_v4',
  CASH_TS: 'quartimbra_cash_updated_at_v4',
  LESSONS: 'quartimbra_lessons_v3',
  LESSONS_TS: 'quartimbra_lessons_updated_at_v4',
  ATTENDANCE: 'quartimbra_attendance_v3',
  NOTES: 'quartimbra_subject_notes_v3',
  HEADCOUNTS: 'quartimbra_headcounts_v3',
  LIVE_FEED: 'quartimbra_live_feed_v3',
  QUEUE_STATE: 'quartimbra_eliminacode_v1',
  FONT_SCALE: 'quartimbra_font_scale_v3',
  LIGHT_THEME: 'quartimbra_light_theme_v3',
  VOICE: 'quartimbra_voice_v3',
};

const DEFAULT_QUEUE_STATE: QueueState = {
  title: "Università della Terza Età — Quartu Sant'Elena",
  currentNumber: 0,
  items: [],
  callPulse: 0,
  updatedAt: 0,
  pdfFileName: '',
  standbyMode: 'waiting',
  standbyMessage: 'IN ATTESA DI PRIMA CHIAMATA',
};

const DEFAULT_HEADCOUNTS: Record<ClassroomKey, number> = {
  verde: 45,
  gialla: 30,
  rossa: 95,
  rocchitta: 25,
  san_benedetto: 40,
  biblioteca: 20,
  ferrini: 30,
  polifunzionale: 35,
};

// Salvataggio sicuro in localStorage (non lancia mai QuotaExceededError bloccando il cloud sync)
function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    try {
      // Se localStorage è pieno, libera le chiavi ridondanti/temporanee per dare priorità assoluta all'Anagrafica Soci
      if (key === STORAGE_KEYS.PROFILES) {
        localStorage.removeItem(STORAGE_KEYS.PROTECTED_ANAGRAFICA);
        localStorage.removeItem(STORAGE_KEYS.LIVE_FEED);
        localStorage.setItem(key, value);
        return true;
      }
    } catch {
      // Ignore
    }
    return false;
  }
}

function getAdminDeletedSegreteriaNumbers(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_DELETED_SEGRETERIA);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function saveAdminDeletedSegreteriaNumbers(nums: Set<string>): void {
  safeSetLocalStorage(STORAGE_KEYS.ADMIN_DELETED_SEGRETERIA, JSON.stringify(Array.from(nums)));
}

function ensureDefaultRolesList(roles?: string[]): string[] {
  const base = Array.isArray(roles) && roles.length > 0 ? roles : DEFAULT_AVAILABLE_ROLES;
  return Array.from(new Set([...DEFAULT_AVAILABLE_ROLES, ...base]));
}

// Database IndexedDB ad alta capacità (fino a 500MB+) per garantire che l'Anagrafica Soci non vada MAI persa alla riapertura
const IDB_NAME = 'quartimbra_anagrafica_db_v1';
const IDB_STORE = 'anagrafica_store';
const IDB_KEY = 'main_anagrafica';

function openAnagraficaIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveAnagraficaToIndexedDB(
  profiles: Profile[],
  availableRoles: string[],
  updatedAt: number
): Promise<void> {
  const db = await openAnagraficaIdb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(
      {
        profiles,
        availableRoles,
        updatedAt: updatedAt || Date.now(),
      },
      IDB_KEY
    );
  } catch {
    // Ignore IDB errors
  }
}

async function loadAnagraficaFromIndexedDB(): Promise<{
  profiles: Profile[];
  availableRoles?: string[];
  updatedAt?: number;
} | null> {
  const db = await openAnagraficaIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Verifica se un elenco di soci contiene modifiche/importazioni rispetto ai dati demo iniziali
function isCustomizedProfiles(list: Profile[]): boolean {
  if (!Array.isArray(list) || list.length === 0) return false;
  if (list.length !== INITIAL_PROFILES.length) return true;
  for (const p of list) {
    if (!p) continue;
    if (String(p.id || '').startsWith('u-imp-') || String(p.id || '').startsWith('u-17')) return true;
    const init = INITIAL_PROFILES.find((ip) => ip.member_number === p.member_number);
    if (!init) return true;
    if (p.full_name !== init.full_name || Boolean(p.is_cd) !== Boolean(init.is_cd)) return true;
    const r1 = (p.roles || ['Socio']).join(',');
    const r2 = (init.roles || ['Socio']).join(',');
    if (r1 !== r2) return true;
  }
  return false;
}

// 7726 (e 7796) corrisponde SEMPRE ed ESCLUSIVAMENTE a Giampiero Pilia (Super Admin indistruttibile)
function normalizeSuperAdminProfile(p?: Partial<Profile> | null): Profile {
  const base = INITIAL_PROFILES[0]; // 7726 Giampiero Pilia
  const existingRoles = Array.isArray(p?.roles) ? p!.roles!.filter((r) => r !== 'Socio') : [];
  const mergedRoles = Array.from(new Set(['Amministratore', ...existingRoles]));

  return {
    ...base,
    ...(p || {}),
    id: 'admin-7726',
    member_number: '7726',
    first_name: 'Giampiero',
    last_name: 'Pilia',
    full_name: 'Giampiero Pilia',
    sede: p?.sede === 'Soleminis' ? 'Soleminis' : 'Quartu',
    role: 'admin',
    is_super_admin: true,
    is_cd: true,
    roles: mergedRoles,
  };
}

function normalizeProtectedSegreteriaProfile(
  cardNum: '9999' | '9998',
  existing?: Partial<Profile> | null
): Profile {
  const is9999 = cardNum === '9999';
  const existingRoles = Array.isArray(existing?.roles)
    ? existing!.roles!.filter((r) => r !== 'Socio' && r !== 'Segreteria')
    : [];
  const mergedRoles = ['Segreteria', ...existingRoles];
  return {
    ...(existing || {}),
    id: is9999 ? 'segreteria-9999' : 'segreteria-9998',
    member_number: cardNum,
    first_name: is9999 ? 'Nives' : 'Josh Ronald',
    last_name: 'Cocco',
    full_name: is9999 ? 'Nives Cocco' : 'Josh Ronald Cocco',
    sede: existing?.sede === 'Soleminis' ? 'Soleminis' : 'Quartu',
    role: 'member',
    is_super_admin: false,
    is_cd: false,
    roles: mergedRoles,
    joined_year: existing?.joined_year || 2024,
  };
}

function cleanPersonNameField(raw?: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/\b\d{3,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureSuperAdminAndRoles(rawProfiles: Profile[]): Profile[] {
  const list = Array.isArray(rawProfiles) ? rawProfiles.filter(Boolean).map((p) => ({ ...p })) : [];
  // Trova tutti gli eventuali record riconducibili a Giampiero Pilia (7726 / 7796 / is_super_admin)
  const superIndices: number[] = [];
  list.forEach((p, idx) => {
    if (isProtectedSuperAdmin(p)) {
      superIndices.push(idx);
    }
  });

  if (superIndices.length === 0) {
    // Non deve MAI sparire: se non c'è, lo reinserisce in cima
    list.unshift(normalizeSuperAdminProfile(INITIAL_PROFILES[0]));
  } else {
    // Se c'è sia un record 7726 che un vecchio 7796, privilegia i dati di 7726 e rimuove il duplicato
    const preferredIdx =
      superIndices.find((idx) => String(list[idx].member_number).trim() === '7726') ?? superIndices[0];
    const mergedSuper = normalizeSuperAdminProfile(list[preferredIdx]);
    list[preferredIdx] = mergedSuper;
    // Rimuove eventuali duplicati (es. vecchio 7796 + nuovo 7726) partendo dal fondo
    for (let i = superIndices.length - 1; i >= 0; i--) {
      const idx = superIndices[i];
      if (idx !== preferredIdx) {
        list.splice(idx, 1);
      }
    }
  }

  // Garantisce che Nives Cocco (9999) e Josh Ronald Cocco (9998) con ruolo Segreteria siano sempre presenti
  // a meno che non siano stati cancellati esplicitamente dall'Amministratore (7726)
  const adminDeletedSegreteria = getAdminDeletedSegreteriaNumbers();

  if (!adminDeletedSegreteria.has('9999')) {
    const idx9999 = list.findIndex(
      (p) =>
        String(p.member_number).trim() === '9999' ||
        p.id === 'segreteria-9999' ||
        Boolean(
          p.full_name &&
            p.full_name.toLowerCase().includes('nives') &&
            p.full_name.toLowerCase().includes('cocco')
        )
    );
    if (idx9999 >= 0) {
      list[idx9999] = normalizeProtectedSegreteriaProfile('9999', list[idx9999]);
    } else {
      list.push(normalizeProtectedSegreteriaProfile('9999'));
    }
  }

  if (!adminDeletedSegreteria.has('9998')) {
    const idx9998 = list.findIndex(
      (p) =>
        String(p.member_number).trim() === '9998' ||
        p.id === 'segreteria-9998' ||
        Boolean(
          p.full_name &&
            p.full_name.toLowerCase().includes('josh') &&
            p.full_name.toLowerCase().includes('cocco')
        )
    );
    if (idx9998 >= 0) {
      list[idx9998] = normalizeProtectedSegreteriaProfile('9998', list[idx9998]);
    } else {
      list.push(normalizeProtectedSegreteriaProfile('9998'));
    }
  }

  return list.map((p) => {
    if (isProtectedSuperAdmin(p)) {
      return normalizeSuperAdminProfile(p);
    }
    const numTrim = String(p.member_number || '').trim();
    const isNives =
      numTrim === '9999' ||
      p.id === 'segreteria-9999' ||
      Boolean(
        p.full_name &&
          p.full_name.toLowerCase().includes('nives') &&
          p.full_name.toLowerCase().includes('cocco')
      );
    if (isNives) {
      return normalizeProtectedSegreteriaProfile('9999', p);
    }
    const isJosh =
      numTrim === '9998' ||
      p.id === 'segreteria-9998' ||
      Boolean(
        p.full_name &&
          p.full_name.toLowerCase().includes('josh') &&
          p.full_name.toLowerCase().includes('cocco')
      );
    if (isJosh) {
      return normalizeProtectedSegreteriaProfile('9998', p);
    }
    const initialMatch = INITIAL_PROFILES.find((ip) => ip.member_number === p.member_number);
    const roles = p.roles && p.roles.length > 0 ? p.roles : initialMatch?.roles || ['Socio'];
    const is_cd = typeof p.is_cd === 'boolean' ? p.is_cd : roles.includes('CD') || Boolean(initialMatch?.is_cd);

    const cleanedFirst = cleanPersonNameField(p.first_name) || initialMatch?.first_name || '';
    const cleanedLast = cleanPersonNameField(p.last_name) || initialMatch?.last_name || '';
    const isPlaceholderFull = /^socio\s+(tessera\s+)?n?[°.]?\s*\d+/i.test((p.full_name || '').trim());
    const cleanedFull = isPlaceholderFull
      ? p.full_name
      : cleanPersonNameField(p.full_name) || `${cleanedFirst} ${cleanedLast}`.trim() || p.full_name;

    return {
      ...p,
      first_name: cleanedFirst,
      last_name: cleanedLast,
      full_name: cleanedFull,
      is_cd,
      roles: is_cd && !roles.includes('CD') ? [...roles, 'CD'] : roles,
    };
  });
}

function sanitizeQueueState(q: QueueState, knownProfiles?: Profile[]): QueueState {
  if (!q || !Array.isArray(q.items)) return q;
  const cleanedItems = q.items.map((it) => {
    if (!it) return it;
    let name = String(it.name || '').trim();
    const cardNum = String(it.cardNumber || '').trim();
    // Ripara immediatamente l'errore "0801021400 Galleri" o tessera 7726/7796 -> Giampiero Pilia
    if (
      cardNum === '7726' ||
      cardNum === '7796' ||
      name.includes('0801021400') ||
      /^0801021400\b/i.test(name)
    ) {
      name = 'Giampiero Pilia';
    } else if (
      cardNum &&
      (!name || name.toLowerCase() === 'socio sconosciuto') &&
      Array.isArray(knownProfiles) &&
      knownProfiles.length > 0
    ) {
      const matched = knownProfiles.find(
        (p) =>
          p &&
          p.member_number &&
          (p.member_number.trim().toLowerCase() === cardNum.toLowerCase() ||
            (/^\d+$/.test(cardNum) &&
              /^\d+$/.test(p.member_number.trim()) &&
              parseInt(p.member_number.trim(), 10) === parseInt(cardNum, 10)))
      );
      if (matched && matched.full_name && !/^socio\s+tessera/i.test(matched.full_name)) {
        name = matched.full_name;
      }
    }
    return {
      ...it,
      name,
    };
  });
  return {
    ...q,
    items: cleanedItems,
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try {
      const protectedRaw = localStorage.getItem(STORAGE_KEYS.PROTECTED_ANAGRAFICA);
      const savedRaw = localStorage.getItem(STORAGE_KEYS.PROFILES);
      const savedList: Profile[] | null = savedRaw ? JSON.parse(savedRaw) : null;
      const parsedBackup = protectedRaw ? JSON.parse(protectedRaw) : null;
      const backupList: Profile[] | null =
        parsedBackup && Array.isArray(parsedBackup.profiles) ? parsedBackup.profiles : null;

      const savedCustom = savedList ? isCustomizedProfiles(savedList) : false;
      const backupCustom = backupList ? isCustomizedProfiles(backupList) : false;

      if (backupCustom && !savedCustom && backupList) {
        return ensureSuperAdminAndRoles(backupList);
      }
      if (savedCustom && !backupCustom && savedList) {
        return ensureSuperAdminAndRoles(savedList);
      }
      if (backupCustom && savedCustom && backupList && savedList) {
        // Prende l'elenco personalizzato più completo o più recente
        if (backupList.length > savedList.length) {
          return ensureSuperAdminAndRoles(backupList);
        }
        return ensureSuperAdminAndRoles(savedList);
      }
      if (backupList && backupList.length > (savedList?.length || 0)) {
        return ensureSuperAdminAndRoles(backupList);
      }
      return savedList ? ensureSuperAdminAndRoles(savedList) : ensureSuperAdminAndRoles(INITIAL_PROFILES);
    } catch {
      return ensureSuperAdminAndRoles(INITIAL_PROFILES);
    }
  });

  const [availableRoles, setAvailableRoles] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROLES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return ensureDefaultRolesList(parsed);
      }
      const protectedRaw = localStorage.getItem(STORAGE_KEYS.PROTECTED_ANAGRAFICA);
      if (protectedRaw) {
        const parsedBackup = JSON.parse(protectedRaw);
        if (parsedBackup && Array.isArray(parsedBackup.availableRoles) && parsedBackup.availableRoles.length > 0) {
          return ensureDefaultRolesList(parsedBackup.availableRoles);
        }
      }
      return DEFAULT_AVAILABLE_ROLES;
    } catch {
      return DEFAULT_AVAILABLE_ROLES;
    }
  });

  const [profilesUpdatedAt, setProfilesUpdatedAt] = useState<number>(() => {
    try {
      const savedTs = Number(localStorage.getItem(STORAGE_KEYS.PROFILES_TS) || 0);
      const protectedRaw = localStorage.getItem(STORAGE_KEYS.PROTECTED_ANAGRAFICA);
      const backupTs = protectedRaw ? Number(JSON.parse(protectedRaw)?.updatedAt || 0) : 0;
      const bestTs = Math.max(savedTs, backupTs);
      if (bestTs > 0) return bestTs;

      const savedRaw = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (savedRaw) {
        const savedList = JSON.parse(savedRaw);
        if (isCustomizedProfiles(savedList)) return Date.now();
      }
      return 0;
    } catch {
      return 0;
    }
  });

  const [cashUpdatedAt, setCashUpdatedAt] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STORAGE_KEYS.CASH_TS) || 0);
    } catch {
      return 0;
    }
  });

  const [lessonsUpdatedAt, setLessonsUpdatedAt] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(STORAGE_KEYS.LESSONS_TS) || 0);
    } catch {
      return 0;
    }
  });

  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return saved ? JSON.parse(saved) : INITIAL_EXPENSE_CATEGORIES;
    } catch {
      return INITIAL_EXPENSE_CATEGORIES;
    }
  });

  const [cashMovements, setCashMovements] = useState<CashMovement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CASH_MOVEMENTS);
      return saved ? JSON.parse(saved) : INITIAL_CASH_MOVEMENTS;
    } catch {
      return INITIAL_CASH_MOVEMENTS;
    }
  });

  const [cashOpeningBalance, setCashOpeningBalanceState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CASH_BALANCE);
      return saved !== null ? Number(saved) : 500;
    } catch {
      return 500;
    }
  });

  const [lessons, setLessons] = useState<Lesson[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LESSONS);
      return saved ? JSON.parse(saved) : INITIAL_LESSONS;
    } catch {
      return INITIAL_LESSONS;
    }
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      const raw: AttendanceRecord[] = saved ? JSON.parse(saved) : generateInitialAttendance();
      return sanitizeSimultaneousAttendance(raw, INITIAL_LESSONS);
    } catch {
      return generateInitialAttendance();
    }
  });

  const [subjectNotes, setSubjectNotes] = useState<SubjectDidacticNote[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
      return saved ? JSON.parse(saved) : INITIAL_SUBJECT_NOTES;
    } catch {
      return INITIAL_SUBJECT_NOTES;
    }
  });

  const [visualHeadcounts, setVisualHeadcounts] = useState<Record<ClassroomKey, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HEADCOUNTS);
      return saved ? JSON.parse(saved) : DEFAULT_HEADCOUNTS;
    } catch {
      return DEFAULT_HEADCOUNTS;
    }
  });

  const [liveFeed, setLiveFeed] = useState<LiveFeedEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIVE_FEED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [queueState, setQueueState] = useState<QueueState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.QUEUE_STATE);
      return saved
        ? sanitizeQueueState({ ...DEFAULT_QUEUE_STATE, ...JSON.parse(saved) })
        : DEFAULT_QUEUE_STATE;
    } catch {
      return DEFAULT_QUEUE_STATE;
    }
  });

  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (!saved) return null;
      const parsed: Profile = JSON.parse(saved);
      if (isProtectedSuperAdmin(parsed)) return normalizeSuperAdminProfile(parsed);
      if (isProtectedSegreteriaMember(parsed) || parsed.member_number === '9999' || parsed.member_number === '9998') {
        return normalizeProtectedSegreteriaProfile(parsed.member_number === '9998' ? '9998' : '9999', parsed);
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [activeSection, setActiveSection] = useState<AppSection>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) {
        const parsed: Profile = JSON.parse(saved);
        if (isProtectedSegreteriaMember(parsed) || parsed.member_number === '9999' || parsed.member_number === '9998') {
          return 'eliminacode';
        }
      }
    } catch {}
    return 'presenze';
  });

  // Keep currentUser synchronized with updated roles/CD status in profiles
  useEffect(() => {
    if (!currentUser) return;
    if (isProtectedSuperAdmin(currentUser)) {
      const superProfile =
        profiles.find((p) => isProtectedSuperAdmin(p)) || normalizeSuperAdminProfile(currentUser);
      if (JSON.stringify(superProfile) !== JSON.stringify(currentUser)) {
        setCurrentUser(superProfile);
      }
      return;
    }
    if (isProtectedSegreteriaMember(currentUser) || currentUser.member_number === '9999' || currentUser.member_number === '9998') {
      const cardNum = currentUser.member_number === '9998' ? '9998' : '9999';
      const segProfile =
        profiles.find((p) => isProtectedSegreteriaMember(p) && String(p.member_number).trim() === cardNum) ||
        normalizeProtectedSegreteriaProfile(cardNum, currentUser);
      if (JSON.stringify(segProfile) !== JSON.stringify(currentUser)) {
        setCurrentUser(segProfile);
      }
      return;
    }
    const updated = profiles.find((p) => p.id === currentUser.id || p.member_number === currentUser.member_number);
    if (updated && JSON.stringify(updated) !== JSON.stringify(currentUser)) {
      setCurrentUser(updated);
    }
  }, [profiles, currentUser]);

  const isSuperAdmin = Boolean(currentUser && isProtectedSuperAdmin(currentUser));

  const isCDMember = Boolean(
    currentUser &&
      (isSuperAdmin ||
        currentUser.is_cd ||
        (currentUser.roles && currentUser.roles.includes('CD')))
  );

  const isDidatticaMember = Boolean(
    currentUser &&
      (isSuperAdmin ||
        currentUser.role === 'admin' ||
        (currentUser.roles && currentUser.roles.includes('Didattica')))
  );

  const isSegreteriaMember = Boolean(
    currentUser &&
      (isSuperAdmin ||
        isProtectedSegreteriaMember(currentUser) ||
        (currentUser.roles &&
          currentUser.roles.some((r) => r.trim().toLowerCase() === 'segreteria')))
  );

  // Se l'utente autenticato ha il ruolo "Segreteria" (es. Nives Cocco 9999 o Josh Ronald Cocco 9998)
  // e non è Super Admin, può vedere SOLO Anagrafica Soci ed Eliminacode
  useEffect(() => {
    if (!currentUser) return;
    const isSegreteriaOnlyUser =
      !isSuperAdmin &&
      (isProtectedSegreteriaMember(currentUser) ||
        Boolean(
          currentUser.roles &&
            currentUser.roles.some((r) => r.trim().toLowerCase() === 'segreteria')
        ));
    if (
      isSegreteriaOnlyUser &&
      activeSection !== 'anagrafica_soci' &&
      activeSection !== 'eliminacode'
    ) {
      setActiveSection('eliminacode');
    }
  }, [currentUser, isSuperAdmin, activeSection]);

  const [fontScale, setFontScale] = useState<FontScale>(() => {
    return (localStorage.getItem(STORAGE_KEYS.FONT_SCALE) as FontScale) || 'large';
  });

  const [lightTheme, setLightTheme] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LIGHT_THEME);
    return saved !== null ? saved === 'true' : true;
  });

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VOICE);
    return saved !== null ? saved === 'true' : true;
  });

  const [cloudConnected, setCloudConnected] = useState<boolean>(false);
  const [connectedDevices, setConnectedDevices] = useState<number>(1);
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const isApplyingRemoteRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const profilesRef = useRef<Profile[]>(profiles);
  profilesRef.current = profiles;
  const availableRolesRef = useRef<string[]>(availableRoles);
  availableRolesRef.current = availableRoles;
  const profilesUpdatedAtRef = useRef(profilesUpdatedAt);
  profilesUpdatedAtRef.current = profilesUpdatedAt;
  const cashUpdatedAtRef = useRef(cashUpdatedAt);
  cashUpdatedAtRef.current = cashUpdatedAt;
  const lessonsRef = useRef<Lesson[]>(lessons);
  lessonsRef.current = lessons;
  const lessonsUpdatedAtRef = useRef(lessonsUpdatedAt);
  lessonsUpdatedAtRef.current = lessonsUpdatedAt;
  const queueUpdatedAtRef = useRef(queueState.updatedAt || 0);
  queueUpdatedAtRef.current = queueState.updatedAt || 0;

  // Real clock vs simulated clock
  const [isSimulatingTime, setIsSimulatingTime] = useState<boolean>(false);
  const [simulatedDay, setSimulatedDay] = useState<number>(() => {
    const d = new Date().getDay();
    return d === 0 ? 1 : d;
  });
  const [simulatedTime, setSimulatedTime] = useState<string>('10:15');
  const [realNow, setRealNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setRealNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Quando cambiano i profili in Anagrafica, ripara/aggiorna automaticamente eventuali turni in coda con "0801021400 Galleri" o numero tessera
  useEffect(() => {
    setQueueState((prev) => {
      const sanitized = sanitizeQueueState(prev, profiles);
      if (JSON.stringify(sanitized.items) !== JSON.stringify(prev.items)) {
        safeSetLocalStorage(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(sanitized));
        return sanitized;
      }
      return prev;
    });
  }, [profiles]);

  const pushProfilesToServer = async (
    nextProfiles: Profile[],
    nextRoles: string[],
    updatedAt: number,
    forceReplace = false
  ) => {
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'PROFILES_SYNC',
          profiles: nextProfiles,
          availableRoles: nextRoles,
          profilesUpdatedAt: updatedAt,
        });
      }
    } catch {
      // Ignore BroadcastChannel errors
    }

    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles: nextProfiles,
          availableRoles: nextRoles,
          profilesUpdatedAt: updatedAt,
          forceReplace,
        }),
      });
      if (res.ok) {
        setCloudConnected(true);
        setLastCloudSync(new Date().toLocaleTimeString('it-IT'));
      }
    } catch {
      // Offline fallback
    }
  };

  // Salva in modo sincrono e triplo (localStorage + IndexedDB + Cloud /api/profiles) ogni modifica all'Anagrafica Soci
  const commitProfilesUpdate = (
    nextProfilesRaw: Profile[],
    nextRolesRaw?: string[],
    forceReplace = false
  ) => {
    const finalProfiles = ensureSuperAdminAndRoles(nextProfilesRaw);
    const finalRoles = ensureDefaultRolesList(
      nextRolesRaw && nextRolesRaw.length > 0 ? nextRolesRaw : availableRolesRef.current
    );
    const nowTs = Date.now();

    profilesRef.current = finalProfiles;
    availableRolesRef.current = finalRoles;
    profilesUpdatedAtRef.current = nowTs;

    setProfiles(finalProfiles);
    setAvailableRoles(finalRoles);
    setProfilesUpdatedAt(nowTs);

    // 1) Salvataggio immediato in localStorage
    safeSetLocalStorage(STORAGE_KEYS.PROFILES, JSON.stringify(finalProfiles));
    safeSetLocalStorage(STORAGE_KEYS.ROLES, JSON.stringify(finalRoles));
    safeSetLocalStorage(STORAGE_KEYS.PROFILES_TS, String(nowTs));
    if (isCustomizedProfiles(finalProfiles)) {
      safeSetLocalStorage(
        STORAGE_KEYS.PROTECTED_ANAGRAFICA,
        JSON.stringify({
          profiles: finalProfiles,
          availableRoles: finalRoles,
          updatedAt: nowTs,
        })
      );
    }

    // 2) Salvataggio immediato in IndexedDB (fino a 500MB, non soggetto al limite di 5MB di localStorage)
    saveAnagraficaToIndexedDB(finalProfiles, finalRoles, nowTs);

    // 3) Invio diretto e immediato al Cloud Server (/api/profiles)
    pushProfilesToServer(finalProfiles, finalRoles, nowTs, forceReplace);
  };

  const pushCloudSnapshot = async (snapshot: CloudDbSnapshot, eventLabel?: string) => {
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'STATE_SYNC', db: snapshot });
      }
    } catch {
      // Ignore BroadcastChannel errors
    }

    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db: snapshot, eventLabel }),
      });
      if (res.ok) {
        const data = await res.json();
        setCloudConnected(true);
        if (data.publicUrl) setPublicUrl(data.publicUrl);
        if (typeof data.connectedDevices === 'number') {
          setConnectedDevices(Math.max(1, data.connectedDevices));
        }
        setLastCloudSync(new Date().toLocaleTimeString('it-IT'));
      }
    } catch {
      // Offline fallback
    }
  };

  const updateQueueState = (updater: (prev: QueueState) => QueueState) => {
    setQueueState((prev) => {
      const nowTs = Date.now();
      const next = sanitizeQueueState(
        {
          ...updater(prev),
          updatedAt: nowTs,
        },
        profilesRef.current
      );
      queueUpdatedAtRef.current = next.updatedAt || nowTs;
      safeSetLocalStorage(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(next));
      try {
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'QUEUE_SYNC', queueState: next });
        }
      } catch {
        // Ignore
      }
      fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueState: next }),
      }).catch(() => {});
      return next;
    });
  };

  const applyRemoteProfiles = (
    remoteProfiles: Profile[],
    remoteRoles?: string[],
    remoteTs = 0
  ) => {
    if (!Array.isArray(remoteProfiles) || remoteProfiles.length === 0) return false;
    const localProfiles = profilesRef.current;
    const localCustom = isCustomizedProfiles(localProfiles);
    const remoteCustom = isCustomizedProfiles(remoteProfiles);
    const localTs = profilesUpdatedAtRef.current;

    // REGOLA D'ORO: non sovrascrivere MAI un'Anagrafica Soci personalizzata/importata con i 20 profili demo iniziali!
    if (localCustom && !remoteCustom) {
      return false;
    }

    if (
      (remoteCustom && !localCustom) ||
      remoteTs > localTs ||
      (remoteCustom && remoteProfiles.length > localProfiles.length && remoteTs >= localTs)
    ) {
      const normalized = ensureSuperAdminAndRoles(remoteProfiles);
      const finalTs = remoteTs || Date.now();
      const finalRoles = ensureDefaultRolesList(
        Array.isArray(remoteRoles) && remoteRoles.length > 0
          ? remoteRoles
          : availableRolesRef.current
      );

      profilesRef.current = normalized;
      availableRolesRef.current = finalRoles;
      profilesUpdatedAtRef.current = finalTs;

      setProfiles(normalized);
      setAvailableRoles(finalRoles);
      setProfilesUpdatedAt(finalTs);

      safeSetLocalStorage(STORAGE_KEYS.PROFILES, JSON.stringify(normalized));
      safeSetLocalStorage(STORAGE_KEYS.ROLES, JSON.stringify(finalRoles));
      safeSetLocalStorage(STORAGE_KEYS.PROFILES_TS, String(finalTs));
      if (isCustomizedProfiles(normalized)) {
        safeSetLocalStorage(
          STORAGE_KEYS.PROTECTED_ANAGRAFICA,
          JSON.stringify({
            profiles: normalized,
            availableRoles: finalRoles,
            updatedAt: finalTs,
          })
        );
      }
      saveAnagraficaToIndexedDB(normalized, finalRoles, finalTs);
      return true;
    }

    return false;
  };

  const applyRemoteSnapshot = (db: CloudDbSnapshot) => {
    if (!db) return;
    isApplyingRemoteRef.current = true;

    const remoteProfTs = Number(db.profilesUpdatedAt || 0);
    const localProfTs = profilesUpdatedAtRef.current;
    const localCustom = isCustomizedProfiles(profilesRef.current);
    const remoteHasProfiles = Array.isArray(db.profiles) && db.profiles.length > 0;
    const remoteCustom = remoteHasProfiles ? isCustomizedProfiles(db.profiles) : false;
    let shouldPushBackLocalProtected = false;

    if (remoteHasProfiles) {
      const applied = applyRemoteProfiles(db.profiles, db.availableRoles, remoteProfTs);
      if (!applied && (localCustom && (!remoteCustom || localProfTs > remoteProfTs))) {
        shouldPushBackLocalProtected = true;
      }
    } else if (localCustom || profilesRef.current.length > 0) {
      // Il server non ha ancora i profili (es. dopo riavvio o chiamata /api/queue): invia subito l'Anagrafica locale al server!
      shouldPushBackLocalProtected = true;
    }

    const remoteCashTs = Number(db.cashUpdatedAt || 0);
    const localCashTs = cashUpdatedAtRef.current;
    if (remoteCashTs >= localCashTs) {
      if (Array.isArray(db.expenseCategories) && db.expenseCategories.length > 0) {
        setExpenseCategories(db.expenseCategories);
      }
      if (Array.isArray(db.cashMovements)) {
        setCashMovements(db.cashMovements);
      }
      if (typeof db.cashOpeningBalance === 'number') {
        setCashOpeningBalanceState(db.cashOpeningBalance);
      }
      if (remoteCashTs > 0) setCashUpdatedAt(remoteCashTs);
    } else {
      shouldPushBackLocalProtected = true;
    }

    const remoteLessonsTs = Number(db.lessonsUpdatedAt || 0);
    const localLessonsTs = lessonsUpdatedAtRef.current;
    if (remoteLessonsTs > localLessonsTs) {
      if (Array.isArray(db.lessons)) {
        lessonsRef.current = db.lessons;
        setLessons(db.lessons);
        safeSetLocalStorage(STORAGE_KEYS.LESSONS, JSON.stringify(db.lessons));
      }
      if (remoteLessonsTs > 0) {
        lessonsUpdatedAtRef.current = remoteLessonsTs;
        setLessonsUpdatedAt(remoteLessonsTs);
        safeSetLocalStorage(STORAGE_KEYS.LESSONS_TS, String(remoteLessonsTs));
      }
    } else if (localLessonsTs > remoteLessonsTs && Array.isArray(lessonsRef.current)) {
      shouldPushBackLocalProtected = true;
    }

    if (db.queueState) {
      const sanitizedRemoteQ = sanitizeQueueState(db.queueState, profilesRef.current);
      const remoteQueueTs = Number(sanitizedRemoteQ.updatedAt || 0);
      if (remoteQueueTs > queueUpdatedAtRef.current) {
        queueUpdatedAtRef.current = remoteQueueTs;
        setQueueState(sanitizedRemoteQ);
        safeSetLocalStorage(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(sanitizedRemoteQ));
      }
    }

    let cleanedDuplicates = false;
    if (Array.isArray(db.attendance)) {
      const lessonsToUse = Array.isArray(db.lessons) ? db.lessons : lessonsRef.current;
      const sanitized = sanitizeSimultaneousAttendance(db.attendance, lessonsToUse);
      if (sanitized.length !== db.attendance.length) {
        cleanedDuplicates = true;
      }
      setAttendance(sanitized);
    }
    if (Array.isArray(db.subjectNotes)) setSubjectNotes(db.subjectNotes);
    if (db.visualHeadcounts) setVisualHeadcounts(db.visualHeadcounts);
    if (Array.isArray(db.liveFeed)) setLiveFeed(db.liveFeed);
    setLastCloudSync(new Date().toLocaleTimeString('it-IT'));

    if (cleanedDuplicates || shouldPushBackLocalProtected) {
      isApplyingRemoteRef.current = false;
      if (shouldPushBackLocalProtected) {
        setTimeout(() => {
          pushProfilesToServer(
            profilesRef.current,
            availableRolesRef.current,
            profilesUpdatedAtRef.current || Date.now()
          );
          pushCloudSnapshot({
            profiles: profilesRef.current,
            availableRoles: availableRolesRef.current,
            profilesUpdatedAt: profilesUpdatedAtRef.current || Date.now(),
            expenseCategories,
            cashMovements,
            cashOpeningBalance,
            cashUpdatedAt: cashUpdatedAtRef.current,
            lessons: lessonsRef.current,
            lessonsUpdatedAt: lessonsUpdatedAtRef.current,
            attendance: Array.isArray(db.attendance) ? db.attendance : attendance,
            subjectNotes: Array.isArray(db.subjectNotes) ? db.subjectNotes : subjectNotes,
            visualHeadcounts: db.visualHeadcounts || visualHeadcounts,
            liveFeed: Array.isArray(db.liveFeed) ? db.liveFeed : liveFeed,
            queueState,
            updatedAt: new Date().toISOString(),
          });
        }, 100);
      }
    } else {
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 80);
    }
  };

  useEffect(() => {
    // 1) Ripristino immediato da IndexedDB (nel caso in cui l'Anagrafica Soci avesse molti soci oltre la capienza di localStorage)
    loadAnagraficaFromIndexedDB()
      .then((idbData) => {
        if (idbData && Array.isArray(idbData.profiles) && idbData.profiles.length > 0) {
          const idbCustom = isCustomizedProfiles(idbData.profiles);
          const curCustom = isCustomizedProfiles(profilesRef.current);
          const idbTs = Number(idbData.updatedAt || 0);
          if (
            (idbCustom && !curCustom) ||
            (idbCustom && idbData.profiles.length > profilesRef.current.length) ||
            idbTs > profilesUpdatedAtRef.current
          ) {
            const restored = ensureSuperAdminAndRoles(idbData.profiles);
            const restoredRoles = ensureDefaultRolesList(
              Array.isArray(idbData.availableRoles) && idbData.availableRoles.length > 0
                ? idbData.availableRoles
                : availableRolesRef.current
            );
            const restoredTs = Math.max(idbTs, Date.now());
            profilesRef.current = restored;
            availableRolesRef.current = restoredRoles;
            profilesUpdatedAtRef.current = restoredTs;
            setProfiles(restored);
            setAvailableRoles(restoredRoles);
            setProfilesUpdatedAt(restoredTs);
            safeSetLocalStorage(STORAGE_KEYS.PROFILES, JSON.stringify(restored));
            safeSetLocalStorage(STORAGE_KEYS.ROLES, JSON.stringify(restoredRoles));
            safeSetLocalStorage(STORAGE_KEYS.PROFILES_TS, String(restoredTs));
            pushProfilesToServer(restored, restoredRoles, restoredTs);
          } else if (curCustom) {
            saveAnagraficaToIndexedDB(
              profilesRef.current,
              availableRolesRef.current,
              profilesUpdatedAtRef.current || Date.now()
            );
          }
        } else if (isCustomizedProfiles(profilesRef.current)) {
          saveAnagraficaToIndexedDB(
            profilesRef.current,
            availableRolesRef.current,
            profilesUpdatedAtRef.current || Date.now()
          );
        }
      })
      .catch(() => {});

    // 2) Sincronizzazione con il Cloud Server (/api/state)
    fetch('/api/state')
      .then((r) => r.json())
      .then((data) => {
        setCloudConnected(true);
        if (data.publicUrl) setPublicUrl(data.publicUrl);
        if (typeof data.connectedDevices === 'number') {
          setConnectedDevices(Math.max(1, data.connectedDevices));
        }
        const serverHasData =
          data.db &&
          ((Array.isArray(data.db.attendance) && data.db.attendance.length > 0) ||
            (Array.isArray(data.db.profiles) && data.db.profiles.length > 0) ||
            Number(data.db.profilesUpdatedAt || 0) > 0 ||
            Number(data.db.cashUpdatedAt || 0) > 0 ||
            Number(data.db.queueState?.updatedAt || 0) > 0);

        if (serverHasData) {
          applyRemoteSnapshot(data.db);
          hasHydratedRef.current = true;
        } else {
          hasHydratedRef.current = true;
          pushProfilesToServer(
            profilesRef.current,
            availableRolesRef.current,
            profilesUpdatedAtRef.current || Date.now()
          );
          pushCloudSnapshot({
            profiles: profilesRef.current,
            availableRoles: availableRolesRef.current,
            profilesUpdatedAt: profilesUpdatedAtRef.current,
            expenseCategories,
            cashMovements,
            cashOpeningBalance,
            cashUpdatedAt: cashUpdatedAtRef.current,
            lessons,
            lessonsUpdatedAt: lessonsUpdatedAtRef.current,
            attendance,
            subjectNotes,
            visualHeadcounts,
            liveFeed,
            queueState,
            updatedAt: new Date().toISOString(),
          });
        }
      })
      .catch(() => {
        hasHydratedRef.current = true;
        setCloudConnected(false);
      });

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/events');
      es.onopen = () => setCloudConnected(true);
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.publicUrl) setPublicUrl(parsed.publicUrl);
          if (parsed.type === 'CONNECTED' && typeof parsed.connectedClients === 'number') {
            setConnectedDevices(Math.max(1, parsed.connectedClients));
          } else if (parsed.type === 'STATE_SYNC' && parsed.payload?.db) {
            applyRemoteSnapshot(parsed.payload.db);
          } else if (parsed.type === 'PROFILES_SYNC' && parsed.payload?.profiles) {
            applyRemoteProfiles(
              parsed.payload.profiles,
              parsed.payload.availableRoles,
              Number(parsed.payload.profilesUpdatedAt || 0)
            );
            setLastCloudSync(new Date().toLocaleTimeString('it-IT'));
          } else if (parsed.type === 'QUEUE_SYNC' && parsed.payload?.queueState) {
            const incomingQ = sanitizeQueueState(
              parsed.payload.queueState as QueueState,
              profilesRef.current
            );
            const incomingTs = Number(incomingQ.updatedAt || 0);
            if (incomingTs > queueUpdatedAtRef.current) {
              queueUpdatedAtRef.current = incomingTs;
              setQueueState(incomingQ);
              safeSetLocalStorage(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(incomingQ));
              setLastCloudSync(new Date().toLocaleTimeString('it-IT'));
            }
          } else if (parsed.type === 'LESSONS_SYNC' && Array.isArray(parsed.payload?.lessons)) {
            const remoteTs = Number(parsed.payload.lessonsUpdatedAt || 0);
            if (remoteTs > lessonsUpdatedAtRef.current) {
              lessonsRef.current = parsed.payload.lessons;
              lessonsUpdatedAtRef.current = remoteTs;
              setLessons(parsed.payload.lessons);
              setLessonsUpdatedAt(remoteTs);
              safeSetLocalStorage(STORAGE_KEYS.LESSONS, JSON.stringify(parsed.payload.lessons));
              safeSetLocalStorage(STORAGE_KEYS.LESSONS_TS, String(remoteTs));
              setLastCloudSync(new Date().toLocaleTimeString('it-IT'));
            }
          } else if (parsed.type === 'PUBLIC_URL' && parsed.payload?.publicUrl) {
            setPublicUrl(parsed.payload.publicUrl);
          }
        } catch {
          // Ignore malformed SSE message
        }
      };
      es.onerror = () => {
        setCloudConnected(false);
      };
    } catch {
      // Ignore SSE errors
    }

    try {
      const bc = new BroadcastChannel('quartimbra_cloud_channel');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'STATE_SYNC' && ev.data.db) {
          applyRemoteSnapshot(ev.data.db);
        } else if (ev.data?.type === 'PROFILES_SYNC' && ev.data.profiles) {
          applyRemoteProfiles(
            ev.data.profiles,
            ev.data.availableRoles,
            Number(ev.data.profilesUpdatedAt || 0)
          );
        } else if (ev.data?.type === 'LESSONS_SYNC' && Array.isArray(ev.data.lessons)) {
          const remoteTs = Number(ev.data.lessonsUpdatedAt || 0);
          if (remoteTs > lessonsUpdatedAtRef.current) {
            lessonsRef.current = ev.data.lessons;
            lessonsUpdatedAtRef.current = remoteTs;
            setLessons(ev.data.lessons);
            setLessonsUpdatedAt(remoteTs);
            safeSetLocalStorage(STORAGE_KEYS.LESSONS, JSON.stringify(ev.data.lessons));
            safeSetLocalStorage(STORAGE_KEYS.LESSONS_TS, String(remoteTs));
          }
        } else if (ev.data?.type === 'QUEUE_SYNC' && ev.data.queueState) {
          const incomingQ = sanitizeQueueState(
            ev.data.queueState as QueueState,
            profilesRef.current
          );
          const incomingTs = Number(incomingQ.updatedAt || 0);
          if (incomingTs > queueUpdatedAtRef.current) {
            queueUpdatedAtRef.current = incomingTs;
            setQueueState(incomingQ);
            safeSetLocalStorage(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(incomingQ));
          }
        }
      };
      broadcastChannelRef.current = bc;
    } catch {
      // BroadcastChannel not supported
    }

    // Polling leggero di sicurezza per Eliminacode (/api/queue) così il Monitor Sala d'Attesa riceve sempre il turno anche se SSE viene bufferizzato
    const queuePollTimer = setInterval(() => {
      fetch('/api/queue')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && data.ok && data.queueState) {
            const incomingQ = sanitizeQueueState(
              data.queueState as QueueState,
              profilesRef.current
            );
            if (Number(incomingQ.updatedAt || 0) > queueUpdatedAtRef.current) {
              setQueueState(incomingQ);
              safeSetLocalStorage(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(incomingQ));
            }
          }
        })
        .catch(() => {});
    }, 1800);

    return () => {
      clearInterval(queuePollTimer);
      if (es) es.close();
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontScale);
    safeSetLocalStorage(STORAGE_KEYS.FONT_SCALE, fontScale);
  }, [fontScale]);

  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEYS.LIGHT_THEME, String(lightTheme));
  }, [lightTheme]);

  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEYS.VOICE, String(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    safeSetLocalStorage(STORAGE_KEYS.ROLES, JSON.stringify(availableRoles));
    safeSetLocalStorage(STORAGE_KEYS.PROFILES_TS, String(profilesUpdatedAt));
    if (isCustomizedProfiles(profiles)) {
      safeSetLocalStorage(
        STORAGE_KEYS.PROTECTED_ANAGRAFICA,
        JSON.stringify({
          profiles,
          availableRoles,
          updatedAt: profilesUpdatedAt || Date.now(),
        })
      );
      saveAnagraficaToIndexedDB(profiles, availableRoles, profilesUpdatedAt || Date.now());
    }
    safeSetLocalStorage(STORAGE_KEYS.CATEGORIES, JSON.stringify(expenseCategories));
    safeSetLocalStorage(STORAGE_KEYS.CASH_MOVEMENTS, JSON.stringify(cashMovements));
    safeSetLocalStorage(STORAGE_KEYS.CASH_BALANCE, String(cashOpeningBalance));
    safeSetLocalStorage(STORAGE_KEYS.CASH_TS, String(cashUpdatedAt));
    safeSetLocalStorage(STORAGE_KEYS.LESSONS, JSON.stringify(lessons));
    safeSetLocalStorage(STORAGE_KEYS.LESSONS_TS, String(lessonsUpdatedAt));
    safeSetLocalStorage(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
    safeSetLocalStorage(STORAGE_KEYS.NOTES, JSON.stringify(subjectNotes));
    safeSetLocalStorage(STORAGE_KEYS.HEADCOUNTS, JSON.stringify(visualHeadcounts));
    safeSetLocalStorage(STORAGE_KEYS.LIVE_FEED, JSON.stringify(liveFeed));

    // Invia al cloud solo DOPO che il client ha completato il caricamento iniziale da /api/state
    if (!isApplyingRemoteRef.current && hasHydratedRef.current) {
      pushCloudSnapshot({
        profiles,
        availableRoles,
        profilesUpdatedAt,
        expenseCategories,
        cashMovements,
        cashOpeningBalance,
        cashUpdatedAt,
        lessons,
        lessonsUpdatedAt,
        attendance,
        subjectNotes,
        visualHeadcounts,
        liveFeed,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [
    profiles,
    availableRoles,
    profilesUpdatedAt,
    expenseCategories,
    cashMovements,
    cashOpeningBalance,
    cashUpdatedAt,
    lessons,
    lessonsUpdatedAt,
    attendance,
    subjectNotes,
    visualHeadcounts,
    liveFeed,
  ]);

  useEffect(() => {
    if (currentUser) {
      safeSetLocalStorage(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.USER);
      } catch {
        // Ignore
      }
    }
  }, [currentUser]);

  const effectiveDay = isSimulatingTime ? simulatedDay : realNow.getDay();
  const effectiveTime = isSimulatingTime
    ? simulatedTime
    : realNow.toTimeString().slice(0, 5);

  const activeLessons = useMemo(() => {
    return lessons.filter((les) => {
      if (les.day_of_week !== effectiveDay) return false;
      const [sh, sm] = les.start_time.split(':').map(Number);
      const startMinus10 = Math.max(0, sh * 60 + sm - 10);
      const openTimeStr = `${String(Math.floor(startMinus10 / 60)).padStart(2, '0')}:${String(startMinus10 % 60).padStart(2, '0')}`;
      const closeTimeStr = les.end_time.slice(0, 5);
      return effectiveTime >= openTimeStr && effectiveTime <= closeTimeStr;
    });
  }, [lessons, effectiveDay, effectiveTime]);

  const getActiveLessonForRoom = (room: ClassroomKey): Lesson | null => {
    return activeLessons.find((l) => l.classroom === room) || null;
  };

  const todayIsoPrefix = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const getTodayAttendanceCountForLesson = (lessonId: string): number => {
    return attendance.filter(
      (a) => a.lesson_id === lessonId && a.created_at.slice(0, 10) === todayIsoPrefix
    ).length;
  };

  const getTodayAttendancesForRoom = (room: ClassroomKey): AttendanceRecord[] => {
    const activeLesson = getActiveLessonForRoom(room);
    if (activeLesson) {
      return attendance.filter(
        (a) => a.lesson_id === activeLesson.id && a.created_at.slice(0, 10) === todayIsoPrefix
      );
    }
    return attendance.filter(
      (a) => a.classroom === room && a.created_at.slice(0, 10) === todayIsoPrefix
    );
  };

  const myTodayAttendance = useMemo(() => {
    if (!currentUser) return [];
    return attendance.filter(
      (a) => a.user_id === currentUser.id && a.created_at.slice(0, 10) === todayIsoPrefix
    );
  }, [attendance, currentUser, todayIsoPrefix]);

  // Login: 7726 (and 7796) logs in as Giampiero Pilia (Super Admin), 000 logs in as Ufficio Presenze, other numbers log in as Socio
  const signInMember = (rawCardNumber: string): { error: string | null } => {
    const cleaned = rawCardNumber.trim();
    if (!cleaned) {
      return { error: 'Digita il numero della tua tessera per entrare.' };
    }

    if (cleaned === '7726' || cleaned === '7796') {
      const superAdminProfile = normalizeSuperAdminProfile(
        profiles.find((p) => isProtectedSuperAdmin(p)) || INITIAL_PROFILES[0]
      );
      setProfiles((prev) => ensureSuperAdminAndRoles(prev));
      setCurrentUser(superAdminProfile);
      setActiveSection('admin_dashboard');
      return { error: null };
    }

    if (cleaned === '000') {
      const staffProfile =
        profiles.find((p) => p.member_number === '000') || INITIAL_PROFILES[1] || INITIAL_PROFILES[0];
      setCurrentUser(staffProfile);
      setActiveSection('admin_dashboard');
      return { error: null };
    }

    if (cleaned.toLowerCase() === 'admin' || cleaned.includes('@')) {
      return {
        error: 'Inserisci un numero di tessera socio valido (solo cifre).',
      };
    }

    // Accesso Segreteria: 9999 (Nives Cocco) o 9998 (Josh Ronald Cocco)
    if (cleaned === '9999' || cleaned === '9998') {
      const segreteriaUser =
        profiles.find((p) => String(p.member_number).trim() === cleaned) ||
        normalizeProtectedSegreteriaProfile(cleaned as '9999' | '9998');
      setCurrentUser(segreteriaUser);
      setActiveSection('eliminacode');
      return { error: null };
    }

    const matched = profiles.find(
      (p) =>
        p.member_number.toLowerCase() === cleaned.toLowerCase() ||
        p.full_name.toLowerCase() === cleaned.toLowerCase() ||
        (/^\d+$/.test(cleaned) &&
          /^\d+$/.test(p.member_number.trim()) &&
          parseInt(p.member_number.trim(), 10) === parseInt(cleaned, 10))
    );

    if (matched) {
      if (isProtectedSuperAdmin(matched)) {
        const superAdminProfile = normalizeSuperAdminProfile(matched);
        setCurrentUser(superAdminProfile);
        setActiveSection('admin_dashboard');
        return { error: null };
      }
      if (isProtectedSegreteriaMember(matched)) {
        const numTrim = String(matched.member_number || '').trim();
        const segreteriaUser = normalizeProtectedSegreteriaProfile(
          numTrim === '9998' ? '9998' : '9999',
          matched
        );
        setCurrentUser(segreteriaUser);
        setActiveSection('eliminacode');
        return { error: null };
      }
      setCurrentUser(matched);
      setActiveSection(matched.role === 'admin' ? 'admin_dashboard' : 'presenze');
      return { error: null };
    }

    // Se il numero non è presente nell'anagrafica soci, blocca l'accesso
    return {
      error: 'Numero di tessera non presente in anagrafica soci. Verifica il numero o rivolgiti alla segreteria.',
    };
  };

  const signInAdmin = (secretCode: string): { error: string | null } => {
    const cleaned = secretCode.trim().toLowerCase();
    if (cleaned === '7726' || cleaned === '7796') {
      const superAdminProfile = normalizeSuperAdminProfile(
        profiles.find((p) => isProtectedSuperAdmin(p)) || INITIAL_PROFILES[0]
      );
      setProfiles((prev) => ensureSuperAdminAndRoles(prev));
      setCurrentUser(superAdminProfile);
      setActiveSection('admin_dashboard');
      return { error: null };
    }
    if (cleaned === '000') {
      const staffProfile =
        profiles.find((p) => p.member_number === '000') || INITIAL_PROFILES[1] || INITIAL_PROFILES[0];
      setCurrentUser(staffProfile);
      setActiveSection('admin_dashboard');
      return { error: null };
    }
    return { error: 'Codice riservato non valido.' };
  };

  const signOut = () => {
    setCurrentUser(null);
    setActiveSection('presenze');
  };

  const registerAttendance = (room: ClassroomKey) => {
    if (!currentUser) {
      return { ok: false, message: "Effettua prima l'accesso." };
    }

    const isSoleminisUser = (currentUser.sede || 'Quartu').toLowerCase() === 'soleminis';
    const isSoleminisRoom = room === 'polifunzionale';
    if (!isSuperAdmin && currentUser.role !== 'admin') {
      if (isSoleminisUser && !isSoleminisRoom) {
        return {
          ok: false,
          message: 'Sei iscritto nella sede di Soleminis. Puoi timbrare solo per le lezioni di Soleminis.',
        };
      }
      if (!isSoleminisUser && isSoleminisRoom) {
        return {
          ok: false,
          message: 'Sei iscritto nella sede di Quartu. Puoi timbrare solo per le lezioni di Quartu.',
        };
      }
    }

    const activeLesson = getActiveLessonForRoom(room);
    if (!activeLesson) {
      return {
        ok: false,
        message: 'Nessuna lezione attiva in questo momento in questa aula.',
      };
    }

    const already = attendance.some(
      (a) =>
        a.user_id === currentUser.id &&
        a.lesson_id === activeLesson.id &&
        a.created_at.slice(0, 10) === todayIsoPrefix
    );

    if (already) {
      return {
        ok: false,
        message: `Hai già registrato la tua presenza oggi per "${activeLesson.subject}".`,
      };
    }

    // Impedisce di essere presenti in 2 aule contemporaneamente (stesso orario / fasce orarie sovrapposte)
    const conflictingAtt = attendance.find((a) => {
      if (a.user_id !== currentUser.id) return false;
      if (a.created_at.slice(0, 10) !== todayIsoPrefix) return false;
      if (a.lesson_id === activeLesson.id) return false;
      const otherLesson = lessons.find((l) => l.id === a.lesson_id);
      if (otherLesson) {
        return doLessonsOverlap(otherLesson, activeLesson);
      }
      return false;
    });

    if (conflictingAtt) {
      const conflictLesson = lessons.find((l) => l.id === conflictingAtt.lesson_id);
      const conflictRoomLabel = CLASSROOM_LABELS[conflictingAtt.classroom] || conflictingAtt.classroom;
      return {
        ok: false,
        message: `Non puoi essere presente in 2 aule contemporaneamente! Risulti già registrato nello stesso orario in ${conflictRoomLabel}${
          conflictLesson
            ? ` (${conflictLesson.subject}, ${conflictLesson.start_time.slice(0, 5)}–${conflictLesson.end_time.slice(0, 5)})`
            : ''
        }. Se hai sbagliato aula, premi prima "Annulla" sulla presenza registrata in alto.`,
      };
    }

    const nowIso = new Date().toISOString();
    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      user_id: currentUser.id,
      classroom: room,
      lesson_id: activeLesson.id,
      created_at: nowIso,
    };

    const feedItem: LiveFeedEvent = {
      id: `feed-${Date.now()}`,
      timestamp: nowIso,
      memberNumber: currentUser.member_number,
      memberName: currentUser.full_name,
      classroom: room,
      subject: activeLesson.subject,
      action: 'stamp',
    };

    setAttendance((prev) => [newRecord, ...prev]);
    setLiveFeed((prev) => [feedItem, ...prev.slice(0, 49)]);

    playSuccessSound(
      `Presenza registrata in ${
        room === 'polifunzionale' ? 'Aula Polifunzionale' : `Aula ${room}`
      } per ${activeLesson.subject}`,
      voiceEnabled
    );

    return {
      ok: true,
      message: `Presenza confermata per "${activeLesson.subject}"!`,
      attendanceId: newRecord.id,
      lesson: activeLesson,
    };
  };

  const registerAssistedAttendance = (room: ClassroomKey, memberCardNumber: string) => {
    const cleanNum = memberCardNumber.trim();
    if (!cleanNum) {
      return { ok: false, message: 'Inserisci il numero di tessera del socio.' };
    }

    const activeLesson = getActiveLessonForRoom(room);
    if (!activeLesson) {
      return { ok: false, message: 'Nessuna lezione attiva in quest\'aula in questo orario.' };
    }

    let member = profiles.find(
      (p) => p.role === 'member' && p.member_number.toLowerCase() === cleanNum.toLowerCase()
    );

    if (!member) {
      member = {
        id: `u-${cleanNum}`,
        member_number: cleanNum,
        full_name: `Socio Tessera N° ${cleanNum}`,
        sede: room === 'polifunzionale' ? 'Soleminis' : 'Quartu',
        role: 'member',
        is_cd: false,
        roles: ['Socio'],
        joined_year: new Date().getFullYear(),
      };
      setProfiles((prev) => [...prev, member!]);
    }

    const already = attendance.some(
      (a) =>
        a.user_id === member!.id &&
        a.lesson_id === activeLesson.id &&
        a.created_at.slice(0, 10) === todayIsoPrefix
    );

    if (already) {
      return {
        ok: false,
        message: `${member.full_name} (Tessera ${member.member_number}) risulta già registrato in quest'aula.`,
      };
    }

    const conflictingAtt = attendance.find((a) => {
      if (a.user_id !== member!.id) return false;
      if (a.created_at.slice(0, 10) !== todayIsoPrefix) return false;
      if (a.lesson_id === activeLesson.id) return false;
      const otherLesson = lessons.find((l) => l.id === a.lesson_id);
      if (otherLesson) {
        return doLessonsOverlap(otherLesson, activeLesson);
      }
      return false;
    });

    if (conflictingAtt) {
      const conflictLesson = lessons.find((l) => l.id === conflictingAtt.lesson_id);
      const conflictRoomLabel = CLASSROOM_LABELS[conflictingAtt.classroom] || conflictingAtt.classroom;
      return {
        ok: false,
        message: `Impossibile registrare: ${member.full_name} (Tessera ${member.member_number}) risulta già presente nello stesso orario in ${conflictRoomLabel}${
          conflictLesson ? ` (${conflictLesson.subject})` : ''
        }.`,
      };
    }

    const nowIso = new Date().toISOString();
    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      user_id: member.id,
      classroom: room,
      lesson_id: activeLesson.id,
      created_at: nowIso,
    };

    const feedItem: LiveFeedEvent = {
      id: `feed-${Date.now()}`,
      timestamp: nowIso,
      memberNumber: member.member_number,
      memberName: member.full_name,
      classroom: room,
      subject: activeLesson.subject,
      action: 'assisted',
    };

    setAttendance((prev) => [newRecord, ...prev]);
    setLiveFeed((prev) => [feedItem, ...prev.slice(0, 49)]);

    return {
      ok: true,
      message: `Registrata presenza per ${member.full_name} (Tessera N° ${member.member_number}).`,
    };
  };

  const cancelAttendance = (attendanceId: string) => {
    setAttendance((prev) => prev.filter((a) => a.id !== attendanceId));
  };

  const rateAttendance = (attendanceId: string, rating: 1 | 2 | 3) => {
    setAttendance((prev) =>
      prev.map((a) => (a.id === attendanceId ? { ...a, rating } : a))
    );
  };

  const setRoomVisualHeadcount = (room: ClassroomKey, count: number) => {
    const safeCount = Math.max(0, Math.min(500, Math.round(count)));
    setVisualHeadcounts((prev) => ({
      ...prev,
      [room]: safeCount,
    }));
  };

  // Roles & CD Management (only Giampiero Pilia 7726 / Super Admin)
  const addCustomRole = (roleName: string) => {
    const clean = roleName.trim();
    if (!clean) return { ok: false, message: 'Inserisci il nome del ruolo.' };
    if (availableRolesRef.current.some((r) => r.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, message: 'Questo ruolo esiste già.' };
    }
    const nextRoles = [...availableRolesRef.current, clean];
    commitProfilesUpdate(profilesRef.current, nextRoles);
    return { ok: true };
  };

  const toggleMemberCD = (userId: string, isCd: boolean) => {
    const next = profilesRef.current.map((p) => {
      if (p.id !== userId) return p;
      const currentRoles = p.roles || ['Socio'];
      const nextRoles = isCd
        ? Array.from(new Set([...currentRoles, 'CD']))
        : currentRoles.filter((r) => r !== 'CD');
      return {
        ...p,
        is_cd: isCd,
        roles: nextRoles.length > 0 ? nextRoles : ['Socio'],
      };
    });
    commitProfilesUpdate(next);
  };

  const toggleMemberRole = (userId: string, roleName: string) => {
    const next = profilesRef.current.map((p) => {
      if (p.id !== userId) return p;
      const currentRoles = p.roles || ['Socio'];
      const hasRole = currentRoles.includes(roleName);
      const nextRoles = hasRole
        ? currentRoles.filter((r) => r !== roleName)
        : [...currentRoles, roleName];
      const finalRoles = nextRoles.length > 0 ? nextRoles : ['Socio'];
      const nextIsCd = roleName === 'CD' ? !hasRole : Boolean(p.is_cd || finalRoles.includes('CD'));
      return {
        ...p,
        is_cd: nextIsCd,
        roles: finalRoles,
      };
    });
    commitProfilesUpdate(next);
  };

  // Piccola Cassa Management
  const setCashOpeningBalance = (amount: number) => {
    setCashOpeningBalanceState(amount);
    setCashUpdatedAt(Date.now());
  };

  const addExpenseCategory = (name: string, description?: string) => {
    const clean = name.trim();
    if (!clean) return;
    const newCat: ExpenseCategory = {
      id: `cat-${Date.now()}`,
      name: clean,
      description: description?.trim() || '',
      is_active: true,
    };
    setExpenseCategories((prev) => [...prev, newCat]);
    setCashUpdatedAt(Date.now());
  };

  const updateExpenseCategory = (id: string, data: Partial<ExpenseCategory>) => {
    setExpenseCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    setCashUpdatedAt(Date.now());
  };

  const deleteExpenseCategory = (id: string) => {
    setExpenseCategories((prev) => prev.filter((c) => c.id !== id));
    setCashUpdatedAt(Date.now());
  };

  const addCashMovement = (movementData: Omit<CashMovement, 'id' | 'created_at'>): CashMovement => {
    const newMov: CashMovement = {
      ...movementData,
      id: `cash-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setCashMovements((prev) => [newMov, ...prev]);
    setCashUpdatedAt(Date.now());
    return newMov;
  };

  const updateCashMovement = (id: string, data: Partial<CashMovement>) => {
    setCashMovements((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
    setCashUpdatedAt(Date.now());
  };

  const deleteCashMovement = (id: string) => {
    setCashMovements((prev) => prev.filter((m) => m.id !== id));
    setCashUpdatedAt(Date.now());
  };

  const addMember = (
    member_number: string,
    full_name: string,
    sede: 'Quartu' | 'Soleminis',
    phone?: string,
    is_cd = false,
    roles?: string[]
  ) => {
    const cleanNum = member_number.trim();
    if (!cleanNum) return { ok: false, message: 'Inserisci il numero di tessera.' };
    if (profilesRef.current.some((p) => p.member_number.toLowerCase() === cleanNum.toLowerCase())) {
      return { ok: false, message: 'Esiste già un socio con questo numero di tessera.' };
    }
    const cleanFullName = cleanPersonNameField(full_name) || `Socio ${cleanNum}`;
    const nameParts = cleanFullName.split(/\s+/);
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : cleanFullName;
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const assignedRoles = roles && roles.length > 0 ? roles : is_cd ? ['CD'] : ['Socio'];
    const newProfile: Profile = {
      id: `u-${Date.now()}`,
      member_number: cleanNum,
      first_name: firstName,
      last_name: lastName,
      full_name: cleanFullName,
      sede,
      role: 'member',
      is_cd: is_cd || assignedRoles.includes('CD'),
      roles: assignedRoles,
      phone: phone?.trim() || '',
      joined_year: new Date().getFullYear(),
    };
    commitProfilesUpdate([...profilesRef.current, newProfile]);
    return { ok: true };
  };

  const importMembersBatch = (rows: ImportedMemberRow[]) => {
    let added = 0;
    let updated = 0;
    const discoveredRoles = new Set(availableRolesRef.current);
    const next = [...profilesRef.current];
    const batchTs = Date.now();

    rows.forEach((row, idx) => {
      const cleanNum = String(row.member_number || '').trim();
      if (!cleanNum) return;

      const firstName = cleanPersonNameField(row.first_name);
      const lastName = cleanPersonNameField(row.last_name);
      const fullName = `${firstName} ${lastName}`.trim() || `Socio ${cleanNum}`;
      const sede: 'Quartu' | 'Soleminis' =
        String(row.sede || '')
          .trim()
          .toLowerCase()
          .includes('soleminis')
          ? 'Soleminis'
          : 'Quartu';

      const rawRole = String(row.roleName || 'Socio').trim() || 'Socio';
      const roleList = rawRole
        .split(/[,;/]+/)
        .map((r) => r.trim())
        .filter(Boolean);
      const finalRoles = roleList.length > 0 ? roleList : ['Socio'];
      finalRoles.forEach((r) => discoveredRoles.add(r));

      const isAdminRole = finalRoles.some((r) => r.toLowerCase() === 'amministratore');
      const isCd =
        isAdminRole || finalRoles.some((r) => r.toUpperCase() === 'CD');

      // 7726 (e 7796) appartiene ESCLUSIVAMENTE a Giampiero Pilia.
      // Nessuna riga di Excel (es. con ruolo "Amministratore" o con cognome diverso da Pilia) può mai sovrascrivere il nome di 7726!
      const isGiampieroName =
        fullName.toLowerCase().includes('giampiero') && fullName.toLowerCase().includes('pilia');
      const isCard7726 = cleanNum === '7726' || cleanNum === '7796';
      const hasOtherSurnameOn7726 =
        isCard7726 &&
        Boolean(lastName || firstName) &&
        !fullName.toLowerCase().includes('pilia') &&
        !fullName.toLowerCase().includes('giampiero');

      if (hasOtherSurnameOn7726) {
        // Se nel file Excel un altro socio (es. Galleri) aveva per errore il numero 7726 o una colonna spostata,
        // NON sovrascrive 7726 Giampiero Pilia ma lo importa con un codice distinto
        const safeAltNum = `${cleanNum}-${lastName || idx + 1}`;
        next.push({
          id: `u-imp-${batchTs}-${idx}`,
          member_number: safeAltNum,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          sede,
          role: isAdminRole ? 'admin' : 'member',
          is_super_admin: false,
          is_cd: isCd,
          roles: finalRoles,
          joined_year: new Date().getFullYear(),
        });
        added++;
        return;
      }

      const isSuper = isCard7726 || isGiampieroName;

      const existingIndex = next.findIndex(
        (p) =>
          p.member_number.toLowerCase() === cleanNum.toLowerCase() ||
          (isSuper && isProtectedSuperAdmin(p))
      );

      if (existingIndex >= 0) {
        if (isSuper || isProtectedSuperAdmin(next[existingIndex])) {
          next[existingIndex] = normalizeSuperAdminProfile({
            ...next[existingIndex],
            sede,
            roles: Array.from(
              new Set(['Amministratore', ...finalRoles.filter((r) => r !== 'Socio')])
            ),
          });
        } else if (isProtectedSegreteriaMember(next[existingIndex])) {
          next[existingIndex] = normalizeProtectedSegreteriaProfile(
            cleanNum === '9998' ? '9998' : '9999',
            next[existingIndex]
          );
        } else {
          next[existingIndex] = {
            ...next[existingIndex],
            member_number: cleanNum,
            first_name: firstName || next[existingIndex].first_name,
            last_name: lastName || next[existingIndex].last_name,
            full_name: fullName,
            sede,
            is_cd: isCd,
            is_super_admin: false,
            role: isAdminRole ? 'admin' : next[existingIndex].role,
            roles: finalRoles,
          };
        }
        updated++;
      } else {
        if (isSuper) {
          next.unshift(
            normalizeSuperAdminProfile({
              sede,
              roles: Array.from(
                new Set(['Amministratore', ...finalRoles.filter((r) => r !== 'Socio')])
              ),
            })
          );
        } else if (cleanNum === '9999' || cleanNum === '9998') {
          next.push(normalizeProtectedSegreteriaProfile(cleanNum as '9999' | '9998'));
        } else {
          next.push({
            id: `u-imp-${batchTs}-${idx}`,
            member_number: cleanNum,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            sede,
            role: isAdminRole ? 'admin' : 'member',
            is_super_admin: false,
            is_cd: isCd,
            roles: finalRoles,
            joined_year: new Date().getFullYear(),
          });
        }
        added++;
      }
    });

    commitProfilesUpdate(next, Array.from(discoveredRoles), true);
    return { added, updated };
  };

  const updateMember = (id: string, data: Partial<Profile>) => {
    const next = profilesRef.current.map((p) => {
      if (p.id !== id) return p;
      const merged = { ...p, ...data };
      if (isProtectedSuperAdmin(p) || isProtectedSuperAdmin(merged)) {
        return normalizeSuperAdminProfile(merged);
      }
      return {
        ...merged,
        first_name: cleanPersonNameField(merged.first_name),
        last_name: cleanPersonNameField(merged.last_name),
        full_name: cleanPersonNameField(merged.full_name) || merged.full_name,
      };
    });
    commitProfilesUpdate(next);

    if (currentUser?.id === id) {
      setCurrentUser((prev) => {
        if (!prev) return null;
        const merged = { ...prev, ...data };
        return isProtectedSuperAdmin(prev) || isProtectedSuperAdmin(merged)
          ? normalizeSuperAdminProfile(merged)
          : merged;
      });
    }
  };

  const deleteMember = (id: string) => {
    const target = profilesRef.current.find((p) => p.id === id);
    if (!target) return;
    if (isProtectedSuperAdmin(target)) return;
    if (isProtectedSegreteriaMember(target) && !isSuperAdmin) {
      return;
    }
    if (isProtectedSegreteriaMember(target) && isSuperAdmin) {
      const num = String(target.member_number || '').trim();
      const currentDeleted = getAdminDeletedSegreteriaNumbers();
      if (num && !currentDeleted.has(num)) {
        saveAdminDeletedSegreteriaNumbers([...Array.from(currentDeleted), num]);
      }
    }
    const next = profilesRef.current.filter((p) => p.id !== id);
    commitProfilesUpdate(next, undefined, true);
  };

  const deleteMembersBatch = (ids: string[]) => {
    const idSet = new Set(ids);
    const toDeleteSegreteriaNums: string[] = [];
    const next = profilesRef.current.filter((p) => {
      if (isProtectedSuperAdmin(p)) return true;
      if (idSet.has(p.id)) {
        if (isProtectedSegreteriaMember(p)) {
          if (!isSuperAdmin) return true;
          const num = String(p.member_number || '').trim();
          if (num) toDeleteSegreteriaNums.push(num);
          return false;
        }
        return false;
      }
      return true;
    });
    if (toDeleteSegreteriaNums.length > 0) {
      const currentDeleted = getAdminDeletedSegreteriaNumbers();
      saveAdminDeletedSegreteriaNumbers(
        Array.from(new Set([...Array.from(currentDeleted), ...toDeleteSegreteriaNums]))
      );
    }
    commitProfilesUpdate(next, undefined, true);
  };

  const commitLessonsUpdate = (nextLessons: Lesson[], forceTs?: number) => {
    const nowTs = forceTs || Date.now();
    lessonsRef.current = nextLessons;
    lessonsUpdatedAtRef.current = nowTs;
    setLessons(nextLessons);
    setLessonsUpdatedAt(nowTs);
    safeSetLocalStorage(STORAGE_KEYS.LESSONS, JSON.stringify(nextLessons));
    safeSetLocalStorage(STORAGE_KEYS.LESSONS_TS, String(nowTs));

    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'LESSONS_SYNC',
          lessons: nextLessons,
          lessonsUpdatedAt: nowTs,
        });
      }
    } catch {}

    fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessons: nextLessons,
        lessonsUpdatedAt: nowTs,
      }),
    }).catch(() => {});
  };

  const addLesson = (lessonData: Omit<Lesson, 'id'>) => {
    const meta = getSubjectMeta(lessonData.subject);
    const newLesson: Lesson = {
      ...lessonData,
      category: lessonData.category || meta.category,
      id: `les-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    const next = [...lessonsRef.current, newLesson];
    commitLessonsUpdate(next);
  };

  const updateLesson = (id: string, data: Partial<Lesson>) => {
    const next = lessonsRef.current.map((l) => (l.id === id ? { ...l, ...data } : l));
    commitLessonsUpdate(next);
  };

  const deleteLesson = (id: string) => {
    const next = lessonsRef.current.filter((l) => l.id !== id);
    commitLessonsUpdate(next);
  };

  const importLessonsBatch = (
    newLessons: Omit<Lesson, 'id'>[],
    mode: 'replace' | 'append' = 'append'
  ): { count: number } => {
    const prepared: Lesson[] = newLessons.map((l, idx) => ({
      ...l,
      id: `les-imp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      category: l.category || getSubjectMeta(l.subject).category,
    }));
    const next = mode === 'replace' ? prepared : [...lessonsRef.current, ...prepared];
    commitLessonsUpdate(next);
    return { count: prepared.length };
  };

  const saveSubjectNote = (note: SubjectDidacticNote) => {
    setSubjectNotes((prev) => {
      const exists = prev.some((n) => n.subject === note.subject);
      if (exists) {
        return prev.map((n) => (n.subject === note.subject ? note : n));
      }
      return [...prev, note];
    });
  };

  const resetDemoData = () => {
    setAttendance(generateInitialAttendance());
    setSubjectNotes(INITIAL_SUBJECT_NOTES);
    setVisualHeadcounts(DEFAULT_HEADCOUNTS);
    setLiveFeed([]);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isSuperAdmin,
        isCDMember,
        isDidatticaMember,
        isSegreteriaMember,
        activeSection,
        setActiveSection,
        profiles,
        availableRoles,
        addCustomRole,
        toggleMemberCD,
        toggleMemberRole,
        importMembersBatch,
        expenseCategories,
        addExpenseCategory,
        updateExpenseCategory,
        deleteExpenseCategory,
        cashMovements,
        cashOpeningBalance,
        setCashOpeningBalance,
        addCashMovement,
        updateCashMovement,
        deleteCashMovement,
        lessons,
        attendance,
        subjectNotes,
        visualHeadcounts,
        liveFeed,
        queueState,
        updateQueueState,
        cloudConnected,
        connectedDevices,
        lastCloudSync,
        publicUrl,
        fontScale,
        setFontScale,
        lightTheme,
        setLightTheme,
        voiceEnabled,
        setVoiceEnabled,
        isSimulatingTime,
        setIsSimulatingTime,
        effectiveDay,
        setSimulatedDay,
        effectiveTime,
        setSimulatedTime,
        activeLessons,
        getActiveLessonForRoom,
        getTodayAttendanceCountForLesson,
        getTodayAttendancesForRoom,
        myTodayAttendance,
        signInMember,
        signInAdmin,
        signOut,
        registerAttendance,
        registerAssistedAttendance,
        cancelAttendance,
        rateAttendance,
        setRoomVisualHeadcount,
        addMember,
        updateMember,
        deleteMember,
        deleteMembersBatch,
        addLesson,
        updateLesson,
        deleteLesson,
        importLessonsBatch,
        saveSubjectNote,
        resetDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
