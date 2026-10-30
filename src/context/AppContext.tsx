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
  Lesson,
  Profile,
  sanitizeSimultaneousAttendance,
  SubjectDidacticNote,
  getSubjectMeta,
} from '../data/initialData';
import { playSuccessSound } from '../utils/soundAndPdf';

export type FontScale = 'normal' | 'large' | 'xlarge';
export type AppSection = 'presenze' | 'piccola_cassa' | 'admin_dashboard' | 'anagrafica_soci';

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
  expenseCategories?: ExpenseCategory[];
  cashMovements?: CashMovement[];
  cashOpeningBalance?: number;
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  subjectNotes: SubjectDidacticNote[];
  visualHeadcounts: Record<ClassroomKey, number>;
  liveFeed: LiveFeedEvent[];
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
  CATEGORIES: 'quartimbra_expense_categories_v4',
  CASH_MOVEMENTS: 'quartimbra_cash_movements_v4',
  CASH_BALANCE: 'quartimbra_cash_opening_balance_v4',
  LESSONS: 'quartimbra_lessons_v3',
  ATTENDANCE: 'quartimbra_attendance_v3',
  NOTES: 'quartimbra_subject_notes_v3',
  HEADCOUNTS: 'quartimbra_headcounts_v3',
  LIVE_FEED: 'quartimbra_live_feed_v3',
  FONT_SCALE: 'quartimbra_font_scale_v3',
  LIGHT_THEME: 'quartimbra_light_theme_v3',
  VOICE: 'quartimbra_voice_v3',
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

