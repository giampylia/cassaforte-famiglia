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
  notes?: string;
}

export interface QueueState {
  title: string;
  currentNumber: number;
  items: QueueItem[];
  callPulse: number;
  updatedAt: number;
  pdfFileName?: string;
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
  saveSubjectNote: (note: SubjectDidacticNote) => void;
  resetDemoData: () => void;
}

const STORAGE_KEYS = {
  USER: 'quartimbra_current_user_v4',
  PROFILES: 'quartimbra_profiles_v4',
  ROLES: 'quartimbra_available_roles_v4',
  PROFILES_TS: 'quartimbra_profiles_updated_at_v4',
  PROTECTED_ANAGRAFICA: 'quartimbra_protected_anagrafica_backup_v1',
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
  currentNumber: 1,
  items: [],
  callPulse: 0,
  updatedAt: 0,
  pdfFileName: '',
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

// Verifica se un elenco di soci contiene modifiche/importazioni rispetto ai dati demo iniziali
function isCustomizedProfiles(list: Profile[]): boolean {
  if (!Array.isArray(list)) return false;
  if (list.length !== INITIAL_PROFILES.length) return true;
  for (const p of list) {
    if (p.id.startsWith('u-imp-') || p.id.startsWith('u-17')) return true;
    const init = INITIAL_PROFILES.find((ip) => ip.member_number === p.member_number);
    if (!init) return true;
    if (p.full_name !== init.full_name || Boolean(p.is_cd) !== Boolean(init.is_cd)) return true;
    const r1 = (p.roles || ['Socio']).join(',');
    const r2 = (init.roles || ['Socio']).join(',');
    if (r1 !== r2) return true;
  }
  return false;
}

function normalizeSuperAdminProfile(p?: Partial<Profile> | null): Profile {
  const base = INITIAL_PROFILES[0]; // 7726 Giampiero Pilia
  const rawName = (p?.full_name || '').trim();
  const isAutoName = !rawName || rawName.toLowerCase().startsWith('socio tessera');
  const firstName = isAutoName ? 'Giampiero' : (p?.first_name || 'Giampiero').trim();
  const lastName = isAutoName ? 'Pilia' : (p?.last_name || 'Pilia').trim();
  const fullName = isAutoName ? 'Giampiero Pilia' : `${firstName} ${lastName}`.trim() || 'Giampiero Pilia';
  const rawNum = String(p?.member_number || '').trim();
  // Usa 7726 come numero tessera principale (anche se in precedenza era rimasto 7796)
  const memberNumber = !rawNum || rawNum === '7796' ? '7726' : rawNum;
  const existingRoles = Array.isArray(p?.roles) ? p!.roles!.filter((r) => r !== 'Socio') : [];
  const mergedRoles = Array.from(new Set(['Amministratore', ...existingRoles]));

  return {
    ...base,
    ...(p || {}),
    id: p?.id && p.id !== 'admin-7796' ? p.id : 'admin-7726',
    member_number: memberNumber,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    sede: p?.sede || 'Quartu',
    role: 'admin',
    is_super_admin: true,
    is_cd: p?.is_cd !== undefined ? Boolean(p.is_cd) : true,
    roles: mergedRoles,
  };
}

function ensureSuperAdminAndRoles(rawProfiles: Profile[]): Profile[] {
  const list = Array.isArray(rawProfiles) ? [...rawProfiles] : [];
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

  return list.map((p) => {
    if (isProtectedSuperAdmin(p)) {
      return normalizeSuperAdminProfile(p);
    }
    const initialMatch = INITIAL_PROFILES.find((ip) => ip.member_number === p.member_number);
    const roles = p.roles && p.roles.length > 0 ? p.roles : initialMatch?.roles || ['Socio'];
    const is_cd = typeof p.is_cd === 'boolean' ? p.is_cd : roles.includes('CD') || Boolean(initialMatch?.is_cd);
    return {
      ...p,
      first_name: p.first_name || initialMatch?.first_name,
      last_name: p.last_name || initialMatch?.last_name,
      is_cd,
      roles: is_cd && !roles.includes('CD') ? [...roles, 'CD'] : roles,
    };
  });
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try {
      // Controlla prima il backup protetto dell'Anagrafica Soci
      const protectedRaw = localStorage.getItem(STORAGE_KEYS.PROTECTED_ANAGRAFICA);
      const savedRaw = localStorage.getItem(STORAGE_KEYS.PROFILES);
      const savedList: Profile[] | null = savedRaw ? JSON.parse(savedRaw) : null;

      if (protectedRaw) {
        const parsedBackup = JSON.parse(protectedRaw);
        if (
          parsedBackup &&
          Array.isArray(parsedBackup.profiles) &&
          parsedBackup.profiles.length > 0 &&
          (!savedList || !isCustomizedProfiles(savedList))
        ) {
          return ensureSuperAdminAndRoles(parsedBackup.profiles);
        }
      }
      return savedList ? ensureSuperAdminAndRoles(savedList) : INITIAL_PROFILES;
    } catch {
      return INITIAL_PROFILES;
    }
  });

  const [availableRoles, setAvailableRoles] = useState<string[]>(() => {
    try {
      const protectedRaw = localStorage.getItem(STORAGE_KEYS.PROTECTED_ANAGRAFICA);
      if (protectedRaw) {
        const parsedBackup = JSON.parse(protectedRaw);
        if (parsedBackup && Array.isArray(parsedBackup.availableRoles) && parsedBackup.availableRoles.length > 0) {
          return parsedBackup.availableRoles;
        }
      }
      const saved = localStorage.getItem(STORAGE_KEYS.ROLES);
      return saved ? JSON.parse(saved) : DEFAULT_AVAILABLE_ROLES;
    } catch {
      return DEFAULT_AVAILABLE_ROLES;
    }
  });

  const [profilesUpdatedAt, setProfilesUpdatedAt] = useState<number>(() => {
    try {
      const savedTs = Number(localStorage.getItem(STORAGE_KEYS.PROFILES_TS) || 0);
      if (savedTs > 0) return savedTs;
      const protectedRaw = localStorage.getItem(STORAGE_KEYS.PROTECTED_ANAGRAFICA);
      if (protectedRaw) {
        const parsedBackup = JSON.parse(protectedRaw);
        if (parsedBackup?.updatedAt) return Number(parsedBackup.updatedAt);
      }
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
      return saved ? { ...DEFAULT_QUEUE_STATE, ...JSON.parse(saved) } : DEFAULT_QUEUE_STATE;
    } catch {
      return DEFAULT_QUEUE_STATE;
    }
  });

  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (!saved) return null;
      const parsed: Profile = JSON.parse(saved);
      return isProtectedSuperAdmin(parsed) ? normalizeSuperAdminProfile(parsed) : parsed;
    } catch {
      return null;
    }
  });

  const [activeSection, setActiveSection] = useState<AppSection>('presenze');

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
  const profilesUpdatedAtRef = useRef(profilesUpdatedAt);
  profilesUpdatedAtRef.current = profilesUpdatedAt;
  const cashUpdatedAtRef = useRef(cashUpdatedAt);
  cashUpdatedAtRef.current = cashUpdatedAt;
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
      const next = {
        ...updater(prev),
        updatedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(next));
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

  const applyRemoteSnapshot = (db: CloudDbSnapshot) => {
    if (!db) return;
    isApplyingRemoteRef.current = true;

    const remoteProfTs = Number(db.profilesUpdatedAt || 0);
    const localProfTs = profilesUpdatedAtRef.current;
    let shouldPushBackLocalProtected = false;

    // Protezione Anagrafica Soci e Ruoli: applica da remoto solo se è più recente o se in locale abbiamo solo i demo di default
    if (Array.isArray(db.profiles) && db.profiles.length > 0) {
      if (remoteProfTs >= localProfTs && (remoteProfTs > 0 || localProfTs === 0)) {
        setProfiles(ensureSuperAdminAndRoles(db.profiles));
        if (remoteProfTs > 0) setProfilesUpdatedAt(remoteProfTs);
        if (Array.isArray(db.availableRoles) && db.availableRoles.length > 0) {
          setAvailableRoles(db.availableRoles);
        }
      } else if (localProfTs > remoteProfTs) {
        shouldPushBackLocalProtected = true;
      }
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
    if (remoteLessonsTs >= localLessonsTs) {
      if (Array.isArray(db.lessons)) setLessons(db.lessons);
      if (remoteLessonsTs > 0) setLessonsUpdatedAt(remoteLessonsTs);
    } else {
      shouldPushBackLocalProtected = true;
    }

    if (db.queueState) {
      const remoteQueueTs = Number(db.queueState.updatedAt || 0);
      if (remoteQueueTs >= queueUpdatedAtRef.current) {
        setQueueState(db.queueState);
        localStorage.setItem(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(db.queueState));
      }
    }

    let cleanedDuplicates = false;
    if (Array.isArray(db.attendance)) {
      const lessonsToUse = Array.isArray(db.lessons) ? db.lessons : lessons;
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
          pushCloudSnapshot({
            profiles,
            availableRoles,
            profilesUpdatedAt: profilesUpdatedAtRef.current,
            expenseCategories,
            cashMovements,
            cashOpeningBalance,
            cashUpdatedAt: cashUpdatedAtRef.current,
            lessons,
            lessonsUpdatedAt: lessonsUpdatedAtRef.current,
            attendance: Array.isArray(db.attendance) ? db.attendance : attendance,
            subjectNotes: Array.isArray(db.subjectNotes) ? db.subjectNotes : subjectNotes,
            visualHeadcounts: db.visualHeadcounts || visualHeadcounts,
            liveFeed: Array.isArray(db.liveFeed) ? db.liveFeed : liveFeed,
            queueState,
            updatedAt: new Date().toISOString(),
          });
        }, 120);
      }
    } else {
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 80);
    }
  };

  useEffect(() => {
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
            Number(data.db.profilesUpdatedAt || 0) > 0 ||
            Number(data.db.cashUpdatedAt || 0) > 0 ||
            Number(data.db.queueState?.updatedAt || 0) > 0);

        if (serverHasData) {
          applyRemoteSnapshot(data.db);
          hasHydratedRef.current = true;
        } else {
          hasHydratedRef.current = true;
          pushCloudSnapshot({
            profiles,
            availableRoles,
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
          } else if (parsed.type === 'QUEUE_SYNC' && parsed.payload?.queueState) {
            const incomingQ = parsed.payload.queueState as QueueState;
            if (Number(incomingQ.updatedAt || 0) >= queueUpdatedAtRef.current) {
              setQueueState(incomingQ);
              localStorage.setItem(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(incomingQ));
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
        } else if (ev.data?.type === 'QUEUE_SYNC' && ev.data.queueState) {
          const incomingQ = ev.data.queueState as QueueState;
          if (Number(incomingQ.updatedAt || 0) >= queueUpdatedAtRef.current) {
            setQueueState(incomingQ);
            localStorage.setItem(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(incomingQ));
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
            const incomingQ = data.queueState as QueueState;
            if (Number(incomingQ.updatedAt || 0) > queueUpdatedAtRef.current) {
              setQueueState(incomingQ);
              localStorage.setItem(STORAGE_KEYS.QUEUE_STATE, JSON.stringify(incomingQ));
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
    localStorage.setItem(STORAGE_KEYS.FONT_SCALE, fontScale);
  }, [fontScale]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LIGHT_THEME, String(lightTheme));
  }, [lightTheme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOICE, String(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(availableRoles));
    localStorage.setItem(STORAGE_KEYS.PROFILES_TS, String(profilesUpdatedAt));
    if (profilesUpdatedAt > 0 || isCustomizedProfiles(profiles)) {
      localStorage.setItem(
        STORAGE_KEYS.PROTECTED_ANAGRAFICA,
        JSON.stringify({
          profiles,
          availableRoles,
          updatedAt: profilesUpdatedAt || Date.now(),
        })
      );
    }
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(expenseCategories));
    localStorage.setItem(STORAGE_KEYS.CASH_MOVEMENTS, JSON.stringify(cashMovements));
    localStorage.setItem(STORAGE_KEYS.CASH_BALANCE, String(cashOpeningBalance));
    localStorage.setItem(STORAGE_KEYS.CASH_TS, String(cashUpdatedAt));
    localStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(lessons));
    localStorage.setItem(STORAGE_KEYS.LESSONS_TS, String(lessonsUpdatedAt));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(subjectNotes));
    localStorage.setItem(STORAGE_KEYS.HEADCOUNTS, JSON.stringify(visualHeadcounts));
    localStorage.setItem(STORAGE_KEYS.LIVE_FEED, JSON.stringify(liveFeed));

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
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
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

    const matched = profiles.find(
      (p) =>
        p.member_number.toLowerCase() === cleaned.toLowerCase() ||
        p.full_name.toLowerCase() === cleaned.toLowerCase()
    );

    if (matched) {
      if (isProtectedSuperAdmin(matched)) {
        const superAdminProfile = normalizeSuperAdminProfile(matched);
        setCurrentUser(superAdminProfile);
        setActiveSection('admin_dashboard');
        return { error: null };
      }
      setCurrentUser(matched);
      setActiveSection(matched.role === 'admin' ? 'admin_dashboard' : 'presenze');
      return { error: null };
    }

    if (/^\d+$/.test(cleaned)) {
      const autoProfile: Profile = {
        id: `u-${cleaned}`,
        member_number: cleaned,
        full_name: `Socio Tessera N° ${cleaned}`,
        sede: Number(cleaned) >= 200 && Number(cleaned) < 300 ? 'Soleminis' : 'Quartu',
        role: 'member',
        is_cd: false,
        roles: ['Socio'],
        joined_year: new Date().getFullYear(),
      };
      setProfiles((prev) => [...prev, autoProfile]);
      setCurrentUser(autoProfile);
      setActiveSection('presenze');
      return { error: null };
    }

    return {
      error: 'Numero di tessera non riconosciuto. Controlla le cifre riportate sulla tua tessera socio.',
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

  // Roles & CD Management (only Giampiero Pilia 7796 / Super Admin)
  const addCustomRole = (roleName: string) => {
    const clean = roleName.trim();
    if (!clean) return { ok: false, message: 'Inserisci il nome del ruolo.' };
    if (availableRoles.some((r) => r.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, message: 'Questo ruolo esiste già.' };
    }
    setAvailableRoles((prev) => [...prev, clean]);
    setProfilesUpdatedAt(Date.now());
    return { ok: true };
  };

  const toggleMemberCD = (userId: string, isCd: boolean) => {
    setProfiles((prev) =>
      prev.map((p) => {
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
      })
    );
    setProfilesUpdatedAt(Date.now());
  };

  const toggleMemberRole = (userId: string, roleName: string) => {
    setProfiles((prev) =>
      prev.map((p) => {
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
      })
    );
    setProfilesUpdatedAt(Date.now());
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
    if (profiles.some((p) => p.member_number.toLowerCase() === cleanNum.toLowerCase())) {
      return { ok: false, message: 'Esiste già un socio con questo numero di tessera.' };
    }
    const cleanFullName = full_name.trim() || `Socio ${cleanNum}`;
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
    setProfiles((prev) => [...prev, newProfile]);
    setProfilesUpdatedAt(Date.now());
    return { ok: true };
  };

  const importMembersBatch = (rows: ImportedMemberRow[]) => {
    let added = 0;
    let updated = 0;
    const discoveredRoles = new Set(availableRoles);

    setProfiles((prev) => {
      const next = [...prev];
      rows.forEach((row, idx) => {
        const cleanNum = String(row.member_number || '').trim();
        if (!cleanNum) return;

        const firstName = String(row.first_name || '').trim();
        const lastName = String(row.last_name || '').trim();
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

        const isCd = finalRoles.some((r) => r.toUpperCase() === 'CD' || r.toLowerCase() === 'amministratore');
        const isSuper =
          cleanNum === '7726' ||
          cleanNum === '7796' ||
          (fullName.toLowerCase().includes('giampiero') && fullName.toLowerCase().includes('pilia')) ||
          finalRoles.some((r) => r.toLowerCase() === 'amministratore');

        const existingIndex = next.findIndex(
          (p) =>
            p.member_number.toLowerCase() === cleanNum.toLowerCase() ||
            (isSuper && isProtectedSuperAdmin(p))
        );

        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            member_number: isSuper ? '7726' : cleanNum,
            first_name: firstName || next[existingIndex].first_name,
            last_name: lastName || next[existingIndex].last_name,
            full_name: fullName,
            sede,
            is_cd: isSuper ? true : isCd,
            is_super_admin: isSuper || next[existingIndex].is_super_admin,
            role: isSuper ? 'admin' : next[existingIndex].role,
            roles: isSuper ? Array.from(new Set(['Amministratore', ...finalRoles.filter((r) => r !== 'Socio')])) : finalRoles,
          };
          updated++;
        } else {
          next.push({
            id: isSuper ? 'admin-7726' : `u-imp-${Date.now()}-${idx}`,
            member_number: isSuper ? '7726' : cleanNum,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            sede,
            role: isSuper ? 'admin' : 'member',
            is_super_admin: isSuper,
            is_cd: isSuper ? true : isCd,
            roles: isSuper ? Array.from(new Set(['Amministratore', ...finalRoles.filter((r) => r !== 'Socio')])) : finalRoles,
            joined_year: new Date().getFullYear(),
          });
          added++;
        }
      });
      return ensureSuperAdminAndRoles(next);
    });

    setAvailableRoles(Array.from(discoveredRoles));
    setProfilesUpdatedAt(Date.now());
    return { added, updated };
  };

  const updateMember = (id: string, data: Partial<Profile>) => {
    setProfiles((prev) =>
      ensureSuperAdminAndRoles(
        prev.map((p) => {
          if (p.id !== id) return p;
          const merged = { ...p, ...data };
          if (isProtectedSuperAdmin(p) || isProtectedSuperAdmin(merged)) {
            return normalizeSuperAdminProfile(merged);
          }
          return merged;
        })
      )
    );
    if (currentUser?.id === id) {
      setCurrentUser((prev) => {
        if (!prev) return null;
        const merged = { ...prev, ...data };
        return isProtectedSuperAdmin(prev) || isProtectedSuperAdmin(merged)
          ? normalizeSuperAdminProfile(merged)
          : merged;
      });
    }
    setProfilesUpdatedAt(Date.now());
  };

  const deleteMember = (id: string) => {
    setProfiles((prev) =>
      ensureSuperAdminAndRoles(prev.filter((p) => isProtectedSuperAdmin(p) || p.id !== id))
    );
    setProfilesUpdatedAt(Date.now());
  };

  const deleteMembersBatch = (ids: string[]) => {
    const idSet = new Set(ids);
    setProfiles((prev) =>
      ensureSuperAdminAndRoles(prev.filter((p) => isProtectedSuperAdmin(p) || !idSet.has(p.id)))
    );
    setProfilesUpdatedAt(Date.now());
  };

  const addLesson = (lessonData: Omit<Lesson, 'id'>) => {
    const meta = getSubjectMeta(lessonData.subject);
    const newLesson: Lesson = {
      ...lessonData,
      category: lessonData.category || meta.category,
      id: `les-${Date.now()}`,
    };
    setLessons((prev) => [...prev, newLesson]);
    setLessonsUpdatedAt(Date.now());
  };

  const updateLesson = (id: string, data: Partial<Lesson>) => {
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, ...data } : l)));
    setLessonsUpdatedAt(Date.now());
  };

  const deleteLesson = (id: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== id));
    setLessonsUpdatedAt(Date.now());
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