function ensureSuperAdminAndRoles(rawProfiles: Profile[]): Profile[] {
  const list = [...rawProfiles];
  const superAdmin = INITIAL_PROFILES[0]; // Giampiero Pilia (7796)
  const existingIdx = list.findIndex((p) => p.member_number === '7796' || p.id === 'admin-7796');
  if (existingIdx === -1) {
    list.unshift(superAdmin);
  } else {
    list[existingIdx] = {
      ...list[existingIdx],
      member_number: '7796',
      first_name: 'Giampiero',
      last_name: 'Pilia',
      full_name: 'Giampiero Pilia',
      role: 'admin',
      is_super_admin: true,
      is_cd: true,
      roles: ['Amministratore'],
    };
  }
  return list.map((p) => {
    if (p.member_number === '7796' || p.is_super_admin) {
      return {
        ...p,
        first_name: p.first_name || 'Giampiero',
        last_name: p.last_name || 'Pilia',
        full_name: 'Giampiero Pilia',
        is_super_admin: true,
        is_cd: true,
        roles: ['Amministratore'],
      };
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
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILES);
      return saved ? ensureSuperAdminAndRoles(JSON.parse(saved)) : INITIAL_PROFILES;
    } catch {
      return INITIAL_PROFILES;
    }
  });

  const [availableRoles, setAvailableRoles] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROLES);
      return saved ? JSON.parse(saved) : DEFAULT_AVAILABLE_ROLES;
    } catch {
      return DEFAULT_AVAILABLE_ROLES;
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

  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeSection, setActiveSection] = useState<AppSection>('presenze');

  // Keep currentUser synchronized with updated roles/CD status in profiles
  useEffect(() => {
    if (!currentUser) return;
    const updated = profiles.find((p) => p.id === currentUser.id || p.member_number === currentUser.member_number);
    if (updated && JSON.stringify(updated) !== JSON.stringify(currentUser)) {
      setCurrentUser(updated);
    }
  }, [profiles, currentUser]);

  const isSuperAdmin = Boolean(
    currentUser && (currentUser.member_number === '7796' || currentUser.is_super_admin)
  );

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
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

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

  const applyRemoteSnapshot = (db: CloudDbSnapshot) => {
    if (!db) return;
    isApplyingRemoteRef.current = true;
    if (Array.isArray(db.profiles)) setProfiles(ensureSuperAdminAndRoles(db.profiles));
    if (Array.isArray(db.availableRoles) && db.availableRoles.length > 0) {
      setAvailableRoles(db.availableRoles);
    }
    if (Array.isArray(db.expenseCategories) && db.expenseCategories.length > 0) {
      setExpenseCategories(db.expenseCategories);
    }
    if (Array.isArray(db.cashMovements)) {
      setCashMovements(db.cashMovements);
    }
    if (typeof db.cashOpeningBalance === 'number') {
      setCashOpeningBalanceState(db.cashOpeningBalance);
    }
    if (Array.isArray(db.lessons)) setLessons(db.lessons);
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
    if (cleanedDuplicates) {
      isApplyingRemoteRef.current = false;
    } else {
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 50);
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
        if (data.db && data.db.attendance && data.db.attendance.length > 0) {
          applyRemoteSnapshot(data.db);
        } else {
          pushCloudSnapshot({
            profiles,
            availableRoles,
            expenseCategories,
            cashMovements,
            cashOpeningBalance,
            lessons,
            attendance,
            subjectNotes,
            visualHeadcounts,
            liveFeed,
            updatedAt: new Date().toISOString(),
          });
        }
      })
      .catch(() => {
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
        }
      };
      broadcastChannelRef.current = bc;
    } catch {
      // BroadcastChannel not supported
    }

    return () => {
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
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(expenseCategories));
    localStorage.setItem(STORAGE_KEYS.CASH_MOVEMENTS, JSON.stringify(cashMovements));
    localStorage.setItem(STORAGE_KEYS.CASH_BALANCE, String(cashOpeningBalance));
    localStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(lessons));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(subjectNotes));
    localStorage.setItem(STORAGE_KEYS.HEADCOUNTS, JSON.stringify(visualHeadcounts));
    localStorage.setItem(STORAGE_KEYS.LIVE_FEED, JSON.stringify(liveFeed));

    if (!isApplyingRemoteRef.current) {
      pushCloudSnapshot({
        profiles,
        availableRoles,
        expenseCategories,
        cashMovements,
        cashOpeningBalance,
        lessons,
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
    expenseCategories,
    cashMovements,
    cashOpeningBalance,
    lessons,
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

  // Login: 7796 logs in as Giampiero Pilia (Super Admin), 000 logs in as Ufficio Presenze, other numbers log in as Socio
  const signInMember = (rawCardNumber: string): { error: string | null } => {
    const cleaned = rawCardNumber.trim();
    if (!cleaned) {
      return { error: 'Digita il numero della tua tessera per entrare.' };
    }

    if (cleaned === '7796') {
      const superAdminProfile =
        profiles.find((p) => p.member_number === '7796' || p.is_super_admin) || INITIAL_PROFILES[0];
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
        p.role === 'member' &&
        (p.member_number.toLowerCase() === cleaned.toLowerCase() ||
          p.full_name.toLowerCase() === cleaned.toLowerCase())
    );

    if (matched) {
      setCurrentUser(matched);
      setActiveSection('presenze');
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
    if (cleaned === '7796') {
      const superAdminProfile =
        profiles.find((p) => p.member_number === '7796' || p.is_super_admin) || INITIAL_PROFILES[0];
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
  };

  // Piccola Cassa Management
  const setCashOpeningBalance = (amount: number) => {
    setCashOpeningBalanceState(amount);
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
  };

  const updateExpenseCategory = (id: string, data: Partial<ExpenseCategory>) => {
    setExpenseCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
  };

  const deleteExpenseCategory = (id: string) => {
    setExpenseCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const addCashMovement = (movementData: Omit<CashMovement, 'id' | 'created_at'>): CashMovement => {
    const newMov: CashMovement = {
      ...movementData,
      id: `cash-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    setCashMovements((prev) => [newMov, ...prev]);
    return newMov;
  };

  const updateCashMovement = (id: string, data: Partial<CashMovement>) => {
    setCashMovements((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
  };

  const deleteCashMovement = (id: string) => {
    setCashMovements((prev) => prev.filter((m) => m.id !== id));
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
        const isSuper = cleanNum === '7796' || finalRoles.some((r) => r.toLowerCase() === 'amministratore');

        const existingIndex = next.findIndex(
          (p) => p.member_number.toLowerCase() === cleanNum.toLowerCase()
        );

        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            member_number: cleanNum,
            first_name: firstName || next[existingIndex].first_name,
            last_name: lastName || next[existingIndex].last_name,
            full_name: fullName,
            sede,
            is_cd: isCd,
            is_super_admin: isSuper || next[existingIndex].is_super_admin,
            role: isSuper ? 'admin' : next[existingIndex].role,
            roles: finalRoles,
          };
          updated++;
        } else {
          next.push({
            id: `u-imp-${Date.now()}-${idx}`,
            member_number: cleanNum,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            sede,
            role: isSuper ? 'admin' : 'member',
            is_super_admin: isSuper,
            is_cd: isCd,
            roles: finalRoles,
            joined_year: new Date().getFullYear(),
          });
          added++;
        }
      });
      return next;
    });

    setAvailableRoles(Array.from(discoveredRoles));
    return { added, updated };
  };

  const updateMember = (id: string, data: Partial<Profile>) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...data } : null));
    }
  };

  const deleteMember = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id && p.member_number !== '7796' ? true : p.id !== id));
  };

  const deleteMembersBatch = (ids: string[]) => {
    const idSet = new Set(ids);
    setProfiles((prev) =>
      prev.filter((p) => p.member_number === '7796' || p.is_super_admin || !idSet.has(p.id))
    );
  };

  const addLesson = (lessonData: Omit<Lesson, 'id'>) => {
    const meta = getSubjectMeta(lessonData.subject);
    const newLesson: Lesson = {
      ...lessonData,
      category: lessonData.category || meta.category,
      id: `les-${Date.now()}`,
    };
    setLessons((prev) => [...prev, newLesson]);
  };

  const updateLesson = (id: string, data: Partial<Lesson>) => {
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, ...data } : l)));
  };

  const deleteLesson = (id: string) => {
    setLessons((prev) => prev.filter((l) => l.id !== id));
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
    setProfiles(INITIAL_PROFILES);
    setAvailableRoles(DEFAULT_AVAILABLE_ROLES);
    setExpenseCategories(INITIAL_EXPENSE_CATEGORIES);
    setCashMovements(INITIAL_CASH_MOVEMENTS);
    setCashOpeningBalanceState(500);
    setLessons(INITIAL_LESSONS);
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
